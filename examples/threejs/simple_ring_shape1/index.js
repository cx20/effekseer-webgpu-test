import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.19/+esm";

const canvas = document.getElementById("canvas");
const statusEl = document.getElementById("status");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ffb6a5" : "#bfd0df";
}

function main() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x15191f);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
  camera.position.set(15, 15, 15);

  const controls = new OrbitControls(camera, canvas);
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

  const gl = renderer.getContext();

  effekseer.initRuntime("../../effekseer/effekseer-webgl.wasm", () => {
    const context = effekseer.createContext();
    context.init(gl);
    context.setRestorationOfStatesFlag(true);

    const effect = context.loadEffect(
      "../../effekseer/Resources/Simple_Ring_Shape1.efk",
      1.0,
      () => {
        setStatus("Ready");

        const params = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };
        const gui = new GUI({ title: "Effect" });
        const posF = gui.addFolder("Position");
        posF.add(params.position, "x", -10, 10, 0.1);
        posF.add(params.position, "y", -10, 10, 0.1);
        posF.add(params.position, "z", -10, 10, 0.1);
        const rotF = gui.addFolder("Rotation");
        rotF.add(params.rotation, "x", -Math.PI, Math.PI, 0.01).name("x (rad)");
        rotF.add(params.rotation, "y", -Math.PI, Math.PI, 0.01).name("y (rad)");
        rotF.add(params.rotation, "z", -Math.PI, Math.PI, 0.01).name("z (rad)");
        gui.add({
          play: () => {
            const audioCtx = window.AL?.currentCtx?.audioCtx ?? window.AL?.currentCtx?.ctx;
            if (audioCtx?.state !== "running") audioCtx?.resume();
            const handle = context.play(effect, params.position.x, params.position.y, params.position.z);
            context.setRotation(handle, params.rotation.x, params.rotation.y, params.rotation.z);
          }
        }, "play").name("▶ Play Effect");
      },
      (message, url) => {
        setStatus(`Failed to load effect: ${message} (${url})`, true);
      }
    );

    let t = 0;
    function animate() {
      requestAnimationFrame(animate);
      t += 0.01;
      cube.rotation.y = t;
      controls.update();
      renderer.render(scene, camera);
      context.update(1);
      context.setProjectionMatrix(Array.from(camera.projectionMatrix.elements));
      context.setCameraMatrix(Array.from(camera.matrixWorldInverse.elements));
      context.draw();
    }

    animate();
  }, () => {
    setStatus("Failed to initialize Effekseer runtime.", true);
  });

  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });
}

window.addEventListener("DOMContentLoaded", main, false);
