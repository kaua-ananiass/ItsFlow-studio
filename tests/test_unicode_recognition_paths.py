import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
import executar_automacao as motor


class UnicodeRecognitionPathTests(unittest.TestCase):
    def test_template_is_decoded_from_bytes_in_accented_directory(self):
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder) / "ATUALIZA\u00c7\u00c2O"
            base.mkdir()
            image = base / "refer\u00eancia.png"
            Image.new("RGB", (43, 21), (10, 90, 170)).save(image)
            executor = motor.ExecutorAutomacao.__new__(motor.ExecutorAutomacao)
            executor._cache_template_imagem = {}
            with patch.object(motor.cv2, "imread", side_effect=AssertionError("Native filename loader must not be used")):
                result = executor.carregar_template_imagem(image)
            self.assertEqual((result["width"], result["height"]), (43, 21))
            self.assertEqual(result["bgr"][0, 0].tolist(), [170, 90, 10])
            self.assertIs(executor.carregar_template_imagem(image), result)

    @unittest.skipUnless(os.name == "nt", "Windows native path compatibility")
    def test_pyscreeze_receives_pixels_for_accented_paths(self):
        with tempfile.TemporaryDirectory() as folder:
            image = Path(folder) / "refer\u00eancia.png"
            Image.new("RGB", (25, 12), "white").save(image)
            reference = motor.referencia_para_pyscreeze(image)
            self.assertIsInstance(reference, Image.Image)
            self.assertEqual(reference.size, (25, 12))

    @unittest.skipUnless(os.name == "nt", "Windows native path compatibility")
    def test_unicode_models_use_reusable_ascii_cache_and_refresh_after_change(self):
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder)
            models = base / "ATUALIZA\u00c7\u00c2O" / "tessdata"
            models.mkdir(parents=True)
            (models / "eng.traineddata").write_bytes(b"model-one")
            (models / "por.traineddata").write_bytes(b"portuguese-model")
            def no_alias(path):
                return str(path) if Path(path) == models else original_short(path)
            original_short = motor.caminho_windows_curto
            with patch.object(motor, "caminho_windows_curto", side_effect=no_alias), patch.object(motor.tempfile, "gettempdir", return_value=str(base)):
                destination = Path(motor.preparar_dados_tesseract(models))
                self.assertTrue(str(destination).isascii())
                self.assertEqual((destination / "eng.traineddata").read_bytes(), b"model-one")
                self.assertEqual((destination / "por.traineddata").read_bytes(), b"portuguese-model")
                before = (destination / "eng.traineddata").stat().st_mtime_ns
                self.assertEqual(motor.preparar_dados_tesseract(models), str(destination))
                self.assertEqual((destination / "eng.traineddata").stat().st_mtime_ns, before)
                (models / "eng.traineddata").write_bytes(b"model-new-version")
                updated = Path(motor.preparar_dados_tesseract(models))
                self.assertNotEqual(destination, updated)
                self.assertEqual((updated / "eng.traineddata").read_bytes(), b"model-new-version")
                self.assertEqual(list(updated.glob("model-*")), [])

    def test_ascii_model_directory_requires_no_copy(self):
        with tempfile.TemporaryDirectory() as folder:
            models = Path(folder) / "tessdata"
            models.mkdir()
            with patch.object(motor, "caminho_windows_curto", return_value="C:/ascii/tessdata"), patch.object(motor.shutil, "copyfileobj") as copy:
                self.assertEqual(motor.preparar_dados_tesseract(models), "C:/ascii/tessdata")
            copy.assert_not_called()


if __name__ == "__main__":
    unittest.main()
