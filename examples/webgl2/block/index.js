const canvas = document.getElementById("canvas");
const statusEl = document.getElementById("status");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ffb6a5" : "#bfd0df";
}

function resizeCanvas(gl, context) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(window.innerWidth * pixelRatio));
  const height = Math.max(1, Math.floor(window.innerHeight * pixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
    context?.setProjectionPerspective(45, width / height, 1, 1000);
  }
}

function main() {
  const gl = canvas.getContext("webgl2");
  if (!gl) {
    setStatus("WebGL 2.0 is not supported in this browser.", true);
    return;
  }

  effekseer.initRuntime("../../effekseer/effekseer-webgl.wasm", () => {
    const context = effekseer.createContext();
    context.init(gl);
    context.setRestorationOfStatesFlag(true);

    resizeCanvas(gl, context);
    context.setCameraLookAt(0, 14, 14, 0, 0, 0, 0, 1, 0);

    const effect = context.loadEffect(
      "../../effekseer/Resources/block.efk",
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

    window.addEventListener("resize", () => resizeCanvas(gl, context));

    function render() {
      requestAnimationFrame(render);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      context.update(1);
      context.draw();
    }

    render();
  }, () => {
    setStatus("Failed to initialize Effekseer runtime.", true);
  });
}

window.addEventListener("DOMContentLoaded", main, false);
