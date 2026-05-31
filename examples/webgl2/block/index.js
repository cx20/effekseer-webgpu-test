import GUI from "lil-gui";

const canvas = document.getElementById("canvas");
const statusEl = document.getElementById("status");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ffb6a5" : "#bfd0df";
}

function matPerspective(fovDeg, aspect, near, far) {
  const f = 1 / Math.tan((fovDeg * Math.PI / 180) / 2);
  const nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}

function matLookAt(ex, ey, ez, cx, cy, cz) {
  let fx = cx - ex, fy = cy - ey, fz = cz - ez;
  let d = Math.sqrt(fx * fx + fy * fy + fz * fz);
  fx /= d; fy /= d; fz /= d;
  let rx = -fz, ry = 0, rz = fx;
  d = Math.sqrt(rx * rx + rz * rz);
  rx /= d; rz /= d;
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  return new Float32Array([rx, ux, -fx, 0, ry, uy, -fy, 0, rz, uz, -fz, 0, -(rx * ex + ry * ey + rz * ez), -(ux * ex + uy * ey + uz * ez), fx * ex + fy * ey + fz * ez, 1]);
}

function matRotYTranslate(angle, tx, ty, tz) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, tx, ty, tz, 1]);
}

function createProgram(gl, vsrc, fsrc) {
  const vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vs, vsrc); gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fs, fsrc); gl.compileShader(fs);
  const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  return prog;
}

const GRID_VS = `#version 300 es
in vec3 aPos; uniform mat4 uProj, uView;
void main() { gl_Position = uProj * uView * vec4(aPos, 1.0); }`;
const GRID_FS = `#version 300 es
precision mediump float; out vec4 c;
void main() { c = vec4(0.27, 0.27, 0.27, 1.0); }`;
const CUBE_VS = `#version 300 es
in vec3 aPos; in vec3 aNorm; uniform mat4 uProj, uView, uModel; out vec3 vNorm;
void main() { vNorm = mat3(uModel) * aNorm; gl_Position = uProj * uView * uModel * vec4(aPos, 1.0); }`;
const CUBE_FS = `#version 300 es
precision mediump float; in vec3 vNorm; out vec4 c;
void main() { float d = max(dot(normalize(vNorm), normalize(vec3(1.0,2.0,1.0))), 0.0) * 0.7 + 0.3; c = vec4(0.27*d, 0.53*d, 1.0*d, 1.0); }`;

function buildGrid(gl, size = 15, steps = 30) {
  const v = [];
  for (let i = 0; i <= steps; i++) {
    const t = -size + (2 * size * i / steps);
    v.push(t, 0, -size, t, 0, size, -size, 0, t, size, 0, t);
  }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
  return { buf, count: v.length / 3 };
}

function buildCube(gl) {
  const s = 1;
  const v = [
    -s,-s, s,0,0,1,  s,-s, s,0,0,1,  s, s, s,0,0,1, -s,-s, s,0,0,1,  s, s, s,0,0,1, -s, s, s,0,0,1,
     s,-s,-s,0,0,-1,-s,-s,-s,0,0,-1,-s, s,-s,0,0,-1,  s,-s,-s,0,0,-1,-s, s,-s,0,0,-1,  s, s,-s,0,0,-1,
    -s,-s,-s,-1,0,0,-s,-s, s,-1,0,0,-s, s, s,-1,0,0,-s,-s,-s,-1,0,0,-s, s, s,-1,0,0,-s, s,-s,-1,0,0,
     s,-s, s,1,0,0,  s,-s,-s,1,0,0,  s, s,-s,1,0,0,  s,-s, s,1,0,0,  s, s,-s,1,0,0,  s, s, s,1,0,0,
    -s, s, s,0,1,0,  s, s, s,0,1,0,  s, s,-s,0,1,0, -s, s, s,0,1,0,  s, s,-s,0,1,0, -s, s,-s,0,1,0,
    -s,-s,-s,0,-1,0, s,-s,-s,0,-1,0, s,-s, s,0,-1,0,-s,-s,-s,0,-1,0, s,-s, s,0,-1,0,-s,-s, s,0,-1,0,
  ];
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
  return { buf, count: 36 };
}

function resizeCanvas(gl, effCtx) {
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.floor(window.innerWidth * pr));
  const h = Math.max(1, Math.floor(window.innerHeight * pr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h);
    effCtx?.setProjectionPerspective(45, w / h, 1, 1000);
  }
}

