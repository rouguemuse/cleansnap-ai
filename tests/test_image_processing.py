
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from processors.base import BaseProcessor
from processors.product_cleaner import ProductCleanerProcessor


class ImageProcessingTests(unittest.TestCase):

    def test_invalid_image_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "not_an_image.jpg"
            path.write_text("This is not an image")

            valid, reason = BaseProcessor.is_valid_image(
                str(path)
            )

            self.assertFalse(valid)
            self.assertIn("Invalid", reason)

    def test_catalog_and_transparent_outputs(self):
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            source = folder / "product.png"
            output = folder / "output"

            Image.new(
                "RGB", (80, 80), "white"
            ).save(source)

            # Simulate an AI-produced subject mask.
            rgba = Image.new(
                "RGBA", (80, 80), (0, 0, 0, 0)
            )
            draw = ImageDraw.Draw(rgba)
            draw.rectangle(
                (20, 20, 60, 60),
                fill=(220, 40, 40, 255)
            )

            mask = rgba.getchannel("A")

            class FakeEngine:
                def generate_masks_and_rgba(
                    self, image, alpha_matting=False
                ):
                    return mask, mask.copy(), rgba

            processor = ProductCleanerProcessor()

            with patch.object(
                processor,
                "get_engine",
                return_value=FakeEngine()
            ):
                result = processor.process(
                    input_path=str(source),
                    output_dir=str(output),
                    canvas_size=(200, 200),
                    enhance_color=False,
                    add_shadow=False,
                )

            self.assertTrue(
                result["success"], msg=str(result)
            )

            with Image.open(
                result["transparent_output"]
            ) as transparent:
                self.assertEqual(
                    transparent.size, (200, 200)
                )
                self.assertEqual(
                    transparent.mode, "RGBA"
                )
                self.assertEqual(
                    transparent.getpixel((0, 0))[3], 0
                )
                self.assertGreater(
                    transparent.getchannel("A").getextrema()[1],
                    0
                )

            with Image.open(
                result["catalog_white_output"]
            ) as catalog:
                self.assertEqual(
                    catalog.size, (200, 200)
                )
                self.assertEqual(catalog.mode, "RGB")
                self.assertEqual(
                    catalog.getpixel((0, 0)),
                    (255, 255, 255)
                )


if __name__ == "__main__":
    unittest.main()
