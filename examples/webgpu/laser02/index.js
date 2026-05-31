import { createContext, getLastWebGPUError, initRuntime } from "../../effekseer/effekseer.js";
import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.19/+esm";

const sceneCanvas = document.getElementById("canvas-scene");
const effekseerCanvas = document.getElementById("canvas");
const statusEl = document.getElementById("status");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ffb6a5" : "#bfd0df";
}

function matPerspective(fovDeg, aspect, near, far) {
  const f = 1 / Math.tan((fovDeg * Math.PI / 180) / 2);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, far / (near - far), -1, 0, 0, near * far / (near - far), 0]);
}

function matLookAt(ex, ey, ez, cx, cy, cz) {
  let fx = cx - ex, fy = cy - ey, fz = cz - ez;
  let d = Math.sqrt(fx * fx + fy * fy + fz * fz);
  fx /= d; fy /= d; fz /= d;
  let rx = -fz, ry = 0, rz = fx;
  d = Math.sqrt(rx * rx + rz * rz); rx /= d; rz /= d;
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  return new Float32Array([rx, ux, -fx, 0, ry, uy, -fy, 0, rz, uz, -fz, 0, -(rx * ex + ry * ey + rz * ez), -(ux * ex + uy * ey + uz * ez), fx * ex + fy * ey + fz * ez, 1]);
}

function matRotYTranslate(angle, tx, ty, tz) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, tx, ty, tz, 1]);
}

function gridVertices(size = 15, steps = 30) {
  const v = [];
  for (let i = 0; i <= steps; i++) { const t = -size + (2 * size * i / steps); v.push(t, 0, -size, t, 0, size, -size, 0, t, size, 0, t); }
  return new Float32Array(v);
}

function cubeVertices() {
  const s = 1;
  return new Float32Array([
    -s,-s, s,0,0,1,  s,-s, s,0,0,1,  s, s, s,0,0,1, -s,-s, s,0,0,1,  s, s, s,0,0,1, -s, s, s,0,0,1,
     s,-s,-s,0,0,-1,-s,-s,-s,0,0,-1,-s, s,-s,0,0,-1,  s,-s,-s,0,0,-1,-s, s,-s,0,0,-1,  s, s,-s,0,0,-1,
    -s,-s,-s,-1,0,0,-s,-s, s,-1,0,0,-s, s, s,-1,0,0,-s,-s,-s,-1,0,0,-s, s, s,-1,0,0,-s, s,-s,-1,0,0,
     s,-s, s,1,0,0,  s,-s,-s,1,0,0,  s, s,-s,1,0,0,  s,-s, s,1,0,0,  s, s,-s,1,0,0,  s, s, s,1,0,0,
    -s, s, s,0,1,0,  s, s, s,0,1,0,  s, s,-s,0,1,0, -s, s, s,0,1,0,  s, s,-s,0,1,0, -s, s,-s,0,1,0,
    -s,-s,-s,0,-1,0, s,-s,-s,0,-1,0, s,-s, s,0,-1,0,-s,-s,-s,0,-1,0, s,-s, s,0,-1,0,-s,-s, s,0,-1,0,
  ]);
}

function resizeEffekseerCanvas(context) {
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.floor(window.innerWidth * pr)), h = Math.max(1, Math.floor(window.innerHeight * pr));
  if (effekseerCanvas.width !== w || effekseerCanvas.height !== h) { effekseerCanvas.width = w; effekseerCanvas.height = h; context?.configureSurface({ width: w, height: h }); }
}

