# Effekseer for Web — Integration Guide

This document describes the technical structure of each sample and the integration patterns used to combine Effekseer with various rendering frameworks.

---

## Table of Contents

1. [Sample Structure](#1-sample-structure)
2. [Effect Resources](#2-effect-resources)
3. [Integration Patterns Overview](#3-integration-patterns-overview)
4. [Per-Framework Details](#4-per-framework-details)
   - [WebGL](#41-webgl)
   - [WebGPU](#42-webgpu)
   - [three.js (WebGL)](#43-threejs-webgl)
   - [three.js (WebGPU)](#44-threejs-webgpu)
   - [Babylon.js (WebGL)](#45-babylonjs-webgl)
   - [Babylon.js (WebGPU)](#46-babylonjs-webgpu)
   - [PlayCanvas (WebGL)](#47-playcanvas-webgl)
   - [PlayCanvas (WebGPU)](#48-playcanvas-webgpu)
   - [Filament (WebGL)](#49-filament-webgl-)
   - [Rhodonite (WebGL)](#410-rhodonite-webgl)
   - [Rhodonite (WebGPU)](#411-rhodonite-webgpu)
5. [Key Technical Considerations](#5-key-technical-considerations)

---

## 1. Sample Structure

Every sample follows the same three-file layout:

```
examples/<framework>/<effect>/
├── index.html   # Script tags (framework + Effekseer), canvas element(s), status div
├── index.js     # Scene setup, Effekseer initialization, GUI, render loop
└── style.css    # Full-screen canvas layout
```

`index.js` is always a **native ES module** (`<script type="module">`).  
The GUI uses [lil-gui](https://lil-gui.georgealways.com/) imported directly from a CDN.

### Scene contents (common to all samples)

| Element | Description |
|---------|-------------|
| Grid | 30-division, 15-unit floor grid on the XZ plane |
| Cube | 2×2×2 rotating blue cube centred at (0, 1, 0) |
| Camera | Orbit camera — mouse drag rotates, scroll wheel zooms |
| GUI | Position / Rotation sliders + "▶ Play Effect" button |

---

## 2. Effect Resources

All effect files are under `examples/effekseer/Resources/`.

| Effect | `.efk` (WebGL legacy) | `.efkefc` (WebGPU compiled) |
|--------|-----------------------|-----------------------------|
| Laser01 | `Laser01.efk` | `00_Basic/Laser01.efkefc` |
| Laser02 | `Laser02.efk` | `00_Basic/Laser02.efkefc` |
| Simple_Ring_Shape1 | `Simple_Ring_Shape1.efk` | `00_Basic/Simple_Ring_Shape1.efkefc` |
| block | `block.efk` | — (no compiled version; all backends use `block.efk`) |

### Format differences

| Format | Extension | Notes |
|--------|-----------|-------|
| `.efk` | Legacy binary | Supported by WebGL backend |
| `.efkefc` | Compiled binary | Supported by WebGPU backend; smaller, faster load |

---

## 3. Integration Patterns Overview

Two distinct integration patterns appear across all frameworks, determined by whether the backend is WebGL or WebGPU.

### Pattern A — WebGL (shared context)

```
┌─────────────────────────────┐
│  Single <canvas>            │
│                             │
│  Framework renders scene    │
│        ↓                    │
│  Effekseer draws effects    │
│  (same GL context)          │
└─────────────────────────────┘
```

- **Canvas**: one `<canvas>` element shared by the framework and Effekseer
- **Context**: `canvas.getContext("webgl2")` — Effekseer receives the same GL object the framework uses
- **Effekseer init**: `effekseer.initRuntime(wasmPath, successCb, errorCb)` (callback-based)
- **Draw call**: `context.update(1)` → `context.draw()`
- **State protection**: `context.setRestorationOfStatesFlag(true)` saves and restores all GL state around `draw()`

### Pattern B — WebGPU (overlay canvas)

```
┌─────────────────────────────┐
│  <canvas id="canvas-xxx">   │  ← Framework renders scene (opaque)
├─────────────────────────────┤
│  <canvas id="canvas">       │  ← Effekseer overlay (transparent)
│  pointer-events: none       │     premultipliedAlpha: true
└─────────────────────────────┘
```

- **Canvas**: two `<canvas>` elements stacked with `position: absolute`; the Effekseer canvas sits on top with `pointer-events: none`
- **Context**: each canvas has its own WebGPU context; no sharing
- **Effekseer init**: `await initRuntime({backend:"webgpu", ...})` → `await createContext({..., enablePremultipliedAlpha:true})`
- **Draw call**: `context.update(1)` → `context.drawToCanvas()`
- **Resize**: Effekseer canvas must be resized explicitly; `context.configureSurface({width, height})` notifies Effekseer

### Camera synchronization

Both patterns require passing the host renderer's camera state to Effekseer each frame.

**Option 1 — perspective + lookAt (most frameworks)**
```javascript
context.setProjectionPerspective(fovDeg, aspect, near, far);
context.setCameraLookAt(ex, ey, ez, cx, cy, cz, 0, 1, 0);
```

**Option 2 — raw matrices (three.js only)**
```javascript
context.setProjectionMatrix(Array.from(camera.projectionMatrix.elements));
context.setCameraMatrix(Array.from(camera.matrixWorldInverse.elements));
```

---

## 4. Per-Framework Details

### 4.1 WebGL

| Item | Detail |
|------|--------|
| Pattern | A (shared context) |
| Context acquisition | `canvas.getContext("webgl2")` |
| Effekseer init | Callback: `effekseer.initRuntime(wasmPath, cb, errCb)` |
| Effect format | `.efk` |
| Camera | Manual spherical coordinates; `setProjectionPerspective` + `setCameraLookAt` |
| Render hook | `requestAnimationFrame` loop; `draw()` after scene render |
| FBO handling | None required (renders to default framebuffer throughout) |

```javascript
effekseer.initRuntime("../../effekseer/effekseer-webgl.wasm", () => {
  const context = effekseer.createContext();
  context.init(gl);
  context.setRestorationOfStatesFlag(true);
  // load effect, start loop...
});
```

---

### 4.2 WebGPU

| Item | Detail |
|------|--------|
| Pattern | B (overlay canvas) |
| Context acquisition | `navigator.gpu` → `adapter.requestDevice()` |
| Effekseer init | Async: `await initRuntime({backend:"webgpu", device, ...})` |
| Effect format | `.efkefc` (except `block.efk`) |
| Camera | Manual spherical coordinates; `setProjectionPerspective` + `setCameraLookAt` |
| Render hook | `requestAnimationFrame` loop; `drawToCanvas()` after scene render |
| Error checking | `getLastWebGPUError()` after each draw |
| Scene geometry | Built with raw WebGPU buffers and WGSL shaders (no framework) |

```javascript
await initRuntime({ backend: "webgpu", device,
  scriptPath: "../../effekseer/effekseer-webgpu.js",
  wasmPath:   "../../effekseer/effekseer-webgpu.wasm" });
const context = await createContext({
  backend: "webgpu", canvas: effekseerCanvas, canvasContext,
  device, width, height });
```

---

### 4.3 three.js (WebGL)

| Item | Detail |
|------|--------|
| Pattern | A (shared context) |
| Context acquisition | `renderer.getContext()` from `THREE.WebGLRenderer` |
| Effekseer init | Callback |
| Effect format | `.efk` |
| Camera | `THREE.PerspectiveCamera`; **raw matrices** passed to Effekseer |
| Render hook | `requestAnimationFrame` loop |
| Camera API | `setProjectionMatrix()` + `setCameraMatrix()` instead of perspective/lookAt |

```javascript
// three.js passes pre-computed matrices directly
context.setProjectionMatrix(Array.from(camera.projectionMatrix.elements));
context.setCameraMatrix(Array.from(camera.matrixWorldInverse.elements));
```

> **Note:** This is the only framework that uses the matrix-based camera API.

---

### 4.4 three.js (WebGPU)

| Item | Detail |
|------|--------|
| Pattern | B (overlay canvas) |
| Context acquisition | `new THREE.WebGPURenderer({canvas})` + `await renderer.init()` |
| Effekseer init | Async |
| Effect format | `.efkefc` (except `block.efk`) |
| Camera | `THREE.PerspectiveCamera`; switches back to `setProjectionPerspective` + `setCameraLookAt` (not matrix-based) |
| Render hook | `requestAnimationFrame` loop |
| Orbit controls | `THREE.OrbitControls`; target extracted from `controls.target` |

---

### 4.5 Babylon.js (WebGL)

| Item | Detail |
|------|--------|
| Pattern | A (shared context) |
| Context acquisition | `engine._gl` (internal property of `BABYLON.Engine`) |
| Effekseer init | Callback |
| Effect format | `.efk` |
| Camera | `BABYLON.ArcRotateCamera`; FOV/target extracted in hook |
| Render hook | `scene.registerAfterRender(cb)` |
| Coordinate system | Babylon.js is **left-handed** → Z must be negated when passed to Effekseer |

```javascript
// Z negation required for left-handed → right-handed conversion
context.setCameraLookAt(
  pos.x, pos.y, -pos.z,
  target.x, target.y, -target.z,
  0, 1, 0
);
```

---

### 4.6 Babylon.js (WebGPU)

| Item | Detail |
|------|--------|
| Pattern | B (overlay canvas) |
| Context acquisition | `new BABYLON.WebGPUEngine(canvas)` + `await engine.initAsync()` |
| Effekseer init | Async; **no** explicit `device` reference needed (Babylon manages GPU internally) |
| Effect format | `.efkefc` (except `block.efk`) |
| Camera | `BABYLON.ArcRotateCamera`; Z negation still required |
| Render hook | `scene.onAfterRenderObservable.add(cb)` |
| Extra option | `enablePremultipliedAlpha: true` in `createContext` |

---

### 4.7 PlayCanvas (WebGL)

| Item | Detail |
|------|--------|
| Pattern | A (shared context) |
| Context acquisition | `app.graphicsDevice.gl` |
| Effekseer init | Callback |
| Effect format | `.efk` |
| Camera | `pc.Entity` with camera component; `cam.fov`, `cam.nearClip`, `cam.farClip` |
| Render hook | `app.on("postrender", cb)` |
| FBO handling | **Required** — PlayCanvas renders to internal FBO; must save/restore |

```javascript
// Critical: PlayCanvas leaves its internal FBO bound after rendering
app.on("postrender", () => {
  const savedFBO = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);   // switch to canvas default FBO
  gl.viewport(0, 0, canvas.width, canvas.height);

  context.update(1);
  context.setProjectionPerspective(cam.fov, canvas.width / canvas.height,
                                   cam.nearClip, cam.farClip);
  context.setCameraLookAt(x, y, z, 0, 0, 0, 0, 1, 0);
  context.draw();

  gl.bindFramebuffer(gl.FRAMEBUFFER, savedFBO);  // restore PlayCanvas FBO
});
```

---

### 4.8 PlayCanvas (WebGPU)

| Item | Detail |
|------|--------|
| Pattern | B (overlay canvas) |
| Context acquisition | `pc.createGraphicsDevice(canvas, {deviceTypes:[pc.DEVICETYPE_WEBGPU]})` |
| Effekseer init | Async |
| Effect format | `.efkefc` (except `block.efk`) |
| Camera | `pc.Entity` with camera component |
| Render hook | `app.on("postrender", cb)` |
| FBO handling | Not needed (separate canvases) |

---

### 4.9 Filament (WebGL) 🚧

| Item | Detail |
|------|--------|
| Pattern | A (shared context) |
| Context acquisition | `canvas.getContext('webgl2')` after `Filament.Engine.create(canvas)` |
| Effekseer init | Promise-wrapped callback |
| Effect format | `.efk` |
| Scene geometry | In-code GLB (cube + grid) built with gltfio; `KHR_materials_unlit` materials |
| Camera | Manual spherical coordinates; `camera.setProjectionFov()` + `camera.lookAt()` |
| Render hook | `requestAnimationFrame` loop; after `renderer.render(swapChain, view)` |
| FBO handling | **Required** — same pattern as PlayCanvas; save/restore is critical |
| Known issue | Flickering during effect playback (FBO/state interaction under investigation) |

```javascript
renderer.render(swapChain, view);

// Filament leaves its internal FBO bound; save and restore to keep
// Filament's FBO tracker in sync with the actual GL state.
const savedFBO = gl.getParameter(gl.FRAMEBUFFER_BINDING);
gl.bindFramebuffer(gl.FRAMEBUFFER, null);
gl.viewport(0, 0, canvas.width, canvas.height);

efkContext.update(1);
efkContext.setProjectionPerspective(45, aspect, 1, 1000);
efkContext.setCameraLookAt(eye[0], eye[1], eye[2],
                           target[0], target[1], target[2], 0, 1, 0);
efkContext.draw();

gl.bindFramebuffer(gl.FRAMEBUFFER, savedFBO);
```

> **Why gltfio?** Filament has no built-in primitive builder. The scene is assembled
> as a GLB binary at runtime and loaded through Filament's `createAssetLoader()` API.

---

### 4.10 Rhodonite (WebGL)

| Item | Detail |
|------|--------|
| Pattern | A (shared context) |
| Context acquisition | `canvas.getContext('webgl2')` after `Rn.Engine.init(...)` |
| Effekseer init | Promise-wrapped callback |
| Effect format | `.efk` |
| Camera | Fixed eye at `[20, 20, 20]`; set once at init, not per-frame |
| Render hook | `requestAnimationFrame` loop; `engine.process([expression])` then `draw()` |
| Canvas ID | `world` (not `canvas`) for the Rhodonite canvas |

---

### 4.11 Rhodonite (WebGPU)

| Item | Detail |
|------|--------|
| Pattern | B (overlay canvas) |
| Context acquisition | `Rn.Engine.init({approach: Rn.ProcessApproach.WebGPU, canvas})` |
| Effekseer init | Async; no explicit device reference |
| Effect format | `.efkefc` (except `block.efk`) |
| Camera | Fixed eye at `[20, 20, 20]`; updated on resize |
| Render hook | `requestAnimationFrame` loop; `engine.process()` then `drawToCanvas()` |

---

## 5. Key Technical Considerations

### 5.1 Coordinate system differences

| Framework | Handedness | Action required |
|-----------|-----------|-----------------|
| WebGL (raw) | Right-handed | None |
| WebGPU (raw) | Right-handed | None |
| Babylon.js | **Left-handed** | Negate Z of eye position and look-at target |
| three.js | Right-handed | None |
| Rhodonite | Right-handed | None |
| PlayCanvas | Right-handed | None |
| Filament | Right-handed | None |

### 5.2 FBO management (WebGL pattern A only)

Frameworks that render to an **internal FBO** (PlayCanvas, Filament) require explicit
framebuffer save/restore before and after Effekseer's draw call:

```
renderer.render()          ← framework draws to internal FBO
  ↓
savedFBO = getParameter(FRAMEBUFFER_BINDING)
bindFramebuffer(null)      ← switch to canvas default FBO
  ↓
efkContext.draw()          ← Effekseer draws effects on top of the scene
  ↓
bindFramebuffer(savedFBO)  ← restore so the framework's tracker stays consistent
```

Skipping the restore causes the framework's internal FBO state tracker to desync
from the actual GL state, resulting in per-frame flickering on the next render call.

Frameworks that render directly to the default framebuffer (raw WebGL, Babylon.js WebGL,
three.js WebGL, Rhodonite WebGL) do not need this.

### 5.3 `setRestorationOfStatesFlag(true)`

All WebGL (pattern A) samples call this immediately after `context.init(gl)`.  
It instructs Effekseer to save all modified GL state before drawing and restore it
afterwards, preventing Effekseer's blend/depth/cull changes from leaking into the
host framework's next render call.

### 5.4 FOV convention

`setProjectionPerspective(fovDeg, aspect, near, far)` expects **vertical FOV in degrees**.

| Framework | Camera FOV property | Conversion needed |
|-----------|--------------------|--------------------|
| WebGL (raw) | Hardcoded 45° | None |
| Babylon.js | `cam.fov` in **radians** | `cam.fov * (180 / Math.PI)` |
| three.js | `camera.fov` in degrees | None |
| PlayCanvas | `cam.fov` in degrees | None |
| Filament | Set via `camera.setProjectionFov(deg, ...)` | Use same value (45°) |

### 5.5 Effect file format by backend

| Backend | File format | Location |
|---------|-------------|----------|
| All WebGL | `.efk` | `Resources/*.efk` |
| WebGPU (Laser01/02, Ring) | `.efkefc` | `Resources/00_Basic/*.efkefc` |
| WebGPU (block) | `.efk` | `Resources/block.efk` (no compiled version) |

### 5.6 Effekseer draw timing

Effekseer must draw **after** the framework has finished rendering the 3D scene, so
effects appear on top. Each framework provides a different hook:

| Framework | Hook |
|-----------|------|
| Raw WebGL/WebGPU, Rhodonite, Filament | After `renderer.render()` in `requestAnimationFrame` |
| Babylon.js WebGL | `scene.registerAfterRender(cb)` |
| Babylon.js WebGPU | `scene.onAfterRenderObservable.add(cb)` |
| PlayCanvas (both) | `app.on("postrender", cb)` |
| three.js (both) | After `renderer.render(scene, camera)` in `requestAnimationFrame` |
