import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.19/+esm";

const canvas = document.getElementById("canvas");
const statusEl = document.getElementById("status");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ffb6a5" : "#bfd0df";
}

const GRID_COLOR = new pc.Color(0.27, 0.27, 0.27);
const GRID_SIZE = 15;
const GRID_DIVS = 30;
const GRID_STEP = (GRID_SIZE * 2) / GRID_DIVS;

function main() {
  const app = new pc.Application(canvas, {});
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);

  app.scene.ambientLight = new pc.Color(0.3, 0.3, 0.3);

  const cameraEntity = new pc.Entity("camera");
  cameraEntity.addComponent("camera", {
    clearColor: new pc.Color(21 / 255, 25 / 255, 31 / 255),
    fov: 45,
    nearClip: 1,
    farClip: 1000,
  });
  app.root.addChild(cameraEntity);

  const lightEntity = new pc.Entity("light");
  lightEntity.addComponent("light", {
    type: "directional",
    color: new pc.Color(1, 1, 1),
    intensity: 3,
  });
  lightEntity.setEulerAngles(45, 30, 0);
  app.root.addChild(lightEntity);

  const boxEntity = new pc.Entity("box");
  boxEntity.addComponent("render", { type: "box" });
  boxEntity.setLocalScale(2, 2, 2);
  boxEntity.setPosition(0, 1, 0);
  app.root.addChild(boxEntity);

  const cubeMat = new pc.StandardMaterial();
  cubeMat.diffuse = new pc.Color(0.27, 0.53, 1.0);
  cubeMat.update();
  boxEntity.render.meshInstances[0].material = cubeMat;

  let theta = Math.PI / 4;
  let phi = Math.acos(15 / 26);
  let radius = 26;

  function getCameraPos() {
    return {
      x: radius * Math.sin(phi) * Math.sin(theta),
      y: radius * Math.cos(phi),
      z: radius * Math.sin(phi) * Math.cos(theta),
    };
  }

  function updateCamera() {
    const { x, y, z } = getCameraPos();
    cameraEntity.setPosition(x, y, z);
    cameraEntity.lookAt(new pc.Vec3(0, 0, 0));
  }
  updateCamera();

  let isDragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener("mousedown", (e) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener("mouseup", () => { isDragging = false; });
  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    theta -= (e.clientX - lastX) * 0.01;
    phi = Math.max(0.05, Math.min(Math.PI * 0.49, phi + (e.clientY - lastY) * 0.01));
    lastX = e.clientX; lastY = e.clientY;
    updateCamera();
  });
  canvas.addEventListener("wheel", (e) => {
    radius = Math.max(5, Math.min(100, radius + e.deltaY * 0.05));
    updateCamera();
    e.preventDefault();
  }, { passive: false });

  app.start();

  const gl = app.graphicsDevice.gl;

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
            const D2R = Math.PI / 180;
            handle.setRotation(params.rotation.x * D2R, params.rotation.y * D2R, params.rotation.z * D2R);
          }
        }, "play").name("▶ Play Effect");
      },
      (message, url) => {
        setStatus(`Failed to load effect: ${message} (${url})`, true);
      }
    );

    let t = 0;
    app.on("update", () => {
      t += 0.01;
      boxEntity.setEulerAngles(0, t * (180 / Math.PI), 0);

      for (let i = 0; i <= GRID_DIVS; i++) {
        const s = -GRID_SIZE + i * GRID_STEP;
        app.drawLine(new pc.Vec3(s, 0, -GRID_SIZE), new pc.Vec3(s, 0, GRID_SIZE), GRID_COLOR, true);
        app.drawLine(new pc.Vec3(-GRID_SIZE, 0, s), new pc.Vec3(GRID_SIZE, 0, s), GRID_COLOR, true);
      }
    });

    app.on("postrender", () => {
      const { x, y, z } = getCameraPos();
      const cam = cameraEntity.camera;

      // PlayCanvas renders to an internal FBO and blits it to the canvas.
      // Switch to the default framebuffer so Effekseer draws directly onto the canvas.
      const savedFBO = gl.getParameter(gl.FRAMEBUFFER_BINDING);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);

      context.update(1);
      context.setProjectionPerspective(cam.fov, canvas.width / canvas.height, cam.nearClip, cam.farClip);
      context.setCameraLookAt(x, y, z, 0, 0, 0, 0, 1, 0);
      context.draw();

      // Restore PlayCanvas's framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, savedFBO);
    });
  }, () => {
    setStatus("Failed to initialize Effekseer runtime.", true);
  });

  window.addEventListener("resize", () => app.resizeCanvas());
}

window.addEventListener("DOMContentLoaded", main, false);
