# Aniimo Homeland Studio 🏕️⚡

[![Probar Online](https://img.shields.io/badge/Demo%20Online-oscarlosu--lab.github.io-00f0ff?style=for-the-badge&logo=githubpages&logoColor=white)](https://oscarlosu-lab.github.io/aniimo-homeland-studio/)
[![Licencia MIT](https://img.shields.io/badge/Licencia-MIT-22c55e.svg?style=for-the-badge)](LICENSE)
[![Versión 1.0 Studio](https://img.shields.io/badge/Versi%C3%B3n-1.0%20Studio-a855f7.svg?style=for-the-badge)]()
[![Español 100%](https://img.shields.io/badge/Idioma-Espa%C3%B1ol%20%7C%20Biling%C3%BCe-f97316.svg?style=for-the-badge)]()
[![Datamine Oficial](https://img.shields.io/badge/Datamine-Aniimo%20v1.0%20(3857679)-3b82f6.svg?style=for-the-badge)]()
[![PWA Offline](https://img.shields.io/badge/PWA-100%25%20Offline-00f0ff.svg?style=for-the-badge)]()
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20Project-FF5E5B?style=flat-square&logo=ko-fi&logoColor=white)](https://ko-fi.com/oscarlosu)

> 🎃 **Actualización 31 oct. 2026 (Parche 3857679):** Soporte oficial para el evento de temporada **"Noche Maravillosa" (*Magical Wonder Night*)**. Incorpora nuevos cultivos (*Calabaza mágica*, *Fruta de linterna del recuerdo*), moneda del evento (*Cristales de azúcar maravillosos*), 5 recetas de artesanía/cocina temáticas y contratos de pedidos de Astra de temporada.
>
> **Suite Integral de Gestión, Optimización Matemática de Producción y Fabricación Rápida para Aniimo Homeland.**  
> *Herramienta web autónoma, responsive para móviles y PC, sin descargas, sin publicidad y ejecutada 100% en tu navegador mediante Rust y WebAssembly.*

---

## 🌟 ¿Qué es Aniimo Homeland Studio?

**Aniimo Homeland Studio** es la plataforma comunitaria definitiva para la gestión de tu campamento y Casa Rodante (RV) en *Aniimo*. Combina un motor de **Programación Lineal Entera Mixta (MIP)** compilado a WebAssembly con módulos especializados de optimización en tiempo real, asignación de operarios y resolución dirigida de árboles de fabricación (DAG).

Diseñada tanto para jugadores casuales como para maximizadores de recursos, la suite permite:
- **Resolver pedidos prioritarios de Astra y Eventos** asegurando siempre los materiales del siguiente nivel de RV.
- **Fabricar cualquier receta en tiempo récord** asignando dinámicamente todos los talleres y cultivos en paralelo.
- **Recomendar los mejores Aniimos para cada instalación**, aprovechando los multiplicadores de aptitud y el algoritmo MBTI (+20% velocidad).
- **Diseñar la base en 2D** respetando las restricciones de Unidades de Almacenamiento (UA) y módulos de campamento.
- **Auditar la nutrición y autonomía AFK** de tus criaturas para evitar que queden agotadas mientras no juegas.

---

## 🚀 Módulos Principales de la Suite

### 1. 📋 Gestor Avanzado de Pedidos y Contratos (Robot de Pedidos)
- **Optimización en Dos Fases:**
  - **Fase 1 (Nivel de RV):** Asegura los materiales obligatorios para mejorar la Casa Rodante antes de comprometer talleres.
  - **Fase 2 (Tablón de Clientes):** Asigna recursos restantes a los pedidos de clientes de Astra (Granoz Heladoz, Wolfie's, DiverTierra, Recuerdos, Club golpespiral, Tesella Pod, Shanel, Lumen y Temporada de Cosecha).
- **Umbral Inteligente de Nivel:** Si los pedidos seleccionados impiden la subida de nivel, el motor calcula el máximo avance posible y alerta con recomendaciones exactas.
- **Multiplicadores de Pedido:** Soporta pedidos Normales (x1.0), Urgentes (x2.0) y Súper Pedidos (x5.0).

### 2. ⚡ Fabricador Exprés (Recetas Rápidas en Paralelo)
- Nueva interfaz dedicada con catálogo interactivo de **159 recetas oficiales** (154 base + 5 del evento de temporada).
- **Motor DAG sin Excedentes:** 100% enfocado en craftear la receta solicitada (0 ventas intermedias).
- **Paralelización Máxima:** Descompone el árbol de dependencias completo, programando simultáneamente cultivos base y procesados en múltiples talleres.
- **Asignación de Operarios Sugeridos:** Calcula la mejor criatura para cada fase de la cadena.

### 3. 🐾 Asignador Inteligente de Aniimos & Compatibilidad MBTI
- **Algoritmo MBTI (+20% Velocidad):** Empareja las personalidades de tus Aniimos con el rasgo exigido por cada instalación:
  - *Activa / Aventurera / Curiosa / Alegre / Entusiasta / etc.*
- **Alternativas Salvajes:** Si no dispones del Aniimo óptimo, sugiere capturas salvajes accesibles para tu nivel.
- **Panel Desplegable Compacto:** Ahorra espacio visual en pantallas móviles y monitores de cualquier resolución.

### 4. 🍲 Auditor de Comedero y Autonomía AFK
- Calcula el consumo calórico exacto por hora según las criaturas asignadas y su nivel de actividad.
- Estima la autonomía en horas reales antes de que el comedero se vacíe.
- Sugiere dietas optimizadas (bayas, ensaladas, platos elaborados) para maximizar el tiempo AFK.

### 5. 🗺️ Diseñador de Campamento 2D y Control de UA
- Malla interactiva 2D para colocar instalaciones y módulos de campamento.
- Validación de alcance y radio de cobertura de las **Unidades de Almacenamiento (UA)**.
- Detección de atascos de ruta y optimización de distancias de desplazamiento de los Aniimos.

---

## 🛠️ Tecnologías y Arquitectura

```
homeland-studio/
├── web/
│   ├── index.html               # Centro de Control Principal
│   ├── recetas-rapidas.html     # Módulo de Fabricación Rápida
│   ├── style.css                # Sistema Obsidian Glassmorphism UI
│   ├── app.js                   # Orquestador del Frontend y Estado
│   ├── contracts-manager.js     # Motor del Tablón de Pedidos (2 Fases)
│   ├── quick-recipes.js         # Resolvedor DAG de Recetas Rápidas
│   ├── aniimo-recommender.js    # Motor de Asignación y MBTI
│   ├── extra-features.js        # Comedero AFK, Multi-UA y Módulos
│   ├── layout.js                # Lienzo interactivo 2D del campamento
│   ├── i18n.js                  # Motor de localización (ES, EN, RU, ZH-TW)
│   ├── worker.js                # Web Worker para cómputo no bloqueante
│   ├── data/                    # Datamine oficial (recetas, aniimos, niveles)
│   └── pkg/                     # Núcleo WebAssembly (HiGHS / Linear Programming)
├── src/                         # Código fuente en Rust del solver MIP
└── Cargo.toml                   # Configuración del paquete Rust
```

---

## 💻 Ejecución en Local

Para probar o desarrollar en tu propia máquina:

1. Clona el repositorio:
   ```bash
   git clone https://github.com/oscarlosu-lab/aniimo-homeland-studio.git
   cd aniimo-homeland-studio
   ```

2. Inicia un servidor web estático en la carpeta `web/`:
   ```bash
   # Con Python:
   python -m http.server 8080 -d web

   # O con Node.js:
   npx serve web
   ```

3. Abre tu navegador en `http://localhost:8080`.

---

## 🛡️ Privacidad y Seguridad Zero-Cloud

- **100% Cliente:** Todos los cálculos se ejecutan localmente en tu CPU mediante WebAssembly.
- **Sin Telemetría:** No se recopilan datos privados, estadísticas ni historiales.
- **Persistencia Local Segura:** Tus ajustes de campamento se guardan exclusivamente en el `localStorage` de tu navegador, con opción de reinicio instantáneo en 1 clic.

---

## ☕ Apoyo y Financiación del Proyecto

Si **Aniimo Homeland Studio** te resulta útil para gestionar tu base y tus recetas, puedes apoyar el desarrollo y mantenimiento del proyecto:

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20Project-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/oscarlosu)

---

## 📄 Licencia

Distribuido bajo la **Licencia MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.
