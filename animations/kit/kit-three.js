/*
 * Qdigo motion kit: the Three.js sky layer (ES module). Load it last in a composition:
 *
 *   <script type="module" src="../../kit/kit-three.js"></script>
 *
 * Draws the shared background in WebGL: the navy → indigo gradient (dithered, no banding) and slow drifting
 * specks at three depths. It follows the camera that HF.camera() moves, with parallax (far specks move less),
 * so a 5% push feels like depth. Every frame is a pure function of timeline time (HyperFrames `hf-seek`, plus
 * the kit's timeline updates during live playback), so seeking and rendering to video are deterministic.
 * Without WebGL it removes itself and the CSS gradient on #stage shows instead.
 */
import * as THREE from './vendor/three.module.min.js';

const W = 1280, H = 720;
const stage = document.getElementById('stage');
const HF = window.HF;

function build() {
  // colors below are display (sRGB) values written straight to the screen
  THREE.ColorManagement.enabled = false;
  const canvas = document.createElement('canvas');
  canvas.className = 'hf-sky';
  canvas.width = W;
  canvas.height = H;
  stage.prepend(canvas);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  } catch {
    canvas.remove();
    return null;
  }
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setSize(W, H, false);
  const scene = new THREE.Scene();
  const camera = new THREE.Camera(); // shaders write clip space directly

  // ---- gradient backdrop (full-screen triangle)
  const bgGeo = new THREE.BufferGeometry();
  bgGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const bg = new THREE.Mesh(bgGeo, new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: { uTop: { value: new THREE.Color('#0B1D3A') }, uBottom: { value: new THREE.Color('#1B2B5E') } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop; uniform vec3 uBottom; varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        // a plain vertical gradient: radial glows band into visible rings once the clip is encoded to 8-bit video
        vec3 c = mix(uBottom, uTop, vUv.y);
        c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;          // dither against banding
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  bg.frustumCulled = false;
  scene.add(bg);

  // ---- specks (seeded, three depth bands)
  const rand = HF.rng(20261019);
  const N = 240;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N), depth = new Float32Array(N), size = new Float32Array(N), speed = new Float32Array(N), tint = new Float32Array(N * 3);
  const tints = [[0.957, 0.945, 0.871], [0.957, 0.945, 0.871], [0.957, 0.945, 0.871], [0.18, 0.77, 0.71], [1.0, 0.79, 0.29]];
  for (let i = 0; i < N; i++) {
    const d = i < N * 0.55 ? 0.15 + rand() * 0.25 : i < N * 0.85 ? 0.45 + rand() * 0.25 : 0.8 + rand() * 0.2;
    pos[i * 3] = rand() * (W + 80) - 40;
    pos[i * 3 + 1] = rand() * H;
    seed[i] = rand();
    depth[i] = d;
    size[i] = 1.5 + d * 4.5 + rand() * 1.5;
    speed[i] = (3 + d * 10) * (rand() < 0.5 ? 1 : 0.6);
    const tc = tints[Math.floor(rand() * tints.length)];
    tint.set(tc, i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
  const uniforms = { uTime: { value: 0 }, uZoom: { value: 1 }, uPan: { value: new THREE.Vector2(0, 0) } };
  const specks = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uZoom; uniform vec2 uPan;
      attribute float aSeed; attribute float aDepth; attribute float aSize; attribute float aSpeed; attribute vec3 aTint;
      varying float vAlpha; varying vec3 vTint;
      const vec2 SIZE = vec2(${W}.0, ${H}.0);
      void main() {
        vec2 p = position.xy;
        p.x = mod(p.x + uTime * aSpeed + 40.0, SIZE.x + 80.0) - 40.0;          // slow drift, wraps around
        p.y += sin(uTime * 0.35 + aSeed * 6.2832) * 5.0 * aDepth;               // gentle float
        float k = mix(0.12, 0.75, aDepth);                                     // parallax: far specks follow the camera less
        vec2 c = SIZE * 0.5;
        p = (p - c) * (1.0 + (uZoom - 1.0) * k) + c + uPan * k;
        gl_Position = vec4(p.x / SIZE.x * 2.0 - 1.0, 1.0 - p.y / SIZE.y * 2.0, 0.0, 1.0);
        float tw = 0.75 + 0.25 * sin(uTime * (0.8 + aSeed * 1.6) + aSeed * 40.0);
        gl_PointSize = aSize * tw * (1.0 + (uZoom - 1.0) * k);
        vAlpha = (0.18 + 0.5 * aDepth) * tw;
        vTint = aTint;
      }`,
    fragmentShader: /* glsl */ `
      varying float vAlpha; varying vec3 vTint;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vTint * a * vAlpha, 1.0);
      }`,
  }));
  specks.frustumCulled = false;
  scene.add(specks);

  const worldEl = () => stage.querySelector('.hf-world');
  let last = -1, lastCam = '';
  function render(t) {
    const w = worldEl();
    const z = w ? Number(gsap.getProperty(w, 'scale')) || 1 : 1;
    const px = w ? Number(gsap.getProperty(w, 'x')) || 0 : 0;
    const py = w ? Number(gsap.getProperty(w, 'y')) || 0 : 0;
    const cam = `${z},${px},${py}`;
    if (t === last && cam === lastCam) return;
    last = t; lastCam = cam;
    uniforms.uTime.value = t;
    uniforms.uZoom.value = z;
    uniforms.uPan.value.set(px, py);
    renderer.render(scene, camera);
  }
  return render;
}

const render = build();
if (render) {
  HF.every(render);
  window.addEventListener('hf-seek', (e) => render(Number(e.detail?.time) || 0));
  const tl = Object.values(window.__timelines || {})[0];
  render(tl ? tl.time() : 0);
}
HF.skyReady?.();