async function main() {
  if (!navigator.gpu) throw new Error("WebGPU is not supported in this browser.");
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("Failed to get a WebGPU adapter.");
  const device = await adapter.requestDevice();
  device.addEventListener("uncapturederror", (e) => setStatus(e.error?.message ?? "WebGPU error.", true));

  const format = navigator.gpu.getPreferredCanvasFormat();
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  sceneCanvas.width = Math.max(1, Math.floor(window.innerWidth * pr));
  sceneCanvas.height = Math.max(1, Math.floor(window.innerHeight * pr));
  const sceneCtx = sceneCanvas.getContext("webgpu");
  sceneCtx.configure({ device, format, alphaMode: "opaque" });
  let depthTexture = device.createTexture({ size: [sceneCanvas.width, sceneCanvas.height], format: "depth24plus", usage: GPUTextureUsage.RENDER_ATTACHMENT });

  const shaderModule = device.createShaderModule({ code: `
struct U { projection: mat4x4<f32>, view: mat4x4<f32>, model: mat4x4<f32> }
@group(0) @binding(0) var<uniform> u: U;
@vertex fn vsGrid(@location(0) p: vec3<f32>) -> @builtin(position) vec4<f32> { return u.projection * u.view * vec4<f32>(p, 1.0); }
@fragment fn fsGrid() -> @location(0) vec4<f32> { return vec4<f32>(0.27, 0.27, 0.27, 1.0); }
struct VO { @builtin(position) p: vec4<f32>, @location(0) n: vec3<f32> }
@vertex fn vsCube(@location(0) p: vec3<f32>, @location(1) n: vec3<f32>) -> VO { var o: VO; o.p = u.projection * u.view * u.model * vec4<f32>(p, 1.0); o.n = (u.model * vec4<f32>(n, 0.0)).xyz; return o; }
@fragment fn fsCube(@location(0) n: vec3<f32>) -> @location(0) vec4<f32> { let d = max(dot(normalize(n), normalize(vec3<f32>(1.0, 2.0, 1.0))), 0.0) * 0.7 + 0.3; return vec4<f32>(0.27 * d, 0.53 * d, 1.0 * d, 1.0); }` });

  const uniformBuffer = device.createBuffer({ size: 192, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bgl = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} }] });
  const bindGroup = device.createBindGroup({ layout: bgl, entries: [{ binding: 0, resource: { buffer: uniformBuffer } }] });
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bgl] });

  const gridVerts = gridVertices();
  const gridBuf = device.createBuffer({ size: gridVerts.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(gridBuf, 0, gridVerts);
  const gridPipeline = device.createRenderPipeline({ layout: pipelineLayout, vertex: { module: shaderModule, entryPoint: "vsGrid", buffers: [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] }] }, fragment: { module: shaderModule, entryPoint: "fsGrid", targets: [{ format }] }, primitive: { topology: "line-list" }, depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" } });

  const cubeVerts = cubeVertices();
  const cubeBuf = device.createBuffer({ size: cubeVerts.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(cubeBuf, 0, cubeVerts);
  const cubePipeline = device.createRenderPipeline({ layout: pipelineLayout, vertex: { module: shaderModule, entryPoint: "vsCube", buffers: [{ arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }, { shaderLocation: 1, offset: 12, format: "float32x3" }] }] }, fragment: { module: shaderModule, entryPoint: "fsCube", targets: [{ format }] }, primitive: { topology: "triangle-list", cullMode: "none" }, depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" } });

  resizeEffekseerCanvas();
  await initRuntime({ backend: "webgpu", device, scriptPath: "../../effekseer/effekseer-webgpu.js", wasmPath: "../../effekseer/effekseer-webgpu.wasm" });
  const canvasContext = effekseerCanvas.getContext("webgpu");
  if (!canvasContext) throw new Error("Failed to create WebGPU canvas context for Effekseer.");
  const context = await createContext({ backend: "webgpu", canvas: effekseerCanvas, canvasContext, device, width: effekseerCanvas.width, height: effekseerCanvas.height });

  const effect = await context.loadEffect("../../effekseer/Resources/00_Basic/Laser02.efkefc");
  context.setProjectionPerspective(45, window.innerWidth / window.innerHeight, 1, 1000);
  context.setCameraLookAt(20, 20, 20, 0, 0, 0, 0, 1, 0);

  const audioCtx = new AudioContext();
  let soundBuffer = null;
  fetch("../../effekseer/Resources/Sound/Laser.wav").then(r => r.arrayBuffer()).then(buf => audioCtx.decodeAudioData(buf)).then(d => { soundBuffer = d; }).catch(() => {});

  setStatus("Ready");
  const params = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };
  const gui = new GUI({ title: "Effect" });
  const posF = gui.addFolder("Position");
  posF.add(params.position, "x", -10, 10, 0.1); posF.add(params.position, "y", -10, 10, 0.1); posF.add(params.position, "z", -10, 10, 0.1);
  const rotF = gui.addFolder("Rotation");
  rotF.add(params.rotation, "x", -180, 180, 1).name("x (deg)"); rotF.add(params.rotation, "y", -180, 180, 1).name("y (deg)"); rotF.add(params.rotation, "z", -180, 180, 1).name("z (deg)");
  gui.add({ play: async () => { await audioCtx.resume(); if (soundBuffer) { const s = audioCtx.createBufferSource(); s.buffer = soundBuffer; s.connect(audioCtx.destination); s.start(); } const handle = context.play(effect, params.position.x, params.position.y, params.position.z); const D2R = Math.PI / 180; handle.setRotation(params.rotation.x * D2R, params.rotation.y * D2R, params.rotation.z * D2R); }}, "play").name("▶ Play Effect");

  let t = 0;
  const EYE = [20, 20, 20];
  function render() {
    requestAnimationFrame(render); t += 0.01;
    const proj = matPerspective(45, sceneCanvas.width / sceneCanvas.height, 1, 1000);
    const view = matLookAt(...EYE, 0, 0, 0);
    const model = matRotYTranslate(t, 0, 1, 0);
    const ud = new Float32Array(48); ud.set(proj, 0); ud.set(view, 16); ud.set(model, 32);
    device.queue.writeBuffer(uniformBuffer, 0, ud);
    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: sceneCtx.getCurrentTexture().createView(), clearValue: { r: 0.082, g: 0.098, b: 0.122, a: 1 }, loadOp: "clear", storeOp: "store" }], depthStencilAttachment: { view: depthTexture.createView(), depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "store" } });
    pass.setBindGroup(0, bindGroup);
    pass.setPipeline(gridPipeline); pass.setVertexBuffer(0, gridBuf); pass.draw(gridVerts.length / 3);
    pass.setPipeline(cubePipeline); pass.setVertexBuffer(0, cubeBuf); pass.draw(36);
    pass.end(); device.queue.submit([enc.finish()]);
    context.update(1); context.drawToCanvas();
    const err = getLastWebGPUError(); if (err) setStatus(err, true);
  }
  render();

  window.addEventListener("resize", () => {
    const pr2 = Math.min(window.devicePixelRatio || 1, 2);
    sceneCanvas.width = Math.max(1, Math.floor(window.innerWidth * pr2)); sceneCanvas.height = Math.max(1, Math.floor(window.innerHeight * pr2));
    sceneCtx.configure({ device, format, alphaMode: "opaque" });
    depthTexture.destroy(); depthTexture = device.createTexture({ size: [sceneCanvas.width, sceneCanvas.height], format: "depth24plus", usage: GPUTextureUsage.RENDER_ATTACHMENT });
    resizeEffekseerCanvas(context); context.setProjectionPerspective(45, window.innerWidth / window.innerHeight, 1, 1000);
  });
}

main().catch((err) => setStatus(err instanceof Error ? err.message : String(err), true));
