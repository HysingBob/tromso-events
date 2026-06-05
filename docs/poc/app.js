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
// The metre-space is the old-map art-pixel space (1 m = 1 art-px); sticker
// coords in data/stickers.json live here, so it's preserved across the swap.
const MAP_W = 5040, MAP_H = 11040;

// ── Tile pyramid (the backdrop) ──────────────────────────────────────────────
// A 256px JPEG pyramid in assets/tiles/ (built by build_pyramid.py) replaces the
// old single map.png AND the old city-centre zoom.png patch: full-res detail is
// now available everywhere and the right level is picked per zoom. See the tile
// manager below.
// Cache-bust tag for the JSON data/manifest fetches. Bump on every deploy that
// changes data so phones (which cache data/*.json ~10 min) fetch fresh. Keep in
// step with the ?v= on the CSS/JS links in index.html.
const BUILD = '15';

const TILES_BASE = 'assets/tiles';
const TILE_MARGIN = 384;          // metres of pre-load beyond the viewport edges
const BASE_LEVEL = 2;             // cheap coarse levels (≤2, ~38 tiles) kept as a
                                  // permanent underlay so nothing flashes blank
let pyramid = null;               // manifest: {tile, levels:[{i,mpp,w,h,cols,rows}]}
const tileCache = new Map();      // "i/c/r" -> <img>

// ── Zoom (z = screen-px per metre) ──────────────────────────────────────────
// Z_MIN low enough to pull the whole 11 km-tall island into view, sitting in the
// open sea of the page background (same colour as the map's sea → seamless).
const Z_MIN = 0.04, Z_MAX = 6, Z_INIT = 0.5;   // 0.5 ≈ the original overview
const WHEEL_STEP = 1.0015;                      // desktop wheel zoom per deltaY

// Stickers are anchored to a size on the MAP (metres), so they scale with zoom —
// zoom in to see one bigger. Each sticker's `map_width_m` (data/stickers.json)
// sets its width in metres; height follows the image's aspect.
const DEFAULT_STICKER_W_M = 40;

// Glow pools (dim-and-glow layer). Each glow gets BOTH a phase offset and a
// slightly different period, so neighbours never lock into the same breath
// (phase offset alone was too subtle to notice on a soft pulse). Colour/dim/
// amplitude live as CSS variables in style.css :root.
const GLOW_PHASE_STAGGER_S = 0.7;    // seconds between adjacent glows' start phase
const GLOW_PULSE_PERIOD_S = 3;       // base breathing period (matches --glow-pulse-period)
const GLOW_PERIOD_STAGGER_S = 0.5;   // each glow's period grows by this → distinct frequencies
const DEFAULT_GLOW_RADIUS_M = 90;    // fallback halo half-width if a glow omits radius_m

// ── Initial centre (geo metres): Prestvannet ────────────────────────────────
const INITIAL_CENTER = { x: 2280, y: 7079 };

// glide (tap-jump) + fly (hold) tuning — screen-space, converted to metres by ÷z
const GLIDE_MIN_S = 0.4, GLIDE_MAX_S = 1.5, GLIDE_SPEED = 1200;
const HOLD_DELAY_MS = 180, TAP_MOVE_PX = 12;
const DRIVE_DEAD_PX = 14, DRIVE_GAIN = 3.0, DRIVE_MAX = 1500;

const DEBUG = new URLSearchParams(location.search).has('debug');
// ?pick — coordinate-picker mode: tap the map to drop pins; a panel shows their
// coordinates as paste-ready glows.json. No effect on the normal viewer.
const PICK = new URLSearchParams(location.search).has('pick');

// ── DOM ─────────────────────────────────────────────────────────────────────
const viewport  = document.getElementById('viewport');
const world     = document.getElementById('world');
const tilesEl   = document.getElementById('tiles');
const markers   = document.getElementById('markers');
const glowsEl   = document.getElementById('glows');
const pinsEl    = document.getElementById('pins');
const dbg        = document.getElementById('debug');
const backdrop  = document.getElementById('card-backdrop');
const cardTitle = document.getElementById('card-title');
const cardBody  = document.getElementById('card-body');
const cardImg   = document.getElementById('card-img');

// ── State ───────────────────────────────────────────────────────────────────
let camGeo = { x: INITIAL_CENTER.x, y: INITIAL_CENTER.y };  // orb position, metres
let z = Z_INIT;                 // zoom (screen-px per metre)
let anim = null;                // active tap-glide
let stickers = [];
let glows = [];                 // dim-and-glow pools, map-anchored like stickers
let pins = [];                  // ?pick mode: dropped coordinate pins, map-anchored
let cardOpen = false;

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

// ── Tile pyramid manager ──────────────────────────────────────────────────────
// Pick the coarsest level that's still crisp at the current zoom: the largest
// mpp (metres per tile-pixel) that is ≤ 1/z (metres per screen-pixel). That
// keeps screen-px-per-source-px ≤ 1 (no upscaling blur) while loading the fewest
// tiles. Falls back to the finest level when zoomed past native.
function pickLevel() {
  const want = 1 / z;                       // metres per screen pixel
  const L = pyramid.levels;                 // sorted i↑ ⇒ mpp↓
  for (let k = 0; k < L.length; k++) if (L[k].mpp <= want) return L[k];
  return L[L.length - 1];
}

