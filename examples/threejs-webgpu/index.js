import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createContext, getLastWebGPUError, initRuntime } from "../effekseer/effekseer.js";

const threeCanvas = document.getElementById("canvas-threejs");
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

  const renderer = new THREE.WebGPURenderer({ canvas: threeCanvas, antialias: true });
  renderer.setClearColor(0x15191f);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  await renderer.init();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
  camera.position.set(0, 0, 20);

  const controls = new OrbitControls(camera, threeCanvas);
  controls.target.set(0, 0, 0);
  controls.update();

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

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);

    context.update(1);
    context.setProjectionPerspective(camera.fov, camera.aspect, camera.near, camera.far);
    context.setCameraLookAt(
      camera.position.x, camera.position.y, camera.position.z,
      controls.target.x, controls.target.y, controls.target.z,
      0, 1, 0
    );
    context.drawToCanvas();

    const err = getLastWebGPUError();
    if (err) {
      setStatus(err, true);
    }
  }

  animate();

  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    resizeEffekseerCanvas(context);
  });
}

main().catch((err) => {
  setStatus(err instanceof Error ? err.message : String(err), true);
});
