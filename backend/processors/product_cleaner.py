import os
import time
import logging
from typing import Dict, Any, Tuple, Optional
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw

from .base import BaseProcessor
from segmentation import SegmentationEngine

logger = logging.getLogger("product_cleaner")

class ProductCleanerProcessor(BaseProcessor):
    """
    Catalog Standard Product Cleaner for Inflatables, Bounce Houses, and Products.
    """
    def __init__(self, default_model: str = "isnet-general-use"):
        self.engines: Dict[str, SegmentationEngine] = {}
        self.default_model = default_model

    def get_engine(self, model_name: str) -> SegmentationEngine:
        if model_name not in self.engines:
            self.engines[model_name] = SegmentationEngine(model_name)
        return self.engines[model_name]

    def process(
        self,
        input_path: str,
        output_dir: str,
        model_name: Optional[str] = None,
        canvas_size: Tuple[int, int] = (2000, 2000),
        max_occupancy: float = 0.88,
        min_margin: float = 0.06,
        ground_line_ratio: float = 0.88,
        enhance_color: bool = True,
        add_shadow: bool = True,
        alpha_matting: bool = False,
        prefix: str = ""
    ) -> Dict[str, Any]:
        t0 = time.time()
        model_to_use = model_name or self.default_model

        valid, reason = self.is_valid_image(input_path)
        if not valid:
            logger.warning(f"Skipping {input_path}: {reason}")
            return {"success": False, "input_path": input_path, "error": reason}

        os.makedirs(output_dir, exist_ok=True)
        filename = os.path.basename(input_path)
        base_name = os.path.splitext(filename)[0]

        try:
            # 1. Load image with auto EXIF rotation
            raw_img = self.load_image_auto_exif(input_path)

            # Save original benchmark copy if requested
            orig_save_path = os.path.join(output_dir, f"{prefix}{base_name}_0_original.jpg")
            raw_img.save(orig_save_path, format="JPEG", quality=95)

            # 2. AI Segmentation (Raw Mask, Refined Mask, RGBA)
            engine = self.get_engine(model_to_use)
            raw_mask, refined_mask, rgba_img = engine.generate_masks_and_rgba(
                raw_img, 
                alpha_matting=alpha_matting
            )

            # Save Raw Mask & Refined Mask for diagnostics
            raw_mask_path = os.path.join(output_dir, f"{prefix}{base_name}_1_raw_mask.png")
            raw_mask.save(raw_mask_path)

            refined_mask_path = os.path.join(output_dir, f"{prefix}{base_name}_2_refined_mask.png")
            refined_mask.save(refined_mask_path)

            # 3. Studio Polish, Shadow Lift, Brightening, Vibrance & Crispness Enhancement
            if enhance_color:
                r, g, b, a = rgba_img.split()
                rgb = Image.merge("RGB", (r, g, b))
                # Lift dark outdoor shadows & brighten vinyl surfaces
                rgb = ImageEnhance.Brightness(rgb).enhance(1.12)
                # Studio gloss contrast boost
                rgb = ImageEnhance.Contrast(rgb).enhance(1.14)
                # Color pop / vibrance boost
                rgb = ImageEnhance.Color(rgb).enhance(1.22)
                # Unsharp mask crispness pass for sharp stitching & graphic details
                rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.6, percent=135, threshold=3))
                r_e, g_e, b_e = rgb.split()
                rgba_img = Image.merge("RGBA", (r_e, g_e, b_e, a))

            # 4. Auto Crop around non-transparent bounding box
            bbox = rgba_img.getbbox()
            if bbox:
                cropped = rgba_img.crop(bbox)
            else:
                cropped = rgba_img

            cw, ch = cropped.size
            canvas_w, canvas_h = canvas_size

            # 5. Standardized Catalog Scale Math (Occupancy 88%, min margin 6%, ground line 88-90%)
            max_allowed_w = int(canvas_w * max_occupancy)
            max_allowed_h = int(canvas_h * (ground_line_ratio - min_margin))

            scale_w = max_allowed_w / float(cw)
            scale_h = max_allowed_h / float(ch)
            scale = min(scale_w, scale_h)

            new_w = max(1, int(cw * scale))
            new_h = max(1, int(ch * scale))

            resized_product = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)

            # 6. Alignment Math: Horizontal Center, Ground Line Bottom
            pos_x = (canvas_w - new_w) // 2
            ground_y = int(canvas_h * ground_line_ratio)
            pos_y = ground_y - new_h

            min_top = int(canvas_h * min_margin)
            if pos_y < min_top:
                pos_y = min_top

            # --- OUTPUT 3: Transparent Canvas ---
            transparent_canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
            transparent_canvas.paste(resized_product, (pos_x, pos_y), resized_product)
            transparent_path = os.path.join(output_dir, f"{prefix}{base_name}_3_transparent.png")
            transparent_canvas.save(transparent_path, format="PNG")

            # --- OUTPUT 4: Catalog White JPEG + Ground Contact Shadow ---
            white_canvas = Image.new("RGBA", (canvas_w, canvas_h), (255, 255, 255, 255))

            if add_shadow:
                shadow_w = int(new_w * 0.95)
                shadow_h = max(8, int(new_h * 0.04))
                shadow_surf = Image.new("RGBA", (shadow_w, shadow_h), (0, 0, 0, 0))
                draw = ImageDraw.Draw(shadow_surf)
                draw.ellipse([0, 0, shadow_w, shadow_h], fill=(30, 30, 30, 80))
                shadow_surf = shadow_surf.filter(ImageFilter.GaussianBlur(radius=int(shadow_h * 0.6)))
                
                shadow_x = (canvas_w - shadow_w) // 2
                shadow_y = pos_y + new_h - int(shadow_h * 0.5)
                white_canvas.paste(shadow_surf, (shadow_x, shadow_y), shadow_surf)

            white_canvas.paste(resized_product, (pos_x, pos_y), resized_product)
            catalog_white_path = os.path.join(output_dir, f"{prefix}{base_name}_4_catalog_white.jpg")
            white_canvas.convert("RGB").save(catalog_white_path, format="JPEG", quality=95)

            elapsed = time.time() - t0
            return {
                "success": True,
                "input_path": input_path,
                "filename": filename,
                "model_used": model_to_use,
                "original_output": orig_save_path,
                "raw_mask_output": raw_mask_path,
                "refined_mask_output": refined_mask_path,
                "transparent_output": transparent_path,
                "catalog_white_output": catalog_white_path,
                "processing_time": round(elapsed, 2)
            }

        except Exception as e:
            logger.error(f"Error processing '{filename}': {e}", exc_info=True)
            return {"success": False, "input_path": input_path, "filename": filename, "error": str(e)}
