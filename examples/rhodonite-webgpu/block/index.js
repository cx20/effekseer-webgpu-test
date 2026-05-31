import Rn from 'rhodonite';
import { createContext, getLastWebGPUError, initRuntime } from '../../effekseer/effekseer.js';
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.19/+esm';

const rhodoniteCanvas = document.getElementById('world');
const effekseerCanvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#ffb6a5' : '#bfd0df';
}

function resizeEffekseerCanvas(context) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(window.innerWidth * pixelRatio));
  const height = Math.max(1, Math.floor(window.innerHeight * pixelRatio));
  if (effekseerCanvas.width !== width || effekseerCanvas.height !== height) {
    effekseerCanvas.width = width; effekseerCanvas.height = height;
    context?.configureSurface({ width, height });
  }
}

const load = async function () {
  if (!navigator.gpu) throw new Error('WebGPU is not supported in this browser.');

  rhodoniteCanvas.width = window.innerWidth;
  rhodoniteCanvas.height = window.innerHeight;

  const engine = await Rn.Engine.init({ approach: Rn.ProcessApproach.WebGPU, canvas: rhodoniteCanvas });
  window.addEventListener('resize', () => engine.resizeCanvas(window.innerWidth, window.innerHeight));

  const renderPass = new Rn.RenderPass(engine);
  renderPass.toClearColorBuffer = true;
  renderPass.toClearDepthBuffer = true;
  renderPass.clearColor = Rn.Vector4.fromCopyArray4([0.082, 0.098, 0.122, 1.0]);

  const expression = new Rn.Expression(engine);
  expression.addRenderPasses([renderPass]);

  resizeEffekseerCanvas();

  await initRuntime({ backend: 'webgpu', scriptPath: '../../effekseer/effekseer-webgpu.js', wasmPath: '../../effekseer/effekseer-webgpu.wasm' });

  const canvasContext = effekseerCanvas.getContext('webgpu');
  if (!canvasContext) throw new Error('Failed to create WebGPU canvas context for Effekseer.');

  const context = await createContext({ backend: 'webgpu', canvas: effekseerCanvas, canvasContext, width: effekseerCanvas.width, height: effekseerCanvas.height, enablePremultipliedAlpha: true });

  const effect = await context.loadEffect('../../effekseer/Resources/block.efk');
  context.setProjectionPerspective(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  context.setCameraLookAt(20, 20, 20, 0, 0, 0, 0, 1, 0);

  const audioCtx = new AudioContext();
  let soundBuffer = null;
  fetch('../../effekseer/Resources/Sound/Laser.wav').then(r => r.arrayBuffer()).then(buf => audioCtx.decodeAudioData(buf)).then(d => { soundBuffer = d; }).catch(() => {});

  setStatus('Ready');

  const params = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };
  const gui = new GUI({ title: 'Effect' });
  const posF = gui.addFolder('Position');
  posF.add(params.position, 'x', -10, 10, 0.1); posF.add(params.position, 'y', -10, 10, 0.1); posF.add(params.position, 'z', -10, 10, 0.1);
  const rotF = gui.addFolder('Rotation');
  rotF.add(params.rotation, 'x', -180, 180, 1).name('x (deg)'); rotF.add(params.rotation, 'y', -180, 180, 1).name('y (deg)'); rotF.add(params.rotation, 'z', -180, 180, 1).name('z (deg)');
  gui.add({ play: async () => { await audioCtx.resume(); if (soundBuffer) { const s = audioCtx.createBufferSource(); s.buffer = soundBuffer; s.connect(audioCtx.destination); s.start(); } const handle = context.play(effect, params.position.x, params.position.y, params.position.z); const D2R = Math.PI / 180; context.setRotation(handle, params.rotation.x * D2R, params.rotation.y * D2R, params.rotation.z * D2R); }}, 'play').name('▶ Play Effect');

  window.addEventListener('resize', () => { resizeEffekseerCanvas(context); context.setProjectionPerspective(45, window.innerWidth / window.innerHeight, 0.1, 1000); });

  const draw = function () {
    engine.process([expression]);
    context.update(1); context.drawToCanvas();
    const err = getLastWebGPUError(); if (err) setStatus(err, true);
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
};

document.body.onload = load;
