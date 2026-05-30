const canvas = document.getElementById("canvas");
const statusEl = document.getElementById("status");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ffb6a5" : "#bfd0df";
}

function main() {
  const engine = new BABYLON.Engine(canvas, true);
  const scene = new BABYLON.Scene(engine);
  scene.useRightHandedSystem = true;
  scene.clearColor = new BABYLON.Color4(21 / 255, 25 / 255, 31 / 255, 1);

  const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 4, 20, BABYLON.Vector3.Zero(), scene);
  camera.attachControl(canvas, true);

  const gl = engine._gl;

  effekseer.initRuntime("../effekseer-webgl.wasm", () => {
    const context = effekseer.createContext();
    context.init(gl);
    context.setRestorationOfStatesFlag(true);

    const effect = context.loadEffect(
      "../Resources/Laser01.efk",
      1.0,
      () => {
        context.play(effect, 0, 0, 0);
        setStatus("Ready.");
      },
      (message, url) => {
        setStatus(`Failed to load effect: ${message} (${url})`, true);
      }
    );

    scene.registerAfterRender(() => {
      context.update(1);
      context.setProjectionMatrix(Array.from(scene.activeCamera.getProjectionMatrix().m));
      context.setCameraMatrix(Array.from(scene.activeCamera.getViewMatrix().m));
      context.draw();
    });

    engine.runRenderLoop(() => {
      scene.render();
    });
  }, () => {
    setStatus("Failed to initialize Effekseer runtime.", true);
  });

  window.addEventListener("resize", () => engine.resize());
}

window.addEventListener("DOMContentLoaded", main, false);