// Visible region in geo metres (viewport corners → geo), padded by the margin.
function visibleRect() {
  const v = viewSize();
  const a = screenToGeo(0, 0), b = screenToGeo(v.w, v.h);
  return { x0: Math.min(a.x, b.x) - TILE_MARGIN, y0: Math.min(a.y, b.y) - TILE_MARGIN,
           x1: Math.max(a.x, b.x) + TILE_MARGIN, y1: Math.max(a.y, b.y) + TILE_MARGIN };
}

// Metre-space bounds of tile (c,r) at level L (edge tiles are < one full tile).
function tileBounds(L, c, r) {
  const span = pyramid.tile * L.mpp;        // full-tile span in metres
  const pxw = Math.min(pyramid.tile, L.w - c * pyramid.tile);
  const pxh = Math.min(pyramid.tile, L.h - r * pyramid.tile);
  return { x: c * span, y: r * span, w: pxw * L.mpp, h: pxh * L.mpp };
}

function ensureTile(L, c, r) {
  const key = `${L.i}/${c}/${r}`;
  let el = tileCache.get(key);
  if (!el) {
    el = new Image();
    el.className = 'tile';
    el.alt = '';
    el.draggable = false;
    el.style.zIndex = String(L.i);          // finer levels paint over coarser
    el._rect = tileBounds(L, c, r);         // static; used for placement + culling
    el.src = `${TILES_BASE}/${L.i}/${c}_${r}.jpg`;
    tileCache.set(key, el);
    tilesEl.appendChild(el);
  }
  const b = el._rect;
  const bleed = L.mpp;                       // ~1 source-px overlap hides seams
  el.style.left = b.x + 'px';
  el.style.top = b.y + 'px';
  el.style.width = (b.w + bleed) + 'px';
  el.style.height = (b.h + bleed) + 'px';
}

function loadLevel(L, rect) {
  const span = pyramid.tile * L.mpp;
  const c0 = clamp(Math.floor(rect.x0 / span), 0, L.cols - 1);
  const c1 = clamp(Math.floor(rect.x1 / span), 0, L.cols - 1);
  const r0 = clamp(Math.floor(rect.y0 / span), 0, L.rows - 1);
  const r1 = clamp(Math.floor(rect.y1 / span), 0, L.rows - 1);
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) ensureTile(L, c, r);
}

function intersects(b, rect) {
  return b.x < rect.x1 && b.x + b.w > rect.x0 && b.y < rect.y1 && b.y + b.h > rect.y0;
}

// ── Render ──────────────────────────────────────────────────────────────────
function updateTiles() {
  if (!pyramid) return;
  const rect = visibleRect();
  // Cheap coarse underlay (always) + the chosen detail level on top. A loading
  // tile is transparent, so the underlay shows through until it paints — no
  // blank flash on zoom/pan; in-view tiles from the previous level also linger
  // beneath the new one during a transition.
  for (const L of pyramid.levels) if (L.i <= BASE_LEVEL) loadLevel(L, rect);
  loadLevel(pickLevel(), rect);
  // Cull anything scrolled out of view to keep the DOM/memory bounded.
  for (const [key, el] of tileCache) {
    if (!intersects(el._rect, rect)) { el.remove(); tileCache.delete(key); }
  }
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
  // Glow pools are map-anchored too: diameter = radius_m × 2 × z, centred on
  // the point. They scale with zoom, the same as map-anchored stickers.
  for (const g of glows) {
    const d = g.radius_m * 2 * z;
    const sx = v.w / 2 + (g.x - camGeo.x) * z;
    const sy = v.h / 2 + (g.y - camGeo.y) * z;
    g.el.style.width = d + 'px';
    g.el.style.height = d + 'px';
    g.el.style.left = (sx - d / 2) + 'px';
    g.el.style.top  = (sy - d / 2) + 'px';
  }
  // Picker pins are map-anchored points (fixed screen size, CSS-centred on the spot).
  for (const p of pins) {
    p.el.style.left = (v.w / 2 + (p.x - camGeo.x) * z) + 'px';
    p.el.style.top  = (v.h / 2 + (p.y - camGeo.y) * z) + 'px';
  }
  updateTiles();    // load/place/cull backdrop tiles for this position + zoom
  if (DEBUG) dbg.textContent = `z ${z.toFixed(2)} · art ${Math.round(camGeo.x)}, ${Math.round(camGeo.y)}`;
}

function setZoom(nz) {
  z = clamp(nz, Z_MIN, Z_MAX);
  camGeo = clampGeo(camGeo.x, camGeo.y);
  render();
}

