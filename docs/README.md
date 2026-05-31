# Effekseer for Web — Technical Documentation

This folder contains technical documentation for the sample implementations in this repository.

## Contents

| Document | Description |
|----------|-------------|
| [integration-guide.md](./integration-guide.md) | Detailed integration patterns for all supported frameworks |

## Quick Reference

### Effect Resources

| Effect | WebGL path (`.efk`) | WebGPU path (`.efkefc`) |
|--------|--------------------|-----------------------|
| Laser01 | `Resources/Laser01.efk` | `Resources/00_Basic/Laser01.efkefc` |
| Laser02 | `Resources/Laser02.efk` | `Resources/00_Basic/Laser02.efkefc` |
| Simple_Ring_Shape1 | `Resources/Simple_Ring_Shape1.efk` | `Resources/00_Basic/Simple_Ring_Shape1.efkefc` |
| block | `Resources/block.efk` | `Resources/block.efk` ※ |

> ※ `block` has no compiled `.efkefc` version; all backends load the `.efk` file.

### EffectMaterials Resources (CC0)

From [effekseer/EffectMaterials](https://github.com/effekseer/EffectMaterials). All files are `.efkefc` (WebGPU).

| Effect | Path |
|--------|------|
| ef_fire01 | `Resources/EffectMaterials/ef_fire01.efkefc` |
| ef_lightning01 | `Resources/EffectMaterials/ef_lightning01.efkefc` |
| ef_holy01 | `Resources/EffectMaterials/ef_holy01.efkefc` |
| ef_parts_hit01 | `Resources/EffectMaterials/ef_parts_hit01.efkefc` |
| ef_fire02, ef_fire03 | `Resources/EffectMaterials/ef_fire0[23].efkefc` |
| ef_ice01〜03 | `Resources/EffectMaterials/ef_ice0[123].efkefc` |
| ef_lightning02, ef_lightning03 | `Resources/EffectMaterials/ef_lightning0[23].efkefc` |
| ef_parts_hit02 | `Resources/EffectMaterials/ef_parts_hit02.efkefc` |
| ef_wind01〜03 | `Resources/EffectMaterials/ef_wind0[123].efkefc` |

### Framework Integration Summary

| Framework | Backend | Canvas | Effekseer API | Draw method |
|-----------|---------|--------|---------------|-------------|
| WebGL | WebGL2 | Single | Callback | `draw()` |
| WebGPU | WebGPU | Dual | Async/await | `drawToCanvas()` |
| three.js | WebGL | Single | Callback | `draw()` |
| three.js | WebGPU | Dual | Async/await | `drawToCanvas()` |
| Babylon.js | WebGL | Single | Callback | `draw()` |
| Babylon.js | WebGPU | Dual | Async/await | `drawToCanvas()` |
| PlayCanvas | WebGL | Single | Callback | `draw()` |
| PlayCanvas | WebGPU | Dual | Async/await | `drawToCanvas()` |
| Filament 🚧 | WebGL | Single | Callback | `draw()` |
| Rhodonite | WebGL | Single | Callback | `draw()` |
| Rhodonite | WebGPU | Dual | Async/await | `drawToCanvas()` |
