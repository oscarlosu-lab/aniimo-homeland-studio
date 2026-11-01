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
        self.assertTrue(data.get("season", {}).get("on"), "La temporada debe estar activa")
        self.assertGreater(len(data.get("recipes", {})), 260, "Debe tener más de 260 recetas")
        self.assertGreater(len(data.get("facilities", {})), 25, "Debe tener instalaciones válidas")

    def test_node_highs_wasm_solving(self):
        js_code = """
        import fs from 'fs';
        const raw = fs.readFileSync('D:/REPOS_GITHUB/ANIIMO/homeland-studio/web/data/planner_facts.json', 'utf8');
        const facts = JSON.parse(raw);
        const highsModule = await import('file:///D:/REPOS_GITHUB/ANIIMO/homeland-studio/web/vendor/highs/highs.js');
        const highs = await highsModule.default({
            locateFile: (file) => 'D:/REPOS_GITHUB/ANIIMO/homeland-studio/web/vendor/highs/' + file
        });
        const sol = highs.solve("Maximize\\n obj: + 100 x\\nSubject To\\n c1: 1 x <= 50\\nBounds\\n 0 <= x\\nEnd\\n");
        if (sol.Status !== 'Optimal' || sol.ObjectiveValue !== 5000) {
            process.exit(1);
        }
        console.log("PASS_HIGHS_SOLVE");
        """
        r = subprocess.run(["node", "--input-type=module", "-e", js_code], capture_output=True, text=True, timeout=15)
        self.assertEqual(r.returncode, 0, f"Error: {r.stderr}")
        self.assertIn("PASS_HIGHS_SOLVE", r.stdout)

if __name__ == "__main__":
    unittest.main()
