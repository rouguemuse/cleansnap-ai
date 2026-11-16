from pathlib import Path
import sys
import tempfile
import unittest
import numpy as np
from PIL import Image

ROOT_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT_DIR))

from backend.hashing import ProcessRegistry


class TestCleanSnapAssetAndBackendQA(unittest.TestCase):

  def test_01_showcase_cutouts_have_genuine_alpha_and_clean_borders(self):
    samples_dir = ROOT_DIR / "frontend" / "public" / "samples"
    cutouts = [
        "figure_greenscreen_cutout.webp",
        "tropical_slide_cutout.webp",
        "wax_letter_cutout.webp",
        "red_coat_cutout.webp",
        "graphic_umbrella_cutout.webp",
        "sports_coupe_cutout.webp",
    ]
    for name in cutouts:
      p = samples_dir / name
      self.assertTrue(p.exists(), f"Missing cutout asset: {name}")
      im = Image.open(p).convert("RGBA")
      arr = np.array(im)
      alpha = arr[:, :, 3]
      total_px = alpha.size
      opaque_ratio = float(np.sum(alpha > 20)) / total_px
      transparent_ratio = float(np.sum(alpha == 0)) / total_px

      self.assertGreater(
          transparent_ratio,
          0.20,
          f"{name} lacks sufficient transparent background ({transparent_ratio:.2%})",
      )
      self.assertGreater(
          opaque_ratio,
          0.10,
          f"{name} has too little foreground subject ({opaque_ratio:.2%})",
      )

      top_border_opaque = float(np.mean(alpha[0, :] > 128))
      self.assertLess(
          top_border_opaque,
          0.15,
          f"{name} has rectangular top-border remnant ({top_border_opaque:.2%})",
      )

  def test_02_sha256_hashing_and_sqlite_registry(self):
    sample_file = (
        ROOT_DIR
        / "frontend"
        / "public"
        / "samples"
        / "wax_letter_cutout.webp"
    )
    h1 = ProcessRegistry.calculate_file_hash(str(sample_file))
    h2 = ProcessRegistry.calculate_file_hash(str(sample_file))
    self.assertIsNotNone(h1)
    self.assertEqual(len(h1), 64)
    self.assertEqual(h1, h2)

    with tempfile.TemporaryDirectory() as tmpdir:
      db_path = Path(tmpdir) / "test_qa.db"
      reg = ProcessRegistry(str(db_path))
      job_id = reg.create_job(
          "batch_01", str(sample_file), "wax_letter_cutout.webp", h1
      )
      reg.update_job_status(job_id, "completed", model_used="u2netp")
      found = reg.find_completed_job_by_hash(h1)
      self.assertIsNotNone(found)
      self.assertEqual(found["job_id"], job_id)


if __name__ == "__main__":
  unittest.main(verbosity=2)
