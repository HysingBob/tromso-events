'use strict';

/* ────────────────────────────────────────────────────────────────────────
 * Tromsø drone POC — fly the orb over the island.
 *   • One finger: TAP = jump (glide so the point centres), HOLD = fly (joystick
 *     pan, speed grows with distance from the dot). Land on a sticker → card.
 *   • Two fingers: PINCH = zoom, centred on the orb. Desktop: mouse wheel.
 *
 * One continuously-zoomable world. The base island map is the backdrop and may
 * pixelate when over-zoomed (fine — it's just for manoeuvring). A high-res patch
 * over the city centre holds hidden 0.2 m/px detail that stays crisp when you
 * zoom in there. Stickers are screen-space markers, always crisp.
 *
 * Universal coordinate: geo metres (= base art-pixels, 1 m = 1 art-px).
 * z = screen-pixels per metre (the zoom level).
 * ──────────────────────────────────────────────────────────────────────── */

// ── Base map (metres) ───────────────────────────────────────────────────────
const MAP_W = 5040, MAP_H = 11040;

// ── High-res detail patch over the city-centre zone ─────────────────────────
const ZONE = { x0: 2880, y0: 7200, x1: 3840, y1: 8880 };  // geo metres
const PATCH_SRC = 'assets/zoom.png';                       // 4800×8400 @ 0.2 m/px
const PATCH_W = ZONE.x1 - ZONE.x0, PATCH_H = ZONE.y1 - ZONE.y0;  // 960×1680 m
const PATCH_SHOW_Z = 1.1;        // reveal the (already-decoded) patch once base softens
const PATCH_LOAD_MARGIN = 150;   // preload + decode the patch when the orb nears the zone
const PATCH_DROP_MARGIN = 600;   // free it once the orb moves well clear of the zone

// ── Zoom (z = screen-px per metre) ──────────────────────────────────────────
// Z_MIN low enough to pull the whole 11 km-tall island into view, sitting in the
// open sea of the page background (same colour as the map's sea → seamless).
const Z_MIN = 0.04, Z_MAX = 6, Z_INIT = 0.5;   // 0.5 ≈ the original overview
const WHEEL_STEP = 1.0015;                      // desktop wheel zoom per deltaY

// Stickers are anchored to a size on the MAP (metres), so they scale with zoom —
// zoom in to see one bigger. Each sticker's `map_width_m` (data/stickers.json)
// sets its width in metres; height follows the image's aspect.
const DEFAULT_STICKER_W_M = 40;

// ── Initial centre (geo metres): Prestvannet ────────────────────────────────
const INITIAL_CENTER = { x: 2280, y: 7079 };

// glide (tap-jump) + fly (hold) tuning — screen-space, converted to metres by ÷z
const GLIDE_MIN_S = 0.4, GLIDE_MAX_S = 1.5, GLIDE_SPEED = 1200;
const HOLD_DELAY_MS = 180, TAP_MOVE_PX = 12;
const DRIVE_DEAD_PX = 14, DRIVE_GAIN = 3.0, DRIVE_MAX = 1500;

const DEBUG = new URLSearchParams(location.search).has('debug');

// ── DOM ─────────────────────────────────────────────────────────────────────
const viewport  = document.getElementById('viewport');
const world     = document.getElementById('world');
const mapImg    = document.getElementById('map');
const patchImg  = document.getElementById('zoom-patch');
const markers   = document.getElementById('markers');
const dbg        = document.getElementById('debug');
const backdrop  = document.getElementById('card-backdrop');
const cardTitle = document.getElementById('card-title');
const cardBody  = document.getElementById('card-body');

// ── State ───────────────────────────────────────────────────────────────────
let camGeo = { x: INITIAL_CENTER.x, y: INITIAL_CENTER.y };  // orb position, metres
let z = Z_INIT;                 // zoom (screen-px per metre)
let anim = null;                // active tap-glide
let stickers = [];
let cardOpen = false;
let patchLoaded = false;

let gesture = null;             // single-finger fly/tap
let driveRaf = 0;
const pointers = new Map();     // active pointerId → {x,y}
let pinch = null;               // { d0, z0 } while two fingers are down
let pinchTail = false;          // ignore a lone finger left over after a pinch

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const viewSize = () => ({ w: viewport.clientWidth, h: viewport.clientHeight });

// Keep the ORB anywhere on the map (not the whole viewport) so it can reach
// every corner; near an edge you just see open sea beyond — same colour, seamless.
function clampGeo(gx, gy) {
  return { x: clamp(gx, 0, MAP_W), y: clamp(gy, 0, MAP_H) };
}
function screenToGeo(sx, sy) {
  const v = viewSize();
  return { x: camGeo.x + (sx - v.w / 2) / z, y: camGeo.y + (sy - v.h / 2) / z };
}

