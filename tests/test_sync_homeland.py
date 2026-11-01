import unittest
import json
import os
from pathlib import Path

class TestHomelandSyncAndProfile(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo_root = Path(__file__).resolve().parent.parent
        cls.data_dir = cls.repo_root / "web" / "data"

    def test_my_homeland_json_exists_and_valid(self):
        target = self.data_dir / "my_homeland.json"
        self.assertTrue(target.exists(), "my_homeland.json debe existir")
        with open(target, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        self.assertEqual(data.get("rv"), 14, "El nivel de RV debe ser 14")
        self.assertEqual(len(data.get("plots", [])), 30, "Deben existir 30 parcelas")
        self.assertGreater(len(data.get("aniimo", [])), 0, "Debe tener cuadrilla de Aniimos")

    def test_profile_uid_json_exists_and_valid(self):
        target = self.data_dir / "profile_209000449083.json"
        self.assertTrue(target.exists(), "profile_209000449083.json debe existir")
        with open(target, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        self.assertEqual(data.get("uid"), "209000449083")
        self.assertEqual(data.get("rv"), 14)
        self.assertIn("1010000", data.get("facilities", {}))

    def test_profiles_directory_contains_cloud_registry(self):
        profiles_dir = self.data_dir / "profiles"
        self.assertTrue(profiles_dir.exists(), "El directorio profiles/ debe existir")
        my_profile = profiles_dir / "209000449083.json"
        self.assertTrue(my_profile.exists(), "El perfil 209000449083.json debe existir en profiles/")

if __name__ == "__main__":
    unittest.main()
