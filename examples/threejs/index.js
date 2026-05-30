import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

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
  camera.position.set(0, 14, 14);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 0);
  controls.update();

  const gl = renderer.getContext();

  effekseer.initRuntime("../effekseer/effekseer-webgl.wasm", () => {
    const context = effekseer.createContext();
    context.init(gl);
    context.setRestorationOfStatesFlag(true);

    const effect = context.loadEffect(
      "../effekseer/Resources/Laser01.efk",
      1.0,
      () => {
        setStatus("Click to play");
        document.addEventListener("click", () => {
          const audioCtx = window.AL?.currentCtx?.audioCtx ?? window.AL?.currentCtx?.ctx;
          if (audioCtx?.state !== "running") audioCtx?.resume();
          context.play(effect, 0, 0, 0);
          setStatus("Ready.");
        }, { once: true });
      },
      (message, url) => {
        setStatus(`Failed to load effect: ${message} (${url})`, true);
      }
    );

    function animate() {
      requestAnimationFrame(animate);
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
