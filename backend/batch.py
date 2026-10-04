import os
import sys
import time
import uuid
import logging
from typing import List, Dict, Any, Optional, Tuple

from processors.product_cleaner import ProductCleanerProcessor
from processors.base import SUPPORTED_EXTENSIONS
from hashing import ProcessRegistry

logger = logging.getLogger("batch")

class BatchEngine:
    """
    Stage 2 & 3 Batch Processing Engine:
    - Unique `job_id` PK tracking every file in SQLite
    - Active in-memory hash tracking (`seen_batch_hashes`) for same-batch deduplication
    - Content-hash (SHA-256) deduplication across current batch and historical DB records
    - Zero AI inference on duplicates
    - Fallback mechanism: Primary model 'isnet-general-use', fallback to 'u2net'
    - Error isolation: Double model failure isolates to single job without crashing batch
    - Perfect accounting: completed + skipped + failed == total_files
    """
    def __init__(
        self,
        registry: Optional[ProcessRegistry] = None,
        primary_model: str = "isnet-general-use",
        fallback_model: str = "u2net"
    ):
        self.registry = registry or ProcessRegistry()
        self.primary_model = primary_model
        self.fallback_model = fallback_model
        self.processor = ProductCleanerProcessor(default_model=self.primary_model)

    def process_batch(
        self,
        file_paths: List[str],
        output_dir: str,
        force_reprocess: bool = False,
        batch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        t_start = time.time()
        active_batch_id = batch_id or f"batch_{uuid.uuid4().hex[:10]}"
        output_dir = os.path.abspath(output_dir)
        os.makedirs(output_dir, exist_ok=True)

        total_files = len(file_paths)
        completed_count = 0
        skipped_count = 0
        failed_count = 0
        duplicate_count = 0

        details = []

        seen_batch_hashes: Dict[str, str] = {}

        logger.info(f"[{active_batch_id}] Starting Batch Process on {total_files} items -> Output: {output_dir}")

        inference_queue: List[Tuple[str, str, str, str]] = []

        for path in file_paths:
            filename = os.path.basename(path)

            if not os.path.exists(path) or not os.path.isfile(path):
                reason = "File does not exist or is not a regular file"
                logger.warning(f"File failed: {filename} -> {reason}")
                job_id = self.registry.create_job(
                    batch_id=active_batch_id,
                    source_path=path,
                    original_filename=filename,
                    content_hash="INVALID_FILE",
                    status="failed"
                )
                self.registry.update_job_status(job_id=job_id, status="failed", error_reason=reason)
                failed_count += 1
                details.append({
                    "job_id": job_id,
                    "path": path,
                    "filename": filename,
                    "status": "failed",
                    "reason": reason
                })
                continue

            ext = os.path.splitext(path)[1].lower()
            if ext not in SUPPORTED_EXTENSIONS:
                reason = f"Unsupported file format '{ext}' (Expected static image)"
                logger.warning(f"File skipped: {filename} -> {reason}")
                job_id = self.registry.create_job(
                    batch_id=active_batch_id,
                    source_path=path,
                    original_filename=filename,
                    content_hash="UNSUPPORTED_FORMAT",
                    status="skipped"
                )
                self.registry.update_job_status(job_id=job_id, status="skipped", error_reason=reason)
                skipped_count += 1
                details.append({
                    "job_id": job_id,
                    "path": path,
                    "filename": filename,
                    "status": "skipped",
                    "reason": reason
                })
                continue

            content_hash = ProcessRegistry.calculate_file_hash(path)
            if not content_hash:
                reason = "Failed to calculate file SHA-256 hash"
                job_id = self.registry.create_job(
                    batch_id=active_batch_id,
                    source_path=path,
                    original_filename=filename,
                    content_hash="HASH_ERROR",
                    status="failed"
                )
                self.registry.update_job_status(job_id=job_id, status="failed", error_reason=reason)
                failed_count += 1
                details.append({
                    "job_id": job_id,
                    "path": path,
                    "filename": filename,
                    "status": "failed",
                    "reason": reason
                })
                continue

            canonical_job_id = None
            canonical_white = None
            canonical_trans = None

            if not force_reprocess:
                if content_hash in seen_batch_hashes:
                    canonical_job_id = seen_batch_hashes[content_hash]
                    canon_job_data = self.registry.get_job_by_id(canonical_job_id)
                    if canon_job_data:
                        canonical_white = canon_job_data.get("catalog_white_path")
                        canonical_trans = canon_job_data.get("transparent_path")
                else:
                    hist_job = self.registry.find_completed_job_by_hash(content_hash)
                    if hist_job:
                        white_ok = hist_job["catalog_white_path"] and os.path.exists(hist_job["catalog_white_path"])
                        trans_ok = hist_job["transparent_path"] and os.path.exists(hist_job["transparent_path"])
                        if white_ok and trans_ok:
                            canonical_job_id = hist_job["job_id"]
                            canonical_white = hist_job["catalog_white_path"]
                            canonical_trans = hist_job["transparent_path"]

            if canonical_job_id:
                reason = f"Duplicate content of job '{canonical_job_id}'"
                logger.info(f"Duplicate content skipped before AI inference: {filename} -> Canonical Job: {canonical_job_id}")

                job_id = self.registry.create_job(
                    batch_id=active_batch_id,
                    source_path=path,
                    original_filename=filename,
                    content_hash=content_hash,
                    status="skipped",
                    duplicate_of_job_id=canonical_job_id
                )
                self.registry.update_job_status(
                    job_id=job_id,
                    status="skipped",
                    catalog_white_path=canonical_white,
                    transparent_path=canonical_trans,
                    error_reason=reason,
                    duplicate_of_job_id=canonical_job_id
                )

                skipped_count += 1
                duplicate_count += 1
                details.append({
                    "job_id": job_id,
                    "path": path,
                    "filename": filename,
                    "status": "skipped",
                    "reason": reason,
                    "duplicate_of_job_id": canonical_job_id,
                    "catalog_white_path": canonical_white,
                    "transparent_path": canonical_trans
                })
                continue

            job_id = self.registry.create_job(
                batch_id=active_batch_id,
                source_path=path,
                original_filename=filename,
                content_hash=content_hash,
                status="queued"
            )

            seen_batch_hashes[content_hash] = job_id
            inference_queue.append((job_id, path, filename, content_hash))

        logger.info(f"Queue building finished: {len(inference_queue)} items queued for AI inference.")

        for job_id, path, filename, content_hash in inference_queue:
            self.registry.update_job_status(job_id=job_id, status="processing")

            prefix = f"{job_id[:8]}_"

            model_used = self.primary_model
            res = self.processor.process(
                input_path=path,
                output_dir=output_dir,
                model_name=model_used,
                add_shadow=True,
                prefix=prefix
            )

            if not res["success"]:
                logger.warning(f"[{job_id}] Primary model [{self.primary_model}] failed for '{filename}'. Attempting fallback [{self.fallback_model}]...")
                model_used = self.fallback_model
                res = self.processor.process(
                    input_path=path,
                    output_dir=output_dir,
                    model_name=model_used,
                    add_shadow=True,
                    prefix=prefix
                )

            if res["success"]:
                completed_count += 1
                white_out = res["catalog_white_output"]
                trans_out = res["transparent_output"]

                self.registry.update_job_status(
                    job_id=job_id,
                    status="completed",
                    model_used=model_used,
                    catalog_white_path=white_out,
                    transparent_path=trans_out
                )

                details.append({
                    "job_id": job_id,
                    "path": path,
                    "filename": filename,
                    "status": "completed",
                    "model_used": model_used,
                    "catalog_white_path": white_out,
                    "transparent_path": trans_out,
                    "processing_time": res["processing_time"]
                })
            else:
                failed_count += 1
                error_msg = res.get("error", "Failed on all segmentation models")
                logger.error(f"[{job_id}] Processing failed for '{filename}': {error_msg}")
                self.registry.update_job_status(
                    job_id=job_id,
                    status="failed",
                    error_reason=error_msg
                )
                details.append({
                    "job_id": job_id,
                    "path": path,
                    "filename": filename,
                    "status": "failed",
                    "reason": error_msg
                })

        duration = round(time.time() - t_start, 2)

        assert (completed_count + skipped_count + failed_count) == total_files

        summary = {
            "batch_id": active_batch_id,
            "total_files": total_files,
            "successfully_processed": completed_count,
            "skipped": skipped_count,
            "duplicates": duplicate_count,
            "failed": failed_count,
            "processing_duration_sec": duration,
            "details": details
        }

        logger.info(f"[{active_batch_id}] Batch finished in {duration}s: {completed_count} completed, {skipped_count} skipped ({duplicate_count} duplicates), {failed_count} failed.")
        return summary
