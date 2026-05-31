import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.19/+esm";

const EFFECT_NAME = "ef_parts_hit01";
const EFFECT_PATH = "../../effekseer/Resources/EffectMaterials/ef_parts_hit01.efkefc";

// ---- In-code GLB builder (cube + grid as a single asset) ----
function alignTo4(n) { return (n + 3) & ~3; }

function buildSceneGlb() {
  const accessors = [];
  const bufferViews = [];
  const binChunks = [];
  let binOffset = 0;

  function addBufferView(typedArray, target) {
    const padded = alignTo4(binOffset);
    if (padded > binOffset) { binChunks.push(new Uint8Array(padded - binOffset)); binOffset = padded; }
    const bytes = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    const bv = { buffer: 0, byteOffset: binOffset, byteLength: bytes.byteLength };
    if (target !== undefined) bv.target = target;
    bufferViews.push(bv);
    binChunks.push(bytes);
    binOffset += bytes.byteLength;
    return bufferViews.length - 1;
  }

  // Cube: 24 vertices (4 per face, flat normals), size 2x2x2 centred at origin
  const CUBE_POSITIONS = new Float32Array([
    -1, -1,  1,  1, -1,  1,  1,  1,  1, -1,  1,  1,  // Front  (+Z)
    -1, -1, -1,  1, -1, -1,  1,  1, -1, -1,  1, -1,  // Back   (-Z)
     1,  1,  1, -1,  1,  1, -1,  1, -1,  1,  1, -1,  // Top    (+Y)
    -1, -1,  1,  1, -1,  1,  1, -1, -1, -1, -1, -1,  // Bottom (-Y)
     1, -1,  1,  1,  1,  1,  1,  1, -1,  1, -1, -1,  // Right  (+X)
    -1, -1,  1, -1,  1,  1, -1,  1, -1, -1, -1, -1,  // Left   (-X)
  ]);
  const CUBE_NORMALS = new Float32Array([
     0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,
     0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,
     0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,
     0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,
     1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,
    -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0,
  ]);
  const CUBE_UVS = new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 1,   0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,   0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,   0, 0, 1, 0, 1, 1, 0, 1,
  ]);
  const CUBE_INDICES = new Uint32Array([
     0,  1,  2,  0,  2,  3,   4,  5,  6,  4,  6,  7,
     8,  9, 10,  8, 10, 11,  12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,  20, 21, 22, 20, 22, 23,
  ]);

  const posBV  = addBufferView(CUBE_POSITIONS, 34962);
  const posAcc = accessors.length;
  accessors.push({ bufferView: posBV, componentType: 5126, count: 24, type: 'VEC3', min: [-1,-1,-1], max: [1,1,1] });
  const nrmBV  = addBufferView(CUBE_NORMALS, 34962);
  const nrmAcc = accessors.length;
  accessors.push({ bufferView: nrmBV, componentType: 5126, count: 24, type: 'VEC3' });
  const uvBV   = addBufferView(CUBE_UVS, 34962);
  const uvAcc  = accessors.length;
  accessors.push({ bufferView: uvBV, componentType: 5126, count: 24, type: 'VEC2' });
  const idxBV  = addBufferView(CUBE_INDICES, 34963);
  const idxAcc = accessors.length;
  accessors.push({ bufferView: idxBV, componentType: 5125, count: 36, type: 'SCALAR' });

  // Grid: LINES primitive (mode 1) with KHR_materials_unlit
  const GRID_SIZE = 15, GRID_DIVS = 30, GRID_STEP = (GRID_SIZE * 2) / GRID_DIVS;
  const gridPos = [], gridIdx = [];
  let vi = 0;
  for (let i = 0; i <= GRID_DIVS; i++) {
    const t = -GRID_SIZE + i * GRID_STEP;
    gridPos.push(t, 0, -GRID_SIZE,  t, 0,  GRID_SIZE); gridIdx.push(vi, vi + 1); vi += 2;
    gridPos.push(-GRID_SIZE, 0, t,  GRID_SIZE, 0, t);  gridIdx.push(vi, vi + 1); vi += 2;
  }
  const gridPosArr = new Float32Array(gridPos);
  const gridIdxArr = new Uint32Array(gridIdx);

  const gridPosBV  = addBufferView(gridPosArr, 34962);
  const gridPosAcc = accessors.length;
  accessors.push({ bufferView: gridPosBV, componentType: 5126, count: gridPosArr.length / 3, type: 'VEC3',
    min: [-GRID_SIZE, 0, -GRID_SIZE], max: [GRID_SIZE, 0, GRID_SIZE] });
  const gridIdxBV  = addBufferView(gridIdxArr, 34963);
  const gridIdxAcc = accessors.length;
  accessors.push({ bufferView: gridIdxBV, componentType: 5125, count: gridIdxArr.length, type: 'SCALAR' });

  const gltf = {
    asset: { version: '2.0', generator: 'filament-effekseer-effectmaterials' },
    extensionsUsed: ['KHR_materials_unlit'],
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [{ name: 'cube', mesh: 0 }, { name: 'grid', mesh: 1 }],
    meshes: [
      { primitives: [{ attributes: { POSITION: posAcc, NORMAL: nrmAcc, TEXCOORD_0: uvAcc }, indices: idxAcc, material: 0 }] },
      { primitives: [{ mode: 1, attributes: { POSITION: gridPosAcc }, indices: gridIdxAcc, material: 1 }] },
    ],
    materials: [
      { name: 'cube', extensions: { KHR_materials_unlit: {} },
        pbrMetallicRoughness: { baseColorFactor: [0.27, 0.53, 1.0, 1.0] }, doubleSided: true },
      { name: 'grid', extensions: { KHR_materials_unlit: {} },
        pbrMetallicRoughness: { baseColorFactor: [0.27, 0.27, 0.27, 1.0] } },
    ],
    accessors, bufferViews, buffers: [{ byteLength: binOffset }],
  };

  let jsonBytes = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonPad = alignTo4(jsonBytes.length) - jsonBytes.length;
  if (jsonPad > 0) {
    const padded = new Uint8Array(jsonBytes.length + jsonPad);
    padded.set(jsonBytes); padded.fill(0x20, jsonBytes.length);
    jsonBytes = padded;
  }
  const binBuf = new Uint8Array(alignTo4(binOffset));
  let o = 0;
  for (const ch of binChunks) { binBuf.set(ch, o); o += ch.byteLength; }

  const totalLen = 12 + 8 + jsonBytes.length + 8 + binBuf.length;
  const glb = new Uint8Array(totalLen);
  const dv = new DataView(glb.buffer);
  let p = 0;
  dv.setUint32(p, 0x46546C67, true); p += 4; // 'glTF'
  dv.setUint32(p, 2, true); p += 4;
  dv.setUint32(p, totalLen, true); p += 4;
  dv.setUint32(p, jsonBytes.length, true); p += 4;
  dv.setUint32(p, 0x4E4F534A, true); p += 4; // 'JSON'
  glb.set(jsonBytes, p); p += jsonBytes.length;
  dv.setUint32(p, binBuf.length, true); p += 4;
  dv.setUint32(p, 0x004E4942, true); p += 4; // 'BIN\0'
  glb.set(binBuf, p);
  return glb;
}

