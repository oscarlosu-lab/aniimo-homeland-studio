#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import unittest
import json
from pathlib import Path

class TestAniidexSuite(unittest.TestCase):
    def setUp(self):
        self.repo_root = Path(__file__).resolve().parent.parent
        self.web_dir = self.repo_root / "web"

    def test_core_files_exist(self):
        self.assertTrue((self.web_dir / "index.html").exists(), "index.html must exist")
        self.assertTrue((self.web_dir / "style.css").exists(), "style.css must exist")
        self.assertTrue((self.web_dir / "app.js").exists(), "app.js must exist")
        self.assertTrue((self.web_dir / "data" / "planner_facts.json").exists(), "planner_facts.json must exist")
        self.assertTrue((self.web_dir / "core" / "aniidex-solver-worker.js").exists(), "aniidex-solver-worker.js must exist")
        self.assertTrue((self.web_dir / "core" / "highs.B_nfHoE0.wasm").exists(), "highs.B_nfHoE0.wasm must exist")

    def test_index_html_structure(self):
        html = (self.web_dir / "index.html").read_text(encoding="utf-8")
        self.assertIn("hp-yh-doors", html, "Must contain Aniidex dual doors")
        self.assertIn("hp-frame", html, "Must contain active home frame")
        self.assertIn("hp-kpis", html, "Must contain 4 KPI cards")
        self.assertIn("hp-sum", html, "Must contain financial balance summary")
        self.assertIn("sec-suggestions", html, "Must contain suggestions panel")
        self.assertIn("hp-workshops-grid", html, "Must contain facilities grid")

    def test_planner_facts_dataset(self):
        facts_path = self.web_dir / "data" / "planner_facts.json"
        with open(facts_path, "r", encoding="utf-8") as f:
            facts = json.load(f)
        
        self.assertGreaterEqual(len(facts.get("recipes", {})), 260, "Must contain official recipes")
        self.assertGreaterEqual(len(facts.get("facilities", {})), 27, "Must contain all facilities")
        self.assertGreaterEqual(len(facts.get("items", {})), 270, "Must contain all items")
        self.assertGreaterEqual(len(facts.get("forms", {})), 250, "Must contain creature forms")
        self.assertIn("i18n", facts, "Must contain translations")

    def test_verified_profiles(self):
        profiles_dir = self.web_dir / "data" / "profiles"
        self.assertTrue((profiles_dir / "209000449083.json").exists())
        self.assertTrue((profiles_dir / "207000832726.json").exists())
        self.assertTrue((profiles_dir / "209000249042.json").exists())
        self.assertTrue((profiles_dir / "310001059443.json").exists())

if __name__ == "__main__":
    unittest.main()
