# Aniimo Homeland Studio 🏕️⚡

**[🇬🇧 English](README.md) · [🇪🇸 Español](README_ES.md)**

[![License](https://img.shields.io/badge/License-Non--Commercial%20(oscarlosu--lab)%20%2B%20Upstream%20MIT-f59e0b?style=flat-square)](LICENSE)
[![GitHub Pages](https://img.shields.io/github/deployments/oscarlosu-lab/aniimo-homeland-studio/github-pages?label=GitHub%20Pages&style=flat-square&logo=github)](https://oscarlosu-lab.github.io/aniimo-homeland-studio/)
[![Last Commit](https://img.shields.io/github/last-commit/oscarlosu-lab/aniimo-homeland-studio?style=flat-square&color=10b981)](https://github.com/oscarlosu-lab/aniimo-homeland-studio/commits/main)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20Project-FF5E5B?style=flat-square&logo=ko-fi&logoColor=white)](https://ko-fi.com/oscarlosu)

> 🚀 **[LAUNCH LIVE APP](https://oscarlosu-lab.github.io/aniimo-homeland-studio/)**  
> **All-in-One Camp Management, Mathematical Production Optimizer & Express Crafting Suite for *Aniimo Homeland*.**  
> *100% client-side, mobile- and desktop-responsive web app powered by Rust & WebAssembly (HiGHS).*

---

## 🌟 Core Modules

1. **📋 Orders & Contracts Manager (2-Phase Solver)** — Prioritizes RV level-up materials first, then allocates remaining capacity to Astra client orders (`x1`, `x2`, `x5`).
2. **⚡ Express Crafter (Parallel DAG Solver)** — Interactive catalog of **159 official recipes** with zero-surplus parallel workshop and crop scheduling.
3. **🐾 Smart Aniimo Assigner & MBTI (+20% Speed)** — Matches Aniimo personalities to station bonuses and suggests wild alternatives when evolved species aren't unlocked.
4. **🍲 Feeder & AFK Autonomy Auditor** — Calculates hourly caloric consumption and estimates real-world feeder runtime.
5. **🗺️ 2D Camp Designer & Storage Unit (SU) Coverage** — Interactive 2D grid with storage radius validation and path-bottleneck detection.

---

## 💻 Running Locally

```bash
git clone https://github.com/oscarlosu-lab/aniimo-homeland-studio.git
cd aniimo-homeland-studio
python -m http.server 8080 -d web
```

Open `http://localhost:8080` in your browser.

---

## 🛡️ Privacy & Zero-Cloud

- **100% Client-Side:** All MIP/DAG calculations run locally in WebAssembly.
- **Zero Telemetry:** No tracking, accounts, or external data collection; preferences stay in browser `localStorage`.

---

## ☕ Support & License

If **Aniimo Homeland Studio** helps you optimize your camp, consider [supporting on Ko-fi](https://ko-fi.com/oscarlosu).

`oscarlosu-lab` contributions & adaptations are under **Non-Commercial Source-Available + Mandatory Attribution**; upstream components remain under **MIT**. See [LICENSE](LICENSE).
