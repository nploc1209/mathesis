# Mathesis — Dynamic Geometry Application

**Mathesis** is a minimalist, web-based dynamic geometry application inspired by GeoGebra. It combines Euclidean dynamic geometry with dynamic constraint solving, KaTeX formula rendering, local IndexedDB persistence, GeoGebra `.ggb` import, SVG/PNG/PDF export, and an AI Geometry Assistant with step preview confirmation.

---

## Features

### 1. Dynamic Geometry Engine
- **Points:** Free points, points on objects (gliders), intersection of lines/curves/circles, midpoints and centers.
- **Lines & Curves:** Line segments, infinite lines, rays, vectors.
- **Special Constructions:** Perpendicular lines, parallel lines, perpendicular bisectors, angle bisectors, tangent lines to circles.
- **Polygons:** Arbitrary polygons with vertex closure, regular $n$-gons (equilateral triangles, squares, pentagons, hexagons, etc.).
- **Circles:** Center through point, center with fixed/prompt radius, 3-point circles, semicircles, circumcircles.
- **Measurements:** Angles between points or lines, angles with given size, distance/length, polygon/circle area, slope triangles.
- **Transformations:** Reflection across a line or segment, point reflection (symmetry), rotation around a center point by degrees, translation, homothety/dilation.
- **Controls & Annotations:** Numerical parameter sliders, customizable KaTeX mathematical formulas, and text labels.
- **Dynamic Dependency Graph:** Powered by JSXGraph's computation engine—moving any parent element automatically updates all dependent lines, intersections, circles, and measurements.

### 2. User Interface
- **Minimalist White Canvas:** Distraction-free, responsive canvas with coordinate grid and axis controls, zoom in/out/reset floating buttons, active tool step instructions, and a quick-property inspector for selected elements (color swatches, stroke size, visibility, deletion).
- **Left-Side Grouped Toolbar:** Clean vertical toolbar organized by categories with flyout menus and tooltips.
- **Collapsible Object Panel (Algebra View):** Live list of objects categorized by Free Points, Dependent Points, Lines, Circles, Polygons, and Measurements. Supports KaTeX mathematical formulas, coordinate editing for free points, visibility toggles, and a quick algebraic coordinate input bar (`(3, 4)` or `A = (1, 2)`).
- **AI Geometry Assistant (Right Sidebar):**
  - **Natural Language Parsing:** Formulates geometric constructions from natural language commands (e.g., "draw equilateral triangle ABC", "construct triangle ABC with circumcircle", "find midpoint of AB", "orthocenter and altitudes of triangle ABC").
  - **Multimodal Image Input:** Accepts problem screenshots and textbook diagram images.
  - **Ambiguity Detection:** Detects ambiguous or underspecified requests and presents clickable clarifying options.
  - **Step-by-Step Preview Cards:** Shows the planned construction steps with KaTeX formulas before modifying the canvas.
  - **"Confirm & Construct":** Executes the construction only after user confirmation, preserving existing geometry and dependencies.
  - **Dual-Mode AI Construction:** Powered by NVIDIA's `openai/gpt-oss-20b` with dedicated **Speed** (rapid generation) and **Accuracy** (mathematically rigorous theorem reasoning) modes, backed by a built-in offline geometry fallback.
  - **Dynamic Logarithmic Progress:** Continuous, smooth progress feedback during AI generation.

### 3. Projects & Offline Storage
- **IndexedDB Storage:** Fast local storage via `idb` for saving, loading, duplicating, and deleting projects offline.
- **Autosave:** Continuous debounced autosave draft to prevent work loss.
- **Import:** GeoGebra `.ggb` zip archive reader (extracts and reconstructs points, lines, segments, rays, vectors, circles, midpoints, bisectors, perpendiculars, polygons, angles, and styles).
- **Export:** High-resolution PNG, vector SVG, and printable PDF documents.

---

## Tech Stack
- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS + Lucide Icons
- **Geometry Engine:** JSXGraph
- **Math Rendering:** KaTeX
- **Storage:** IndexedDB (`idb`)
- **Document & File Utilities:** `jspdf`, `jszip`

---

## Getting Started

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm run preview
```
