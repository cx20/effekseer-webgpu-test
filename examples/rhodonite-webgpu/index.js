import Rn from 'rhodonite';
import { createContext, getLastWebGPUError, initRuntime } from '../effekseer/effekseer.js';

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
    effekseerCanvas.width = width;
    effekseerCanvas.height = height;
    context?.configureSurface({ width, height });
  }
}

const load = async function () {
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported in this browser.');
  }

  rhodoniteCanvas.width = window.innerWidth;
  rhodoniteCanvas.height = window.innerHeight;

  const engine = await Rn.Engine.init({
    approach: Rn.ProcessApproach.WebGPU,
    canvas: rhodoniteCanvas,
  });

  window.addEventListener('resize', () => engine.resizeCanvas(window.innerWidth, window.innerHeight));

  // Background render pass (no entities — just clears to dark color)
  const renderPass = new Rn.RenderPass(engine);
  renderPass.toClearColorBuffer = true;
  renderPass.toClearDepthBuffer = true;
  renderPass.clearColor = Rn.Vector4.fromCopyArray4([0.082, 0.098, 0.122, 1.0]);

  const expression = new Rn.Expression(engine);
  expression.addRenderPasses([renderPass]);

  resizeEffekseerCanvas();

  await initRuntime({
    backend: 'webgpu',
    scriptPath: '../effekseer/effekseer-webgpu.js',
    wasmPath: '../effekseer/effekseer-webgpu.wasm',
  });

  const canvasContext = effekseerCanvas.getContext('webgpu');
  if (!canvasContext) {
    throw new Error('Failed to create WebGPU canvas context for Effekseer.');
  }

  const context = await createContext({
    backend: 'webgpu',
    canvas: effekseerCanvas,
    canvasContext,
    width: effekseerCanvas.width,
    height: effekseerCanvas.height,
    enablePremultipliedAlpha: true,
  });

  const effect = await context.loadEffect('../effekseer/Resources/00_Basic/Laser01.efkefc');
  context.setProjectionPerspective(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  context.setCameraLookAt(0, 14, 14, 0, 0, 0, 0, 1, 0);
  setStatus('Click to play');
  document.addEventListener('click', async () => {
    await context.resumeSound();
    context.play(effect, 0, 0, 0);
    setStatus('Ready.');
  }, { once: true });

  window.addEventListener('resize', () => {
    resizeEffekseerCanvas(context);
    context.setProjectionPerspective(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  });

  const draw = function () {
    engine.process([expression]);
    context.update(1);
    context.drawToCanvas();

    const err = getLastWebGPUError();
    if (err) {
      setStatus(err, true);
    }

    requestAnimationFrame(draw);
  };

  requestAnimationFrame(draw);
};

document.body.onload = load;