function main() {
  const gl = canvas.getContext("webgl2");
  if (!gl) { setStatus("WebGL 2.0 is not supported in this browser.", true); return; }

  const gridProg = createProgram(gl, GRID_VS, GRID_FS);
  const cubeProg = createProgram(gl, CUBE_VS, CUBE_FS);
  const grid = buildGrid(gl);
  const cube = buildCube(gl);
  const EYE = [20, 20, 20];

  effekseer.initRuntime("../../effekseer/effekseer-webgl.wasm", () => {
    const context = effekseer.createContext();
    context.init(gl); context.setRestorationOfStatesFlag(true);
    resizeCanvas(gl, context);
    context.setCameraLookAt(...EYE, 0, 0, 0, 0, 1, 0);

    const effect = context.loadEffect(
      "../../effekseer/Resources/block.efk", 1.0,
      () => {
        setStatus("Ready");
        const params = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };
        const gui = new GUI({ title: "Effect" });
        const posF = gui.addFolder("Position");
        posF.add(params.position, "x", -10, 10, 0.1); posF.add(params.position, "y", -10, 10, 0.1); posF.add(params.position, "z", -10, 10, 0.1);
        const rotF = gui.addFolder("Rotation");
        rotF.add(params.rotation, "x", -180, 180, 1).name("x (deg)");
        rotF.add(params.rotation, "y", -180, 180, 1).name("y (deg)");
        rotF.add(params.rotation, "z", -180, 180, 1).name("z (deg)");
        gui.add({ play: () => {
          const audioCtx = window.AL?.currentCtx?.audioCtx ?? window.AL?.currentCtx?.ctx;
          if (audioCtx?.state !== "running") audioCtx?.resume();
          const handle = context.play(effect, params.position.x, params.position.y, params.position.z);
          const D2R = Math.PI / 180; context.setRotation(handle, params.rotation.x * D2R, params.rotation.y * D2R, params.rotation.z * D2R);
        }}, "play").name("▶ Play Effect");
      },
      (message, url) => { setStatus(`Failed to load effect: ${message} (${url})`, true); }
    );

    let t = 0;
    function render() {
      requestAnimationFrame(render);
      t += 0.01;
      const proj = matPerspective(45, canvas.width / canvas.height, 1, 1000);
      const view = matLookAt(...EYE, 0, 0, 0);
      const model = matRotYTranslate(t, 0, 1, 0);
      gl.clearColor(0.082, 0.098, 0.122, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      gl.useProgram(gridProg);
      gl.uniformMatrix4fv(gl.getUniformLocation(gridProg, "uProj"), false, proj);
      gl.uniformMatrix4fv(gl.getUniformLocation(gridProg, "uView"), false, view);
      gl.bindBuffer(gl.ARRAY_BUFFER, grid.buf);
      const aGP = gl.getAttribLocation(gridProg, "aPos"); gl.enableVertexAttribArray(aGP); gl.vertexAttribPointer(aGP, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.LINES, 0, grid.count);
      gl.useProgram(cubeProg);
      gl.uniformMatrix4fv(gl.getUniformLocation(cubeProg, "uProj"), false, proj);
      gl.uniformMatrix4fv(gl.getUniformLocation(cubeProg, "uView"), false, view);
      gl.uniformMatrix4fv(gl.getUniformLocation(cubeProg, "uModel"), false, model);
      gl.bindBuffer(gl.ARRAY_BUFFER, cube.buf);
      const aCP = gl.getAttribLocation(cubeProg, "aPos"); const aCN = gl.getAttribLocation(cubeProg, "aNorm");
      gl.enableVertexAttribArray(aCP); gl.enableVertexAttribArray(aCN);
      gl.vertexAttribPointer(aCP, 3, gl.FLOAT, false, 24, 0); gl.vertexAttribPointer(aCN, 3, gl.FLOAT, false, 24, 12);
      gl.drawArrays(gl.TRIANGLES, 0, cube.count);
      context.update(1); context.draw();
    }
    render();
  }, () => { setStatus("Failed to initialize Effekseer runtime.", true); });

  window.addEventListener("resize", () => resizeCanvas(gl, null));
}

window.addEventListener("DOMContentLoaded", main, false);
