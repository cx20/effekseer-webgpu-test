import { createContext, getLastWebGPUError, initRuntime } from "../effekseer/effekseer.js";

const babylonCanvas = document.getElementById("canvas-babylon");
const effekseerCanvas = document.getElementById("canvas");
const statusEl = document.getElementById("status");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ffb6a5" : "#bfd0df";
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

async function main() {
  if (!navigator.gpu) {
    throw new Error("WebGPU is not supported in this browser.");
  }

  const engine = new BABYLON.WebGPUEngine(babylonCanvas);
  await engine.initAsync();

  const scene = new BABYLON.Scene(engine);
  scene.useRightHandedSystem = true;
  scene.clearColor = new BABYLON.Color4(21 / 255, 25 / 255, 31 / 255, 1);

  const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 4, 20, BABYLON.Vector3.Zero(), scene);
  camera.attachControl(babylonCanvas, true);

  resizeEffekseerCanvas();

  await initRuntime({
    backend: "webgpu",
    scriptPath: "../effekseer/effekseer-webgpu.js",
    wasmPath: "../effekseer/effekseer-webgpu.wasm",
  });

  const canvasContext = effekseerCanvas.getContext("webgpu");
  if (!canvasContext) {
    throw new Error("Failed to create WebGPU canvas context for Effekseer.");
  }

  const context = await createContext({
    backend: "webgpu",
    canvas: effekseerCanvas,
    canvasContext,
    width: effekseerCanvas.width,
    height: effekseerCanvas.height,
    enablePremultipliedAlpha: true,
  });

  const effect = await context.loadEffect("../effekseer/Resources/00_Basic/Laser01.efkefc");
  context.play(effect, 0, 0, 0);
  setStatus("Ready.");

  scene.onAfterRenderObservable.add(() => {
    const camera = scene.activeCamera;
    const pos = camera.position;
    const target = camera.target;
    context.update(1);
    context.setProjectionPerspective(
      camera.fov * (180 / Math.PI),
      babylonCanvas.width / babylonCanvas.height,
      camera.minZ,
      camera.maxZ
    );
    context.setCameraLookAt(pos.x, pos.y, -pos.z, target.x, target.y, -target.z, 0, 1, 0);
    context.drawToCanvas();

    const err = getLastWebGPUError();
    if (err) {
      setStatus(err, true);
    }
  });

  engine.runRenderLoop(() => {
    scene.render();
  });

  window.addEventListener("resize", () => {
    engine.resize();
    resizeEffekseerCanvas(context);
  });
}

main().catch((err) => {
  setStatus(err instanceof Error ? err.message : String(err), true);
});
