# Modular Habitat Customization System — Design Document

## 1. Purpose & Design Vision
The **Modular Habitat Customization System** enables players to design, expand, and personalize living 3D isometric animal sanctuaries with high creative freedom and clear ecological feedback. Every placement choice—from species-tailored enclosures to flora canopies and terrain textures—affects both visual storytelling and sanctuary mechanics (Animal Happiness, Habitat Harmony, and Prestige Score).

---

## 2. Core System Requirements

### 2.1 Grid-Based Placement Tool
A tactile, error-proof spatial building tool supporting both desktop mouse/keyboard and mobile touch input.

| Requirement | Specification |
| :--- | :--- |
| **Coordinate Space** | Unified discrete sanctuary grid (`12×12` starter meadow, expandable to `24×24`), where each tile maps to `2.0 × 2.0` world units with grounded bottom-center pivots (`y = 0`). |
| **Multi-Footprint Snapping** | Supports `1×1` tiles (crops, paths, flora, props), `2×2` tiles (standard animal enclosures), and `2×3` or `3×3` tiles (grand sanctuaries & multi-animal pavilions). |
| **Real-Time Validation Ghost** | Raycasts pointer/touch onto the ground plane (`y = 0`) and renders a color-coded footprint indicator (**emerald** = valid open plot, **coral** = collision or out-of-bounds). |
| **Rotation & Orientation** | Supports 90° cardinal rotation (`0°`, `90°`, `180°`, `270°`) via `R` key or HUD rotate button, persisted per placed object (`rotation: 0..3`). |
| **Edit Modes** | Supports **Place**, **Move/Relocate**, **Rotate**, and **Store to Inventory** (returning items without permanent loss). |
| **Path & Fence Auto-Tiling** | Adjacent path tiles (`cobble_path`, `timber_deck`) and modular fence segments automatically resolve corner/straight/T-junction variants using 4-neighbor bitmasks. |
| **Collision & Occupancy Registry** | Deterministic O(1) occupancy set (`"gx,gz"`) preventing overlap between enclosures, crops, water features, and decorations across client preview and server validation. |

---

### 2.2 Animal-Specific Enclosure Categories & Modular Structures
Each exotic species requires a tailored biome enclosure composed of a **Base Habitat Shell**, **Primary Functional Structures**, and **Optional Enrichment Modules** that boost species-specific comfort and unlock unique 3D animations.

#### A. Raccoon — *Timber Hollow & Creek* (`raccoon`)
* **Base Shell**: Split-rail cedar fence, mossy creekbed pad, wooden washbasin.
* **Signature Modular Structures**:
  * **Tree-Climbing Cedar Tower**: Multi-tier knotted trunk, rope bridge, and hollow den perch for vertical foraging animations.
  * **Mossy Wash Creek**: Running water trough where raccoons rinse wild berries and acorns.
  * **Forager Berry Hedge**: Dense forest shrub cluster yielding bonus happiness when placed adjacent.
* **Preferred Adjacency Flora**: Autumn Maple, Weeping Willow, Wild Berry Bush.

#### B. Gorilla — *Emerald Jungle Canopy* (`gorilla`)
* **Base Shell**: Woven bamboo perimeter, terraced rainforest loam, shaded stone ledge.
* **Signature Modular Structures**:
  * **Tiered Waterfall Rock Ledge**: Sculpted mossy cliffs with cascading water ribbon.
  * **Canopy Banana & Vine Pergola**: High timber-and-vine climbing frame supporting gentle brachiation and shaded lounging.
  * **Bamboo Grove Rest Platform**: Elevated woven nesting deck.
* **Preferred Adjacency Flora**: Emerald Bamboo, Golden Mango Tree, Koi Pond.

#### C. Butterfly — *Sunlit Nectar Conservatory* (`butterfly`)
* **Base Shell**: Octagonal sandstone patio, antique brass-and-glass domed gazebo, sunlit open air vents.
* **Signature Modular Structures**:
  * **Brass Nectar Pedestal Fountain**: Central misting feeder attracting figure-8 swarm flight patterns.
  * **Tiered Pollinator Trellis**: Vertical blooming lavender & hibiscus beds.
  * **Prismatic Dew Spire**: Exotic upgrade adding sunbeam shimmer and rare Wing Shimmer drop rate bonus.
* **Preferred Adjacency Flora**: Lavender Nectar Bed, Blossom Arbor Arch, Carved Stone Fountain.

