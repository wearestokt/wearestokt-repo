/**
 * Fog Reveal — WebGL 2 cursor-driven fog dispersion
 * Drawing (fog layer) on top, color city (revealed) underneath.
 */

const VERTEX_SHADER = `#version 300 es
in vec4 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position.xy * 0.5 + 0.5;
  gl_Position = a_position;
}
`;

const MASK_ADD_CURSOR_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_mask;
uniform vec2 u_mouse;
uniform float u_revealRadius;
uniform float u_revealSoftness;
uniform float u_addAmount;
uniform float u_velocityFactor;
void main() {
  float prev = texture(u_mask, v_uv).r;
  float d = distance(v_uv, u_mouse);
  float reveal = 1.0 - smoothstep(u_revealRadius - u_revealSoftness, u_revealRadius + u_revealSoftness, d);
  float next = min(1.0, prev + reveal * u_addAmount * u_velocityFactor);
  outColor = vec4(next, 0.0, 0.0, 1.0);
}
`;

const MASK_BLUR_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_mask;
uniform vec2 u_texelSize;
uniform float u_decay;
uniform float u_dispersion;
void main() {
  float sum = 0.0;
  float total = 0.0;
  float r = u_dispersion;
  for (float y = -3.0; y <= 3.0; y += 1.0) {
    for (float x = -3.0; x <= 3.0; x += 1.0) {
      vec2 offset = vec2(x, y) * u_texelSize * r;
      float w = exp(-dot(offset, offset) / (2.0 * r * r));
      sum += texture(u_mask, v_uv + offset).r * w;
      total += w;
    }
  }
  sum = sum / total * u_decay;
  outColor = vec4(clamp(sum, 0.0, 1.0), 0.0, 0.0, 1.0);
}
`;

