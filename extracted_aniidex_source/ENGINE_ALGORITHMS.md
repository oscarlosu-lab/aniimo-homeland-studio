# Arquitectura Matemática y Algoritmos del Optimizador Aniidex

Este documento desglosa el funcionamiento matemático, la formulación de optimización lineal entera mixta (MIP) y los algoritmos espaciales extraídos de **Aniidex Homeland Planner** (`https://aniidex.com/es/homeland/#plan`), implementados en `solver.worker-X73yR3lE.js` y resueltos mediante **HiGHS 1.7.0 WASM**.

---

## 1. Modelo Matemático de Optimización (MIP Simplex)

El planificador modela la producción económica del hogar como un problema de programación lineal entera mixta formulado en formato de texto LP y resuelto por el motor matemático HiGHS.

### 1.1 Función Objetivo ($Z$)

La meta es maximizar el beneficio neto diario en **Monedas del Hogar** ($M$), descontando los costes de semillas y comida para Aniimos:

$$\max Z = \sum_{i \in \text{Ventas}} P_i \cdot X_i - \sum_{s \in \text{Semillas}} C_s \cdot S_s - \sum_{a \in \text{Aniimo}} K_a$$

Donde:
- $X_i$: Unidades vendidas del producto $i$ al día en la Tienda Cooperativa.
- $P_i$: Precio oficial unitario de venta de $i$.
- $S_s$: Cantidad de semillas del cultivo $s$ adquiridas al día.
- $C_s$: Precio oficial de compra de la semilla $s$.
- $K_a$: Coste de manutención/comida del Aniimo activo $a$.

---

### 1.2 Restricciones del Sistema

#### Conservación de Masa e Inventario (Balance de Materiales)
Para cada recurso o materia prima $j$:
$$\text{Producción}(j) - \text{Consumo}(j) - \text{Ventas}(j) \ge 0$$

#### Capacidad de Parcelas de Cultivo
El total de cultivos plantados no puede exceder el número de parcelas desbloqueadas según el nivel de Casa Rodante ($RV$):
$$\sum_{c \in \text{Cultivos}} \text{ParcelasOcupadas}(c) \le \text{MaxParcelas}(RV)$$

#### Capacidad de Talleres e Instalaciones
Cada máquina procesadora tiene un límite de ranuras de producción y velocidad de ciclo ajustada por el rasgo MBTI del Aniimo asignado:
$$\text{TiempoTotalProcesamiento} \le 86.400 \text{ s/día} \cdot (1 + \text{BonusMBTI})$$

---

## 2. Asignación de Personalidad MBTI

La función `st` en `solver.worker-X73yR3lE.js` evalúa la compatibilidad entre el rasgo MBTI de cada Aniimo y la tarea a realizar:
- **Especialistas en Taller (T)**: +20% a la velocidad de fabricación de productos de carpintería, telar o alquimia.
- **Especialistas en Cosecha (F/S)**: +20% a la velocidad de recolección en parcelas agrícolas y minas.
- **Sinergia Doble**: Si el tipo de tarea coincide con la letra primaria del MBTI, el multiplicador de velocidad se aplica a la tasa base:
$$v_{\text{efectiva}} = v_{\text{base}} \times 1.20$$

---

## 3. Disposición Espacial y Empaquetado 2D

El motor de colocación (`nt`, `it`, `Ve`, `Ke`, `qe`, `$e`, `Qe`) empaqueta las instalaciones en la cuadrícula 2D considerando:
1. **Dimensiones de la instalación**: Por ejemplo, campos de cultivo $1 \times 1$, talleres $2 \times 2$, almacenes $1 \times 2$.
2. **Distancia de acarreo**: Minimización de la distancia euclídea entre las instalaciones de producción primaria y los almacenes de depósito para evitar pérdidas de tiempo de transporte.

---

## 4. Archivos Extraídos

| Archivo | Tamaño | Propósito |
|---|---|---|
| `solver.worker-X73yR3lE.js` | 219 KB | Motor generador de LP, empaquetado 2D, interfaz HiGHS y asignación MBTI |
| `highs.B_nfHoE0.wasm` | 3.53 MB | Binario de optimización MIP C++ compilado con Emscripten |
| `CH130G_M.js` | 77 KB | Gestor de estado Nuxt/Vue, importación Turnstile y orquestación worker |
| `CrA_sQfZ.js` | 60 KB | Componentes UI (`hp-card`, `hp-tile`, `hp-zone`, `hp-board`, `hp-workers`) |
| `D5jHZERP.js` | 408 KB | Runtime principal y diccionarios i18n (`es` / `en`) |
| `planner_facts.json` | 615 KB | Dataset oficial con 263 recetas, parcelas, niveles de RV, costes y objetos |
| `homeland-planner.D84wJH7y.css` | 65 KB | Estilos CSS compilados de los componentes del planificador |
| `entry.CaBHz8pG.css` | 89 KB | Estilos base de la aplicación y sistema de diseño Aniidex |
