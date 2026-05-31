import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createContext, getLastWebGPUError, initRuntime } from "../../effekseer/effekseer.js";
import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.19/+esm";

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
  camera.position.set(15, 15, 15);

  const controls = new OrbitControls(camera, threeCanvas);
  controls.target.set(0, 0, 0);
  controls.update();

  scene.add(new THREE.GridHelper(30, 30, 0x444444, 0x222222));

  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const dirLight = new THREE.DirectionalLight(0xffffff, 3);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshPhongMaterial({ color: 0x4488ff })
  );
  cube.position.y = 1;
  scene.add(cube);

  resizeEffekseerCanvas();

  await initRuntime({
    backend: "webgpu",
    scriptPath: "../../effekseer/effekseer-webgpu.js",
    wasmPath: "../../effekseer/effekseer-webgpu.wasm",
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

  const effect = await context.loadEffect("../../effekseer/Resources/00_Basic/Simple_Ring_Shape1.efkefc");

  const audioCtx = new AudioContext();
  let soundBuffer = null;
  fetch("../../effekseer/Resources/Sound/Laser.wav")
    .then(r => r.arrayBuffer())
    .then(buf => audioCtx.decodeAudioData(buf))
    .then(decoded => { soundBuffer = decoded; })
    .catch(() => {});

  setStatus("Ready");

  const params = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };
  const gui = new GUI({ title: "Effect" });
  const posF = gui.addFolder("Position");
  posF.add(params.position, "x", -10, 10, 0.1);
  posF.add(params.position, "y", -10, 10, 0.1);
  posF.add(params.position, "z", -10, 10, 0.1);
  const rotF = gui.addFolder("Rotation");
  rotF.add(params.rotation, "x", -180, 180, 1).name("x (deg)");
  rotF.add(params.rotation, "y", -180, 180, 1).name("y (deg)");
  rotF.add(params.rotation, "z", -180, 180, 1).name("z (deg)");
  gui.add({
    play: async () => {
      await audioCtx.resume();
      if (soundBuffer) {
        const src = audioCtx.createBufferSource();
        src.buffer = soundBuffer;
        src.connect(audioCtx.destination);
        src.start();
      }
      const handle = context.play(effect, params.position.x, params.position.y, params.position.z);
      const D2R = Math.PI / 180; handle.setRotation(params.rotation.x * D2R, params.rotation.y * D2R, params.rotation.z * D2R);
    }
  }, "play").name("▶ Play Effect");

  let t = 0;
  function animate() {
    requestAnimationFrame(animate);
    t += 0.01;
    cube.rotation.y = t;
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
    if (err) setStatus(err, true);
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
