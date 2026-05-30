import { createContext, getLastWebGPUError, initRuntime } from "../effekseer.js";

const canvas = document.getElementById("canvas");
const statusEl = document.getElementById("status");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ffb6a5" : "#bfd0df";
}

function resizeCanvas(context) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(window.innerWidth * pixelRatio));
  const height = Math.max(1, Math.floor(window.innerHeight * pixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    context?.configureSurface({ width, height });
  }
}

async function main() {
  if (!navigator.gpu) {
    throw new Error("WebGPU is not supported in this browser.");
  }

  resizeCanvas();

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("Failed to get a WebGPU adapter.");
  }

  const device = await adapter.requestDevice();
  device.addEventListener("uncapturederror", (event) => {
    setStatus(event.error?.message ?? "WebGPU error.", true);
  });

  const canvasContext = canvas.getContext("webgpu");
  if (!canvasContext) {
    throw new Error("Failed to create WebGPU canvas context.");
  }

  await initRuntime({
    backend: "webgpu",
    device,
    scriptPath: "../effekseer-webgpu.js",
    wasmPath: "../effekseer-webgpu.wasm",
  });

  const context = await createContext({
    backend: "webgpu",
    canvas,
    canvasContext,
    device,
    width: canvas.width,
    height: canvas.height,
  });

  const effect = await context.loadEffect("../Resources/00_Basic/Laser01.efkefc");
  context.play(effect, 0, 0, 0);
  context.setProjectionPerspective(45, canvas.width / canvas.height, 1, 1000);
  context.setCameraLookAt(0, 0, 20, 0, 0, 0);
  setStatus("Ready.");

  window.addEventListener("resize", () => {
    resizeCanvas(context);
    context.setProjectionPerspective(45, canvas.width / canvas.height, 1, 1000);
  });

  function render() {
    requestAnimationFrame(render);
    context.update(1);
    context.drawToCanvas();

    const err = getLastWebGPUError();
    if (err) {
      setStatus(err, true);
    }
  }

  render();
}

main().catch((err) => {
  setStatus(err instanceof Error ? err.message : String(err), true);
});