#### D. Wolf — *Alpine Pine Ridge* (`wolf`)
* **Base Shell**: Stacked timber-and-slate perimeter, clover-and-shale mountain pad.
* **Signature Modular Structures**:
  * **Layered Slate Outcrop Den**: Sheltered stone ridge overhang for howling/perching idle cycles.
  * **Alpine Evergreen Shelter**: Clustered snow-dusted pines providing cool shade.
  * **Copper Ridge Campfire Lantern**: Warm emissive focal beacon boosting evening/seasonal harmony.
* **Preferred Adjacency Flora**: Alpine Herb Patch, Harvest Paper Lantern, Alpine Pine.

---

### 2.3 Environmental Aesthetics Management (Flora, Terrain Textures & Atmosphere)
To make every player's sanctuary feel visually distinct during friend visits and social postcard sharing, environmental aesthetics are managed as three composable layers:

#### 1. Terrain Texture & Biome Swatches
* **Global & Zone Turf System**: Players can switch base sanctuary terrain themes (*Sunlit Meadow*, *Harvest Loam*, *Alpine Moss*, *Riverbank Clover*) or paint sub-grid terrain brushes (*Cobblestone*, *Mulch Trail*, *Clover Lawn*, *River Sand*).
* **Procedural PBR Pipeline**: Terrain maps generate procedurally (`SRGBColorSpace`, anisotropic filtering, roughness calibration `0.85–0.95`) and hot-swap material uniforms/tints cleanly without reloading the 3D scene.
* **Perimeter & Horizon Blending**: Outer rolling hills, meandering brook, and horizon fog tint subtly harmonize with the active terrain aesthetic so the playable grid never looks like an isolated box.

#### 2. Flora & Natural Prop Layers
Categorized for rapid browsing and ecological synergy:
* **Canopy Trees**: Weeping Willow, Autumn Maple, Emerald Bamboo, Alpine Pine.
* **Water Features**: Tranquil Koi Pond, Carved Stone Fountain, Stepping Brook Stones.
* **Cozy Architecture & Seasonal Decor**: Keeper Tea Gazebo, Blossom Arbor Arch, Harvest Paper Lanterns, Meadow Hay Cart.
* **Instanced Ambient Foliage**: Outer forest groves and meadow wildflowers use `THREE.InstancedMesh` with per-instance scale variation (`±15%`) and `setColorAt` tint variation to sustain 60fps across mobile and desktop GPUs.

#### 3. Habitat Harmony & Prestige Synergy Engine
* **Proximity Radius (`2` tiles)**: Decorations and flora placed within a 2-tile Chebyshev radius of an animal enclosure contribute a **Harmony Multiplier** (`+5%` to `+25%` happiness recovery & Prestige bonus).
* **Species Preference Matching**: Matching flora (e.g., Bamboo near Gorilla, Autumn Maple near Raccoon) grants double synergy points and triggers subtle celebratory particle feedback on placement.

---

## 3. Data Model & Cross-Platform Persistence

```ts
interface HabitatCustomizationPayload {
  terrainTheme: 'meadow' | 'autumn' | 'alpine' | 'clover';
  enclosures: Array<{
    id: string;
    species: 'raccoon' | 'gorilla' | 'butterfly' | 'wolf';
    variant: 'classic' | 'exotic';
    modules: string[]; // e.g., ['tree_climbing_tower', 'creek_basin']
    gridX: number;
    gridZ: number;
    rotation: 0 | 1 | 2 | 3;
  }>;
  decorations: Array<{
    id: string;
    decorType: string;
    gridX: number;
    gridZ: number;
    rotation: 0 | 1 | 2 | 3;
  }>;
}
```

* **Synchronization**: Layout edits save optimistically to local storage and debounce-sync to the cloud sanctuary endpoint (`/api/sync/:code`), keeping payloads compact (< 30 KB) for instant loading when friends visit in 3D or players switch between mobile and PC.

---

## 4. UX & Performance Acceptance Criteria
1. **Viewport Clarity**: The placement palette opens as a compact modal/drawer and collapses automatically upon selecting an item, keeping **≥ 85%** of the 3D playfield unobstructed during placement.
2. **Touch & Mouse Ergonomics**: Dragging pans/orbits the camera (`> 8px` threshold), while crisp taps (`≤ 8px`) place or select objects; every button meets `≥ 44px` touch targets on mobile.
3. **Frame Budget**: Zero per-frame heap allocations inside the animation loop; `InstancedMesh` for repeated foliage; graceful software-WebGL pacing fallback.