// ── Hit-testing ──────────────────────────────────────────────────────────────
// Called when the drone settles (end of a tap-glide or a hold-drive). If it
// stopped over a point of interest, open that point's card.
function hitTest() {
  // Glows: a circular zone of radius_m metres around the centre — stop anywhere
  // in the pool and its card slides up. (Fixed geographic zone, zoom-independent.)
  // When pools overlap (e.g. neighbours in the centre), pick the NEAREST centre,
  // not just the first in the list — otherwise a closer glow can be shadowed.
  let best = null, bestD = Infinity;
  for (const g of glows) {
    const d = Math.hypot(camGeo.x - g.x, camGeo.y - g.y);
    if (d <= g.radius_m && d < bestD) { best = g; bestD = d; }
  }
  if (best) { openCard(best); return; }
  // Stickers (legacy; empty now): fixed screen-size boxes, metres = (px/2)/z.
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
  if (s.image) { cardImg.src = s.image; cardImg.alt = s.title; cardImg.hidden = false; }
  else { cardImg.hidden = true; cardImg.removeAttribute('src'); }
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
  if (isTap && !wasDriving) { if (PICK) placePin(sx, sy); else tapJump(sx, sy); }
  else if (wasDriving) hitTest();
}

// ── Coordinate picker (?pick) ─────────────────────────────────────────────────
// Tap drops a numbered pin at the tapped map coordinate; the panel shows all pins
// as paste-ready glows.json. Pan with hold-drag and zoom with pinch as usual.
function placePin(sx, sy) {
  const g = screenToGeo(sx, sy);
  const el = document.createElement('div');
  el.className = 'pin';
  el.textContent = String(pins.length + 1);
  pinsEl.appendChild(el);
  pins.push({ x: Math.round(g.x), y: Math.round(g.y), el });
  updatePickPanel();
  render();
}
function pinsJSON() {
  return JSON.stringify(pins.map(p => ({ x: p.x, y: p.y, radius_m: 90 })), null, 2);
}
function updatePickPanel() {
  const pre = document.getElementById('pickjson');
  if (pre) pre.textContent = pins.length ? pinsJSON() : '[]';
}
function selectPinsText() {
  const pre = document.getElementById('pickjson');
  const r = document.createRange();
  r.selectNodeContents(pre);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
}
function flashCopy(msg) {
  const b = document.getElementById('pick-copy');
  const old = b.dataset.label;
  b.textContent = msg;
  setTimeout(() => { b.textContent = old; }, 1200);
}
function copyPins() {
  const txt = pinsJSON();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(() => flashCopy('Copied!'), selectPinsText);
  } else {
    selectPinsText();
  }
}
function undoPin() {
  const p = pins.pop();
  if (p) p.el.remove();
  pins.forEach((q, i) => { q.el.textContent = String(i + 1); });
  updatePickPanel();
}
function clearPins() {
  for (const p of pins) p.el.remove();
  pins.length = 0;
  updatePickPanel();
}
function initPicker() {
  const panel = document.createElement('div');
  panel.id = 'pickpanel';
  panel.innerHTML =
    '<div class="hint">Tap the map to drop a pin (pan = hold-drag, zoom = pinch). ' +
    'Copy the list and send it — tell me which pin is which place.</div>' +
    '<pre id="pickjson">[]</pre>' +
    '<div class="row">' +
      '<button id="pick-copy" data-label="Copy">Copy</button>' +
      '<button id="pick-undo">Undo</button>' +
      '<button id="pick-clear">Clear</button>' +
    '</div>';
  document.body.appendChild(panel);
  document.getElementById('pick-copy').addEventListener('click', copyPins);
  document.getElementById('pick-undo').addEventListener('click', undoPin);
  document.getElementById('pick-clear').addEventListener('click', clearPins);
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
  try { pyramid = await (await fetch(`${TILES_BASE}/pyramid.json?v=${BUILD}`)).json(); }
  catch (err) { console.error('pyramid.json not loaded (serve the folder).', err); }

  if (DEBUG) dbg.hidden = false;
  if (PICK) initPicker();

  let defs = [];
  try { defs = await (await fetch(`data/stickers.json?v=${BUILD}`)).json(); }
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

  // Glow pools (dim-and-glow layer). Same load-or-empty pattern as stickers;
  // an empty/absent file just means no glows. Each gets a staggered pulse phase
  // via animation-delay so adjacent pools don't breathe in unison.
  let glowDefs = [];
  try { glowDefs = await (await fetch(`data/glows.json?v=${BUILD}`)).json(); }
  catch (err) { console.warn('glows.json not loaded (serve the folder).', err); }
  glowDefs.forEach((g, i) => {
    const el = document.createElement('div');
    el.className = 'glow';
    // Distinct period + phase per glow so neighbours drift out of sync.
    el.style.animationDuration = (GLOW_PULSE_PERIOD_S + i * GLOW_PERIOD_STAGGER_S) + 's';
    el.style.animationDelay = (i * GLOW_PHASE_STAGGER_S) + 's';
    const radius_m = (Number.isFinite(g.radius_m) && g.radius_m > 0) ? g.radius_m : DEFAULT_GLOW_RADIUS_M;
    glowsEl.appendChild(el);
    glows.push({ id: g.id, x: g.x, y: g.y, radius_m, el,
                 title: g.name || g.id, body: g.body || '', image: g.image || '' });
  });

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
