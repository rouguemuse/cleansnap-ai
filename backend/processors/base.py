from abc import ABC, abstractmethod
from typing import Dict, Any, Tuple
import os
from PIL import Image, ImageOps

SUPPORTED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.heic', '.heif'}

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    pass

class BaseProcessor(ABC):
    """
    Abstract base class for CleanSnap processing pipelines (Product Cleaner, Real Estate Enhancer, etc.).
    """
    @abstractmethod
    def process(self, input_path: str, output_dir: str, **kwargs) -> Dict[str, Any]:
        pass

    @staticmethod
    def is_valid_image(file_path: str) -> Tuple[bool, str]:
        if not os.path.exists(file_path):
            return False, "File does not exist"
        ext = os.path.splitext(file_path)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            return False, f"Unsupported file extension '{ext}'"
        try:
            with Image.open(file_path) as img:
                img.verify()
            return True, "Valid"
        except Exception as e:
            return False, f"Invalid or corrupted image file: {e}"

    @staticmethod
    def load_image_auto_exif(file_path: str) -> Image.Image:
        """
        Loads image with automatic EXIF orientation rotation handling (essential for iPhone HEIC/JPEG photos).
        """
        img = Image.open(file_path)
        img = ImageOps.exif_transpose(img)
        return img.convert("RGB")
