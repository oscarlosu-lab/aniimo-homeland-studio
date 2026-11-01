#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import unittest
import json
import subprocess
from pathlib import Path

class TestSolverEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo_root = Path(__file__).resolve().parent.parent
        cls.facts_file = cls.repo_root / "web" / "data" / "planner_facts.json"

    def test_facts_file_has_season_and_recipes(self):
        self.assertTrue(self.facts_file.exists())
        with open(self.facts_file, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        self.assertTrue(bool(data.get("season")), "La temporada debe existir")
        self.assertGreaterEqual(len(data.get("recipes", {})), 260, "Debe tener más de 260 recetas")
        self.assertGreaterEqual(len(data.get("facilities", {})), 27, "Debe tener instalaciones válidas")

    def test_node_highs_wasm_solving(self):
        highs_path = (self.repo_root / "web" / "vendor" / "highs" / "highs.js").as_posix()
        highs_dir = (self.repo_root / "web" / "vendor" / "highs").as_posix() + "/"
        js_code = f"""
        const highsModule = await import('file:///{highs_path}');
        const highs = await highsModule.default({{
            locateFile: (file) => '{highs_dir}' + file
        }});
        const sol = highs.solve("Maximize\\n obj: + 100 x\\nSubject To\\n c1: 1 x <= 50\\nBounds\\n 0 <= x\\nEnd\\n");
        if (sol.Status !== 'Optimal' || sol.ObjectiveValue !== 5000) {{
            process.exit(1);
        }}
        console.log("PASS_HIGHS_SOLVE");
        """
        r = subprocess.run(["node", "--input-type=module", "-e", js_code], capture_output=True, text=True, timeout=15)
        self.assertEqual(r.returncode, 0, f"Error: {r.stderr}")
        self.assertIn("PASS_HIGHS_SOLVE", r.stdout)

if __name__ == "__main__":
    unittest.main()