// ── Render ──────────────────────────────────────────────────────────────────
function nearZone(m) {
  return camGeo.x >= ZONE.x0 - m && camGeo.x <= ZONE.x1 + m
      && camGeo.y >= ZONE.y0 - m && camGeo.y <= ZONE.y1 + m;
}
function updateLayers() {
  // Load + decode as soon as the orb nears the zone (any zoom), so the detail is
  // ready the instant you zoom in. Free it again once the orb is well clear.
  if (!patchLoaded && nearZone(PATCH_LOAD_MARGIN)) {
    patchImg.src = PATCH_SRC;
    patchLoaded = true;
    if (patchImg.decode) patchImg.decode().catch(() => {});   // force decode while hidden
  } else if (patchLoaded && !nearZone(PATCH_DROP_MARGIN)) {
    patchImg.removeAttribute('src');
    patchLoaded = false;
  }
  // Show the (already-decoded) patch only once zoomed in enough.
  const show = patchLoaded && z >= PATCH_SHOW_Z;
  patchImg.style.display = show ? 'block' : 'none';
  if (show) patchImg.style.opacity = String(clamp((z - PATCH_SHOW_Z) / 0.6, 0, 1));
}

function render() {
  const v = viewSize();
  const tx = v.w / 2 - camGeo.x * z, ty = v.h / 2 - camGeo.y * z;
  world.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`;
  // Stickers are map-anchored: size in metres × z, reprojected each frame.
  for (const s of stickers) {
    const w = s.mw * z, h = s.mh * z;
    const sx = v.w / 2 + (s.x - camGeo.x) * z;
    const sy = v.h / 2 + (s.y - camGeo.y) * z;
    s.el.style.width = w + 'px';
    s.el.style.height = h + 'px';
    s.el.style.left = (sx - w / 2) + 'px';
    s.el.style.top  = (sy - h / 2) + 'px';
  }
  updateLayers();   // load/show the detail patch based on position + zoom, every frame
  if (DEBUG) dbg.textContent = `z ${z.toFixed(2)} · art ${Math.round(camGeo.x)}, ${Math.round(camGeo.y)}`;
}

function setZoom(nz) {
  z = clamp(nz, Z_MIN, Z_MAX);
  camGeo = clampGeo(camGeo.x, camGeo.y);
  render();
}

// ── Hit-testing ──────────────────────────────────────────────────────────────
// Sticker boxes are fixed screen size, so their half-extent in metres is
// (nativePx/2)/z — you must land more precisely the further you've zoomed in.
function hitTest() {
  for (const s of stickers) {
    if (Math.abs(camGeo.x - s.x) <= s.mw / 2 && Math.abs(camGeo.y - s.y) <= s.mh / 2) { openCard(s); return; }
  }
}

// ── Tap-jump glide ───────────────────────────────────────────────────────────
function glideTo(target) {
  if (anim) cancelAnimationFrame(anim.raf);
  const start = { x: camGeo.x, y: camGeo.y };
  const dest = clampGeo(target.x, target.y);
  const dScreen = Math.hypot(dest.x - start.x, dest.y - start.y) * z;
  const dur = clamp(dScreen / GLIDE_SPEED, GLIDE_MIN_S, GLIDE_MAX_S) * 1000;
  if (dScreen < 0.5) { anim = null; hitTest(); return; }

  let t0 = null;
  const step = (ts) => {
    if (t0 === null) t0 = ts;
    const p = Math.min(1, (ts - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    camGeo.x = start.x + (dest.x - start.x) * e;
    camGeo.y = start.y + (dest.y - start.y) * e;
    render();
    if (p < 1) anim.raf = requestAnimationFrame(step);
    else { anim = null; hitTest(); }
  };
  anim = { raf: requestAnimationFrame(step) };
}

// ── Card ─────────────────────────────────────────────────────────────────────
function openCard(s) {
  cardTitle.textContent = s.title;
  cardBody.textContent = s.body;
  backdrop.hidden = false;
  void backdrop.offsetWidth;
  backdrop.classList.add('open');
  cardOpen = true;
}
function closeCard() {
  backdrop.classList.remove('open');
  cardOpen = false;
  setTimeout(() => { if (!cardOpen) backdrop.hidden = true; }, 300);
}

// ── Single-finger fly / tap ──────────────────────────────────────────────────
function tapJump(sx, sy) { glideTo(screenToGeo(sx, sy)); }

let driveLastTs = 0;
function driveStep(ts) {
  if (!gesture || !gesture.driving) { driveRaf = 0; return; }
  const dt = driveLastTs ? Math.min((ts - driveLastTs) / 1000, 0.05) : 0;
  driveLastTs = ts;
  const v = viewSize();
  const ox = gesture.curX - v.w / 2, oy = gesture.curY - v.h / 2;
  const dist = Math.hypot(ox, oy);
  if (dist > DRIVE_DEAD_PX) {
    const speed = Math.min((dist - DRIVE_DEAD_PX) * DRIVE_GAIN, DRIVE_MAX);  // screen px/s
    camGeo = clampGeo(camGeo.x + (ox / dist) * speed * dt / z,
                      camGeo.y + (oy / dist) * speed * dt / z);
    render();
  }
  driveRaf = requestAnimationFrame(driveStep);
}
function startDriving() {
  if (!gesture || gesture.driving) return;
  if (anim) { cancelAnimationFrame(anim.raf); anim = null; }
  gesture.driving = true;
  driveLastTs = 0;
  if (!driveRaf) driveRaf = requestAnimationFrame(driveStep);
}
function cancelGesture() {
  if (gesture) { clearTimeout(gesture.holdTimer); gesture = null; }
  if (driveRaf) { cancelAnimationFrame(driveRaf); driveRaf = 0; }
}
function endGesture(isTap, sx, sy) {
  if (!gesture) return;
  const wasDriving = gesture.driving;
  cancelGesture();
  if (isTap && !wasDriving) tapJump(sx, sy);
  else if (wasDriving) hitTest();
}

// ── Pointer / pinch plumbing ─────────────────────────────────────────────────
function pinchDist() {
  const p = [...pointers.values()];
  return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
}

viewport.addEventListener('pointerdown', (e) => {
  if (cardOpen) return;
  e.preventDefault();
  try { viewport.setPointerCapture(e.pointerId); } catch (_) { /* keep going */ }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 2) {                       // second finger → pinch
    cancelGesture();
    if (anim) { cancelAnimationFrame(anim.raf); anim = null; }
    pinch = { d0: pinchDist(), z0: z };
    pinchTail = false;
  } else if (pointers.size === 1 && !pinchTail) {  // first finger → fly/tap
    gesture = {
      id: e.pointerId, downX: e.clientX, downY: e.clientY,
      curX: e.clientX, curY: e.clientY, driving: false,
      holdTimer: setTimeout(startDriving, HOLD_DELAY_MS),
    };
  }
});

viewport.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (p) { p.x = e.clientX; p.y = e.clientY; }

  if (pinch && pointers.size >= 2) { setZoom(pinch.z0 * pinchDist() / pinch.d0); return; }

  if (gesture && e.pointerId === gesture.id) {
    gesture.curX = e.clientX; gesture.curY = e.clientY;
    if (!gesture.driving &&
        Math.hypot(e.clientX - gesture.downX, e.clientY - gesture.downY) > TAP_MOVE_PX) {
      startDriving();
    }
  }
});

function onPointerEnd(e) {
  pointers.delete(e.pointerId);
  if (pinch) {                                     // a finger lifted during pinch
    if (pointers.size < 2) { pinch = null; pinchTail = pointers.size === 1; }
    if (pointers.size === 0) pinchTail = false;
    return;
  }
  if (gesture && e.pointerId === gesture.id) {
    const moved = Math.hypot(e.clientX - gesture.downX, e.clientY - gesture.downY);
    endGesture(moved <= TAP_MOVE_PX, e.clientX, e.clientY);
  }
  if (pointers.size === 0) pinchTail = false;
}
viewport.addEventListener('pointerup', onPointerEnd);
viewport.addEventListener('pointercancel', onPointerEnd);

// Desktop: wheel zooms around the orb.
viewport.addEventListener('wheel', (e) => {
  if (cardOpen) return;
  e.preventDefault();
  setZoom(z * Math.pow(WHEEL_STEP, -e.deltaY));
}, { passive: false });

document.getElementById('card-close').addEventListener('click', closeCard);
backdrop.addEventListener('pointerdown', (e) => { if (e.target === backdrop) closeCard(); });
window.addEventListener('resize', () => { camGeo = clampGeo(camGeo.x, camGeo.y); render(); });

// ── Boot ─────────────────────────────────────────────────────────────────────
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

async function init() {
  mapImg.src = 'assets/map.png';
  mapImg.style.width = MAP_W + 'px';
  mapImg.style.height = MAP_H + 'px';
  patchImg.style.left = ZONE.x0 + 'px';  patchImg.style.top = ZONE.y0 + 'px';
  patchImg.style.width = PATCH_W + 'px'; patchImg.style.height = PATCH_H + 'px';

  if (DEBUG) dbg.hidden = false;

  let defs = [];
  try { defs = await (await fetch('data/stickers.json')).json(); }
  catch (err) { console.warn('stickers.json not loaded (serve the folder).', err); }
  for (const d of defs) {
    let img;
    try { img = await loadImage('assets/' + d.sprite); }
    catch (err) { console.warn(err.message); continue; }
    img.className = 'sticker';
    img.alt = d.title;
    img.draggable = false;
    const mw = (Number.isFinite(d.map_width_m) && d.map_width_m > 0) ? d.map_width_m : DEFAULT_STICKER_W_M;
    const mh = mw * (img.naturalHeight / img.naturalWidth);   // metres, from image aspect
    markers.appendChild(img);
    stickers.push({ id: d.id, x: d.x, y: d.y, mw, mh,
                    title: d.title, body: d.body, el: img });
  }

  // ?at=mx,my and ?z=level — debug/preview overrides.
  const params = new URLSearchParams(location.search);
  let centre = INITIAL_CENTER;
  const at = params.get('at');
  if (at) {
    const [mx, my] = at.split(',').map(Number);
    if (Number.isFinite(mx) && Number.isFinite(my)) centre = { x: mx, y: my };
  }
  const zp = Number(params.get('z'));
  if (Number.isFinite(zp) && zp > 0) z = clamp(zp, Z_MIN, Z_MAX);

  camGeo = clampGeo(centre.x, centre.y);
  render();
}

init();
