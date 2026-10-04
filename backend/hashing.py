import os
import sqlite3
import hashlib
import time
import uuid
from typing import Optional, Dict, Any, List

class ProcessRegistry:
    """
    SQLite-backed job state registry for CleanSnap AI.
    - Unique `job_id` PRIMARY KEY (preserves every job record in history)
    - Indexed `content_hash` for fast deduplication lookup
    - Full status tracking: 'queued', 'processing', 'completed', 'skipped', 'failed'
    - Duplicate relation tracking (`duplicate_of_job_id`)
    """
    def __init__(self, db_path: str = "clean_snap.db"):
        self.db_path = os.path.abspath(db_path)
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS jobs (
                    job_id TEXT PRIMARY KEY,
                    batch_id TEXT NOT NULL,
                    source_path TEXT NOT NULL,
                    original_filename TEXT NOT NULL,
                    content_hash TEXT NOT NULL,
                    status TEXT NOT NULL,
                    duplicate_of_job_id TEXT,
                    model_used TEXT,
                    catalog_white_path TEXT,
                    transparent_path TEXT,
                    error_reason TEXT,
                    created_at REAL NOT NULL,
                    started_at REAL,
                    completed_at REAL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_content_hash ON jobs(content_hash)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_batch_id ON jobs(batch_id)")
            conn.commit()

    @staticmethod
    def calculate_file_hash(file_path: str, chunk_size: int = 65536) -> Optional[str]:
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            return None
        sha256 = hashlib.sha256()
        try:
            with open(file_path, "rb") as f:
                while chunk := f.read(chunk_size):
                    sha256.update(chunk)
            return sha256.hexdigest()
        except Exception:
            return None

    def create_job(
        self,
        batch_id: str,
        source_path: str,
        original_filename: str,
        content_hash: str,
        status: str = "queued",
        duplicate_of_job_id: Optional[str] = None
    ) -> str:
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        now = time.time()
        with self._get_conn() as conn:
            conn.execute("""
                INSERT INTO jobs 
                (job_id, batch_id, source_path, original_filename, content_hash, status, duplicate_of_job_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (job_id, batch_id, source_path, original_filename, content_hash, status, duplicate_of_job_id, now))
            conn.commit()
        return job_id

    def update_job_status(
        self,
        job_id: str,
        status: str,
        model_used: Optional[str] = None,
        catalog_white_path: Optional[str] = None,
        transparent_path: Optional[str] = None,
        error_reason: Optional[str] = None,
        duplicate_of_job_id: Optional[str] = None
    ):
        now = time.time()
        with self._get_conn() as conn:
            if status == "processing":
                conn.execute("UPDATE jobs SET status = ?, started_at = ? WHERE job_id = ?", (status, now, job_id))
            elif status in ("completed", "skipped", "failed"):
                conn.execute("""
                    UPDATE jobs SET 
                        status = ?, 
                        model_used = COALESCE(?, model_used), 
                        catalog_white_path = COALESCE(?, catalog_white_path), 
                        transparent_path = COALESCE(?, transparent_path), 
                        error_reason = COALESCE(?, error_reason), 
                        duplicate_of_job_id = COALESCE(?, duplicate_of_job_id),
                        completed_at = ? 
                    WHERE job_id = ?
                """, (status, model_used, catalog_white_path, transparent_path, error_reason, duplicate_of_job_id, now, job_id))
            else:
                conn.execute("UPDATE jobs SET status = ? WHERE job_id = ?", (status, job_id))
            conn.commit()

    def find_completed_job_by_hash(self, content_hash: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM jobs 
                WHERE content_hash = ? AND status = 'completed' 
                ORDER BY completed_at DESC LIMIT 1
            """, (content_hash,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_job_by_id(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_jobs_by_batch(self, batch_id: str) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM jobs WHERE batch_id = ? ORDER BY created_at ASC", (batch_id,))
            return [dict(row) for row in cursor.fetchall()]

    def get_all_jobs(self) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM jobs ORDER BY created_at DESC")
            return [dict(row) for row in cursor.fetchall()]
