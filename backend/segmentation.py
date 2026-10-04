import io
import logging
from typing import Dict, Tuple, Optional
from PIL import Image
import numpy as np

logger = logging.getLogger("segmentation")

class SegmentationEngine:
    """
    Swappable segmentation engine supporting multiple rembg ONNX models:
    - isnet-general-use (High Detail - Primary)
    - u2net (Standard Fast - Fallback)
    - birefnet-general (BiRefNet General)
    - birefnet-hrsod (High Resolution SOD)
    - silueta (Lightweight)
    """
    def __init__(self, model_name: str = "isnet-general-use"):
        self.model_name = model_name
        self.session = None
        self._load_session()

    def _load_session(self):
        import rembg
        logger.info(f"Loading segmentation model session: [{self.model_name}]")
        try:
            self.session = rembg.new_session(self.model_name)
        except Exception as e:
            logger.warning(f"Could not load model '{self.model_name}', falling back to 'u2net': {e}")
            self.model_name = "u2net"
            self.session = rembg.new_session("u2net")

    def generate_masks_and_rgba(
        self,
        img: Image.Image,
        alpha_matting: bool = False
    ) -> Tuple[Image.Image, Image.Image, Image.Image]:
        import rembg

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        img_bytes = buffer.getvalue()

        # 1. Raw AI Model Output (preserves mesh netting and fine opening details)
        raw_bytes = rembg.remove(
            img_bytes,
            session=self.session,
            alpha_matting=False
        )
        rgba_raw = Image.open(io.BytesIO(raw_bytes)).convert("RGBA")
        raw_mask = rgba_raw.split()[3]

        # 2. Refined Mask (optional alpha matting)
        if alpha_matting:
            refined_bytes = rembg.remove(
                img_bytes,
                session=self.session,
                alpha_matting=True,
                alpha_matting_foreground_threshold=240,
                alpha_matting_background_threshold=10,
                alpha_matting_erode_size=5
            )
            rgba_refined = Image.open(io.BytesIO(refined_bytes)).convert("RGBA")
            refined_mask = rgba_refined.split()[3]
            final_rgba = rgba_refined
        else:
            refined_mask = raw_mask.copy()
            final_rgba = rgba_raw

        return raw_mask, refined_mask, final_rgba
