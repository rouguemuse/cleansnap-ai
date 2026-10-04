import os
import time
import logging
from typing import Callable, Optional, Set, List
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from processors.base import SUPPORTED_EXTENSIONS
from hashing import ProcessRegistry
from batch import BatchEngine

logger = logging.getLogger("watcher")

class FileStabilityChecker:
    """
    Ensures Windows file copy/download operations are completely finished before processing.
    Checks file size stability and lock release over a short interval.
    """
    @staticmethod
    def wait_until_stable(file_path: str, timeout: float = 15.0, check_interval: float = 0.5) -> bool:
        if not os.path.exists(file_path):
            return False
        
        start_time = time.time()
        last_size = -1
        
        while time.time() - start_time < timeout:
            try:
                current_size = os.path.getsize(file_path)
                if current_size > 0 and current_size == last_size:
                    with open(file_path, "rb") as f:
                        pass
                    return True
                last_size = current_size
            except (OSError, PermissionError):
                pass
            time.sleep(check_interval)
            
        return False

class ProductPhotoHandler(FileSystemEventHandler):
    """
    Watchdog event handler monitoring newly created or modified files in watched directory.
    """
    def __init__(
        self, 
        output_dir: str, 
        batch_engine: BatchEngine,
        on_process_callback: Optional[Callable] = None
    ):
        super().__init__()
        self.output_dir = os.path.abspath(output_dir)
        self.batch_engine = batch_engine
        self.on_process_callback = on_process_callback
        self.processing_paths: Set[str] = set()

    def is_output_file(self, file_path: str) -> bool:
        norm_path = os.path.abspath(file_path)
        if norm_path.startswith(self.output_dir):
            return True
        base = os.path.basename(file_path).lower()
        if "_catalog_white" in base or "_transparent" in base or "_raw_mask" in base or "_refined_mask" in base:
            return True
        return False

    def on_created(self, event):
        if not event.is_directory:
            self.handle_file(event.src_path)

    def on_modified(self, event):
        if not event.is_directory:
            self.handle_file(event.src_path)

    def handle_file(self, file_path: str):
        file_path = os.path.abspath(file_path)
        if file_path in self.processing_paths:
            return

        ext = os.path.splitext(file_path)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            return

        if self.is_output_file(file_path):
            return

        self.processing_paths.add(file_path)
        try:
            stable = FileStabilityChecker.wait_until_stable(file_path)
            if not stable:
                logger.warning(f"File did not stabilize in time: {file_path}")
                return

            logger.info(f"[Watcher] New stable image detected: {os.path.basename(file_path)}")
            
            summary = self.batch_engine.process_batch(
                file_paths=[file_path],
                output_dir=self.output_dir,
                batch_id=f"watcher_{int(time.time())}"
            )

            if self.on_process_callback:
                self.on_process_callback(summary)

        finally:
            self.processing_paths.discard(file_path)

class CleanSnapWatcher:
    """
    Folder watcher manager for CleanSnap AI.
    """
    def __init__(
        self, 
        watch_dir: str, 
        output_dir: str, 
        batch_engine: BatchEngine,
        on_process_callback: Optional[Callable] = None
    ):
        self.watch_dir = os.path.abspath(watch_dir)
        self.output_dir = os.path.abspath(output_dir)
        self.batch_engine = batch_engine
        self.on_process_callback = on_process_callback
        
        self.observer: Optional[Observer] = None
        self.handler: Optional[ProductPhotoHandler] = None
        self.is_running = False

    def start(self):
        if self.is_running:
            return
        os.makedirs(self.watch_dir, exist_ok=True)
        os.makedirs(self.output_dir, exist_ok=True)

        self.handler = ProductPhotoHandler(
            output_dir=self.output_dir,
            batch_engine=self.batch_engine,
            on_process_callback=self.on_process_callback
        )
        self.observer = Observer()
        self.observer.schedule(self.handler, self.watch_dir, recursive=False)
        self.observer.start()
        self.is_running = True
        logger.info(f"CleanSnap Watcher STARTED watching: {self.watch_dir}")

    def stop(self):
        if not self.is_running or not self.observer:
            return
        self.observer.stop()
        self.observer.join()
        self.is_running = False
        logger.info("CleanSnap Watcher STOPPED.")