const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_drawing;
uniform sampler2D u_colorCity;
uniform sampler2D u_mask;
uniform float u_time;
uniform float u_fluidity;
uniform float u_mistStrength;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float swirlNoise(vec2 uv) {
  float t = u_time * u_fluidity;
  vec2 q = uv + vec2(noise(uv * 3.0 + t * 0.5) * 0.1, noise(uv * 3.0 + t * 0.5 + 100.0) * 0.1);
  return noise(q * 4.0 + vec2(t, t * 0.7));
}
void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec4 drawing = texture(u_drawing, uv);
  vec4 colorCity = texture(u_colorCity, uv);
  float mask = texture(u_mask, v_uv).r;
  float swirl = swirlNoise(v_uv);
  vec2 mistOffset = vec2(swirl - 0.5, swirlNoise(v_uv + 50.0) - 0.5) * u_mistStrength * 0.02;
  vec4 mistDrawing = texture(u_drawing, uv + mistOffset);
  float mistAlpha = 0.7 + swirl * u_mistStrength * 0.2;
  vec4 mist = vec4(mistDrawing.rgb, mistDrawing.a * mistAlpha);
  float fogAmount = (1.0 - mask) * mistAlpha;
  outColor = mix(colorCity, mist, fogAmount);
}
`;

function createProgram(gl, vsSource, fsSource) {
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vsSource);
  gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    console.error("VS:", gl.getShaderInfoLog(vs));
    gl.deleteShader(vs);
    return null;
  }
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fsSource);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error("FS:", gl.getShaderInfoLog(fs));
    gl.deleteShader(fs);
    gl.deleteShader(vs);
    return null;
  }
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Link:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

function createQuadBuffer(gl) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );
  return buffer;
}

function createFramebuffer(gl, width, height) {
  const fb = gl.createFramebuffer();
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fb, tex };
}

export function createFogReveal(canvas, options = {}) {
  const opts = {
    revealRadius: options.revealRadius ?? 0.08,
    revealSoftness: options.revealSoftness ?? 0.03,
    dispersion: options.dispersion ?? 2,
    decay: options.decay ?? 0.98,
    addAmount: options.addAmount ?? 0.15,
    fluidity: options.fluidity ?? 0.5,
    dissipation: options.dissipation ?? 0.96,
    tail: options.tail ?? 1,
    mistStrength: options.mistStrength ?? 0.6,
    minVelocity: options.minVelocity ?? 0.002,
    maxVelocity: options.maxVelocity ?? 0.15,
  };

  const gl = canvas.getContext("webgl2");
  if (!gl) {
    throw new Error("WebGL 2 not supported");
  }

  const quadBuffer = createQuadBuffer(gl);

  const addCursorProgram = createProgram(gl, VERTEX_SHADER, MASK_ADD_CURSOR_FRAGMENT);
  const blurProgram = createProgram(gl, VERTEX_SHADER, MASK_BLUR_FRAGMENT);
  const compositeProgram = createProgram(gl, VERTEX_SHADER, COMPOSITE_FRAGMENT);

  let maskA = null;
  let maskB = null;
  let drawingTexture = null;
  let colorCityTexture = null;
  let mouse = { x: 0.5, y: 0.5 };
  let lastMouse = { x: 0.5, y: 0.5 };
  let prevMouse = { x: 0.5, y: 0.5 };
  let velocity = 0;
  let velocitySmooth = 0;
  let lastTime = performance.now() / 1000;
  let hasMoved = false;
  let drawingImg = null;
  let colorCityImg = null;

  function setDrawing(img) {
    drawingImg = img;
    if (drawingTexture && img) uploadTexture(gl, drawingTexture, img);
  }
  function setColorCity(img) {
    colorCityImg = img;
    if (colorCityTexture && img) uploadTexture(gl, colorCityTexture, img);
  }

  function uploadTexture(gl, tex, img) {
    if (!img) return;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);

      if (maskA) gl.deleteTexture(maskA.tex);
      if (maskB) gl.deleteTexture(maskB.tex);
      if (maskA) gl.deleteFramebuffer(maskA.fb);
      if (maskB) gl.deleteFramebuffer(maskB.fb);

      maskA = createFramebuffer(gl, w, h);
      maskB = createFramebuffer(gl, w, h);
      clearMask(maskA.fb);
      clearMask(maskB.fb);

      if (!drawingTexture) drawingTexture = gl.createTexture();
      if (!colorCityTexture) colorCityTexture = gl.createTexture();
      if (drawingImg) uploadTexture(gl, drawingTexture, drawingImg);
      if (colorCityImg) uploadTexture(gl, colorCityTexture, colorCityImg);
    }
  }

  function drawFullscreenQuad(program) {
    gl.useProgram(program);
    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function clearMask(fb) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function render() {
    resize();
    if (!maskA || !maskB) return;

    const w = canvas.width;
    const h = canvas.height;
    const texelSize = [1 / w, 1 / h];

    const now = performance.now() / 1000;
    const dt = Math.min(Math.max(now - lastTime, 0.001), 0.1);
    lastTime = now;

    if (!hasMoved) {
      prevMouse.x = mouse.x;
      prevMouse.y = mouse.y;
      hasMoved = true;
    }
    velocity = Math.hypot(mouse.x - prevMouse.x, mouse.y - prevMouse.y) / dt;
    velocitySmooth += (velocity - velocitySmooth) * 0.2;
    prevMouse.x = mouse.x;
    prevMouse.y = mouse.y;

    const velNorm = Math.min(1, Math.max(0, (velocitySmooth - opts.minVelocity) / (opts.maxVelocity - opts.minVelocity)));
    const velocityFactor = velNorm * opts.tail;
    const radiusScale = 0.5 + velNorm * 1.5;

    lastMouse.x += (mouse.x - lastMouse.x) * 0.2;
    lastMouse.y += (mouse.y - lastMouse.y) * 0.2;

    gl.bindFramebuffer(gl.FRAMEBUFFER, maskB.fb);
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, maskA.tex);
    gl.useProgram(addCursorProgram);
    gl.uniform1i(gl.getUniformLocation(addCursorProgram, "u_mask"), 0);
    gl.uniform2f(gl.getUniformLocation(addCursorProgram, "u_mouse"), lastMouse.x, 1 - lastMouse.y);
    gl.uniform1f(gl.getUniformLocation(addCursorProgram, "u_revealRadius"), opts.revealRadius * radiusScale);
    gl.uniform1f(gl.getUniformLocation(addCursorProgram, "u_revealSoftness"), opts.revealSoftness);
    gl.uniform1f(gl.getUniformLocation(addCursorProgram, "u_addAmount"), opts.addAmount);
    gl.uniform1f(gl.getUniformLocation(addCursorProgram, "u_velocityFactor"), velocityFactor);
    drawFullscreenQuad(addCursorProgram);

    gl.bindFramebuffer(gl.FRAMEBUFFER, maskA.fb);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, maskB.tex);
    gl.useProgram(blurProgram);
    gl.uniform1i(gl.getUniformLocation(blurProgram, "u_mask"), 0);
    gl.uniform2fv(gl.getUniformLocation(blurProgram, "u_texelSize"), texelSize);
    gl.uniform1f(gl.getUniformLocation(blurProgram, "u_decay"), opts.dissipation);
    gl.uniform1f(gl.getUniformLocation(blurProgram, "u_dispersion"), opts.dispersion * (1 + opts.fluidity));
    drawFullscreenQuad(blurProgram);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0.2, 0.2, 0.2, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (drawingTexture && colorCityTexture && drawingImg && colorCityImg) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, drawingTexture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, colorCityTexture);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, maskA.tex);

      gl.useProgram(compositeProgram);
      gl.uniform1i(gl.getUniformLocation(compositeProgram, "u_drawing"), 0);
      gl.uniform1i(gl.getUniformLocation(compositeProgram, "u_colorCity"), 1);
      gl.uniform1i(gl.getUniformLocation(compositeProgram, "u_mask"), 2);
      gl.uniform1f(gl.getUniformLocation(compositeProgram, "u_time"), lastTime);
      gl.uniform1f(gl.getUniformLocation(compositeProgram, "u_fluidity"), opts.fluidity);
      gl.uniform1f(gl.getUniformLocation(compositeProgram, "u_mistStrength"), opts.mistStrength);
      drawFullscreenQuad(compositeProgram);
    } else {
      gl.clearColor(0.15, 0.15, 0.2, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

  }

  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) / rect.width;
    mouse.y = (e.clientY - rect.top) / rect.height;
  }

  function onPointerLeave() {
    hasMoved = false;
  }

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerenter", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);

  let rafId;
  function loop() {
    render();
    rafId = requestAnimationFrame(loop);
  }
  loop();

  return {
    setDrawing,
    setColorCity,
    opts,
    destroy() {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerenter", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    },
  };
}
