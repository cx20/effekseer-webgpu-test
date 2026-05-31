import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.19/+esm";

const canvas = document.getElementById("canvas");
const statusEl = document.getElementById("status");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ffb6a5" : "#bfd0df";
}

function createGrid(scene, size = 15, divisions = 30) {
  const lines = [];
  const step = (size * 2) / divisions;
  for (let i = 0; i <= divisions; i++) {
    const t = -size + i * step;
    lines.push([new BABYLON.Vector3(t, 0, -size), new BABYLON.Vector3(t, 0, size)]);
    lines.push([new BABYLON.Vector3(-size, 0, t), new BABYLON.Vector3(size, 0, t)]);
  }
  const grid = BABYLON.MeshBuilder.CreateLineSystem("grid", { lines }, scene);
  grid.color = new BABYLON.Color3(0.27, 0.27, 0.27);
  return grid;
}

function main() {
  const engine = new BABYLON.Engine(canvas, true);
  const scene = new BABYLON.Scene(engine);
  scene.useRightHandedSystem = true;
  scene.clearColor = new BABYLON.Color4(21 / 255, 25 / 255, 31 / 255, 1);

  const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 4, 20, BABYLON.Vector3.Zero(), scene);
  camera.attachControl(canvas, true);

  const hemiLight = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
  hemiLight.intensity = 1.5;
  const dirLight = new BABYLON.DirectionalLight("dir", new BABYLON.Vector3(-1, -2, -1), scene);
  dirLight.intensity = 3;

  createGrid(scene);

  const cube = BABYLON.MeshBuilder.CreateBox("cube", { size: 2 }, scene);
  cube.position.y = 1;
  const cubeMat = new BABYLON.StandardMaterial("cubeMat", scene);
  cubeMat.diffuseColor = new BABYLON.Color3(0.27, 0.53, 1.0);
  cube.material = cubeMat;

  let t = 0;
  scene.registerBeforeRender(() => {
    t += 0.01;
    cube.rotation.y = t;
  });

  const gl = engine._gl;

  effekseer.initRuntime("../../effekseer/effekseer-webgl.wasm", () => {
    const context = effekseer.createContext();
    context.init(gl);
    context.setRestorationOfStatesFlag(true);

    const effect = context.loadEffect(
      "../../effekseer/Resources/Laser01.efk",
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
        rotF.add(params.rotation, "x", -180, 180, 1).name("x (deg)");
        rotF.add(params.rotation, "y", -180, 180, 1).name("y (deg)");
        rotF.add(params.rotation, "z", -180, 180, 1).name("z (deg)");
        gui.add({
          play: () => {
            const audioCtx = window.AL?.currentCtx?.audioCtx ?? window.AL?.currentCtx?.ctx;
            if (audioCtx?.state !== "running") audioCtx?.resume();
            const handle = context.play(effect, params.position.x, params.position.y, params.position.z);
            const D2R = Math.PI / 180; handle.setRotation(params.rotation.x * D2R, params.rotation.y * D2R, params.rotation.z * D2R);
          }
        }, "play").name("▶ Play Effect");
      },
      (message, url) => {
        setStatus(`Failed to load effect: ${message} (${url})`, true);
      }
    );

    scene.registerAfterRender(() => {
      const cam = scene.activeCamera;
      const pos = cam.position;
      const target = cam.target;
      context.update(1);
      context.setProjectionPerspective(
        cam.fov * (180 / Math.PI),
        canvas.width / canvas.height,
        cam.minZ,
        cam.maxZ
      );
      context.setCameraLookAt(pos.x, pos.y, -pos.z, target.x, target.y, -target.z, 0, 1, 0);
      context.draw();
    });

    engine.runRenderLoop(() => scene.render());
  }, () => {
    setStatus("Failed to initialize Effekseer runtime.", true);
  });

  window.addEventListener("resize", () => engine.resize());
}

window.addEventListener("DOMContentLoaded", main, false);
