import contextlib
import importlib.util
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("verify_static", Path(__file__).with_name("verify-static.py"))
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class StaticVerificationTest(unittest.TestCase):
    def setUp(self):
        verifier.failures.clear()
        verifier.passes.clear()

    def test_generated_and_dependency_json_does_not_affect_source_validation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ("src/config.json", "node_modules/broken.json", "backend/build/broken.json", ".local/session.json"):
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text("{}" if name.startswith("src/") else "not json", encoding="utf-8")
            with patch.object(verifier, "PROJECT_ROOT", root), contextlib.redirect_stdout(io.StringIO()):
                verifier.check_json()
            self.assertEqual(verifier.failures, [])
            self.assertEqual(verifier.passes, ["JSON syntax: 1 files"])

    def test_invalid_source_json_is_reported_as_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "broken.json").write_text("{", encoding="utf-8")
            with patch.object(verifier, "PROJECT_ROOT", root), contextlib.redirect_stdout(io.StringIO()):
                verifier.check_json()
            self.assertEqual(len(verifier.failures), 1)
            self.assertEqual(verifier.passes, [])

    def test_dotted_imports_and_index_modules_resolve_but_empty_directories_do_not(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "value.model.ts").touch()
            (root / "module").mkdir()
            (root / "module/index.ts").touch()
            (root / "empty").mkdir()
            source = root / "page.ts"
            self.assertTrue(verifier.resolve_import(source, "./value.model"))
            self.assertTrue(verifier.resolve_import(source, "./module"))
            self.assertFalse(verifier.resolve_import(source, "./empty"))
            self.assertFalse(verifier.resolve_import(source, "./missing"))

    def test_nested_shell_scripts_are_included_in_syntax_checks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "scripts").mkdir()
            nested = root / "scripts/deploy.sh"
            nested.touch()
            self.assertEqual(verifier.source_files(root, {".sh"}), [nested])


if __name__ == "__main__":
    unittest.main()