// ---- Globals ----
const canvas   = document.getElementById('canvas');
const statusEl = document.getElementById('status');

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#ffb6a5' : '#bfd0df';
}

let engine, scene, swapChain, renderer, camera, view, gl;
let cubeEntity = null;
let efkContext = null;
let camTheta  = Math.PI / 4;
let camPhi    = 0.614;   // ~35° elevation
let camRadius = 26;
const camTarget = [0, 0, 0];
let aspect = 1;

function getCameraEye() {
  return [
    camTarget[0] + camRadius * Math.cos(camPhi) * Math.sin(camTheta),
    camTarget[1] + camRadius * Math.sin(camPhi),
    camTarget[2] + camRadius * Math.cos(camPhi) * Math.cos(camTheta),
  ];
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w   = canvas.width  = Math.floor(window.innerWidth  * dpr);
  const h   = canvas.height = Math.floor(window.innerHeight * dpr);
  aspect = w / h;
  view.setViewport([0, 0, w, h]);
  camera.setProjectionFov(45, aspect, 1, 1000, window.Fov.VERTICAL);
}

async function main() {
  engine    = Filament.Engine.create(canvas);
  scene     = engine.createScene();
  swapChain = engine.createSwapChain();
  renderer  = engine.createRenderer();
  camera    = engine.createCamera(Filament.EntityManager.get().create());
  view      = engine.createView();
  view.setCamera(camera);
  view.setScene(scene);
  camera.setExposure(16, 1 / 125, 100);

  const colorGrading = Filament.ColorGrading.Builder()
    .toneMapping(window.ToneMapping.LINEAR)
    .build(engine);
  view.setColorGrading(colorGrading);
  renderer.setClearOptions({ clearColor: [21 / 255, 25 / 255, 31 / 255, 1], clear: true });

  const sun = Filament.EntityManager.get().create();
  Filament.LightManager.Builder(window.LightType.SUN)
    .color([1, 0.95, 0.9])
    .intensity(50000)
    .direction([-0.5, -1, -0.5])
    .castShadows(false)
    .build(engine, sun);
  scene.addEntity(sun);

  // Build and load scene GLB (cube + grid)
  const assetLoader = engine.createAssetLoader();
  const asset = assetLoader.createAsset(buildSceneGlb());

  await new Promise((resolve) => {
    asset.loadResources(() => {
      assetLoader.delete();
      let e = asset.popRenderable();
      while (e.getId() !== 0) { scene.addEntity(e); e = asset.popRenderable(); }
      const rm = engine.getRenderableManager();
      for (const ent of asset.getEntities()) {
        const inst = rm.getInstance(ent);
        if (inst) { rm.setCulling(inst, false); inst.delete(); }
      }
      resolve();
    }, () => {}, '');
  });

  cubeEntity = asset.getEntitiesByName('cube')[0] || null;
  if (!cubeEntity) console.warn('[Filament+Effekseer] cube entity not found');

  window.addEventListener('resize', resize);
  resize();

  // Mouse orbit + scroll zoom
  let isDragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('mousedown', e => { isDragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('mouseup', () => { isDragging = false; });
  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    camTheta -= (e.clientX - lastX) * 0.01;
    camPhi   += (e.clientY - lastY) * 0.01;
    camPhi = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, camPhi));
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    camRadius = Math.max(5, Math.min(100, camRadius + e.deltaY * 0.05));
  }, { passive: false });

  // Retrieve the WebGL context that Filament created for this canvas.
  // Effekseer shares this same context so it draws directly into the scene.
  gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

  await new Promise((resolve, reject) => {
    effekseer.initRuntime(
      '../../effekseer/effekseer-webgl.wasm',
      resolve,
      () => reject(new Error('Failed to initialize Effekseer runtime.'))
    );
  });

  efkContext = effekseer.createContext();
  efkContext.init(gl);
  // Save and restore all GL state around each draw so Filament is unaffected.
  efkContext.setRestorationOfStatesFlag(true);

  setStatus('Loading effect...');
  let effect;
  await new Promise((resolve, reject) => {
    effect = efkContext.loadEffect(
      EFFECT_PATH, 1.0, resolve,
      (msg, url) => reject(new Error(`Failed to load ${EFFECT_NAME}: ${msg} (${url})`))
    );
  });
  setStatus('Ready');

  // GUI
  const params = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };
  const gui  = new GUI({ title: 'Effect' });
  const posF = gui.addFolder('Position');
  posF.add(params.position, 'x', -10, 10, 0.1);
  posF.add(params.position, 'y', -10, 10, 0.1);
  posF.add(params.position, 'z', -10, 10, 0.1);
  const rotF = gui.addFolder('Rotation');
  rotF.add(params.rotation, 'x', -180, 180, 1).name('x (deg)');
  rotF.add(params.rotation, 'y', -180, 180, 1).name('y (deg)');
  rotF.add(params.rotation, 'z', -180, 180, 1).name('z (deg)');
  gui.add({
    play: () => {
      const D2R = Math.PI / 180;
      const handle = efkContext.play(effect, params.position.x, params.position.y, params.position.z);
      handle.setRotation(params.rotation.x * D2R, params.rotation.y * D2R, params.rotation.z * D2R);
    }
  }, 'play').name('▶ Play Effect');

  // Render loop
  const tcm    = engine.getTransformManager();
  const tmpMat = mat4.create();
  let t = 0;

  function render() {
    requestAnimationFrame(render);

    t += 0.01;
    if (cubeEntity) {
      mat4.identity(tmpMat);
      mat4.translate(tmpMat, tmpMat, [0, 1, 0]);
      mat4.rotateY(tmpMat, tmpMat, t);
      const inst = tcm.getInstance(cubeEntity);
      tcm.setTransform(inst, tmpMat);
      inst.delete();
    }

    const eye = getCameraEye();
    camera.lookAt(eye, camTarget, [0, 1, 0]);
    renderer.render(swapChain, view);

    // Draw Effekseer effects on top of the Filament scene.
    // Save Filament's current FBO so we can restore it after Effekseer draws.
    // Not restoring it causes Filament's internal FBO tracker to desync from the
    // actual GL state, which is what produces the per-frame flicker.
    const savedFBO = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    efkContext.update(1);
    efkContext.setProjectionPerspective(45, aspect, 1, 1000);
    efkContext.setCameraLookAt(eye[0], eye[1], eye[2], camTarget[0], camTarget[1], camTarget[2], 0, 1, 0);
    efkContext.draw();
    gl.bindFramebuffer(gl.FRAMEBUFFER, savedFBO);
  }

  requestAnimationFrame(render);
}

Filament.init([], () => {
  window.Fov         = Filament.Camera$Fov;
  window.LightType   = Filament.LightManager$Type;
  window.ToneMapping = Filament.ColorGrading$ToneMapping;
  main().catch(e => setStatus(e instanceof Error ? e.message : String(e), true));
});
