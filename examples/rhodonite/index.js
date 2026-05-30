import Rn from 'rhodonite';

const canvas = document.getElementById('world');
const statusEl = document.getElementById('status');

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#ffb6a5' : '#bfd0df';
}

const load = async function () {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const engine = await Rn.Engine.init({
    approach: Rn.ProcessApproach.DataTexture,
    canvas,
  });

  window.addEventListener('resize', () => engine.resizeCanvas(window.innerWidth, window.innerHeight));

  // Background render pass (no entities — just clears to dark color)
  const renderPass = new Rn.RenderPass(engine);
  renderPass.toClearColorBuffer = true;
  renderPass.toClearDepthBuffer = true;
  renderPass.clearColor = Rn.Vector4.fromCopyArray4([0.082, 0.098, 0.122, 1.0]);

  const expression = new Rn.Expression(engine);
  expression.addRenderPasses([renderPass]);

  // Get the WebGL context Rhodonite created (returns the same context)
  const gl = canvas.getContext('webgl2');

  let effekseerContext = null;

  await new Promise((resolve, reject) => {
    effekseer.initRuntime('../effekseer/effekseer-webgl.wasm', () => {
      effekseerContext = effekseer.createContext();
      effekseerContext.init(gl);
      effekseerContext.setRestorationOfStatesFlag(true);
      effekseerContext.setProjectionPerspective(45, canvas.width / canvas.height, 0.1, 1000);
      effekseerContext.setCameraLookAt(0, 14, 14, 0, 0, 0, 0, 1, 0);

      const effect = effekseerContext.loadEffect(
        '../effekseer/Resources/Laser01.efk',
        1.0,
        () => {
          setStatus('Click to play');
          document.addEventListener('click', () => {
            const audioCtx = window.AL?.currentCtx?.audioCtx ?? window.AL?.currentCtx?.ctx;
            if (audioCtx?.state !== 'running') audioCtx?.resume();
            effekseerContext.play(effect, 0, 0, 0);
            setStatus('Ready.');
          }, { once: true });
          resolve();
        },
        (message, url) => {
          setStatus(`Failed to load effect: ${message} (${url})`, true);
          reject(new Error(message));
        }
      );
    }, () => {
      setStatus('Failed to initialize Effekseer runtime.', true);
      reject(new Error('Failed to initialize Effekseer runtime.'));
    });
  });

  const draw = function () {
    engine.process([expression]);
    effekseerContext.update(1);
    effekseerContext.draw();
    requestAnimationFrame(draw);
  };

  requestAnimationFrame(draw);
};

document.body.onload = load;
