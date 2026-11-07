/* Red vs Blue simulation engine — three match types rendered at 1080x1920 design units.
   Pure logic + Canvas 2D drawing. No DOM access; the host supplies RVB.makeCanvas for
   offscreen layers (background, battlefield ground). */
const RVB = (() => {
  'use strict';
  const VW = 1080, VH = 1920;
  const AR = { x: 60, y: 500, w: 960, h: 960 };
  const COL = {
    bg0: '#0D1324', bg1: '#05070D', floor: '#0E1422', grid: 'rgba(150,170,215,0.07)', frame: '#2A3552',
    red: '#FF3149', redD: '#9E1029', redL: '#FFB0BA',
    blue: '#2F7CFF', blueD: '#0D3B97', blueL: '#B2D0FF',
    white: '#F4F6FB', muted: '#8E97AC', gold: '#FFD23F', ink: '#04060B',
    steel: '#E9EEF6', steelD: '#8794AB', wood: '#8A6A49', woodD: '#5B4430', ice: '#BFF3FF',
  };
  const TEAMS = [
    { name: 'RED', c: COL.red, d: COL.redD, l: COL.redL },
    { name: 'BLUE', c: COL.blue, d: COL.blueD, l: COL.blueL },
    { name: 'GREEN', c: '#2ECC55', d: '#11702B', l: '#B4F2C4' },
  ];
  // neutral monsters (portals, ancient beasts) fight everyone and don't count as an army
  const MONSTERS = 9;
  TEAMS[MONSTERS] = { name: 'MONSTERS', key: 'MONSTERS', c: '#7A8B5C', d: '#3E4A2C', l: '#C9D8A8' };
  // Colour sets a team can use. setTeams('GREEN', 'PURPLE') switches the two teams before a match is made.
  const PALETTES = {
    RED: { c: COL.red, d: COL.redD, l: COL.redL },
    BLUE: { c: COL.blue, d: COL.blueD, l: COL.blueL },
    GREEN: { c: '#2ECC55', d: '#11702B', l: '#B4F2C4' },
    PURPLE: { c: '#A64DFF', d: '#5A1A99', l: '#E0C4FF' },
    ORANGE: { c: '#FF8A1F', d: '#C9600E', l: '#FFD2A6' },
    YELLOW: { c: '#FFD23F', d: '#9A7A0A', l: '#FFF0B3' },
    PINK: { c: '#FF5FB4', d: '#A3146A', l: '#FFC2E3' },
    CYAN: { c: '#22D3EE', d: '#0E7490', l: '#B5F1FA' },
    WHITE: { c: '#EEF2F7', d: '#8E9AAD', l: '#FFFFFF' },
    BROWN: { c: '#B5651D', d: '#6E3B10', l: '#E9C9A0' },
    LIME: { c: '#9BE22D', d: '#4F7A0F', l: '#DDF7B0' },
    TEAL: { c: '#14B8A6', d: '#0A665D', l: '#A6EFE6' },
    GOLD: { c: '#F5B700', d: '#8A6400', l: '#FFE48A' },
    SILVER: { c: '#B8C2D1', d: '#5F6B7E', l: '#EDF1F6' },
    INDIGO: { c: '#6366F1', d: '#3730A3', l: '#C7D2FE' },
    CORAL: { c: '#FF6F59', d: '#A33A2B', l: '#FFC7BE' },
    // Nations: the main colour from the flag, plus an accent colour (a) drawn as an inner ring on each troop.
    UK: { c: '#E0263C', d: '#8C0F1F', l: '#FFB3BC', a: '#FFFFFF' },
    USA: { c: '#2F6BFF', d: '#13307A', l: '#B6CCFF', a: '#FFFFFF' },
    FRANCE: { c: '#3B5BFF', d: '#172E8A', l: '#BBC7FF', a: '#FF4B5C' },
    GERMANY: { c: '#FFCE1F', d: '#8F6D00', l: '#FFEFA8', a: '#111111' },
    ITALY: { c: '#1FB25A', d: '#0B5E2D', l: '#B3F0C8', a: '#FFFFFF' },
    BRAZIL: { c: '#1DB954', d: '#0A6B2C', l: '#B5F2C9', a: '#FFDF00' },
    ARGENTINA: { c: '#6CB4EE', d: '#2F6E9E', l: '#D4EBFF', a: '#FFFFFF' },
    CANADA: { c: '#E8222F', d: '#8A0F17', l: '#FFB8BD', a: '#FFFFFF' },
    SPAIN: { c: '#E8202F', d: '#8A0E19', l: '#FFB8BE', a: '#FFC400' },
    PORTUGAL: { c: '#13A050', d: '#075A2C', l: '#B0EBC8', a: '#E8202F' },
    AUSTRALIA: { c: '#0E9F4E', d: '#075A2C', l: '#B3EFCB', a: '#FFCD00' },
    NEWZEALAND: { name: 'NEW ZEALAND', c: '#2F55D4', d: '#152C7A', l: '#BBC9FF', a: '#E8222F' },
    NETHERLANDS: { c: '#FF7A1A', d: '#B5500A', l: '#FFD0A8', a: '#FFFFFF' },
    BELGIUM: { c: '#FFE84A', d: '#C2B200', l: '#FFF5B8', a: '#E8222F' },
    SWEDEN: { c: '#1E7FD0', d: '#0D4677', l: '#B4D8F5', a: '#FECC00' },
    NORWAY: { c: '#D9233A', d: '#850E1E', l: '#FFB6BF', a: '#FFFFFF' },
    DENMARK: { c: '#E01E3C', d: '#8E0C20', l: '#FFB4BF', a: '#FFFFFF' },
    FINLAND: { c: '#EEF3FA', d: '#9AA5B6', l: '#FFFFFF', a: '#003580' },
  };
  // How different two colours look to the eye (CIEDE2000; under ~30 is easy to mix up on a phone screen).
  const lab = hex => {
    const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92; });
    let x = (c[0] * 0.4124 + c[1] * 0.3576 + c[2] * 0.1805) / 0.95047, y = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722, z = (c[0] * 0.0193 + c[1] * 0.1192 + c[2] * 0.9505) / 1.08883;
    const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); x = f(x); y = f(y); z = f(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  function de2000(a, b) {
    const [L1, a1, b1] = lab(a), [L2, a2, b2] = lab(b), rad = Math.PI / 180;
    const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2, G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
    const a1p = a1 * (1 + G), a2p = a2 * (1 + G), C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
    const h1 = (Math.atan2(b1, a1p) / rad + 360) % 360, h2 = (Math.atan2(b2, a2p) / rad + 360) % 360;
    const dL = L2 - L1, dC = C2p - C1p; let dh = h2 - h1; if (C1p * C2p === 0) dh = 0; else if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
    const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(dh * rad / 2), Lm = (L1 + L2) / 2, Cmp = (C1p + C2p) / 2;
    let hm = h1 + h2; if (C1p * C2p !== 0) { if (Math.abs(h1 - h2) > 180) hm += h1 + h2 < 360 ? 360 : -360; hm /= 2; }
    const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
    const dTh = 30 * Math.exp(-(((hm - 275) / 25) ** 2)), Rc = 2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7)), Sl = 1 + 0.015 * (Lm - 50) ** 2 / Math.sqrt(20 + (Lm - 50) ** 2), Sc = 1 + 0.045 * Cmp, Sh = 1 + 0.015 * Cmp * T, Rt = -Math.sin(2 * dTh * rad) * Rc;
    return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
  }
  // the smaller of the differences between two teams' main colours and their dark shades
  const colourGap = (a, b) => { const A = PALETTES[a], B = PALETTES[b]; return Math.min(de2000(A.c, B.c), de2000(A.d, B.d)); };
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const FONT = '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif';
  const TAU = Math.PI * 2;

  const api = { VW, VH, AR, COL, TEAMS, PALETTES, FONT, colourGap, makeCanvas: null };

  // ---------- helpers ----------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const easeOutBack = t => { t = clamp(t, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const font = (size, weight = 800, italic = true) => `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT}`;
  const spaced = (ctx, px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; };
  const fmtTime = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  function rng(seed) {
    let s = seed >>> 0;
    const f = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next: f,
      range: (a, b) => a + (b - a) * f(),
      int: (a, b) => a + Math.floor(f() * (b - a + 1)),
      pick: arr => arr[Math.floor(f() * arr.length)],
      chance: p => f() < p,
      sign: () => (f() < 0.5 ? -1 : 1),
      shuffle: arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    };
  }

  function distPointSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = clamp(t, 0, 1);
    const x = ax + dx * t, y = ay + dy * t;
    return { d: Math.hypot(px - x, py - y), x, y };
  }

  function segSeg(ax, ay, bx, by, cx, cy, dx, dy) {
    const d1x = bx - ax, d1y = by - ay, d2x = dx - cx, d2y = dy - cy;
    const rx = ax - cx, ry = ay - cy;
    const a = d1x * d1x + d1y * d1y, e = d2x * d2x + d2y * d2y, f = d2x * rx + d2y * ry;
    let s, t;
    if (a <= 1e-9 && e <= 1e-9) { s = 0; t = 0; }
    else if (a <= 1e-9) { s = 0; t = clamp(f / e, 0, 1); }
    else {
      const c = d1x * rx + d1y * ry;
      if (e <= 1e-9) { t = 0; s = clamp(-c / a, 0, 1); }
      else {
        const b = d1x * d2x + d1y * d2y, den = a * e - b * b;
        s = den !== 0 ? clamp((b * f - c * e) / den, 0, 1) : 0;
        t = (b * s + f) / e;
        if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); }
        else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
      }
    }
    const p1x = ax + d1x * s, p1y = ay + d1y * s, p2x = cx + d2x * t, p2y = cy + d2y * t;
    return { d: Math.hypot(p1x - p2x, p1y - p2y), x: (p1x + p2x) / 2, y: (p1y + p2y) / 2 };
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function strokeText(ctx, text, x, y, fill, stroke, lw) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  // pictures of outlined floating texts ("TRIPLE KILL", damage numbers), drawn at twice the size so close-ups stay sharp
  const textSprites = new Map();
  function textSprite(text, size, color) {
    if (!api.makeCanvas) return null;
    const key = text + '|' + size + '|' + color;
    let sp = textSprites.get(key);
    if (sp) return sp;
    if (textSprites.size > 400) textSprites.clear();
    const S = 2, m = api.makeCanvas(4, 4).getContext('2d');
    m.font = font(size, 800);
    const w = Math.ceil(m.measureText(text).width) + 24, h = Math.ceil(size * 1.5) + 18;
    const cv = api.makeCanvas(w * S, h * S), g = cv.getContext('2d');
    g.scale(S, S); g.font = font(size, 800); g.textAlign = 'center'; g.textBaseline = 'middle';
    strokeText(g, text, w / 2, h / 2, color, COL.ink, 9);
    sp = { cv, w, h }; textSprites.set(key, sp);
    return sp;
  }
  // Background layer is identical for every match: render once per output size.
  let bgCache = {};
  api.setTeams = (a, b, c) => {
    [a, b, c].forEach((name, i) => {
      if (!name) return;
      const pal = PALETTES[name];
      if (!pal) throw new Error(`Unknown team colour ${name}. Use one of: ${Object.keys(PALETTES).join(', ')}`);
      delete TEAMS[i].a;
      Object.assign(TEAMS[i], { name, key: name }, pal);
    });
    bgCache = {};
  };
  // ---------- national flags ----------
  // Each draws a flag into the box (x, y, w, h); drawFlag adds rounded corners and an ink outline.
  const star = (g, cx, cy, r, n = 5, inner = 0.45) => {
    g.beginPath();
    for (let k = 0; k < n * 2; k++) { const a = -Math.PI / 2 + k * Math.PI / n, rr = k % 2 ? r * inner : r; k ? g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    g.closePath();
  };
  const bands = (g, x, y, w, h, cols, vertical, weights) => {
    const ws = weights || cols.map(() => 1), tot = ws.reduce((a, b) => a + b, 0);
    let o = 0;
    cols.forEach((c, i) => { const f = ws[i] / tot; g.fillStyle = c; if (vertical) g.fillRect(x + o * w, y, f * w + 0.6, h); else g.fillRect(x, y + o * h, w, f * h + 0.6); o += f; });
  };
  const unionJack = (g, x, y, w, h) => {
    g.fillStyle = '#012169'; g.fillRect(x, y, w, h);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.lineCap = 'butt';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + h); g.moveTo(x + w, y); g.lineTo(x, y + h);
    g.lineWidth = h * 0.2; g.strokeStyle = '#FFFFFF'; g.stroke(); g.lineWidth = h * 0.066; g.strokeStyle = '#C8102E'; g.stroke();
    g.fillStyle = '#FFFFFF'; g.fillRect(x + w / 2 - h / 6, y, h / 3, h); g.fillRect(x, y + h / 3, w, h / 3);
    g.fillStyle = '#C8102E'; g.fillRect(x + w / 2 - h / 10, y, h / 5, h); g.fillRect(x, y + h * 0.4, w, h / 5);
    g.restore();
  };
  const nordic = (g, x, y, w, h, bg, cross, inner, thick = 0.24, at = 0.36) => {
    g.fillStyle = bg; g.fillRect(x, y, w, h);
    const cx = x + w * at, t = h * thick;
    g.fillStyle = cross; g.fillRect(cx - t / 2, y, t, h); g.fillRect(x, y + h / 2 - t / 2, w, t);
    if (inner) { const t2 = t * 0.5; g.fillStyle = inner; g.fillRect(cx - t2 / 2, y, t2, h); g.fillRect(x, y + h / 2 - t2 / 2, w, t2); }
  };
  const MAPLE = [[0, -1], [0.12, -0.74], [0.3, -0.82], [0.24, -0.38], [0.56, -0.62], [0.5, -0.44], [0.82, -0.5], [0.7, -0.24], [0.92, -0.14], [0.56, 0.16], [0.64, 0.34], [0.07, 0.24], [0.08, 0.72], [-0.08, 0.72], [-0.07, 0.24], [-0.64, 0.34], [-0.56, 0.16], [-0.92, -0.14], [-0.7, -0.24], [-0.82, -0.5], [-0.5, -0.44], [-0.56, -0.62], [-0.24, -0.38], [-0.3, -0.82], [-0.12, -0.74]];
  const FLAG_ART = {
    UK: unionJack,
    USA: (g, x, y, w, h) => {
      for (let k = 0; k < 13; k++) { g.fillStyle = k % 2 ? '#FFFFFF' : '#B22234'; g.fillRect(x, y + k * h / 13, w, h / 13 + 0.6); }
      const cw = w * 0.42, ch = h * 7 / 13; g.fillStyle = '#3C3B6E'; g.fillRect(x, y, cw, ch);
      if (w >= 36) { g.fillStyle = '#FFFFFF'; const r = Math.max(0.8, h * 0.022); for (let i = 0; i < 5; i++) for (let j = 0; j < (i % 2 ? 5 : 6); j++) { g.beginPath(); g.arc(x + cw * ((i % 2 ? 1 : 0.5) + j * 1.6) / 9.3, y + ch * (i + 0.6) / 5.2, r, 0, TAU); g.fill(); } }
    },
    FRANCE: (g, x, y, w, h) => bands(g, x, y, w, h, ['#0055A4', '#FFFFFF', '#EF4135'], true),
    GERMANY: (g, x, y, w, h) => bands(g, x, y, w, h, ['#000000', '#DD0000', '#FFCE00'], false),
    ITALY: (g, x, y, w, h) => bands(g, x, y, w, h, ['#009246', '#FFFFFF', '#CE2B37'], true),
    BRAZIL: (g, x, y, w, h) => {
      g.fillStyle = '#009C3B'; g.fillRect(x, y, w, h);
      g.beginPath(); g.moveTo(x + w * 0.5, y + h * 0.1); g.lineTo(x + w * 0.92, y + h * 0.5); g.lineTo(x + w * 0.5, y + h * 0.9); g.lineTo(x + w * 0.08, y + h * 0.5); g.closePath(); g.fillStyle = '#FFDF00'; g.fill();
      g.beginPath(); g.arc(x + w / 2, y + h / 2, h * 0.25, 0, TAU); g.fillStyle = '#002776'; g.fill();
      g.save(); g.beginPath(); g.arc(x + w / 2, y + h / 2, h * 0.25, 0, TAU); g.clip();
      g.beginPath(); g.arc(x + w / 2 - h * 0.1, y + h * 1.0, h * 0.58, Math.PI * 1.25, Math.PI * 1.75); g.lineWidth = h * 0.06; g.strokeStyle = '#FFFFFF'; g.stroke(); g.restore();
    },
    ARGENTINA: (g, x, y, w, h) => {
      bands(g, x, y, w, h, ['#74ACDF', '#FFFFFF', '#74ACDF'], false);
      g.beginPath(); g.arc(x + w / 2, y + h / 2, h * 0.1, 0, TAU); g.fillStyle = '#F6B40E'; g.fill(); g.lineWidth = Math.max(1, h * 0.02); g.strokeStyle = '#85340A'; g.stroke();
    },
    CANADA: (g, x, y, w, h) => {
      bands(g, x, y, w, h, ['#D80621', '#FFFFFF', '#D80621'], true, [1, 2, 1]);
      const s2 = h * 0.36, cx = x + w / 2, cy = y + h * 0.53;
      g.beginPath(); MAPLE.forEach(([px, py], k) => (k ? g.lineTo(cx + px * s2, cy + py * s2) : g.moveTo(cx + px * s2, cy + py * s2))); g.closePath(); g.fillStyle = '#D80621'; g.fill();
    },
    SPAIN: (g, x, y, w, h) => bands(g, x, y, w, h, ['#AA151B', '#F1BF00', '#AA151B'], false, [1, 2, 1]),
    PORTUGAL: (g, x, y, w, h) => {
      bands(g, x, y, w, h, ['#006600', '#FF0000'], true, [2, 3]);
      const cx = x + w * 0.4, cy = y + h / 2;
      g.beginPath(); g.arc(cx, cy, h * 0.2, 0, TAU); g.lineWidth = h * 0.06; g.strokeStyle = '#FFE000'; g.stroke();
      roundRect(g, cx - h * 0.09, cy - h * 0.11, h * 0.18, h * 0.21, h * 0.05); g.fillStyle = '#FFFFFF'; g.fill(); g.lineWidth = h * 0.03; g.strokeStyle = '#FF0000'; g.stroke();
    },
    AUSTRALIA: (g, x, y, w, h) => {
      g.fillStyle = '#012169'; g.fillRect(x, y, w, h); unionJack(g, x, y, w / 2, h / 2);
      g.fillStyle = '#FFFFFF';
      star(g, x + w * 0.25, y + h * 0.75, h * 0.14, 7, 0.45); g.fill();
      for (const [sx, sy, sr] of [[0.75, 0.83, 0.07], [0.62, 0.45, 0.06], [0.75, 0.18, 0.06], [0.88, 0.38, 0.06], [0.81, 0.55, 0.035]]) { star(g, x + w * sx, y + h * sy, h * sr, 7, 0.45); g.fill(); }
    },
    NEWZEALAND: (g, x, y, w, h) => {
      g.fillStyle = '#012169'; g.fillRect(x, y, w, h); unionJack(g, x, y, w / 2, h / 2);
      for (const [sx, sy, sr] of [[0.75, 0.82, 0.08], [0.63, 0.43, 0.07], [0.75, 0.2, 0.07], [0.87, 0.38, 0.065]]) {
        star(g, x + w * sx, y + h * sy, h * sr * 1.35); g.fillStyle = '#FFFFFF'; g.fill();
        star(g, x + w * sx, y + h * sy, h * sr); g.fillStyle = '#C8102E'; g.fill();
      }
    },
    NETHERLANDS: (g, x, y, w, h) => bands(g, x, y, w, h, ['#AE1C28', '#FFFFFF', '#21468B'], false),
    BELGIUM: (g, x, y, w, h) => bands(g, x, y, w, h, ['#000000', '#FDDA24', '#EF3340'], true),
    SWEDEN: (g, x, y, w, h) => nordic(g, x, y, w, h, '#006AA7', '#FECC00'),
    NORWAY: (g, x, y, w, h) => nordic(g, x, y, w, h, '#BA0C2F', '#FFFFFF', '#00205B'),
    // Denmark: a slim white cross on red; Finland: a broad blue cross on white
    DENMARK: (g, x, y, w, h) => nordic(g, x, y, w, h, '#C8102E', '#FFFFFF', null, 0.15, 0.375),
    FINLAND: (g, x, y, w, h) => nordic(g, x, y, w, h, '#FFFFFF', '#002F6C', null, 0.27, 0.36),
  };
  // drawn once into a small canvas (at 3x for sharp close-ups) and reused
  const flagCache = {};
  function drawFlag(g, key, x, y, w, h, line = 3) {
    const art = FLAG_ART[key];
    if (!art) return false;
    const ck = `${key}:${Math.round(w)}x${Math.round(h)}:${line}`;
    let img = flagCache[ck];
    if (!img && api.makeCanvas) {
      const S = 3, pad = Math.ceil(line);
      img = flagCache[ck] = api.makeCanvas(Math.ceil((w + pad * 2) * S), Math.ceil((h + pad * 2) * S));
      const c = img.getContext('2d'); c.scale(S, S);
      const rr = Math.min(w, h) * 0.12;
      c.save(); roundRect(c, pad, pad, w, h, rr); c.clip(); art(c, pad, pad, w, h); c.restore();
      roundRect(c, pad, pad, w, h, rr); c.lineWidth = line; c.lineJoin = 'round'; c.strokeStyle = COL.ink; c.stroke();
      img.pad = pad;
    }
    if (img) g.drawImage(img, x - img.pad, y - img.pad, w + img.pad * 2, h + img.pad * 2);
    return true;
  }
  const hasFlag = tm => !!FLAG_ART[tm.key];

  function background(map) {
    const key = 'classic';
    if (bgCache[key] || !api.makeCanvas) return bgCache[key] || null;
    const c = api.makeCanvas(VW, VH);
    const g = c.getContext('2d');
    const lin = g.createLinearGradient(0, 0, 0, VH);
      lin.addColorStop(0, COL.bg0);
      lin.addColorStop(1, COL.bg1);
      g.fillStyle = lin;
      g.fillRect(0, 0, VW, VH);
    const glow = (x, y, rad, color) => {
      const rg = g.createRadialGradient(x, y, 0, x, y, rad);
      rg.addColorStop(0, color);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, VW, VH);
    };
    glow(-60, 300, 760, rgba(TEAMS[0].c, 0.22));
    glow(VW + 60, 300, 760, rgba(TEAMS[1].c, 0.22));
    glow(VW / 2, AR.y + AR.h / 2, 900, 'rgba(120,140,200,0.06)');
    bgCache[key] = c;
    return c;
  }

  // ---------- base match ----------
  class Match {
    constructor(seed, opts) {
      this.seed = seed;
      this.R = rng(seed);
      this.FX = rng((seed ^ 0x9E3779B9) >>> 0);
      this.opts = opts || {};
      this.target = clamp(this.opts.target || 45, 20, 60);
      this.t = 0;
      this.fightT = 0;
      this.phase = 'fight';
      this.outroT = 0;
      this.outroLen = 3.2;
      this.finished = false;
      this.sfx = [];
      this.parts = [];
      this.floats = [];
      this.banners = [];
      this.shakeAmt = 0;
      this.shakeX = 0; this.shakeY = 0;
      this.freeze = 0;
      this.winner = -1;
      this.headline = '';
      this.detail = '';
      this.stepHz = 120;
      this.frameNo = 0;
    }
    snd(type, a) { this.sfx.push(Object.assign({ type }, a || {})); }
    burst(x, y, color, n, spd, life = 0.6, size = 7, grav = 0) {
      const R = this.FX;
      for (let i = 0; i < n; i++) {
        const a = R.range(0, TAU), v = spd * R.range(0.3, 1);
        this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * R.range(0.6, 1.1), age: 0, size: size * R.range(0.6, 1.2), color, grav });
      }
      if (this.parts.length > 700) this.parts.splice(0, this.parts.length - 700);
    }
    float(x, y, text, color, size = 56, life = 0.9) {
      // the finale: no new floating labels over the final blow
      if (this.finalePlan && (this.phase !== 'fight' || this.fightT > this.finalePlan.t - FIN_LEAD - 0.4)) return;
      // UI 2.0: at most four floating labels a second (two while the opening story card is up), so the battle stays readable (looks only)
      if (this.opts.ui >= 2) { if (this.t >= (this.flW || 0)) { this.flW = this.t + 1; this.flN = 0; } if (this.flN >= (this.story && this.t < 4.3 ? 2 : 4)) return; this.flN++; }
      this.floats.push({ x, y, text, color, size, life, age: 0 });
    }
    banner(text, color, life = 1.6) {
      // UI 2.0: nothing covers the opening story card: banners wait until it's gone (only the last two are kept)
      if (this.opts.ui >= 2 && this.story && this.t < 4.4) { (this.heldB || (this.heldB = [])).push({ text, color, life }); if (this.heldB.length > 2) this.heldB.shift(); return; }
      // UI 2.0: a banner still being read (on screen under 1.1 s) isn't replaced; the new one waits its turn
      if (this.opts.ui >= 2 && this.bannerQ && this.phase === 'fight') {
        const cur = this.banners.find(b => b.age < 1.1 && b.age < b.life - 0.3);
        if (cur) { this.bannerQ.push({ at: this.fightT + (1.1 - cur.age) + 0.05 + this.bannerQ.filter(q => !q.done && q.at > this.fightT).length * 1.2, text, col: color }); return; }
      }
      // Replace a banner that is still on screen rather than stacking them.
      this.banners = this.banners.filter(b => b.age > b.life - 0.25);
      this.banners.push({ text, color, life, age: 0 });
    }
    shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }
    frame(dt) {
      this.t += dt;
      this.frameNo++;
      if (this.heldB && this.t >= 4.4) { const h = this.heldB; this.heldB = null; for (const b of h) this.banner(b.text, b.color, b.life); }
      for (const p of this.parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; p.vx *= 1 - 2.2 * dt; p.vy *= 1 - 2.2 * dt; }
      this.parts = this.parts.filter(p => p.age < p.life);
      for (const f of this.floats) f.age += dt;
      this.floats = this.floats.filter(f => f.age < f.life);
      for (const b of this.banners) b.age += dt;
      this.banners = this.banners.filter(b => b.age < b.life);
      this.shakeAmt *= Math.pow(0.0009, dt);
      if (this.shakeAmt < 0.3) this.shakeAmt = 0;
      this.shakeX = (this.FX.next() * 2 - 1) * this.shakeAmt;
      this.shakeY = (this.FX.next() * 2 - 1) * this.shakeAmt;
      if (this.phase === 'fight') {
        if (this.freeze > 0) {
          this.freeze -= dt;
        } else if (this.fixedTicks) {
          // director mode: the simulation always moves in exact 1/stepHz ticks, however fast or slow the video runs,
          // so slow motion never changes how a battle plays out (at normal speed this is the same 2 ticks a frame as before)
          this.tickAcc += dt * this.stepHz;
          const n = Math.floor(this.tickAcc + 1e-6);
          this.tickAcc = Math.max(0, this.tickAcc - n);
          const h = 1 / this.stepHz;
          for (let i = 0; i < n && this.phase === 'fight'; i++) { if (this.prestep) this.prestep(); this.step(h); }
        } else {
          const n = Math.max(1, Math.round(dt * this.stepHz));
          const h = dt / n;
          for (let i = 0; i < n && this.phase === 'fight'; i++) this.step(h);
        }
      } else {
        if (!this.holdOutro) this.outroT += dt; // (held still during the finale's slow-motion moment)
        if (this.outroStep) this.outroStep(dt);
        if (this.outroT >= this.outroLen) this.finished = true;
      }
      if (this.cosmetic) this.cosmetic(dt);
    }
    end(winner, headline, detail) {
      if (this.phase !== 'fight') return;
      this.phase = 'outro';
      // with a director, slow motion makes the game clock lag the video clock; the outro uses the video clock so the video still ends on time
      // outroSecs: the video ends this long after the battle does (rules.video.outroSeconds), instead of at a fixed length
      if (this.opts.outroSecs) this.outroLen = this.opts.outroSecs;
      else if (this.opts.fixedLength) this.outroLen = Math.max(3, this.opts.fixedLength - (this.realT !== undefined ? this.realT : this.t));
      this.winner = winner;
      this.headline = headline;
      this.detail = detail;
      this.endHow = this.lastDeath && this.lastDeath.t >= this.fightT - 1e-9 ? 'kill' : 'time'; this.lastFightT = this.fightT;
      if (this.finalePlan) { this.holdOutro = true; return; }
      this.confetti();
    }
    confetti() {
      const winner = this.winner;
      this.snd('win', { team: winner });
      const R = this.FX;
      for (let i = 0; i < 90; i++) {
        const x = R.range(AR.x, AR.x + AR.w);
        this.parts.push({ x, y: AR.y - R.range(0, 200), vx: R.range(-120, 120), vy: R.range(200, 700), life: R.range(1.8, 3.0), age: 0, size: R.range(7, 13), color: R.chance(0.7) ? TEAMS[winner].c : COL.gold, grav: 500, confetti: true, rot: R.range(0, TAU) });
      }
    }

    // ----- shared drawing -----
    drawBG(ctx) {
      const bg = background(); // same background on every map
      if (bg) ctx.drawImage(bg, 0, 0, VW, VH);
      else { ctx.fillStyle = COL.bg1; ctx.fillRect(0, 0, VW, VH); }
    }
    drawHUD(ctx, h) {
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'center';
      ctx.fillStyle = COL.white;
      ctx.font = font(h.title.length > 15 ? 78 : 88, 800);
      spaced(ctx, 2);
      ctx.fillText(h.title, VW / 2, 148);
      ctx.fillStyle = COL.gold;
      ctx.font = font(38, 700, false);
      spaced(ctx, 6);
      ctx.fillText(h.hook, VW / 2, 204);

      spaced(ctx, 4);
      ctx.font = font(42, 800);
      ctx.textAlign = 'left'; ctx.fillStyle = TEAMS[0].c; ctx.fillText(TEAMS[0].name, 70, 274);
      ctx.textAlign = 'right'; ctx.fillStyle = TEAMS[1].c; ctx.fillText(TEAMS[1].name, VW - 70, 274);

      spaced(ctx, 0);
      ctx.font = font(128, 800);
      ctx.fillStyle = COL.white;
      ctx.textAlign = 'left'; ctx.fillText(h.lv, 62, 382);
      ctx.textAlign = 'right'; ctx.fillText(h.rv, VW - 62, 382);

      ctx.font = font(32, 700, false);
      spaced(ctx, 2);
      ctx.fillStyle = COL.muted;
      ctx.textAlign = 'left'; ctx.fillText(h.ls, 70, 428);
      ctx.textAlign = 'right'; ctx.fillText(h.rs, VW - 70, 428);
      spaced(ctx, 0);

      // nations: their flag between the score and the VS badge
      for (let i = 0; i < 2; i++) if (hasFlag(TEAMS[i])) drawFlag(ctx, TEAMS[i].key, i === 0 ? 300 : VW - 300 - 114, 300, 114, 76, 4);
      // VS badge
      ctx.beginPath(); ctx.arc(VW / 2, 318, 52, 0, TAU);
      ctx.fillStyle = '#121A2D'; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = COL.frame; ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = font(50, 800);
      ctx.fillStyle = COL.white;
      ctx.fillText('VS', VW / 2 - 2, 336);

      // tug-of-war bar
      const bx = 60, by = 448, bw = 960, bh = 22;
      const split = bx + bw * clamp(h.ratio, 0, 1);
      ctx.save();
      roundRect(ctx, bx, by, bw, bh, bh / 2); ctx.clip();
      ctx.fillStyle = TEAMS[1].c; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = TEAMS[0].c; ctx.fillRect(bx, by, split - bx, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(bx, by, bw, 5);
      ctx.restore();
      ctx.fillStyle = COL.white;
      ctx.fillRect(split - 3, by - 7, 6, bh + 14);
    }
    drawFooter(ctx, label, value, urgent) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = font(30, 700, false); spaced(ctx, 6);
      ctx.fillStyle = COL.muted;
      ctx.fillText(label, VW / 2, 1514);
      spaced(ctx, 0);
      if (urgent) {
        const p = 1 + 0.12 * Math.max(0, Math.cos((this.t % 1) * Math.PI));
        ctx.save(); ctx.translate(VW / 2, 1578); ctx.scale(p, p);
        ctx.font = font(84, 800); ctx.fillStyle = COL.gold;
        ctx.fillText(value, 0, 0);
        ctx.restore();
      } else {
        ctx.font = font(72, 800); ctx.fillStyle = COL.white;
        ctx.fillText(value, VW / 2, 1578);
      }
    }
    drawArenaFrame(ctx) {
      roundRect(ctx, AR.x - 6, AR.y - 6, AR.w + 12, AR.h + 12, 22);
      ctx.lineWidth = 6;
      ctx.strokeStyle = COL.frame;
      ctx.stroke();
    }
    drawFX(ctx) {
      // plain square particles are drawn in batches (one fill per colour and fade step), which is much faster with hundreds on screen
      const batch = new Map();
      for (const p of this.parts) {
        const k = 1 - p.age / p.life;
        if (p.confetti) {
          ctx.globalAlpha = clamp(k * 1.4, 0, 1); ctx.fillStyle = p.color;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + p.age * 9);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        } else if (p.smoke) {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = clamp(k * 0.8, 0, 0.6);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.4 - 0.6 * k), 0, TAU); ctx.fill();
        } else {
          const a = Math.round(clamp(k * 1.4, 0, 1) * 10); if (!a) continue;
          const key = p.color + '|' + a, s = p.size * (0.4 + 0.6 * k);
          let b = batch.get(key); if (!b) { b = []; batch.set(key, b); }
          b.push(p.x - s / 2, p.y - s / 2, s);
        }
      }
      for (const [key, b] of batch) {
        const i = key.lastIndexOf('|');
        ctx.globalAlpha = +key.slice(i + 1) / 10; ctx.fillStyle = key.slice(0, i);
        ctx.beginPath(); for (let j = 0; j < b.length; j += 3) ctx.rect(b[j], b[j + 1], b[j + 2], b[j + 2]); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const f of this.floats) {
        const k = f.age / f.life;
        ctx.globalAlpha = clamp((1 - k) * 2.5, 0, 1);
        const sc = 0.7 + 0.5 * easeOutBack(Math.min(1, k * 5)), fy = f.y - 70 * easeOutCubic(k);
        // outlined text is slow to draw, so each text is drawn once into a picture and stamped from then on
        const sp = textSprite(f.text, f.size, f.color);
        if (sp) { const w = sp.w * sc, hh = sp.h * sc; ctx.drawImage(sp.cv, f.x - w / 2, fy - hh / 2, w, hh); continue; }
        ctx.save(); ctx.translate(f.x, fy); ctx.scale(sc, sc);
        ctx.font = font(f.size, 800);
        strokeText(ctx, f.text, 0, 0, f.color, COL.ink, 9);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.textBaseline = 'alphabetic';
    }
    drawBanners(ctx) {
      for (const b of this.banners) {
        const inK = easeOutBack(Math.min(1, b.age / 0.25));
        const outK = clamp((b.life - b.age) / 0.3, 0, 1);
        ctx.save();
        ctx.globalAlpha = outK;
        // UI 2.0: while the roster strips are up, banners drop below the top strip(s) instead of covering them
        const rosterUp = this.ui2 && this.cmb && this.cmb.roster && this.t > 4.0 && this.t < 8.6;
        const by = rosterUp ? AR.y + 14 + (this.N === 3 ? 3 * 84 : 100) + 48 : AR.y + 82;
        ctx.translate(VW / 2, by);
        ctx.scale(0.6 + 0.4 * inK, 0.6 + 0.4 * inK);
        ctx.font = font(54, 800); spaced(ctx, 3);
        const ft = [0, 1].find(i => hasFlag(TEAMS[i]) && (b.text.startsWith(TEAMS[i].name + ' ') || b.text.startsWith(TEAMS[i].name + ':')));
        const tw = ctx.measureText(b.text).width, fw = ft !== undefined ? 66 : 0, w = tw + 70 + fw, maxW = this.ui2 ? 900 : 1040;
        if (w > maxW) ctx.scale(maxW / w, maxW / w);
        if (this.ui2 && this.lay && inK >= 1 && outK >= 1) { const k = Math.min(1, maxW / w); this.lay.push({ kind: 'banner', x: VW / 2 - (w / 2 + 16) * k, y: by - 40 * k + (this.layDY || 0), w: (w + 32) * k, h: 80 * k, text: b.text }); }
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 16, -40); ctx.lineTo(w / 2 + 16, -40); ctx.lineTo(w / 2 - 16, 40); ctx.lineTo(-w / 2 - 16, 40); ctx.closePath();
        ctx.fillStyle = b.color; ctx.fill();
        ctx.lineWidth = 5; ctx.strokeStyle = COL.ink; ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = b.color === COL.gold ? COL.ink : COL.white;
        if (fw) drawFlag(ctx, TEAMS[ft].key, -w / 2 + 30, -21, 60, 40, 3);
        ctx.fillText(b.text, fw / 2, 3);
        spaced(ctx, 0);
        ctx.restore();
      }
      ctx.textBaseline = 'alphabetic';
    }
    drawIntro(ctx, word) {
      if (this.t > 1.1) return;
      const k = this.t / 1.1;
      ctx.save();
      ctx.globalAlpha = k < 0.55 ? 1 : clamp(1 - (k - 0.55) / 0.45, 0, 1);
      const s = lerp(1.6, 1, easeOutBack(Math.min(1, k * 3)));
      ctx.translate(VW / 2, AR.y + AR.h / 2);
      ctx.rotate(-0.06);
      ctx.scale(s, s);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = font(220, 800);
      strokeText(ctx, word, 0, 0, COL.white, COL.ink, 18);
      ctx.restore();
      ctx.textBaseline = 'alphabetic';
    }
    drawOutro(ctx) {
      if (this.phase !== 'outro' || this.holdOutro) return;
      const k = this.outroT;
      const tm = TEAMS[this.winner];
      // flash
      if (k < 0.25) { ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - k / 0.25)})`; ctx.fillRect(0, 0, VW, VH); }
      ctx.fillStyle = `rgba(4,6,11,${0.55 * clamp(k / 0.4, 0, 1)})`;
      ctx.fillRect(AR.x - 6, AR.y - 6, AR.w + 12, AR.h + 12);
      const slide = easeOutCubic(clamp((k - 0.15) / 0.35, 0, 1));
      const cy = AR.y + AR.h / 2;
      ctx.save();
      ctx.translate(lerp(-VW, 0, slide), 0);
      ctx.beginPath();
      ctx.moveTo(0, cy - 130); ctx.lineTo(VW, cy - 170); ctx.lineTo(VW, cy + 90); ctx.lineTo(0, cy + 130); ctx.closePath();
      ctx.fillStyle = tm.c; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath(); ctx.moveTo(0, cy - 130); ctx.lineTo(VW, cy - 170); ctx.lineTo(VW, cy - 140); ctx.lineTo(0, cy - 100); ctx.closePath(); ctx.fill();
      ctx.restore();
      const pop = easeOutBack(clamp((k - 0.35) / 0.35, 0, 1));
      if (pop > 0 && hasFlag(tm)) {
        ctx.save(); ctx.translate(VW / 2, cy - 250); ctx.rotate(-0.035); ctx.scale(pop, pop);
        drawFlag(ctx, tm.key, -96, -64, 192, 128, 6);
        ctx.restore();
      }
      if (pop > 0) {
        ctx.save();
        ctx.translate(VW / 2, cy - 18); ctx.rotate(-0.035); ctx.scale(pop, pop);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = font(this.headline.length > 14 ? 108 : this.headline.length > 11 ? 132 : 158, 800);
        strokeText(ctx, this.headline, 0, 0, COL.white, COL.ink, 14);
        ctx.restore();
      }
      const dk = clamp((k - 0.7) / 0.3, 0, 1);
      if (dk > 0) {
        ctx.globalAlpha = dk;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = font(52, 800); spaced(ctx, 3);
        strokeText(ctx, this.detail, VW / 2, cy + 190, COL.gold, COL.ink, 10);
        spaced(ctx, 0);
        ctx.globalAlpha = 1;
      }
      ctx.textBaseline = 'alphabetic';
    }
  }

  // =====================================================================
  // 1) TERRITORY WAR — balls repaint the board, power-ups swing it.
  // =====================================================================
  const PENTA = [0, 3, 5, 7, 10];
  class Territory extends Match {
    constructor(seed, opts) {
      super(seed, opts);
      const R = this.R;
      this.key = 'territory';
      this.audioGain = 2.4;
      this.label = 'Territory War';
      this.title = 'TERRITORY WAR';
      this.hook = R.pick(['WHO TAKES THE BOARD?', 'WHICH COLOR WINS?', `${TEAMS[0].name} OR ${TEAMS[1].name}?`, 'PICK A SIDE NOW']);
      this.N = R.pick([12, 14, 16, 16, 20]);
      this.cs = AR.w / this.N;
      this.grid = new Uint8Array(this.N * this.N);
      this.flipAt = new Float32Array(this.N * this.N).fill(-10);
      this.layout = R.pick(['split-v', 'split-h', 'diag', 'quad', 'stripes', 'checker', 'blobs']);
      this.fillLayout();
      this.count = [0, 0];
      for (let i = 0; i < this.grid.length; i++) this.count[this.grid[i]]++;
      this.duration = this.target - this.outroLen;
      this.baseSpeed = R.range(820, 1000);
      this.balls = [];
      const n0 = R.chance(0.3) ? 3 : 2;
      for (let team = 0; team < 2; team++) for (let k = 0; k < n0; k++) this.addBall(team);
      this.pups = [];
      this.nextPup = R.range(2.0, 3.2);
      this.pupTypes = ['ghost'].concat(R.shuffle(['split', 'speed', 'big', 'bomb', 'freeze']).slice(0, R.int(3, 5)));
      this.speedT = [0, 0];
      this.frozenT = [0, 0];
      this.ghostT = [0, 0];
      this.rushAt = this.duration * R.range(0.7, 0.8);
      this.rushDone = false;
      this.speedUpAt = this.duration * R.range(0.45, 0.6);
      this.speedUpDone = false;
      this.lastBeep = 99;
      this.dispRatio = this.count[0] / this.grid.length;
    }
    fillLayout() {
      const N = this.N, R = this.R, g = this.grid;
      const evenSplits = () => { const ks = []; for (let k = 2; k <= N / 2; k++) if (N % k === 0 && (N / k) % 2 === 0 && N / k >= 2 && N / k <= 6) ks.push(k); return ks.length ? ks : [N / 2]; };
      let val;
      switch (this.layout) {
        case 'split-v': val = (i) => (i < N / 2 ? 0 : 1); break;
        case 'split-h': val = (i, j) => (j < N / 2 ? 0 : 1); break;
        case 'diag': val = (i, j) => (i + j < N - 1 || (i + j === N - 1 && i % 2 === 0) ? 0 : 1); break;
        case 'quad': val = (i, j) => ((i < N / 2) === (j < N / 2) ? 0 : 1); break;
        case 'stripes': { const k = R.pick(evenSplits()); const horiz = R.chance(0.5); val = (i, j) => Math.floor((horiz ? j : i) / k) % 2; break; }
        case 'checker': { const k = R.pick(evenSplits()); val = (i, j) => (Math.floor(i / k) + Math.floor(j / k)) % 2; break; }
        default: { // blobs: smooth random field split exactly at its median
          const waves = [];
          for (let w = 0; w < 5; w++) waves.push({ fx: R.range(-0.45, 0.45), fy: R.range(-0.45, 0.45), ph: R.range(0, TAU), a: R.range(0.5, 1) });
          const vals = new Float32Array(N * N);
          for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let v = 0; for (const w of waves) v += w.a * Math.sin(i * w.fx + j * w.fy + w.ph); vals[j * N + i] = v + R.range(-0.01, 0.01); }
          const sorted = Array.from(vals).sort((a, b) => a - b);
          const med = sorted[Math.floor((N * N) / 2)];
          val = (i, j) => (vals[j * N + i] < med ? 0 : 1);
        }
      }
      const swap = R.chance(0.5) ? 1 : 0;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) g[j * N + i] = val(i, j) ^ swap;
    }
    ballR(b) { return this.cs * 0.42 * b.rs; }
    addBall(team, x, y, ang) {
      const R = this.R, N = this.N, cs = this.cs, g = this.grid;
      if (x === undefined) {
        let cell = null;
        for (let tries = 0; tries < 600 && !cell; tries++) {
          const i = R.int(1, N - 2), j = R.int(1, N - 2);
          let ok = true;
          for (let dj = -1; dj <= 1 && ok; dj++) for (let di = -1; di <= 1; di++) if (g[(j + dj) * N + i + di] !== team) { ok = false; break; }
          if (ok) cell = [i, j];
        }
        if (!cell) for (let k = 0; k < N * N; k++) if (g[k] === team) { cell = [k % N, Math.floor(k / N)]; break; }
        x = AR.x + (cell[0] + 0.5) * cs;
        y = AR.y + (cell[1] + 0.5) * cs;
      }
      if (ang === undefined) ang = R.range(0.4, 1.17) + R.int(0, 3) * (Math.PI / 2);
      const b = { team, x, y, vx: Math.cos(ang), vy: Math.sin(ang), big: 0, rs: 1, trail: [], lastSnd: -1 };
      this.balls.push(b);
      return b;
    }
    jitter(b) {
      const a = Math.atan2(b.vy, b.vx) + this.R.range(-0.09, 0.09);
      let vx = Math.cos(a), vy = Math.sin(a);
      if (Math.abs(vx) < 0.32) vx = Math.sign(vx || 1) * 0.32;
      if (Math.abs(vy) < 0.32) vy = Math.sign(vy || 1) * 0.32;
      const l = Math.hypot(vx, vy);
      b.vx = vx / l; b.vy = vy / l;
    }
    eat(b, r) {
      const N = this.N, cs = this.cs, g = this.grid;
      const i0 = Math.max(0, Math.floor((b.x - r - AR.x) / cs)), i1 = Math.min(N - 1, Math.floor((b.x + r - AR.x) / cs));
      const j0 = Math.max(0, Math.floor((b.y - r - AR.y) / cs)), j1 = Math.min(N - 1, Math.floor((b.y + r - AR.y) / cs));
      let hit = false, row = 0;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const idx = j * N + i;
        if (g[idx] === b.team) continue;
        const rx = AR.x + i * cs, ry = AR.y + j * cs;
        const cx = clamp(b.x, rx, rx + cs), cy = clamp(b.y, ry, ry + cs);
        if ((b.x - cx) ** 2 + (b.y - cy) ** 2 < r * r) {
          g[idx] = b.team; this.flipAt[idx] = this.t;
          this.count[b.team]++; this.count[1 - b.team]--;
          hit = true; row = j;
        }
      }
      if (hit && this.t - b.lastSnd > 0.05) {
        b.lastSnd = this.t;
        const deg = Math.round((1 - row / (N - 1)) * 9);
        const semis = Math.floor(deg / 5) * 12 + PENTA[deg % 5];
        this.snd('pluck', { team: b.team, f: (b.team === 0 ? 220 : 440) * Math.pow(2, semis / 12), pan: ((b.x - AR.x) / AR.w) * 1.4 - 0.7 });
      }
      return hit;
    }
    spawnPup() {
      const R = this.R;
      let x = 0, y = 0;
      for (let tries = 0; tries < 30; tries++) {
        x = R.range(AR.x + 90, AR.x + AR.w - 90); y = R.range(AR.y + 90, AR.y + AR.h - 90);
        if (this.balls.every(b => Math.hypot(b.x - x, b.y - y) > 200) && this.pups.every(p => Math.hypot(p.x - x, p.y - y) > 220)) break;
      }
      this.pups.push({ type: R.pick(this.pupTypes), x, y, age: 0, life: 8 });
    }
    applyPup(p, b) {
      const tm = TEAMS[b.team], other = TEAMS[1 - b.team];
      switch (p.type) {
        case 'split': {
          const mine = this.balls.filter(o => o.team === b.team).length;
          if (mine < 5) this.addBall(b.team, b.x, b.y, Math.atan2(b.vy, b.vx) + Math.PI / 2);
          this.banner(`${tm.name} +1 BALL`, tm.c); break;
        }
        case 'speed': this.speedT[b.team] = 6; this.banner(`${tm.name} SPEED BOOST`, tm.c); break;
        case 'big': b.big = 6; this.banner(`${tm.name} GIANT BALL`, tm.c); break;
        case 'bomb': {
          const rad = this.cs * 2.9, N = this.N, cs = this.cs;
          for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
            const cx = AR.x + (i + 0.5) * cs, cy = AR.y + (j + 0.5) * cs;
            const idx = j * N + i;
            if (Math.hypot(cx - p.x, cy - p.y) < rad && this.grid[idx] !== b.team) {
              this.grid[idx] = b.team; this.flipAt[idx] = this.t; this.count[b.team]++; this.count[1 - b.team]--;
            }
          }
          this.burst(p.x, p.y, tm.l, 40, 900, 0.7, 12);
          this.shake(22);
          this.snd('boom', { gain: 0.8 });
          this.banner(`${tm.name} BOMB!`, tm.c); break;
        }
        case 'freeze': this.frozenT[1 - b.team] = 2.6; this.snd('freeze'); this.banner(`${tm.name} FREEZES ${other.name}`, tm.c); break;
        case 'ghost': this.ghostT[b.team] = 4; this.snd('alarm'); this.banner(`${tm.name} RAMPAGE!`, tm.c); break;
      }
      this.snd('pickup', { team: b.team });
      this.burst(p.x, p.y, COL.gold, 18, 420, 0.5, 9);
    }
    step(h) {
      const R = this.R;
      this.fightT += h;
      for (let tm = 0; tm < 2; tm++) { this.speedT[tm] -= h; this.frozenT[tm] -= h; this.ghostT[tm] -= h; }
      this.nextPup -= h;
      if (this.nextPup <= 0 && this.pups.length < 2 && this.fightT < this.duration - 4) { this.spawnPup(); this.nextPup = R.range(3.0, 5.2); }
      for (const p of this.pups) p.age += h;
      this.pups = this.pups.filter(p => p.age < p.life);
      if (!this.speedUpDone && this.fightT >= this.speedUpAt) {
        this.speedUpDone = true; this.baseSpeed *= 1.2;
        this.banner('SPEED UP!', COL.gold); this.snd('alarm');
      }
      if (!this.rushDone && this.fightT >= this.rushAt) {
        this.rushDone = true;
        for (let tm = 0; tm < 2; tm++) this.addBall(tm);
        this.banner('+1 BALL EACH', COL.gold); this.snd('pickup', { team: 0 });
      }
      const cs = this.cs;
      for (const b of this.balls) {
        if (b.big > 0) b.big -= h;
        if (this.frozenT[b.team] > 0) continue;
        const sp = this.baseSpeed * (this.speedT[b.team] > 0 ? 1.45 : 1);
        const r = this.ballR(b);
        const dist = sp * h;
        const n = Math.max(1, Math.ceil(dist / (cs * 0.2)));
        const d = dist / n;
        for (let k = 0; k < n; k++) {
          b.x += b.vx * d;
          if (b.x - r < AR.x) { b.x = AR.x + r; b.vx = Math.abs(b.vx); }
          else if (b.x + r > AR.x + AR.w) { b.x = AR.x + AR.w - r; b.vx = -Math.abs(b.vx); }
          const ghost = this.ghostT[b.team] > 0;
          if (this.eat(b, r) && !ghost) { b.x -= b.vx * d; b.vx = -b.vx; this.jitter(b); }
          b.y += b.vy * d;
          if (b.y - r < AR.y) { b.y = AR.y + r; b.vy = Math.abs(b.vy); }
          else if (b.y + r > AR.y + AR.h) { b.y = AR.y + AR.h - r; b.vy = -Math.abs(b.vy); }
          if (this.eat(b, r) && !ghost) { b.y -= b.vy * d; b.vy = -b.vy; this.jitter(b); }
        }
        for (const p of this.pups) {
          if (p.taken) continue;
          if (Math.hypot(b.x - p.x, b.y - p.y) < r + 30) { p.taken = true; this.applyPup(p, b); }
        }
      }
      this.pups = this.pups.filter(p => !p.taken);
      const left = this.duration - this.fightT;
      if (left <= 5 && left > 0) {
        const sec = Math.ceil(left);
        if (sec !== this.lastBeep) { this.lastBeep = sec; this.snd('beep', { hi: sec === 1 }); }
      }
      if (this.fightT >= this.duration) {
        if (this.count[0] === this.count[1]) {
          this.duration += 2;
          this.banner('OVERTIME!', COL.gold);
        } else {
          const w = this.count[0] > this.count[1] ? 0 : 1;
          const pct = Math.round((this.count[w] / this.grid.length) * 100);
          this.end(w, `${TEAMS[w].name} WINS`, `${pct}% OF THE BOARD`);
        }
      }
    }
    cosmetic(dt) {
      for (const b of this.balls) {
        b.rs += ((b.big > 0 ? 1.9 : 1) - b.rs) * Math.min(1, dt * 8);
        b.trail.push(b.x, b.y);
        if (b.trail.length > 20) b.trail.splice(0, 2);
      }
      this.dispRatio += (this.count[0] / this.grid.length - this.dispRatio) * Math.min(1, dt * 10);
    }
    drawPup(ctx, p) {
      const pulse = 1 + 0.08 * Math.sin(p.age * 8);
      const fade = clamp((p.life - p.age) / 0.6, 0, 1) * clamp(p.age / 0.25, 0, 1);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y); ctx.scale(pulse, pulse);
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU);
      ctx.fillStyle = COL.ink; ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = COL.gold; ctx.stroke();
      ctx.fillStyle = COL.white; ctx.strokeStyle = COL.white;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      switch (p.type) {
        case 'split': ctx.font = font(36, 800); ctx.fillText('+1', -1, 2); break;
        case 'big': ctx.font = font(32, 800); ctx.fillText('XL', -1, 2); break;
        case 'ghost':
          ctx.fillStyle = COL.gold;
          ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? 9 : 21; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
          break;
        case 'speed':
          ctx.fillStyle = COL.gold;
          ctx.beginPath(); ctx.moveTo(4, -20); ctx.lineTo(-11, 3); ctx.lineTo(-1, 3); ctx.lineTo(-5, 20); ctx.lineTo(11, -4); ctx.lineTo(1, -4); ctx.closePath(); ctx.fill();
          break;
        case 'bomb':
          ctx.beginPath(); ctx.arc(-2, 4, 14, 0, TAU); ctx.fill();
          ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(6, -6); ctx.quadraticCurveTo(12, -16, 18, -14); ctx.stroke();
          ctx.fillStyle = COL.gold; ctx.beginPath(); ctx.arc(19, -15, 5, 0, TAU); ctx.fill();
          break;
        case 'freeze':
          ctx.strokeStyle = COL.ice; ctx.lineWidth = 4; ctx.lineCap = 'round';
          for (let k = 0; k < 3; k++) { const a = (k * Math.PI) / 3; ctx.beginPath(); ctx.moveTo(-Math.cos(a) * 18, -Math.sin(a) * 18); ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 18); ctx.stroke(); }
          break;
      }
      ctx.restore();
      ctx.textBaseline = 'alphabetic';
    }
    draw(ctx) {
      this.drawBG(ctx);
      const tot = this.grid.length;
      const lp = Math.round((this.count[0] / tot) * 100);
      const nb = [0, 0]; for (const b of this.balls) nb[b.team]++;
      this.drawHUD(ctx, {
        title: this.title, hook: this.hook,
        lv: lp + '%', rv: 100 - lp + '%',
        ls: `${this.count[0]} TILES · ${nb[0]} BALL${nb[0] > 1 ? 'S' : ''}`,
        rs: `${nb[1]} BALL${nb[1] > 1 ? 'S' : ''} · ${this.count[1]} TILES`,
        ratio: this.dispRatio,
      });
      const N = this.N, cs = this.cs, g = this.grid;
      const gap = cs >= 56 ? 5 : cs >= 40 ? 4 : 3;
      ctx.save();
      ctx.translate(this.shakeX, this.shakeY);
      ctx.fillStyle = COL.ink; ctx.fillRect(AR.x, AR.y, AR.w, AR.h);
      for (let tm = 0; tm < 2; tm++) {
        ctx.fillStyle = TEAMS[tm].c;
        for (let k = 0; k < g.length; k++) if (g[k] === tm) ctx.fillRect(AR.x + (k % N) * cs + gap / 2, AR.y + Math.floor(k / N) * cs + gap / 2, cs - gap, cs - gap);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      for (let k = 0; k < g.length; k++) ctx.fillRect(AR.x + (k % N) * cs + gap / 2, AR.y + Math.floor(k / N) * cs + gap / 2, cs - gap, Math.max(3, cs * 0.1));
      for (let k = 0; k < g.length; k++) {
        const age = this.t - this.flipAt[k];
        if (age < 0.35) {
          ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - age / 0.35)})`;
          ctx.fillRect(AR.x + (k % N) * cs + gap / 2, AR.y + Math.floor(k / N) * cs + gap / 2, cs - gap, cs - gap);
        }
      }
      for (const p of this.pups) this.drawPup(ctx, p);
      for (const b of this.balls) {
        const tm = TEAMS[b.team], r = this.ballR(b);
        const tr = b.trail, n = tr.length / 2;
        for (let i = 0; i < n - 1; i++) {
          const k = (i + 1) / n;
          ctx.globalAlpha = 0.35 * k;
          ctx.fillStyle = COL.white;
          ctx.beginPath(); ctx.arc(tr[i * 2], tr[i * 2 + 1], r * (0.35 + 0.55 * k), 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(b.x, b.y, r + 4, 0, TAU); ctx.fillStyle = COL.ink; ctx.fill();
        ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.fillStyle = COL.white; ctx.fill();
        ctx.beginPath(); ctx.arc(b.x, b.y, r * 0.56, 0, TAU); ctx.fillStyle = tm.c; ctx.fill();
        if (this.frozenT[b.team] > 0) { ctx.lineWidth = 6; ctx.strokeStyle = COL.ice; ctx.beginPath(); ctx.arc(b.x, b.y, r + 9, 0, TAU); ctx.stroke(); }
        if (this.speedT[b.team] > 0) { ctx.lineWidth = 4; ctx.strokeStyle = COL.gold; ctx.beginPath(); ctx.arc(b.x, b.y, r + 9, 0, TAU); ctx.stroke(); }
        if (this.ghostT[b.team] > 0) { ctx.lineWidth = 7; ctx.strokeStyle = this.frameNo % 8 < 4 ? COL.gold : COL.white; ctx.beginPath(); ctx.arc(b.x, b.y, r + 10, 0, TAU); ctx.stroke(); }
      }
      ctx.restore();
      this.drawArenaFrame(ctx);
      this.drawFX(ctx);
      this.drawBanners(ctx);
      const left = Math.max(0, this.duration - this.fightT);
      this.drawFooter(ctx, 'TIME LEFT', this.phase === 'fight' ? (left <= 5 ? String(Math.ceil(left)) : fmtTime(Math.ceil(left))) : '0:00', this.phase === 'fight' && left <= 5);
      this.drawIntro(ctx, 'GO!');
      this.drawOutro(ctx);
    }
  }

  // =====================================================================
  // 2) WEAPON DUEL — two balls, spinning weapons, every hit levels up.
  // =====================================================================
  const WEAPONS = {
    sword: { name: 'SWORD', len: 150, spin: 4.4, dmg: 4.5, cd: 0.3, kb: 360 },
    dagger: { name: 'DAGGER', len: 96, spin: 6.6, dmg: 5, cd: 0.22, kb: 260 },
    spear: { name: 'SPEAR', len: 196, spin: 3.4, dmg: 10, cd: 0.3, kb: 380 },
    hammer: { name: 'HAMMER', len: 132, spin: 3.0, dmg: 11, cd: 0.45, kb: 480 },
    scythe: { name: 'SCYTHE', len: 148, spin: 4.6, dmg: 7, cd: 0.3, kb: 330, heal: 2 },
    bow: { name: 'BOW', len: 0, spin: 2.8, dmg: 13, cd: 0.45, kb: 200, arrows: 1 },
  };
  const WEAPON_KEYS = Object.keys(WEAPONS);

  class Duel extends Match {
    constructor(seed, opts) {
      super(seed, opts);
      const R = this.R;
      this.key = 'duel';
      this.audioGain = 2.0;
      this.label = 'Weapon Duel';
      this.stepHz = 240;
      const a = R.pick(WEAPON_KEYS);
      let b = R.pick(WEAPON_KEYS);
      while (b === a) b = R.pick(WEAPON_KEYS);
      this.title = `${WEAPONS[a].name} VS ${WEAPONS[b].name}`;
      this.hook = R.pick(['WHO WINS?', 'PICK YOUR FIGHTER', 'WHICH WEAPON WINS?', 'COMMENT YOUR PICK']);
      this.gravity = R.chance(0.5) ? R.range(560, 760) : 0;
      this.ballR = 78;
      this.attract = this.gravity ? 420 : 650;
      this.vmin = this.gravity ? 160 : 200;
      this.vmax = this.gravity ? 900 : 680;
      this.balls = [this.makeBall(0, a), this.makeBall(1, b)];
      this.arrows = [];
      this.parryCd = 0;
      this.dmgMul = 1;
      this.dmgBase = clamp(Math.pow(45 / this.target, 0.9), 0.75, 1.6);
      this.suddenAt = Math.max(18, this.target * 0.68);
      this.cap = this.target - this.outroLen;
      this.lastWall = 0;
    }
    makeBall(team, type) {
      const R = this.R, W = WEAPONS[type];
      const x = team === 0 ? AR.x + R.range(200, 320) : AR.x + AR.w - R.range(200, 320);
      const y = team === 0 ? AR.y + R.range(220, 420) : AR.y + AR.h - R.range(220, 420);
      const a = R.range(0, TAU), sp = R.range(420, 520);
      return {
        team, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: this.ballR, hp: 100, dispHp: 100, flash: 0, dead: false,
        w: { type, name: W.name, ang: R.range(0, TAU), spin: W.spin * R.sign(), baseSpin: W.spin, len: W.len, dmg: W.dmg, cd: W.cd, cdT: 0.5, kb: W.kb, heal: W.heal || 0, arrows: W.arrows || 0, fireT: 0.6 },
      };
    }
    stat(b) {
      const w = b.w;
      switch (w.type) {
        case 'sword': return `DMG ${Math.max(1, Math.round(w.dmg * this.dmgBase))}`;
        case 'dagger': return `SPIN ${(Math.abs(w.spin) / w.baseSpin).toFixed(1)}×`;
        case 'spear': return `REACH ${Math.round(w.len)}`;
        case 'hammer': return `POWER ${Math.max(1, Math.round(w.dmg * this.dmgBase))}`;
        case 'scythe': return `HEAL +${w.heal}`;
        case 'bow': return `ARROWS ${w.arrows}`;
      }
      return '';
    }
    upgrade(b) {
      const w = b.w;
      switch (w.type) {
        case 'sword': w.dmg += 1.5; return 'SHARPER';
        case 'dagger': w.spin = Math.sign(w.spin) * Math.min(Math.abs(w.spin) * 1.12, 30); return 'FASTER';
        case 'spear': w.len = Math.min(w.len + 22, 360); return '+22 REACH';
        case 'hammer': w.dmg += 1; w.kb += 50; return 'HEAVIER';
        case 'scythe': w.heal += 1; return '+1 HEAL';
        case 'bow': w.arrows = Math.min(w.arrows + 1, 9); return '+1 ARROW';
      }
      return '';
    }
    caps(b) {
      const S = b.r / 62;
      return this.baseCaps(b).map(c => [c[0] * S, c[1] * S, c[2] * S, c[3] * S, c[4] * S]);
    }
    baseCaps(b) {
      const r = 62, L = b.w.len;
      switch (b.w.type) {
        case 'sword': return [[r + 14, 0, r + L, 0, 20]];
        case 'dagger': return [[r + 10, 0, r + L, 0, 18]];
        case 'spear': return [[r + 6, 0, r + L - 34, 0, 10], [r + L - 40, 0, r + L, 0, 22]];
        case 'hammer': return [[r + 6, 0, r + L, 0, 12], [r + L, -38, r + L, 38, 38]];
        case 'scythe': return [[r + 6, 0, r + L, 0, 12], [r + L, 0, r + L - 24, 50, 18], [r + L - 24, 50, r + L - 72, 76, 12]];
        case 'bow': return [[r + 22, -62, r + 22, 62, 12]];
      }
      return [];
    }
    worldCaps(b) {
      const c = Math.cos(b.w.ang), s = Math.sin(b.w.ang);
      return this.caps(b).map(([x1, y1, x2, y2, w]) => [b.x + x1 * c - y1 * s, b.y + x1 * s + y1 * c, b.x + x2 * c - y2 * s, b.y + x2 * s + y2 * c, w]);
    }
    hit(A, B, px, py, dmgIn, viaArrow) {
      const dmg = Math.max(1, Math.round(dmgIn * this.dmgMul * this.dmgBase));
      B.hp -= dmg; B.flash = 1;
      let nx = B.x - A.x, ny = B.y - A.y;
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const kb = viaArrow ? A.w.kb * 0.4 : A.w.kb;
      B.vx += nx * kb; B.vy += ny * kb;
      if (!viaArrow) { A.vx -= nx * kb * 0.3; A.vy -= ny * kb * 0.3; }
      this.float(px, py - 20, `-${dmg}`, COL.white, viaArrow ? 46 : 64);
      this.burst(px, py, TEAMS[B.team].c, viaArrow ? 8 : 18, viaArrow ? 380 : 650, 0.5, 9);
      this.shake(viaArrow ? 5 : 15);
      this.freeze = Math.max(this.freeze, viaArrow ? 0.02 : 0.06);
      this.snd(viaArrow ? 'thunk' : 'hit', { power: dmg, pan: (px - AR.x) / AR.w * 1.4 - 0.7 });
      if (A.w.heal && !viaArrow) {
        const before = A.hp; A.hp = Math.min(100, A.hp + A.w.heal);
        if (A.hp > before) this.float(A.x, A.y - A.r - 30, `+${Math.round(A.hp - before)} HP`, COL.gold, 40);
      }
      if (B.hp <= 0) this.ko(A, B);
    }
    ko(A, B) {
      B.hp = 0; B.dead = true;
      this.burst(B.x, B.y, TEAMS[B.team].c, 70, 1100, 0.9, 14);
      this.burst(B.x, B.y, COL.white, 30, 700, 0.6, 8);
      this.shake(34);
      this.freeze = 0.25;
      this.snd('ko');
      this.end(A.team, `${A.w.name} WINS`, `${TEAMS[A.team].name} · ${Math.ceil(A.hp)} HP LEFT`);
    }
    step(h) {
      const R = this.R;
      this.fightT += h;
      const [A, B] = this.balls;
      if (this.dmgMul === 1 && this.fightT >= this.suddenAt) {
        this.dmgMul = 2; this.banner('SUDDEN DEATH · DMG ×2', COL.gold, 2.2); this.snd('alarm');
      }
      for (const b of this.balls) {
        const o = b === A ? B : A;
        if (this.gravity) b.vy += this.gravity * h;
        const dx = o.x - b.x, dy = o.y - b.y, d = Math.hypot(dx, dy) || 1;
        const pull = b.w.type === 'bow' && d < 430 ? -0.8 * this.attract : this.attract;
        b.vx += (dx / d) * pull * h; b.vy += (dy / d) * pull * h;
        b.x += b.vx * h; b.y += b.vy * h;
        let wall = false;
        if (b.x - b.r < AR.x) { b.x = AR.x + b.r; b.vx = Math.abs(b.vx); wall = true; }
        else if (b.x + b.r > AR.x + AR.w) { b.x = AR.x + AR.w - b.r; b.vx = -Math.abs(b.vx); wall = true; }
        if (b.y - b.r < AR.y) { b.y = AR.y + b.r; b.vy = Math.abs(b.vy); wall = true; }
        else if (b.y + b.r > AR.y + AR.h) { b.y = AR.y + AR.h - b.r; b.vy = -Math.abs(b.vy); wall = true; }
        if (wall) this.snd('wall', { pan: (b.x - AR.x) / AR.w * 1.4 - 0.7 });
        const sp = Math.hypot(b.vx, b.vy);
        const mn = this.vmin, mx = this.vmax;
        if (sp < mn) { b.vx *= mn / (sp || 1); b.vy *= mn / (sp || 1); }
        else if (sp > mx) { b.vx *= mx / sp; b.vy *= mx / sp; }
        b.w.ang += b.w.spin * h;
        b.w.cdT -= h;
      }
      this.parryCd -= h;
      // ball-ball elastic bounce
      {
        const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy), m = A.r + B.r;
        if (d < m && d > 0) {
          const nx = dx / d, ny = dy / d, ov = (m - d) / 2;
          A.x -= nx * ov; A.y -= ny * ov; B.x += nx * ov; B.y += ny * ov;
          const va = A.vx * nx + A.vy * ny, vb = B.vx * nx + B.vy * ny;
          if (va - vb > 0) {
            A.vx += (vb - va) * nx; A.vy += (vb - va) * ny; B.vx += (va - vb) * nx; B.vy += (va - vb) * ny;
            this.snd('bonk', { pan: (A.x + B.x) / 2 / VW * 1.4 - 0.7 });
          }
        }
      }
      const ca = this.worldCaps(A), cb = this.worldCaps(B);
      // parry: weapons touching each other
      let parried = false;
      if (this.parryCd <= 0) {
        outer: for (const p of ca) for (const q of cb) {
          const r = segSeg(p[0], p[1], p[2], p[3], q[0], q[1], q[2], q[3]);
          if (r.d < (p[4] + q[4]) / 2) {
            A.w.spin = -A.w.spin; B.w.spin = -B.w.spin;
            this.parryCd = 0.14;
            A.w.cdT = Math.max(A.w.cdT, 0.08); B.w.cdT = Math.max(B.w.cdT, 0.08);
            let nx = B.x - A.x, ny = B.y - A.y; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
            A.vx -= nx * 160; A.vy -= ny * 160; B.vx += nx * 160; B.vy += ny * 160;
            this.burst(r.x, r.y, COL.gold, 14, 600, 0.35, 6);
            this.snd('clang', { pan: (r.x - AR.x) / AR.w * 1.4 - 0.7 });
            parried = true;
            break outer;
          }
        }
      }
      if (!parried) {
        const tryHit = (att, def, caps) => {
          if (att.w.type === 'bow' || att.w.cdT > 0 || def.dead || att.dead) return;
          for (const c of caps) {
            const r = distPointSeg(def.x, def.y, c[0], c[1], c[2], c[3]);
            if (r.d < def.r + c[4] / 2) {
              att.w.cdT = att.w.cd;
              this.hit(att, def, r.x, r.y, att.w.dmg, false);
              if (this.phase === 'fight') {
                const up = this.upgrade(att);
                if (up) this.float(att.x, att.y - att.r - 26, up, COL.gold, 38, 1.0);
              }
              return;
            }
          }
        };
        tryHit(A, B, ca);
        if (this.phase === 'fight') tryHit(B, A, cb);
      }
      // bows
      for (const b of this.balls) {
        if (b.w.type !== 'bow' || b.dead || this.phase !== 'fight') continue;
        b.w.fireT -= h;
        const o = b === A ? B : A;
        if (b.w.fireT <= 0) {
          const want = Math.atan2(o.y - b.y, o.x - b.x);
          let diff = ((b.w.ang - want) % TAU + TAU * 1.5) % TAU - Math.PI;
          if (Math.abs(diff) < 0.7) {
            const n = b.w.arrows;
            for (let k = 0; k < n; k++) {
              const a = b.w.ang + (k - (n - 1) / 2) * 0.13;
              this.arrows.push({ team: b.team, owner: b, x: b.x + Math.cos(a) * (b.r * 1.5), y: b.y + Math.sin(a) * (b.r * 1.5), vx: Math.cos(a) * 1500, vy: Math.sin(a) * 1500, volley: this.fightT });
            }
            b.w.fireT = b.w.cd;
            this.snd('shoot', { pan: (b.x - AR.x) / AR.w * 1.4 - 0.7 });
          }
        }
      }
      if (this.arrows.length) {
        const keep = [];
        for (const ar of this.arrows) {
          ar.x += ar.vx * h; ar.y += ar.vy * h;
          if (ar.x < AR.x || ar.x > AR.x + AR.w || ar.y < AR.y || ar.y > AR.y + AR.h) { this.burst(clamp(ar.x, AR.x, AR.x + AR.w), clamp(ar.y, AR.y, AR.y + AR.h), COL.muted, 4, 200, 0.3, 5); continue; }
          const tgt = ar.owner === A ? B : A;
          if (tgt.dead || this.phase !== 'fight') continue;
          let blocked = false;
          for (const c of (tgt === A ? ca : cb)) {
            if (distPointSeg(ar.x, ar.y, c[0], c[1], c[2], c[3]).d < c[4] / 2 + 5) { blocked = true; break; }
          }
          if (blocked && ar.blockRoll === undefined) ar.blockRoll = this.R.next();
          if (blocked && ar.blockRoll < 0.4) { this.burst(ar.x, ar.y, COL.gold, 6, 300, 0.25, 5); this.snd('tink', { pan: (ar.x - AR.x) / AR.w * 1.4 - 0.7 }); continue; }
          if (Math.hypot(ar.x - tgt.x, ar.y - tgt.y) < tgt.r + 4) {
            const own = ar.owner;
            this.hit(own, tgt, ar.x, ar.y, own.w.dmg, true);
            if (this.phase === 'fight' && own.lastVolleyUp !== ar.volley) {
              own.lastVolleyUp = ar.volley;
              this.float(own.x, own.y - own.r - 26, this.upgrade(own), COL.gold, 38, 1.0);
            }
            continue;
          }
          keep.push(ar);
        }
        this.arrows = keep;
      }
      if (this.phase === 'fight' && this.fightT >= this.cap) {
        if (Math.abs(A.hp - B.hp) < 0.01) { this.cap += 2; this.banner('OVERTIME!', COL.gold); }
        else {
          const w = A.hp > B.hp ? A : B, l = w === A ? B : A;
          this.end(w.team, `${w.w.name} WINS`, `ON POINTS · ${Math.ceil(w.hp)} TO ${Math.ceil(l.hp)} HP`);
        }
      }
    }
    outroStep(dt) {
      this.arrows = [];
    }
    cosmetic(dt) {
      for (const b of this.balls) {
        b.flash = Math.max(0, b.flash - dt * 5);
        b.dispHp += (b.hp - b.dispHp) * Math.min(1, dt * 12);
      }
    }
    drawWeapon(ctx, b) {
      const tm = TEAMS[b.team], r = 62, L = b.w.len, S = b.r / 62;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.w.ang);
      ctx.scale(S, S);
      ctx.lineJoin = 'round';
      const outline = () => { ctx.lineWidth = 4; ctx.strokeStyle = COL.ink; ctx.stroke(); };
      switch (b.w.type) {
        case 'sword': {
          ctx.beginPath(); ctx.rect(r - 10, -7, 26, 14); ctx.fillStyle = tm.d; ctx.fill(); outline();
          ctx.beginPath(); ctx.moveTo(r + 18, -11); ctx.lineTo(r + L - 30, -11); ctx.lineTo(r + L, 0); ctx.lineTo(r + L - 30, 11); ctx.lineTo(r + 18, 11); ctx.closePath();
          ctx.fillStyle = COL.steel; ctx.fill(); outline();
          ctx.beginPath(); ctx.moveTo(r + 26, 0); ctx.lineTo(r + L - 36, 0); ctx.lineWidth = 3; ctx.strokeStyle = COL.steelD; ctx.stroke();
          ctx.beginPath(); ctx.rect(r + 10, -30, 12, 60); ctx.fillStyle = COL.gold; ctx.fill(); outline();
          break;
        }
        case 'dagger': {
          ctx.beginPath(); ctx.rect(r - 8, -6, 20, 12); ctx.fillStyle = tm.d; ctx.fill(); outline();
          ctx.beginPath(); ctx.moveTo(r + 14, -10); ctx.quadraticCurveTo(r + L * 0.6, -14, r + L, 0); ctx.quadraticCurveTo(r + L * 0.6, 12, r + 14, 10); ctx.closePath();
          ctx.fillStyle = COL.steel; ctx.fill(); outline();
          ctx.beginPath(); ctx.rect(r + 8, -20, 8, 40); ctx.fillStyle = COL.gold; ctx.fill(); outline();
          break;
        }
        case 'spear': {
          ctx.beginPath(); ctx.rect(r - 6, -5, L - 34, 10); ctx.fillStyle = COL.wood; ctx.fill(); outline();
          ctx.beginPath(); ctx.rect(r + 4, -7, 22, 14); ctx.fillStyle = tm.c; ctx.fill(); outline();
          ctx.beginPath(); ctx.moveTo(r + L - 48, 0); ctx.lineTo(r + L - 34, -14); ctx.lineTo(r + L, 0); ctx.lineTo(r + L - 34, 14); ctx.closePath();
          ctx.fillStyle = COL.steel; ctx.fill(); outline();
          break;
        }
        case 'hammer': {
          ctx.beginPath(); ctx.rect(r - 6, -6, L, 12); ctx.fillStyle = COL.woodD; ctx.fill(); outline();
          ctx.beginPath(); ctx.rect(r + L - 24, -42, 48, 84); ctx.fillStyle = COL.steelD; ctx.fill(); outline();
          ctx.beginPath(); ctx.rect(r + L - 24, -42, 48, 14); ctx.fillStyle = tm.c; ctx.fill(); outline();
          ctx.beginPath(); ctx.rect(r + L - 24, 28, 48, 14); ctx.fillStyle = tm.c; ctx.fill(); outline();
          break;
        }
        case 'scythe': {
          ctx.beginPath(); ctx.rect(r - 6, -6, L + 4, 12); ctx.fillStyle = COL.woodD; ctx.fill(); outline();
          ctx.beginPath(); ctx.moveTo(r + L + 2, -8); ctx.quadraticCurveTo(r + L + 8, 52, r + L - 84, 84); ctx.quadraticCurveTo(r + L - 20, 42, r + L - 12, 4); ctx.closePath();
          ctx.fillStyle = COL.steel; ctx.fill(); outline();
          ctx.beginPath(); ctx.rect(r + 2, -8, 20, 16); ctx.fillStyle = tm.c; ctx.fill(); outline();
          break;
        }
        case 'bow': {
          ctx.beginPath(); ctx.moveTo(r + 4, -64); ctx.lineTo(r + 4, 64); ctx.lineWidth = 2.5; ctx.strokeStyle = COL.white; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(r + 4, -64); ctx.quadraticCurveTo(r + 48, 0, r + 4, 64);
          ctx.lineWidth = 16; ctx.strokeStyle = COL.ink; ctx.stroke();
          ctx.lineWidth = 9; ctx.strokeStyle = COL.wood; ctx.stroke();
          ctx.beginPath(); ctx.rect(r + 18, -10, 14, 20); ctx.fillStyle = tm.c; ctx.fill(); outline();
          break;
        }
      }
      ctx.restore();
    }
    draw(ctx) {
      this.drawBG(ctx);
      const [A, B] = this.balls;
      this.drawHUD(ctx, {
        title: this.title, hook: this.hook,
        lv: String(Math.max(0, Math.ceil(A.dispHp - 0.05))), rv: String(Math.max(0, Math.ceil(B.dispHp - 0.05))),
        ls: `${A.w.name} · ${this.stat(A)}`, rs: `${this.stat(B)} · ${B.w.name}`,
        ratio: (A.dispHp + 0.001) / (A.dispHp + B.dispHp + 0.002),
      });
      ctx.save();
      ctx.translate(this.shakeX, this.shakeY);
      roundRect(ctx, AR.x, AR.y, AR.w, AR.h, 18);
      ctx.fillStyle = COL.floor; ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = COL.grid; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = AR.x + 60; x < AR.x + AR.w; x += 60) { ctx.moveTo(x, AR.y); ctx.lineTo(x, AR.y + AR.h); }
      for (let y = AR.y + 60; y < AR.y + AR.h; y += 60) { ctx.moveTo(AR.x, y); ctx.lineTo(AR.x + AR.w, y); }
      ctx.stroke();
      if (this.dmgMul > 1) { ctx.fillStyle = `rgba(255,210,63,${0.05 + 0.04 * Math.sin(this.t * 6)})`; ctx.fillRect(AR.x, AR.y, AR.w, AR.h); }
      for (const b of this.balls) {
        if (b.dead) continue;
        ctx.beginPath(); ctx.ellipse(b.x + 8, b.y + 14, b.r, b.r * 0.92, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
      }
      for (const ar of this.arrows) {
        const a = Math.atan2(ar.vy, ar.vx);
        ctx.save(); ctx.translate(ar.x, ar.y); ctx.rotate(a);
        ctx.lineWidth = 5; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(6, 0); ctx.stroke();
        ctx.lineWidth = 3; ctx.strokeStyle = COL.steel; ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(6, 0); ctx.stroke();
        ctx.fillStyle = COL.steel; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(2, -7); ctx.lineTo(2, 7); ctx.closePath(); ctx.fill();
        ctx.fillStyle = TEAMS[ar.team].c; ctx.fillRect(-46, -6, 12, 12);
        ctx.restore();
      }
      for (const b of this.balls) if (!b.dead) this.drawWeapon(ctx, b);
      for (const b of this.balls) {
        if (b.dead) continue;
        const tm = TEAMS[b.team];
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 5, 0, TAU); ctx.fillStyle = COL.ink; ctx.fill();
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fillStyle = tm.c; ctx.fill();
        ctx.beginPath(); ctx.arc(b.x - b.r * 0.28, b.y - b.r * 0.3, b.r * 0.42, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
        if (b.flash > 0) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fillStyle = `rgba(255,255,255,${b.flash * 0.85})`; ctx.fill(); }
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = font(Math.round(b.r * 0.95), 800);
        strokeText(ctx, String(Math.max(0, Math.ceil(b.dispHp - 0.05))), b.x, b.y + 3, COL.white, COL.ink, 8);
        ctx.textBaseline = 'alphabetic';
      }
      ctx.restore();
      ctx.restore();
      this.drawArenaFrame(ctx);
      this.drawFX(ctx);
      this.drawBanners(ctx);
      this.drawFooter(ctx, this.dmgMul > 1 ? 'SUDDEN DEATH' : 'FIGHT TIME', fmtTime(this.fightT), false);
      this.drawIntro(ctx, 'FIGHT!');
      this.drawOutro(ctx);
    }
  }

  // =====================================================================
  // 3) ARMY CLASH — two armies with different doctrines collide.
  // =====================================================================
  const UNIT = {
    soldier: { r: 12, hp: 7, dmg: 1, cd: 0.55, reach: 4, speed: 92, cost: 1, rank: 2, armor: 1 },
    archer: { r: 11, hp: 4, dmg: 1, cd: 1.35, range: 300, speed: 84, cost: 1.4, ranged: true, rank: 3, armor: 1 },
    crossbowman: { r: 12, hp: 6, dmg: 4, cd: 2.4, range: 380, speed: 76, cost: 2.4, ranged: true, bolt: 1300, rank: 3, armor: 0.9 },
    swordsman: { r: 14, hp: 13, dmg: 2, cd: 0.6, reach: 6, speed: 86, cost: 2, rank: 1, armor: 0.8 },
    // spearman: long reach, so he can stab from the second rank
    spearman: { r: 12, hp: 8, dmg: 2, cd: 0.9, reach: 18, speed: 84, cost: 1.8, rank: 2, armor: 0.9 },
    // shieldbearer: slow wall; arrows barely hurt him and his shield blocks 40% of melee damage
    shieldbearer: { r: 16, hp: 26, dmg: 1, cd: 0.8, reach: 4, speed: 66, cost: 2.4, rank: 1, armor: 0.25, block: 0.6 },
    // berserker: fast and hits hard with an axe, but fragile
    berserker: { r: 13, hp: 10, dmg: 3, cd: 0.5, reach: 5, speed: 112, cost: 2.4, rank: 1, armor: 1 },
    // healer: never attacks; stays behind the line and patches up the most hurt ally nearby
    healer: { r: 11, hp: 6, dmg: 0, cd: 1.6, range: 170, speed: 80, cost: 2, healer: true, heal: 4, healRange: 130, rank: 3, armor: 1 },
    // ----- modern warfare -----
    // rifleman: the modern basic troop, fires single shots
    rifleman: { r: 11, hp: 6, dmg: 1.4, cd: 0.9, range: 330, speed: 80, cost: 1.3, ranged: true, bullet: 1600, rank: 3, armor: 1 },
    // machine gunner: rapid, inaccurate bursts
    gunner: { r: 13, hp: 9, dmg: 0.6, cd: 0.16, range: 300, speed: 62, cost: 2.6, ranged: true, bullet: 1700, spread: 0.12, rank: 2, armor: 0.9 },
    // sniper: very long range, slow, one hard hit that cuts through armour
    sniper: { r: 11, hp: 5, dmg: 7, cd: 3.0, range: 560, speed: 70, cost: 2.6, ranged: true, bullet: 2600, pierce: 0.6, rank: 4, armor: 1 },
    // grenadier: lobs grenades that explode over an area
    grenadier: { r: 12, hp: 7, dmg: 3, cd: 2.6, range: 260, speed: 76, cost: 2.4, ranged: true, lob: 'grenade', bullet: 520, splash: 42, rank: 3, armor: 1 },
    // tank: armoured, slow, fires shells that blow up groups (one per ARMORED army, like the giant)
    tank: { r: 30, hp: 90, dmg: 6, cd: 2.2, range: 340, speed: 44, cost: 18, ranged: true, lob: 'shell', bullet: 900, splash: 54, rank: 0, armor: 0.2 },
    // ----- fantasy -----
    // wizard: hurls fireballs that burst over an area
    wizard: { r: 12, hp: 6, dmg: 3.5, cd: 2.2, range: 300, speed: 74, cost: 2.6, ranged: true, lob: 'fireball', bullet: 620, splash: 40, rank: 3, armor: 1 },
    // dragon: one per DRAGON army; flies over everything and breathes fire in a cone
    dragon: { r: 34, hp: 95, dmg: 2.4, cd: 0.35, reach: 60, speed: 60, cost: 20, breath: 120, rank: 0, armor: 0.45, flying: true },
    // orc: tough brute with a club
    orc: { r: 15, hp: 16, dmg: 2.5, cd: 0.7, reach: 5, speed: 88, cost: 2.2, rank: 1, armor: 0.9 },
    // skeleton: cheap and fast; arrows and bullets mostly pass through the bones
    skeleton: { r: 11, hp: 4, dmg: 1, cd: 0.6, reach: 4, speed: 96, cost: 0.6, rank: 2, armor: 0.6 },
    // elf: quick archer with long range
    elf: { r: 11, hp: 5, dmg: 1.3, cd: 0.8, range: 360, speed: 100, cost: 1.8, ranged: true, rank: 3, armor: 1 },
    knight: { r: 18, hp: 24, dmg: 2, cd: 0.8, reach: 5, speed: 70, cost: 3.2, rank: 1, armor: 0.4 },
    giant: { r: 36, hp: 110, dmg: 5, cd: 1.25, reach: 6, speed: 46, cost: 22, splash: 48, rank: 0, armor: 0.5 },
    // ----- sci-fi -----
    // trooper: laser rifle, fast glowing bolts
    trooper: { r: 11, hp: 6, dmg: 1.3, cd: 0.7, range: 340, speed: 84, cost: 1.4, ranged: true, bullet: 2000, laser: true, sound: 'zap', rank: 3, armor: 0.9 },
    // robot: metal brawler; arrows and bullets mostly glance off
    robot: { r: 15, hp: 18, dmg: 2.4, cd: 0.8, reach: 5, speed: 70, cost: 2.6, rank: 1, armor: 0.5 },
    // mech: one per MECHS army; walks on two legs and fires salvos of three rockets
    mech: { r: 32, hp: 100, dmg: 3, cd: 2.4, range: 360, speed: 44, cost: 20, ranged: true, lob: 'rocket', bullet: 700, splash: 40, salvo: 3, sound: 'rocket', rank: 0, armor: 0.25 },
    // ----- pirates -----
    // pirate: quick cutlass fighter
    pirate: { r: 12, hp: 9, dmg: 2, cd: 0.6, reach: 6, speed: 96, cost: 1.4, rank: 2, armor: 1 },
    // musketeer: slow to reload, one big hit, and a puff of smoke
    musketeer: { r: 12, hp: 6, dmg: 3.2, cd: 2.6, range: 300, speed: 74, cost: 2, ranged: true, bullet: 1500, sound: 'musket', rank: 3, armor: 1 },
    // cannon: one per BUCCANEERS army; rolled forward slowly, lobs cannonballs from far away
    cannon: { r: 26, hp: 60, dmg: 5, cd: 3, range: 400, speed: 26, cost: 14, ranged: true, lob: 'cannonball', bullet: 760, splash: 46, sound: 'cannon', rank: 0, armor: 0.3 },
    // ----- horror -----
    // zombie: slow and cheap; anyone living it kills gets back up as a zombie on its side
    zombie: { r: 12, hp: 9, dmg: 1.5, cd: 0.9, reach: 4, speed: 58, cost: 0.9, rank: 2, armor: 0.9, infect: true },
    // ----- samurai -----
    // ninja: very fast, dodges almost half of the arrows and bullets aimed at it
    ninja: { r: 11, hp: 7, dmg: 2.2, cd: 0.45, reach: 5, speed: 122, cost: 1.8, rank: 2, armor: 1, dodge: 0.45 },
    // samurai: armoured swordsman with a katana
    samurai: { r: 14, hp: 16, dmg: 3, cd: 0.75, reach: 7, speed: 82, cost: 3, rank: 1, armor: 0.6, sword: true },
    // ----- horror -----
    // vampire: quick night stalker with a cape; every bite heals it by half the damage it deals
    vampire: { r: 12, hp: 10, dmg: 2.2, cd: 0.6, reach: 5, speed: 104, cost: 2.2, rank: 1, armor: 0.9, drain: 0.5 },
    // ===== the big troop batch (each one has its own trick; see ARMY_EXT below) =====
    // ----- Human Empire -----
    // pikeman: very long reach, triple damage against cavalry and big units
    pikeman: { r: 12, hp: 9, dmg: 1.8, cd: 0.95, reach: 22, speed: 72, cost: 1.5, rank: 2, armor: 0.85, antiBig: 3 },
    // duelist: two swords, very fast attacks
    duelist: { r: 12, hp: 9, dmg: 1.5, cd: 0.32, reach: 5, speed: 96, cost: 2, rank: 1, armor: 1 },
    // royal guard: elite defender with a halberd; blocks a quarter of every blade that hits it
    royalguard: { r: 15, hp: 26, dmg: 2.2, cd: 0.85, reach: 12, speed: 66, cost: 3.6, rank: 1, armor: 0.35, block: 0.75 },
    // lancer: heavy cavalry; a run-up turns the next hit into a charge (triple damage, sends the target flying), then it wheels away to charge again
    lancer: { r: 17, hp: 20, dmg: 2.6, cd: 0.9, reach: 6, speed: 124, cost: 4, rank: 1, armor: 0.5, mount: 'horse', charge: 3, knock: 26 },
    // horse archer: shoots while riding circles around its target
    horsearcher: { r: 16, hp: 12, dmg: 1.2, cd: 0.75, range: 300, speed: 116, cost: 3, ranged: true, rank: 2, armor: 0.85, mount: 'horse', kite: true },
    // longbowman: the longest range of any archer
    longbow: { r: 11, hp: 5, dmg: 1.6, cd: 1.3, range: 520, speed: 74, cost: 1.8, ranged: true, rank: 3, armor: 1 },
    // fire archer: flaming arrows set troops alight (damage over 3 seconds)
    firearcher: { r: 11, hp: 5, dmg: 1.1, cd: 1.0, range: 340, speed: 80, cost: 1.9, ranged: true, burn: 1.2, shot: 'firearrow', rank: 3, armor: 1 },
    // poison hunter: darts that poison (damage over 4 seconds, and a little slower)
    poisoner: { r: 11, hp: 6, dmg: 0.9, cd: 0.9, range: 300, speed: 84, cost: 1.8, ranged: true, poison: 1.0, shot: 'dart', rank: 3, armor: 1 },
    // standard bearer: allies near the banner take 20% less damage; if it falls, they panic for a moment
    bannerman: { r: 12, hp: 10, dmg: 1, cd: 1, reach: 5, speed: 70, cost: 2.4, rank: 3, armor: 0.9, aura: { def: 0.8, r: 150 }, commander: 1 },
    // drummer: allies near the drum attack 25% faster
    drummer: { r: 12, hp: 8, dmg: 0.8, cd: 1, reach: 5, speed: 70, cost: 2.2, rank: 3, armor: 1, aura: { haste: 0.75, r: 150 } },
    // general: on a white horse; allies nearby hit 20% harder, and the whole army panics for 3 seconds if the general falls
    general: { r: 16, hp: 34, dmg: 2.6, cd: 0.8, reach: 6, speed: 72, cost: 6, rank: 3, armor: 0.45, aura: { dmg: 1.2, r: 180 }, commander: 2, mount: 'horse' },
    // peasant: cheap, with a pitchfork (the Forbidden Army starts with nothing else)
    peasant: { r: 11, hp: 6, dmg: 1.1, cd: 0.8, reach: 8, speed: 82, cost: 1.1, rank: 2, armor: 1 },
    // war elephant: tramples whatever it walks through and throws troops aside
    elephant: { r: 34, hp: 100, dmg: 4, cd: 1.3, reach: 6, speed: 50, cost: 18, rank: 0, armor: 0.45, trample: 3, knock: 40, mount: 'elephant' },
    // ----- Undead Legion -----
    // necromancer: green soul bolts, and every few seconds raises fallen troops nearby as skeletons on its side
    necromancer: { r: 12, hp: 7, dmg: 1.2, cd: 1.4, range: 260, speed: 72, cost: 3.5, ranged: true, bullet: 900, shot: 'soul', raise: 5, rank: 3, armor: 1, sound: 'zap' },
    // bone colossus: what twelve skeletons become when they fuse (see LEGION)
    bonecolossus: { r: 40, hp: 130, dmg: 5, cd: 1.3, reach: 6, splash: 50, speed: 44, cost: 22, rank: 0, armor: 0.45 },
    // dread knight: boss on a nightmare horse; hunts generals and big units, and grows stronger with every important kill
    deathknight: { r: 20, hp: 70, dmg: 4, cd: 0.8, reach: 7, speed: 88, cost: 14, rank: 0, armor: 0.4, mount: 'nightmare', boss: true, hunter: 'commander', empower: true },
    // ----- Orc Horde -----
    // wolf rider: the fastest troop; goes around the front line for archers, gunners and healers
    wolfrider: { r: 15, hp: 12, dmg: 2, cd: 0.6, reach: 5, speed: 150, cost: 2.6, rank: 1, armor: 0.9, mount: 'wolf', hunter: 'ranged' },
    // boar rider: charges, and every hit knocks the target back
    boarrider: { r: 16, hp: 18, dmg: 2.4, cd: 0.9, reach: 5, speed: 110, cost: 3, rank: 1, armor: 0.7, mount: 'boar', charge: 2, knock: 34 },
    // troll: heals itself all the time (fire stops it)
    troll: { r: 21, hp: 44, dmg: 3.2, cd: 1.1, reach: 6, speed: 64, cost: 6, rank: 1, armor: 0.7, regen: 2.2 },
    // cyclops: a one-eyed giant that throws boulders into formations
    cyclops: { r: 34, hp: 100, dmg: 5, cd: 2.8, range: 360, speed: 42, cost: 20, ranged: true, lob: 'boulder', bullet: 600, splash: 52, sound: 'stomp', rank: 0, armor: 0.5 },
    // ----- Sylvan Kingdom -----
    // druid: a healing pulse for everyone around it, which also gives them bark skin (25% less damage for 3 seconds)
    druid: { r: 12, hp: 8, dmg: 0, cd: 2.5, range: 170, speed: 78, cost: 2.6, healer: true, pulse: true, heal: 2.2, healRange: 130, rank: 3, armor: 1 },
    // treant: a walking tree; its hits root troops in place (fire hurts it more)
    treant: { r: 22, hp: 52, dmg: 2.6, cd: 1.2, reach: 8, speed: 52, cost: 5, rank: 1, armor: 0.6, slow: [0.4, 1.6], fireweak: 1.6 },
    // illusionist: makes fake troops that enemies attack instead
    illusionist: { r: 12, hp: 6, dmg: 0.8, cd: 1.1, range: 260, speed: 80, cost: 2.6, ranged: true, bullet: 800, shot: 'spark', decoys: 5, rank: 3, armor: 1, sound: 'zap' },
    // ----- Infernal Dominion -----
    // imp: small flying fire-spitter
    imp: { r: 9, hp: 4, dmg: 0.9, cd: 0.7, range: 220, speed: 130, cost: 1, ranged: true, bullet: 700, shot: 'firebolt', burn: 0.5, flying: true, fireproof: true, rank: 2, armor: 1, sound: 'flame' },
    // demon: gets stronger the more troops have died in the battle
    demon: { r: 18, hp: 30, dmg: 3, cd: 0.8, reach: 6, speed: 84, cost: 5, rank: 1, armor: 0.7, fireproof: true, rampage: true },
    // hellhound: fast, and its bite sets troops alight
    hellhound: { r: 14, hp: 12, dmg: 1.8, cd: 0.5, reach: 5, speed: 140, cost: 2.4, rank: 1, armor: 0.9, burn: 1, fireproof: true },
    // warlock: hellfire that leaves the ground burning; once per battle, its army takes over the enemy's biggest unit
    warlock: { r: 12, hp: 7, dmg: 2.4, cd: 2.4, range: 300, speed: 72, cost: 3, ranged: true, lob: 'hellfire', bullet: 600, splash: 44, burn: 1.2, possess: true, rank: 3, armor: 1, sound: 'flame' },
    // ----- Dwarven Foundries -----
    dwarf: { r: 13, hp: 16, dmg: 2.2, cd: 0.75, reach: 5, speed: 68, cost: 2.4, rank: 1, armor: 0.55 },
    // goblin engineer: builds up to two crossbow turrets as it goes
    engineer: { r: 11, hp: 6, dmg: 0.8, cd: 0.9, reach: 5, speed: 90, cost: 2.4, rank: 2, armor: 1, gadget: 6 },
    turret: { r: 14, hp: 14, dmg: 0.9, cd: 0.55, range: 300, speed: 0, cost: 1, ranged: true, bolt: 1100, rank: 2, armor: 0.6, uncounted: true, immovable: true, sound: 'volley' },
    // stone golem: can't be knocked back or pushed around
    golem: { r: 26, hp: 80, dmg: 3.5, cd: 1.2, reach: 6, speed: 46, cost: 12, rank: 0, armor: 0.35, immovable: true },
    // ----- monsters and bosses -----
    // hydra: three heads that each bite a different troop (five once it's badly hurt)
    hydra: { r: 32, hp: 110, dmg: 2.2, cd: 0.7, reach: 40, heads: 3, speed: 46, cost: 20, rank: 0, armor: 0.5, boss: true },
    // ancient titan: stomps groups flat, throws troops aside and smashes walls
    titan: { r: 46, hp: 190, dmg: 6, cd: 1.5, reach: 8, splash: 70, knock: 50, speed: 40, cost: 34, rank: 0, armor: 0.35, boss: true, smash: true, immovable: true },
    // phoenix: flies and breathes fire; comes back once from its ashes, and leaves a firestorm when it falls for good
    phoenix: { r: 28, hp: 60, dmg: 1.8, cd: 0.35, reach: 50, breath: 100, speed: 70, cost: 18, rank: 0, armor: 0.6, flying: true, fireproof: true, revive: 1 },
    // walking fortress: a castle on legs; archers on its walls shoot three targets at once, a cannon fires from the gate,
    // and when it falls its garrison pours out
    fortress: { r: 44, hp: 200, dmg: 1.4, cd: 0.9, range: 380, speed: 26, cost: 32, ranged: true, volley: 3, rank: 0, armor: 0.25, boss: true, garrison: true, immovable: true },
    // griffin rider: flying cavalry that dives at its target
    griffin: { r: 22, hp: 26, dmg: 2.6, cd: 0.7, reach: 6, speed: 112, cost: 6, rank: 1, armor: 0.7, flying: true, mount: 'griffin', charge: 2 },
    // ----- strange new troops -----
    // mirror knight: becomes a copy of the last enemy troop that hits it (looks, weapon and all)
    mirrorknight: { r: 15, hp: 20, dmg: 2, cd: 0.8, reach: 5, speed: 74, cost: 3.2, rank: 1, armor: 0.55, mirror: true },
    // phase reaper: vanishes, passes through the enemy lines, and reappears behind its target for a huge hit
    phasereaper: { r: 13, hp: 12, dmg: 3.2, cd: 0.8, reach: 6, speed: 100, cost: 3.4, rank: 1, armor: 0.9, phase: 5 },
    // plague alchemist: flasks that leave a poison cloud (slows and poisons whoever is inside)
    alchemist: { r: 12, hp: 7, dmg: 1.2, cd: 2.6, range: 260, speed: 76, cost: 2.6, ranged: true, lob: 'flask', bullet: 520, splash: 55, poison: 1.2, rank: 3, armor: 1, sound: 'swish' },
    // gravity monk: pulls nearby enemies together into a clump
    gravitymonk: { r: 12, hp: 10, dmg: 1.4, cd: 0.7, reach: 5, speed: 84, cost: 3, rank: 2, armor: 0.9, gravity: 6 },
    // soul smith: collects the souls of the fallen and forges armour and weapons for nearby allies (25% harder hits, 20% less damage)
    soulsmith: { r: 13, hp: 12, dmg: 1.4, cd: 0.9, reach: 5, speed: 72, cost: 3, rank: 3, armor: 0.8, soul: true },
    // false soldier: looks like an ordinary soldier until an enemy gets close, then bursts into spikes and leaves scarecrow decoys
    falsesoldier: { r: 11, hp: 6, dmg: 1, cd: 0.8, reach: 5, speed: 80, cost: 2, rank: 2, armor: 1, trap: true },
    // fortress turtle: plants itself when enemies come near; its shell then soaks up shots meant for the troops behind it
    turtle: { r: 26, hp: 60, dmg: 2, cd: 1.2, reach: 6, speed: 38, cost: 9, rank: 1, armor: 0.3, plant: true },
    // a fake troop (illusions, scarecrows): enemies go for it first; it never attacks and isn't counted
    decoy: { r: 11, hp: 1, dmg: 0, cd: 9, reach: 0, speed: 0, cost: 0, rank: 2, armor: 1, uncounted: true, decoy: true },
    // ----- mythic troops that break the rules -----
    // the Thousand-Man: every troop it kills joins its body, so it keeps growing (and starts stomping)
    thousandman: { r: 26, hp: 70, dmg: 3, cd: 0.9, reach: 6, speed: 56, cost: 16, rank: 0, armor: 0.6, grow: true },
    // copycat: a shapeshifter; an army of them copies the biggest enemy unit every few seconds (see COPYCATS)
    copycat: { r: 12, hp: 8, dmg: 1.6, cd: 0.7, reach: 5, speed: 90, cost: 1.8, rank: 2, armor: 1 },
    // the Immortal Fraud: comes back four times, each time stronger but with a new weakness; the last time as a boss
    immortal: { r: 16, hp: 24, dmg: 2.4, cd: 0.7, reach: 6, speed: 82, cost: 8, rank: 0, armor: 0.8, revive: 4, fraud: true },
    // the Mirror King: troops that hit it can spawn a mirrored copy of themselves on its side
    mirrorking: { r: 24, hp: 90, dmg: 3, cd: 0.9, reach: 6, speed: 54, cost: 18, rank: 0, armor: 0.5, copies: true, boss: true },
    // the Eye of the Unmaker: looks at the strongest enemy and changes it (troops become sheep; armour turns to flesh; fliers fall)
    unmaker: { r: 20, hp: 50, dmg: 1.2, cd: 1.2, range: 300, speed: 60, cost: 14, ranged: true, bullet: 1200, shot: 'beam', flying: true, unmake: 3.5, rank: 0, armor: 0.6, sound: 'zap' },
    // the Billionaire: never fights; bribes enemy troops to switch sides
    billionaire: { r: 14, hp: 10, dmg: 0, cd: 4, range: 380, speed: 76, cost: 7, healer: true, heal: 0, healRange: 0, bribe: 4, rank: 3, armor: 1 },
    // the Gravity Tyrant: drags every enemy around it in, then slams the ground
    gravitytyrant: { r: 26, hp: 100, dmg: 3, cd: 1, reach: 6, speed: 50, cost: 18, rank: 0, armor: 0.45, well: 7, boss: true },
    // the Meteor Shepherd: calls meteors down on the thickest groups of enemies, bigger the longer it lives
    meteorshepherd: { r: 14, hp: 18, dmg: 1, cd: 1, reach: 5, speed: 66, cost: 9, rank: 3, armor: 0.8, shepherd: 4 },
    // the Glitch: changes the rules every few seconds (swaps troops around, turbo speed, zero gravity, clones itself)
    glitch: { r: 13, hp: 14, dmg: 1.6, cd: 0.6, reach: 5, speed: 100, cost: 6, rank: 1, armor: 0.9, glitch: 7 },
    // ===== second batch: more magic, war beasts, siege, and the rest of the crazy ideas (abilities in ARMY_EXT2) =====
    // frost witch: frost bolts that slow everyone they splash, sometimes freezing them solid for a moment
    frostwitch: { r: 12, hp: 7, dmg: 1.4, cd: 2.2, range: 290, speed: 74, cost: 2.8, ranged: true, lob: 'frostbolt', bullet: 560, splash: 48, slow: [0.45, 2.5], rank: 3, armor: 1, sound: 'freeze' },
    // lich: an undead sorcerer; every few seconds it drains the life from the three nearest enemies to heal itself and its allies
    lich: { r: 13, hp: 12, dmg: 1.6, cd: 1.3, range: 280, speed: 70, cost: 4.5, ranged: true, bullet: 900, shot: 'soul', drainAll: 7, rank: 3, armor: 0.8, sound: 'zap' },
    // storm caller: calls lightning down on its target
    stormcaller: { r: 12, hp: 7, dmg: 1, cd: 1.2, range: 300, speed: 76, cost: 3, ranged: true, bullet: 1400, shot: 'spark', storm: 3.2, rank: 3, armor: 1, sound: 'zap' },
    // forest spirit (wisp): fast little flier; when it fades, it heals the allies around it
    wisp: { r: 8, hp: 4, dmg: 0.8, cd: 0.6, reach: 4, speed: 140, cost: 1.2, flying: true, bloom: true, rank: 2, armor: 1 },
    // gargoyle: a flying horror that turns to stone when hurt (can't be damaged for a moment)
    gargoyle: { r: 15, hp: 18, dmg: 2.2, cd: 0.8, reach: 5, speed: 100, cost: 3.4, flying: true, stone: 6, rank: 1, armor: 0.6 },
    // assassin: invisible until it strikes (four times the damage), goes for generals and big units, and fades out again
    assassin: { r: 11, hp: 9, dmg: 2.6, cd: 0.7, reach: 5, speed: 115, cost: 3, cloak: true, hunter: 'commander', rank: 1, armor: 1 },
    // siege gunner: a mortar that shells clustered troops from very far away
    siegegunner: { r: 12, hp: 7, dmg: 4.5, cd: 3.4, range: 450, speed: 64, cost: 3.4, ranged: true, lob: 'mortar', bullet: 520, splash: 66, rank: 3, armor: 1, sound: 'cannon' },
    // catapult: a big siege engine that hurls boulders across the field
    catapult: { r: 26, hp: 50, dmg: 6, cd: 3.6, range: 480, speed: 24, cost: 14, ranged: true, lob: 'boulder', bullet: 520, splash: 58, rank: 0, armor: 0.4, sound: 'stomp' },
    // war mammoth: a shaggy giant that tramples and throws troops aside
    mammoth: { r: 38, hp: 120, dmg: 4.5, cd: 1.4, reach: 6, speed: 46, cost: 20, rank: 0, armor: 0.4, trample: 3.5, knock: 45, mount: 'mammoth' },
    // war rhino: charges with its horn (triple damage, sends troops flying), backs off and charges again
    rhino: { r: 22, hp: 40, dmg: 3.5, cd: 1, reach: 5, speed: 92, cost: 6, rank: 1, armor: 0.45, charge: 3, knock: 50, beast: true },
    // ogre: eats a wounded ally every few seconds to heal and grow (army cannibalism)
    ogre: { r: 20, hp: 36, dmg: 3.4, cd: 1.1, reach: 6, speed: 66, cost: 6, rank: 1, armor: 0.7, eat: 5 },
    // kamikaze drone: flies straight at its target and blows up
    drone: { r: 9, hp: 3, dmg: 6, cd: 1, reach: 2, speed: 170, cost: 1.6, flying: true, kamikaze: true, rank: 2, armor: 1 },
    // attack helicopter: a machine gun, plus rockets every few seconds
    helicopter: { r: 30, hp: 80, dmg: 0.7, cd: 0.12, range: 330, speed: 70, cost: 20, ranged: true, bullet: 1700, spread: 0.1, flying: true, rockets: 4, rank: 0, armor: 0.35, sound: 'mg' },
    // siren: her song charms enemies; they drop their weapons and walk towards her for a moment
    siren: { r: 12, hp: 8, dmg: 0.8, cd: 1.2, range: 260, speed: 80, cost: 3, ranged: true, bullet: 800, shot: 'spark', charm: 6, rank: 3, armor: 1, sound: 'zap' },
    // empty armour: a floating suit of armour; every troop the Empty Army kills leaves its gear behind to fight on as a hollow copy
    hollow: { r: 12, hp: 9, dmg: 1.8, cd: 0.7, reach: 5, speed: 84, cost: 1.8, rank: 2, armor: 0.6, haunt: true },
    // a weapon that came alive (living equipment): a flying blade that attacks anyone
    livingblade: { r: 9, hp: 5, dmg: 1.2, cd: 0.6, reach: 4, speed: 120, cost: 0.5, flying: true, rank: 2, armor: 0.8 },
    // ----- the crazy ones -----
    // the Star Eater: eats the sun; the sky darkens, enemies see less and slowly wither, then it opens a black hole
    stareater: { r: 44, hp: 170, dmg: 5, cd: 1.4, reach: 8, splash: 55, speed: 38, cost: 30, rank: 0, armor: 0.4, boss: true, eclipse: true },
    // the Timeline Executioner: rewinds the enemies around it a few seconds and executes two of them while they reset
    timeexec: { r: 18, hp: 40, dmg: 4, cd: 0.8, reach: 7, speed: 92, cost: 12, rank: 0, armor: 0.5, rewind: 10 },
    // the Walking Cathedral: priests shoot from its windows; its bell raises the dead around it and heals its army
    cathedral: { r: 46, hp: 210, dmg: 1.2, cd: 1, range: 300, speed: 22, cost: 30, ranged: true, volley: 3, bell: 9, rank: 0, armor: 0.3, boss: true, immovable: true },
    // the Storm Emperor: a dragon that is the weather; lightning hunts the strongest enemy, wing gusts throw troops back,
    // and when it dies the storm stays for the rest of the battle
    stormemperor: { r: 40, hp: 150, dmg: 3, cd: 0.4, reach: 60, breath: 120, speed: 58, cost: 30, flying: true, tempest: 3, rank: 0, armor: 0.4, boss: true },
    // the Worldroot: plants itself, then its roots spread over the field (rooting and draining enemies) and it grows new creatures
    worldroot: { r: 40, hp: 180, dmg: 2, cd: 1, reach: 8, speed: 18, cost: 28, roots: true, rank: 0, armor: 0.3, boss: true, immovable: true },
    // the Hourglass Titan: ages wounded enemies into skeletons that fight for it, turns back time on its own troops' wounds, rusts machines
    hourglass: { r: 40, hp: 170, dmg: 4, cd: 1.3, reach: 7, splash: 50, speed: 38, cost: 28, ages: 6, rank: 0, armor: 0.4, boss: true },
    // the Moon Caller: pulls the moon closer; enemy fliers fall, enemies get heavier, and the tide rises
    mooncaller: { r: 13, hp: 12, dmg: 1.2, cd: 1.2, range: 260, speed: 70, cost: 10, ranged: true, bullet: 900, shot: 'spark', moon: true, rank: 3, armor: 0.9, sound: 'zap' },
    // the Unqualified King: a tiny goblin with a crown and no fighting skills; enemy troops near him defect to his army
    unqualifiedking: { r: 10, hp: 8, dmg: 0, cd: 9, range: 200, speed: 70, cost: 8, healer: true, heal: 0, healRange: 0, defect: 5, commander: 2, rank: 3, armor: 1 },
    // the General Who Cannot Lose: when its army is about to lose, the whole battle rewinds, and its army remembers (and hits harder)
    generalnolose: { r: 17, hp: 40, dmg: 3, cd: 0.8, reach: 6, speed: 74, cost: 10, aura: { dmg: 1.15, r: 180 }, commander: 2, mount: 'horse', rewindAll: true, rank: 3, armor: 0.4 },
    // the Player: a giant hand from outside the game that picks troops up (even tanks) and throws them at the enemy
    theplayer: { r: 34, hp: 120, dmg: 0, cd: 9, reach: 60, speed: 80, cost: 24, flying: true, grab: 4, rank: 0, armor: 0.5 },
    // the Universe: looks like an ordinary soldier; when it dies, its body opens into a universe and another army pours out
    universe: { r: 11, hp: 6, dmg: 1, cd: 0.8, reach: 5, speed: 82, cost: 3, cosmos: true, rank: 2, armor: 1 },
    // the Living Fortress: an ordinary-looking castle until enemies come close; then it grows teeth and arms and swallows troops whole
    livingfortress: { r: 42, hp: 190, dmg: 5, cd: 1.4, reach: 8, splash: 60, speed: 40, cost: 30, castle: true, rank: 0, armor: 0.25, boss: true, immovable: true },
  };
  UNIT.swordsman.sword = true;
  // troops a zombie can turn (machines, the undead and the huge ones can't be infected)
  const LIVING = { soldier: 1, archer: 1, crossbowman: 1, swordsman: 1, spearman: 1, shieldbearer: 1, berserker: 1, healer: 1, rifleman: 1, gunner: 1, sniper: 1, grenadier: 1, wizard: 1, orc: 1, elf: 1, knight: 1, pirate: 1, musketeer: 1, ninja: 1, samurai: 1, trooper: 1 };
  // troops that show a health bar when hurt
  const HPBAR = { knight: 1, giant: 1, shieldbearer: 1, tank: 1, dragon: 1, mech: 1, cannon: 1 };
  // shells that fly to a spot and explode there
  const LOBS = { grenade: 1, shell: 1, fireball: 1, rocket: 1, cannonball: 1 };
  // troops drawn in the bright team colour (the rest use the darker shade)
  // gun sizes for drawing modern infantry
  const MODERN_INF = { rifleman: { len: 14, w: 3.5 }, gunner: { len: 18, w: 5.5 }, sniper: { len: 26, w: 3 }, grenadier: {} };
  // supply crate looks: box colour, icon colour, parachute stripe, glow ring once it has landed
  const CRATE = {
    squad: { box: '#B07A3E', icon: COL.gold, chute: '#E5484D', glow: '#FFD23F' },
    medkit: { box: '#F4F6FB', icon: '#E5484D', chute: '#E5484D', glow: '#7CFFB0' },
    rage: { box: '#C62F2F', icon: '#FFB020', chute: '#C62F2F', glow: '#FF6B3D' },
    shield: { box: '#2F6BDB', icon: '#EAF4FF', chute: '#2F6BDB', glow: '#7CC8FF' },
    speed: { box: '#FFD23F', icon: '#2A2F3A', chute: '#FFB020', glow: '#FFF09A' },
    heavy: { box: '#4A5262', icon: COL.gold, chute: '#4A5262', glow: '#FFD23F' },
  };
  // troop names for the MVP line
  const UNIT_LABEL = { gunner: 'MACHINE GUNNER', elf: 'ELF ARCHER', trooper: 'LASER TROOPER', shieldbearer: 'SHIELD BEARER' };
  // round troops with their own extra details (see drawNewLook)
  const NEW_LOOK = { trooper: 1, pirate: 1, musketeer: 1, zombie: 1, ninja: 1, samurai: 1, vampire: 1 };
  const LIGHT_FILL = { soldier: 1, crossbowman: 1, spearman: 1, berserker: 1, healer: 1, rifleman: 1, sniper: 1, grenadier: 1, orc: 1, elf: 1, wizard: 1, trooper: 1, pirate: 1, musketeer: 1, samurai: 1 };
  // ----- the big troop batch: which of the new troops have abilities, labels, genres -----
  const NEW_UNITS = ['pikeman', 'duelist', 'royalguard', 'lancer', 'horsearcher', 'longbow', 'firearcher', 'poisoner', 'bannerman', 'drummer', 'general', 'peasant', 'elephant',
    'necromancer', 'bonecolossus', 'deathknight', 'wolfrider', 'boarrider', 'troll', 'cyclops', 'druid', 'treant', 'illusionist', 'imp', 'demon', 'hellhound', 'warlock',
    'dwarf', 'engineer', 'turret', 'golem', 'hydra', 'titan', 'phoenix', 'fortress', 'griffin', 'mirrorknight', 'phasereaper', 'alchemist', 'gravitymonk', 'soulsmith',
    'falsesoldier', 'turtle', 'decoy', 'thousandman', 'copycat', 'immortal', 'mirrorking', 'unmaker', 'billionaire', 'gravitytyrant', 'meteorshepherd', 'glitch'];
  for (const k of NEW_UNITS) {
    const U = UNIT[k]; U.ext = true;
    // troops with a per-tick ability (see ARMY_EXT.ability)
    U.abil = !!(U.raise || U.gadget || U.decoys || U.phase || U.gravity || U.trap || U.plant || U.unmake || U.bribe || U.well || U.shepherd || U.glitch || U.possess || U.volley || U.smash || U.trample || U.charge || U.heads || U.kite);
  }
  for (const k of ['pikeman', 'duelist', 'royalguard', 'lancer', 'horsearcher', 'longbow', 'firearcher', 'poisoner', 'bannerman', 'drummer', 'general', 'peasant', 'necromancer', 'wolfrider', 'boarrider',
    'druid', 'illusionist', 'dwarf', 'engineer', 'mirrorknight', 'alchemist', 'gravitymonk', 'soulsmith', 'falsesoldier', 'copycat', 'billionaire', 'meteorshepherd']) LIVING[k] = 1;
  for (const k of ['royalguard', 'general', 'elephant', 'bonecolossus', 'deathknight', 'troll', 'cyclops', 'treant', 'golem', 'hydra', 'titan', 'phoenix', 'fortress', 'griffin', 'turtle', 'thousandman',
    'immortal', 'mirrorking', 'unmaker', 'gravitytyrant', 'demon', 'turret', 'meteorshepherd', 'glitch']) HPBAR[k] = 1;
  LOBS.boulder = 1; LOBS.flask = 1; LOBS.hellfire = 1;
  Object.assign(UNIT_LABEL, { royalguard: 'ROYAL GUARD', horsearcher: 'HORSE ARCHER', longbow: 'LONGBOWMAN', firearcher: 'FIRE ARCHER', poisoner: 'POISON HUNTER', bannerman: 'STANDARD BEARER',
    elephant: 'WAR ELEPHANT', wolfrider: 'WOLF RIDER', boarrider: 'BOAR RIDER', griffin: 'GRIFFIN RIDER', deathknight: 'DREAD KNIGHT', bonecolossus: 'BONE COLOSSUS', engineer: 'GOBLIN ENGINEER',
    mirrorknight: 'MIRROR KNIGHT', phasereaper: 'PHASE REAPER', alchemist: 'PLAGUE ALCHEMIST', gravitymonk: 'GRAVITY MONK', soulsmith: 'SOUL SMITH', falsesoldier: 'FALSE SOLDIER', turtle: 'FORTRESS TURTLE',
    thousandman: 'THOUSAND-MAN', immortal: 'IMMORTAL FRAUD', mirrorking: 'MIRROR KING', unmaker: 'THE UNMAKER', gravitytyrant: 'GRAVITY TYRANT', meteorshepherd: 'METEOR SHEPHERD', glitch: 'THE GLITCH',
    titan: 'ANCIENT TITAN', fortress: 'WALKING FORTRESS', billionaire: 'THE BILLIONAIRE' });
  const labelOf = k => UNIT_LABEL[k] || k.toUpperCase();
  // army names as shown on screen (a few army types read better with a space or a hyphen)
  const DOC_LABEL = { DREADKNIGHT: 'DREAD KNIGHT', MIRRORKING: 'MIRROR KING', THOUSANDMAN: 'THOUSAND-MAN' };
  const docLabel = d => DOC_LABEL[d.name] || d.name;
  // troops drawn by drawRoster
  const ROSTER = {}; for (const k of NEW_UNITS) ROSTER[k] = 1;
  // troops of darkness (stronger in an eclipse)
  const DARK = { skeleton: 1, zombie: 1, vampire: 1, necromancer: 1, deathknight: 1, bonecolossus: 1, demon: 1, imp: 1, hellhound: 1, warlock: 1, phasereaper: 1 };
  const DOCTRINES = [
    { name: 'SWARM', mix: { soldier: 0.8, archer: 0.12, knight: 0.08 }, budget: 1.04, budget60: 1.08 },
    { name: 'ARCHERS', mix: { soldier: 0.35, archer: 0.55, knight: 0.1 }, budget: 1.03, budget60: 1.03 },
    { name: 'KNIGHTS', mix: { soldier: 0.3, archer: 0.15, knight: 0.55 }, budget: 0.975, budget60: 0.975 },
    { name: 'BALANCED', mix: { soldier: 0.5, archer: 0.3, knight: 0.2 }, budget: 1.02, budget60: 0.99 },
    { name: 'GIANT', mix: { soldier: 0.55, archer: 0.3, knight: 0.15 }, giant: true, budget: 0.89, budget60: 0.92 },
    // Vikings: axe-swinging berserkers behind a shield wall, with spears in the second rank and a few archers.
    // late: only used when a line-up names it (never picked by chance), so older seeds play out the same
    { name: 'VIKINGS', mix: { berserker: 0.45, shieldbearer: 0.2, spearman: 0.2, archer: 0.15 }, budget: 1, budget60: 1, late: true },
  ];
  // the army types a battle can pick by chance (the original five)
  const CHANCE_DOCTRINES = DOCTRINES.filter(d => !d.late);

  // Modern-warfare army types (used when a line-up has "era": "modern"). base = filler troop.
  const MODERN_DOCTRINES = [
    { name: 'INFANTRY', base: 'rifleman', mix: { rifleman: 0.75, gunner: 0.15, grenadier: 0.1 }, budget: 1, budget60: 1 },
    { name: 'ASSAULT', base: 'rifleman', mix: { rifleman: 0.45, gunner: 0.3, grenadier: 0.25 }, budget: 1, budget60: 1 },
    { name: 'SNIPERS', base: 'rifleman', mix: { rifleman: 0.45, sniper: 0.4, gunner: 0.15 }, budget: 1, budget60: 1 },
    { name: 'ARMORED', base: 'rifleman', mix: { rifleman: 0.6, gunner: 0.25, grenadier: 0.15 }, tank: true, budget: 1, budget60: 1 },
    { name: 'COMBINED', base: 'rifleman', mix: { rifleman: 0.5, gunner: 0.2, sniper: 0.15, grenadier: 0.15 }, budget: 1, budget60: 1 },
  ];
  // Fantasy army types (skeleton is the cheap filler).
  const FANTASY_DOCTRINES = [
    { name: 'HORDE', base: 'skeleton', mix: { skeleton: 0.6, orc: 0.3, wizard: 0.1 }, budget: 1, budget60: 1 },
    { name: 'ORCS', base: 'skeleton', mix: { orc: 0.7, skeleton: 0.2, wizard: 0.1 }, budget: 1, budget60: 1 },
    { name: 'ELVES', base: 'skeleton', mix: { elf: 0.6, swordsman: 0.25, wizard: 0.15 }, budget: 1, budget60: 1 },
    { name: 'MAGES', base: 'skeleton', mix: { wizard: 0.5, orc: 0.3, elf: 0.2 }, budget: 1, budget60: 1 },
    { name: 'DRAGON', base: 'skeleton', mix: { orc: 0.4, elf: 0.3, wizard: 0.3 }, dragon: true, budget: 1, budget60: 1 },
  ];
  // More genres. heavy = the big units each army brings along (like the giant, tank or dragon).
  const SCIFI_DOCTRINES = [
    { name: 'TROOPERS', base: 'trooper', mix: { trooper: 0.8, robot: 0.2 }, budget: 1, budget60: 1 },
    { name: 'ROBOTS', base: 'trooper', mix: { robot: 0.6, trooper: 0.4 }, budget: 1, budget60: 1 },
    { name: 'MECHS', base: 'trooper', mix: { trooper: 0.65, robot: 0.35 }, heavy: ['mech'], budget: 1, budget60: 1 },
  ];
  const PIRATE_DOCTRINES = [
    { name: 'PIRATES', base: 'pirate', mix: { pirate: 0.7, musketeer: 0.3 }, budget: 1, budget60: 1 },
    { name: 'BUCCANEERS', base: 'pirate', mix: { pirate: 0.5, musketeer: 0.5 }, heavy: ['cannon'], budget: 1, budget60: 1 },
  ];
  const HORROR_DOCTRINES = [
    { name: 'ZOMBIES', base: 'zombie', mix: { zombie: 1 }, budget: 1, budget60: 1 },
    { name: 'UNDEAD', base: 'zombie', mix: { zombie: 0.55, skeleton: 0.35, wizard: 0.1 }, budget: 1, budget60: 1 },
    { name: 'VAMPIRES', base: 'zombie', mix: { vampire: 0.55, zombie: 0.3, skeleton: 0.15 }, budget: 1, budget60: 1 },
  ];
  const SAMURAI_DOCTRINES = [
    { name: 'SAMURAI', base: 'ninja', mix: { samurai: 0.55, ninja: 0.25, archer: 0.2 }, budget: 1, budget60: 1 },
    { name: 'NINJAS', base: 'ninja', mix: { ninja: 0.8, samurai: 0.2 }, budget: 1, budget60: 1 },
  ];
  // ----- new army types (factions) from the big troop batch. Kept in their own lists so the old lists (and old battles) stay exactly the same. -----
  const EMPIRE_DOCTRINES = [
    // Human Empire: pikes, swords and archers led by a general, with lancers, a standard bearer and a drummer
    { name: 'EMPIRE', base: 'soldier', mix: { swordsman: 0.25, pikeman: 0.22, archer: 0.2, lancer: 0.13, crossbowman: 0.1, bannerman: 0.05, drummer: 0.05 }, heavy: ['general'], budget: 1, budget60: 1 },
    { name: 'CAVALRY', base: 'soldier', mix: { lancer: 0.4, horsearcher: 0.35, soldier: 0.25 }, budget: 1, budget60: 1 },
    { name: 'LONGBOWS', base: 'soldier', mix: { longbow: 0.45, firearcher: 0.2, royalguard: 0.2, pikeman: 0.15 }, budget: 1, budget60: 1 },
    { name: 'ELEPHANTS', base: 'soldier', mix: { soldier: 0.45, archer: 0.3, pikeman: 0.25 }, heavy: ['elephant', 'elephant'], budget: 1, budget60: 1 },
    { name: 'FORTRESS', base: 'soldier', mix: { soldier: 0.45, archer: 0.35, bannerman: 0.1, drummer: 0.1 }, heavy: ['fortress'], budget: 1, budget60: 1 },
    // the Forbidden Army: nothing but peasants, who evolve as they kill (a peasant that kills a dragon becomes a Dragon Slayer...)
    { name: 'FORBIDDEN', base: 'peasant', mix: { peasant: 1 }, forbidden: true, budget: 1, budget60: 1 },
  ];
  const REALM_DOCTRINES = [
    { name: 'WARBAND', base: 'skeleton', mix: { orc: 0.45, wolfrider: 0.2, boarrider: 0.15, berserker: 0.1, troll: 0.1 }, budget: 1, budget60: 1 },
    { name: 'SYLVAN', base: 'skeleton', mix: { elf: 0.45, swordsman: 0.2, treant: 0.13, druid: 0.12, illusionist: 0.1 }, budget: 1, budget60: 1 },
    { name: 'INFERNAL', base: 'imp', mix: { imp: 0.3, demon: 0.25, hellhound: 0.25, warlock: 0.2 }, budget: 1, budget60: 1 },
    { name: 'DWARVES', base: 'dwarf', mix: { dwarf: 0.55, crossbowman: 0.25, engineer: 0.2 }, heavy: ['cannon'], budget: 1, budget60: 1 },
    { name: 'CYCLOPS', base: 'skeleton', mix: { orc: 0.35, wolfrider: 0.25, troll: 0.15, boarrider: 0.25 }, heavy: ['cyclops'], budget: 1, budget60: 1 },
    { name: 'GRIFFINS', base: 'skeleton', mix: { griffin: 0.3, elf: 0.4, swordsman: 0.3 }, budget: 1, budget60: 1 },
    { name: 'HYDRA', base: 'skeleton', mix: { elf: 0.4, orc: 0.3, wizard: 0.3 }, heavy: ['hydra'], budget: 1, budget60: 1 },
    { name: 'TITAN', base: 'dwarf', mix: { dwarf: 0.4, elf: 0.3, wizard: 0.3 }, heavy: ['titan'], budget: 1, budget60: 1 },
    { name: 'PHOENIX', base: 'imp', mix: { wizard: 0.4, elf: 0.3, imp: 0.3 }, heavy: ['phoenix'], budget: 1, budget60: 1 },
    { name: 'GOLEMS', base: 'dwarf', mix: { dwarf: 0.6, engineer: 0.2, crossbowman: 0.2 }, heavy: ['golem', 'golem'], budget: 1, budget60: 1 },
    // strange troops from the second list
    { name: 'ARCANE', base: 'skeleton', mix: { mirrorknight: 0.2, phasereaper: 0.2, falsesoldier: 0.2, alchemist: 0.15, gravitymonk: 0.15, soulsmith: 0.1 }, budget: 1, budget60: 1 },
    { name: 'TURTLES', base: 'skeleton', mix: { turtle: 0.15, longbow: 0.45, crossbowman: 0.4 }, budget: 1, budget60: 1 },
    // mythic armies, each led by one rule-breaker
    { name: 'THOUSANDMAN', base: 'skeleton', mix: { skeleton: 0.5, orc: 0.5 }, heavy: ['thousandman'], budget: 1, budget60: 1 },
    { name: 'COPYCATS', base: 'copycat', mix: { copycat: 0.7, wizard: 0.3 }, copycat: true, budget: 1, budget60: 1 },
    { name: 'IMMORTAL', base: 'soldier', mix: { swordsman: 0.5, archer: 0.3, knight: 0.2 }, heavy: ['immortal'], budget: 1, budget60: 1 },
    { name: 'MIRRORKING', base: 'skeleton', mix: { mirrorknight: 0.4, swordsman: 0.4, elf: 0.2 }, heavy: ['mirrorking'], budget: 1, budget60: 1 },
    { name: 'UNMAKER', base: 'skeleton', mix: { skeleton: 0.6, wizard: 0.4 }, heavy: ['unmaker'], budget: 1, budget60: 1 },
    { name: 'TYCOON', base: 'pirate', mix: { pirate: 0.5, musketeer: 0.3, soldier: 0.2 }, heavy: ['billionaire'], budget: 1, budget60: 1 },
    { name: 'GRAVITY', base: 'skeleton', mix: { orc: 0.6, gravitymonk: 0.4 }, heavy: ['gravitytyrant'], budget: 1, budget60: 1 },
    { name: 'METEOR', base: 'skeleton', mix: { wizard: 0.35, elf: 0.35, orc: 0.3 }, heavy: ['meteorshepherd'], budget: 1, budget60: 1 },
  ];
  const DARK_DOCTRINES = [
    // Undead Legion: cheap skeletons and necromancers raising the fallen; twelve skeletons can fuse into a bone colossus
    { name: 'LEGION', base: 'skeleton', mix: { skeleton: 0.7, zombie: 0.18, necromancer: 0.12 }, fuse: true, budget: 1, budget60: 1 },
    { name: 'DREADKNIGHT', base: 'skeleton', mix: { skeleton: 0.6, zombie: 0.25, necromancer: 0.15 }, heavy: ['deathknight'], budget: 1, budget60: 1 },
  ];
  const GLITCH_DOCTRINES = [{ name: 'GLITCH', base: 'trooper', mix: { robot: 0.5, trooper: 0.5 }, heavy: ['glitch'], budget: 1, budget60: 1 }];
  const GENRES = { medieval: DOCTRINES.concat(EMPIRE_DOCTRINES), modern: MODERN_DOCTRINES, fantasy: FANTASY_DOCTRINES.concat(REALM_DOCTRINES), scifi: SCIFI_DOCTRINES.concat(GLITCH_DOCTRINES), pirate: PIRATE_DOCTRINES, horror: HORROR_DOCTRINES.concat(DARK_DOCTRINES), samurai: SAMURAI_DOCTRINES };
  const ALL_DOCTRINES = () => [].concat(...Object.values(GENRES));
  // the genre each troop comes from
  const UNIT_ERA = {};
  for (const k of ['soldier', 'archer', 'crossbowman', 'swordsman', 'spearman', 'shieldbearer', 'berserker', 'healer', 'knight', 'giant']) UNIT_ERA[k] = 'medieval';
  for (const k of ['rifleman', 'gunner', 'sniper', 'grenadier', 'tank']) UNIT_ERA[k] = 'modern';
  for (const k of ['wizard', 'dragon', 'orc', 'skeleton', 'elf']) UNIT_ERA[k] = 'fantasy';
  for (const k of ['trooper', 'robot', 'mech']) UNIT_ERA[k] = 'scifi';
  for (const k of ['pirate', 'musketeer', 'cannon']) UNIT_ERA[k] = 'pirate';
  UNIT_ERA.zombie = 'horror'; UNIT_ERA.vampire = 'horror'; UNIT_ERA.ninja = 'samurai'; UNIT_ERA.samurai = 'samurai';
  for (const k of ['pikeman', 'duelist', 'royalguard', 'lancer', 'horsearcher', 'longbow', 'firearcher', 'poisoner', 'bannerman', 'drummer', 'general', 'peasant', 'elephant', 'fortress']) UNIT_ERA[k] = 'medieval';
  for (const k of ['wolfrider', 'boarrider', 'troll', 'cyclops', 'druid', 'treant', 'illusionist', 'imp', 'demon', 'hellhound', 'warlock', 'dwarf', 'engineer', 'turret', 'golem', 'hydra', 'titan', 'phoenix',
    'griffin', 'mirrorknight', 'phasereaper', 'alchemist', 'gravitymonk', 'soulsmith', 'falsesoldier', 'turtle', 'decoy', 'thousandman', 'copycat', 'immortal', 'mirrorking', 'unmaker', 'billionaire',
    'gravitytyrant', 'meteorshepherd']) UNIT_ERA[k] = 'fantasy';
  for (const k of ['necromancer', 'bonecolossus', 'deathknight']) UNIT_ERA[k] = 'horror';
  UNIT_ERA.glitch = 'scifi';
  // A custom team can be given instead of an army-type name: { name: 'SPELLGUNS', mix: { wizard: 0.4, rifleman: 0.6 }, heavy: ['tank'] }.
  const customDoc = o => Object.assign({ budget: 1, budget60: 1, base: Object.keys(o.mix || { soldier: 1 })[0] }, o, { mix: o.mix || { soldier: 1 }, custom: true });
  // which era (genre) an army type or custom team belongs to: 'medieval', 'modern', 'fantasy', 'scifi', 'pirate', 'horror', 'samurai',
  // or 'mixed' for a custom team that mixes genres
  const eraOf = name => {
    if (name && typeof name === 'object') {
      const eras = new Set(Object.keys(name.mix || {}).concat(name.heavy || []).map(k => UNIT_ERA[k] || 'medieval'));
      return eras.size === 1 ? [...eras][0] : 'mixed';
    }
    for (const [era, list] of Object.entries(GENRES)) if (list.some(d => d.name === name)) return era;
    return 'medieval';
  };
  // Starting formations. segs(row) gives the row's segments as [left, right] offsets from the centre;
  // bend(dx) pulls a unit toward the enemy. 'line' reproduces the original layout exactly.
  const FORMATIONS = {
    line: { segs: () => [[-330, 330]] },
    wedge: { segs: k => { const w = Math.min(660, 100 + k * 120); return [[-w / 2, w / 2]]; } },
    block: { segs: () => [[-240, 240]] },
    columns: { segs: () => [[-345, -125], [-110, 110], [125, 345]] },
    flanks: { segs: () => [[-360, -110], [110, 360]] },
    crescent: { segs: () => [[-330, 330]], bend: dx => 70 * (dx / 330) ** 2 },
  };

  // Battlefield maps. Coordinates are relative to the arena centre (the arena is 960 x 960).
  // Every map is mirrored top-to-bottom so both armies face the same ground.
  // c = round obstacle [x, y, r], b = box obstacle [x, y, w, h] (x, y = top-left corner), d = decoration only.
  const mirrorMap = list => list.flatMap(o => {
    if (o.c) return o.c[1] === 0 ? [o] : [o, { ...o, c: [o.c[0], -o.c[1], o.c[2]] }];
    if (o.b) { const [x, y, w, h] = o.b; return y + h / 2 === 0 ? [o] : [o, { ...o, b: [x, -y - h, w, h] }]; }
    if (o.d) return o.d[1] === 0 ? [o] : [o, { ...o, d: [o.d[0], -o.d[1], o.d[2]] }];
    return [o];
  });
  // three-way maps are the same seen from each army: obstacles repeated at 0, 120 and 240 degrees
  const rotate3 = list => list.flatMap(o => [0, 1, 2].map(k => { const a = k * TAU / 3, c = Math.cos(a), s = Math.sin(a), [x, y, r] = o.c; return { ...o, c: [x * c - y * s, x * s + y * c, r] }; }));
  const MAPS = {
    open: [],
    canyon: [{ c: [0, 0, 34], kind: 'mesa' }].concat(rotate3([{ c: [0, 255, 42], kind: 'mesa' }, { c: [-92, 345, 24], kind: 'mesa' }, { c: [92, 345, 24], kind: 'mesa' }])),
    rocks: mirrorMap([
      { c: [0, 0, 42], kind: 'rock' }, { c: [-300, -70, 34], kind: 'rock' }, { c: [300, -70, 34], kind: 'rock' },
      { c: [-160, -215, 26], kind: 'rock' }, { c: [170, -205, 24], kind: 'rock' }, { c: [-410, -240, 22], kind: 'rock' }, { c: [405, -255, 20], kind: 'rock' },
    ]),
    ruins: mirrorMap([
      { b: [-70, -14, 140, 28], kind: 'wall' },
      { c: [-160, -70, 22], kind: 'pillar' }, { c: [160, -70, 22], kind: 'pillar' }, { c: [-340, -70, 22], kind: 'pillar' }, { c: [340, -70, 22], kind: 'pillar' },
      { b: [-380, -240, 100, 24], kind: 'wall' }, { b: [280, -240, 100, 24], kind: 'wall' },
    ]),
    trenches: mirrorMap([
      { b: [-440, -96, 260, 24], kind: 'sandbags' }, { b: [-100, -96, 200, 24], kind: 'sandbags' }, { b: [180, -96, 260, 24], kind: 'sandbags' },
      { d: [-250, 0, 30], kind: 'crater' }, { d: [240, 0, 26], kind: 'crater' }, { d: [10, -200, 22], kind: 'crater' },
    ]),
    city: mirrorMap([
      { b: [-390, -75, 150, 150], kind: 'building' }, { b: [240, -75, 150, 150], kind: 'building' }, { b: [-55, -45, 110, 90], kind: 'building' },
      { b: [-172, -252, 44, 44], kind: 'crate' }, { b: [128, -252, 44, 44], kind: 'crate' },
      { d: [-140, 0, 22], kind: 'crater' }, { d: [140, 0, 22], kind: 'crater' },
    ]),
    // themed maps: each has its own ground colour (see MAP_THEME)
    forest: mirrorMap([
      { c: [-300, -64, 40], kind: 'tree' }, { c: [300, -64, 40], kind: 'tree' }, { c: [0, -178, 36], kind: 'tree' },
      { c: [-172, -292, 30], kind: 'tree' }, { c: [176, -284, 32], kind: 'tree' },
      { c: [-432, -212, 22], kind: 'bush' }, { c: [430, -200, 22], kind: 'bush' }, { c: [-122, -62, 17], kind: 'bush' }, { c: [126, -62, 17], kind: 'bush' },
    ]),
    bombed: mirrorMap([
      { b: [-420, -262, 140, 112], kind: 'ruin' }, { b: [280, -262, 140, 112], kind: 'ruin' }, { b: [-70, -36, 140, 72], kind: 'ruin' },
      { b: [-282, -152, 74, 36], kind: 'wreck' }, { b: [208, -152, 74, 36], kind: 'wreck' },
      { c: [-150, -300, 22], kind: 'rubble' }, { c: [152, -296, 20], kind: 'rubble' },
      { d: [-390, 0, 26], kind: 'crater' }, { d: [390, 0, 24], kind: 'crater' }, { d: [-190, -60, 18], kind: 'crater' }, { d: [205, -66, 20], kind: 'crater' },
      { d: [-372, -212, 0], kind: 'fire' }, { d: [246, -138, 0], kind: 'fire' },
    ]),
    enchanted: mirrorMap([
      { c: [0, 0, 38], kind: 'crystal' },
      { c: [-292, -86, 34], kind: 'mushroom' }, { c: [292, -86, 34], kind: 'mushroom' },
      { c: [-152, -236, 26], kind: 'crystal' }, { c: [160, -226, 26], kind: 'crystal' },
      { c: [-416, -256, 22], kind: 'mushroom' }, { c: [410, -262, 22], kind: 'mushroom' },
    ]),
    // Castle Siege: each army starts in front of its own castle wall; reinforcements pour out through the main gate and round the open flanks
    // (shots fly over the low walls and towers, as if fired from the battlements; troops have to use the gates)
    // (a wide main gate and two side gates between round towers). With destructible terrain on, the walls can be smashed open.
    castle: mirrorMap([
      { b: [-280, -350, 190, 24], kind: 'battlement', low: 1 }, { b: [90, -350, 190, 24], kind: 'battlement', low: 1 },
      { c: [-280, -338, 26], kind: 'tower', low: 1 }, { c: [-90, -338, 26], kind: 'tower', low: 1 }, { c: [90, -338, 26], kind: 'tower', low: 1 }, { c: [280, -338, 26], kind: 'tower', low: 1 },
      { c: [-440, -380, 24], kind: 'tower', low: 1 }, { c: [440, -380, 24], kind: 'tower', low: 1 },
      { d: [-170, 0, 22], kind: 'crater' }, { d: [170, 0, 22], kind: 'crater' }, { d: [0, -150, 18], kind: 'crater' },
    ]),
    // ----- maps whose ground does something (see ARMY_MAPS) -----
    // the Godboard: a giant chessboard; squares light up and strike with lightning (red) or make troops stronger (gold)
    godboard: mirrorMap([{ c: [-300, -180, 30], kind: 'rook' }, { c: [300, -180, 30], kind: 'rook' }]),
    // the World Furnace: basalt rocks, and lava rivers that move every few seconds
    furnace: mirrorMap([{ c: [0, -205, 36], kind: 'basalt' }, { c: [-385, -60, 30], kind: 'basalt' }, { c: [385, -60, 30], kind: 'basalt' }, { c: [-215, -335, 24], kind: 'basalt' }, { c: [215, -335, 24], kind: 'basalt' }]),
    // the Frozen End: slippery ice that big units break
    frozen: mirrorMap([{ c: [-250, -110, 30], kind: 'icepillar' }, { c: [250, -110, 30], kind: 'icepillar' }, { c: [0, -265, 34], kind: 'icepillar' }, { c: [-420, -300, 22], kind: 'icepillar' }, { c: [420, -300, 22], kind: 'icepillar' }]),
    // the Titan's Grave: a giant skeleton lying across the field; its ribs are cover, and they collapse
    grave: [{ c: [-412, 0, 50], kind: 'skull' }, { c: [392, 0, 42], kind: 'pelvis' }].concat(mirrorMap([-275, -165, -55, 55, 165, 275].map(x => ({ b: [x - 12, -150, 24, 100], kind: 'rib' })))),
    // the Overgrown Kingdom: vines that slow, thickets that hide troops from archers, statues that wake up
    overgrown: mirrorMap([{ c: [-380, -60, 26], kind: 'statue' }, { c: [380, -60, 26], kind: 'statue' }, { c: [0, -210, 32], kind: 'tree' }]),
    // the Clockwork Colosseum: turning platforms and giant gears
    clockwork: mirrorMap([{ c: [-362, 0, 58], kind: 'gear' }, { c: [362, 0, 58], kind: 'gear' }, { c: [-250, -352, 32], kind: 'gear' }, { c: [250, -352, 32], kind: 'gear' }]),
    // the Shattered Sky: floating islands joined by three bridges over the void
    shattered: mirrorMap([{ b: [-480, -34, 170, 68], kind: 'void' }, { b: [-210, -34, 160, 68], kind: 'void' }, { b: [50, -34, 160, 68], kind: 'void' }, { b: [310, -34, 170, 68], kind: 'void' },
      { c: [-250, -232, 44], kind: 'void' }, { c: [250, -232, 44], kind: 'void' }, { b: [-480, -330, 66, 150], kind: 'void' }, { b: [414, -330, 66, 150], kind: 'void' }]),
    // the Mirror Dimension: mirror shards, and the whole battle flips left to right
    mirror: mirrorMap([{ c: [-200, -150, 30], kind: 'shard' }, { c: [200, -150, 30], kind: 'shard' }, { c: [0, -300, 26], kind: 'shard' }, { c: [-400, -40, 24], kind: 'shard' }, { c: [400, -40, 24], kind: 'shard' }]),
  };
  // Arena ground per map. The page background around the arena is the same dark style on every map.
  const scatter = (seed, n, f) => { const S = rng(seed); for (let i = 0; i < n; i++) f(S, i); };
  const MAP_THEME = {
    default: { floor: COL.floor, grid: COL.grid, mid: 'rgba(255,255,255,0.08)' },
    // forest: dark green ground with moss patches and little grass tufts
    forest: {
      floor: '#122419', grid: 'rgba(170,230,180,0.06)', mid: 'rgba(220,255,225,0.10)',
      texture: g => {
        scatter(0xF0E57, 14, S => { g.beginPath(); g.ellipse(S.range(0, AR.w), S.range(0, AR.h), S.range(40, 95), S.range(24, 55), S.range(0, 3), 0, TAU); g.fillStyle = S.chance(0.5) ? 'rgba(70,150,90,0.10)' : 'rgba(0,0,0,0.14)'; g.fill(); });
        g.lineCap = 'round'; g.lineWidth = 2.5; g.strokeStyle = '#2B5C3A';
        scatter(0x7A11, 80, S => { const x = S.range(10, AR.w - 10), y = S.range(10, AR.h - 10), l = S.range(6, 10); g.beginPath(); for (const a of [-0.5, 0, 0.5]) { g.moveTo(x, y); g.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); } g.stroke(); });
      },
    },
    // bombed city: cracked asphalt, scorch marks and a road across the middle
    bombed: {
      floor: '#1B1D22', grid: 'rgba(200,205,220,0.035)', mid: null,
      texture: g => {
        const cy = AR.h / 2;
        g.fillStyle = '#22252B'; g.fillRect(0, cy - 62, AR.w, 124);
        g.lineWidth = 4; g.strokeStyle = '#3A3E47'; g.beginPath(); g.moveTo(0, cy - 62); g.lineTo(AR.w, cy - 62); g.moveTo(0, cy + 62); g.lineTo(AR.w, cy + 62); g.stroke();
        g.setLineDash([30, 22]); g.lineWidth = 4; g.strokeStyle = 'rgba(235,235,235,0.22)'; g.beginPath(); g.moveTo(0, cy); g.lineTo(AR.w, cy); g.stroke(); g.setLineDash([]);
        g.fillStyle = 'rgba(235,235,235,0.12)'; for (let k = 0; k < 7; k++) g.fillRect(AR.w / 2 - 70 + k * 21, cy - 56, 11, 112);
        scatter(0xB0B, 9, S => { g.beginPath(); g.ellipse(S.range(0, AR.w), S.range(0, AR.h), S.range(30, 70), S.range(22, 45), S.range(0, 3), 0, TAU); g.fillStyle = 'rgba(0,0,0,0.22)'; g.fill(); });
        g.lineWidth = 2; g.strokeStyle = '#101216'; g.lineCap = 'round';
        scatter(0xC4AC, 20, S => { let x = S.range(0, AR.w), y = S.range(0, AR.h), a = S.range(0, TAU); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { a += S.range(-0.9, 0.9); x += Math.cos(a) * S.range(12, 26); y += Math.sin(a) * S.range(12, 26); g.lineTo(x, y); } g.stroke(); });
        scatter(0xD057, 55, S => { const x = S.range(0, AR.w), y = S.range(0, AR.h), r = S.range(2, 5); g.beginPath(); g.moveTo(x - r, y); g.lineTo(x, y - r); g.lineTo(x + r, y + r * 0.4); g.closePath(); g.fillStyle = S.chance(0.5) ? '#3A3E47' : '#2E3139'; g.fill(); });
      },
    },
    // desert canyon (three-way battles): dusty orange-brown ground with sand ripples and pebbles
    canyon: {
      floor: '#2A1F15', grid: 'rgba(255,210,160,0.05)', mid: null,
      texture: g => {
        g.lineWidth = 2; g.strokeStyle = 'rgba(255,200,140,0.07)';
        scatter(0xCA7, 26, S => { const x = S.range(0, AR.w), y = S.range(0, AR.h), w = S.range(60, 140); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + w * 0.3, y - 8, x + w * 0.6, y + 8, x + w, y); g.stroke(); });
        scatter(0xCA8, 50, S => { g.beginPath(); g.arc(S.range(0, AR.w), S.range(0, AR.h), S.range(2, 4), 0, TAU); g.fillStyle = S.chance(0.5) ? '#4A3A28' : '#3A2C1E'; g.fill(); });
      },
    },
    // fantasy land: deep violet ground with glowing patches and a rune circle around the centre crystal
    enchanted: {
      floor: '#1B1330', grid: 'rgba(210,170,255,0.06)', mid: 'rgba(240,210,255,0.10)',
      texture: g => {
        scatter(0xE7C4, 12, S => { g.beginPath(); g.ellipse(S.range(0, AR.w), S.range(0, AR.h), S.range(40, 90), S.range(26, 52), S.range(0, 3), 0, TAU); g.fillStyle = S.chance(0.5) ? 'rgba(170,110,255,0.09)' : 'rgba(90,220,255,0.06)'; g.fill(); });
        const cx = AR.w / 2, cy = AR.h / 2;
        g.lineWidth = 3; g.strokeStyle = 'rgba(200,150,255,0.20)'; g.beginPath(); g.arc(cx, cy, 150, 0, TAU); g.stroke();
        g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 122, 0, TAU); g.stroke();
        g.lineWidth = 3; g.strokeStyle = 'rgba(220,180,255,0.24)';
        for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, r0 = 128, r1 = 144; g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a + 0.12) * r1, cy + Math.sin(a + 0.12) * r1); g.lineTo(cx + Math.cos(a + 0.2) * r0, cy + Math.sin(a + 0.2) * r0); g.stroke(); }
      },
    },
    // castle siege: a trampled muddy field, flagstone courtyards behind each castle wall, and a dirt road through the gates
    castle: {
      floor: '#221F1B', grid: 'rgba(230,210,180,0.035)', mid: 'rgba(240,225,200,0.08)',
      texture: g => {
        const cx = AR.w / 2, cy = AR.h / 2;
        scatter(0xCA57, 12, S => { g.beginPath(); g.ellipse(S.range(0, AR.w), S.range(200, AR.h - 200), S.range(40, 90), S.range(22, 48), S.range(0, 3), 0, TAU); g.fillStyle = S.chance(0.5) ? 'rgba(120,90,60,0.10)' : 'rgba(0,0,0,0.14)'; g.fill(); });
        // the road from gate to gate
        g.fillStyle = 'rgba(140,105,70,0.13)'; g.fillRect(cx - 62, 0, 124, AR.h);
        // flagstone courtyards (top and bottom, mirrored)
        for (const top of [true, false]) {
          const y0 = top ? 0 : cy + 350, y1 = top ? cy - 350 : AR.h;
          g.fillStyle = '#2C2925'; g.fillRect(0, y0, AR.w, y1 - y0);
          g.lineWidth = 2; g.strokeStyle = 'rgba(4,6,11,0.45)'; g.beginPath();
          for (let y = top ? y1 : y0, r = 0; top ? y > y0 : y < y1; y += top ? -30 : 30, r++) {
            g.moveTo(0, y); g.lineTo(AR.w, y);
            const yn = y + (top ? -30 : 30);
            for (let x = (r % 2) * 22; x < AR.w; x += 44) { g.moveTo(x, y); g.lineTo(x, yn); }
          }
          g.stroke();
        }
        scatter(0xCA58, 40, S => { const x = S.range(0, AR.w), y = S.range(200, AR.h - 200), l = S.range(5, 11), a = S.range(0, TAU); g.beginPath(); g.moveTo(x - Math.cos(a) * l, y - Math.sin(a) * l); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.lineWidth = 3; g.lineCap = 'round'; g.strokeStyle = 'rgba(200,170,130,0.12)'; g.stroke(); });
      },
    },
    godboard: {
      floor: '#232838', grid: null, mid: null,
      texture: g => {
        for (let c = 0; c < 8; c++) for (let r = 0; r < 8; r++) if ((c + r) % 2 === 0) { g.fillStyle = '#353C54'; g.fillRect(c * 120, r * 120, 120, 120); }
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,0.05)';
        scatter(0x60D, 18, S => { let x = S.range(0, AR.w), y = S.range(0, AR.h); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += S.range(-30, 30); y += S.range(-30, 30); g.lineTo(x, y); } g.stroke(); });
        g.lineWidth = 4; g.strokeStyle = 'rgba(227,179,65,0.3)'; g.strokeRect(6, 6, AR.w - 12, AR.h - 12);
      },
    },
    furnace: {
      floor: '#1A1210', grid: 'rgba(255,140,80,0.04)', mid: null,
      texture: g => {
        scatter(0xF0A, 16, S => { g.beginPath(); g.ellipse(S.range(0, AR.w), S.range(0, AR.h), S.range(40, 90), S.range(26, 55), S.range(0, 3), 0, TAU); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fill(); });
        g.lineCap = 'round';
        scatter(0xF0B, 22, S => { let x = S.range(0, AR.w), y = S.range(0, AR.h), a = S.range(0, TAU); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { a += S.range(-0.8, 0.8); x += Math.cos(a) * S.range(14, 28); y += Math.sin(a) * S.range(14, 28); g.lineTo(x, y); } g.lineWidth = 6; g.strokeStyle = 'rgba(255,90,30,0.16)'; g.stroke(); g.lineWidth = 2; g.strokeStyle = 'rgba(255,170,90,0.35)'; g.stroke(); });
      },
    },
    frozen: {
      floor: '#1B2A3B', grid: 'rgba(200,230,255,0.05)', mid: 'rgba(230,246,255,0.10)',
      texture: g => {
        scatter(0x1CE, 14, S => { g.beginPath(); g.ellipse(S.range(0, AR.w), S.range(0, AR.h), S.range(50, 110), S.range(30, 60), S.range(0, 3), 0, TAU); g.fillStyle = 'rgba(150,200,240,0.08)'; g.fill(); });
        g.lineCap = 'round'; g.lineWidth = 1.5; g.strokeStyle = 'rgba(230,246,255,0.16)';
        scatter(0x1CF, 24, S => { let x = S.range(0, AR.w), y = S.range(0, AR.h), a = S.range(0, TAU); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 3; k++) { a += S.range(-1, 1); x += Math.cos(a) * S.range(16, 34); y += Math.sin(a) * S.range(16, 34); g.lineTo(x, y); } g.stroke(); });
        scatter(0x1D0, 10, S => { g.beginPath(); g.ellipse(S.range(0, AR.w), S.range(0, AR.h), S.range(30, 60), S.range(10, 18), S.range(-0.3, 0.3), 0, TAU); g.fillStyle = 'rgba(255,255,255,0.06)'; g.fill(); });
      },
    },
    grave: {
      floor: '#211E1A', grid: 'rgba(230,220,200,0.04)', mid: null,
      texture: g => {
        const cy = AR.h / 2;
        for (let x = 116; x < AR.w - 120; x += 32) { g.beginPath(); g.ellipse(x, cy, 12, 9, 0, 0, TAU); g.fillStyle = '#B9B19C'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = COL.ink; g.stroke(); }
        scatter(0x6A7E, 30, S => { const x = S.range(0, AR.w), y = S.range(0, AR.h), l = S.range(6, 14), a = S.range(0, TAU); g.beginPath(); g.moveTo(x - Math.cos(a) * l, y - Math.sin(a) * l); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.lineWidth = 4; g.strokeStyle = 'rgba(200,190,170,0.18)'; g.stroke(); });
      },
    },
    overgrown: {
      floor: '#13241A', grid: 'rgba(170,230,180,0.05)', mid: 'rgba(220,255,225,0.08)',
      texture: g => {
        const cx = AR.w / 2, cy = AR.h / 2;
        for (const [x, y, r] of VINE_ZONES) {
          g.beginPath(); g.arc(cx + x, cy + y, r, 0, TAU); g.fillStyle = 'rgba(40,90,40,0.45)'; g.fill();
          g.lineWidth = 2.5; g.strokeStyle = 'rgba(90,170,90,0.45)';
          for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.beginPath(); g.arc(cx + x + Math.cos(a) * r * 0.5, cy + y + Math.sin(a) * r * 0.5, r * 0.3, a, a + 4); g.stroke(); }
        }
        for (const [x, y, r] of THICKETS) {
          for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; g.beginPath(); g.arc(cx + x + Math.cos(a) * r * 0.55, cy + y + Math.sin(a) * r * 0.55, r * 0.5, 0, TAU); g.fillStyle = k % 2 ? 'rgba(20,70,35,0.9)' : 'rgba(26,86,42,0.9)'; g.fill(); }
          g.beginPath(); g.arc(cx + x, cy + y, r * 0.6, 0, TAU); g.fillStyle = 'rgba(32,98,48,0.95)'; g.fill();
        }
      },
    },
    clockwork: {
      floor: '#231C14', grid: null, mid: null,
      texture: g => {
        const cx = AR.w / 2, cy = AR.h / 2;
        scatter(0xC10C, 10, S => { const x = S.range(0, AR.w), y = S.range(0, AR.h), r = S.range(30, 70); g.beginPath(); for (let k = 0; k < 24; k++) { const a = k / 24 * TAU, rr = k % 2 ? r : r * 0.86; if (k) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.lineWidth = 3; g.strokeStyle = 'rgba(227,179,65,0.07)'; g.stroke(); });
        for (const [px, py, pr] of CLOCK_PLATES) {
          g.beginPath(); g.arc(cx + px, cy + py, pr, 0, TAU); g.fillStyle = '#3A2C1C'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#8A6420'; g.stroke();
          g.fillStyle = '#B5893A'; for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; g.beginPath(); g.arc(cx + px + Math.cos(a) * (pr - 9), cy + py + Math.sin(a) * (pr - 9), 2.5, 0, TAU); g.fill(); }
        }
      },
    },
    shattered: {
      floor: '#2B3343', grid: 'rgba(200,215,240,0.04)', mid: null,
      texture: g => {
        scatter(0x5A7, 16, S => { g.beginPath(); g.ellipse(S.range(0, AR.w), S.range(0, AR.h), S.range(40, 90), S.range(24, 50), S.range(0, 3), 0, TAU); g.fillStyle = S.chance(0.5) ? 'rgba(80,140,90,0.10)' : 'rgba(0,0,0,0.12)'; g.fill(); });
        g.lineCap = 'round'; g.lineWidth = 2; g.strokeStyle = 'rgba(10,14,22,0.5)';
        scatter(0x5A8, 18, S => { let x = S.range(0, AR.w), y = S.range(0, AR.h), a = S.range(0, TAU); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 3; k++) { a += S.range(-1, 1); x += Math.cos(a) * S.range(14, 28); y += Math.sin(a) * S.range(14, 28); g.lineTo(x, y); } g.stroke(); });
      },
    },
    mirror: {
      floor: '#15172A', grid: 'rgba(196,181,253,0.05)', mid: 'rgba(196,181,253,0.10)',
      texture: g => {
        g.lineWidth = 1.5;
        scatter(0x3122, 30, S => { const x = S.range(0, AR.w), y = S.range(0, AR.h), r = S.range(20, 60); g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.6, y); g.lineTo(x, y + r); g.lineTo(x - r * 0.6, y); g.closePath(); g.strokeStyle = S.chance(0.5) ? 'rgba(196,181,253,0.10)' : 'rgba(124,243,255,0.08)'; g.stroke(); });
        g.setLineDash([16, 12]); g.lineWidth = 3; g.strokeStyle = 'rgba(196,181,253,0.2)'; g.beginPath(); g.moveTo(AR.w / 2, 0); g.lineTo(AR.w / 2, AR.h); g.stroke(); g.setLineDash([]);
      },
    },
  };
  let vignetteImg = null;

  class Army extends Match {
    constructor(seed, opts) {
      super(seed, opts);
      const R = this.R;
      this.key = 'army';
      this.audioGain = 3.0;
      this.label = 'Army Clash';
      this.title = 'ARMY CLASH';
      const era = this.opts.era;
      // opts.teams = 3 for a three-way battle (1v1v1)
      this.N = this.opts.teams === 3 ? 3 : 2;
      const orName = this.N === 3 ? `${TEAMS[0].name}, ${TEAMS[1].name} OR ${TEAMS[2].name}?` : `${TEAMS[0].name} OR ${TEAMS[1].name}?`;
      this.hook = this.N === 3 ? R.pick(['WHO SURVIVES?', 'THREE WAY WAR', 'LAST ARMY STANDING', 'ONLY ONE SURVIVES', orName]) : R.pick(era === 'scifi' ? ['WHO WINS THE FUTURE?', 'LASERS OR STEEL?', 'PICK YOUR FLEET', 'MACHINES OR MEN?', orName]
        : era === 'pirate' ? ['WHO RULES THE SEAS?', 'PICK YOUR CREW', 'CUTLASS OR CANNON?', 'WHO TAKES THE GOLD?', orName]
        : era === 'horror' ? ['CAN THEY SURVIVE?', 'DON\'T GET BITTEN', 'THE DEAD RISE', 'COUNT THE SURVIVORS', orName]
        : era === 'samurai' ? ['WHO HAS HONOR?', 'BLADE VS BLADE', 'PICK YOUR CLAN', 'WHOSE BLADE IS FASTER?', orName]
        : era === 'wild' ? [this.opts.dream === false ? 'CLASH OF WORLDS' : 'DREAM TEAM BATTLE', 'WHO WINS THIS?', 'ANYTHING GOES', 'THIS SHOULDN\'T EXIST', orName]
        : this.opts.era === 'fantasy'
        ? ['WHO RULES THE REALM?', 'PICK YOUR FACTION', 'MAGIC OR MIGHT?', 'STEEL OR SORCERY?', orName]
        : this.opts.era === 'mixed'
        ? ['OLD VS NEW?', 'SWORDS OR GUNS?', 'CAN THE PAST WIN?', 'HISTORY VS THE FUTURE', orName]
        : this.opts.era === 'modern'
        ? ['WHO WINS THE FIREFIGHT?', 'WHO HOLDS THE LINE?', 'PICK YOUR SQUAD', 'WHO PUSHES FIRST?', orName]
        : ['WHICH ARMY SURVIVES?', 'WHO WINS THE WAR?', 'PICK YOUR ARMY', 'WHO BREAKS FIRST?', orName]);
      this.booms = [];
      // opts.map picks the battlefield (see MAPS); obstacles block movement, bullets and arrows
      const cx0 = AR.x + AR.w / 2, cy0 = AR.y + AR.h / 2;
      this.obstacles = []; this.decor = [];
      for (const o of MAPS[this.opts.map] || []) {
        if (o.c) this.obstacles.push({ kind: o.kind, circle: true, x: cx0 + o.c[0], y: cy0 + o.c[1], r: o.c[2] });
        else if (o.b) this.obstacles.push({ kind: o.kind, x0: cx0 + o.b[0], y0: cy0 + o.b[1], x1: cx0 + o.b[0] + o.b[2], y1: cy0 + o.b[1] + o.b[3] });
        else if (o.d) this.decor.push({ kind: o.kind, x: cx0 + o.d[0], y: cy0 + o.d[1], r: o.d[2] });
      }
      // low obstacles (castle walls and towers) block troops but not shots: archers shoot over the battlements
      for (const o of MAPS[this.opts.map] || []) if (o.low) { const ob = this.obstacles.find(q => q.kind === o.kind && (o.c ? q.circle && q.x === cx0 + o.c[0] && q.y === cy0 + o.c[1] : !q.circle && q.x0 === cx0 + o.b[0] && q.y0 === cy0 + o.b[1])); if (ob) ob.low = true; }
      const d0 = R.pick(CHANCE_DOCTRINES);
      let d1 = R.pick(CHANCE_DOCTRINES);
      if (d1 === d0 && R.chance(0.75)) while (d1 === d0) d1 = R.pick(CHANCE_DOCTRINES);
      this.doc = [d0, d1];
      // opts.doctrines = ['SWARM', 'KNIGHTS'] picks the two army types instead of chance.
      if (this.opts.doctrines) this.doc = this.opts.doctrines.map(n => (n && typeof n === 'object' ? customDoc(n) : ALL_DOCTRINES().find(d => d.name === n) || d0));
      // fixedLength: the whole video runs exactly this long (fight + outro), with four reinforcement waves.
      this.fixed = this.opts.fixedLength || 0;
      const F = this.fixed;
      const budget = (F ? R.range(this.opts.budgetLo || 190, this.opts.budgetHi || 215) : R.range(120, 140)) * ((this.opts.combat && this.opts.combat.armySize) || 1);
      this.units = [];
      this.arrows = [];
      this.alive = Array(this.N).fill(0);
      this.reserve = Array(this.N).fill(0);
      this.start = Array(this.N).fill(0);
      this.waves = Array.from({ length: this.N }, () => []);
      this.alive[MONSTERS] = 0; this.reserve[MONSTERS] = 0;
      this.dmgMul = 1;
      this.pushStage = 0;
      let waveAt, waveOf;
      if (F) {
        this.hpScale = this.opts.hpScale || 1.3;
        waveAt = [0.18, 0.36, 0.53, 0.69].map(f => f * F * R.range(0.97, 1.03));
        waveOf = i => { const m = (i - 1) % 20; return m < 8 ? 0 : 1 + Math.floor((m - 8) / 3); };
        this.cap = F - 3;
        // with pacing (rules.video.pace) the battle is held back until near the end, so the final pushes come later too
        this.pushAt = this.opts.pace ? [this.cap - 6, this.cap - 3, this.cap - 1.5] : [0.8 * F, 0.89 * F, 0.93 * F];
        this.pushMul = [2, 3, 5];
        this.pushSpeed = [1.15, 1.3, 1.7];
      } else {
        const tk = clamp(this.target / 45, 0.62, 1.25);
        this.hpScale = clamp(0.92 * Math.pow(this.target / 45, 1.5), 0.5, 1.15);
        waveAt = [R.range(8, 10) * tk, R.range(16, 19) * tk];
        waveOf = i => ((i - 1) % 20 < 11 ? 0 : (i - 1) % 20 < 16 ? 1 : 2);
        this.cap = this.target - this.outroLen;
        this.pushAt = [this.cap * 0.72];
        this.pushMul = [2];
        this.pushSpeed = [1];
      }
      this.speedMul = 1;
      // opts.swordsmen: share of each army that are swordsmen (0 = none in this video).
      this.swordShare = this.opts.swordsmen || 0;
      // opts.swordsmenByTeam = [top, bottom] overrides the share per team (e.g. an orange army that fights mostly with swords).
      this.swordShareT = this.opts.swordsmenByTeam || [this.swordShare, this.swordShare];
      // opts.crossbowmen: share of each army that are crossbowmen (0 = none).
      this.crossShare = this.opts.crossbowmen || 0;
      // opts.extras: other optional troops, e.g. [{ type: 'spearman', share: 0.15 }]
      this.extras = (this.opts.extras || []).filter(e => UNIT[e.type] && e.share > 0);
      // opts.extrasByTeam = [[...top extras], [...bottom extras]] gives each side its own extra troops
      this.extrasT = this.opts.extrasByTeam ? this.opts.extrasByTeam.map(l => (l || []).filter(e => UNIT[e.type] && e.share > 0)) : null;
      this.initSys();
      for (let team = 0; team < this.N; team++) {
        // opts.budgetMul = [top, bottom] scales each army's size (used to balance fixed match-ups).
        const bm = this.opts.budgetMul ? this.opts.budgetMul[team] : 1;
        const list = this.recruit(this.doc[team], team, budget * bm * (F ? this.doc[team].budget60 : this.doc[team].budget) * R.range(0.95, 1.05) * (this.N === 3 ? 0.62 : 1) * (this.heroTeam === team ? 0.3 : 1));
        this.start[team] = list.length;
        const parts = waveAt.map(() => []).concat([[]]), seen = {};
        for (const k of list) { const i = seen[k] = (seen[k] || 0) + 1; parts[UNIT[k].rank === 0 ? 0 : waveOf(i)].push(k); }
        this.deploy(team, parts[0], 'front');
        for (let w = 1; w < parts.length; w++) if (parts[w].length) { this.waves[team].push({ at: waveAt[w - 1], list: parts[w] }); this.reserve[team] += parts[w].length; }
      }
      this.lastTen = Array(this.N).fill(false);
      this.grid = new Map();
      this.dispRatio = 0.5;
      this.splats = [];
      this.ground = api.makeCanvas ? api.makeCanvas(AR.w, AR.h) : null;
      this.stains = api.makeCanvas ? api.makeCanvas(AR.w, AR.h) : null;
      this.stainFade = 0;
      if (this.ground) this.paintGround(this.ground, 1);
      // fantasy land: twinkling sparkles scattered over the ground (fixed spots, the same in every video on this map)
      if (this.opts.map === 'enchanted') {
        const S = rng(0x5A11C);
        this.sparkles = [];
        for (let i = 0; i < 26; i++) this.sparkles.push({ x: AR.x + S.range(20, AR.w - 20), y: AR.y + S.range(20, AR.h - 20), r: S.range(4, 8), sp: S.range(1.5, 3.5), ph: S.range(0, TAU), c: S.chance(0.5) ? '#E9D5FF' : '#A5F3FC' });
      }
      this.liveDecor = this.decor.some(d => d.kind === 'fire') || !!this.sparkles;
      if (this.mode) this.initModes();
      if (this.trb) this.initTribes();
      if (this.trb && this.trb.evolve && this.trb.evolve.on !== false && this.tribes && this.tribes.length) this.initEvolve();
      if (this.ext) this.initExt();
      if (this.opts.world) this.initWorld();
      if (this.opts.art >= 2) this.slashes = [];
      if (this.opts.fire || (this.opts.world && this.opts.world.fire)) this.initFire();
      if (this.opts.events) this.setupEvents();
    }
    // Obstacles and decoration, painted once in the same flat cartoon style as the arena.
    // S = resolution (1 for normal, 2 for the sharper close-up copy).
    paintMap(c, S) {
      const g = c.getContext('2d'), ox = AR.x, oy = AR.y, INK = COL.ink;
      g.setTransform(S, 0, 0, S, 0, 0);
      g.lineJoin = 'round';
      // a lumpy round outline (boulders)
      const blob = (x, y, r, ph) => {
        g.beginPath();
        for (let k = 0; k <= 9; k++) { const a = k / 9 * TAU, rr = r * (0.9 + 0.12 * Math.sin(k * 2.3 + ph)); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; k ? g.lineTo(px, py) : g.moveTo(px, py); }
        g.closePath();
      };
      // scalloped outline, like a cartoon tree top seen from above
      const scallop = (x, y, r, n, ph) => {
        g.beginPath();
        for (let k = 0; k < n; k++) {
          const a0 = k / n * TAU + ph, a1 = (k + 1) / n * TAU + ph, am = (a0 + a1) / 2, br = r * Math.sin(Math.PI / n) * 1.25;
          const mx = x + Math.cos(am) * (r - br * 0.55), my = y + Math.sin(am) * (r - br * 0.55);
          g.arc(mx, my, br, am - Math.PI / 2 - 0.35, am + Math.PI / 2 + 0.35);
        }
        g.closePath();
      };
      for (const d of this.decor) {
        const x = d.x - ox, y = d.y - oy;
        if (d.kind === 'puddle') {
          // a puddle of dark water with a glint
          g.beginPath(); g.ellipse(x, y, d.r * 1.3, d.r * 0.85, 0.3, 0, TAU); g.fillStyle = '#0D1A18'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#2C3B2A'; g.stroke();
          g.beginPath(); g.ellipse(x - d.r * 0.4, y - d.r * 0.25, d.r * 0.35, d.r * 0.12, 0.3, 0, TAU); g.fillStyle = 'rgba(200,240,220,0.14)'; g.fill();
          continue;
        }
        if (d.kind === 'fire') {
          // scorched ground under a fire (the flames themselves are animated, see drawLiveDecor)
          g.beginPath(); g.ellipse(x, y, 26, 20, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fill();
          continue;
        }
        // crater: a dark scorched hollow with a lighter rim
        g.beginPath(); g.ellipse(x, y, d.r * 1.2, d.r, 0, 0, TAU); g.fillStyle = '#070A12'; g.fill();
        g.lineWidth = 4; g.strokeStyle = '#1E2638'; g.stroke();
        g.beginPath(); g.ellipse(x + 3, y + 3, d.r * 0.6, d.r * 0.45, 0, 0, TAU); g.fillStyle = 'rgba(30,38,56,0.6)'; g.fill();
      }
      let idx = 0;
      for (const o of this.obstacles) {
        if (XOB[o.kind]) { g.save(); this.paintObstacle(g, o, ox, oy, S); g.restore(); idx++; continue; }
        g.save();
        idx++;
        if (o.circle) {
          const x = o.x - ox, y = o.y - oy;
          g.beginPath(); g.ellipse(x + 5, y + 7, o.r, o.r * 0.9, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,0.38)'; g.fill();
          if (o.kind === 'pillar') {
            g.beginPath(); g.arc(x, y, o.r, 0, TAU); g.fillStyle = '#4A5368'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
            g.beginPath(); g.arc(x, y, o.r * 0.68, 0, TAU); g.fillStyle = '#5E6880'; g.fill(); g.lineWidth = 2; g.stroke();
            g.beginPath(); g.arc(x - o.r * 0.2, y - o.r * 0.25, o.r * 0.22, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fill();
          } else if (o.kind === 'tower') {
            // round castle tower from above: a ring of crenellations around a dark stone roof
            g.beginPath(); g.arc(x, y, o.r, 0, TAU); g.fillStyle = '#646879'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
            g.fillStyle = '#8A8FA3'; g.lineWidth = 2;
            for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + 0.2; g.beginPath(); g.arc(x + Math.cos(a) * o.r * 0.8, y + Math.sin(a) * o.r * 0.8, o.r * 0.2, 0, TAU); g.fill(); g.stroke(); }
            g.beginPath(); g.arc(x, y, o.r * 0.5, 0, TAU); g.fillStyle = '#474A58'; g.fill(); g.stroke();
            g.beginPath(); g.arc(x - o.r * 0.15, y - o.r * 0.18, o.r * 0.16, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fill();
          } else if (o.kind === 'mesa') {
            // flat-topped desert rock seen from above: layered sandstone rings
            g.beginPath(); g.arc(x, y, o.r, 0, TAU); g.fillStyle = '#8A5A34'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
            g.beginPath(); g.arc(x - o.r * 0.06, y - o.r * 0.06, o.r * 0.74, 0, TAU); g.fillStyle = '#A8703F'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(4,6,11,0.4)'; g.stroke();
            g.beginPath(); g.arc(x - o.r * 0.12, y - o.r * 0.12, o.r * 0.46, 0, TAU); g.fillStyle = '#C58A50'; g.fill(); g.stroke();
          } else if (o.kind === 'tree') {
            // tree top from above: a scalloped dark-green crown, a lighter inner crown and a few leaf highlights
            scallop(x, y, o.r * 1.04, 8, o.x * 0.01); g.fillStyle = '#23663A'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
            scallop(x - o.r * 0.12, y - o.r * 0.14, o.r * 0.66, 6, o.y * 0.01); g.fillStyle = '#2F8248'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(4,6,11,0.45)'; g.stroke();
            g.fillStyle = 'rgba(190,255,200,0.16)';
            for (let k = 0; k < 3; k++) { const a = 3.6 + k * 0.6; g.beginPath(); g.arc(x + Math.cos(a) * o.r * 0.45, y + Math.sin(a) * o.r * 0.45, o.r * 0.12, 0, TAU); g.fill(); }
          } else if (o.kind === 'bush') {
            scallop(x, y, o.r, 6, o.x * 0.02); g.fillStyle = '#2A7041'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
            g.beginPath(); g.arc(x - o.r * 0.25, y - o.r * 0.25, o.r * 0.3, 0, TAU); g.fillStyle = 'rgba(190,255,200,0.15)'; g.fill();
          } else if (o.kind === 'rubble') {
            // a pile of broken concrete chunks
            const cols = ['#4C515C', '#5C626E', '#43474F'];
            for (let k = 0; k < 7; k++) {
              const a = k * 2.4 + o.x * 0.03, d = k ? o.r * (0.35 + 0.12 * (k % 3)) : 0, cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d, cr = o.r * (k ? 0.42 : 0.6);
              g.beginPath(); for (let v = 0; v < 5; v++) { const b = v / 5 * TAU + a, rr = cr * (0.75 + 0.25 * ((v * 7 + k) % 3) / 2); v ? g.lineTo(cx + Math.cos(b) * rr, cy + Math.sin(b) * rr) : g.moveTo(cx + Math.cos(b) * rr, cy + Math.sin(b) * rr); }
              g.closePath(); g.fillStyle = cols[k % 3]; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
            }
          } else if (o.kind === 'crystal') {
            // a cluster of glowing gems: one big crystal with two smaller ones, cyan or pink
            const pink = idx % 2 === 0, lite = pink ? '#FF8FDF' : '#7CEBFF', dark = pink ? '#C2389B' : '#2696BF';
            g.beginPath(); g.arc(x, y, o.r * 1.25, 0, TAU); g.fillStyle = pink ? 'rgba(255,120,220,0.12)' : 'rgba(120,230,255,0.12)'; g.fill();
            const gem = (gx, gy, r, rot) => {
              const pts = []; for (let v = 0; v < 6; v++) { const b = rot + v / 6 * TAU; pts.push([gx + Math.cos(b) * r, gy + Math.sin(b) * r * 0.82]); }
              g.beginPath(); pts.forEach((p, v) => (v ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fillStyle = dark; g.fill();
              g.beginPath(); g.moveTo(gx, gy); for (let v = 3; v <= 6; v++) g.lineTo(pts[v % 6][0], pts[v % 6][1]); g.closePath(); g.fillStyle = lite; g.fill();
              g.beginPath(); pts.forEach((p, v) => (v ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
              g.beginPath(); g.moveTo(gx, gy); g.lineTo(pts[0][0], pts[0][1]); g.moveTo(gx, gy); g.lineTo(pts[2][0], pts[2][1]); g.moveTo(gx, gy); g.lineTo(pts[4][0], pts[4][1]); g.lineWidth = 1.5; g.strokeStyle = 'rgba(4,6,11,0.5)'; g.stroke();
              g.beginPath(); g.arc(gx - r * 0.3, gy - r * 0.35, r * 0.13, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fill();
            };
            gem(x - o.r * 0.55, y + o.r * 0.35, o.r * 0.48, 0.4); gem(x + o.r * 0.55, y + o.r * 0.3, o.r * 0.42, 0.1); gem(x, y - o.r * 0.15, o.r * 0.68, 0.25);
          } else if (o.kind === 'mushroom') {
            // giant toadstool cap from above: red or purple with white spots
            const purple = idx % 2 === 1, cap = purple ? '#9B5DE5' : '#E2384D', rim = purple ? '#C9A3F5' : '#FF8A96';
            g.beginPath(); g.arc(x, y, o.r, 0, TAU); g.fillStyle = cap; g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
            g.beginPath(); g.arc(x, y, o.r - 5, Math.PI * 0.95, Math.PI * 1.7); g.lineWidth = 3; g.strokeStyle = rim; g.stroke();
            g.fillStyle = '#FFF4E6'; g.lineWidth = 2; g.strokeStyle = INK;
            const spots = [[0, 0, 0.24], [0.5, -0.3, 0.15], [-0.5, -0.25, 0.17], [0.35, 0.5, 0.14], [-0.4, 0.45, 0.13], [0.05, -0.62, 0.11]];
            for (const [sx, sy, sr] of spots) { g.beginPath(); g.arc(x + sx * o.r, y + sy * o.r, sr * o.r, 0, TAU); g.fill(); g.stroke(); }
          } else if (o.kind === 'palm') {
            // palm tree from above: long green fronds spreading from a brown trunk top
            g.lineCap = 'round';
            for (let k = 0; k < 7; k++) {
              const a = k / 7 * TAU + o.x * 0.01, ex = x + Math.cos(a) * o.r * 1.15, ey = y + Math.sin(a) * o.r * 1.15, mx = x + Math.cos(a + 0.25) * o.r * 0.6, my = y + Math.sin(a + 0.25) * o.r * 0.6;
              g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(mx, my, ex, ey); g.lineWidth = o.r * 0.36 + 3; g.strokeStyle = INK; g.stroke(); g.lineWidth = o.r * 0.36; g.strokeStyle = k % 2 ? '#2F8248' : '#3E9A55'; g.stroke();
            }
            g.beginPath(); g.arc(x, y, o.r * 0.24, 0, TAU); g.fillStyle = '#7A5230'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
          } else if (o.kind === 'pine') {
            // a snowy pine from above: a star of dark green boughs with snow on the tips
            g.beginPath();
            for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, rr = k % 2 ? o.r * 0.62 : o.r * 1.05; k ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
            g.closePath(); g.fillStyle = '#1E5A3A'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
            g.fillStyle = '#EAF4FF';
            for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.beginPath(); g.arc(x + Math.cos(a) * o.r * 0.82, y + Math.sin(a) * o.r * 0.82, o.r * 0.13, 0, TAU); g.fill(); }
            g.beginPath(); g.arc(x, y, o.r * 0.3, 0, TAU); g.fillStyle = '#EAF4FF'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(4,6,11,0.5)'; g.stroke();
          } else if (o.kind === 'snowrock') {
            blob(x, y, o.r, o.x); g.fillStyle = '#4A5568'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
            blob(x - o.r * 0.15, y - o.r * 0.18, o.r * 0.62, o.y); g.fillStyle = '#E8F1FB'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(4,6,11,0.4)'; g.stroke();
          } else if (o.kind === 'cactus') {
            // a round barrel cactus with ribs and spines, and a pink flower on top
            g.beginPath(); g.arc(x, y, o.r, 0, TAU); g.fillStyle = '#3F7D34'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
            g.lineWidth = 2; g.strokeStyle = 'rgba(4,6,11,0.4)';
            for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.beginPath(); g.moveTo(x + Math.cos(a) * o.r * 0.25, y + Math.sin(a) * o.r * 0.25); g.lineTo(x + Math.cos(a) * o.r * 0.95, y + Math.sin(a) * o.r * 0.95); g.stroke(); }
            g.strokeStyle = '#F4F1E6'; g.lineWidth = 1.5;
            for (let k = 0; k < 16; k++) { const a = k / 16 * TAU + 0.2; g.beginPath(); g.moveTo(x + Math.cos(a) * o.r, y + Math.sin(a) * o.r); g.lineTo(x + Math.cos(a) * (o.r + 5), y + Math.sin(a) * (o.r + 5)); g.stroke(); }
            g.beginPath(); g.arc(x, y, o.r * 0.26, 0, TAU); g.fillStyle = '#FF7AB6'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
          } else if (o.kind === 'deadtree') {
            // a bare, twisted tree: branches spreading from the trunk
            g.lineCap = 'round';
            for (let k = 0; k < 6; k++) {
              const a = k / 6 * TAU + o.x * 0.013, bx = x + Math.cos(a) * o.r * 0.6, by = y + Math.sin(a) * o.r * 0.6, ex = x + Math.cos(a + 0.35) * o.r * 1.1, ey = y + Math.sin(a + 0.35) * o.r * 1.1;
              g.beginPath(); g.moveTo(x, y); g.lineTo(bx, by); g.lineTo(ex, ey); g.moveTo(bx, by); g.lineTo(x + Math.cos(a - 0.35) * o.r, y + Math.sin(a - 0.35) * o.r);
              g.lineWidth = 7; g.strokeStyle = INK; g.stroke(); g.lineWidth = 4; g.strokeStyle = '#5B4636'; g.stroke();
            }
            g.beginPath(); g.arc(x, y, o.r * 0.32, 0, TAU); g.fillStyle = '#4A382A'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
          } else {
            // boulder: a lumpy rounded rock with a highlight and a crack
            blob(x, y, o.r, o.x);
            g.fillStyle = '#3B4357'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
            g.beginPath(); g.arc(x - o.r * 0.25, y - o.r * 0.3, o.r * 0.45, Math.PI * 1.05, Math.PI * 1.75); g.lineWidth = o.r * 0.16; g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,0.16)'; g.stroke();
            g.beginPath(); g.moveTo(x + o.r * 0.1, y - o.r * 0.1); g.lineTo(x + o.r * 0.35, y + o.r * 0.2); g.lineTo(x + o.r * 0.3, y + o.r * 0.45); g.lineWidth = 2; g.strokeStyle = 'rgba(4,6,11,0.6)'; g.stroke();
          }
        } else {
          const x = o.x0 - ox, y = o.y0 - oy, w = o.x1 - o.x0, h = o.y1 - o.y0;
          g.fillStyle = 'rgba(0,0,0,0.38)'; roundRect(g, x + 5, y + 7, w, h, 6); g.fill();
          if (o.kind === 'sandbags') {
            // a row of khaki sandbags
            const n = Math.max(2, Math.round(w / 26)), bw = w / n;
            for (let i = 0; i < n; i++) { roundRect(g, x + i * bw + 1, y, bw - 2, h, h / 2.2); g.fillStyle = i % 2 ? '#7E6E4C' : '#8A7A56'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke(); }
          } else if (o.kind === 'building') {
            // flat roof with a raised edge, a vent and an AC unit
            roundRect(g, x, y, w, h, 6); g.fillStyle = '#2C3344'; g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
            roundRect(g, x + 9, y + 9, w - 18, h - 18, 4); g.fillStyle = '#353D51'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(4,6,11,0.7)'; g.stroke();
            g.fillStyle = '#4A5368'; g.fillRect(x + w * 0.18, y + h * 0.22, w * 0.2, h * 0.16); g.strokeRect(x + w * 0.18, y + h * 0.22, w * 0.2, h * 0.16);
            g.beginPath(); g.arc(x + w * 0.7, y + h * 0.68, Math.min(w, h) * 0.1, 0, TAU); g.fillStyle = '#4A5368'; g.fill(); g.stroke();
          } else if (o.kind === 'ruin') {
            // a bombed-out building seen from above: broken walls around a floor full of rubble
            roundRect(g, x, y, w, h, 3); g.fillStyle = '#30333B'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
            g.beginPath(); g.ellipse(x + w * 0.55, y + h * 0.5, w * 0.28, h * 0.3, 0.3, 0, TAU); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fill();
            const t = 9, wall = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineCap = 'butt'; g.lineWidth = t + 4; g.strokeStyle = INK; g.stroke(); g.lineWidth = t; g.strokeStyle = '#6B6F78'; g.stroke(); };
            // walls with gaps blown out of them
            wall(x + t / 2, y + t / 2, x + w * 0.42, y + t / 2); wall(x + w * 0.62, y + t / 2, x + w - t / 2, y + t / 2);
            wall(x + w - t / 2, y + t / 2, x + w - t / 2, y + h * 0.55);
            wall(x + t / 2, y + t / 2, x + t / 2, y + h - t / 2); wall(x + t / 2, y + h - t / 2, x + w * 0.3, y + h - t / 2); wall(x + w * 0.7, y + h - t / 2, x + w - t / 2, y + h - t / 2);
            const cols = ['#555A64', '#646A75', '#4A4E57'];
            for (let k = 0; k < 9; k++) {
              const cx = x + w * (0.2 + ((k * 37) % 60) / 100), cy = y + h * (0.25 + ((k * 53) % 55) / 100), cr = 4 + (k % 4) * 2;
              g.beginPath(); for (let v = 0; v < 5; v++) { const b = v / 5 * TAU + k; v ? g.lineTo(cx + Math.cos(b) * cr, cy + Math.sin(b) * cr) : g.moveTo(cx + Math.cos(b) * cr, cy + Math.sin(b) * cr); }
              g.closePath(); g.fillStyle = cols[k % 3]; g.fill(); g.lineWidth = 1.5; g.strokeStyle = INK; g.stroke();
            }
          } else if (o.kind === 'wreck') {
            // a burnt-out car from above
            roundRect(g, x, y, w, h, h * 0.35); g.fillStyle = '#3B3330'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
            roundRect(g, x + w * 0.24, y + h * 0.16, w * 0.5, h * 0.68, 5); g.fillStyle = '#17191D'; g.fill(); g.lineWidth = 2; g.stroke();
            g.fillStyle = '#0B0C0F';
            for (const [wx, wy] of [[0.12, -0.08], [0.72, -0.08], [0.12, 0.86], [0.72, 0.86]]) { g.fillRect(x + w * wx, y + h * wy, w * 0.16, h * 0.22); }
            g.beginPath(); g.ellipse(x + w * 0.5, y + h * 0.5, w * 0.62, h * 0.8, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fill();
          } else if (o.kind === 'battlement') {
            // castle wall from above: a stone walkway with crenellations (merlons) along both edges
            roundRect(g, x, y, w, h, 3); g.fillStyle = '#646879'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
            g.fillStyle = '#474A58'; g.fillRect(x + 3, y + 7, w - 6, h - 14);
            g.fillStyle = '#8A8FA3'; g.lineWidth = 2;
            for (let bx = x + 5; bx + 12 <= x + w - 3; bx += 22) for (const by of [y + 2, y + h - 8]) { g.fillRect(bx, by, 12, 6); g.strokeRect(bx, by, 12, 6); }
          } else if (o.kind === 'crate') {
            roundRect(g, x, y, w, h, 3); g.fillStyle = '#6B5233'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
            g.beginPath(); g.moveTo(x + 4, y + 4); g.lineTo(x + w - 4, y + h - 4); g.moveTo(x + w - 4, y + 4); g.lineTo(x + 4, y + h - 4); g.lineWidth = 2.5; g.strokeStyle = '#4A3822'; g.stroke();
          } else if (o.kind === 'tomb') {
            // a tombstone seen from above and a little from the front: rounded top, a cross, a mound of earth below
            g.beginPath(); g.ellipse(x + w / 2, y + h * 0.95, w * 0.7, h * 0.22, 0, 0, TAU); g.fillStyle = '#2E2A22'; g.fill();
            g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath();
            g.fillStyle = '#7C7887'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
            g.beginPath(); g.moveTo(x + w / 2, y + h * 0.3); g.lineTo(x + w / 2, y + h * 0.72); g.moveTo(x + w * 0.3, y + h * 0.45); g.lineTo(x + w * 0.7, y + h * 0.45); g.lineWidth = 2.5; g.strokeStyle = '#4A4656'; g.stroke();
          } else if (o.kind === 'neonblock') {
            // a dark city block with glowing neon edges and a sign
            roundRect(g, x, y, w, h, 6); g.fillStyle = '#16142B'; g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
            roundRect(g, x + 6, y + 6, w - 12, h - 12, 4); g.lineWidth = 3; g.strokeStyle = (o.x0 + o.y0) % 2 ? '#FF5AD9' : '#50DCFF'; g.stroke();
            g.fillStyle = 'rgba(80,220,255,0.18)'; g.fillRect(x + w * 0.2, y + h * 0.35, w * 0.6, h * 0.3);
          } else {
            // stone wall: blocks with mortar lines
            roundRect(g, x, y, w, h, 3); g.fillStyle = '#4A5368'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
            g.lineWidth = 1.5; g.strokeStyle = 'rgba(4,6,11,0.55)'; g.beginPath(); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2);
            for (let bx = x + 22; bx < x + w; bx += 22) { g.moveTo(bx, y); g.lineTo(bx, y + h / 2); g.moveTo(bx - 11, y + h / 2); g.lineTo(bx - 11, y + h); }
            g.stroke();
          }
        }
        g.restore();
      }
      if (this.rubble && this.rubble.length) this.paintRubble(g, ox, oy);
    }
    // Animated bits of a map, drawn every frame: fires on the bombed city, twinkling sparkles in the fantasy land.
    drawLiveDecor(ctx) {
      const t = this.t;
      for (const d of this.decor) {
        if (d.kind !== 'fire') continue;
        for (let k = 0; k < 3; k++) {
          const f = 0.8 + 0.25 * Math.sin(t * 13 + k * 2.1 + d.x), fx = d.x + (k - 1) * 9, fy = d.y + (k === 1 ? -4 : 2), hgt = (k === 1 ? 30 : 20) * f;
          ctx.beginPath(); ctx.moveTo(fx - 9, fy + 6); ctx.quadraticCurveTo(fx - 9, fy - hgt * 0.5, fx + Math.sin(t * 9 + k) * 3, fy - hgt); ctx.quadraticCurveTo(fx + 9, fy - hgt * 0.5, fx + 9, fy + 6); ctx.closePath();
          ctx.fillStyle = '#FF7A1A'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = COL.ink; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(fx - 4, fy + 4); ctx.quadraticCurveTo(fx - 4, fy - hgt * 0.3, fx, fy - hgt * 0.6); ctx.quadraticCurveTo(fx + 4, fy - hgt * 0.3, fx + 4, fy + 4); ctx.closePath();
          ctx.fillStyle = '#FFD23F'; ctx.fill();
        }
      }
      if (this.sparkles) {
        for (const s of this.sparkles) {
          const a = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph);
          if (a < 0.15) continue;
          const r = s.r * (0.6 + 0.4 * a);
          ctx.globalAlpha = a * 0.85;
          ctx.beginPath(); ctx.moveTo(s.x, s.y - r); ctx.lineTo(s.x + r * 0.28, s.y - r * 0.28); ctx.lineTo(s.x + r, s.y); ctx.lineTo(s.x + r * 0.28, s.y + r * 0.28);
          ctx.lineTo(s.x, s.y + r); ctx.lineTo(s.x - r * 0.28, s.y + r * 0.28); ctx.lineTo(s.x - r, s.y); ctx.lineTo(s.x - r * 0.28, s.y - r * 0.28); ctx.closePath();
          ctx.fillStyle = s.c; ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    paintGround(c, S) {
      const g = c.getContext('2d');
      g.setTransform(S, 0, 0, S, 0, 0);
      const th = MAP_THEME[this.opts.map] || MAP_THEME.default;
      g.fillStyle = th.floor; g.fillRect(0, 0, AR.w, AR.h);
      if (th.texture) th.texture(g);
      if (th.grid) {
        g.strokeStyle = th.grid; g.lineWidth = 2;
        g.beginPath();
        for (let x = 60; x < AR.w; x += 60) { g.moveTo(x, 0); g.lineTo(x, AR.h); }
        for (let y = 60; y < AR.h; y += 60) { g.moveTo(0, y); g.lineTo(AR.w, y); }
        g.stroke();
      }
      if (th.mid) {
        g.strokeStyle = th.mid; g.setLineDash([18, 14]); g.lineWidth = 3;
        g.beginPath(); g.moveTo(0, AR.h / 2); g.lineTo(AR.w, AR.h / 2); g.stroke();
        g.setLineDash([]);
      }
      const zone = (top, color) => {
        const y0 = top ? 0 : AR.h - 220;
        const lg = g.createLinearGradient(0, top ? 0 : AR.h, 0, top ? 220 : AR.h - 220);
        lg.addColorStop(0, color); lg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = lg; g.fillRect(0, y0, AR.w, 220);
      };
      if (this.N === 3) {
        for (let tm = 0; tm < 3; tm++) {
          const a = this.homeAngle(tm), hx = AR.w / 2 + Math.cos(a) * 420, hy = AR.h / 2 + Math.sin(a) * 420, rg = g.createRadialGradient(hx, hy, 0, hx, hy, 300);
          rg.addColorStop(0, rgba(TEAMS[tm].c, 0.16)); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, AR.w, AR.h);
        }
      } else {
        zone(true, rgba(TEAMS[0].c, 0.12));
        zone(false, rgba(TEAMS[1].c, 0.12));
      }
    }
    recruit(doc, team, budget) {
      const swordShare = this.swordShareT ? this.swordShareT[team] : this.swordShare;
      const R = this.R;
      const list = [];
      let left = budget;
      if (doc.giant) { list.push('giant'); left -= UNIT.giant.cost; }
      if (doc.tank) { list.push('tank'); left -= UNIT.tank.cost; }
      if (doc.dragon) { list.push('dragon'); left -= UNIT.dragon.cost; }
      for (const k of doc.heavy || []) if (UNIT[k]) { list.push(k); left -= UNIT[k].cost; }
      const keys = Object.keys(doc.mix);
      while (left >= 1) {
        let x = R.next(), k = keys[0];
        for (const key of keys) { x -= doc.mix[key]; if (x <= 0) { k = key; break; } }
        if (swordShare && R.chance(swordShare)) k = 'swordsman';
        else if (this.crossShare && R.chance(this.crossShare)) k = 'crossbowman';
        else { const ex0 = this.extrasT ? this.extrasT[team] : this.extras; if (ex0 && ex0.length) { for (const ex of ex0) if (R.chance(ex.share)) { k = ex.type; break; } } }
        if (UNIT[k].cost > left) k = doc.base || 'soldier';
        list.push(k); left -= UNIT[k].cost;
      }
      return list.sort((a, b) => UNIT[a].rank - UNIT[b].rank);
    }
    // 'front': first rows near the midline, stacking back toward the team's edge.
    // 'back': reinforcements enter at the team's own edge, stacking toward the middle.
    // three-way battles: each army's home direction from the centre (top, bottom right, bottom left)
    homeAngle(team) { return -Math.PI / 2 + team * TAU / 3; }
    deploy3(team, list, mode) {
      const R = this.R, cx = AR.x + AR.w / 2, cy = AR.y + AR.h / 2, a = this.homeAngle(team), hx = Math.cos(a), hy = Math.sin(a), tx = -hy, ty = hx;
      const front = mode === 'front';
      let dist = front ? 150 : 440;
      const dir = front ? 1 : -1, order = front ? list : list.slice().reverse();
      let i = 0;
      while (i < order.length) {
        const row = [], width = 330 + Math.abs(dist - 150) * 0.9;
        let w = 0, maxR = 0;
        while (i < order.length) { const r = UNIT[order[i]].r; if (w + r * 2 + 8 > width && row.length) break; row.push(order[i]); w += r * 2 + 8; maxR = Math.max(maxR, r); i++; }
        dist += dir * maxR;
        let o = -w / 2;
        for (const k of row) {
          const r = UNIT[k].r; o += r + 4;
          const px = cx + hx * dist + tx * o + R.range(-3, 3), py = cy + hy * dist + ty * o + R.range(-3, 3);
          this.addUnit(team, k, clamp(px, AR.x + r + 2, AR.x + AR.w - r - 2), clamp(py, AR.y + r + 2, AR.y + AR.h - r - 2));
          o += r + 4;
        }
        dist += dir * (maxR + 8);
      }
    }
    deploy(team, list, mode) {
      if (this.N === 3) return this.deploy3(team, list, mode);
      const R = this.R, mid = AR.y + AR.h / 2;
      const own = team === 0 ? -1 : 1;
      let dir, rowY, order;
      if (mode === 'front') { dir = own; rowY = mid + own * 95; order = list; }
      else { dir = -own; rowY = team === 0 ? AR.y + 6 : AR.y + AR.h - 6; order = list.slice().reverse(); }
      const form = (mode === 'front' && FORMATIONS[(this.opts.formations || [])[team]]) || FORMATIONS.line;
      const cx = AR.x + AR.w / 2;
      let i = 0, rowNo = 0;
      while (i < order.length) {
        // fill this row's segments left to right, then centre each segment's troops in it
        const segs = form.segs(rowNo).map(([a, b]) => ({ a, b, units: [], w: 0 }));
        let maxR = 0, si = 0;
        while (i < order.length && si < segs.length) {
          const r = UNIT[order[i]].r, seg = segs[si];
          if (seg.w + r * 2 + 8 > seg.b - seg.a && seg.units.length) { si++; continue; }
          seg.units.push(order[i]); seg.w += r * 2 + 8; maxR = Math.max(maxR, r); i++;
        }
        rowY += dir * maxR;
        for (const seg of segs) {
          let x = cx + (seg.a + seg.b) / 2 - seg.w / 2;
          for (const k of seg.units) {
            const r = UNIT[k].r;
            x += r + 4;
            const bend = form.bend ? form.bend(x - cx) : 0;
            this.addUnit(team, k, x + R.range(-3, 3), clamp(rowY - dir * bend + R.range(-3, 3), AR.y + r + 2, AR.y + AR.h - r - 2));
            x += r + 4;
          }
        }
        rowY += dir * (maxR + 8);
        rowNo++;
      }
    }
    addUnit(team, type, x, y) {
      const U = UNIT[type];
      const R = this.R;
      const hp = U.hp * (this.hpScale || 1);
      const pace = 1 + (R.chance(0.5) ? 1 : -1) * R.range(0.03, 0.07);
      if (this.obstacles && this.obstacles.length && !U.flying) { const p = { x, y, r: U.r }; for (let k = 0; k < 3; k++) this.pushOut(p); x = p.x; y = p.y; }
      this.units.push({ team, type, x, y, flying: !!U.flying, pace, gait: R.range(0, TAU), vx: 0, vy: 0, r: U.r, hp, max: hp, cd: R.range(0, U.cd), retarget: R.range(0, 0.3), target: null, flash: 0, lunge: 0, face: this.N === 3 ? this.homeAngle(team) + Math.PI : team === 0 ? Math.PI / 2 : -Math.PI / 2, dead: false, m: U.r * U.r * (U.immovable ? 400 : 1) });
      this.units[this.units.length - 1].uid = this.uidN = (this.uidN || 0) + 1;
      if (U.ext || this.sysOn || this.cmb || this.heroTeam >= 0 || this.trb) this.extUnit(this.units[this.units.length - 1], U);
      // nations: about one troop in ten carries the national flag (looks only, no dice)
      if (hasFlag(TEAMS[team]) && !U.flying && U.rank !== 0 && !U.uncounted && team < 3) { this.flagN = this.flagN || [0, 0, 0]; if (this.flagN[team]++ % 10 === 3) this.units[this.units.length - 1].flag = true; }
      if (!U.uncounted) this.alive[team]++;
      return this.units[this.units.length - 1];
    }
    reinforce(team, wave) {
      wave.done = true;
      this.reserve[team] -= wave.list.length;
      this.deploy(team, wave.list, 'back');
    }
    // ----- obstacles -----
    // closest point on an obstacle to (x, y)
    closestOn(o, x, y) {
      if (o.circle) { const dx = x - o.x, dy = y - o.y, d = Math.hypot(dx, dy) || 1; return { x: o.x + dx / d * o.r, y: o.y + dy / d * o.r, inside: d < o.r }; }
      const cx = clamp(x, o.x0, o.x1), cy = clamp(y, o.y0, o.y1);
      return { x: cx, y: cy, inside: x > o.x0 && x < o.x1 && y > o.y0 && y < o.y1 };
    }
    inObstacle(x, y) {
      for (const o of this.obstacles) {
        if (o.void || o.low) continue;
        if (o.circle ? (x - o.x) ** 2 + (y - o.y) ** 2 < o.r * o.r : x > o.x0 && x < o.x1 && y > o.y0 && y < o.y1) return o;
      }
      return null;
    }
    // move a unit (anything with x, y, r) out of any obstacle it overlaps
    pushOut(u) {
      for (const o of this.obstacles) {
        if (o.void && u.kx !== undefined) continue;
        if (o.circle) {
          const dx = u.x - o.x, dy = u.y - o.y, d = Math.hypot(dx, dy), m = o.r + u.r;
          if (d < m) { const nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : 1; u.x = o.x + nx * m; u.y = o.y + ny * m; }
        } else {
          const p = this.closestOn(o, u.x, u.y);
          if (p.inside) {
            // inside the box: leave by the nearest side
            const l = u.x - o.x0, rgt = o.x1 - u.x, t = u.y - o.y0, b = o.y1 - u.y, mn = Math.min(l, rgt, t, b);
            if (mn === l) u.x = o.x0 - u.r; else if (mn === rgt) u.x = o.x1 + u.r; else if (mn === t) u.y = o.y0 - u.r; else u.y = o.y1 + u.r;
          } else {
            const dx = u.x - p.x, dy = u.y - p.y, d = Math.hypot(dx, dy);
            if (d < u.r && d > 1e-6) { u.x = p.x + dx / d * u.r; u.y = p.y + dy / d * u.r; }
          }
        }
      }
    }
    // is the straight line between two points clear of obstacles?
    clearShot(x0, y0, x1, y1) {
      if (!this.obstacles.length) return true;
      const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / 12));
      for (let i = 1; i < n; i++) { const f = i / n; if (this.inObstacle(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f)) return false; }
      return true;
    }
    // ----- battle events (opts.events): a supply drop for whoever grabs it first, an airstrike for the side that's behind,
    // and neutral meteor showers / cannon barrages / lightning storms. They use their own dice, so the rest of the battle stays the same until one happens.
    setupEvents() {
      const E = this.ER = rng(((this.seed >>> 0) ^ 0xA1D80F) >>> 0), F = this.fixed || this.target, era = this.opts.era || 'medieval';
      const allow = this.opts.events === true ? ['airdrop', 'airstrike', 'meteors', 'lightning', 'tornado', 'blizzard', 'earthquake'] : this.opts.events;
      const skies = ['modern', 'scifi', 'mixed'].includes(era) || (era === 'wild' && E.chance(0.5));
      this.events = [];
      this.buffs = [{}, {}, {}]; this.buffs[MONSTERS] = {}; this.facts = { low: [1, 1, 1], drops: [], falls: [], strike: null, hazard: null };
      this.startStr = this.teamIds().map(t => this.strength(t));
      // two supply drops, each a different kind (see grabDrop)
      if (allow.includes('airdrop')) {
        const kinds = ['squad', 'medkit', 'rage', 'shield', 'speed', 'heavy'].concat(this.opts.powerups ? POWERUPS : []), first = E.pick(kinds);
        this.events.push({ type: 'airdrop', kind: first, at: E.range(0.2, 0.3) * F, plane: skies || era === 'horror', t: 0 });
        this.events.push({ type: 'airdrop', kind: E.pick(kinds.filter(k => k !== first)), at: E.range(0.5, 0.6) * F, plane: skies || era === 'horror', t: 0 });
      }
      // then one big moment: an airstrike (battles with planes) or a hazard that hits both sides
      if (E.chance(0.9)) {
        const hz = ['meteors', 'lightning', 'tornado', 'blizzard', 'earthquake', 'stampede', 'kraken'].filter(k => allow.includes(k) && (k !== 'kraken' || era === 'pirate') && (k !== 'stampede' || !['modern', 'scifi'].includes(era)));
        if (skies && allow.includes('airstrike') && (E.chance(0.55) || !hz.length)) this.events.push({ type: 'airstrike', from: E.range(0.4, 0.5) * F, last: 0.66 * F, orbital: era === 'scifi', t: 0 });
        else if (hz.length) {
          const k = E.pick(hz), at = E.range(0.36, 0.48) * F;
          if (k === 'meteors' || k === 'lightning') this.events.push({ type: 'meteors', at, style: k === 'lightning' ? 'lightning' : era === 'pirate' ? 'cannonballs' : 'meteors', t: 0 });
          else this.events.push({ type: k, at, t: 0 });
        }
      }
    }
    // how much fighting power a side has left: troop costs, weighted by health, plus reinforcements still to come
    strength(team) {
      let s = 0;
      for (const u of this.units) if (u.team === team && !u.dead) s += UNIT[u.type].cost * clamp(u.hp / u.max, 0, 1);
      for (const wv of this.waves[team]) if (!wv.done) for (const k of wv.list) s += UNIT[k].cost;
      return s;
    }
    // which side has lost more of its starting power (-1 if they're about even)
    behindSide() {
      const f = this.teamIds().map(t => this.strength(t) / (this.startStr[t] || 1));
      if (this.N === 2) return f[0] < f[1] * 0.9 ? 0 : f[1] < f[0] * 0.9 ? 1 : -1;
      const alive = this.teamIds().filter(t => this.alive[t] + this.reserve[t] > 0);
      let lo = alive[0], hi = alive[0];
      for (const t of alive) { if (f[t] < f[lo]) lo = t; if (f[t] > f[hi]) hi = t; }
      return lo !== undefined && f[lo] < f[hi] * 0.9 ? lo : -1;
    }
    teamIds() { return this.N === 3 ? [0, 1, 2] : [0, 1]; }
    totals() { return this.teamIds().map(t => this.alive[t] + this.reserve[t]); }
    // which team-wide boost is running for a team
    buffOn(team, k) { return this.buffs && this.buffs[team][k] > this.fightT; }
    ev_airdrop(ev, h) {
      if (!ev.started) {
        if (this.fightT < ev.at) return;
        // drop point: on the middle line, or nearer the side that's behind (so drops help the underdog, though the leader
        // can still steal it), clear of obstacles
        const behind = this.behindSide();
        const E = this.ER, p = this.N === 3
          ? { x: AR.x + AR.w / 2 + (behind < 0 ? 0 : Math.cos(this.homeAngle(behind)) * 150) + E.range(-60, 60), y: AR.y + AR.h / 2 + (behind < 0 ? 0 : Math.sin(this.homeAngle(behind)) * 150) + E.range(-60, 60), r: 22 }
          : { x: E.range(AR.x + 170, AR.x + AR.w - 170), y: AR.y + AR.h / 2 + (behind < 0 ? 0 : behind === 0 ? -150 : 150) + E.range(-30, 30), r: 22 };
        for (let k = 0; k < 4; k++) this.pushOut(p);
        Object.assign(ev, { started: true, x: p.x, y: p.y, r: 14, dir: E.chance(0.5) ? 1 : -1, release: ev.plane ? 1 : 0, T: 2.2, size: ev.kind === 'heavy' ? 1.45 : 1 });
        this.banner(ev.plane ? 'AIRDROP INCOMING!' : 'SUPPLY DROP!', COL.gold);
        this.snd(ev.plane ? 'plane' : 'whoosh');
        if (this.camEv) this.camEv.push({ type: 'airdrop', ev });
      }
      ev.t += h;
      if (!ev.landed) {
        if (ev.t >= ev.release + ev.T) { ev.landed = true; this.drop = ev; this.burst(ev.x, ev.y, '#C9A36A', 10, 180, 0.5, 6); this.shake(4); this.snd('thunk'); }
        return;
      }
      // the first troop to reach the crate grabs it
      for (const u of this.units) if (!u.dead && u.team < 3 && Math.hypot(u.x - ev.x, u.y - ev.y) < u.r + 18 * ev.size) { this.grabDrop(ev, u.team); break; }
    }
    // What's in a supply crate:
    //   squad  - a squad of that army's best troop (worth about 14 recruits)
    //   medkit - every troop on that side healed by half its health
    //   rage   - that side hits 50% harder for 8 seconds
    //   shield - that side takes half damage for 8 seconds
    //   speed  - that side moves 35% faster for 8 seconds
    //   heavy  - a big unit from that army's genre (giant, tank, dragon, mech or cannon)
    grabDrop(ev, team) {
      ev.done = true; this.drop = null; ev.team = team;
      if (this.facts) this.facts.drops.push({ kind: ev.kind || 'squad', team });
      const kind = ev.kind || 'squad', name = TEAMS[team].name;
      let text = '';
      if (kind === 'squad') {
        const doc = this.doc[team], keys = Object.keys(doc.mix).filter(k => UNIT[k] && !UNIT[k].healer && UNIT[k].rank !== 0 && !UNIT[k].commander && !UNIT[k].uncounted);
        const elite = keys.length ? keys.reduce((a, b) => (UNIT[b].cost > UNIT[a].cost ? b : a)) : doc.base || 'soldier';
        const n = clamp(Math.round(14 / UNIT[elite].cost), 3, 8);
        for (let k = 0; k < n; k++) { const a = k / n * TAU; this.addUnit(team, elite, ev.x + Math.cos(a) * 26, ev.y + Math.sin(a) * 26); }
        this.gained = this.gained || [0, 0, 0]; this.gained[team] += n;
        text = `${name} GRABS THE DROP · +${n}`;
      } else if (kind === 'heavy') {
        const doc = this.doc[team], era = eraOf(doc.custom ? doc : doc.name);
        const big = (doc.heavy && doc.heavy[0]) || (doc.dragon ? 'dragon' : doc.tank ? 'tank' : doc.giant ? 'giant' : { modern: 'tank', fantasy: 'dragon', scifi: 'mech', pirate: 'cannon' }[era] || 'giant');
        this.addUnit(team, big, ev.x, ev.y);
        this.gained = this.gained || [0, 0, 0]; this.gained[team] += 1;
        text = `${name} GETS A ${big.toUpperCase()}!`;
        this.shake(10);
      } else if (kind === 'medkit') {
        for (const u of this.units) if (u.team === team && !u.dead) { u.hp = Math.min(u.max, u.hp + u.max * 0.5); u.healFlash = 1; }
        text = `${name} GRABS A MED KIT`;
        this.snd('heal');
      } else if (POWERUPS.includes(kind)) {
        text = this.powerup(kind, ev, team);
      } else {
        this.buffs[team][kind] = this.fightT + 8;
        text = `${name}: ${{ rage: 'RAGE MODE', shield: 'SHIELDS UP', speed: 'SPEED BOOST' }[kind]}!`;
      }
      this.banner(text, TEAMS[team].c, 2);
      this.burst(ev.x, ev.y, COL.gold, 18, 380, 0.6, 8); this.burst(ev.x, ev.y, TEAMS[team].c, 12, 300, 0.6, 7);
      this.snd(kind === 'squad' || kind === 'heavy' ? 'pickup' : 'powerup', { team }); this.shake(5);
      if (this.camEv) this.camEv.push({ type: 'grab', x: ev.x, y: ev.y, team });
    }
    ev_airstrike(ev, h) {
      if (!ev.called) {
        if (this.fightT < ev.from) return;
        const tot = this.totals();
        let behind, foe;
        if (this.N === 2) {
          behind = tot[0] < tot[1] * 0.8 ? 0 : tot[1] < tot[0] * 0.8 ? 1 : -1;
          if (behind < 0 && this.fightT >= ev.last) behind = tot[0] !== tot[1] ? (tot[0] < tot[1] ? 0 : 1) : (this.ER.chance(0.5) ? 0 : 1);
          if (behind < 0 || !tot[0] || !tot[1]) return;
          foe = 1 - behind;
        } else {
          const alive = [0, 1, 2].filter(t => tot[t] > 0);
          if (alive.length < 2) return;
          alive.sort((a, b) => tot[a] - tot[b]);
          behind = alive[0]; foe = alive[alive.length - 1];
          if (tot[behind] > tot[foe] * 0.8 && this.fightT < ev.last) return;
        }
        // the side that's behind calls it in on the thickest group of enemies
        const N = 6, cs = AR.w / N, cnt = new Float32Array(N * N);
        for (const u of this.units) if (u.team === foe && !u.flying) cnt[clamp((u.y - AR.y) / cs | 0, 0, N - 1) * N + clamp((u.x - AR.x) / cs | 0, 0, N - 1)]++;
        let bk = 0; for (let k = 1; k < N * N; k++) if (cnt[k] > cnt[bk]) bk = k;
        const cx0 = AR.x + (bk % N + 0.5) * cs, cy0 = AR.y + ((bk / N | 0) + 0.5) * cs;
        let sx = 0, sy = 0, n = 0;
        for (const u of this.units) if (u.team === foe && Math.hypot(u.x - cx0, u.y - cy0) < 150) { sx += u.x; sy += u.y; n++; }
        const E = this.ER, cx = n ? sx / n : cx0, cy = n ? sy / n : cy0, ang = E.range(-0.35, 0.35) + (E.chance(0.5) ? 0 : Math.PI);
        const ux = Math.cos(ang), uy = Math.sin(ang);
        ev.bombs = [];
        for (let k = 0; k < 6; k++) { const o = (k - 2.5) * 54; ev.bombs.push({ x: clamp(cx + ux * o, AR.x + 30, AR.x + AR.w - 30), y: clamp(cy + uy * o, AR.y + 30, AR.y + AR.h - 30), at: 1.3 + k * 0.08 }); }
        Object.assign(ev, { called: true, team: behind, cx, cy, ux, uy });
        if (this.facts) this.facts.strike = behind;
        this.banner(`${TEAMS[behind].name} CALLS ${ev.orbital ? 'AN ORBITAL STRIKE' : 'AN AIRSTRIKE'}!`, TEAMS[behind].c, 2);
        this.snd('alarm');
        if (this.camEv) this.camEv.push({ type: 'airstrike', ev });
        return;
      }
      ev.t += h;
      if (!ev.jetSnd && ev.t > 0.7) { ev.jetSnd = true; this.snd(ev.orbital ? 'zap' : 'jet'); }
      for (const b of ev.bombs) if (!b.done && ev.t >= b.at + 0.35) { b.done = true; this.explode({ team: ev.team, kind: 'bomb', x: b.x, y: b.y, splash: 56, dmg: 10, from: null }); }
      if (ev.t > 3.6) ev.done = true;
    }
    ev_meteors(ev, h) {
      if (!ev.started) {
        if (this.fightT < ev.at) return;
        // impacts come in mirrored pairs (one in each half) so neither side is hit harder on purpose
        const E = this.ER, mid = AR.y + AR.h / 2;
        ev.hits = [{ x: E.range(AR.x + 200, AR.x + AR.w - 200), y: mid + E.range(-30, 30), at: 0.9 }];
        for (let k = 0; k < 4; k++) {
          const dy = E.range(60, 300), at = 1.2 + k * 0.45;
          ev.hits.push({ x: E.range(AR.x + 70, AR.x + AR.w - 70), y: mid - dy, at, sx: E.range(-1, 1) }, { x: E.range(AR.x + 70, AR.x + AR.w - 70), y: mid + dy, at: at + 0.2, sx: E.range(-1, 1) });
        }
        ev.started = true;
        this.banner({ meteors: 'METEOR SHOWER!', cannonballs: 'CANNON BARRAGE!', lightning: 'LIGHTNING STORM!' }[ev.style], COL.gold, 2);
        if (this.facts) this.facts.hazard = ev.style;
        this.snd('alarm');
        if (this.camEv) this.camEv.push({ type: 'meteors', ev });
      }
      ev.t += h;
      for (const m of ev.hits) {
        if (!m.snd && ev.t >= m.at - 0.7) { m.snd = true; this.snd(ev.style === 'lightning' ? 'thunder' : 'meteor', { pan: (m.x - AR.x) / AR.w * 1.4 - 0.7 }); }
        if (!m.done && ev.t >= m.at) { m.done = true; this.explode({ team: -1, kind: ev.style === 'lightning' ? 'lightning' : 'meteor', x: m.x, y: m.y, splash: 50, dmg: 9, from: null }); }
      }
      if (ev.t > 4.6) ev.done = true;
    }
    // Tornado: a twister crosses the field for about 7 seconds, flinging troops around it and hurting them a little.
    ev_tornado(ev, h) {
      if (!ev.started) {
        if (this.fightT < ev.at) return;
        const E = this.ER, dir = E.chance(0.5) ? 1 : -1;
        Object.assign(ev, { started: true, dir, x: dir > 0 ? AR.x - 40 : AR.x + AR.w + 40, y: AR.y + AR.h / 2, ph: E.range(0, TAU), amp: E.range(90, 170) });
        this.banner('TORNADO!', COL.gold, 2); this.snd('wind'); this.snd('alarm');
        if (this.facts) this.facts.hazard = 'tornado';
        if (this.camEv) this.camEv.push({ type: 'hazard', ev });
      }
      ev.t += h;
      ev.x += ev.dir * 150 * h;
      ev.y = AR.y + AR.h / 2 + Math.sin(ev.t * 1.3 + ev.ph) * ev.amp;
      const R = 95;
      for (const u of this.units) {
        if (u.dead || UNIT[u.type].rank === 0) continue;
        const dx = u.x - ev.x, dy = u.y - ev.y, d = Math.hypot(dx, dy);
        if (d > R || d < 1) continue;
        // pulled round and round, and thrown outward
        const k = 1 - d / R, tx = -dy / d, ty = dx / d;
        u.x += (tx * 420 * k + dx / d * 160 * k) * h; u.y += (ty * 420 * k + dy / d * 160 * k) * h;
        u.hp -= 2.5 * k * h * this.hpScale; u.flash = Math.max(u.flash, 0.4);
        if (u.hp <= 0) this.damage(u, 0.01);
      }
      if (this.FX.chance(h * 40)) { const F = this.FX, a = F.range(0, TAU); this.parts.push({ x: ev.x + Math.cos(a) * 30, y: ev.y + Math.sin(a) * 30, vx: -Math.sin(a) * 260, vy: Math.cos(a) * 260 - 40, life: 0.6, age: 0, size: F.range(4, 8), color: F.chance(0.5) ? '#8A7A5A' : '#6B7280', grav: 0 }); }
      if (ev.t > 8) ev.done = true;
    }
    // Blizzard: snow sweeps the field for 7 seconds and everyone slows down.
    ev_blizzard(ev, h) {
      if (!ev.started) {
        if (this.fightT < ev.at) return;
        ev.started = true; this.chill = this.fightT + 7;
        this.banner('BLIZZARD!', '#BFE6FF', 2); this.snd('wind');
        if (this.facts) this.facts.hazard = 'blizzard';
        if (this.camEv) this.camEv.push({ type: 'hazard', ev });
      }
      ev.t += h;
      if (ev.t > 7.5) ev.done = true;
    }
    // Earthquake: the ground cracks open along a line across the middle; troops on the crack get hurt and thrown aside.
    ev_earthquake(ev, h) {
      if (!ev.started) {
        if (this.fightT < ev.at) return;
        const E = this.ER, y0 = AR.y + AR.h / 2 + E.range(-160, 160), y1 = AR.y + AR.h / 2 + E.range(-160, 160), pts = [];
        for (let k = 0; k <= 12; k++) pts.push([AR.x + AR.w * k / 12, y0 + (y1 - y0) * k / 12 + (k % 2 ? 1 : -1) * E.range(6, 22)]);
        Object.assign(ev, { started: true, pts });
        this.banner('EARTHQUAKE!', COL.gold, 2); this.snd('rumble'); this.shake(16);
        if (this.facts) this.facts.hazard = 'earthquake';
        if (this.camEv) this.camEv.push({ type: 'hazard', ev });
      }
      ev.t += h;
      if (ev.t < 2) this.shake(9);
      if (this.slashes) this.quakeFx(ev);
      if (!ev.hit && ev.t >= 0.9) {
        ev.hit = true;
        for (const u of this.units) {
          if (u.dead || u.flying) continue;
          // distance to the crack
          let best = Infinity, nx = 0, ny = 0;
          for (let k = 0; k < ev.pts.length - 1; k++) {
            const [ax, ay] = ev.pts[k], [bx, by] = ev.pts[k + 1], vx = bx - ax, vy = by - ay, f = clamp(((u.x - ax) * vx + (u.y - ay) * vy) / (vx * vx + vy * vy), 0, 1);
            const px = ax + vx * f, py = ay + vy * f, d = Math.hypot(u.x - px, u.y - py);
            if (d < best) { best = d; nx = (u.x - px) / (d || 1); ny = (u.y - py) / (d || 1); }
          }
          if (best < 34 + u.r) { this.damage(u, 7 * this.hpScale * (UNIT[u.type].rank === 0 ? 0.4 : 1)); u.x += nx * 30; u.y += ny * 30; }
        }
        for (const [x, y] of ev.pts) this.burst(x, y, '#7A6A55', 4, 220, 0.6, 7, 200);
        this.snd('boom', { gain: 0.5 });
      }
      if (ev.t > 3) { ev.done = true; (this.cracks || (this.cracks = [])).push(ev.pts); }
    }
    drawCrack(ctx, pts, k) {
      if (k <= 0) return;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.lineWidth = 14 * k; ctx.strokeStyle = 'rgba(4,6,11,0.85)'; ctx.stroke();
      ctx.lineWidth = 5 * k; ctx.strokeStyle = '#5A3A22'; ctx.stroke();
    }
    // a supply crate; its colour and icon show what's inside
    drawCrate(ctx, kind, x, y, b) {
      const C = CRATE[kind], INK = COL.ink;
      roundRect(ctx, x - b, y - b, b * 2, b * 2, 3); ctx.fillStyle = C.box; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      if (kind === 'squad') {
        ctx.lineWidth = 2; ctx.strokeStyle = '#6E4A22'; ctx.beginPath(); ctx.moveTo(x - b, y - b * 0.33); ctx.lineTo(x + b, y - b * 0.33); ctx.moveTo(x - b, y + b * 0.33); ctx.lineTo(x + b, y + b * 0.33); ctx.stroke();
        ctx.fillStyle = COL.gold; ctx.fillRect(x - b * 0.25, y - b, b * 0.5, b * 2); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.strokeRect(x - b * 0.25, y - b, b * 0.5, b * 2);
        return;
      }
      ctx.fillStyle = C.icon; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
      ctx.beginPath();
      if (kind === 'medkit') { const t = b * 0.28, l = b * 0.72; ctx.rect(x - t, y - l, t * 2, l * 2); ctx.rect(x - l, y - t, l * 2, t * 2); ctx.fill(); }
      else if (kind === 'rage') { ctx.moveTo(x, y - b * 0.8); ctx.quadraticCurveTo(x + b * 0.75, y - b * 0.1, x + b * 0.45, y + b * 0.65); ctx.lineTo(x - b * 0.45, y + b * 0.65); ctx.quadraticCurveTo(x - b * 0.75, y - b * 0.1, x - b * 0.2, y - b * 0.35); ctx.quadraticCurveTo(x - b * 0.05, y - b * 0.1, x, y - b * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else if (kind === 'shield') { ctx.moveTo(x, y - b * 0.75); ctx.lineTo(x + b * 0.62, y - b * 0.45); ctx.quadraticCurveTo(x + b * 0.6, y + b * 0.45, x, y + b * 0.8); ctx.quadraticCurveTo(x - b * 0.6, y + b * 0.45, x - b * 0.62, y - b * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else if (kind === 'speed') { ctx.moveTo(x + b * 0.2, y - b * 0.85); ctx.lineTo(x - b * 0.5, y + b * 0.1); ctx.lineTo(x - b * 0.02, y + b * 0.1); ctx.lineTo(x - b * 0.25, y + b * 0.85); ctx.lineTo(x + b * 0.5, y - b * 0.15); ctx.lineTo(x + b * 0.02, y - b * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else if (kind === 'heavy') { star(ctx, x, y, b * 0.7); ctx.fill(); ctx.stroke(); }
      else this.crateIcon2(ctx, kind, x, y, b);
    }
    // team-wide boosts on the troops: a red-hot ring (rage), a blue bubble (shield) or speed lines (speed)
    drawBoosts(ctx) {
      for (let tm = 0; tm < this.N; tm++) {
        const rage = this.buffOn(tm, 'rage'), shield = this.buffOn(tm, 'shield'), speed = this.buffOn(tm, 'speed');
        if (!rage && !shield && !speed) continue;
        const pulse = 0.5 + 0.5 * Math.sin(this.t * 8);
        ctx.lineCap = 'round';
        for (const u of this.units) {
          if (u.team !== tm || u.dead) continue;
          if (rage) { ctx.beginPath(); ctx.arc(u.x, u.y, u.r + 4, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,90,40,${0.55 + 0.35 * pulse})`; ctx.stroke(); }
          if (shield) { ctx.beginPath(); ctx.arc(u.x, u.y, u.r + 6, 0, TAU); ctx.fillStyle = 'rgba(124,200,255,0.16)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(160,220,255,0.8)'; ctx.stroke(); }
          if (speed) {
            const v = Math.hypot(u.vx, u.vy); if (v < 20) continue;
            const ux = u.vx / v, uy = u.vy / v;
            ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,240,150,0.7)'; ctx.beginPath();
            for (const o of [-0.5, 0.5]) { const sx = u.x - ux * (u.r + 3) - uy * o * u.r, sy = u.y - uy * (u.r + 3) + ux * o * u.r; ctx.moveTo(sx, sy); ctx.lineTo(sx - ux * 14, sy - uy * 14); }
            ctx.stroke();
          }
        }
      }
    }
    // the winner's best fighter gets a crown in the outro
    drawMvp(ctx) {
      if (this.phase !== 'outro' || !this.best) return;
      const u = this.best[this.winner];
      if (!u || u.dead || (u.kills || 0) < 3) return;
      const k = clamp((this.outroT - 0.6) / 0.4, 0, 1); if (!k) return;
      const x = u.x, y = u.y - u.r - 18 - 3 * Math.sin(this.t * 5), s = easeOutBack(k);
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      ctx.beginPath(); ctx.moveTo(-13, 6); ctx.lineTo(-13, -8); ctx.lineTo(-6, -1); ctx.lineTo(0, -12); ctx.lineTo(6, -1); ctx.lineTo(13, -8); ctx.lineTo(13, 6); ctx.closePath();
      ctx.fillStyle = COL.gold; ctx.fill(); ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = COL.ink; ctx.stroke();
      ctx.restore();
    }
    // planes, crates, warning marks and falling rocks, drawn over the battle
    drawEvents(ctx) {
      const INK = COL.ink;
      const plane = (x, y, ang, jet, tint) => {
        // a plane seen from above, high over the battle: its shadow falls on the ground below
        for (const shadow of [true, false]) {
          ctx.save(); ctx.translate(shadow ? x + 30 : x, shadow ? y + 70 : y); ctx.rotate(ang);
          const k = jet ? 1 : 1.35;
          ctx.beginPath();
          if (jet) { ctx.moveTo(46, 0); ctx.lineTo(10, -8); ctx.lineTo(-6, -40); ctx.lineTo(-18, -40); ctx.lineTo(-12, -8); ctx.lineTo(-34, -6); ctx.lineTo(-40, -20); ctx.lineTo(-46, -20); ctx.lineTo(-44, 0); ctx.lineTo(-46, 20); ctx.lineTo(-40, 20); ctx.lineTo(-34, 6); ctx.lineTo(-12, 8); ctx.lineTo(-18, 40); ctx.lineTo(-6, 40); ctx.lineTo(10, 8); ctx.closePath(); }
          else { ctx.moveTo(44 * k, 0); ctx.quadraticCurveTo(40 * k, -8 * k, 20 * k, -8 * k); ctx.lineTo(6 * k, -8 * k); ctx.lineTo(0, -52 * k); ctx.lineTo(-12 * k, -52 * k); ctx.lineTo(-10 * k, -8 * k); ctx.lineTo(-34 * k, -7 * k); ctx.lineTo(-42 * k, -20 * k); ctx.lineTo(-48 * k, -20 * k); ctx.lineTo(-46 * k, 0); ctx.lineTo(-48 * k, 20 * k); ctx.lineTo(-42 * k, 20 * k); ctx.lineTo(-34 * k, 7 * k); ctx.lineTo(-10 * k, 8 * k); ctx.lineTo(-12 * k, 52 * k); ctx.lineTo(0, 52 * k); ctx.lineTo(6 * k, 8 * k); ctx.lineTo(20 * k, 8 * k); ctx.quadraticCurveTo(40 * k, 8 * k, 44 * k, 0); ctx.closePath(); }
          if (shadow) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill(); ctx.restore(); continue; }
          ctx.fillStyle = jet ? '#5B6472' : '#AEB6C6'; ctx.fill(); ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.stroke();
          if (tint) { ctx.beginPath(); ctx.moveTo(-4, -30); ctx.lineTo(-12, -30); ctx.lineTo(-12, 30); ctx.lineTo(-4, 30); ctx.lineWidth = 5; ctx.strokeStyle = tint; ctx.stroke(); }
          ctx.beginPath(); ctx.ellipse(jet ? 22 : 30 * k, 0, jet ? 8 : 7 * k, 3.5, 0, 0, TAU); ctx.fillStyle = '#8FE3FF'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
          ctx.restore();
        }
      };
      if (!this.slashes) for (const pts of this.cracks || []) this.drawCrack(ctx, pts, 1);
      this.drawBoosts(ctx);
      for (const ev of this.events) {
        if (ev.type === 'stampede' || ev.type === 'kraken') this.drawEvent2(ctx, ev);
        if (ev.type === 'earthquake' && ev.started && !ev.done && !this.slashes) this.drawCrack(ctx, ev.pts, clamp((ev.t - 0.6) / 0.4, 0, 1));
        if (ev.type === 'tornado' && ev.started && !ev.done) {
          // a twister seen from above: spinning grey rings around a dark eye, with its shadow
          const t = this.t, x = ev.x, y = ev.y;
          ctx.beginPath(); ctx.ellipse(x + 14, y + 20, 70, 52, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill();
          ctx.lineCap = 'round';
          for (let k = 0; k < 6; k++) {
            const r = 16 + k * 13, a0 = t * (9 - k) + k * 1.7;
            ctx.beginPath(); ctx.arc(x, y - k * 3, r, a0, a0 + 4.2); ctx.lineWidth = 9 - k; ctx.strokeStyle = COL.ink; ctx.stroke();
            ctx.lineWidth = 6 - k * 0.6; ctx.strokeStyle = k % 2 ? '#C9CED6' : '#8E97A6'; ctx.stroke();
          }
          ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fillStyle = '#3A3F4B'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = COL.ink; ctx.stroke();
        }
        if (ev.type === 'blizzard' && ev.started && !ev.done) {
          // a cold white haze and driving snow across the whole field
          const k = Math.min(1, ev.t / 0.8, (7.5 - ev.t) / 0.8);
          ctx.fillStyle = `rgba(220,240,255,${0.13 * k})`; ctx.fillRect(AR.x, AR.y, AR.w, AR.h);
          ctx.fillStyle = `rgba(255,255,255,${0.85 * k})`;
          for (let i = 0; i < 90; i++) {
            const sp = 1 + (i % 3) * 0.5, x = AR.x + ((i * 137.5 + this.t * 70 * sp) % AR.w), y = AR.y + ((i * 71.3 + this.t * 150 * sp) % AR.h);
            ctx.beginPath(); ctx.arc(x, y, 1.6 + (i % 3), 0, TAU); ctx.fill();
          }
        }
        if (ev.type === 'airdrop' && ev.started && !ev.done) {
          if (ev.plane && ev.t < ev.release + 1.6) plane(ev.x + (ev.t - ev.release) * 560 * ev.dir, ev.y - 90, ev.dir > 0 ? 0 : Math.PI, false, null);
          const f = ev.t - ev.release;
          if (f < 0) continue;
          const hgt = ev.landed ? 0 : 260 * Math.pow(1 - f / ev.T, 1.2), sc = 1 + hgt / 430, x = ev.x + Math.sin(f * 2.2) * hgt * 0.05, y = ev.y - hgt;
          ctx.beginPath(); ctx.ellipse(ev.x, ev.y + 4, 18 * (1.3 - hgt / 520), 9 * (1.3 - hgt / 520), 0, 0, TAU); ctx.fillStyle = `rgba(0,0,0,${0.35 - hgt / 1200})`; ctx.fill();
          if (!ev.landed) {
            // parachute: a striped canopy with strings down to the crate
            const cw = 34 * sc, cy = y - 48 * sc;
            ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(x - cw, cy); ctx.lineTo(x - 10 * sc, y - 10 * sc); ctx.moveTo(x + cw, cy); ctx.lineTo(x + 10 * sc, y - 10 * sc); ctx.moveTo(x, cy - 4); ctx.lineTo(x, y - 12 * sc); ctx.stroke();
            for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x, cy); ctx.arc(x, cy, cw, Math.PI + k * Math.PI / 4, Math.PI + (k + 1) * Math.PI / 4); ctx.closePath(); ctx.fillStyle = k % 2 ? '#F4F6FB' : CRATE[ev.kind || 'squad'].chute; ctx.fill(); }
            ctx.beginPath(); ctx.arc(x, cy, cw, Math.PI, TAU); ctx.closePath(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
          } else {
            const pulse = 0.5 + 0.5 * Math.sin(this.t * 6);
            ctx.beginPath(); ctx.arc(ev.x, ev.y, 26 * ev.size + pulse * 10, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = rgba(CRATE[ev.kind || 'squad'].glow, 0.35 + 0.4 * pulse); ctx.stroke();
          }
          this.drawCrate(ctx, ev.kind || 'squad', x, y, 13 * sc * ev.size);
        }
        if (ev.type === 'airstrike' && ev.called && !ev.done) {
          const warn = ev.t < 1.75, blink = 0.5 + 0.5 * Math.sin(this.t * 18);
          if (warn) {
            const a = ev.bombs[0], z = ev.bombs[ev.bombs.length - 1];
            ctx.setLineDash([14, 10]); ctx.lineWidth = 4; ctx.strokeStyle = `rgba(255,70,70,${0.4 + 0.5 * blink})`;
            ctx.beginPath(); ctx.moveTo(a.x - ev.ux * 40, a.y - ev.uy * 40); ctx.lineTo(z.x + ev.ux * 40, z.y + ev.uy * 40); ctx.stroke(); ctx.setLineDash([]);
            for (const b of ev.bombs) { ctx.beginPath(); ctx.arc(b.x, b.y, 16, 0, TAU); ctx.lineWidth = 3; ctx.stroke(); ctx.beginPath(); ctx.moveTo(b.x - 22, b.y); ctx.lineTo(b.x + 22, b.y); ctx.moveTo(b.x, b.y - 22); ctx.lineTo(b.x, b.y + 22); ctx.lineWidth = 2; ctx.stroke(); }
          }
          if (ev.orbital) {
            // beams from orbit: a bright column on each target as it hits
            for (const b of ev.bombs) { const k = (ev.t - b.at) / 0.45; if (k < 0 || k > 1) continue; const w = 14 * Math.sin(Math.PI * k);
              ctx.fillStyle = rgba(TEAMS[ev.team].c, 0.5); ctx.fillRect(b.x - w * 1.6, AR.y, w * 3.2, b.y - AR.y); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(b.x - w * 0.5, AR.y, w, b.y - AR.y); }
          } else {
            // the jet flies along the line and the bombs drop one after another
            const first = ev.bombs[0], s = (ev.t - first.at) * 675, jx = first.x + ev.ux * s, jy = first.y + ev.uy * s - 60;
            if (ev.t > 0.6 && ev.t < 3.2) plane(jx, jy, Math.atan2(ev.uy, ev.ux), true, TEAMS[ev.team].c);
            for (const b of ev.bombs) { const k = (ev.t - b.at) / 0.35; if (k < 0 || k >= 1) continue; ctx.beginPath(); ctx.ellipse(b.x, b.y - 60 * (1 - k), 6 + 3 * (1 - k), 4 + 2 * (1 - k), 0, 0, TAU); ctx.fillStyle = '#2B2F36'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); }
          }
        }
        if (ev.type === 'meteors' && ev.started && !ev.done) {
          for (const m of ev.hits) {
            const k = 1 - (m.at - ev.t) / 0.9;
            if (k < 0 || m.done && ev.t - m.at > 0.15) continue;
            if (!m.done) { ctx.beginPath(); ctx.arc(m.x, m.y, 50 * (0.4 + 0.6 * k), 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,80,60,${0.25 + 0.55 * k})`; ctx.stroke(); ctx.fillStyle = `rgba(255,80,60,${0.08 + 0.12 * k})`; ctx.fill(); }
            if (ev.style === 'lightning') {
              if (!m.done) continue;
              // a jagged bolt from the sky
              ctx.beginPath(); let lx = m.x + 30 * m.sx, ly = AR.y; ctx.moveTo(lx, ly);
              for (let i = 1; i <= 7; i++) { ly = AR.y + (m.y - AR.y) * i / 7; lx = i === 7 ? m.x : m.x + (i % 2 ? 1 : -1) * 18 + 30 * m.sx * (1 - i / 7); ctx.lineTo(lx, ly); }
              ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(160,220,255,0.55)'; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
              continue;
            }
            if (m.done) continue;
            const fx = m.x + (1 - k) * 240 * (m.sx || 0.5), fy = m.y - (1 - k) * 520;
            if (ev.style === 'cannonballs') {
              ctx.beginPath(); ctx.arc(fx, fy, 9, 0, TAU); ctx.fillStyle = '#1C1E22'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#5B6472'; ctx.stroke();
            } else {
              // a tapering fiery tail behind the rock
              const tx = 70 * (m.sx || 0.5), ty = -150;
              ctx.lineCap = 'round';
              for (let i = 0; i < 5; i++) { const f0 = i / 5, f1 = (i + 1) / 5; ctx.beginPath(); ctx.moveTo(fx + tx * f0, fy + ty * f0); ctx.lineTo(fx + tx * f1, fy + ty * f1); ctx.lineWidth = 22 * (1 - f0); ctx.strokeStyle = `rgba(255,${150 + 60 * f0 | 0},40,${0.55 * (1 - f0)})`; ctx.stroke(); }
              ctx.beginPath(); ctx.arc(fx, fy, 13, 0, TAU); ctx.fillStyle = '#FF8A1F'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
              ctx.beginPath(); ctx.arc(fx - 3, fy - 3, 6, 0, TAU); ctx.fillStyle = '#FFD23F'; ctx.fill();
            }
          }
        }
      }
    }
    // ----- getting around obstacles -----
    // does a troop of radius rad fit along the straight line from (x0, y0) to (x1, y1)? Returns the first obstacle in the way.
    pathBlock(x0, y0, x1, y1, rad) {
      const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / 10));
      for (let i = 1; i <= n; i++) {
        const f = i / n, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
        for (const o of this.obstacles) if (o.circle ? (x - o.x) ** 2 + (y - o.y) ** 2 < (o.r + rad) ** 2 : x > o.x0 - rad && x < o.x1 + rad && y > o.y0 - rad && y < o.y1 + rad) return o;
      }
      return null;
    }
    // spots to walk through around an obstacle: its four corners (boxes) or eight points around it (round ones), with room for a troop of radius r
    navPoints(o, r) {
      const m = r + 10, pts = [];
      if (o.circle) for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, R = (o.r + m) * 1.08; pts.push([o.x + Math.cos(a) * R, o.y + Math.sin(a) * R]); }
      else pts.push([o.x0 - m, o.y0 - m], [o.x1 + m, o.y0 - m], [o.x1 + m, o.y1 + m], [o.x0 - m, o.y1 + m]);
      return pts.filter(p => p[0] > AR.x + r && p[0] < AR.x + AR.w - r && p[1] > AR.y + r && p[1] < AR.y + AR.h - r && !this.pathBlock(p[0], p[1], p[0], p[1], r * 0.8));
    }
    // the way to walk toward (tx, ty): straight if nothing is in the way, otherwise via the best spot around the obstacle that blocks it
    route(u, tx, ty, end) {
      const L = Math.hypot(tx - u.x, ty - u.y), stop = Math.max(0, L - end) / (L || 1);
      const o = this.pathBlock(u.x, u.y, u.x + (tx - u.x) * stop, u.y + (ty - u.y) * stop, u.r * 0.7);
      if (!o) return null;
      let best = null, bc = Infinity;
      for (const p of this.navPoints(o, u.r)) {
        const d1 = Math.hypot(p[0] - u.x, p[1] - u.y);
        if (d1 < 8 || (u.lastWp && Math.hypot(p[0] - u.lastWp[0], p[1] - u.lastWp[1]) < 4)) continue;
        if (this.pathBlock(u.x, u.y, p[0], p[1], u.r * 0.7)) continue;
        const c = d1 + Math.hypot(tx - p[0], ty - p[1]);
        if (c < bc) { bc = c; best = p; }
      }
      return best;
    }
    // direction to walk to reach target t (keeps a chosen detour until it's reached); the answer goes in this.ndx, this.ndy
    navDir(u, t, nx, ny) {
      this.ndx = nx; this.ndy = ny;
      if (!this.obstacles.length || u.flying) return;
      if (u.wp && (u.wpFor !== t || this.fightT > u.wpUntil)) u.wp = null;
      if (u.wp) {
        const dx = u.wp[0] - u.x, dy = u.wp[1] - u.y, d = Math.hypot(dx, dy);
        if (d > 12) { this.ndx = dx / d; this.ndy = dy / d; return; }
        u.lastWp = u.wp; u.wp = null; u.navAt = 0;
      }
      if (this.fightT >= (u.navAt || 0)) {
        u.navAt = this.fightT + 0.3;
        const p = this.route(u, t.x, t.y, t.r + u.r);
        if (p) { u.wp = p; u.wpFor = t; u.wpUntil = this.fightT + 2.5; const dx = p[0] - u.x, dy = p[1] - u.y, d = Math.hypot(dx, dy) || 1; this.ndx = dx / d; this.ndy = dy / d; return; }
        u.lastWp = null;
      }
    }
    // a shooter with its target in range looks for cover close by: a spot hugging an obstacle, beside or behind it as seen from the enemy,
    // from where it can still hit the target (grenades, shells and fireballs fly over, so those troops can hide right behind)
    findCover(u, t, U) {
      let best = null, bd = 140;
      for (const o of this.obstacles) {
        if (o.void || o.low) continue;
        const p0 = this.closestOn(o, u.x, u.y);
        if (Math.hypot(p0.x - u.x, p0.y - u.y) > 140) continue;
        const ox = o.circle ? o.x : (o.x0 + o.x1) / 2, oy = o.circle ? o.y : (o.y0 + o.y1) / 2, size = o.circle ? o.r : Math.hypot(o.x1 - o.x0, o.y1 - o.y0) / 2;
        const ex = t.x - ox, ey = t.y - oy, el = Math.hypot(ex, ey) || 1;
        for (const p of this.navPoints(o, u.r - 4)) {
          const ahead = ((p[0] - ox) * ex + (p[1] - oy) * ey) / el;
          if (ahead > (U.lob ? -size * 0.5 : size * 0.25)) continue;
          if (Math.hypot(t.x - p[0], t.y - p[1]) > U.range * 0.95) continue;
          if (!U.lob && !this.clearShot(p[0], p[1], t.x, t.y)) continue;
          const d = Math.hypot(p[0] - u.x, p[1] - u.y);
          if (d < bd && !this.pathBlock(u.x, u.y, p[0], p[1], u.r * 0.7)) { bd = d; best = p; }
        }
      }
      return best;
    }
    // bend a desired velocity around obstacles in the way, so troops walk around instead of pushing into them
    steer(u, dvx, dvy) {
      for (const o of this.obstacles) {
        const p = this.closestOn(o, u.x, u.y), ax = p.x - u.x, ay = p.y - u.y, d = Math.hypot(ax, ay) || 1, near = u.r + 34;
        if (d > near) continue;
        const nx = ax / d, ny = ay / d, into = dvx * nx + dvy * ny;
        if (into <= 0) continue;
        // drop the part of the motion that goes into the obstacle and slide along it instead
        let tx = -ny, ty = nx; if (tx * dvx + ty * dvy < 0) { tx = -tx; ty = -ty; }
        const w = 1 - d / near, sp = Math.hypot(dvx, dvy);
        dvx = dvx - nx * into * w + tx * sp * 0.8 * w; dvy = dvy - ny * into * w + ty * sp * 0.8 * w;
      }
      this.stx = dvx; this.sty = dvy;
    }
    // A grenade or shell lands: damage every enemy in the blast, more near the middle.
    explode(a) {
      const big = a.kind === 'shell' || a.kind === 'cannonball' || a.kind === 'bomb' || a.kind === 'meteor' || a.kind === 'lightning' || a.kind === 'boulder' || a.kind === 'slam';
      for (const o of this.units) {
        if (o.dead || o.team === a.team || o.phased) continue;
        const d = Math.hypot(o.x - a.x, o.y - a.y), reach = a.splash + o.r;
        if (d < reach) { if (this.ext) this._kind = 'blast'; this.damage(o, a.dmg * (1 - 0.5 * d / reach) * Math.max(UNIT[o.type].armor, 0.5) * this.dmgMul, a.from); if (this.ext && a.fx) this.hitFx(o, a.fx, a.from); }
      }
      if (this.ext) this.explodeFx(a);
      if (this.camEv) this.camEv.push({ type: 'blast', x: a.x, y: a.y, kind: a.kind });
      this.booms.push({ x: a.x, y: a.y, r: a.splash, t: 0, magic: a.kind === 'fireball', zap: a.kind === 'lightning' });
      if (this.slashes && this.stains) this.scorch(a.x, a.y, a.splash, big);
      if (this.fireG && FIERY[a.kind]) this.ignite(a.x, a.y, FIERY[a.kind]);
      const fire = a.kind === 'fireball';
      if (fire) { this.burst(a.x, a.y, '#C084FC', 10, 320, 0.45, 7); this.burst(a.x, a.y, '#FF9F1C', 6, 260, 0.35, 6); }
      else this.burst(a.x, a.y, a.kind === 'lightning' ? '#BFE6FF' : '#FF9F1C', big ? 16 : 9, big ? 420 : 300, 0.45, big ? 8 : 6);
      this.burst(a.x, a.y, '#7A7F88', big ? 10 : 5, 160, 0.8, 9, -40);
      this.shake(big ? 7 : 3);
      this.snd('blast', { pan: (a.x - AR.x) / AR.w * 1.4 - 0.7, big });
    }
    nearest(u) {
      let best = null, bd = Infinity;
      for (const o of this.units) {
        if (o.team === u.team || o.dead) continue;
        const d = (o.x - u.x) ** 2 + (o.y - u.y) ** 2;
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    }
    hash() {
      const g = this.grid; g.clear();
      for (const u of this.units) {
        if (u.dead) continue;
        const k = ((u.x - AR.x) / 64 | 0) * 64 + ((u.y - AR.y) / 64 | 0);
        let b = g.get(k); if (!b) { b = []; g.set(k, b); } b.push(u);
      }
    }
    // colour for a banner about a fallen troop: the other side's colour (in three-way battles, the killer's)
    foeCol(u, from) { return this.N === 2 && u.team < 2 ? TEAMS[1 - u.team].c : from && TEAMS[from.team] ? TEAMS[from.team].c : COL.gold; }
    damage(u, dmg, from) {
      const kind0 = this._kind;
      if (this.paceK !== undefined) dmg *= this.paceK;
      if (this.buffs) { if (from && this.buffOn(from.team, 'rage')) dmg *= 1.5; if (this.buffOn(u.team, 'shield')) dmg *= 0.5; }
      if (this.ext) { dmg = this.dmgMod(u, dmg, from); if (!(dmg > 0)) return; }
      u.hp -= dmg; u.flash = 1;
      if (this.slashes && from && from.team !== u.team && !this._dot && kind0 !== 'blast') this.addSlash(u, from);
      if (this.ext) { if (from && from.team !== u.team && !u.dead) this.onHit(u, from, dmg); if (UNIT[u.type].boss || u.boss) this.bossCheck(u); }
      if (u.hp <= 0 && !u.dead) {
        if (this.ext && this.cheatDeath(u, from)) return;
        u.dead = true;
        if (!UNIT[u.type].uncounted) this.alive[u.team]--;
        if (from && from.team !== u.team && !UNIT[u.type].decoy) {
          from.kills = (from.kills || 0) + 1;
          if (!this.best) this.best = [null, null];
          if (!this.best[from.team] || from.kills > this.best[from.team].kills) this.best[from.team] = from;
          // kill streak callouts: three kills in quick succession and up
          from.streak = this.fightT - (from.lastKill ?? -9) < 1.6 ? (from.streak || 1) + 1 : 1; from.lastKill = this.fightT;
          const call = { 3: 'TRIPLE KILL', 5: 'RAMPAGE', 8: 'UNSTOPPABLE' }[from.streak];
          if (call && this.fightT >= (this.nextCall || 0)) { this.nextCall = this.fightT + 2.2; this.float(from.x, from.y - from.r - 16, call, from.streak >= 5 ? '#FF6B3D' : COL.gold, from.streak >= 5 ? 40 : 34, 1.2); this.snd('streak', { big: from.streak >= 5 }); }
        }
        if (this.facts && UNIT[u.type].rank === 0) this.facts.falls.push(u.type);
        if (this.camEv) this.camEv.push({ type: 'death', x: u.x, y: u.y, unit: u, big: UNIT[u.type].rank === 0, by: from });
        this.lastDeath = { t: this.fightT, x: u.x, y: u.y, uid: u.uid, type: u.type, team: u.team, by: from ? from.uid : 0, byType: from ? from.type : null, byTeam: from ? from.team : -1 };
        const huge = UNIT[u.type].rank === 0;
        // bitten by a zombie: gets back up as a zombie on the zombies' side
        if (from && UNIT[from.type].infect && LIVING[u.type] && from.team !== u.team) { (this.rising || (this.rising = [])).push({ x: u.x, y: u.y, team: from.team, t: 0.7 }); }
        this.burst(u.x, u.y, TEAMS[u.team].c, huge ? 40 : 9, huge ? 700 : 300, 0.5, huge ? 12 : 7);
        if (this.stains) this.splats.push(u);
        this.snd('pop', { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7, big: u.type === 'giant' || u.type === 'knight' });
        if (u.type === 'dragon') { this.shake(20); this.snd('boom', { gain: 0.6 }); this.banner(`${TEAMS[u.team].name} DRAGON SLAIN`, this.foeCol(u, from)); }
        if (u.type === 'tank') { this.shake(20); this.booms.push({ x: u.x, y: u.y, r: 70, t: 0 }); this.snd('boom', { gain: 0.6 }); this.banner(`${TEAMS[u.team].name} TANK DESTROYED`, this.foeCol(u, from)); }
        if (u.type === 'giant') { this.shake(20); this.snd('boom', { gain: 0.6 }); this.banner(`${TEAMS[u.team].name} GIANT FALLS`, this.foeCol(u, from)); }
        if (u.type === 'mech') { this.shake(20); this.booms.push({ x: u.x, y: u.y, r: 70, t: 0 }); this.snd('boom', { gain: 0.6 }); this.banner(`${TEAMS[u.team].name} MECH DOWN`, this.foeCol(u, from)); }
        if (u.type === 'cannon') { this.shake(14); this.booms.push({ x: u.x, y: u.y, r: 60, t: 0 }); this.snd('boom', { gain: 0.5 }); this.banner(`${TEAMS[u.team].name} CANNON DESTROYED`, this.foeCol(u, from)); }
        if (this.ext) {
          if (huge && UNIT[u.type].ext) { this.shake(18); this.snd('boom', { gain: 0.6 }); this.banner(`${TEAMS[u.team].name} ${labelOf(u.type).replace(/^THE /, '')} FALLS`, this.foeCol(u, from)); }
          this.onDeath(u, from);
        }
      }
    }
    step(h) {
      const R = this.R;
      this.fightT += h;
      this.hash();
      for (const u of this.units) {
        if (u.dead) continue;
        const U = UNIT[u.type];
        if (this.ext && this.preUnit(u, U, h)) continue;
        u.cd -= h; u.retarget -= h;
        if (!u.target || u.target.dead || u.retarget <= 0 || (this.ext && (u.target.phased || u.target.team === u.team) && !(u.confT > this.fightT))) { u.target = this.ext ? this.pickTarget(u, U) : this.nearest(u); u.retarget = R.range(0.25, 0.4); }
        const t = u.target;
        let dvx = 0, dvy = 0;
        if (t) {
          const dx = t.x - u.x, dy = t.y - u.y, d = Math.hypot(dx, dy) || 1;
          const nx = dx / d, ny = dy / d;
          // turn smoothly toward the target: ease in, and never faster than 9 rad/s, however fast the target moves
          { let df = Math.atan2(dy, dx) - u.face; df = Math.atan2(Math.sin(df), Math.cos(df)); const cap = 9 * h; u.face += clamp(df * Math.min(1, h * 12), -cap, cap); }
          let spd = U.speed * this.speedMul * (u.pace || 1) * (this.buffs ? (this.buffOn(u.team, 'speed') ? 1.35 : 1) * (this.chill > this.fightT ? 0.55 : 1) : 1);
          if (this.ext) spd *= this.spdMod(u, U);
          if (U.healer) {
            // keep a safe distance behind the fighting, following the army
            if (d < U.range * 0.85) { dvx = -nx * spd * 0.7; dvy = -ny * spd * 0.7; }
            else if (d > U.range * 1.5) { this.navDir(u, t, nx, ny); dvx = this.ndx * spd * 0.8; dvy = this.ndy * spd * 0.8; }
            if (u.cd <= 0 && U.pulse) { this.pulseHeal(u, U); u.cd = U.cd * R.range(0.9, 1.1); }
            else if (u.cd <= 0) {
              let best = null, worst = 0.999;
              for (const o of this.units) {
                if (o.dead || o.team !== u.team || o === u) continue;
                const fr = o.hp / o.max;
                if (fr < worst && (o.x - u.x) ** 2 + (o.y - u.y) ** 2 < U.healRange * U.healRange) { worst = fr; best = o; }
              }
              if (best) {
                if (this.ext) this.heal(best, U.heal); else best.hp = Math.min(best.max, best.hp + U.heal);
                best.healFlash = 1; u.healFx = 1; u.healTo = best;
                u.cd = U.cd * R.range(0.9, 1.1);
                this.burst(best.x, best.y, '#7CFFB0', 5, 120, 0.5, 5, -60);
                this.snd('heal', { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7 });
              } else u.cd = 0.3;
            }
          } else if (U.ranged) {
            const RG = this.ext ? U.range * this.rangeMod(u, U) : U.range;
            const tactical = this.obstacles.length && !u.flying && U.rank !== 0;
            if (d > RG) { if (tactical) { u.cover = null; this.navDir(u, t, nx, ny); dvx = this.ndx * spd; dvy = this.ndy * spd; } else { dvx = nx * spd; dvy = ny * spd; } }
            else if (d < RG * 0.45 && this.pushStage < 2) { dvx = -nx * spd * 0.6; dvy = -ny * spd * 0.6; }
            else if (tactical) {
              // in range: take cover nearby if there is any, then hold there and shoot
              if (u.coverFor !== t || this.fightT >= (u.coverAt || 0)) { u.cover = this.findCover(u, t, U); u.coverFor = t; u.coverAt = this.fightT + 1.5; }
              if (u.cover) { const cx = u.cover[0] - u.x, cy = u.cover[1] - u.y, cl = Math.hypot(cx, cy); if (cl > 5) { const k = spd * Math.min(1, cl / 30) / cl; dvx = cx * k; dvy = cy * k; } }
            }
            // no clear shot (grenades, shells and fireballs fly over walls, so they never need one): go around and find an angle
            // (checked a few times a second, and the troop keeps moving between checks)
            if (!U.lob && d <= RG && this.obstacles.length) {
              if (u.cd <= 0 || this.fightT >= (u.losAt || 0)) { u.noShot = !this.clearShot(u.x, u.y, t.x, t.y); u.losAt = this.fightT + 0.15; }
            } else if (u.noShot) u.noShot = false;
            const blocked = u.noShot;
            if (blocked) { u.cover = null; u.coverAt = this.fightT + 1; this.navDir(u, t, nx, ny); dvx = this.ndx * spd; dvy = this.ndy * spd; if (u.cd <= 0) u.cd = 0.15; }
            if (this.ext && U.kite && !blocked && d <= RG) { this.kite(u, nx, ny, d, RG, spd); dvx = this.ndx; dvy = this.ndy; }
            if (!blocked && d <= RG && u.cd <= 0) {
              u.cd = U.cd * R.range(0.85, 1.15); if (this.ext) u.cd *= this.cdMod(u);
              const pan = (u.x - AR.x) / AR.w * 1.4 - 0.7;
              if (U.lob) {
                // grenade or tank shell: flies to where the target is heading and explodes there
                const v = U.bullet, lead = d / v;
                // a mech fires a salvo of rockets from its two pods, spread around the target
                for (let sv = 0, n = U.salvo || 1; sv < n; sv++) {
                  let tx = t.x + t.vx * lead, ty = t.y + t.vy * lead;
                  if (U.lob === 'grenade') { tx += R.range(-14, 14); ty += R.range(-14, 14); }
                  if (U.lob === 'rocket') { tx += R.range(-30, 30); ty += R.range(-30, 30); }
                  const side = n > 1 ? (sv % 2 ? 1 : -1) * u.r * 0.6 : 0, sx = u.x - Math.sin(u.face) * side, sy = u.y + Math.cos(u.face) * side;
                  const T = Math.max(0.15, Math.hypot(tx - u.x, ty - u.y) / v) * (1 + sv * 0.08);
                  this.arrows.push({ team: u.team, kind: U.lob, x: sx, y: sy, sx, sy, tx, ty, t: 0, T, dmg: U.dmg, splash: U.splash, vx: (tx - sx) / T, vy: (ty - sy) / T, from: u });
                  if (this.ext) this.tagShot(this.arrows[this.arrows.length - 1], u, U);
                }
                if (U.lob === 'grenade') u.lunge = 1;
                u.muzzle = 1;
                this.snd(U.sound || (U.lob === 'shell' ? 'cannon' : U.lob === 'fireball' ? 'flame' : 'swish'), { pan });
                if (U.lob === 'shell' || U.lob === 'cannonball') this.shake(3);
                if (U.lob === 'cannonball') this.burst(u.x + Math.cos(u.face) * u.r * 1.6, u.y + Math.sin(u.face) * u.r * 1.6, '#9AA0AA', 5, 90, 0.9, 12, -30);
              } else {
                const v = U.bolt || U.bullet || 600, lead = d / v;
                let ax = t.x + t.vx * lead - u.x, ay = t.y + t.vy * lead - u.y;
                if (U.spread) { const j = R.range(-U.spread, U.spread), c = Math.cos(j), sn = Math.sin(j); [ax, ay] = [ax * c - ay * sn, ax * sn + ay * c]; }
                const al = Math.hypot(ax, ay) || 1;
                // too many bullets in the air: fold this shot's damage into the next one instead of adding another
                if (U.bullet && this.arrows.length > 160) { u.bank = (u.bank || 0) + U.dmg; u.muzzle = 1; }
                else {
                let shotDmg = U.dmg + (u.bank || 0); u.bank = 0;
                // fewer, harder-hitting rounds from rapid-fire guns (rules.combat.fewerBullets): the same damage, half the bullets
                if (this.cmb && this.cmb.fewerBullets && U.bullet && U.cd < 0.4) { shotDmg *= 2; u.cd *= 2; }
                // machine guns show a tracer on every third round, like real tracer ammo, so bursts stay readable
                u.shots = (u.shots || 0) + 1;
                const tracer = u.type !== 'gunner' || u.shots % 3 === 0;
                this.arrows.push({ tracer, team: u.team, x: u.x + (ax / al) * (u.r + 4), y: u.y + (ay / al) * (u.r + 4), vx: (ax / al) * v, vy: (ay / al) * v, life: (U.range / v) * 1.35, dmg: shotDmg, bolt: !!U.bolt, kind: U.laser ? 'laser' : U.bullet ? (U.pierce ? 'sniper' : 'bullet') : undefined, pierce: U.pierce || 0, from: u });
                if (this.ext) this.tagShot(this.arrows[this.arrows.length - 1], u, U);
                if (U.bullet) u.muzzle = 1;
                }
                // a musket shot leaves a puff of smoke
                if (u.type === 'musketeer') { const F = this.FX; for (let k = 0; k < 3; k++) this.parts.push({ x: u.x + Math.cos(u.face) * (u.r + 20), y: u.y + Math.sin(u.face) * (u.r + 20), vx: Math.cos(u.face) * F.range(30, 70) + F.range(-20, 20), vy: Math.sin(u.face) * F.range(30, 70) + F.range(-20, 20), life: F.range(0.7, 1.1), age: 0, size: F.range(8, 12), color: '#C9CDD4', grav: 0, smoke: true }); }
                this.snd(U.sound || (U.bullet ? (u.type === 'sniper' ? 'snipe' : u.type === 'gunner' ? 'mg' : 'shot') : 'volley'), { pan });
              }
            }
          } else {
            const edge = d - u.r - t.r;
            if (edge > U.reach) { if (this.obstacles.length && !u.flying) { this.navDir(u, t, nx, ny); dvx = this.ndx * spd; dvy = this.ndy * spd; } else { dvx = nx * spd; dvy = ny * spd; } }
            else if (u.cd <= 0) {
              u.cd = U.cd * R.range(0.85, 1.15); if (this.ext) u.cd *= this.cdMod(u);
              u.lunge = 1;
              if (U.breath) {
                // fire breath: everyone in a cone in front of the dragon gets burned
                for (const o of this.units) {
                  if (o.dead || o.team === u.team) continue;
                  const ex = o.x - u.x, ey = o.y - u.y, ed = Math.hypot(ex, ey);
                  if (ed > U.breath + u.r + o.r) continue;
                  let da = Math.atan2(ey, ex) - u.face; da = Math.atan2(Math.sin(da), Math.cos(da));
                  if (Math.abs(da) < 0.5) this.damage(o, U.dmg * Math.max(UNIT[o.type].armor, 0.6) * this.dmgMul, u);
                }
                const F = this.FX;
                for (let i = 0; i < 9; i++) {
                  const a = u.face + F.range(-0.45, 0.45), v = F.range(260, 480);
                  this.parts.push({ x: u.x + Math.cos(u.face) * u.r, y: u.y + Math.sin(u.face) * u.r, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: F.range(0.25, 0.4), age: 0, size: F.range(7, 13), color: F.chance(0.5) ? '#FF9F1C' : '#FFD23F', grav: 0 });
                }
                this.snd('flame', { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7 });
              } else if (U.splash) {
                for (const o of this.units) if (!o.dead && o.team !== u.team && Math.hypot(o.x - t.x, o.y - t.y) < U.splash + o.r) this.damage(o, U.dmg * this.dmgMul, u);
                this.shake(8); this.snd('stomp', { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7 });
                this.burst(t.x, t.y, COL.muted, 10, 300, 0.4, 7);
              } else {
                let hit = U.dmg * this.dmgMul * (UNIT[t.type].block || 1);
                if (this.ext) hit = this.meleeHit(u, U, t, hit);
                this.damage(t, hit, u);
                // a vampire's bite heals it
                if (U.drain) { u.hp = Math.min(u.max, u.hp + hit * U.drain); u.drainFx = 1; }
                this.snd(this.hitSfx(u, t), { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7 });
                if (u.type === 'ninja' || u.type === 'pirate') this.snd('swish', { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7 });
              }
              if (this.ext) this.meleeFx(u, U, t);
              if (U.sword) {
                // swing from the side the sword rests on to the other side
                const side = u.swordSide || -1;
                u.swingFrom = side; u.swordSide = -side; u.swing = 1;
                u.swingStart = u.swordOff === undefined ? side * 1.05 : u.swordOff; // start the swing from wherever the sword is now
                this.snd('swish', { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7 });
              }
              if (this.FX.chance(0.5)) this.burst((u.x + t.x) / 2, (u.y + t.y) / 2, COL.white, 2, 180, 0.2, 5);
            }
          }
        }
        if (this.tribes && u.tribe) { this.tacMove(u, U, t, dvx, dvy); dvx = this.tdx; dvy = this.tdy; }
        if (this.smart && t) { this.smartMove(u, U, t, dvx, dvy); dvx = this.sdx; dvy = this.sdy; }
        if (this.drop && !U.healer) {
          const dr = this.drop, cx = dr.x - u.x, cy = dr.y - u.y, cd = Math.hypot(cx, cy) || 1;
          if (cd < 320 && (!t || cd + 60 < Math.hypot(t.x - u.x, t.y - u.y))) {
            const sp = U.speed * this.speedMul * (u.pace || 1);
            this.navDir(u, dr, cx / cd, cy / cd); dvx = this.ndx * sp; dvy = this.ndy * sp;
          }
        }
        if (this.obstacles.length && !u.flying && (dvx || dvy)) { this.steer(u, dvx, dvy); dvx = this.stx; dvy = this.sty; }
        const k = Math.min(1, (this.iceK && !u.flying ? this.iceK : 7) * h);
        u.vx += (dvx - u.vx) * k; u.vy += (dvy - u.vy) * k;
        u.x += u.vx * h; u.y += u.vy * h;
      }
      // separation (one relaxation pass using the spatial hash)
      for (const u of this.units) {
        if (u.dead) continue;
        const ci = (u.x - AR.x) / 64 | 0, cj = (u.y - AR.y) / 64 | 0;
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          const b = this.grid.get((ci + di) * 64 + cj + dj);
          if (!b) continue;
          for (const o of b) {
            if (o === u || o.dead || o.x < u.x || (o.x === u.x && o.y <= u.y)) continue;
            if (u.flying !== o.flying || o.phased || u.phased) continue; // a dragon flies over the troops below it
            const dx = o.x - u.x, dy = o.y - u.y, d2 = dx * dx + dy * dy, m = u.r + o.r;
            if (d2 < m * m && d2 > 1e-6) {
              const d = Math.sqrt(d2), push = (m - d), nx = dx / d, ny = dy / d;
              const tot = u.m + o.m;
              u.x -= nx * push * (o.m / tot); u.y -= ny * push * (o.m / tot);
              o.x += nx * push * (u.m / tot); o.y += ny * push * (u.m / tot);
            }
          }
        }
      }
      if (this.obstacles.length) for (const u of this.units) if (!u.dead && !u.flying) this.pushOut(u);
      for (const u of this.units) {
        if (u.dead) continue;
        u.x = clamp(u.x, AR.x + u.r, AR.x + AR.w - u.r);
        u.y = clamp(u.y, AR.y + u.r, AR.y + AR.h - u.r);
      }
      if (this.arrows.length && !(this.frozenT > this.fightT)) {
        const keep = [];
        for (const a of this.arrows) {
          if (LOBS[a.kind]) {
            a.t += h;
            const p = Math.min(1, a.t / a.T);
            a.x = a.sx + (a.tx - a.sx) * p; a.y = a.sy + (a.ty - a.sy) * p;
            if (p >= 1) this.explode(a); else keep.push(a);
            continue;
          }
          // fast bullets move in short hops so they can't skip past a target
          const hops = Math.max(1, Math.ceil(Math.hypot(a.vx, a.vy) * h / 10));
          let hitU = null, gone = false;
          for (let s = 0; s < hops && !hitU && !gone; s++) {
            a.x += a.vx * h / hops; a.y += a.vy * h / hops;
            if (a.x < AR.x || a.x > AR.x + AR.w || a.y < AR.y || a.y > AR.y + AR.h) { gone = true; break; }
            if (this.obstacles.length && this.inObstacle(a.x, a.y)) { gone = true; if (this.FX.chance(0.35)) this.burst(a.x, a.y, '#AEB6C6', 2, 120, 0.25, 4); break; }
            const ci = (a.x - AR.x) / 64 | 0, cj = (a.y - AR.y) / 64 | 0;
            for (let di = -1; di <= 1 && !hitU; di++) for (let dj = -1; dj <= 1 && !hitU; dj++) {
              const b = this.grid.get((ci + di) * 64 + cj + dj);
              if (!b) continue;
              for (const o of b) if (!o.dead && o.team !== a.team && o !== a.skip && !o.phased && (o.x - a.x) ** 2 + (o.y - a.y) ** 2 < (o.r + 3 + (o.shell || 0)) ** 2) { hitU = o; break; }
            }
          }
          a.life -= h;
          if (gone || a.life <= 0) continue;
          if (hitU && UNIT[hitU.type].dodge && this.R.chance(UNIT[hitU.type].dodge)) {
            // a ninja side-steps the shot and it flies on past
            a.skip = hitU; hitU.dodgeFx = 1; hitU.dodgeSide = this.FX.chance(0.5) ? 1 : -1;
            keep.push(a);
            continue;
          }
          if (hitU) {
            const arm = UNIT[hitU.type].armor, floor = a.bolt ? 0.75 : a.pierce || 0;
            if (this.ext) this._kind = 'shot';
            this.damage(hitU, (a.dmg || UNIT.archer.dmg) * Math.max(arm, floor) * this.dmgMul, a.from);
            if (this.ext && a.fx) this.hitFx(hitU, a.fx, a.from);
            this.snd('thunk', { pan: (a.x - AR.x) / AR.w * 1.4 - 0.7, quiet: true });
            continue;
          }
          keep.push(a);
        }
        this.arrows = keep;
      }
      if (this.units.some(u => u.dead)) this.units = this.units.filter(u => !u.dead);
      if (this.rising && this.rising.length) {
        for (const z of this.rising) {
          z.t -= h;
          if (z.t > 0) continue;
          this.addUnit(z.team, 'zombie', z.x, z.y);
          this.gained = this.gained || [0, 0, 0]; this.gained[z.team]++;
          this.burst(z.x, z.y, '#8FD16A', 8, 160, 0.5, 6, -40);
          this.snd('groan', { pan: (z.x - AR.x) / AR.w * 1.4 - 0.7 });
        }
        this.rising = this.rising.filter(z => z.t > 0);
      }
      if (this.ext) this.postStep(h);
      const tots = this.totals();
      for (let tm = 0; tm < this.N; tm++) {
        const mine = tots[tm], theirs = tots.reduce((a, b) => a + b, 0) - mine;
        if (!this.lastTen[tm] && mine <= 10 && mine > 0 && theirs > 10) {
          this.lastTen[tm] = true; this.banner(`${TEAMS[tm].name}: LAST ${mine}`, TEAMS[tm].c); this.snd('alarm');
        }
      }
      let arrived = false;
      for (let tm = 0; tm < this.N; tm++) {
        for (const wv of this.waves[tm]) {
          if (wv.done) continue;
          if (this.fightT >= wv.at || this.alive[tm] === 0) { this.reinforce(tm, wv); arrived = true; break; }
        }
      }
      if (arrived) { this.banner('REINFORCEMENTS!', COL.gold); this.snd('alarm'); if (this.camEv) this.camEv.push({ type: 'reinforce' }); }
      if (this.events) for (const ev of this.events) if (!ev.done) this['ev_' + ev.type](ev, h);
      if (this.pushStage < this.pushAt.length && this.fightT >= this.pushAt[this.pushStage]) {
        this.dmgMul = this.pushMul[this.pushStage];
        this.speedMul = this.pushSpeed[this.pushStage];
        this.pushStage++;
        for (const u of this.units) u.retarget = 0;
        if (!this.chapter(['THE FINAL PUSH', 'ALL-OUT ATTACK', 'LAST STAND'][this.pushStage - 1])) this.banner(['FINAL PUSH', 'ALL-OUT ATTACK', 'LAST STAND'][this.pushStage - 1] + ` · DMG ×${this.dmgMul}`, COL.gold, 2.2);
        if (this.camEv) this.camEv.push({ type: 'push', stage: this.pushStage });
        this.snd('alarm');
      }
      if (this.opts.pace) this.paceTick();
      if (this.N === 3) { this.endCheck3(); return; }
      const total = [this.alive[0] + this.reserve[0], this.alive[1] + this.reserve[1]];
      // safety net (director only): if slow motion left the game clock so far behind that the video is about to run out
      // mid-fight, call time 2 s before the end, so every video still ends with a winner and an outro
      const late = !this.noLate && this.fixed && this.realT !== undefined && this.realT >= this.fixed - 2 && this.cap - this.fightT > 0.3;
      if (total[0] === 0 || total[1] === 0) {
        const w = total[0] > 0 ? 0 : 1;
        this.end(w, `${TEAMS[w].name} WINS`, `${total[w]} SURVIVOR${total[w] === 1 ? '' : 'S'} LEFT`);
      } else if (this.fightT >= this.cap || late) {
        const hp = [0, 0]; for (const u of this.units) hp[u.team] += u.hp;
        for (let tm = 0; tm < 2; tm++) for (const wv of this.waves[tm]) if (!wv.done) for (const k of wv.list) hp[tm] += UNIT[k].hp * this.hpScale;
        if (hp[0] === hp[1] && !this.fixed) { this.cap += 2; this.banner('OVERTIME!', COL.gold); }
        else {
          const w = total[0] !== total[1] ? (total[0] > total[1] ? 0 : 1) : hp[0] !== hp[1] ? (hp[0] > hp[1] ? 0 : 1) : (this.R.chance(0.5) ? 0 : 1);
          if (this.fixed) {
            this.retreat = 1 - w;
            this.end(w, `${TEAMS[w].name} WINS`, `${TEAMS[1 - w].name} RETREATS · ${total[w]} VS ${total[1 - w]}`);
          } else this.end(w, `${TEAMS[w].name} WINS`, `TIME! ${total[w]} VS ${total[1 - w]} STANDING`);
        }
      }
    }
    // three-way battles end when one army is left standing, or at the time limit (most troops left wins)
    endCheck3() {
      const tot = this.totals(), left = [0, 1, 2].filter(t => tot[t] > 0);
      if (left.length <= 1) {
        const w = left.length ? left[0] : 0;
        this.retreat = -1;
        this.end(w, `${TEAMS[w].name} WINS`, `LAST ARMY STANDING · ${tot[w]} LEFT`);
      } else if (this.fightT >= this.cap || (!this.noLate && this.fixed && this.realT !== undefined && this.realT >= this.fixed - 2 && this.cap - this.fightT > 0.3)) {
        const hp = [0, 0, 0]; for (const u of this.units) if (u.team < 3) hp[u.team] += u.hp;
        const w = [0, 1, 2].reduce((a, b) => (tot[b] > tot[a] || (tot[b] === tot[a] && hp[b] > hp[a]) ? b : a));
        this.retreat = -2;
        const others = [0, 1, 2].filter(t => t !== w);
        this.end(w, `${TEAMS[w].name} WINS`, `${tot[w]} VS ${tot[others[0]]} VS ${tot[others[1]]}`);
      }
    }
    // director mode: remember where everything was before a tick, so slow-motion frames can draw in between ticks
    prestep() {
      for (const u of this.units) { u.px = u.x; u.py = u.y; }
      for (const a of this.arrows) { a.px = a.x; a.py = a.y; }
    }
    outroStep(dt) {
      this.arrows = [];
      for (const u of this.units) {
        if (u.team === MONSTERS) { u.fade = clamp(1 - this.outroT / 1.2, 0, 1); u.vx *= 0.9; u.vy *= 0.9; continue; }
        if (this.N === 3 && this.retreat === -2 && u.team !== this.winner) {
          // the losing armies fall back toward where they came from
          const a = this.homeAngle(u.team % 3), vx = Math.cos(a) * 320, vy = Math.sin(a) * 320;
          u.vx += (vx - u.vx) * Math.min(1, dt * 4); u.vy += (vy - u.vy) * Math.min(1, dt * 4);
          u.x += u.vx * dt; u.y += u.vy * dt;
          { let df = a - u.face; df = Math.atan2(Math.sin(df), Math.cos(df)); const cap = 9 * dt; u.face += clamp(df * Math.min(1, dt * 12), -cap, cap); }
          u.fade = clamp(1 - this.outroT / 1.6, 0, 1);
        } else if (this.retreat === u.team) {
          const dir = u.team === 0 ? -1 : 1;
          u.vy += (dir * 320 - u.vy) * Math.min(1, dt * 4); u.vx *= 0.9;
          u.x += u.vx * dt; u.y += u.vy * dt;
          { let df = (dir > 0 ? Math.PI / 2 : -Math.PI / 2) - u.face; df = Math.atan2(Math.sin(df), Math.cos(df)); const cap = 9 * dt; u.face += clamp(df * Math.min(1, dt * 12), -cap, cap); }
          u.fade = clamp(1 - this.outroT / 1.6, 0, 1);
        } else { u.vx *= 0.9; u.vy *= 0.9; }
      }
      if (this.fixed && this.outroLen >= 5.5 && !this.tallySnd && this.outroT >= 2.4) { this.tallySnd = true; this.snd('pickup', { team: this.winner }); }
    }
    // looks of the newer round troops (body circle already drawn)
    drawNewLook(ctx, u, x, y, tm) {
      const fx = Math.cos(u.face), fy = Math.sin(u.face), px = -fy, py = fx, r = u.r, INK = COL.ink;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (u.type === 'trooper') {
        // white space helmet with a dark visor, and a stubby blaster whose tip glows when it fires
        const sx = x + px * r * 0.45, sy = y + py * r * 0.45, ex = sx + fx * (r + 11), ey = sy + fy * (r + 11);
        ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.lineWidth = 5; ctx.strokeStyle = '#2A2F3A'; ctx.stroke();
        ctx.beginPath(); ctx.arc(ex, ey, 3 + 3 * (u.muzzle || 0), 0, TAU); ctx.fillStyle = rgba(TEAMS[u.team].l, 0.6 + 0.4 * (u.muzzle || 0)); ctx.fill();
        ctx.beginPath(); ctx.arc(x - fx * 1.5, y - fy * 1.5, r * 0.62, 0, TAU); ctx.fillStyle = '#E8EDF4'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
        ctx.beginPath(); ctx.arc(x - fx * 1.5, y - fy * 1.5, r * 0.62, u.face - 0.8, u.face + 0.8); ctx.lineWidth = 4; ctx.strokeStyle = '#141820'; ctx.stroke();
      } else if (u.type === 'pirate') {
        // black polka-dot bandana with two tails, and a curved cutlass that slashes on each attack
        const sl = u.lunge || 0, ang = u.face + 0.95 - sl * 1.3, cfx = Math.cos(ang), cfy = Math.sin(ang), cpx = -cfy, cpy = cfx;
        const hx = x + cfx * (r - 2), hy = y + cfy * (r - 2), tx2 = x + cfx * (r + 20), ty2 = y + cfy * (r + 20);
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(x + cfx * (r + 12) + cpx * 6, y + cfy * (r + 12) + cpy * 6, tx2, ty2);
        ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = COL.steel; ctx.stroke();
        ctx.beginPath(); ctx.arc(hx, hy, 3.5, 0, TAU); ctx.fillStyle = COL.gold; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
        const wv = Math.sin(this.t * 10 + u.gait) * 2.5;
        ctx.lineWidth = 3.5; ctx.strokeStyle = '#15171C';
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x - fx * r * 0.5, y - fy * r * 0.5); ctx.lineTo(x - fx * (r + 7) + px * (sd * 4 + wv), y - fy * (r + 7) + py * (sd * 4 + wv)); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(x - fx * 2, y - fy * 2, r * 0.62, 0, TAU); ctx.fillStyle = '#15171C'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = '#FFFFFF'; for (const [a, d] of [[0.6, 0.3], [-1.2, 0.35], [2.4, 0.3]]) { ctx.beginPath(); ctx.arc(x - fx * 2 + Math.cos(u.face + a) * r * d, y - fy * 2 + Math.sin(u.face + a) * r * d, 1.6, 0, TAU); ctx.fill(); }
      } else if (u.type === 'musketeer') {
        // tricorn hat and a long musket
        const sx = x + px * r * 0.4 - fx * 4, sy = y + py * r * 0.4 - fy * 4, ex = sx + fx * (r + 24), ey = sy + fy * (r + 24);
        ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.lineWidth = 3; ctx.strokeStyle = '#6B4423'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + fx * (r + 10), sy + fy * (r + 10)); ctx.stroke();
        ctx.strokeStyle = '#9AA3B0'; ctx.beginPath(); ctx.moveTo(sx + fx * (r + 10), sy + fy * (r + 10)); ctx.lineTo(ex, ey); ctx.stroke();
        if (u.muzzle > 0) { ctx.beginPath(); ctx.arc(ex + fx * 4, ey + fy * 4, 7 * u.muzzle, 0, TAU); ctx.fillStyle = `rgba(255,226,122,${u.muzzle})`; ctx.fill(); }
        ctx.beginPath();
        for (let k = 0; k < 3; k++) { const a = u.face + k / 3 * TAU, hx = x + Math.cos(a) * r * 0.85, hy = y + Math.sin(a) * r * 0.85; k ? ctx.lineTo(hx, hy) : ctx.moveTo(hx, hy); }
        ctx.closePath(); ctx.fillStyle = '#2A2018'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#D4A63A'; ctx.stroke();
      } else if (u.type === 'zombie') {
        // arms stretched out in front, a pale green head with dark eyes
        const sway = Math.sin(this.t * 4 + u.gait) * 0.12;
        for (const sd of [-1, 1]) {
          const a = u.face + sd * (0.12 + sway * sd), bx = x + px * sd * r * 0.62, by = y + py * sd * r * 0.62, ex = bx + Math.cos(a) * (r + 6), ey = by + Math.sin(a) * (r + 6);
          ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
          ctx.lineWidth = 4; ctx.strokeStyle = '#9CC07A'; ctx.stroke();
        }
        const hx = x + fx * r * 0.12, hy = y + fy * r * 0.12;
        ctx.beginPath(); ctx.arc(hx, hy, r * 0.56, 0, TAU); ctx.fillStyle = '#A8C98A'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = '#1A1A22'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + fx * r * 0.22 + px * sd * r * 0.22, hy + fy * r * 0.22 + py * sd * r * 0.22, r * 0.12, 0, TAU); ctx.fill(); }
      } else if (u.type === 'ninja') {
        // black suit with a team-colour ring, a headband with tails flying behind, and a short blade that slashes
        ctx.beginPath(); ctx.arc(x, y, r - 2, 0, TAU); ctx.lineWidth = 3.5; ctx.strokeStyle = tm.c; ctx.stroke();
        const wv = Math.sin(this.t * 14 + u.gait) * 2.5;
        ctx.lineWidth = 2.5; ctx.strokeStyle = tm.c;
        // two short headband tails fluttering together behind the head
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x - fx * r * 0.7, y - fy * r * 0.7); ctx.quadraticCurveTo(x - fx * (r + 3), y - fy * (r + 3), x - fx * (r + 8) + px * (sd * 2.5 + wv), y - fy * (r + 8) + py * (sd * 2.5 + wv)); ctx.stroke(); }
        ctx.lineWidth = 2.5; ctx.strokeStyle = '#F4F6FB'; ctx.beginPath(); ctx.moveTo(x + fx * r * 0.35 + px * r * 0.35, y + fy * r * 0.35 + py * r * 0.35); ctx.lineTo(x + fx * r * 0.35 - px * r * 0.35, y + fy * r * 0.35 - py * r * 0.35); ctx.stroke();
        const sl = u.lunge || 0, ang = u.face - 0.9 + sl * 1.4, kfx = Math.cos(ang), kfy = Math.sin(ang);
        const bx = x + kfx * (r - 1), by = y + kfy * (r - 1), ex = x + kfx * (r + 16), ey = y + kfy * (r + 16);
        ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.lineWidth = 3; ctx.strokeStyle = COL.steel; ctx.stroke();
      } else if (u.type === 'samurai') {
        // shoulder plates and a dark helmet with a gold crest (the katana is drawn with the other swords)
        for (const sd of [-1, 1]) {
          const cx = x + px * sd * r * 0.62 - fx * 2, cy = y + py * sd * r * 0.62 - fy * 2;
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(u.face); roundRect(ctx, -r * 0.26, -r * 0.4, r * 0.52, r * 0.8, 3); ctx.fillStyle = tm.d; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
        }
        ctx.beginPath(); ctx.arc(x - fx * 1.5, y - fy * 1.5, r * 0.55, 0, TAU); ctx.fillStyle = '#22252B'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
        ctx.beginPath(); ctx.arc(x + fx * r * 0.05, y + fy * r * 0.05, r * 0.5, u.face - 0.9, u.face + 0.9); ctx.lineWidth = 3.5; ctx.strokeStyle = COL.gold; ctx.stroke();
      } else if (u.type === 'vampire') {
        // a black cape flaring out behind (team-colour lining), a pale head with slicked-back hair and red eyes that flare on each bite
        const flap = Math.sin(this.t * 9 + u.gait) * 0.12, bx = x - fx * r * 0.2, by = y - fy * r * 0.2;
        ctx.beginPath();
        ctx.moveTo(bx + px * r * 0.95, by + py * r * 0.95);
        ctx.quadraticCurveTo(bx - fx * r * 1.1 + px * r * (1.25 + flap), by - fy * r * 1.1 + py * r * (1.25 + flap), bx - fx * r * 1.55, by - fy * r * 1.55);
        ctx.quadraticCurveTo(bx - fx * r * 1.1 - px * r * (1.25 - flap), by - fy * r * 1.1 - py * r * (1.25 - flap), bx - px * r * 0.95, by - py * r * 0.95);
        ctx.closePath(); ctx.fillStyle = '#15121A'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
        // high collar in the team colour
        ctx.beginPath(); ctx.arc(x, y, r * 0.86, u.face + 1.25, u.face + TAU - 1.25); ctx.lineWidth = 4; ctx.strokeStyle = tm.c; ctx.stroke();
        const hx = x + fx * r * 0.1, hy = y + fy * r * 0.1;
        ctx.beginPath(); ctx.arc(hx, hy, r * 0.56, 0, TAU); ctx.fillStyle = '#E9E4EE'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
        ctx.beginPath(); ctx.arc(hx, hy, r * 0.56, u.face + 1.7, u.face + TAU - 1.7); ctx.lineTo(hx, hy); ctx.closePath(); ctx.fillStyle = '#1B1820'; ctx.fill();
        const glow = u.drainFx || 0;
        ctx.fillStyle = '#E0243A';
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + fx * r * 0.25 + px * sd * r * 0.2, hy + fy * r * 0.25 + py * sd * r * 0.2, r * (0.1 + glow * 0.06), 0, TAU); ctx.fill(); }
        if (glow > 0) { ctx.beginPath(); ctx.arc(x, y, r + 3, 0, TAU); ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(224,36,58,${glow * 0.8})`; ctx.stroke(); }
      }
    }
    // particles live in the arena, so they follow the camera (confetti falls over the whole screen and doesn't)
    drawFX(ctx) {
      if (!this.camOn()) return super.drawFX(ctx);
      const all = this.parts, fl = this.floats;
      ctx.save(); roundRect(ctx, AR.x + this.shakeX, AR.y + this.shakeY, AR.w, AR.h, 18); ctx.clip();
      ctx.translate(this.shakeX, this.shakeY); this.applyCam(ctx);
      this.parts = all.filter(p => !p.confetti); super.drawFX(ctx);
      ctx.restore();
      this.parts = all.filter(p => p.confetti); this.floats = []; super.drawFX(ctx);
      this.parts = all; this.floats = fl;
    }
    // film bars and a dark vignette during the director's slow-motion moments
    drawCine(ctx) {
      const c = this.cine;
      if (c.vig > 0.01 && api.makeCanvas) {
        if (!vignetteImg) {
          vignetteImg = api.makeCanvas(AR.w, AR.h);
          const g = vignetteImg.getContext('2d'), rg = g.createRadialGradient(AR.w / 2, AR.h / 2, AR.w * 0.28, AR.w / 2, AR.h / 2, AR.w * 0.75);
          rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.75)');
          g.fillStyle = rg; g.fillRect(0, 0, AR.w, AR.h);
        }
        ctx.globalAlpha = clamp(c.vig, 0, 1); ctx.drawImage(vignetteImg, AR.x, AR.y); ctx.globalAlpha = 1;
      }
      if (c.bars > 0.01) {
        const b = clamp(c.bars, 0, 1), h = 122 * (b * b * (3 - 2 * b));
        ctx.fillStyle = '#000'; ctx.fillRect(AR.x, AR.y, AR.w, h); ctx.fillRect(AR.x, AR.y + AR.h - h, AR.w, h);
      }
    }
    drawTally(ctx) {
      if (this.phase !== 'outro' || !this.fixed) return;
      const k = this.outroT, L = this.outroLen, cy = AR.y + AR.h / 2;
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (L >= 5.5) {
        const a = clamp((k - 2.4) / 0.4, 0, 1);
        if (a > 0) {
          ctx.globalAlpha = a;
          ctx.font = font(46, 800); spaced(ctx, 2);
          const step = this.N === 3 ? 54 : 64, top = this.N === 3 ? 258 : 285;
          if (this.N === 3) ctx.font = font(40, 800);
          for (let tm = 0; tm < this.N; tm++) {
            const left = this.alive[tm] + this.reserve[tm], lost = Math.max(0, this.start[tm] + (this.gained ? this.gained[tm] : 0) - left);
            strokeText(ctx, `${TEAMS[tm].name}: ${left} LEFT · ${lost} LOST`, VW / 2, cy + top + tm * step + (1 - a) * 20, TEAMS[tm].c, COL.ink, 10);
          }
          const mvp = this.best && this.best[this.winner];
          const m = clamp((k - 3.0) / 0.4, 0, 1);
          if (mvp && (mvp.kills || 0) >= 3 && m > 0) {
            ctx.globalAlpha = m; ctx.font = font(42, 800);
            strokeText(ctx, `MVP: ${mvp.champ || labelOf(mvp.type)} · ${mvp.kills} KILLS`, VW / 2, cy + (this.N === 3 ? 432 : 413) + (1 - m) * 20, COL.gold, COL.ink, 10);
            ctx.globalAlpha = a;
          }
          spaced(ctx, 0);
        }
      } else {
        // a short outro (the video ends a few seconds after the battle): just the MVP under the result
        const mvp = this.best && this.best[this.winner], m = clamp((k - 1.2) / 0.3, 0, 1);
        if (mvp && (mvp.kills || 0) >= 3 && m > 0) {
          ctx.globalAlpha = m; ctx.font = font(44, 800); spaced(ctx, 2);
          strokeText(ctx, `MVP: ${mvp.champ || labelOf(mvp.type)} · ${mvp.kills} KILLS`, VW / 2, cy + 290 + (1 - m) * 16, COL.gold, COL.ink, 10);
          spaced(ctx, 0); ctx.globalAlpha = 1;
        }
      }
      const c = clamp((k - Math.max(1.1, L - 2.2)) / 0.35, 0, 1);
      if (c > 0) {
        ctx.globalAlpha = Math.min(1, c * 1.5);
        ctx.translate(VW / 2, AR.y + 118);
        const sc = 0.7 + 0.3 * easeOutBack(c); ctx.scale(sc, sc);
        ctx.font = font(80, 800); spaced(ctx, 3);
        strokeText(ctx, 'WHO DID YOU PICK?', 0, 0, COL.gold, COL.ink, 12);
        spaced(ctx, 0);
      }
      ctx.restore();
      ctx.textBaseline = 'alphabetic';
    }
    cosmetic(dt) {
      for (const u of this.units) { u.flash = Math.max(0, u.flash - dt * 6); u.lunge = Math.max(0, u.lunge - dt * 6); if (u.swing) u.swing = Math.max(0, u.swing - dt * 2.6); if (u.healFx) u.healFx = Math.max(0, u.healFx - dt * 2.5); if (u.healFlash) u.healFlash = Math.max(0, u.healFlash - dt * 3); if (u.muzzle) u.muzzle = Math.max(0, u.muzzle - dt * 12); if (u.dodgeFx) u.dodgeFx = Math.max(0, u.dodgeFx - dt * 4); if (u.drainFx) u.drainFx = Math.max(0, u.drainFx - dt * 3); }
      if (this.ext) this.extCosmetic(dt);
      if (this.booms && this.booms.length) this.booms = this.booms.filter(b => (b.t += dt) < 0.45);
      if (this.drop && this.FX.chance(dt * 9)) { const F = this.FX; this.parts.push({ x: this.drop.x + F.range(-5, 5), y: this.drop.y - 10, vx: F.range(-10, 10), vy: F.range(-60, -40), life: F.range(0.9, 1.4), age: 0, size: F.range(7, 11), color: '#F2C14E', grav: 0, smoke: true }); }
      for (const a of this.arrows) if (a.kind === 'rocket' && this.FX.chance(dt * 30)) this.parts.push({ x: a.x, y: a.y, vx: 0, vy: 0, life: 0.5, age: 0, size: 5, color: '#9AA0AA', grav: 0, smoke: true });
      if (this.liveDecor) for (const d of this.decor) if (d.kind === 'fire' && this.FX.chance(dt * 7)) {
        const F = this.FX;
        this.parts.push({ x: d.x + F.range(-8, 8), y: d.y - 18, vx: F.range(-12, 12), vy: F.range(-70, -45), life: F.range(1.1, 1.7), age: 0, size: F.range(9, 15), color: '#4A4E58', grav: 0, smoke: true });
      }
      const a0 = this.alive[0] + this.reserve[0], a1 = this.alive[1] + this.reserve[1];
      if (this.N === 3) {
        const tt = this.totals(), sum = tt[0] + tt[1] + tt[2] || 1;
        this.shares = this.shares || [1 / 3, 1 / 3, 1 / 3];
        for (let k = 0; k < 3; k++) this.shares[k] += (tt[k] / sum - this.shares[k]) * Math.min(1, dt * 8);
        if (this.facts && this.phase === 'fight' && this.fightT > 5) for (let k = 0; k < 3; k++) this.facts.low[k] = Math.min(this.facts.low[k], tt[k] / sum);
      }
      this.dispRatio += ((a0 + a1 ? a0 / (a0 + a1) : 0.5) - this.dispRatio) * Math.min(1, dt * 8);
      if (this.N === 2 && this.facts && this.phase === 'fight' && this.fightT > 5 && a0 + a1) { const s0 = a0 / (a0 + a1); this.facts.low[0] = Math.min(this.facts.low[0], s0); this.facts.low[1] = Math.min(this.facts.low[1], 1 - s0); }
      if (this.stains) {
        this.stainFade += dt;
        if (this.stainFade >= 0.5) {
          this.stainFade = 0;
          const g = this.stains.getContext('2d');
          g.globalCompositeOperation = 'destination-out';
          g.fillStyle = 'rgba(0,0,0,0.07)';
          g.fillRect(0, 0, AR.w, AR.h);
          g.globalCompositeOperation = 'source-over';
        }
      }
      if (this.stains && this.splats.length) {
        const g = this.stains.getContext('2d');
        for (const u of this.splats) {
          g.fillStyle = TEAMS[u.team].d;
          g.globalAlpha = 0.34;
          g.beginPath(); g.arc(u.x - AR.x, u.y - AR.y, u.r * 1.1, 0, TAU); g.fill();
          g.globalAlpha = 0.24;
          for (let k = 0; k < 3; k++) { const a = this.FX.range(0, TAU), d = u.r * this.FX.range(1, 2); g.beginPath(); g.arc(u.x - AR.x + Math.cos(a) * d, u.y - AR.y + Math.sin(a) * d, u.r * 0.35, 0, TAU); g.fill(); }
        }
        g.globalAlpha = 1;
        this.splats = [];
      }
    }
    // scoreboard for a three-way battle: three columns and a three-colour bar
    drawHUD3(ctx) {
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
      ctx.fillStyle = COL.white; ctx.font = font(88, 800); spaced(ctx, 2); ctx.fillText(this.title, VW / 2, 148);
      ctx.fillStyle = COL.gold; ctx.font = font(38, 700, false); spaced(ctx, 6); ctx.fillText(this.hook, VW / 2, 204);
      const tot = this.totals(), xs = [190, 540, 890];
      for (let tm = 0; tm < 3; tm++) {
        const x = xs[tm], flag = hasFlag(TEAMS[tm]);
        spaced(ctx, 3); ctx.font = font(TEAMS[tm].name.length > 9 ? 32 : 40, 800); ctx.fillStyle = TEAMS[tm].c; ctx.fillText(TEAMS[tm].name, x, 262);
        if (flag) drawFlag(ctx, TEAMS[tm].key, x - 36, 276, 72, 48, 3);
        spaced(ctx, 0); ctx.font = font(flag ? 92 : 112, 800); ctx.fillStyle = COL.white; ctx.fillText(String(tot[tm]), x, flag ? 404 : 382);
        ctx.font = font(26, 700, false); spaced(ctx, 1); ctx.fillStyle = COL.muted;
        const nm = docLabel(this.doc[tm]); ctx.fillText(nm.length > 12 ? nm.slice(0, 12) : nm, x, 432);
      }
      spaced(ctx, 0); ctx.font = font(34, 800); ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText('VS', 365, 350); ctx.fillText('VS', 715, 350);
      const bx = 60, by = 448, bw = 960, bh = 22, sh = this.shares || [1 / 3, 1 / 3, 1 / 3];
      ctx.save(); roundRect(ctx, bx, by, bw, bh, bh / 2); ctx.clip();
      let x0 = bx;
      for (let tm = 0; tm < 3; tm++) { const w = bw * clamp(sh[tm], 0, 1); ctx.fillStyle = TEAMS[tm].c; ctx.fillRect(x0, by, w + 1, bh); x0 += w; }
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(bx, by, bw, 5);
      ctx.restore();
    }
    // the camera a director has set (cam = { x, y, z } in arena coordinates); z = 1 is the whole arena
    camOn() { return !!(this.cam && this.cam.z > 1.001); }
    applyCam(ctx) { const c = this.cam; ctx.translate(AR.x + AR.w / 2, AR.y + AR.h / 2); ctx.scale(c.z, c.z); ctx.translate(-c.x, -c.y); }
    // sharper copies of the ground and map for close-ups
    hiLayer(name) {
      const key = name + 'Hi';
      if (!this[key]) { this[key] = api.makeCanvas(AR.w * 2, AR.h * 2); if (name === 'ground') this.paintGround(this[key], 2); else this.paintMap(this[key], 2); }
      return this[key];
    }
    draw(ctx) {
      this.drawBG(ctx);
      const U2 = this.ui2 = this.opts.ui >= 2;
      if (U2) { if (this.N === 3) this.drawHUD3v2(ctx); else this.drawHUD2(ctx); }
      else if (this.N === 3) this.drawHUD3(ctx); else this.drawHUD(ctx, {
        title: this.title, hook: this.hook,
        lv: String(this.alive[0] + this.reserve[0]), rv: String(this.alive[1] + this.reserve[1]),
        ls: `${this.skins ? this.skinName(0) : ''}${docLabel(this.doc[0])} · ${this.start[0]} UNITS`, rs: `${this.start[1]} UNITS · ${this.skins ? this.skinName(1) : ''}${docLabel(this.doc[1])}`,
        ratio: this.dispRatio,
      });
      const zoom = this.camOn(), hi = zoom && this.cam.z > 1.12 && !!api.makeCanvas;
      // director mode: draw in between simulation ticks, so slow motion stays smooth
      const al = this.fixedTicks && this.phase === 'fight' ? clamp(this.tickAcc, 0, 1) : 1, between = al < 0.999;
      if (between) {
        for (const u of this.units) if (u.px !== undefined) { u._x = u.x; u._y = u.y; u.x = u.px + (u.x - u.px) * al; u.y = u.py + (u.y - u.py) * al; }
        for (const a of this.arrows) if (a.px !== undefined) { a._x = a.x; a._y = a.y; a.x = a.px + (a.x - a.px) * al; a.y = a.py + (a.y - a.py) * al; }
      }
      // UI 2.0: the whole battlefield (and everything drawn on it) is drawn 90 px higher
      if (U2) { ctx.save(); ctx.translate(0, UI_DY); this.layDY = UI_DY; this.layReset(); }
      ctx.save();
      ctx.translate(this.shakeX, this.shakeY);
      roundRect(ctx, AR.x, AR.y, AR.w, AR.h, 18);
      ctx.save(); ctx.clip();
      if (this.wq) this.worldPre(ctx);
      // ground, stains and map: when zoomed, copy just the part in view straight to the screen (much faster than drawing the whole layer through the camera)
      const blit = (img, S) => {
        if (!zoom) { ctx.drawImage(img, AR.x, AR.y, AR.w, AR.h); return; }
        const c = this.cam, vw = AR.w / c.z, vh = AR.h / c.z, sx = (c.x - vw / 2 - AR.x) * S, sy = (c.y - vh / 2 - AR.y) * S;
        ctx.drawImage(img, sx, sy, vw * S, vh * S, AR.x, AR.y, AR.w, AR.h);
      };
      if (zoom && 'patternQuality' in ctx) ctx.patternQuality = 'bilinear';
      if (this.ground) blit(hi ? this.hiLayer('ground') : this.ground, hi ? 2 : 1);
      else { ctx.fillStyle = (MAP_THEME[this.opts.map] || MAP_THEME.default).floor; ctx.fillRect(AR.x, AR.y, AR.w, AR.h); }
      if (this.stains) blit(this.stains, 1);
      if ((this.obstacles.length || this.decor.length) && api.makeCanvas) {
        if (!this.mapLayer) { this.mapLayer = api.makeCanvas(AR.w, AR.h); this.paintMap(this.mapLayer, 1); }
        blit(hi ? this.hiLayer('map') : this.mapLayer, hi ? 2 : 1);
      }
      if (zoom && 'patternQuality' in ctx) ctx.patternQuality = 'good';
      if (zoom) { ctx.save(); this.applyCam(ctx); }
      if (this.liveDecor) this.drawLiveDecor(ctx);
      // arrows
      ctx.lineCap = 'round';
      const tracers = [], snipes = [], lasers = {};
      for (const a of this.arrows) {
        const l = Math.hypot(a.vx, a.vy) || 1, ux = a.vx / l, uy = a.vy / l;
        if (XSHOT[a.kind]) { this.drawShot(ctx, a, ux, uy); continue; }
        if (a.kind === 'fireball') {
          // a glowing purple-orange ball on a low arc
          const p = a.t / a.T, hgt = Math.sin(Math.PI * p) * 22;
          ctx.beginPath(); ctx.arc(a.x, a.y - hgt, 11, 0, TAU); ctx.fillStyle = 'rgba(192,132,252,0.35)'; ctx.fill();
          ctx.beginPath(); ctx.arc(a.x, a.y - hgt, 6, 0, TAU); ctx.fillStyle = '#FFB347'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#7C3AED'; ctx.stroke();
          continue;
        }
        if (a.kind === 'grenade') {
          // arcs up and down on the way: shadow on the ground, grenade above it
          const p = a.t / a.T, hgt = Math.sin(Math.PI * p) * 38;
          ctx.beginPath(); ctx.ellipse(a.x, a.y, 5, 3, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
          ctx.beginPath(); ctx.arc(a.x, a.y - hgt, 5, 0, TAU); ctx.fillStyle = '#4A6B2E'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke();
          continue;
        }
        if (a.kind === 'shell') {
          ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,159,28,0.45)';
          ctx.beginPath(); ctx.moveTo(a.x - ux * 26, a.y - uy * 26); ctx.lineTo(a.x, a.y); ctx.stroke();
          ctx.beginPath(); ctx.arc(a.x, a.y, 5, 0, TAU); ctx.fillStyle = '#2B2F36'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke();
          continue;
        }
        if (a.kind === 'laser') { (lasers[a.team] || (lasers[a.team] = [])).push(a.x, a.y, ux, uy); continue; }
        if (a.kind === 'rocket') {
          // a small rocket with a flame behind it
          ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,159,28,0.7)'; ctx.beginPath(); ctx.moveTo(a.x - ux * 22, a.y - uy * 22); ctx.lineTo(a.x - ux * 6, a.y - uy * 6); ctx.stroke();
          ctx.lineWidth = 7; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(a.x - ux * 9, a.y - uy * 9); ctx.lineTo(a.x + ux * 6, a.y + uy * 6); ctx.stroke();
          ctx.lineWidth = 4; ctx.strokeStyle = '#D9DEE6'; ctx.stroke();
          continue;
        }
        if (a.kind === 'cannonball') {
          const p = a.t / a.T, hgt = Math.sin(Math.PI * p) * 60;
          ctx.beginPath(); ctx.ellipse(a.x, a.y, 7, 4.5, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
          ctx.beginPath(); ctx.arc(a.x, a.y - hgt, 8, 0, TAU); ctx.fillStyle = '#1C1E22'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#5B6472'; ctx.stroke();
          continue;
        }
        if (a.kind === 'bullet' || a.kind === 'sniper') {
          // collected here and drawn together below (one stroke per kind keeps busy firefights fast and tidy)
          if (a.tracer !== false) (a.kind === 'sniper' ? snipes : tracers).push(a.x, a.y, ux, uy);
          continue;
        }
        if (a.bolt) {
          // crossbow bolt: thicker, longer, with a gold streak
          ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(255,210,63,0.35)';
          ctx.beginPath(); ctx.moveTo(a.x - ux * 44, a.y - uy * 44); ctx.lineTo(a.x, a.y); ctx.stroke();
          ctx.lineWidth = 4.5; ctx.strokeStyle = COL.steel;
          ctx.beginPath(); ctx.moveTo(a.x - ux * 24, a.y - uy * 24); ctx.lineTo(a.x + ux * 6, a.y + uy * 6); ctx.stroke();
          continue;
        }
        ctx.lineWidth = 3; ctx.strokeStyle = COL.steel;
        ctx.beginPath(); ctx.moveTo(a.x - ux * 18, a.y - uy * 18); ctx.lineTo(a.x + ux * 4, a.y + uy * 4); ctx.stroke();
      }
      if (tracers.length) {
        ctx.beginPath();
        for (let i = 0; i < tracers.length; i += 4) { ctx.moveTo(tracers[i] - tracers[i + 2] * 16, tracers[i + 1] - tracers[i + 3] * 16); ctx.lineTo(tracers[i], tracers[i + 1]); }
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,226,122,0.85)'; ctx.stroke();
      }
      for (const tm in lasers) {
        // laser bolts glow in their team's colour around a white core
        const L = lasers[tm]; if (!L.length) continue;
        ctx.beginPath();
        for (let i = 0; i < L.length; i += 4) { ctx.moveTo(L[i] - L[i + 2] * 24, L[i + 1] - L[i + 3] * 24); ctx.lineTo(L[i], L[i + 1]); }
        ctx.lineWidth = 7; ctx.strokeStyle = rgba(TEAMS[tm].c, 0.55); ctx.stroke();
        ctx.lineWidth = 2.5; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
      }
      if (snipes.length) {
        ctx.beginPath();
        for (let i = 0; i < snipes.length; i += 4) { ctx.moveTo(snipes[i] - snipes[i + 2] * 60, snipes[i + 1] - snipes[i + 3] * 60); ctx.lineTo(snipes[i], snipes[i + 1]); }
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,240,180,0.22)'; ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i < snipes.length; i += 4) { ctx.moveTo(snipes[i] - snipes[i + 2] * 40, snipes[i + 1] - snipes[i + 3] * 40); ctx.lineTo(snipes[i], snipes[i + 1]); }
        ctx.lineWidth = 3; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
      }
      // explosions: a quick orange fireball with a bright ring
      for (const b of this.booms || []) {
        const p = b.t / 0.45, rr = b.r * (0.45 + 0.8 * p);
        ctx.beginPath(); ctx.arc(b.x, b.y, rr, 0, TAU); ctx.fillStyle = b.magic ? `rgba(168,85,247,${(1 - p) * 0.5})` : b.zap ? `rgba(160,220,255,${(1 - p) * 0.55})` : `rgba(255,150,40,${(1 - p) * 0.5})`; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = `rgba(255,230,150,${1 - p})`; ctx.stroke();
        if (p < 0.25) { ctx.beginPath(); ctx.arc(b.x, b.y, rr * 0.5, 0, TAU); ctx.fillStyle = `rgba(255,255,230,${(0.25 - p) * 3})`; ctx.fill(); }
      }
      if (this.ext) this.drawField(ctx);
      // units by type for fewer state changes
      const cheer = this.phase === 'outro' ? this.winner : -1;
      const drawOrder = this.units.some(u => u.flying) ? this.units.filter(u => !u.flying).concat(this.units.filter(u => u.flying)) : this.units;
      // when zoomed in, skip troops that are out of view
      const cv = zoom ? { x0: this.cam.x - AR.w / 2 / this.cam.z - 60, x1: this.cam.x + AR.w / 2 / this.cam.z + 60, y0: this.cam.y - AR.h / 2 / this.cam.z - 60, y1: this.cam.y + AR.h / 2 / this.cam.z + 60 } : null;
      if (this.hill) this.drawHill(ctx);
      if (this.tribes) this.drawCamps(ctx);
      if (this.skins) this.drawSkins(ctx, drawOrder, false);
      // art finish (rules.ui.art 2): a soft contact shadow under every troop on the ground, all in one pass so no shadow covers a neighbour
      const ART = this.opts.art >= 2;
      if (ART) this.drawGround2(ctx);
      if (ART) {
        ctx.beginPath();
        for (const u of drawOrder) {
          if (u.dead || u.flying || UNIT[u.type].flying || u.fade === 0 || (cv && (u.x < cv.x0 - u.r || u.x > cv.x1 + u.r || u.y < cv.y0 - u.r || u.y > cv.y1 + u.r))) continue;
          const rr = u.r * (UNIT[u.type].mount ? 1.25 : 1);
          ctx.moveTo(u.x + rr * 0.22 + rr * 1.02, u.y + rr * 0.3); ctx.ellipse(u.x + rr * 0.22, u.y + rr * 0.3, rr * 1.02, rr * 0.8, 0, 0, TAU);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill();
      }
      for (const u of drawOrder) {
        if (u.dead || (cv && (u.x < cv.x0 - u.r || u.x > cv.x1 + u.r || u.y < cv.y0 - u.r || u.y > cv.y1 + u.r))) continue;
        if (this.wNow && this.worldHide(u)) continue;
        const tm = TEAMS[u.team];
        if (u.fade !== undefined) { if (u.fade <= 0) continue; ctx.globalAlpha = u.fade; }
        if (u.phased) ctx.globalAlpha *= 0.35;
        if (u.hidden) ctx.globalAlpha *= 0.6;
        if (u.cloak) ctx.globalAlpha *= 0.22;
        if (u.hollow || u.ghost) ctx.globalAlpha *= 0.72;
        let lx = Math.cos(u.face) * u.lunge * 6, ly = Math.sin(u.face) * u.lunge * 6;
        const swordy = UNIT[u.type].sword;
        if (swordy && !(u.swing > 0) && Math.hypot(u.vx, u.vy) > 18) {
          const sway = Math.sin(this.fightT * 11 + u.gait) * 2.2;
          lx = -Math.sin(u.face) * sway; ly = Math.cos(u.face) * sway;
        } else if (swordy) {
          const p = 1 - (u.swing || 0), on = u.swing > 0;
          const fwd = on ? Math.sin(Math.PI * p) * 7 : 0;
          const side = on ? (p - 0.5) * 5 * -(u.swingFrom || -1) : 0;
          lx = Math.cos(u.face) * fwd - Math.sin(u.face) * side;
          ly = Math.sin(u.face) * fwd + Math.cos(u.face) * side;
        }
        const hop = u.team === cheer ? -Math.abs(Math.sin(this.outroT * 9 + u.x * 0.05)) * 6 : 0;
        // a ninja that dodged a shot: a quick side-step, with a fading ghost where it was
        if (u.dodgeFx > 0) {
          const dk = Math.sin(Math.PI * u.dodgeFx) * 9 * (u.dodgeSide || 1);
          ctx.beginPath(); ctx.arc(u.x + lx, u.y + ly, u.r, 0, TAU); ctx.fillStyle = `rgba(255,255,255,${u.dodgeFx * 0.35})`; ctx.fill();
          lx += -Math.sin(u.face) * dk; ly += Math.cos(u.face) * dk;
        }
        const x = u.x + lx, y = u.y + ly + hop - (u.lift || 0) - (ART && u.qT ? this.quakeHop(u) : 0);
        if (u.lift) ell(ctx, u.x + 6, u.y + 8, u.r, u.r * 0.6, 0, 'rgba(0,0,0,0.25)', 0);
        this.drawBody(ctx, u, x, y, tm, swordy);
        if (ART && !(u.sheepT > this.fightT)) { this.drawWear(ctx, u, x, y); this.artFinish(ctx, u, x, y); }
        if (u.flag) {
          // a flag on a pole, rippling a little
          const px = x + u.r * 0.6, top = y - u.r - 26;
          ctx.lineCap = 'round'; ctx.lineWidth = 4.5; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, top); ctx.stroke();
          ctx.lineWidth = 2; ctx.strokeStyle = '#D9B26F'; ctx.stroke();
          ctx.save(); ctx.translate(px, top); ctx.transform(1, Math.sin(this.t * 6 + u.gait) * 0.12, 0, 1, 0, 0);
          drawFlag(ctx, tm.key, 0, 0, 27, 18, 2); ctx.restore();
        }
        if (u.healFlash > 0) { ctx.beginPath(); ctx.arc(x, y, u.r + 2, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(124,255,176,${u.healFlash * 0.9})`; ctx.stroke(); }
        if (u.flash > 0) { ctx.beginPath(); ctx.arc(x, y, u.r, 0, TAU); ctx.fillStyle = `rgba(255,255,255,${u.flash * 0.8})`; ctx.fill(); }
        if (HPBAR[u.type] && u.hp < u.max) {
          const w = u.r * 2;
          ctx.fillStyle = COL.ink; ctx.fillRect(x - w / 2 - 2, y - u.r - 13, w + 4, 8);
          ctx.fillStyle = tm.l; ctx.fillRect(x - w / 2, y - u.r - 11, w * clamp(u.hp / u.max, 0, 1), 4);
        }
        if (this.ext) this.drawStatus(ctx, u, x, y, tm);
        ctx.globalAlpha = 1;
      }
      if (ART) this.flushArt(ctx);
      if (this.cast3on) this.drawCast3Fx(ctx);
      if (this.slashes) this.drawSlashes(ctx);
      if (this.skins || this.heroTeam >= 0) this.drawSkins(ctx, drawOrder, true);
      if (this.cmb) this.drawCombatFx(ctx);
      if (this.tribes) this.drawTribeFx(ctx, drawOrder);
      if (this.evo) this.drawEvolved(ctx, drawOrder);
      if (this.events) this.drawEvents(ctx);
      if (this.ext) this.drawOver(ctx);
      this.drawMvp(ctx);
      if (this.tag && this.tag.u && !this.tag.u.dead && this.tag.a > 0.01) {
        // the director's hero tag: a team-coloured marker and a kill count above one troop
        const u = this.tag.u, tx = u.x, ty = u.y - u.r - 20 - 4 * Math.sin(this.t * 6);
        ctx.globalAlpha = this.tag.a;
        ctx.beginPath(); ctx.moveTo(tx - 9, ty - 8); ctx.lineTo(tx + 9, ty - 8); ctx.lineTo(tx, ty + 4); ctx.closePath();
        ctx.fillStyle = TEAMS[u.team].c; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = COL.ink; ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font(26, 800);
        strokeText(ctx, this.tag.text, tx, ty - 26, COL.gold, COL.ink, 6);
        // with intelligent combat on, the followed fighter's type and speciality too
        if (this.cmb) { ctx.font = font(20, 800); strokeText(ctx, `${labelOf(u.type).replace(/^THE /, '')} · ${specOf(u.type)}`, tx, ty - 54, '#FFFFFF', COL.ink, 5); }
        ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
      }
      if (this.wq) this.worldMid(ctx);
      if (zoom) ctx.restore();
      if (this.wq) this.worldPost(ctx);
      if (this.d3T > this.fightT && this.phase === 'fight') this.draw3D(ctx);
      if (this.cine) this.drawCine(ctx);
      ctx.restore();
      ctx.restore();
      if (between) {
        for (const u of this.units) if (u._x !== undefined) { u.x = u._x; u.y = u._y; u._x = undefined; }
        for (const a of this.arrows) if (a._x !== undefined) { a.x = a._x; a.y = a._y; a._x = undefined; }
      }
      this.drawArenaFrame(ctx);
      this.drawFX(ctx);
      this.drawBanners(ctx);
      if (U2) {
        if (this.tribes) this.drawStory2(ctx);
        this.drawRosterStrips(ctx);
        this.drawChapters(ctx);
        if (this.evo) this.drawEvolveCards(ctx);
        this.drawIntro(ctx, 'CHARGE!');
        this.drawOutro(ctx);
        this.drawTally(ctx);
        if (this.finalePlan) this.drawFinale(ctx);
        ctx.restore(); this.layDY = 0;
        if (this.tribes) this.drawCouncil2(ctx);
        return;
      }
      if (this.cmb) this.drawRosterCards(ctx);
      this.drawFooter(ctx, 'BATTLE TIME', fmtTime(this.fightT), false);
      if (this.tribes) this.drawCouncil(ctx);
      if (this.evo) this.drawEvolveCards(ctx);
      this.drawIntro(ctx, 'CHARGE!');
      this.drawOutro(ctx);
      this.drawTally(ctx);
      if (this.finalePlan) this.drawFinale(ctx);
    }
    // one troop's body and weapon (also used for the portraits on the roster cards)
    drawBody(ctx, u, x, y, tm, swordy) {
        if (u.sheepT > this.fightT) {
          this.drawSheep(ctx, u, x, y, tm);
        } else if (ROSTER[u.type]) {
          this.drawRoster(ctx, u, x, y, tm);
        } else if (u.type === 'dragon') {
          // seen from above: a shadow on the ground, flapping wings, a long body, tail and horned head
          const flap = 0.75 + 0.25 * Math.sin(this.t * 7 + u.gait), r = u.r;
          ctx.beginPath(); ctx.ellipse(x + 10, y + 26, r * 1.1, r * 0.7, u.face, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
          ctx.save(); ctx.translate(x, y); ctx.rotate(u.face);
          ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = COL.ink;
          for (const sd of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(r * 0.35, sd * r * 0.3); ctx.lineTo(-r * 0.2, sd * r * 1.75 * flap); ctx.lineTo(-r * 0.75, sd * r * 1.25 * flap); ctx.lineTo(-r * 0.55, sd * r * 0.3); ctx.closePath();
            ctx.fillStyle = tm.d; ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(r * 0.1, sd * r * 0.35); ctx.lineTo(-r * 0.45, sd * r * 1.3 * flap); ctx.lineWidth = 1.5; ctx.strokeStyle = tm.l; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = COL.ink;
          }
          ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.18); ctx.quadraticCurveTo(-r * 1.4, 0, -r * 1.75, Math.sin(this.t * 4 + u.gait) * r * 0.25); ctx.quadraticCurveTo(-r * 1.4, 0, -r * 0.7, r * 0.18); ctx.closePath();
          ctx.fillStyle = tm.c; ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.ellipse(0, 0, r * 0.85, r * 0.5, 0, 0, TAU); ctx.fillStyle = tm.c; ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.arc(r * 0.95, 0, r * 0.36, 0, TAU); ctx.fillStyle = tm.c; ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#E9E2D0';
          for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.8, sd * r * 0.22); ctx.lineTo(r * 0.55, sd * r * 0.5); ctx.lineTo(r * 0.92, sd * r * 0.3); ctx.closePath(); ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke(); }
          ctx.fillStyle = '#FFD23F'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(r * 1.08, sd * r * 0.14, r * 0.07, 0, TAU); ctx.fill(); }
          ctx.restore();
        } else if (u.type === 'tank') {
          // hull with tracks, turned the way the tank faces; turret and barrel on top, recoiling when it fires
          ctx.save(); ctx.translate(x, y); ctx.rotate(u.face);
          ctx.lineWidth = 3; ctx.strokeStyle = COL.ink; ctx.fillStyle = '#2A2F38';
          roundRect(ctx, -u.r * 1.05, -u.r * 0.98, u.r * 2.1, u.r * 0.42, 6); ctx.fill(); ctx.stroke();
          roundRect(ctx, -u.r * 1.05, u.r * 0.56, u.r * 2.1, u.r * 0.42, 6); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2;
          for (let k = -4; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(k * u.r * 0.22, -u.r * 0.95); ctx.lineTo(k * u.r * 0.22, -u.r * 0.6); ctx.moveTo(k * u.r * 0.22, u.r * 0.6); ctx.lineTo(k * u.r * 0.22, u.r * 0.95); ctx.stroke(); }
          roundRect(ctx, -u.r * 0.95, -u.r * 0.62, u.r * 1.9, u.r * 1.24, 8);
          ctx.fillStyle = tm.d; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = COL.ink; ctx.stroke();
          const rec = (u.muzzle || 0) * 7;
          ctx.lineCap = 'round';
          ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(u.r * 1.35 - rec, 0); ctx.stroke();
          ctx.lineWidth = 6; ctx.strokeStyle = '#5B6472'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(u.r * 1.35 - rec, 0); ctx.stroke();
          if (u.muzzle > 0) { ctx.beginPath(); ctx.arc(u.r * 1.45 - rec, 0, 9 * u.muzzle, 0, TAU); ctx.fillStyle = `rgba(255,220,120,${u.muzzle})`; ctx.fill(); }
          ctx.beginPath(); ctx.arc(-rec * 0.3, 0, u.r * 0.5, 0, TAU); ctx.fillStyle = tm.c; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = COL.ink; ctx.stroke();
          ctx.beginPath(); ctx.arc(-u.r * 0.15 - rec * 0.3, 0, u.r * 0.18, 0, TAU); ctx.fillStyle = tm.l; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
          ctx.restore();
        } else if (u.type === 'mech') {
          // walking mech from above: two stomping feet, a armoured body with a cockpit, rocket pods on each side
          const r = u.r, moving = Math.hypot(u.vx, u.vy) > 8, ph = this.fightT * 5 + u.gait, stride = moving ? Math.sin(ph) * r * 0.42 : 0;
          ctx.save(); ctx.translate(x, y); ctx.rotate(u.face);
          ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = COL.ink;
          for (const sd of [-1, 1]) { roundRect(ctx, -r * 0.35 + stride * sd, sd * r * 0.62 - r * 0.2, r * 0.75, r * 0.4, 6); ctx.fillStyle = '#3A404C'; ctx.fill(); ctx.stroke(); }
          const rec = (u.muzzle || 0) * 5;
          for (const sd of [-1, 1]) {
            roundRect(ctx, -r * 0.45 - rec, sd * r * 0.72 - r * 0.28, r * 0.95, r * 0.56, 6); ctx.fillStyle = tm.c; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
            ctx.fillStyle = COL.ink; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(r * 0.38 - rec, sd * r * 0.72 + (k - 1) * r * 0.16, r * 0.06, 0, TAU); ctx.fill(); }
          }
          roundRect(ctx, -r * 0.7, -r * 0.55, r * 1.35, r * 1.1, 10); ctx.fillStyle = tm.d; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = COL.ink; ctx.stroke();
          roundRect(ctx, r * 0.05, -r * 0.32, r * 0.5, r * 0.64, 8); ctx.fillStyle = '#8FE3FF'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
          ctx.beginPath(); ctx.arc(r * 0.18, -r * 0.15, r * 0.08, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
          ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.2); ctx.lineTo(-r * 0.85, -r * 0.35); ctx.lineWidth = 2.5; ctx.strokeStyle = COL.ink; ctx.stroke();
          ctx.beginPath(); ctx.arc(-r * 0.85, -r * 0.35, 3.5, 0, TAU); ctx.fillStyle = tm.l; ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
          ctx.restore();
        } else if (u.type === 'cannon') {
          // pirate cannon from above: wooden carriage in the team colour, two wheels, a black barrel that kicks back when it fires
          const r = u.r, rec = (u.muzzle || 0) * 8;
          ctx.save(); ctx.translate(x - Math.cos(u.face) * rec * 0.4, y - Math.sin(u.face) * rec * 0.4); ctx.rotate(u.face);
          ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = COL.ink;
          for (const sd of [-1, 1]) { roundRect(ctx, -r * 0.45, sd * r * 0.62 - r * 0.14, r * 0.8, r * 0.28, 4); ctx.fillStyle = '#4A3420'; ctx.fill(); ctx.stroke(); }
          roundRect(ctx, -r * 0.85, -r * 0.5, r * 1.3, r * 1.0, 6); ctx.fillStyle = tm.d; ctx.fill(); ctx.lineWidth = 3.5; ctx.stroke();
          ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(4,6,11,0.45)'; ctx.beginPath(); ctx.moveTo(-r * 0.85, -r * 0.17); ctx.lineTo(r * 0.45, -r * 0.17); ctx.moveTo(-r * 0.85, r * 0.17); ctx.lineTo(r * 0.45, r * 0.17); ctx.stroke();
          ctx.lineCap = 'round'; ctx.lineWidth = r * 0.62; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(-r * 0.6 - rec * 0.6, 0); ctx.lineTo(r * 1.25 - rec * 0.6, 0); ctx.stroke();
          ctx.lineWidth = r * 0.46; ctx.strokeStyle = '#2B2F36'; ctx.stroke();
          ctx.beginPath(); ctx.arc(r * 1.25 - rec * 0.6, 0, r * 0.3, 0, TAU); ctx.fillStyle = '#2B2F36'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = COL.ink; ctx.stroke();
          ctx.beginPath(); ctx.arc(r * 1.25 - rec * 0.6, 0, r * 0.15, 0, TAU); ctx.fillStyle = '#0B0C0F'; ctx.fill();
          ctx.beginPath(); ctx.arc(-r * 0.62 - rec * 0.6, 0, r * 0.2, 0, TAU); ctx.fillStyle = '#2B2F36'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
          if (u.muzzle > 0) { ctx.beginPath(); ctx.arc(r * 1.6, 0, 14 * u.muzzle, 0, TAU); ctx.fillStyle = `rgba(255,220,120,${u.muzzle})`; ctx.fill(); }
          ctx.restore();
        } else if (u.type === 'robot') {
          // robot from above: a round armoured chassis in the team colour, a steel chest plate with rivets, a domed head
          // with one glowing eye looking ahead, shoulder lights, and two piston fists that punch in turn
          const r = u.r, fx = Math.cos(u.face), fy = Math.sin(u.face), px = -fy, py = fx;
          const punch = (u.lunge || 0) * 10, side = (u.punchSide = u.lunge > 0.95 ? -(u.punchSide || 1) : (u.punchSide || 1));
          ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          for (const sd of [-1, 1]) {
            const ext = sd === side ? punch : 0, bx = x + px * sd * r * 0.62, by = y + py * sd * r * 0.62;
            const ex = bx + fx * (r * 0.55 + ext), ey = by + fy * (r * 0.55 + ext);
            ctx.lineWidth = 7; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
            ctx.lineWidth = 4; ctx.strokeStyle = '#8E97A6'; ctx.stroke();
            ctx.beginPath(); ctx.arc(ex, ey, r * 0.3, 0, TAU); ctx.fillStyle = '#C9D1DC'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = COL.ink; ctx.stroke();
          }
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = tm.c; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = COL.ink; ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y, r * 0.74, 0, TAU); ctx.fillStyle = '#C9D1DC'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = '#6B7280';
          for (let k = 0; k < 6; k++) { const a = u.face + Math.PI / 6 + k * Math.PI / 3; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, 1.4, 0, TAU); ctx.fill(); }
          const hx = x + fx * r * 0.08, hy = y + fy * r * 0.08;
          ctx.beginPath(); ctx.arc(hx, hy, r * 0.44, 0, TAU); ctx.fillStyle = '#2A2F3A'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke();
          const blink = 0.75 + 0.25 * Math.sin(this.t * 5 + u.gait);
          ctx.beginPath(); ctx.arc(hx, hy, r * 0.32, u.face - 0.75, u.face + 0.75); ctx.lineWidth = 4; ctx.strokeStyle = `rgba(124,243,255,${blink})`; ctx.stroke();
          ctx.beginPath(); ctx.arc(hx + fx * r * 0.3, hy + fy * r * 0.3, 2.6, 0, TAU); ctx.fillStyle = '#FFFFFF'; ctx.fill();
          for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(x + px * sd * r * 0.82 - fx * r * 0.2, y + py * sd * r * 0.82 - fy * r * 0.2, 2.4, 0, TAU); ctx.fillStyle = tm.l; ctx.fill(); }
        } else if (u.type === 'archer') {
          ctx.save(); ctx.translate(x, y); ctx.rotate(u.face);
          ctx.beginPath(); ctx.moveTo(u.r * 1.5, 0); ctx.lineTo(-u.r, -u.r * 1.05); ctx.lineTo(-u.r, u.r * 1.05); ctx.closePath();
          ctx.fillStyle = tm.c; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = COL.ink; ctx.stroke();
          ctx.restore();
        } else {
          ctx.beginPath(); ctx.arc(x, y, u.r, 0, TAU);
          ctx.fillStyle = u.type === 'skeleton' ? '#E8E2D0' : u.type === 'ninja' ? '#1E2230' : LIGHT_FILL[u.type] ? tm.c : tm.d; ctx.fill();
          ctx.lineWidth = u.type === 'giant' ? 5 : 3; ctx.strokeStyle = COL.ink; ctx.stroke();
          if (u.type === 'knight') { ctx.beginPath(); ctx.arc(x, y, u.r - 4.5, 0, TAU); ctx.lineWidth = 3.5; ctx.strokeStyle = tm.l; ctx.stroke(); }
          if (u.gear) this.drawGear(ctx, u, x, y, tm);
          if (NEW_LOOK[u.type]) this.drawNewLook(ctx, u, x, y, tm);
          if (u.type === 'crossbowman') {
            // a crossbow held out front: stock along the facing, bow across it
            const fx = Math.cos(u.face), fy = Math.sin(u.face), px = -fy, py = fx;
            const sx0 = x + fx * (u.r - 4), sy0 = y + fy * (u.r - 4), ex = x + fx * (u.r + 12), ey = y + fy * (u.r + 12);
            ctx.lineWidth = 7; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(ex, ey); ctx.stroke();
            ctx.lineWidth = 4; ctx.strokeStyle = COL.wood; ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(ex, ey); ctx.stroke();
            const bx1 = ex - fx * 4, by1 = ey - fy * 4;
            ctx.lineWidth = 6; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(bx1 + px * 11 - fx * 5, by1 + py * 11 - fy * 5); ctx.lineTo(bx1, by1); ctx.lineTo(bx1 - px * 11 - fx * 5, by1 - py * 11 - fy * 5); ctx.stroke();
            ctx.lineWidth = 3; ctx.strokeStyle = COL.steel; ctx.beginPath(); ctx.moveTo(bx1 + px * 11 - fx * 5, by1 + py * 11 - fy * 5); ctx.lineTo(bx1, by1); ctx.lineTo(bx1 - px * 11 - fx * 5, by1 - py * 11 - fy * 5); ctx.stroke();
          }
          if (tm.a && u.type !== 'giant') { ctx.beginPath(); ctx.arc(x, y, u.r - 4, 0, TAU); ctx.lineWidth = 2.5; ctx.strokeStyle = tm.a; ctx.stroke(); }
          if (u.type === 'skeleton') {
            // bone-white skull with dark eye sockets, wearing the team colour as a ring
            const fx = Math.cos(u.face), fy = Math.sin(u.face), px = -fy, py = fx;
            ctx.beginPath(); ctx.arc(x, y, u.r - 1.5, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = tm.c; ctx.stroke();
            ctx.fillStyle = '#1A1A22';
            for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(x + fx * u.r * 0.3 + px * sd * u.r * 0.32, y + fy * u.r * 0.3 + py * sd * u.r * 0.32, u.r * 0.2, 0, TAU); ctx.fill(); }
          }
          if (u.type === 'orc') {
            // two white tusks and a wooden club
            const fx = Math.cos(u.face), fy = Math.sin(u.face), px = -fy, py = fx;
            ctx.fillStyle = '#F4F1E6'; ctx.lineWidth = 1.5; ctx.strokeStyle = COL.ink;
            for (const sd of [-1, 1]) { const bx = x + fx * u.r * 0.75 + px * sd * u.r * 0.35, by = y + fy * u.r * 0.75 + py * sd * u.r * 0.35; ctx.beginPath(); ctx.moveTo(bx - px * 3, by - py * 3); ctx.lineTo(bx + fx * 7, by + fy * 7); ctx.lineTo(bx + px * 3, by + py * 3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
            const ang = u.face + 0.8 - (u.lunge || 0) * 1.1, cfx = Math.cos(ang), cfy = Math.sin(ang);
            ctx.lineCap = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(x + cfx * u.r * 0.6, y + cfy * u.r * 0.6); ctx.lineTo(x + cfx * (u.r + 16), y + cfy * (u.r + 16)); ctx.stroke();
            ctx.lineWidth = 6; ctx.strokeStyle = '#7A5230'; ctx.stroke();
          }
          if (u.type === 'elf') {
            // green hood and a curved bow held out front
            const fx = Math.cos(u.face), fy = Math.sin(u.face);
            ctx.beginPath(); ctx.arc(x - fx * 2, y - fy * 2, u.r * 0.6, 0, TAU); ctx.fillStyle = '#2E7D4F'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke();
            ctx.beginPath(); ctx.arc(x + fx * (u.r - 2), y + fy * (u.r - 2), u.r * 0.85, u.face - 1.1, u.face + 1.1); ctx.lineWidth = 4; ctx.strokeStyle = COL.ink; ctx.stroke(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#C79A5B'; ctx.stroke();
          }
          if (u.type === 'wizard') {
            // pointed hat seen from above (a star of folds) and a staff with a glowing orb
            const fx = Math.cos(u.face), fy = Math.sin(u.face), px = -fy, py = fx;
            ctx.beginPath();
            for (let k = 0; k < 10; k++) { const a = k / 10 * TAU, rr = k % 2 ? u.r * 0.35 : u.r * 0.78; const hx = x + Math.cos(a) * rr, hy = y + Math.sin(a) * rr; k ? ctx.lineTo(hx, hy) : ctx.moveTo(hx, hy); }
            ctx.closePath(); ctx.fillStyle = tm.d; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke();
            ctx.beginPath(); ctx.arc(x, y, u.r * 0.18, 0, TAU); ctx.fillStyle = '#FFD23F'; ctx.fill();
            const sx = x + px * u.r * 0.6, sy = y + py * u.r * 0.6, ex = sx + fx * (u.r + 12), ey = sy + fy * (u.r + 12);
            ctx.lineCap = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
            ctx.lineWidth = 3; ctx.strokeStyle = '#8A6A49'; ctx.stroke();
            const glow = 0.6 + 0.4 * (u.muzzle || 0);
            ctx.beginPath(); ctx.arc(ex, ey, 5 + 4 * (u.muzzle || 0), 0, TAU); ctx.fillStyle = `rgba(192,132,252,${glow})`; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = COL.ink; ctx.stroke();
          }
          if (MODERN_INF[u.type]) {
            // modern infantry from above: a helmet, and a gun held to the right pointing at the enemy
            const fx = Math.cos(u.face), fy = Math.sin(u.face), px = -fy, py = fx;
            ctx.beginPath(); ctx.arc(x - fx * 1.5, y - fy * 1.5, u.r * 0.58, 0, TAU); ctx.fillStyle = tm.d; ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke();
            ctx.beginPath(); ctx.arc(x - fx * 3 - px * 2, y - fy * 3 - py * 2, u.r * 0.2, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
            if (u.type === 'grenadier') {
              // grenade in hand, ready to throw
              const gx = x + fx * (u.r + 2) + px * u.r * 0.55, gy = y + fy * (u.r + 2) + py * u.r * 0.55;
              ctx.beginPath(); ctx.arc(gx, gy, 4.5, 0, TAU); ctx.fillStyle = '#4A6B2E'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke();
            } else {
              const G = MODERN_INF[u.type], sx = x + px * u.r * 0.4, sy = y + py * u.r * 0.4;
              const tx = sx + fx * (u.r + G.len), ty = sy + fy * (u.r + G.len);
              ctx.lineCap = 'butt';
              ctx.lineWidth = G.w + 3; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
              ctx.lineWidth = G.w; ctx.strokeStyle = '#3A3F47'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
              if (u.type === 'sniper') { const mx = sx + fx * u.r * 0.9, my = sy + fy * u.r * 0.9; ctx.beginPath(); ctx.arc(mx, my, 3.2, 0, TAU); ctx.fillStyle = '#9FD3FF'; ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke(); }
              if (u.type === 'gunner') { ctx.fillStyle = '#6B5A2E'; ctx.fillRect(x - fx * u.r * 0.9 - 5, y - fy * u.r * 0.9 - 5, 10, 10); ctx.lineWidth = 1.5; ctx.strokeRect(x - fx * u.r * 0.9 - 5, y - fy * u.r * 0.9 - 5, 10, 10); }
              if (u.muzzle > 0) { ctx.beginPath(); ctx.arc(tx + fx * 3, ty + fy * 3, (u.type === 'sniper' ? 8 : 5) * u.muzzle, 0, TAU); ctx.fillStyle = `rgba(255,226,122,${u.muzzle})`; ctx.fill(); }
            }
          }
          if (u.type === 'spearman') {
            // long spear pointing at the enemy; it thrusts forward on each attack
            const fx = Math.cos(u.face), fy = Math.sin(u.face), px = -fy, py = fx;
            const reach = u.r + 26 + (u.lunge || 0) * 12, sd = this.slashes ? u.r * 0.82 : 0, sd2 = this.slashes ? u.r * 0.62 : 0;
            // (art 2: held in his right hand at his side, not across his body)
            const bx0 = x - fx * (u.r * 0.6) + px * sd, by0 = y - fy * (u.r * 0.6) + py * sd, tx = x + fx * reach + px * sd2, ty = y + fy * reach + py * sd2;
            if (this.slashes && (u.lunge || 0) > 0.25) { ctx.lineCap = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,255,255,${u.lunge * 0.8})`; for (const o of [-5, 5]) { ctx.beginPath(); ctx.moveTo(tx - fx * 30 + px * o, ty - fy * 30 + py * o); ctx.lineTo(tx - fx * 8 + px * o, ty - fy * 8 + py * o); ctx.stroke(); } }
            ctx.lineCap = 'round';
            ctx.lineWidth = 6; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(tx, ty); ctx.stroke();
            ctx.lineWidth = 3; ctx.strokeStyle = COL.wood; ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(tx, ty); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(tx + fx * 11, ty + fy * 11); ctx.lineTo(tx + px * 5, ty + py * 5); ctx.lineTo(tx - px * 5, ty - py * 5); ctx.closePath();
            ctx.fillStyle = COL.steel; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke();
            if (this.slashes) disc(ctx, x + px * u.r * 0.8 + fx * u.r * 0.2, y + py * u.r * 0.8 + fy * u.r * 0.2, 3.8, tm.l, 1.5); // his hand on the shaft
          }
          if (u.type === 'shieldbearer') {
            // a big tower shield held in front, with a gold boss
            const fx = Math.cos(u.face), fy = Math.sin(u.face), px = -fy, py = fx;
            const cx0 = x + fx * (u.r * 0.85), cy0 = y + fy * (u.r * 0.85), hw = u.r * 0.95, ht = 5;
            ctx.beginPath();
            ctx.moveTo(cx0 + px * hw - fx * ht, cy0 + py * hw - fy * ht); ctx.lineTo(cx0 + px * hw + fx * ht, cy0 + py * hw + fy * ht);
            ctx.lineTo(cx0 - px * hw + fx * ht, cy0 - py * hw + fy * ht); ctx.lineTo(cx0 - px * hw - fx * ht, cy0 - py * hw - fy * ht); ctx.closePath();
            ctx.fillStyle = tm.l; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = COL.ink; ctx.stroke();
            ctx.beginPath(); ctx.arc(cx0 + fx * 2, cy0 + fy * 2, 3.5, 0, TAU); ctx.fillStyle = COL.gold; ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
          }
          if (u.type === 'berserker') {
            // an axe that chops down across the front on each attack
            const chop = u.lunge || 0, ang = u.face + 0.9 - (1 - chop) * 0.15 - chop * 1.2;
            const fx = Math.cos(ang), fy = Math.sin(ang), px = -fy, py = fx;
            const bx0 = x + fx * (u.r - 3), by0 = y + fy * (u.r - 3), hx = x + fx * (u.r + 17), hy = y + fy * (u.r + 17);
            ctx.lineCap = 'round';
            ctx.lineWidth = 6; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(hx, hy); ctx.stroke();
            ctx.lineWidth = 3; ctx.strokeStyle = COL.wood; ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(hx, hy); ctx.stroke();
            ctx.beginPath(); ctx.arc(hx - fx * 3, hy - fy * 3, 8, ang - Math.PI / 2 + 0.2, ang + Math.PI / 2 - 0.2, true);
            ctx.closePath(); ctx.fillStyle = COL.steel; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke();
            // red war paint stripe
            ctx.beginPath(); ctx.moveTo(x - px * u.r * 0.55, y - py * u.r * 0.55); ctx.lineTo(x + px * u.r * 0.55, y + py * u.r * 0.55);
            ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,0,0,0.55)'; ctx.stroke();
          }
          if (u.type === 'healer') {
            // white cross on the body; a green ring pulses out when he heals, with a beam to the patient
            ctx.lineCap = 'butt'; ctx.strokeStyle = tm.name === 'WHITE' || tm.name === 'SILVER' ? '#E5484D' : '#FFFFFF'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(x - u.r * 0.55, y); ctx.lineTo(x + u.r * 0.55, y); ctx.moveTo(x, y - u.r * 0.55); ctx.lineTo(x, y + u.r * 0.55); ctx.stroke();
            if (u.healFx > 0) {
              ctx.beginPath(); ctx.arc(x, y, u.r + 4 + (1 - u.healFx) * 18, 0, TAU);
              ctx.lineWidth = 3; ctx.strokeStyle = `rgba(124,255,176,${u.healFx * 0.8})`; ctx.stroke();
              if (u.healTo && !u.healTo.dead) {
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(u.healTo.x, u.healTo.y);
                ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(124,255,176,${u.healFx * 0.55})`; ctx.stroke();
              }
            }
          }
          if (swordy) {
            // The sword rests to one side. Each attack sweeps it smoothly across to the other side
            // (ease in and out over ~0.3 s), leaving a fading swish trail behind the blade.
            const SW = 1.05, on = u.swing > 0, p = 1 - (u.swing || 0);
            const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
            const rest = (u.swordSide || -1) * SW;
            const from = on ? (u.swingStart === undefined ? (u.swingFrom || -1) * SW : u.swingStart) : rest;
            const running = !on && Math.hypot(u.vx, u.vy) > 18;
            // where the sword wants to be: resting to one side, or low and swaying while running toward the enemy
            const want = running ? (u.swordSide || -1) * 0.45 + Math.sin(this.fightT * 11 + u.gait) * 0.4 : rest;
            // during a swing the eased curve drives it; otherwise glide toward 'want' so it never snaps
            let off = on ? from + (rest - from) * e : (u.swordOff === undefined ? want : u.swordOff + clamp((want - u.swordOff) * 0.18, -0.1, 0.1));
            u.swordOff = off;
            const ang = u.face + off;
            if (on && u.swing > 0.08) {
              const span = off - from, steps = 6;
              for (let k = 0; k < steps; k++) {
                const a0 = u.face + from + span * (k / steps), a1 = u.face + from + span * ((k + 1) / steps);
                if (this.slashes) {
                  // art 2: a solid crescent swept by the blade, brightest at the leading edge
                  const kat2 = u.type === 'samurai', R1 = u.r + (kat2 ? 28 : 22) + 3, R0 = u.r + 4 + 6 * (1 - (k + 1) / steps), lo = Math.min(a0, a1), hi = Math.max(a0, a1) + 0.02;
                  ctx.beginPath(); ctx.arc(x, y, R1, lo, hi); ctx.arc(x, y, R0, hi, lo, true); ctx.closePath();
                  ctx.fillStyle = `rgba(255,255,255,${(0.05 + 0.55 * ((k + 1) / steps) ** 1.5) * Math.min(1, u.swing * 1.6)})`; ctx.fill();
                  continue;
                }
                ctx.beginPath(); ctx.arc(x, y, u.r + 15, Math.min(a0, a1), Math.max(a0, a1));
                ctx.lineWidth = 3 + 8 * ((k + 1) / steps);
                ctx.strokeStyle = `rgba(255,255,255,${(0.08 + 0.5 * ((k + 1) / steps)) * Math.min(1, u.swing * 1.6)})`;
                ctx.stroke();
              }
            }
            const fx = Math.cos(ang), fy = Math.sin(ang), px = -fy, py = fx;
            const kat = u.type === 'samurai', len = kat ? 28 : 22;
            const bx0 = x + fx * (u.r - 2), by0 = y + fy * (u.r - 2), tx = x + fx * (u.r + len), ty = y + fy * (u.r + len);
            ctx.lineWidth = kat ? 6 : 7; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(tx, ty); ctx.stroke();
            ctx.lineWidth = kat ? 3 : 4; ctx.strokeStyle = COL.steel; ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(tx, ty); ctx.stroke();
            if (kat) { ctx.beginPath(); ctx.arc(bx0 + fx * 2, by0 + fy * 2, 4, 0, TAU); ctx.fillStyle = COL.gold; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = COL.ink; ctx.stroke(); }
            else { ctx.lineWidth = 4; ctx.strokeStyle = COL.gold; ctx.beginPath(); ctx.moveTo(bx0 + px * 7, by0 + py * 7); ctx.lineTo(bx0 - px * 7, by0 - py * 7); ctx.stroke(); }
          }
          if (u.type === 'giant') {
            ctx.beginPath(); ctx.arc(x, y, u.r - 9, 0, TAU); ctx.fillStyle = tm.c; ctx.fill();
            ctx.fillStyle = COL.gold; ctx.beginPath();
            ctx.moveTo(x - 18, y + 6); ctx.lineTo(x - 18, y - 12); ctx.lineTo(x - 9, y - 3); ctx.lineTo(x, y - 18); ctx.lineTo(x + 9, y - 3); ctx.lineTo(x + 18, y - 12); ctx.lineTo(x + 18, y + 6); ctx.closePath(); ctx.fill();
            ctx.lineWidth = 2.5; ctx.strokeStyle = COL.ink; ctx.stroke();
          }
        }
    }
  }

  // =====================================================================
  // Sound: events from the match are synthesised into a stereo buffer.
  // =====================================================================
  class Synth {
    constructor(sr, maxSec) {
      this.sr = sr;
      this.len = Math.ceil(sr * maxSec);
      this.L = new Float32Array(this.len);
      this.R = new Float32Array(this.len);
      this.variety = 0; this.pk = 1; this.gk = 1;   // sound variety (rules.sound.variety): pitch and volume change per sound, 0 = off
      this.reset(1);
    }
    reset(seed) { this.L.fill(0); this.R.fill(0); this.last = {}; this.ns = (seed >>> 0) || 1; this.vs = ((seed >>> 0) ^ 0x9E3779B9) >>> 0 || 1; }
    // a separate random sequence for the variety, so the synth's own noise (and the battle) are unchanged
    vrand() { let x = this.vs; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.vs = x >>> 0; return (this.vs / 4294967296) * 2 - 1; }
    noise() { let x = this.ns; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.ns = x >>> 0; return (this.ns / 4294967296) * 2 - 1; }
    gate(key, gap, t) { const l = this.last[key]; if (l !== undefined && t - l < gap) return false; this.last[key] = t; return true; }
    // Generic voice: sum of decaying partials with optional pitch glide, plus filtered noise.
    voice(t, o) {
      const sr = this.sr, s0 = Math.floor(t * sr);
      const n = Math.min(Math.floor((o.dur || 0.3) * sr), this.len - s0);
      if (n <= 0 || s0 < 0) return;
      const pan = clamp(o.pan || 0, -1, 1);
      const gl = (o.gain || 0.2) * this.gk * Math.cos(((pan + 1) * Math.PI) / 4), gr = (o.gain || 0.2) * this.gk * Math.sin(((pan + 1) * Math.PI) / 4);
      const parts = (o.partials || []).map(p => ({ f: p.f * this.pk, f2: (p.f2 === undefined ? p.f : p.f2) * this.pk, a: p.a === undefined ? 1 : p.a, k: Math.exp(-1 / ((p.decay || 0.1) * sr)), env: 1, ph: 0, glide: p.glide || 0.08, inc: (TAU * p.f * this.pk) / sr, gk: Math.exp(-1 / ((p.glide || 0.08) * sr)), gd: 1 }));
      const nk = o.noise ? Math.exp(-1 / ((o.noise.decay || 0.03) * sr)) : 0;
      let nenv = o.noise ? o.noise.a : 0, lp = 0, hpPrev = 0;
      const lpA = o.noise ? clamp(o.noise.lp || 0.5, 0.01, 1) : 0;
      const att = Math.max(1, Math.floor((o.attack || 0.002) * sr));
      const L = this.L, Rr = this.R;
      for (let i = 0; i < n; i++) {
        let v = 0;
        let alive = nenv > 1e-4;
        for (const p of parts) {
          if (p.env < 1e-4) continue;
          alive = true;
          if (p.f2 !== p.f) { p.ph += (TAU * (p.f2 + (p.f - p.f2) * p.gd)) / sr; p.gd *= p.gk; }
          else p.ph += p.inc;
          v += Math.sin(p.ph) * p.a * p.env;
          p.env *= p.k;
        }
        if (!alive && i > att) break;
        if (nenv > 1e-4) {
          const w = this.noise();
          lp += (w - lp) * lpA;
          const sig = o.noise.hp ? lp - hpPrev : lp; hpPrev = lp;
          v += sig * nenv; nenv *= nk;
        }
        if (i < att) v *= i / att;
        L[s0 + i] += v * gl; Rr[s0 + i] += v * gr;
      }
    }
    // every sound gets its own small pitch and volume change (up to ±variety, volume up to 1.5× that), if variety is on
    play(ev, t) {
      if (this.variety > 0) { this.pk = 1 + this.vrand() * this.variety; this.gk = 1 + this.vrand() * this.variety * 1.5; }
      this.playRaw(ev, t);
      this.pk = 1; this.gk = 1;
    }
    playRaw(ev, t) {
      const pan = ev.pan || 0;
      switch (ev.type) {
        case 'pluck': {
          if (!this.gate('pluck' + ev.team, 0.045, t)) return;
          const f = ev.f;
          if (ev.team === 0) this.voice(t, { dur: 0.32, gain: 0.15, pan, partials: [{ f, decay: 0.11 }, { f: f * 2, a: 0.35, decay: 0.05 }, { f: f * 3, a: 0.12, decay: 0.03 }] });
          else this.voice(t, { dur: 0.32, gain: 0.12, pan, partials: [{ f, decay: 0.12 }, { f: f * 3.5, a: 0.25, decay: 0.03 }, { f: f * 2, a: 0.2, decay: 0.06 }] });
          return;
        }
        case 'pickup': [0, 1, 2].forEach(k => this.voice(t + k * 0.055, { dur: 0.18, gain: 0.12, pan, partials: [{ f: [660, 880, 1320][k], decay: 0.07 }, { f: [660, 880, 1320][k] * 3, a: 0.25, decay: 0.03 }] })); return;
        case 'freeze': [0, 1, 2, 3].forEach(k => this.voice(t + k * 0.04, { dur: 0.4, gain: 0.07, pan, partials: [{ f: 2600 - k * 300, f2: 1500 - k * 200, glide: 0.2, decay: 0.15 }] })); return;
        case 'beep': this.voice(t, { dur: 0.22, gain: ev.hi ? 0.24 : 0.18, partials: [{ f: ev.hi ? 1320 : 880, decay: 0.09 }, { f: (ev.hi ? 1320 : 880) * 3, a: 0.2, decay: 0.04 }] }); return;
        case 'alarm': [0, 1, 2, 3].forEach(k => this.voice(t + k * 0.12, { dur: 0.14, gain: 0.12, partials: [{ f: k % 2 ? 880 : 660, decay: 0.08 }, { f: (k % 2 ? 880 : 660) * 2, a: 0.3, decay: 0.05 }] })); return;
        case 'boom': this.voice(t, { dur: 0.9, gain: 0.55 * (ev.gain || 1), pan, partials: [{ f: 120, f2: 38, glide: 0.18, decay: 0.32 }], noise: { a: 0.7, decay: 0.18, lp: 0.08 } }); return;
        case 'hit': {
          if (!this.gate('hit', 0.04, t)) return;
          const g = clamp(0.35 + (ev.power || 8) / 40, 0.35, 0.8);
          this.voice(t, { dur: 0.3, gain: g, pan, partials: [{ f: 170, f2: 60, glide: 0.05, decay: 0.09 }], noise: { a: 0.9, decay: 0.035, lp: 0.6, hp: true } });
          return;
        }
        case 'clang': {
          if (!this.gate('clang', 0.06, t)) return;
          const b = 640 + (this.noise() + 1) * 70;
          this.voice(t, { dur: 0.6, gain: 0.2, pan, partials: [{ f: b, decay: 0.3 }, { f: b * 2.32, a: 0.6, decay: 0.2 }, { f: b * 3.81, a: 0.4, decay: 0.12 }, { f: b * 5.67, a: 0.25, decay: 0.07 }], noise: { a: 0.5, decay: 0.006, lp: 0.9, hp: true } });
          return;
        }
        // weapon sounds: an axe or club chops, a spear or lance stabs with a whistle, a mace or hammer rings low, a light blade shings
        case 'chop': if (this.gate('chop', 0.05, t)) this.voice(t, { dur: 0.25, gain: 0.3, pan, partials: [{ f: 210, f2: 85, glide: 0.06, decay: 0.07 }], noise: { a: 0.8, decay: 0.04, lp: 0.35 } }); return;
        case 'stab': if (this.gate('stab', 0.04, t)) this.voice(t, { dur: 0.16, gain: 0.1, pan, partials: [{ f: 1150, f2: 650, glide: 0.05, decay: 0.05, a: 0.5 }, { f: 2300, f2: 1300, glide: 0.05, decay: 0.03, a: 0.2 }], noise: { a: 0.7, decay: 0.03, lp: 0.8, hp: true } }); return;
        case 'crush': if (this.gate('crush', 0.06, t)) this.voice(t, { dur: 0.5, gain: 0.28, pan, partials: [{ f: 330, decay: 0.18 }, { f: 330 * 2.7, a: 0.5, decay: 0.1 }, { f: 330 * 4.1, a: 0.3, decay: 0.06 }], noise: { a: 0.9, decay: 0.02, lp: 0.4 } }); return;
        case 'shing': if (this.gate('shing', 0.03, t)) this.voice(t, { dur: 0.12, gain: 0.07, pan, partials: [{ f: 2000, f2: 3000, glide: 0.03, decay: 0.04, a: 0.6 }], noise: { a: 0.6, decay: 0.02, lp: 0.9, hp: true } }); return;
        case 'bonk': if (this.gate('bonk', 0.1, t)) this.voice(t, { dur: 0.15, gain: 0.3, pan, partials: [{ f: 280, f2: 170, glide: 0.04, decay: 0.05 }] }); return;
        case 'wall': if (this.gate('wall', 0.12, t)) this.voice(t, { dur: 0.08, gain: 0.12, pan, partials: [{ f: 120, f2: 70, glide: 0.02, decay: 0.025 }], noise: { a: 0.3, decay: 0.01, lp: 0.3 } }); return;
        case 'shoot': if (this.gate('shoot', 0.05, t)) this.voice(t, { dur: 0.18, gain: 0.2, pan, partials: [{ f: 520, f2: 240, glide: 0.04, decay: 0.06 }], noise: { a: 0.5, decay: 0.02, lp: 0.4 } }); return;
        case 'thunk': if (this.gate('thunk', ev.quiet ? 0.06 : 0.04, t)) this.voice(t, { dur: 0.12, gain: ev.quiet ? 0.08 : 0.25, pan, partials: [{ f: 300, f2: 150, glide: 0.03, decay: 0.04 }], noise: { a: 0.5, decay: 0.015, lp: 0.5 } }); return;
        case 'tink': if (this.gate('tink', 0.05, t)) this.voice(t, { dur: 0.15, gain: 0.12, pan, partials: [{ f: 2400, decay: 0.05 }, { f: 3700, a: 0.5, decay: 0.03 }] }); return;
        case 'ko':
          this.voice(t, { dur: 1.2, gain: 0.7, pan, partials: [{ f: 110, f2: 34, glide: 0.25, decay: 0.4 }], noise: { a: 0.9, decay: 0.25, lp: 0.12 } });
          this.voice(t, { dur: 0.8, gain: 0.18, pan, partials: [{ f: 520, decay: 0.35 }, { f: 1206, a: 0.5, decay: 0.22 }, { f: 1981, a: 0.3, decay: 0.14 }] });
          return;
        case 'shot': if (this.gate('shot', 0.035, t)) this.voice(t, { dur: 0.1, gain: 0.07, pan, partials: [{ f: 190, f2: 90, glide: 0.03, decay: 0.03, a: 0.5 }], noise: { a: 1, decay: 0.025, lp: 0.5 } }); return;
        case 'mg': if (this.gate('mg', 0.05, t)) this.voice(t, { dur: 0.07, gain: 0.055, pan, noise: { a: 1, decay: 0.014, lp: 0.6 } }); return;
        case 'snipe': this.voice(t, { dur: 0.3, gain: 0.13, pan, partials: [{ f: 1400, f2: 260, glide: 0.05, decay: 0.07, a: 0.35 }], noise: { a: 1, decay: 0.05, lp: 0.7 } }); return;
        case 'cannon': this.voice(t, { dur: 0.6, gain: 0.3, pan, partials: [{ f: 95, f2: 38, glide: 0.14, decay: 0.22 }], noise: { a: 0.8, decay: 0.09, lp: 0.25 } }); return;
        case 'blast': if (this.gate('blast', 0.06, t)) this.voice(t, { dur: 0.5, gain: ev.big ? 0.3 : 0.2, pan, partials: [{ f: 110, f2: 42, glide: 0.12, decay: 0.18 }], noise: { a: 0.9, decay: ev.big ? 0.16 : 0.1, lp: 0.15 } }); return;
        case 'flame': if (this.gate('flame', 0.12, t)) this.voice(t, { dur: 0.4, gain: 0.12, pan, noise: { a: 1, decay: 0.2, lp: 0.3 } }); return;
        case 'heal': if (this.gate('heal', 0.12, t)) this.voice(t, { dur: 0.3, gain: 0.05, pan, partials: [{ f: 1320, f2: 1760, glide: 0.12, decay: 0.12 }, { f: 2640, a: 0.3, decay: 0.06 }] }); return;
        // director: a whoosh into slow motion, and a deep thud when something huge falls
        // newer troops
        case 'zap': if (this.gate('zap', 0.04, t)) this.voice(t, { dur: 0.14, gain: 0.06, pan, partials: [{ f: 1900, f2: 520, glide: 0.04, decay: 0.05 }, { f: 3800, f2: 1040, glide: 0.04, decay: 0.03, a: 0.3 }] }); return;
        case 'musket': if (this.gate('musket', 0.05, t)) this.voice(t, { dur: 0.45, gain: 0.16, pan, partials: [{ f: 140, f2: 55, glide: 0.08, decay: 0.12, a: 0.6 }], noise: { a: 1, decay: 0.09, lp: 0.35 } }); return;
        case 'rocket': if (this.gate('rocket', 0.12, t)) this.voice(t, { dur: 0.5, gain: 0.12, pan, attack: 0.02, partials: [{ f: 260, f2: 620, glide: 0.2, decay: 0.2, a: 0.25 }], noise: { a: 0.9, decay: 0.25, lp: 0.22 } }); return;
        case 'groan': if (this.gate('groan', 0.25, t)) this.voice(t, { dur: 0.7, gain: 0.09, pan, attack: 0.08, partials: [{ f: 118, f2: 82, glide: 0.4, decay: 0.3 }, { f: 236, f2: 160, glide: 0.4, decay: 0.2, a: 0.5 }, { f: 355, f2: 250, glide: 0.4, decay: 0.12, a: 0.25 }] }); return;
        case 'plane': this.voice(t, { dur: 2.6, gain: 0.1, pan, attack: 0.8, partials: [{ f: 92, f2: 70, glide: 1.2, decay: 1.2 }, { f: 184, f2: 140, glide: 1.2, decay: 0.8, a: 0.4 }], noise: { a: 0.4, decay: 1.0, lp: 0.05 } }); return;
        case 'jet': this.voice(t, { dur: 2.0, gain: 0.2, pan, attack: 0.5, partials: [{ f: 600, f2: 180, glide: 0.8, decay: 0.7, a: 0.15 }], noise: { a: 1, decay: 0.7, lp: 0.2 } }); return;
        case 'meteor': if (this.gate('meteor', 0.15, t)) this.voice(t, { dur: 0.8, gain: 0.08, pan, partials: [{ f: 1500, f2: 320, glide: 0.5, decay: 0.5 }] }); return;
        case 'thunder': if (this.gate('thunder', 0.25, t)) this.voice(t + 0.6, { dur: 1.4, gain: 0.4, pan, partials: [{ f: 60, f2: 35, glide: 0.4, decay: 0.5, a: 0.5 }], noise: { a: 1, decay: 0.45, lp: 0.07 } }); return;
        case 'powerup': [0, 1, 2, 3].forEach(k => this.voice(t + k * 0.06, { dur: 0.25, gain: 0.1, pan, partials: [{ f: [523, 659, 784, 1047][k], decay: 0.12 }, { f: [523, 659, 784, 1047][k] * 2, a: 0.3, decay: 0.06 }] })); return;
        case 'streak': if (this.gate('streak', 0.5, t)) [0, 1].forEach(k => this.voice(t + k * 0.07, { dur: 0.3, gain: ev.big ? 0.12 : 0.09, pan, partials: [{ f: (ev.big ? 880 : 660) * (k ? 1.5 : 1), decay: 0.15 }, { f: (ev.big ? 1760 : 1320) * (k ? 1.5 : 1), a: 0.3, decay: 0.07 }] })); return;
        case 'wind': this.voice(t, { dur: 4, gain: 0.18, pan, attack: 1.2, noise: { a: 1, decay: 1.6, lp: 0.05 } }); return;
        case 'rumble': this.voice(t, { dur: 2.6, gain: 0.45, pan, attack: 0.15, partials: [{ f: 45, f2: 32, glide: 1, decay: 1.1 }], noise: { a: 1, decay: 0.9, lp: 0.03 } }); return;
        case 'whoosh': if (this.gate('whoosh', 0.4, t)) { this.voice(t, { dur: 0.7, gain: 0.16, pan, attack: 0.05, partials: [{ f: 420, f2: 70, glide: 0.25, decay: 0.3, a: 0.4 }], noise: { a: 0.8, decay: 0.28, lp: 0.12 } }); } return;
        case 'thud': if (this.gate('thud', 0.3, t)) this.voice(t, { dur: 1.1, gain: 0.5, pan, partials: [{ f: 70, f2: 30, glide: 0.3, decay: 0.45 }, { f: 140, f2: 55, glide: 0.2, decay: 0.2, a: 0.4 }], noise: { a: 0.5, decay: 0.12, lp: 0.06 } }); return;
        case 'swish': if (this.gate('swish', 0.05, t)) this.voice(t, { dur: 0.2, gain: 0.05, pan, partials: [{ f: 950, f2: 320, glide: 0.07, decay: 0.06, a: 0.25 }], noise: { a: 0.9, decay: 0.07, lp: 0.45, hp: true } }); return;
        case 'clash': if (this.gate('clash', 0.028, t)) this.voice(t, { dur: 0.07, gain: 0.07, pan, partials: [{ f: 1800 + this.noise() * 200, decay: 0.02 }, { f: 2750, a: 0.6, decay: 0.015 }], noise: { a: 0.4, decay: 0.006, lp: 0.9, hp: true } }); return;
        case 'pop': {
          if (!this.gate('pop', 0.03, t)) return;
          const f = (ev.big ? 300 : 560) * (1 + this.noise() * 0.15);
          this.voice(t, { dur: 0.12, gain: ev.big ? 0.22 : 0.15, pan, partials: [{ f, f2: f * 0.35, glide: 0.03, decay: 0.05 }], noise: { a: 0.3, decay: 0.01, lp: 0.6 } });
          return;
        }
        case 'volley': if (this.gate('volley', 0.06, t)) this.voice(t, { dur: 0.08, gain: 0.07, pan, noise: { a: 0.8, decay: 0.02, lp: 0.35 } }); return;
        case 'stomp': if (this.gate('stomp', 0.2, t)) this.voice(t, { dur: 0.4, gain: 0.4, pan, partials: [{ f: 90, f2: 40, glide: 0.06, decay: 0.12 }], noise: { a: 0.6, decay: 0.05, lp: 0.15 } }); return;
        // the big troop batch and the new systems
        case 'drum': if (this.gate('drum', 0.3, t)) [0, 1].forEach(k => this.voice(t + k * 0.14, { dur: 0.25, gain: 0.16, pan, partials: [{ f: 110, f2: 70, glide: 0.06, decay: 0.09 }], noise: { a: 0.3, decay: 0.03, lp: 0.2 } })); return;
        case 'coin': if (this.gate('coin', 0.15, t)) [0, 1].forEach(k => this.voice(t + k * 0.07, { dur: 0.2, gain: 0.08, pan, partials: [{ f: k ? 2637 : 1976, decay: 0.08 }, { f: (k ? 2637 : 1976) * 2.4, a: 0.3, decay: 0.04 }] })); return;
        case 'roar': if (this.gate('roar', 0.5, t)) this.voice(t, { dur: 1.1, gain: 0.3, pan, attack: 0.06, partials: [{ f: 95, f2: 60, glide: 0.6, decay: 0.45 }, { f: 190, f2: 120, glide: 0.6, decay: 0.3, a: 0.5 }], noise: { a: 0.7, decay: 0.4, lp: 0.12 } }); return;
        case 'portal': if (this.gate('portal', 0.4, t)) this.voice(t, { dur: 1.2, gain: 0.12, pan, attack: 0.15, partials: [{ f: 220, f2: 880, glide: 0.9, decay: 0.5 }, { f: 330, f2: 1320, glide: 0.9, decay: 0.4, a: 0.5 }] }); return;
        case 'glitch': if (this.gate('glitch', 0.3, t)) [0, 1, 2, 3].forEach(k => this.voice(t + k * 0.05, { dur: 0.06, gain: 0.09, pan, partials: [{ f: [880, 220, 1760, 440][k], decay: 0.03 }], noise: { a: 0.6, decay: 0.02, lp: 0.8 } })); return;
        case 'evolve': if (this.gate('evolve', 0.3, t)) [0, 1, 2].forEach(k => this.voice(t + k * 0.08, { dur: 0.35, gain: 0.08, pan, partials: [{ f: [392, 523, 784][k], decay: 0.18 }, { f: [392, 523, 784][k] * 2, a: 0.4, decay: 0.1 }] })); return;
        case 'splash': if (this.gate('splash', 0.12, t)) this.voice(t, { dur: 0.3, gain: 0.1, pan, partials: [{ f: 1400, f2: 500, glide: 0.08, decay: 0.06, a: 0.4 }], noise: { a: 0.8, decay: 0.12, lp: 0.5 } }); return;
        case 'stone': if (this.gate('stone', 0.2, t)) this.voice(t, { dur: 0.9, gain: 0.35, pan, partials: [{ f: 80, f2: 40, glide: 0.3, decay: 0.3 }], noise: { a: 1, decay: 0.35, lp: 0.15 } }); return;
        case 'phase': if (this.gate('phase', 0.15, t)) this.voice(t, { dur: 0.4, gain: 0.08, pan, partials: [{ f: 1200, f2: 300, glide: 0.3, decay: 0.15 }, { f: 1800, f2: 450, glide: 0.3, decay: 0.1, a: 0.5 }] }); return;
        case 'bell': if (this.gate('bell', 0.5, t)) this.voice(t, { dur: 1.6, gain: 0.12, pan, partials: [{ f: 523, decay: 0.8 }, { f: 1255, a: 0.4, decay: 0.5 }, { f: 1570, a: 0.25, decay: 0.3 }] }); return;
        case 'crit': if (this.gate('crit', 0.08, t)) this.voice(t, { dur: 0.2, gain: 0.14, pan, partials: [{ f: 1600, f2: 900, glide: 0.05, decay: 0.06 }], noise: { a: 0.6, decay: 0.03, lp: 0.7, hp: true } }); return;
        case 'win': {
          const base = 261.63;
          [1, 1.26, 1.5, 2].forEach((m, k) => this.voice(t + 0.25 + k * 0.05, { dur: 1.8, gain: 0.07, pan: (k - 1.5) * 0.3, attack: 0.01, partials: [1, 2, 3, 4, 5].map(h => ({ f: base * m * h, a: 1 / h, decay: 0.9 / h })) }));
          return;
        }
      }
    }
  }

  // =====================================================================
  // Cinematic director: moves a camera over an Army battle and bends time (slow motion, then a quiet catch-up),
  // reacting to what happens. The battle itself plays out exactly as it would without the director
  // (the simulation still moves in fixed ticks); only the view and the pace change, and the video still ends on time.
  //   const dir = new Director(game, { seed }); each frame: dir.advance(1 / 60); game.draw(ctx);
  // =====================================================================
  // the finale's timings (video seconds and time scales): go there 2 s of battle before the final blow, at 0.45 speed;
  // the last 0.6 s at 0.16 speed; then nearly freeze on the blow for 0.35 s and let it play out slowly until 1.7 s
  const FIN_LEAD = 2.0, FIN_CLOSE = 0.6, FIN_SLOW1 = 0.45, FIN_SLOW2 = 0.16, FIN_FREEZE = 0.35, FIN_HOLD = 1.7;
  class Director {
    constructor(game, o = {}) {
      this.g = game;
      this.R = rng(((o.seed !== undefined ? o.seed : game.seed) ^ 0x5EC7A11) >>> 0);
      game.fixedTicks = true; game.tickAcc = 0; game.camEv = []; game.realT = 0;
      this.cx = AR.x + AR.w / 2; this.cy = AR.y + AR.h / 2;
      game.cam = { x: this.cx, y: this.cy, z: 1 };
      game.cine = { bars: 0, vig: 0 };
      this.t = 0;          // video time
      this.ts = 1;         // time scale (game seconds per video second)
      this.lz = 0;         // log of the zoom, eased
      this.shots = [];     // shots taken, for tests
      this.heroes = new Set(); this.doomed = new Set();
      this.cool = 0; this.wideSince = 0; this.firstBlood = false; this.started = false;
      this.shot = null;
      // the finale (rules.video.finale): when the battle has been played through once already, the director knows exactly
      // when and where the final blow lands, and is there for it in slow motion
      this.fin = o.finale || null;
      if (this.fin) { game.finalePlan = this.fin; game.noLate = true; }
    }
    get debt() { return this.t - this.g.t; }
    finUnit(uid) { if (!uid) return null; for (const u of this.g.units) if (u.uid === uid && !u.dead) return u; return null; }
    // the busiest fighting: the 160 px cell where both teams are most mixed, averaged with its neighbours
    hotspot() {
      const g = this.g, N = 6, cs = AR.w / N, c = [new Float32Array(N * N), new Float32Array(N * N), new Float32Array(N * N)];
      for (const u of g.units) { if (u.team > 2) continue; const i = clamp((u.x - AR.x) / cs | 0, 0, N - 1), j = clamp((u.y - AR.y) / cs | 0, 0, N - 1); c[u.team][j * N + i]++; }
      let best = -1, bk = 0;
      for (let k = 0; k < N * N; k++) {
        const v = [c[0][k], c[1][k], c[2][k]].sort((a, b) => b - a);
        const sc = v[1] * 2 + (v[0] + v[1] + v[2]) * 0.15;
        if (sc > best) { best = sc; bk = k; }
      }
      const bi = bk % N, bj = bk / N | 0;
      let sx = 0, sy = 0, n = 0;
      for (const u of g.units) { const i = (u.x - AR.x) / cs | 0, j = (u.y - AR.y) / cs | 0; if (Math.abs(i - bi) <= 1 && Math.abs(j - bj) <= 1) { sx += u.x; sy += u.y; n++; } }
      return n ? { x: sx / n, y: sy / n } : { x: this.cx, y: this.cy };
    }
    centroid(team) {
      let sx = 0, sy = 0, n = 0;
      for (const u of this.g.units) if (u.team === team && !u.dead && (u.fade === undefined || u.fade > 0)) { sx += u.x; sy += u.y; n++; }
      return n ? { x: sx / n, y: sy / n } : { x: this.cx, y: this.cy };
    }
    // can we afford a slow-motion moment that adds `cost` seconds of delay, and still catch up before the time limit?
    canSlow(cost) {
      const g = this.g, left = g.cap - g.fightT, d = this.debt + cost;
      return g.phase === 'fight' && d < 4.2 && left > 3 + d / 0.3;
    }
    start(kind, o) {
      this.shot = Object.assign({ kind, t0: this.t, prio: 0, dur: 2, z: 1.6, ts: 1, bars: 0, vig: 0, spd: 4, zspd: 4 }, o);
      this.shots.push({ kind, t: +this.t.toFixed(2) });
      if (o.sfx) this.g.snd(o.sfx);
    }
    // pick what to show this frame
    direct(dt) {
      const g = this.g, ev = g.camEv; g.camEv = [];
      const sh = this.shot;
      // start a shot only if nothing more important is on screen
      const want = (p, f) => { const cur = this.shot; if (!cur || p > cur.prio) f(); };
      if (!this.started) {
        // opening shot: tight on the busiest stretch of the two front lines, with film bars, while CHARGE! plays
        this.started = true;
        let bx = this.cx, best = -Infinity;
        for (let x = AR.x + 250; x <= AR.x + AR.w - 250; x += 20) {
          let n = 0; for (const u of g.units) if (Math.abs(u.x - x) < 220 && Math.abs(u.y - this.cy) < 260) n++;
          const score = n - Math.abs(x - this.cx) * 0.02;
          if (score > best) { best = score; bx = x; }
        }
        g.cam.x = bx; g.cam.z = 1.9; this.lz = Math.log(1.9);
        this.start('open', { prio: 60, dur: 3.2, x: bx, y: this.cy, z: 1.9, bars: 1, spd: 2, zspd: 2 });
        g.cine.bars = 1;
      }
      if (g.phase !== 'fight') {
        if (this.fin && this.finEnd === undefined) {
          // the final blow has landed: hold on it, nearly frozen, then let it play out slowly
          this.finEnd = this.t; g.finFlash = this.t; g.snd('thud'); g.snd('boom', { gain: 0.6 });
          const d = g.lastDeath; this.finX = d && g.endHow === 'kill' ? d.x : g.cam.x; this.finY = d && g.endHow === 'kill' ? d.y : g.cam.y;
          if (!sh || sh.kind !== 'finale') this.start('finale', { prio: 200, dur: 99, z: 2.3, bars: 1, vig: 0.55, spd: 4, zspd: 3 });
        }
        if (this.fin && g.holdOutro && this.t - this.finEnd >= FIN_HOLD) { g.holdOutro = false; g.confetti(); }
        if (!g.holdOutro && (!this.shot || this.shot.kind !== 'outro')) this.start('outro', { prio: 100, dur: 99, z: 1.14, spd: 1.2, zspd: 0.8, team: g.winner });
        return;
      }
      // the finale: a couple of seconds before the final blow (or the final whistle), go to it and slow right down
      if (this.fin && !(sh && sh.kind === 'finale') && g.fightT >= this.fin.t - (this.fin.how === 'kill' ? FIN_LEAD : 1.6)) {
        this.start('finale', { prio: 200, dur: 99, z: 2.1, bars: 1, vig: 0.5, spd: 4.5, zspd: 2.6, sfx: 'whoosh' });
        return;
      }
      for (const e of ev) {
        if (e.type === 'death') {
          if (!this.firstBlood) {
            this.firstBlood = true;
            if (this.canSlow(0.6)) want(70, () => this.start('firstblood', { prio: 70, dur: 1.7, x: e.x, y: e.y, z: 2.3, ts: 0.3, slowFor: 0.7, bars: 1, vig: 0.35, spd: 7, zspd: 7, sfx: 'whoosh' }));
          }
          if (e.big) {
            // a giant, tank or dragon goes down: kill-cam (if we were already following it, stay on it)
            if (sh && sh.kind === 'killcam' && sh.follow === e.unit) { sh.died = this.t; sh.x = e.x; sh.y = e.y; sh.follow = null; g.snd('thud'); }
            else if (this.canSlow(1.2)) want(80, () => { this.start('killcam', { prio: 80, dur: 1.9, died: this.t, x: e.x, y: e.y, z: 2.3, ts: 0.22, slowFor: 0.9, bars: 1, vig: 0.5, spd: 9, zspd: 9, sfx: 'whoosh' }); g.snd('thud'); });
          }
        }
      }
      // a blast that wipes out a group: a short punch-in
      if (this.t > this.cool) for (const e of ev) {
        if (e.type !== 'blast') continue;
        let n = 0; for (const d of ev) if (d.type === 'death' && Math.hypot(d.x - e.x, d.y - e.y) < 80) n++;
        if (n >= 3 && this.canSlow(0.4)) { want(50, () => { this.start('blast', { prio: 50, dur: 1.3, x: e.x, y: e.y, z: 1.75, ts: 0.4, slowFor: 0.5, vig: 0.25, spd: 8, zspd: 8, sfx: 'whoosh' }); this.cool = this.t + 6; }); break; }
      }
      // a giant, tank or dragon about to fall: get there first, in slow motion, so the fall itself is the close-up
      for (const u of g.units) {
        if (UNIT[u.type].rank !== 0 || u.dead || this.doomed.has(u) || u.hp > u.max * 0.1) continue;
        this.doomed.add(u);
        if (this.canSlow(1.8)) want(80, () => this.start('killcam', { prio: 80, dur: 3.4, follow: u, z: 2.2, ts: 0.3, slowFor: 2.4, bars: 1, vig: 0.45, spd: 6, zspd: 6, sfx: 'whoosh' }));
        break;
      }
      // the last troop of an army: follow it to the end
      const tot = g.totals();
      for (let tm = 0; tm < g.N; tm++) {
        const others = tot.reduce((a, b) => a + b, 0) - tot[tm];
        if (tot[tm] !== 1 || others < 2 || tot.filter(v => v > 0).length > 2 || (sh && sh.kind === 'last')) continue;
        const u = g.units.find(v => v.team === tm && !v.dead);
        if (u && g.cap - g.fightT > 1.5) want(90, () => this.start('last', { prio: 90, dur: 6, follow: u, z: 2.05, ts: this.debt < 3 ? 0.35 : 0.7, slowFor: 2, bars: 1, vig: 0.45, spd: 5, zspd: 4, sfx: 'whoosh' }));
      }
      // battle events: follow the supply crate down, punch in when it's grabbed, slow motion as the airstrike lands, pull back for meteors
      for (const e of ev) {
        if (e.type === 'airdrop') want(55, () => this.start('airdrop', { prio: 55, dur: e.ev.release + e.ev.T + 0.9, drop: e.ev, z: 1.55, spd: 2.5, zspd: 2 }));
        if (e.type === 'grab') want(56, () => this.start('grab', { prio: 56, dur: 1.6, x: e.x, y: e.y, z: 1.9, spd: 6, zspd: 6 }));
        if (e.type === 'airstrike') want(75, () => this.start('airstrike', { prio: 75, dur: 3.2, x: e.ev.cx, y: e.ev.cy, z: 1.45, spd: 3, zspd: 2.5, ts: this.canSlow(0.6) ? 0.4 : 1, slowFrom: 1.5, slowFor: 2.4, bars: 1, vig: 0.3, sfx: 'whoosh' }));
        if (e.type === 'hazard') want(46, () => this.start('hazard', e.ev.type === 'tornado' ? { prio: 46, dur: 3.8, chase: e.ev, z: 1.45, spd: 2.5, zspd: 2 } : { prio: 46, dur: 3.4, x: this.cx, y: this.cy, z: 1.05, spd: 2, zspd: 2, vig: 0.22 }));
        if (e.type === 'meteors') want(45, () => this.start('meteors', { prio: 45, dur: 4.6, x: this.cx, y: this.cy, z: 1.06, spd: 2, zspd: 2, vig: 0.25 }));
      }
      // big moments from the new troops and systems (fusions, possessions, boss phases, portals...), and a split-second hit-stop on a crushing crit
      for (const e of ev) {
        if (e.type === 'spot' && ((e.prio || 58) >= 80 || this.t > (this.spotNext || 0))) want(e.prio || 58, () => { this.spotNext = this.t + 8; this.start('spot', { prio: e.prio || 58, dur: e.dur || 2.2, x: e.x, y: e.y, follow: e.follow, z: e.z || 1.8, ts: e.slow && this.canSlow(0.6) ? 0.35 : 1, slowFor: e.slow ? 0.9 : 0, bars: e.slow ? 1 : 0, vig: e.slow ? 0.35 : 0.15, spd: 5, zspd: 4.5, sfx: e.slow ? 'whoosh' : undefined }); });
        if (e.type === 'hitstop' && this.t > (this.stopNext || 0) && this.canSlow(0.25)) { this.stopNext = this.t + 5; this.stopT = this.t + 0.09; }
      }
      // FINAL PUSH and LAST STAND: a slow push-in on the heaviest fighting
      for (const e of ev) if (e.type === 'push' && e.stage !== 2) want(35, () => { const h = this.hotspot(); this.start('push', { prio: 35, dur: 2.6, x: h.x, y: h.y, z: e.stage === 3 ? 1.5 : 1.35, spd: 1.4, zspd: 1.1 }); });
      // a troop on a killing spree: follow it for a moment, with a kill counter
      if (this.t > this.cool && this.t > (this.heroNext || 0) && this.heroes.size < 3 && (!this.shot || this.shot.prio < 40)) {
        let hero = null;
        for (const u of g.units) if ((u.kills || 0) >= 6 && !this.heroes.has(u) && (!hero || u.kills > hero.kills)) hero = u;
        if (hero) { this.heroes.add(hero); this.start('hero', { prio: 40, dur: 2.6, follow: hero, z: 1.75, vig: 0.12, spd: 4, zspd: 3.5, tag: true }); this.heroNext = this.t + 14; }
      }
      // nothing special for a while: drift in on the busiest fighting
      if (!this.shot && this.t - this.wideSince > 6 && this.t > this.cool && this.debt < 1.2) {
        const h = this.hotspot();
        this.start('battle', { prio: 10, dur: this.R.range(2.6, 3.4), x: h.x, y: h.y, z: this.R.range(1.25, 1.42), spd: 1.3, zspd: 1.1, track: true });
      }
    }
    advance(dt) {
      const g = this.g;
      this.direct(dt);
      let sh = this.shot;
      if (sh && sh.kind !== 'outro') {
        const age = this.t - sh.t0, ended = sh.died !== undefined ? this.t - sh.died > (sh.kind === 'killcam' ? 1.3 : 1) : age > sh.dur;
        if (ended || (sh.follow && sh.follow.dead && sh.kind !== 'killcam') || (sh.kind === 'killcam' && sh.follow && age > sh.dur)) {
          if (sh.kind !== 'open') this.cool = Math.max(this.cool, this.t + 2.5);
          this.shot = sh = null; this.wideSince = this.t;
        }
      }
      // where the camera wants to be, how fast time runs, film bars
      let tx = this.cx, ty = this.cy, tz = 1, tts = 1, bars = 0, vig = 0, spd = 2.2, zspd = 1.8, tsRate = 3;
      if (sh) {
        const age = this.t - sh.t0;
        if (sh.kind === 'outro') {
          const m = g.best && g.best[sh.team], c = m && !m.dead && (m.kills || 0) >= 3 ? m : this.centroid(sh.team);
          tx = c.x; ty = c.y; tz = c === m ? 1.3 : sh.z; spd = sh.spd; zspd = sh.zspd; tsRate = 30;
        } else if (sh.kind === 'finale') {
          const F = this.fin; bars = 1; vig = sh.vig;
          if (g.phase === 'fight') {
            const left = F.t - g.fightT, v = F.how === 'kill' ? this.finUnit(F.uid) : null, kl = v ? this.finUnit(F.by) : null;
            if (v) { tx = kl && Math.hypot(kl.x - v.x, kl.y - v.y) < 260 ? v.x * 0.62 + kl.x * 0.38 : v.x; ty = kl && Math.hypot(kl.x - v.x, kl.y - v.y) < 260 ? v.y * 0.62 + kl.y * 0.38 : v.y; }
            else if (F.how === 'kill') { tx = F.x; ty = F.y; } else { const h = this.hotspot(); tx = h.x; ty = h.y; }
            const close = F.how === 'kill' && left < FIN_CLOSE;
            tz = F.how === 'kill' ? (close ? 2.65 : 2.15) : 1.6; spd = close ? 6 : 4.5; zspd = close ? 4 : 2.6;
            tts = F.how === 'kill' ? (close ? FIN_SLOW2 : FIN_SLOW1) : FIN_SLOW1; tsRate = close ? 12 : 8;
          } else {
            // the hold: nearly frozen on the final blow, then slowly playing out while the camera eases back a little
            const a = this.t - this.finEnd;
            tx = this.finX; ty = this.finY; tz = g.endHow === 'kill' ? 2.7 - 0.45 * clamp(a / FIN_HOLD, 0, 1) : 1.5; spd = 5; zspd = 2.2; vig = 0.6;
            tts = a < FIN_FREEZE ? 0.03 : 0.22; tsRate = a < FIN_FREEZE ? 40 : 6;
          }
        } else {
          const f = sh.follow && !sh.follow.dead ? sh.follow : null;
          if (f) { tx = f.x; ty = f.y; } else if (sh.chase) { tx = sh.chase.x; ty = sh.chase.y; } else if (sh.drop) { tx = sh.drop.x; ty = sh.drop.y - (sh.drop.landed ? 0 : 70); } else if (sh.track && age > 0.2) { const h = this.hotspot(); sh.x += (h.x - sh.x) * Math.min(1, dt * 0.8); sh.y += (h.y - sh.y) * Math.min(1, dt * 0.8); tx = sh.x; ty = sh.y; } else { tx = sh.x; ty = sh.y; }
          tz = sh.z; spd = sh.spd; zspd = sh.zspd; bars = sh.bars; vig = sh.vig;
          if (sh.kind === 'open' && age > 1.3) bars = 0;
          // slow motion for the first part of the shot, then ramp back up
          const slowLeft = sh.died !== undefined ? (sh.kind === 'killcam' ? 0.9 : 0.7) - (this.t - sh.died) : (sh.slowFor || 0) - age;
          if (sh.ts < 1 && slowLeft > 0 && age >= (sh.slowFrom || 0)) { tts = sh.ts; tsRate = 14; } else { tts = 1; tsRate = 3.5; }
        }
      }
      if (!sh || sh.kind === 'battle' || sh.kind === 'push') {
        // catch up on time spent in slow motion, gently, while the view is wide or drifting
        if (this.debt > 0.02 && g.phase === 'fight') tts = 1 + Math.min(0.32, this.debt * 0.5);
      } else if (tts === 1 && g.phase === 'fight' && g.fixed && this.debt > 0.02 && g.fixed - this.t < 6 + this.debt * 3) {
        // running out of video with time still owed (one close-up after another left no wide moment to catch up in):
        // catch up during normal-speed close-ups too, so the battle still reaches its ending before the video does
        tts = 1 + Math.min(0.45, this.debt * 0.5);
      }
      if (this.stopT !== undefined && this.t < this.stopT + 0.15 && g.phase === 'fight') { if (this.t < this.stopT) tts = 0.04; tsRate = 40; }
      if (g.phase !== 'fight' && !(sh && sh.kind === 'finale')) tts = 1;
      this.ts += (tts - this.ts) * (1 - Math.exp(-tsRate * dt));
      if (Math.abs(this.ts - 1) < 0.002 && tts === 1) this.ts = 1;
      // advance the battle
      this.t += dt; g.realT = this.t;
      g.frame(dt * this.ts);
      if (g.tag) g.tag.a = Math.max(0, g.tag.a - dt * 3);
      if (sh && sh.tag && sh.follow && !sh.follow.dead) g.tag = { u: sh.follow, text: `${sh.follow.kills} KILLS`, a: Math.min(1, ((g.tag && g.tag.u === sh.follow) ? g.tag.a : 0) + dt * 9) };
      // ease the camera (zoom in log space so pushes feel even), keep the view inside the arena
      const cam = g.cam;
      this.lz += (Math.log(tz) - this.lz) * (1 - Math.exp(-zspd * dt));
      cam.z = Math.exp(this.lz); if (cam.z < 1.0015) cam.z = 1;
      const hv = AR.w / 2 / cam.z, k = 1 - Math.exp(-spd * dt);
      tx = clamp(tx, AR.x + hv, AR.x + AR.w - hv); ty = clamp(ty, AR.y + hv, AR.y + AR.h - hv);
      cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
      cam.x = clamp(cam.x, AR.x + hv, AR.x + AR.w - hv); cam.y = clamp(cam.y, AR.y + hv, AR.y + AR.h - hv);
      const c = g.cine;
      c.bars += (bars - c.bars) * (1 - Math.exp(-(bars > c.bars ? 7 : 4) * dt));
      c.vig += (vig - c.vig) * (1 - Math.exp(-5 * dt));
    }
  }

  // ----- drawing helpers for the new troops (flat cartoon, black outlines) -----
  function disc(ctx, x, y, r, fill, lw) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, TAU); ctx.fillStyle = fill; ctx.fill();
    if (lw !== 0) { ctx.lineWidth = lw || 2.5; ctx.strokeStyle = COL.ink; ctx.stroke(); }
  }
  function ell(ctx, x, y, rx, ry, rot, fill, lw) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, TAU); ctx.fillStyle = fill; ctx.fill();
    if (lw !== 0) { ctx.lineWidth = lw || 2.5; ctx.strokeStyle = COL.ink; ctx.stroke(); }
  }
  function stick(ctx, x0, y0, x1, y1, w, color) {
    ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    ctx.lineWidth = w + 3; ctx.strokeStyle = COL.ink; ctx.stroke(); ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke();
  }
  function tri(ctx, ax, ay, bx, by, cx, cy, fill, lw) {
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (lw !== 0) { ctx.lineWidth = lw || 1.5; ctx.strokeStyle = COL.ink; ctx.stroke(); }
  }

  const ARMY_DRAW = {
    // a riding animal seen from above, under its rider. It faces the way it's moving (u.mface); the rider faces the target.
    drawMount(ctx, u, x, y, kind, tm) {
      if (kind === 'mammoth') { this.drawMammoth(ctx, u, x, y, tm); return; }
      const r = u.r, a = u.mface !== undefined ? u.mface : u.face, mv = Math.hypot(u.vx, u.vy) > 12, ph = this.t * 12 + u.gait, gal = mv ? Math.sin(ph) : 0, INK = COL.ink;
      if (kind === 'griffin') ell(ctx, x + 12, y + 30, r * 1.1, r * 0.6, a, 'rgba(0,0,0,0.25)', 0);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (kind === 'elephant') {
        for (const [lx, ly] of [[0.45, -0.55], [0.45, 0.55], [-0.5, -0.55], [-0.5, 0.55]]) ell(ctx, r * lx + gal * r * 0.08 * Math.sign(lx * ly), r * ly, r * 0.2, r * 0.17, 0, '#6E737C', 2.5);
        ctx.beginPath(); ctx.moveTo(-r * 0.9, 0); ctx.lineTo(-r * 1.2, Math.sin(ph * 0.5) * r * 0.15); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
        ell(ctx, -r * 0.05, 0, r * 0.95, r * 0.72, 0, '#8E939C', 3.5);
        const flap = Math.sin(this.t * 3 + u.gait) * 0.12;
        for (const sd of [-1, 1]) ell(ctx, r * 0.5, sd * r * 0.55, r * 0.42, r * 0.3, sd * (0.5 + flap), '#A4A9B2', 2.5);
        ell(ctx, r * 0.78, 0, r * 0.38, r * 0.34, 0, '#8E939C', 3);
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.98, sd * r * 0.14); ctx.quadraticCurveTo(r * 1.3, sd * r * 0.3, r * 1.4, sd * r * 0.12); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3.5; ctx.strokeStyle = '#F4F1E6'; ctx.stroke(); }
        const sw = Math.sin(this.t * 4 + u.gait) * r * 0.25 + (u.lunge || 0) * r * 0.3;
        ctx.beginPath(); ctx.moveTo(r * 1.05, 0); ctx.quadraticCurveTo(r * 1.45, sw * 0.5, r * 1.6, sw); ctx.lineWidth = 11; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = '#8E939C'; ctx.stroke();
        // a howdah in the team colour with a rider in it
        roundRect(ctx, -r * 0.55, -r * 0.42, r * 0.8, r * 0.84, 6); ctx.fillStyle = tm.c; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = tm.l; ctx.strokeRect(-r * 0.45, -r * 0.32, r * 0.6, r * 0.64);
        disc(ctx, -r * 0.15, 0, r * 0.2, tm.d, 2);
        ctx.restore(); return;
      }
      const col = kind === 'horse' ? (u.type === 'general' ? '#F1EDE4' : u.type === 'generalnolose' ? '#D9B25A' : u.type === 'horsearcher' ? '#C49A6C' : '#8B5A2B') : { nightmare: '#1B1820', wolf: '#7A7F88', boar: '#5A3A22', griffin: '#C8A060' }[kind];
      const dark = kind === 'horse' && u.type === 'general' ? '#BDB6A8' : kind === 'nightmare' ? '#0B0A0F' : kind === 'wolf' ? '#5B6068' : '#3A2A1A';
      const L = kind === 'boar' ? 1.15 : kind === 'wolf' ? 1.4 : kind === 'griffin' ? 1.25 : 1.55, W = kind === 'boar' ? 0.8 : kind === 'wolf' ? 0.55 : kind === 'griffin' ? 0.6 : 0.68;
      if (kind === 'griffin') {
        const fl = 0.7 + 0.3 * Math.sin(this.t * 8 + u.gait);
        for (const sd of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(r * 0.35, sd * r * 0.3); ctx.quadraticCurveTo(r * 0.15, sd * r * 1.9 * fl, -r * 0.7, sd * r * 1.6 * fl); ctx.lineTo(-r * 0.4, sd * r * 0.35); ctx.closePath();
          ctx.fillStyle = '#E9D9B0'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
          ctx.lineWidth = 1.5; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(r * 0.1 - k * r * 0.17, sd * r * 0.45); ctx.lineTo(-r * 0.05 - k * r * 0.2, sd * r * (0.85 + k * 0.18) * fl); ctx.stroke(); }
        }
      } else {
        // four legs, moving in a gallop
        ctx.beginPath();
        for (const [lx, ly, p] of [[0.62, -0.55, 0], [0.62, 0.55, Math.PI], [-0.62, -0.55, Math.PI], [-0.62, 0.55, 0]]) { const lx2 = r * L * lx + (mv ? Math.sin(ph + p) * r * 0.28 : 0), ly2 = r * W * ly * 1.1; ctx.moveTo(lx2 + r * 0.2, ly2); ctx.ellipse(lx2, ly2, r * 0.2, r * 0.12, 0, 0, TAU); }
        ctx.fillStyle = dark; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
      }
      const tw = Math.sin(ph * 0.6) * r * 0.25;
      ctx.beginPath(); ctx.moveTo(-r * L * 0.92, 0); ctx.quadraticCurveTo(-r * L * 1.15, tw * 0.5, -r * L * 1.3, tw);
      ctx.lineWidth = kind === 'wolf' ? 8 : 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = kind === 'wolf' ? 5 : 3.5; ctx.strokeStyle = kind === 'nightmare' ? '#E5484D' : kind === 'griffin' || kind === 'wolf' ? col : dark; ctx.stroke();
      ell(ctx, 0, 0, r * L, r * W, 0, col, 3);
      const hx = r * L * 0.95;
      if (kind === 'griffin') {
        ell(ctx, hx, 0, r * 0.36, r * 0.32, 0, '#F4F6FB', 2.5);
        tri(ctx, hx + r * 0.28, -r * 0.11, hx + r * 0.58, 0, hx + r * 0.28, r * 0.11, '#FFB020');
        ctx.fillStyle = INK; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + r * 0.12, sd * r * 0.14, 1.8, 0, TAU); ctx.fill(); }
      } else if (kind === 'boar') {
        ell(ctx, hx, 0, r * 0.4, r * 0.45, 0, col, 2.5); ell(ctx, hx + r * 0.36, 0, r * 0.14, r * 0.18, 0, '#C98B7A', 2);
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + r * 0.18, sd * r * 0.25); ctx.quadraticCurveTo(hx + r * 0.5, sd * r * 0.4, hx + r * 0.46, sd * r * 0.14); ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#F4F1E6'; ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(r * 0.6, 0); ctx.lineTo(-r * 0.8, 0); ctx.lineWidth = 3.5; ctx.strokeStyle = '#2A1A0E'; ctx.stroke();
      } else if (kind === 'wolf') {
        tri(ctx, hx - r * 0.2, -r * 0.34, hx + r * 0.6, 0, hx - r * 0.2, r * 0.34, col, 2.5);
        for (const sd of [-1, 1]) tri(ctx, hx - r * 0.08, sd * r * 0.2, hx - r * 0.3, sd * r * 0.48, hx + r * 0.1, sd * r * 0.28, dark);
        ctx.fillStyle = '#FFD23F'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + r * 0.12, sd * r * 0.12, 2, 0, TAU); ctx.fill(); }
      } else {
        // neck, long head, ears, and a mane down the neck
        ctx.beginPath(); ctx.moveTo(r * L * 0.55, 0); ctx.lineTo(hx + r * 0.05, 0); ctx.lineWidth = r * 0.48 + 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = r * 0.48; ctx.strokeStyle = col; ctx.stroke();
        ell(ctx, hx + r * 0.25, 0, r * 0.44, r * 0.24, 0, col, 2.5);
        ctx.beginPath(); for (const sd of [-1, 1]) { ctx.moveTo(hx, sd * r * 0.14); ctx.lineTo(hx - r * 0.14, sd * r * 0.3); ctx.lineTo(hx + r * 0.08, sd * r * 0.2); ctx.closePath(); }
        ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hx + r * 0.05, 0); ctx.lineTo(r * L * 0.4, 0); ctx.lineWidth = 4.5; ctx.strokeStyle = kind === 'nightmare' ? '#FF6B3D' : dark; ctx.stroke();
        if (kind === 'nightmare') { ctx.fillStyle = '#E5484D'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + r * 0.4, sd * r * 0.11, 2.4, 0, TAU); ctx.fill(); } }
      }
      // saddle cloth in the team colour
      roundRect(ctx, -r * 0.42, -r * W * 0.9, r * 0.62, r * W * 1.8, 4); ctx.fillStyle = tm.c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
      ctx.restore();
    },
    // the looks of the troops from the big batch (each case draws the whole troop)
    drawRoster(ctx, u, x, y, tm) {
      const r = u.r, f = u.face, fx = Math.cos(f), fy = Math.sin(f), px = -fy, py = fx, INK = COL.ink, T = this.t, lg = u.lunge || 0, U = UNIT[u.type];
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (U.mount) this.drawMount(ctx, u, x, y, U.mount, tm);
      const cx = x - fx * r * 0.1, cy = y - fy * r * 0.1;
      const ring = (rr, w, c) => { ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.lineWidth = w; ctx.strokeStyle = c; ctx.stroke(); };
      const eyes = (hx, hy, fwd, sp, rr, c) => { ctx.fillStyle = c; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + fx * fwd + px * sd * sp, hy + fy * fwd + py * sd * sp, rr, 0, TAU); ctx.fill(); } };
      const P = (a, b) => [x + fx * a + px * b, y + fy * a + py * b];   // a point in the troop's own frame (a = forward, b = to the side)
      switch (u.type) {
        case 'pikeman': {
          const [sx, sy] = P(-r * 0.8, r * 0.45), [tx, ty] = P(r + 40 + lg * 12, r * 0.45);
          stick(ctx, sx, sy, tx, ty, 3, COL.wood);
          tri(ctx, tx + fx * 12, ty + fy * 12, tx + px * 4, ty + py * 4, tx - px * 4, ty - py * 4, COL.steel, 2);
          disc(ctx, x, y, r, tm.c, 3);
          disc(ctx, x - fx * 1.5, y - fy * 1.5, r * 0.58, '#AEB6C6', 2);
          ctx.beginPath(); ctx.arc(x - fx * 1.5, y - fy * 1.5, r * 0.58, f - 0.6, f + 0.6); ctx.lineWidth = 3; ctx.strokeStyle = tm.d; ctx.stroke();
          break;
        }
        case 'duelist': {
          const side = (u.dside = lg > 0.92 ? -(u.dside || 1) : (u.dside || 1));
          disc(ctx, x, y, r, tm.c, 3);
          for (const sd of [-1, 1]) { const sw = sd === side ? lg * 1.2 : 0, a = f + sd * (0.75 - sw), [bx, by] = P(r * 0.35, sd * r * 0.75); stick(ctx, bx, by, bx + Math.cos(a) * 20, by + Math.sin(a) * 20, 2.5, COL.steel); }
          disc(ctx, x - fx * 2, y - fy * 2, r * 0.55, '#C62F2F', 2);
          stick(ctx, ...P(-r * 0.4, 0), ...P(-r - 5, 3 * Math.sin(T * 9 + u.gait)), 2, '#C62F2F');
          break;
        }
        case 'royalguard': {
          const [hx, hy] = P(0, r * 0.7), [ex, ey] = P(r + 18 + lg * 8, r * 0.7);
          stick(ctx, hx - fx * r, hy - fy * r, ex, ey, 3, COL.wood);
          ctx.beginPath(); ctx.moveTo(ex - fx * 3 + px * 2, ey - fy * 3 + py * 2); ctx.quadraticCurveTo(ex + px * 12, ey + py * 12, ex - fx * 13 + px * 3, ey - fy * 13 + py * 3); ctx.closePath();
          ctx.fillStyle = COL.steel; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
          disc(ctx, x, y, r, tm.d, 3.5); ring(r - 4, 3, COL.gold);
          disc(ctx, x - fx * 1.5, y - fy * 1.5, r * 0.5, '#D9DEE6', 2);
          stick(ctx, x - fx * 1.5, y - fy * 1.5, x - fx * (r + 5), y - fy * (r + 5), 2.5, '#E5484D');
          break;
        }
        case 'lancer': {
          const lx = cx + px * r * 0.35, ly = cy + py * r * 0.35, tip = r + 34 + lg * 10, tx = lx + fx * tip, ty = ly + fy * tip;
          stick(ctx, lx - fx * 8, ly - fy * 8, tx, ty, 3.5, '#D9C9A8');
          tri(ctx, tx + fx * 10, ty + fy * 10, tx + px * 3, ty + py * 3, tx - px * 3, ty - py * 3, COL.steel);
          const wv = Math.sin(T * 12 + u.gait) * 3, pb = r + 14;
          tri(ctx, lx + fx * pb, ly + fy * pb, lx + fx * (pb - 12) + px * (8 + wv), ly + fy * (pb - 12) + py * (8 + wv), lx + fx * (pb - 4), ly + fy * (pb - 4), tm.c);
          disc(ctx, cx, cy, r * 0.55, tm.d, 2.5); disc(ctx, cx, cy, r * 0.36, '#C9D1DC', 2);
          if ((u.runT || 0) > 0.4) disc(ctx, tx, ty, 6, 'rgba(255,240,180,0.6)', 0);
          break;
        }
        case 'horsearcher': {
          disc(ctx, cx, cy, r * 0.55, tm.c, 2.5); disc(ctx, cx - fx, cy - fy, r * 0.34, '#7A5230', 2);
          ctx.beginPath(); ctx.arc(cx + fx * r * 0.45, cy + fy * r * 0.45, r * 0.6, f - 1.1, f + 1.1); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#C79A5B'; ctx.stroke();
          break;
        }
        case 'longbow': {
          disc(ctx, x, y, r, tm.c, 3); disc(ctx, x - fx * 2, y - fy * 2, r * 0.58, '#5B4A2E', 2);
          const bx = x + fx * (r - 6), by = y + fy * (r - 6), R = r * 1.35, a0 = f - 0.95, a1 = f + 0.95;
          ctx.beginPath(); ctx.moveTo(bx + Math.cos(a0) * R, by + Math.sin(a0) * R); ctx.lineTo(bx + Math.cos(a1) * R, by + Math.sin(a1) * R); ctx.lineWidth = 1; ctx.strokeStyle = '#F4F1E6'; ctx.stroke();
          ctx.beginPath(); ctx.arc(bx, by, R, a0, a1); ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#A97C48'; ctx.stroke();
          break;
        }
        case 'firearcher': {
          disc(ctx, x, y, r, tm.c, 3); disc(ctx, x - fx * 2, y - fy * 2, r * 0.58, '#7A2E1F', 2);
          ctx.beginPath(); ctx.arc(x + fx * (r - 2), y + fy * (r - 2), r * 0.85, f - 1.1, f + 1.1); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#C79A5B'; ctx.stroke();
          const fl = 0.7 + 0.3 * Math.sin(T * 20 + u.gait), [ax, ay] = P(r + 6, 0);
          disc(ctx, ax, ay, 4.5 * fl + 1, '#FF9F1C', 0); disc(ctx, ax, ay, 2.5 * fl, '#FFE27A', 0);
          break;
        }
        case 'poisoner': {
          disc(ctx, x, y, r, tm.d, 3); disc(ctx, x - fx * 2, y - fy * 2, r * 0.58, '#2F4A2A', 2);
          stick(ctx, ...P(0, r * 0.4), ...P(r + 12, r * 0.4), 2.5, '#6B5A3A');
          disc(ctx, ...P(-r * 0.2, -r * 0.75), 4, '#7CFF6B', 1.5);
          break;
        }
        case 'bannerman': {
          disc(ctx, x, y, r, tm.c, 3);
          const [bx, by] = P(0, r * 0.6), top = by - r - 34;
          ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, top); ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = '#D9B26F'; ctx.stroke();
          ctx.save(); ctx.translate(bx, top); ctx.transform(1, Math.sin(T * 5 + u.gait) * 0.12, 0, 1, 0, 0);
          if (hasFlag(tm)) drawFlag(ctx, tm.key, 0, 0, 32, 21, 2);
          else { roundRect(ctx, 0, 0, 32, 22, 2); ctx.fillStyle = tm.c; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); disc(ctx, 16, 11, 5, COL.gold, 1.5); }
          ctx.restore();
          break;
        }
        case 'drummer': {
          disc(ctx, x, y, r, tm.c, 3);
          const [dx0, dy0] = P(r + 2, 0);
          disc(ctx, dx0, dy0, 8, '#E9D9B0', 2.5); ctx.beginPath(); ctx.arc(dx0, dy0, 6.5, 0, TAU); ctx.lineWidth = 2.5; ctx.strokeStyle = tm.d; ctx.stroke();
          const beat = Math.sin(T * 14 + u.gait);
          for (const sd of [-1, 1]) { const k = sd * beat > 0 ? 1 : 0.4; stick(ctx, ...P(r * 0.2, sd * r * 0.55), dx0 + px * sd * 5 * k - fx * 2 * k, dy0 + py * sd * 5 * k - fy * 2 * k, 1.5, '#8A6A49'); }
          break;
        }
        case 'general': {
          const a = f + 0.7 - lg * 1.3, [sx, sy] = [cx + Math.cos(f + 1.2) * r * 0.5, cy + Math.sin(f + 1.2) * r * 0.5];
          stick(ctx, sx, sy, sx + Math.cos(a) * 22, sy + Math.sin(a) * 22, 3.5, COL.steel);
          ctx.beginPath(); ctx.moveTo(cx + px * r * 0.5, cy + py * r * 0.5);
          ctx.quadraticCurveTo(cx - fx * r * 1.1 + px * r * 0.65, cy - fy * r * 1.1 + py * r * 0.65, cx - fx * r * 1.25, cy - fy * r * 1.25);
          ctx.quadraticCurveTo(cx - fx * r * 1.1 - px * r * 0.65, cy - fy * r * 1.1 - py * r * 0.65, cx - px * r * 0.5, cy - py * r * 0.5); ctx.closePath();
          ctx.fillStyle = tm.c; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
          disc(ctx, cx, cy, r * 0.58, tm.d, 2.5); disc(ctx, cx, cy, r * 0.38, COL.gold, 2);
          stick(ctx, cx + fx * r * 0.3, cy + fy * r * 0.3, cx - fx * r * 0.45, cy - fy * r * 0.45, 2.5, '#E5484D');
          break;
        }
        case 'peasant': {
          if (u.slayer) { const a = f + 0.75 - lg * 1.3, [bx, by] = P(r * 0.3, r * 0.75); stick(ctx, bx, by, bx + Math.cos(a) * (u.god ? 34 : 24), by + Math.sin(a) * (u.god ? 34 : 24), u.god ? 5 : 4, u.god ? COL.gold : COL.steel); }
          else {
            const [sx, sy] = P(-r * 0.6, r * 0.45), [ex, ey] = P(r + 18 + lg * 8, r * 0.45);
            stick(ctx, sx, sy, ex, ey, 2.5, COL.wood);
            ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(ex - px * 5, ey - py * 5); ctx.lineTo(ex + px * 5, ey + py * 5);
            for (const o of [-5, 0, 5]) { ctx.moveTo(ex + px * o, ey + py * o); ctx.lineTo(ex + px * o + fx * 7, ey + py * o + fy * 7); } ctx.stroke();
          }
          if (u.god) { ctx.beginPath(); ctx.arc(x, y, r + 7 + 2 * Math.sin(T * 7), 0, TAU); ctx.fillStyle = 'rgba(255,210,63,0.25)'; ctx.fill(); }
          disc(ctx, x, y, r, u.god ? COL.gold : tm.c, 3);
          if (u.god) ring(r - 3, 3, tm.c);
          disc(ctx, x - fx, y - fy, r * 0.78, u.slayer ? '#AEB6C6' : '#E9C46A', 2); disc(ctx, x - fx, y - fy, r * 0.42, u.slayer ? '#D9DEE6' : '#D4A63A', 1.5);
          break;
        }
        case 'elephant': break;
        case 'necromancer': {
          disc(ctx, x, y, r, '#2A2433', 3); ring(r - 2.5, 3, tm.c);
          disc(ctx, x - fx * 2, y - fy * 2, r * 0.56, '#15121A', 2);
          const [sx, sy] = P(0, r * 0.6), ex = sx + fx * (r + 12), ey = sy + fy * (r + 12), m = u.muzzle || 0;
          stick(ctx, sx, sy, ex, ey, 3, '#4A4038');
          disc(ctx, ex, ey, 9 + 4 * m, `rgba(124,255,176,${0.25 + 0.4 * m})`, 0); disc(ctx, ex, ey, 5, '#E8E2D0', 1.5);
          break;
        }
        case 'bonecolossus': {
          for (const sd of [-1, 1]) { const a = f + sd * (0.9 - (sd > 0 ? lg * 0.5 : 0)), bx = x + Math.cos(f + sd * 1.3) * r * 0.85, by = y + Math.sin(f + sd * 1.3) * r * 0.85; stick(ctx, bx, by, bx + Math.cos(a) * r * 0.8, by + Math.sin(a) * r * 0.8, 7, '#E8E2D0'); disc(ctx, bx + Math.cos(a) * r * 0.85, by + Math.sin(a) * r * 0.85, r * 0.18, '#E8E2D0', 2.5); }
          disc(ctx, x, y, r, '#D9D2BE', 4); ring(r - 4, 4, tm.c);
          ctx.lineWidth = 3; ctx.strokeStyle = '#8A8270';
          ctx.beginPath(); ctx.moveTo(...P(-r * 0.7, 0)); ctx.lineTo(...P(r * 0.3, 0)); ctx.stroke();
          for (let k = 0; k < 4; k++) { const o = -r * 0.5 + k * r * 0.22, w = r * (0.55 - k * 0.05); ctx.beginPath(); ctx.moveTo(...P(o, -w)); ctx.quadraticCurveTo(...P(o + r * 0.12, 0), ...P(o, w)); ctx.stroke(); }
          const [hx, hy] = P(r * 0.62, 0);
          disc(ctx, hx, hy, r * 0.32, '#E8E2D0', 3); eyes(hx, hy, r * 0.08, r * 0.12, r * 0.07, '#FF6B3D');
          break;
        }
        case 'deathknight': {
          const a = f + 0.7 - lg * 1.4, sx = cx + Math.cos(f + 1.2) * r * 0.45, sy = cy + Math.sin(f + 1.2) * r * 0.45, ex = sx + Math.cos(a) * (r + 18), ey = sy + Math.sin(a) * (r + 18);
          stick(ctx, sx, sy, ex, ey, 4, '#3A3F4B');
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineWidth = 1.5; ctx.strokeStyle = '#FF6B3D'; ctx.stroke();
          disc(ctx, cx - fx * 3, cy - fy * 3, r * 0.62, tm.c, 2.5); disc(ctx, cx, cy, r * 0.46, '#1B1820', 2.5);
          stick(ctx, cx + fx * r * 0.3 - px * r * 0.18, cy + fy * r * 0.3 - py * r * 0.18, cx + fx * r * 0.3 + px * r * 0.18, cy + fy * r * 0.3 + py * r * 0.18, 1.5, '#E5484D');
          for (const sd of [-1, 1]) stick(ctx, cx + px * sd * r * 0.3, cy + py * sd * r * 0.3, cx + px * sd * r * 0.55 - fx * r * 0.2, cy + py * sd * r * 0.55 - fy * r * 0.2, 2, '#3A3F4B');
          break;
        }
        case 'wolfrider': {
          const c2x = x - fx * r * 0.15, c2y = y - fy * r * 0.15, a = f + 0.9 - lg * 1.2, bx = c2x + px * r * 0.3, by = c2y + py * r * 0.3;
          stick(ctx, bx, by, bx + Math.cos(a) * 18, by + Math.sin(a) * 18, 3.5, '#7A5230');
          disc(ctx, c2x, c2y, r * 0.55, '#6E8B5E', 2.5);
          ctx.beginPath(); ctx.arc(c2x, c2y, r * 0.55 - 2, 0, TAU); ctx.lineWidth = 2.5; ctx.strokeStyle = tm.c; ctx.stroke();
          break;
        }
        case 'boarrider': {
          const c2x = x - fx * r * 0.15, c2y = y - fy * r * 0.15, bx = c2x + px * r * 0.35, by = c2y + py * r * 0.35;
          stick(ctx, bx - fx * 6, by - fy * 6, bx + fx * (r + 14 + lg * 8), by + fy * (r + 14 + lg * 8), 2.5, COL.wood);
          disc(ctx, c2x, c2y, r * 0.55, tm.c, 2.5); disc(ctx, c2x - fx, c2y - fy, r * 0.32, '#5A3A22', 2);
          break;
        }
        case 'troll': {
          const a = f + 0.85 - lg * 1.2, bx = x + Math.cos(f + 1.1) * r * 0.75, by = y + Math.sin(f + 1.1) * r * 0.75;
          stick(ctx, bx, by, bx + Math.cos(a) * (r + 10), by + Math.sin(a) * (r + 10), 8, '#6B4A2E');
          disc(ctx, bx + Math.cos(a) * (r + 12), by + Math.sin(a) * (r + 12), 7, '#6B4A2E', 2.5);
          disc(ctx, x, y, r, '#5E7D52', 3.5); ring(r - 4, 4, tm.c);
          const [hx, hy] = P(r * 0.45, 0); disc(ctx, hx, hy, r * 0.38, '#6E8F60', 2.5);
          for (const sd of [-1, 1]) tri(ctx, ...P(r * 0.65, sd * r * 0.15), ...P(r * 0.95, sd * r * 0.22), ...P(r * 0.62, sd * r * 0.27), '#F4F1E6');
          if (u.hp < u.max && !(u.burnT > this.fightT)) { ctx.beginPath(); ctx.arc(x, y, r + 3, T * 3, T * 3 + 1.2); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(124,255,176,0.7)'; ctx.stroke(); }
          break;
        }
        case 'cyclops': {
          disc(ctx, x, y, r, '#C9A27A', 4.5); ring(r - 5, 5, tm.c);
          for (const sd of [-1, 1]) disc(ctx, ...P(r * 0.1, sd * r * 0.85), r * 0.28, '#B88E66', 3);
          if (u.cd < 0.8) { disc(ctx, ...P(-r * 0.25, 0), r * 0.42, '#8A8F98', 3); disc(ctx, ...P(-r * 0.33, -r * 0.08), r * 0.13, 'rgba(255,255,255,0.18)', 0); }
          const [hx, hy] = P(r * 0.42, 0);
          disc(ctx, hx, hy, r * 0.4, '#D4AE86', 3); disc(ctx, hx + fx * r * 0.12, hy + fy * r * 0.12, r * 0.2, '#FFFFFF', 2); disc(ctx, hx + fx * r * 0.19, hy + fy * r * 0.19, r * 0.09, '#1A1A22', 0);
          break;
        }
        case 'druid': {
          disc(ctx, x, y, r, tm.c, 3); disc(ctx, x - fx * 2, y - fy * 2, r * 0.58, '#6B4A2E', 2);
          ctx.beginPath();
          for (const sd of [-1, 1]) { ctx.moveTo(...P(0, sd * r * 0.3)); ctx.lineTo(...P(-r * 0.3, sd * r * 0.95)); ctx.moveTo(...P(-r * 0.15, sd * r * 0.62)); ctx.lineTo(...P(r * 0.2, sd * r * 0.8)); }
          ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#D9C9A8'; ctx.stroke();
          const [sx, sy] = P(0, r * 0.65), ex = sx + fx * (r + 10), ey = sy + fy * (r + 10);
          stick(ctx, sx, sy, ex, ey, 3, '#7A5230'); disc(ctx, ex, ey, 4.5, '#5BD16A', 1.5);
          if (u.healFx > 0) { ctx.beginPath(); ctx.arc(x, y, U.healRange * (1 - u.healFx * 0.6), 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(124,255,176,${u.healFx * 0.6})`; ctx.stroke(); }
          break;
        }
        case 'treant': {
          ctx.beginPath();
          for (const sd of [-1, 1]) { const a = f + sd * (0.8 - (sd > 0 ? lg : 0) * 0.6), bx = x + Math.cos(f + sd * 1.2) * r * 0.7, by = y + Math.sin(f + sd * 1.2) * r * 0.7; ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a) * r * 0.75, by + Math.sin(a) * r * 0.75); }
          ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#6B4A2E'; ctx.stroke();
          // a leafy crown of clumps (one shape), with a ring of the team colour through it
          ctx.beginPath();
          for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + 0.4, bx = x + Math.cos(a) * r * 0.45, by = y + Math.sin(a) * r * 0.45; ctx.moveTo(bx + r * 0.42, by); ctx.arc(bx, by, r * 0.42, 0, TAU); }
          ctx.fillStyle = '#2F7A3C'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
          disc(ctx, x, y, r * 0.62, '#3E8E4A', 0); ring(r * 0.78, 3, tm.c);
          eyes(x, y, r * 0.25, r * 0.14, 2.2, '#FFD23F');
          break;
        }
        case 'illusionist': {
          disc(ctx, x, y, r, tm.d, 3); disc(ctx, x - fx * 2, y - fy * 2, r * 0.56, '#4C1D95', 2);
          ell(ctx, x + fx * r * 0.2, y + fy * r * 0.2, r * 0.32, r * 0.22, f + Math.PI / 2, '#F4F6FB', 1.5);
          ctx.beginPath(); for (let k = 0; k < 3; k++) { const a = T * 3 + k * TAU / 3, ox2 = x + Math.cos(a) * (r + 6), oy2 = y + Math.sin(a) * (r + 6); ctx.moveTo(ox2 + 3, oy2); ctx.arc(ox2, oy2, 3, 0, TAU); }
          ctx.fillStyle = '#E9D5FF'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke();
          break;
        }
        case 'imp': {
          const fl = Math.sin(T * 18 + u.gait) * 0.35;
          ell(ctx, x + 6, y + 14, r * 0.9, r * 0.6, 0, 'rgba(0,0,0,0.25)', 0);
          for (const sd of [-1, 1]) tri(ctx, ...P(0, sd * r * 0.4), ...P(-r * 0.3, sd * r * (1.6 + fl)), ...P(-r * 0.9, sd * r * (1.1 + fl)), '#5A1414', 2);
          disc(ctx, x, y, r, '#C9302C', 2.5); ring(r - 2, 2.5, tm.c);
          for (const sd of [-1, 1]) tri(ctx, ...P(r * 0.2, sd * r * 0.35), ...P(r * 0.9, sd * r * 0.55), ...P(r * 0.45, sd * r * 0.15), '#2A0A0A', 0);
          break;
        }
        case 'demon': {
          const rage = Math.min(1, this.deaths * 0.005);
          if (rage > 0.1) disc(ctx, x, y, r + 4 + Math.sin(T * 9 + u.gait) * 2, `rgba(255,107,61,${0.15 + 0.25 * rage})`, 0);
          for (const sd of [-1, 1]) { const ext = sd > 0 ? lg * 8 : 0; stick(ctx, ...P(0, sd * r * 0.7), ...P(r * 0.6 + ext, sd * r * 0.75), 4, '#5A1414'); }
          disc(ctx, x, y, r, '#7A1F1F', 3.5); ring(r - 3.5, 3.5, tm.c);
          for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(...P(r * 0.2, sd * r * 0.35)); ctx.quadraticCurveTo(...P(-r * 0.2, sd * r), ...P(-r * 0.6, sd * r * 0.75)); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3.5; ctx.strokeStyle = '#E9E2D0'; ctx.stroke(); }
          eyes(x, y, r * 0.45, r * 0.18, 2.4, '#FFD23F');
          break;
        }
        case 'hellhound': {
          ctx.save(); ctx.translate(x, y); ctx.rotate(u.mface !== undefined ? u.mface : f);
          const ph = T * 14 + u.gait, mv = Math.hypot(u.vx, u.vy) > 12;
          for (const [lx, ly, p] of [[0.5, -0.4, 0], [0.5, 0.4, Math.PI], [-0.5, -0.4, Math.PI], [-0.5, 0.4, 0]]) ell(ctx, r * lx + (mv ? Math.sin(ph + p) * r * 0.2 : 0), r * ly, r * 0.15, r * 0.1, 0, '#0B0A0F', 1.5);
          ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(-r * 1.4, Math.sin(ph * 0.5) * r * 0.25); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#FF6B3D'; ctx.stroke();
          ell(ctx, 0, 0, r * 1.05, r * 0.5, 0, '#2A1414', 2.5);
          for (let k = 0; k < 4; k++) { const fl = 0.6 + 0.4 * Math.sin(T * 16 + k + u.gait); disc(ctx, r * (0.5 - k * 0.3), 0, r * 0.22 * fl, k % 2 ? '#FF9F1C' : '#E5484D', 0); }
          tri(ctx, r * 0.7, -r * 0.3, r * 1.45, 0, r * 0.7, r * 0.3, '#2A1414', 2);
          ctx.fillStyle = '#FFD23F'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(r * 1.05, sd * r * 0.13, 2.2, 0, TAU); ctx.fill(); }
          ctx.beginPath(); ctx.arc(r * 0.55, 0, r * 0.32, -1.2, 1.2); ctx.lineWidth = 3; ctx.strokeStyle = tm.c; ctx.stroke();
          ctx.restore();
          break;
        }
        case 'warlock': {
          disc(ctx, x, y, r, tm.d, 3); disc(ctx, x - fx * 2, y - fy * 2, r * 0.58, '#2A0A12', 2);
          for (const sd of [-1, 1]) stick(ctx, ...P(0, sd * r * 0.3), ...P(-r * 0.35, sd * r * 0.75), 2, '#E9E2D0');
          const [sx, sy] = P(0, r * 0.6), ex = sx + fx * (r + 12), ey = sy + fy * (r + 12), m = u.muzzle || 0;
          stick(ctx, sx, sy, ex, ey, 3, '#2A2018');
          disc(ctx, ex, ey, 6 + 4 * m, `rgba(255,90,40,${0.6 + 0.4 * m})`, 1.5);
          break;
        }
        case 'dwarf': {
          const a = f + 0.9 - lg * 1.3, bx = x + Math.cos(f + 1.1) * r * 0.7, by = y + Math.sin(f + 1.1) * r * 0.7, hx = bx + Math.cos(a) * 17, hy = by + Math.sin(a) * 17;
          stick(ctx, bx, by, hx, hy, 3, COL.wood);
          ctx.beginPath(); ctx.arc(hx, hy, 7, a - Math.PI / 2 + 0.3, a + Math.PI / 2 - 0.3, true); ctx.closePath(); ctx.fillStyle = COL.steel; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
          disc(ctx, x, y, r, tm.c, 3);
          tri(ctx, ...P(r * 0.2, r * 0.45), ...P(r + 7, 0), ...P(r * 0.2, -r * 0.45), '#D9822B', 2);
          disc(ctx, x - fx * 2, y - fy * 2, r * 0.5, '#AEB6C6', 2);
          for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(...P(-2, sd * r * 0.4)); ctx.quadraticCurveTo(...P(0, sd * r * 0.85), ...P(r * 0.3, sd * r * 0.8)); ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#F4F1E6'; ctx.stroke(); }
          break;
        }
        case 'engineer': {
          disc(ctx, ...P(-r * 0.7, 0), r * 0.5, tm.d, 2);
          const a = f + 0.8 - lg * 1.2, [bx, by] = P(r * 0.3, r * 0.75);
          stick(ctx, bx, by, bx + Math.cos(a) * 14, by + Math.sin(a) * 14, 3, '#9AA3B0');
          disc(ctx, x, y, r, tm.c, 3);
          for (const sd of [-1, 1]) tri(ctx, ...P(0, sd * r * 0.4), ...P(-4, sd * (r + 8)), ...P(-r * 0.4, sd * r * 0.3), '#7DB04B');
          disc(ctx, x, y, r * 0.55, '#7DB04B', 2);
          for (const sd of [-1, 1]) disc(ctx, ...P(r * 0.3, sd * r * 0.2), 2.8, '#8FE3FF', 1.2);
          break;
        }
        case 'turret': {
          for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + 0.5; stick(ctx, x, y, x + Math.cos(a) * r * 1.05, y + Math.sin(a) * r * 1.05, 2, '#4A3420'); }
          roundRect(ctx, x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4, 4); ctx.fillStyle = tm.d; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
          const [ex, ey] = P(r + 6, 0);
          stick(ctx, x - fx * 4, y - fy * 4, ex, ey, 4, COL.wood);
          ctx.beginPath(); ctx.moveTo(ex - fx * 4 + px * 10, ey - fy * 4 + py * 10); ctx.lineTo(ex, ey); ctx.lineTo(ex - fx * 4 - px * 10, ey - fy * 4 - py * 10); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = COL.steel; ctx.stroke();
          disc(ctx, x, y, 3, tm.l, 1.5);
          break;
        }
        case 'golem': {
          for (const sd of [-1, 1]) disc(ctx, ...P(r * 0.2 + (sd > 0 ? lg * 10 : 0), sd * r * 0.9), r * 0.36, '#7A7F88', 3);
          ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = f + k / 8 * TAU + Math.PI / 8, rr = r * (k % 2 ? 0.95 : 1); if (k) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
          ctx.closePath(); ctx.fillStyle = '#8A8F98'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
          ctx.lineWidth = 2; ctx.strokeStyle = '#5B6068'; ctx.beginPath(); ctx.moveTo(...P(0, -r * 0.5)); ctx.lineTo(...P(r * 0.1, 0)); ctx.lineTo(...P(-r * 0.4, r * 0.3)); ctx.stroke();
          const gl = 0.6 + 0.4 * Math.sin(T * 3 + u.gait);
          disc(ctx, x, y, r * 0.28, rgba(tm.c, 0.5 + 0.5 * gl), 2.5);
          eyes(x, y, r * 0.62, r * 0.18, 3, `rgba(124,243,255,${gl})`);
          break;
        }
        case 'hydra': {
          const n = u.heads || 3, bites = u.biteT !== undefined && this.fightT - u.biteT < 0.25 ? u.bites : null;
          ctx.beginPath(); ctx.moveTo(...P(-r * 0.7, 0)); ctx.quadraticCurveTo(...P(-r * 1.3, Math.sin(T * 3 + u.gait) * r * 0.4), ...P(-r * 1.7, Math.sin(T * 3 + u.gait + 1) * r * 0.5)); ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 8; ctx.strokeStyle = tm.d; ctx.stroke();
          disc(ctx, x, y, r, tm.d, 4);
          ctx.fillStyle = rgba(tm.l, 0.35); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + u.gait; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.16, 0, TAU); ctx.fill(); }
          for (let k = 0; k < n; k++) {
            const off = (k - (n - 1) / 2) * (n > 3 ? 0.4 : 0.5), sway = Math.sin(T * 3 + k * 1.7 + u.gait) * 0.12;
            let hx = x + Math.cos(f + off + sway) * (r + 26), hy = y + Math.sin(f + off + sway) * (r + 26);
            const tg = bites && bites[k];
            if (tg && !tg.dead) { const kk = Math.sin(Math.PI * clamp((this.fightT - u.biteT) / 0.25, 0, 1)); hx += (tg.x - hx) * 0.5 * kk; hy += (tg.y - hy) * 0.5 * kk; }
            const bx = x + Math.cos(f + off * 0.6) * r * 0.6, by = y + Math.sin(f + off * 0.6) * r * 0.6;
            ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo((bx + hx) / 2 + Math.cos(f + off + 1.57) * 8, (by + hy) / 2 + Math.sin(f + off + 1.57) * 8, hx, hy);
            ctx.lineWidth = 13; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 9; ctx.strokeStyle = tm.c; ctx.stroke();
            const ha = Math.atan2(hy - by, hx - bx);
            ell(ctx, hx, hy, 10, 7, ha, tm.c, 2.5);
            ctx.fillStyle = '#FFD23F'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + Math.cos(ha) * 3 + Math.cos(ha + 1.57) * 4 * sd, hy + Math.sin(ha) * 3 + Math.sin(ha + 1.57) * 4 * sd, 1.8, 0, TAU); ctx.fill(); }
          }
          break;
        }
        case 'titan': {
          // a giant of stone seen from above: broad shoulders with the team's pauldrons, huge arms ending in fists (one slams down on each stomp), a small head with glowing eyes
          const angry = (u.phaseN || 0) >= 2;
          if (angry) disc(ctx, x, y, r + 6 + Math.sin(T * 8) * 3, 'rgba(229,72,77,0.22)', 0);
          for (const sd of [-1, 1]) {
            const [sx, sy] = P(0, sd * r * 0.78), [hx2, hy2] = P(r * 0.55 + (sd > 0 ? lg * 16 : 0), sd * r * 1.02);
            stick(ctx, sx, sy, hx2, hy2, r * 0.32, '#A88E6A');
            disc(ctx, hx2, hy2, r * 0.3, '#9A8468', 3.5);
          }
          ell(ctx, x, y, r * 0.62, r * 0.95, f, '#B8A07A', 5);
          ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(74,58,40,0.55)';
          ctx.beginPath(); ctx.moveTo(...P(-r * 0.35, -r * 0.3)); ctx.lineTo(...P(-r * 0.1, -r * 0.05)); ctx.lineTo(...P(-r * 0.4, r * 0.25)); ctx.stroke();
          stick(ctx, ...P(r * 0.2, -r * 0.75), ...P(-r * 0.35, r * 0.7), 7, tm.c);
          for (const sd of [-1, 1]) ell(ctx, ...P(0, sd * r * 0.8), r * 0.3, r * 0.22, f, tm.d, 3);
          const [hx, hy] = P(r * 0.42, 0);
          disc(ctx, hx, hy, r * 0.26, '#C9B48E', 3.5); eyes(hx, hy, r * 0.12, r * 0.1, r * 0.055, angry ? '#FF4D4D' : '#7CF3FF');
          if (u.ancient) ring(r + 4, 3, 'rgba(168,85,247,0.8)');
          break;
        }
        case 'phoenix': {
          if (u.ashT) { disc(ctx, x, y, r * 0.7, '#4A4E58', 3); for (let k = 0; k < 5; k++) { const a = k * 1.3 + u.gait; disc(ctx, x + Math.cos(a) * r * 0.35, y + Math.sin(a) * r * 0.35, 3 + 2 * Math.sin(T * 6 + k), '#FF9F1C', 0); } break; }
          const fl = 0.75 + 0.25 * Math.sin(T * 7 + u.gait);
          ell(ctx, x + 10, y + 26, r * 1.2, r * 0.6, f, 'rgba(0,0,0,0.25)', 0);
          ctx.save(); ctx.translate(x, y); ctx.rotate(f);
          for (const sd of [-1, 1]) for (const [c, s] of [['#E5484D', 1], ['#FF9F1C', 0.8], ['#FFD23F', 0.55]]) {
            ctx.beginPath(); ctx.moveTo(r * 0.3, sd * r * 0.2); ctx.quadraticCurveTo(r * 0.2, sd * r * 1.9 * fl * s, -r * 0.7 * s, sd * r * 1.6 * fl * s); ctx.quadraticCurveTo(-r * 0.3, sd * r * 0.8 * s, -r * 0.4, sd * r * 0.2); ctx.closePath();
            ctx.fillStyle = c; ctx.fill(); if (s === 1) { ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); }
          }
          for (const o of [-0.25, 0, 0.25]) { ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.quadraticCurveTo(-r * 1.2, o * r, -r * 1.7, o * r * 2.2 + Math.sin(T * 5 + o * 9) * r * 0.15); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#FF9F1C'; ctx.stroke(); }
          ell(ctx, 0, 0, r * 0.6, r * 0.35, 0, '#FF6B3D', 3); ell(ctx, 0, 0, r * 0.38, r * 0.18, 0, tm.c, 2);
          disc(ctx, r * 0.65, 0, r * 0.25, '#FFB020', 2.5); tri(ctx, r * 0.85, -r * 0.08, r * 1.05, 0, r * 0.85, r * 0.08, '#FFE27A');
          ctx.restore();
          break;
        }
        case 'fortress': {
          ctx.save(); ctx.translate(x, y); ctx.rotate(f);
          const st = Math.hypot(u.vx, u.vy) > 4 ? Math.sin(T * 4 + u.gait) * r * 0.12 : 0;
          for (const [lx, ly, p] of [[0.6, -0.8, 1], [0.6, 0.8, -1], [-0.6, -0.8, -1], [-0.6, 0.8, 1]]) ell(ctx, r * lx + st * p, r * ly, r * 0.2, r * 0.13, 0, '#5B6068', 2.5);
          roundRect(ctx, -r * 0.78, -r * 0.78, r * 1.56, r * 1.56, 6); ctx.fillStyle = '#9AA0AA'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
          ctx.setLineDash([7, 5]); roundRect(ctx, -r * 0.66, -r * 0.66, r * 1.32, r * 1.32, 4); ctx.lineWidth = 3; ctx.strokeStyle = '#6E737C'; ctx.stroke(); ctx.setLineDash([]);
          roundRect(ctx, -r * 0.42, -r * 0.42, r * 0.84, r * 0.84, 4); ctx.fillStyle = '#B5BAC3'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
          for (const [tx, ty] of [[0.78, 0.78], [0.78, -0.78], [-0.78, 0.78], [-0.78, -0.78]]) { disc(ctx, r * tx, r * ty, r * 0.24, '#8A909A', 3); disc(ctx, r * tx, r * ty, r * 0.11, tm.c, 1.5); }
          roundRect(ctx, r * 0.62, -r * 0.18, r * 0.2, r * 0.36, 3); ctx.fillStyle = '#4A3420'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
          const rec = (u.muzzle || 0) * 5; stick(ctx, r * 0.7 - rec, 0, r * 1.05 - rec, 0, 6, '#2B2F36');
          for (const [ax, ay] of [[0.2, -0.6], [-0.2, -0.6], [0.2, 0.6], [-0.2, 0.6], [-0.6, 0]]) disc(ctx, r * ax, r * ay, 4.5, tm.d, 1.5);
          disc(ctx, 0, 0, r * 0.16, tm.c, 2);
          ctx.restore();
          break;
        }
        case 'griffin': {
          stick(ctx, cx + px * r * 0.35, cy + py * r * 0.35, cx + px * r * 0.35 + fx * (r * 0.9 + lg * 8), cy + py * r * 0.35 + fy * (r * 0.9 + lg * 8), 2.5, COL.wood);
          disc(ctx, cx, cy, r * 0.42, tm.c, 2.5); disc(ctx, cx, cy, r * 0.26, '#D9DEE6', 2);
          break;
        }
        case 'mirrorknight': {
          disc(ctx, x, y, r, '#C9D1DC', 3.5); ring(r - 4, 3, tm.c);
          ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.5, Math.PI * 1.05, Math.PI * 1.45); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
          const [sx, sy] = P(r * 0.85, 0);
          ell(ctx, sx, sy, 5, r * 0.85, f, '#BFE6FF', 2.5);
          ctx.beginPath(); ctx.moveTo(sx - px * r * 0.5, sy - py * r * 0.5); ctx.lineTo(sx + px * r * 0.2, sy + py * r * 0.2); ctx.lineWidth = 1.5; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
          break;
        }
        case 'phasereaper': {
          ctx.beginPath();
          for (let k = 0; k < 12; k++) { const a = f + k / 12 * TAU, rr = r * (k % 2 ? 1.12 : 0.88) + (k % 2 ? Math.sin(T * 9 + k) * 1.5 : 0); if (k) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
          ctx.closePath(); ctx.fillStyle = '#1E1B2E'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
          ring(r * 0.7, 2.5, tm.c);
          const a = f + 0.8 - lg * 1.5, bx = x + Math.cos(f + 1.1) * r * 0.7, by = y + Math.sin(f + 1.1) * r * 0.7, ex = bx + Math.cos(a) * (r + 14), ey = by + Math.sin(a) * (r + 14);
          stick(ctx, bx, by, ex, ey, 2.5, '#4A4038');
          ctx.beginPath(); ctx.moveTo(ex, ey); ctx.quadraticCurveTo(ex + Math.cos(a - 1.4) * 14, ey + Math.sin(a - 1.4) * 14, ex + Math.cos(a - 2.6) * 16, ey + Math.sin(a - 2.6) * 16);
          ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#D9DEE6'; ctx.stroke();
          eyes(x, y, r * 0.3, r * 0.16, 2.2, '#A78BFA');
          break;
        }
        case 'alchemist': {
          disc(ctx, x, y, r, tm.c, 3);
          ctx.beginPath(); ctx.arc(x, y, r * 0.7, f - 0.9, f + 0.9); ctx.lineWidth = 4; ctx.strokeStyle = '#6B4A2E'; ctx.stroke();
          disc(ctx, x - fx * 2, y - fy * 2, r * 0.5, '#3A2A1A', 2);
          for (const sd of [-1, 1]) disc(ctx, ...P(r * 0.15, sd * r * 0.18), 2.6, '#8FE3FF', 1.2);
          const [hx, hy] = P(r + 2, r * 0.55);
          disc(ctx, hx, hy, 5, '#7CFF6B', 2); disc(ctx, hx + fx * 2, hy + fy * 2, 2, '#D9FFD0', 0);
          break;
        }
        case 'gravitymonk': {
          disc(ctx, x, y, r, '#E07A1F', 3); ring(r - 2.5, 2.5, tm.c);
          disc(ctx, x, y, r * 0.5, '#E8C39E', 2);
          for (let k = 0; k < 3; k++) { const a = T * 2.4 + k * TAU / 3 + u.gait, d = r + 7 + 3 * Math.sin(T * 3 + k); disc(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, 3.2, '#8A8F98', 1.5); }
          if (u.muzzle > 0) ring(r + 10 + (1 - u.muzzle) * 20, 3, `rgba(168,85,247,${u.muzzle})`);
          break;
        }
        case 'soulsmith': {
          const a = f + 0.9 - lg * 1.4, [bx, by] = P(r * 0.3, r * 0.7), hx = bx + Math.cos(a) * 15, hy = by + Math.sin(a) * 15;
          stick(ctx, bx, by, hx, hy, 3, COL.wood);
          ctx.save(); ctx.translate(hx, hy); ctx.rotate(a); roundRect(ctx, -4, -7, 8, 14, 2); ctx.fillStyle = '#5B6472'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
          disc(ctx, x, y, r, tm.d, 3);
          ctx.beginPath(); ctx.arc(x, y, r * 0.75, f - 1, f + 1); ctx.lineWidth = 4; ctx.strokeStyle = '#4A3420'; ctx.stroke();
          disc(ctx, x - fx * 1.5, y - fy * 1.5, r * 0.48, '#3A3F4B', 2);
          for (let k = 0; k < (u.souls || 0); k++) { const ang = T * 3 + k * TAU / 4; disc(ctx, x + Math.cos(ang) * (r + 6), y + Math.sin(ang) * (r + 6), 3, '#7CF3FF', 1); }
          break;
        }
        case 'falsesoldier': {
          // looks exactly like an ordinary soldier
          disc(ctx, x, y, r, tm.c, 3);
          if (tm.a) ring(r - 4, 2.5, tm.a);
          break;
        }
        case 'turtle': {
          const pl = !!u.planted;
          if (!pl) {
            const ph = T * 6 + u.gait, mv = Math.hypot(u.vx, u.vy) > 4;
            for (const [lx, ly, p] of [[0.55, -0.7, 0], [0.55, 0.7, Math.PI], [-0.55, -0.7, Math.PI], [-0.55, 0.7, 0]]) { const s = mv ? Math.sin(ph + p) * 3 : 0; disc(ctx, ...P(r * lx + s, r * ly), r * 0.2, '#6E8F60', 2); }
            disc(ctx, ...P(r * 0.95, 0), r * 0.28, '#7DA06E', 2.5);
          }
          disc(ctx, x, y, r * (pl ? 0.95 : 0.88), tm.d, 4);
          ctx.lineWidth = 2; ctx.strokeStyle = rgba(tm.l, 0.8);
          const hex = (hx, hy, s) => { ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; if (k) ctx.lineTo(hx + Math.cos(a) * s, hy + Math.sin(a) * s); else ctx.moveTo(hx + Math.cos(a) * s, hy + Math.sin(a) * s); } ctx.closePath(); ctx.stroke(); };
          hex(x, y, r * 0.3); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + Math.PI / 6; hex(x + Math.cos(a) * r * 0.58, y + Math.sin(a) * r * 0.58, r * 0.2); }
          if (pl) for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; tri(ctx, x + Math.cos(a - 0.12) * r * 0.92, y + Math.sin(a - 0.12) * r * 0.92, x + Math.cos(a) * (r + 7), y + Math.sin(a) * (r + 7), x + Math.cos(a + 0.12) * r * 0.92, y + Math.sin(a + 0.12) * r * 0.92, '#E9E2D0'); }
          break;
        }
        case 'decoy': {
          ctx.globalAlpha *= clamp((u.decoyEnd - this.fightT) / 0.6, 0, 1);
          if (u.look === 'scarecrow') {
            stick(ctx, ...P(0, -r * 1.2), ...P(0, r * 1.2), 3, COL.wood);
            disc(ctx, x, y, r * 0.8, '#C2A878', 2.5); disc(ctx, x, y, r * 0.55, '#E9C46A', 2); disc(ctx, x, y, r * 0.3, '#B5893A', 1.5);
          } else { disc(ctx, x, y, r, tm.c, 3); ring(r + 2 + Math.sin(T * 8 + u.gait) * 1.5, 2, 'rgba(192,132,252,0.7)'); }
          break;
        }
        case 'thousandman': {
          const b = u.bodies || [], arms = 2 + Math.min(6, Math.floor(b.length / 3));
          for (let k = 0; k < arms; k++) {
            const a = f + (k - (arms - 1) / 2) * (2.6 / Math.max(1, arms - 1)) + Math.sin(T * 5 + k * 1.3) * 0.15 - (k % 2 ? lg * 0.4 : 0), bx = x + Math.cos(a) * r * 0.8, by = y + Math.sin(a) * r * 0.8;
            stick(ctx, bx, by, bx + Math.cos(a) * r * 0.55, by + Math.sin(a) * r * 0.55, 4, '#C98B7A'); disc(ctx, bx + Math.cos(a) * r * 0.6, by + Math.sin(a) * r * 0.6, 4, '#C98B7A', 1.5);
          }
          disc(ctx, x, y, r, tm.d, 4);
          b.forEach((c, i) => { const a = i * 2.39996 + u.gait, d = r * (0.5 + 0.3 * ((i * 7) % 5) / 5); disc(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, 5.5, c, 1.5); });
          const [hx, hy] = P(r * 0.3, 0), hr = Math.max(7, r * 0.28);
          disc(ctx, hx, hy, hr, '#C98B7A', 2.5); eyes(hx, hy, hr * 0.35, hr * 0.38, 2, '#1A1A22');
          break;
        }
        case 'copycat': {
          disc(ctx, x, y, r, '#8E7CC3', 3); ring(r - 2.5, 3, tm.c);
          ell(ctx, x + fx * r * 0.2, y + fy * r * 0.2, r * 0.42, r * 0.3, f + Math.PI / 2, '#F4F6FB', 1.5);
          eyes(x, y, r * 0.3, r * 0.15, 1.8, INK);
          break;
        }
        case 'immortal': {
          if (u.lives === 0) disc(ctx, x, y, r + 6 + Math.sin(T * 8) * 2, 'rgba(229,72,77,0.22)', 0);
          const a = f + 0.75 - lg * 1.3, [bx, by] = P(r * 0.3, r * 0.75);
          stick(ctx, bx, by, bx + Math.cos(a) * 24, by + Math.sin(a) * 24, 3.5, COL.gold);
          disc(ctx, x, y, r, '#E3B341', 3.5); ring(r - 4, 3.5, tm.c);
          disc(ctx, x, y, r * 0.5, '#F4D16B', 2);
          ctx.beginPath(); ctx.arc(x + fx * r * 0.05, y + fy * r * 0.05, r * 0.28, f - 0.6, f + 0.6); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
          ctx.beginPath(); ctx.ellipse(x, y - r - 6 + Math.sin(T * 4) * 1.5, r * 0.55, 4, 0, 0, TAU); ctx.lineWidth = 2.5; ctx.strokeStyle = u.lives > 0 ? 'rgba(255,226,122,0.9)' : 'rgba(229,72,77,0.9)'; ctx.stroke();
          for (let k = 0; k < (u.lives || 0); k++) disc(ctx, x - 9 + k * 6, y + r + 7, 2.2, COL.gold, 1);
          break;
        }
        case 'mirrorking': {
          for (let k = 0; k < 5; k++) { const a = T * 1.5 + k * TAU / 5 + u.gait, d = r + 10; ctx.save(); ctx.translate(x + Math.cos(a) * d, y + Math.sin(a) * d); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 0); ctx.lineTo(0, 6); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fillStyle = '#DCEBFA'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); }
          for (let k = -2; k <= 2; k++) { const a = f + Math.PI + k * 0.38; disc(ctx, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * 0.3, '#BFE6FF', 2); }
          disc(ctx, x, y, r, '#C9D1DC', 4); ring(r - 5, 4, tm.c);
          ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = f + k / 10 * TAU, rr = k % 2 ? r * 0.3 : r * 0.48; if (k) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
          ctx.closePath(); ctx.fillStyle = COL.gold; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
          break;
        }
        case 'unmaker': {
          const bob = Math.sin(T * 2.5 + u.gait) * 3, ey = y + bob;
          ell(ctx, x + 10, y + 30, r * 0.9, r * 0.55, 0, 'rgba(0,0,0,0.25)', 0);
          for (let k = 0; k < 6; k++) {
            const a = f + Math.PI + (k - 2.5) * 0.45, w = Math.sin(T * 4 + k) * 0.25;
            ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.7, ey + Math.sin(a) * r * 0.7); ctx.quadraticCurveTo(x + Math.cos(a + w) * r * 1.3, ey + Math.sin(a + w) * r * 1.3, x + Math.cos(a - w) * r * 1.7, ey + Math.sin(a - w) * r * 1.7);
            ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#5B2A86'; ctx.stroke();
          }
          disc(ctx, x, ey, r, '#3B1F5B', 4); disc(ctx, x, ey, r * 0.8, '#F4F6FB', 2.5);
          const lx = x + fx * r * 0.28, ly = ey + fy * r * 0.28;
          disc(ctx, lx, ly, r * 0.38, tm.c, 2.5); disc(ctx, lx + fx * r * 0.06, ly + fy * r * 0.06, r * 0.17 + (u.muzzle || 0) * 3, '#0B0C0F', 0);
          disc(ctx, lx - r * 0.1, ly - r * 0.1, r * 0.07, '#FFFFFF', 0);
          break;
        }
        case 'billionaire': {
          disc(ctx, x, y, r, '#E3B341', 3);
          tri(ctx, ...P(r * 0.2, 0), ...P(r * 0.9, 3), ...P(r * 0.9, -3), tm.c);
          disc(ctx, x - fx * 2, y - fy * 2, r * 0.75, '#15171C', 2); disc(ctx, x - fx * 2, y - fy * 2, r * 0.48, '#22252B', 2);
          ctx.beginPath(); ctx.arc(x - fx * 2, y - fy * 2, r * 0.48, 0, TAU); ctx.lineWidth = 2.5; ctx.strokeStyle = tm.c; ctx.stroke();
          const [bx, by] = P(0, r + 4);
          disc(ctx, bx, by, 7.5, '#C9A36A', 2);
          ctx.fillStyle = '#1F6F2A'; ctx.font = font(11, 800, false); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', bx, by + 1); ctx.textBaseline = 'alphabetic';
          break;
        }
        case 'gravitytyrant': {
          for (let k = 0; k < 5; k++) { const a = T * (1.4 + k * 0.1) + k * TAU / 5, d = r + 14 + 6 * Math.sin(T * 2 + k); disc(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, 4 + (k % 3), '#6B7280', 1.5); }
          ring(r + 5, 3, `rgba(168,85,247,${0.3 + 0.2 * Math.sin(T * 4)})`);
          for (const sd of [-1, 1]) disc(ctx, ...P(sd > 0 ? lg * 10 : 0, sd * r * 0.85), r * 0.3, '#3B2F55', 3);
          disc(ctx, x, y, r, '#2B2140', 4); ring(r - 5, 3.5, tm.c);
          disc(ctx, x, y, r * 0.3, `rgba(192,132,252,${0.6 + 0.4 * Math.sin(T * 5)})`, 2.5);
          disc(ctx, ...P(r * 0.55, 0), r * 0.26, '#3B2F55', 2.5);
          break;
        }
        case 'meteorshepherd': {
          disc(ctx, x, y, r, tm.c, 3); disc(ctx, x - fx * 2, y - fy * 2, r * 0.58, '#2A2F5A', 2);
          ctx.fillStyle = '#FFE27A'; for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.5; ctx.beginPath(); ctx.arc(x - fx * 2 + Math.cos(a) * r * 0.32, y - fy * 2 + Math.sin(a) * r * 0.32, 1.3, 0, TAU); ctx.fill(); }
          const [sx, sy] = P(0, r * 0.6), top = sy - r - 24;
          ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, top); ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = '#8A6A49'; ctx.stroke();
          ctx.save(); ctx.translate(sx, top); ctx.transform(1, Math.sin(T * 5 + u.gait) * 0.12, 0, 1, 0, 0);
          roundRect(ctx, 0, 0, 24, 18, 2); ctx.fillStyle = '#2A2F5A'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
          star(ctx, 12, 9, 6); ctx.fillStyle = COL.gold; ctx.fill(); ctx.restore();
          const ma = T * 4 + u.gait; disc(ctx, sx + Math.cos(ma) * 12, top + Math.sin(ma) * 12, 4, '#FF8A1F', 1.5);
          break;
        }
        case 'glitch': {
          const j = Math.floor(T * 20 + u.gait * 10), jx = ((j * 7919) % 7) - 3, jy = ((j * 104729) % 5) - 2;
          disc(ctx, x + jx - 3, y + jy, r, 'rgba(255,40,80,0.55)', 0); disc(ctx, x + jx + 3, y + jy, r, 'rgba(40,220,255,0.55)', 0);
          disc(ctx, x, y, r, tm.c, 3);
          ctx.fillStyle = '#0B0C0F'; for (let k = 0; k < 4; k++) { const h1 = ((j + 1) * (k + 3) * 2654435761) >>> 0; ctx.fillRect(x - r * 0.6 + (h1 % 13), y - r * 0.5 + ((h1 >>> 4) % 11), 4 + ((h1 >>> 8) % 6), 3); }
          ctx.fillStyle = '#7CF3FF'; ctx.fillRect(x + fx * r * 0.3 - 3, y + fy * r * 0.3 - 2, 6, 4);
          break;
        }
        default: this.drawRoster2(ctx, u, x, y, tm);
      }
    },
    // a troop turned into a sheep
    drawSheep(ctx, u, x, y, tm) {
      const r = clamp(u.r, 10, 16), f = u.face, fx = Math.cos(f), fy = Math.sin(f);
      disc(ctx, x, y, r, '#F4F6FB', 2.5);
      for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + 0.3; disc(ctx, x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85, r * 0.38, '#F4F6FB', 2); }
      disc(ctx, x, y, r * 0.9, '#F4F6FB', 0);
      disc(ctx, x + fx * r * 0.95, y + fy * r * 0.95, r * 0.4, '#2A2F3A', 2);
      ctx.beginPath(); ctx.arc(x + fx * r * 0.5, y + fy * r * 0.5, r * 0.45, f + 1.9, f + 4.4); ctx.lineWidth = 3; ctx.strokeStyle = tm.c; ctx.stroke();
    },
    // statuses, ranks and titles drawn over a troop
    drawStatus(ctx, u, x, y, tm) {
      const T = this.fightT, t = this.t, U = UNIT[u.type], r = u.r;
      if (u.burnT > T && !U.fireproof) for (let k = 0; k < 3; k++) { const a = t * 9 + k * 2.1 + u.gait, fl = 0.6 + 0.4 * Math.sin(t * 17 + k), bx = x + Math.cos(a) * r * 0.6, by = y - r * 0.2 + Math.sin(a) * r * 0.4; disc(ctx, bx, by, 4.5 * fl + 1.5, 'rgba(255,140,40,0.85)', 0); disc(ctx, bx, by - 2, 2.2 * fl, '#FFE27A', 0); }
      if (u.poisT > T) { ctx.fillStyle = 'rgba(124,255,107,0.75)'; for (let k = 0; k < 3; k++) { const p = (t * 1.4 + k / 3 + u.gait) % 1; ctx.beginPath(); ctx.arc(x + Math.sin(k * 2.3 + u.gait) * r * 0.6, y - r * 0.2 - p * r * 1.2, 2.5 * (1 - p) + 1, 0, TAU); ctx.fill(); } }
      if (u.slowT > T && u.slowK < 0.75) { ctx.beginPath(); ctx.arc(x, y, r + 3, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(160,220,255,0.75)'; ctx.stroke(); }
      if (u.frozeT > T) { roundRect(ctx, x - r - 4, y - r - 4, (r + 4) * 2, (r + 4) * 2, 5); ctx.fillStyle = 'rgba(191,230,255,0.45)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(230,246,255,0.95)'; ctx.stroke(); }
      if (u.planted) { ctx.beginPath(); ctx.arc(x, y, r + u.shell, 0, TAU); ctx.fillStyle = 'rgba(124,200,255,0.08)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(160,220,255,0.45)'; ctx.stroke(); }
      if (u.tileT > T) { ctx.beginPath(); ctx.arc(x, y, r + 3, 0, TAU); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,210,63,0.8)'; ctx.stroke(); }
      if (u.forged) { ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(124,243,255,0.85)'; ctx.stroke(); }
      if (u.mimic || u.mirror) { ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(x, y, r + 3, t * 2, t * 2 + TAU); ctx.lineWidth = 2.5; ctx.strokeStyle = u.mimic === 'copy' ? 'rgba(192,132,252,0.9)' : 'rgba(220,235,250,0.95)'; ctx.stroke(); ctx.setLineDash([]); }
      if (u.possessed) { ctx.beginPath(); ctx.arc(x, y, r + 4 + Math.sin(t * 6) * 1.5, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(168,85,247,0.75)'; ctx.stroke(); }
      if (u.bribed !== undefined && T - u.bribed < 1.5) { ctx.beginPath(); ctx.arc(x, y, r + 4, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,210,63,${1 - (T - u.bribed) / 1.5})`; ctx.stroke(); }
      if (u.confT > T) { ctx.font = font(18, 800, false); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; strokeText(ctx, '?', x - r * 0.6, y - r - 6, '#C084FC', COL.ink, 5); }
      if (u.panicT > T || (this.panic[u.team] > T && !(u.crownT > T))) { ctx.font = font(20, 800, false); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; strokeText(ctx, '!', x + r * 0.7, y - r - 6, '#FFFFFF', COL.ink, 5); }
      if (u.mut === 'wings') for (const sd of [-1, 1]) { const fx = Math.cos(u.face), fy = Math.sin(u.face), px = -fy * sd, py = fx * sd, fl = 0.8 + 0.2 * Math.sin(t * 10 + u.gait); tri(ctx, x + px * r * 0.6 - fx * r * 0.2, y + py * r * 0.6 - fy * r * 0.2, x + px * r * 1.6 * fl - fx * r * 0.8, y + py * r * 1.6 * fl - fy * r * 0.8, x + px * r * 0.7 - fx * r * 0.9, y + py * r * 0.7 - fy * r * 0.9, 'rgba(244,246,251,0.9)'); }
      if (u.trait) {
        const ix = x - r * 0.75, iy = y + r * 0.75;
        if (u.trait === 'explosive') { disc(ctx, ix, iy, 3.5, '#2B2F36', 1.2); stick(ctx, ix + 2, iy - 2, ix + 4, iy - 5, 1, '#FF9F1C'); }
        else if (u.trait === 'vampiric') { tri(ctx, ix - 3, iy - 2, ix - 1.5, iy + 3, ix, iy - 2, '#F4F6FB', 1); tri(ctx, ix, iy - 2, ix + 1.5, iy + 3, ix + 3, iy - 2, '#F4F6FB', 1); }
        else if (u.trait === 'undying' && !u.undyingUsed) { ctx.beginPath(); ctx.ellipse(x, y - r - 3, r * 0.45, 2.5, 0, 0, TAU); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,226,122,0.9)'; ctx.stroke(); }
        else if (u.trait === 'coward') disc(ctx, ix, iy, 2.8, '#7CC8FF', 1);
      }
      if (u.armed) { const ax = x + r * 0.8, ay = y + r * 0.6; stick(ctx, ax - 3, ay + 3, ax + 4, ay - 4, 1.5, COL.gold); }
      if (u.crownT > T) {
        ctx.save(); ctx.translate(x, y - r - 12 - 2 * Math.sin(t * 5)); ctx.scale(0.75, 0.75);
        ctx.beginPath(); ctx.moveTo(-13, 6); ctx.lineTo(-13, -8); ctx.lineTo(-6, -1); ctx.lineTo(0, -12); ctx.lineTo(6, -1); ctx.lineTo(13, -8); ctx.lineTo(13, 6); ctx.closePath();
        ctx.fillStyle = COL.gold; ctx.fill(); ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = COL.ink; ctx.stroke(); ctx.restore();
        ctx.beginPath(); ctx.arc(x, y, 190, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,210,63,0.18)'; ctx.stroke();
      }
      // evolution: one chevron for veterans, two and a gold ring for elites; slayers get a red-gold ring, God Eaters a golden flame
      if (u.lvl >= 2) {
        ctx.lineWidth = 2.5; ctx.strokeStyle = COL.gold; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let k = 0; k < u.lvl - 1; k++) { const cy2 = y + r + 5 + k * 5; ctx.beginPath(); ctx.moveTo(x - 6, cy2 + 3); ctx.lineTo(x, cy2 - 1); ctx.lineTo(x + 6, cy2 + 3); ctx.stroke(); }
        if (u.lvl >= 3) { ctx.beginPath(); ctx.arc(x, y, r + 2, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,210,63,0.8)'; ctx.stroke(); }
      }
      if (u.slayer && !u.god) { ctx.beginPath(); ctx.arc(x, y, r + 3, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(229,72,77,0.85)'; ctx.stroke(); }
      if (u.god) {
        for (let k = 0; k < 6; k++) { const a = t * 3 + k * TAU / 6, fl = 0.6 + 0.4 * Math.sin(t * 11 + k); disc(ctx, x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 6), 4 * fl + 2, u.cosmic ? 'rgba(167,139,250,0.8)' : 'rgba(255,190,60,0.8)', 0); }
      }
      if (u.champ || u.title) {
        // champions and titled troops carry their name (and kill count) over their head
        const pulse = 0.5 + 0.5 * Math.sin(t * 5 + u.gait);
        if (u.champ) { ctx.beginPath(); ctx.arc(x, y, r + 6 + pulse * 3, 0, TAU); ctx.fillStyle = rgba(tm.c, 0.16); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(255,210,63,${0.5 + 0.4 * pulse})`; ctx.stroke(); }
        const name = u.champ ? `${u.champ} · ${u.kills || 0}` : u.title, hb = HPBAR[u.type] && u.hp < u.max ? 14 : 0;
        ctx.font = font(u.champ ? 20 : 17, 800, false); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        // in a champion duel the bottom champion's name goes under it, so the two names never overlap
        strokeText(ctx, name, x, u.duelist && u.team === 1 ? y + r + 16 : y - r - 14 - hb, u.champ ? COL.gold : '#FFE9A8', COL.ink, 5);
      } else if ((U.boss || u.ancient || U.mythic) && UNIT[u.type].rank === 0) {
        ctx.font = font(16, 800, false); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        strokeText(ctx, u.ancient ? 'ANCIENT HUNTER' : u.asleep ? 'CASTLE' : labelOf(u.type).replace(/^THE /, ''), x, y - r - (u.hp < u.max ? 26 : 12), u.team === MONSTERS ? '#D9F99D' : '#FFFFFF', COL.ink, 5);
      }
      this.drawStatus2(ctx, u, x, y, tm);
      if (u.team === MONSTERS) { ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(x, y, r + 4, 0, TAU); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(190,242,100,0.75)'; ctx.stroke(); ctx.setLineDash([]); }
      ctx.textBaseline = 'alphabetic';
    },
    // projectiles of the new troops
    drawShot(ctx, a, ux, uy) {
      const k = a.kind;
      if (SHOT3[k]) return this.drawShot3(ctx, a, ux, uy);
      const ln = (L1, L2) => { ctx.beginPath(); ctx.moveTo(a.x - ux * L1, a.y - uy * L1); ctx.lineTo(a.x + ux * L2, a.y + uy * L2); ctx.stroke(); };
      ctx.lineCap = 'round';
      if (k === 'firearrow') { ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,140,40,0.45)'; ln(22, 0); ctx.lineWidth = 3; ctx.strokeStyle = COL.steel; ln(16, 3); disc(ctx, a.x, a.y, 3.5, '#FFB020', 0); return; }
      if (k === 'dart') { ctx.lineWidth = 2.5; ctx.strokeStyle = '#7CFF6B'; ln(10, 2); return; }
      if (k === 'soul') { ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(124,255,176,0.4)'; ln(20, 0); ctx.lineWidth = 3; ctx.strokeStyle = '#E8FFF0'; ln(12, 0); return; }
      if (k === 'spark') { disc(ctx, a.x, a.y, 5, 'rgba(192,132,252,0.6)', 0); disc(ctx, a.x, a.y, 2.5, '#FFFFFF', 0); return; }
      if (k === 'firebolt') { disc(ctx, a.x, a.y, 5, 'rgba(255,120,40,0.7)', 0); disc(ctx, a.x, a.y, 2.5, '#FFE27A', 0); return; }
      if (k === 'beam') { ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(192,132,252,0.5)'; ln(40, 0); ctx.lineWidth = 2; ctx.strokeStyle = '#FFFFFF'; ln(30, 0); return; }
      const p = a.t / a.T, hgt = Math.sin(Math.PI * p) * (k === 'boulder' ? 70 : k === 'mortar' ? 120 : 40);
      ell(ctx, a.x, a.y, k === 'boulder' ? 10 : 5, k === 'boulder' ? 6 : 3, 0, 'rgba(0,0,0,0.35)', 0);
      if (k === 'boulder') { disc(ctx, a.x, a.y - hgt, 12, '#8A8F98', 3); disc(ctx, a.x - 3, a.y - hgt - 3, 4, 'rgba(255,255,255,0.2)', 0); }
      else if (k === 'frostbolt') { disc(ctx, a.x, a.y - hgt, 11, 'rgba(160,220,255,0.45)', 0); disc(ctx, a.x, a.y - hgt, 6, '#E6F6FF', 2); }
      else if (k === 'mortar') { disc(ctx, a.x, a.y - hgt, 7, '#2B2F36', 2.5); }
      else if (k === 'flask') { disc(ctx, a.x, a.y - hgt, 6, '#7CFF6B', 2); stick(ctx, a.x, a.y - hgt - 5, a.x, a.y - hgt - 9, 2, '#C9A36A'); }
      else { disc(ctx, a.x, a.y - hgt, 10, 'rgba(255,90,40,0.4)', 0); disc(ctx, a.x, a.y - hgt, 6, '#FF6B3D', 2); }
    },
    // ground effects, under the troops
    drawField(ctx) {
      const T = this.fightT, t = this.t, cx0 = AR.x + AR.w / 2, cy0 = AR.y + AR.h / 2;
      for (const c of this.clouds) {
        const k = clamp((c.end - T) / 0.6, 0, 1) * clamp((T - c.t0) / 0.3, 0, 1);
        for (let i = 0; i < 5; i++) { const a = i * 1.26 + c.t0 + t * 0.3; disc(ctx, c.x + Math.cos(a) * c.r * 0.45, c.y + Math.sin(a) * c.r * 0.45, c.r * 0.55, `rgba(110,200,80,${0.12 * k})`, 0); }
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(150,240,110,${0.35 * k})`; ctx.stroke();
      }
      for (const f of this.fires) {
        const k = clamp((f.end - T) / 0.6, 0, 1);
        disc(ctx, f.x, f.y, f.r, `rgba(255,90,30,${0.1 * k})`, 0);
        for (let i = 0; i < 7; i++) { const a = i * 0.9 + f.t0 * 3, d = f.r * (0.2 + 0.6 * ((i * 37) % 10) / 10), fl = 0.6 + 0.4 * Math.sin(t * 13 + i * 2); disc(ctx, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, (8 + 6 * fl) * Math.min(1, f.r / 60), `rgba(255,${120 + 60 * fl | 0},40,${0.5 * k})`, 0); }
      }
      for (const fl of this.fields) {
        const k = clamp((T - fl.t0) / 0.3, 0, 1), col = fl.kind === 'singularity' ? '167,139,250' : '168,85,247';
        for (let i = 0; i < 3; i++) { const rr = fl.r * (1 - ((t * 1.2 + i / 3) % 1)); ctx.beginPath(); ctx.arc(fl.x, fl.y, Math.max(1, rr), 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${col},${0.5 * k * (rr / fl.r)})`; ctx.stroke(); }
        if (fl.kind === 'singularity') { disc(ctx, fl.x, fl.y, 14 + 6 * Math.sin(t * 9), '#05060A', 3); ctx.beginPath(); ctx.arc(fl.x, fl.y, 22, t * 6, t * 6 + 4); ctx.lineWidth = 4; ctx.strokeStyle = '#A78BFA'; ctx.stroke(); }
      }
      for (const c of this.calls) {
        if (c.kind === 'lightning') continue;
        const k = clamp((T - c.t0) / Math.max(0.01, c.at - c.t0), 0, 1);
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r * (0.4 + 0.6 * k), 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,80,60,${0.3 + 0.5 * k})`; ctx.stroke();
        const mx = c.x + (1 - k) * 160, my = c.y - (1 - k) * 420;
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + 50, my - 120); ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(255,150,40,0.35)'; ctx.stroke();
        disc(ctx, mx, my, 11, '#FF8A1F', 3);
      }
      for (const l of this.loot) {
        const k = clamp((l.end - T) / 0.5, 0, 1); ctx.globalAlpha = k;
        disc(ctx, l.x, l.y, 9, 'rgba(255,210,63,0.18)', 0);
        const ca = Math.cos(l.a), sa = Math.sin(l.a);
        if (l.kind === 'sword') stick(ctx, l.x - ca * 9, l.y - sa * 9, l.x + ca * 9, l.y + sa * 9, 2.5, COL.steel);
        else if (l.kind === 'bow') { ctx.beginPath(); ctx.arc(l.x, l.y, 8, l.a - 1.1, l.a + 1.1); ctx.lineWidth = 4; ctx.strokeStyle = COL.ink; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = '#C79A5B'; ctx.stroke(); }
        else stick(ctx, l.x - ca * 8, l.y - sa * 8, l.x + ca * 8, l.y + sa * 8, 3.5, '#3A3F47');
        ctx.globalAlpha = 1;
      }
      if (this.portal && T < this.portal.end) {
        const p = this.portal, k = Math.max(0, Math.min(1, (T - p.t0) / 0.4, (p.end - T) / 0.5));
        disc(ctx, p.x, p.y, 40 * k, 'rgba(20,6,40,0.8)', 0);
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(p.x, p.y, Math.max(1, (34 + i * 10) * k), Math.max(1, (26 + i * 8) * k), t * (2 + i * 0.5), i, i + 4.4); ctx.lineWidth = 5 - i; ctx.strokeStyle = i % 2 ? '#C084FC' : '#7C3AED'; ctx.stroke(); }
      }
      if (this.ring && this.ring.r) {
        const r = this.ring.r;
        ctx.beginPath(); ctx.rect(AR.x, AR.y, AR.w, AR.h); ctx.arc(cx0, cy0, r, 0, TAU, true); ctx.fillStyle = 'rgba(120,20,10,0.35)'; ctx.fill();
        ctx.beginPath(); ctx.arc(cx0, cy0, r, 0, TAU); ctx.lineWidth = 12; ctx.strokeStyle = '#FF6B3D'; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#FFE27A'; ctx.stroke();
      }
      if (this.lava && this.lava.w > 1) {
        const w = this.lava.w;
        for (const [x0, sgn] of [[AR.x, 1], [AR.x + AR.w, -1]]) {
          ctx.fillStyle = '#C2410C'; ctx.fillRect(sgn > 0 ? x0 : x0 - w, AR.y, w, AR.h);
          ctx.beginPath(); for (let k = 0; k <= 24; k++) { const yy = AR.y + AR.h * k / 24, xx = x0 + sgn * (w + Math.sin(k * 1.7 + t * 3) * 6); if (k) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }
          ctx.lineWidth = 8; ctx.strokeStyle = '#FDBA74'; ctx.stroke();
          for (let k = 0; k < 8; k++) { const yy = AR.y + ((k * 131 + t * 40) % AR.h), xx = x0 + sgn * w * (0.3 + 0.4 * ((k * 7) % 5) / 5); disc(ctx, xx, yy, 4 + 2 * Math.sin(t * 5 + k), '#FDE68A', 0); }
        }
      }
      if (this.mapMech) this.drawMapDyn(ctx);
      this.drawField2(ctx);
    },
    // effects over the troops: beams, freeze, weather, night, glitches
    drawOver(ctx) {
      const T = this.fightT, t = this.t;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const b of this.beams) {
        if (T < b.t0) continue;
        const a = 1 - clamp((T - b.t0) / b.life, 0, 1);
        ctx.beginPath(); ctx.moveTo(b.x0, b.y0);
        if (b.zig) { const n = 6; for (let i = 1; i < n; i++) { const f = i / n, o = (i % 2 ? 1 : -1) * 9; const dx = b.x1 - b.x0, dy = b.y1 - b.y0, L = Math.hypot(dx, dy) || 1; ctx.lineTo(b.x0 + dx * f - dy / L * o, b.y0 + dy * f + dx / L * o); } }
        ctx.lineTo(b.x1, b.y1);
        ctx.lineWidth = (b.w || 4) + 5; ctx.strokeStyle = rgba(b.col, 0.4 * a); ctx.stroke();
        ctx.lineWidth = Math.max(1.5, (b.w || 4) * 0.45); ctx.strokeStyle = `rgba(255,255,255,${0.9 * a})`; ctx.stroke();
      }
      for (const u of this.units) if (u.castOn && !u.castOn.dead) {
        const o = u.castOn, k = clamp(1 - (u.castT - T) / 1.1, 0, 1);
        ctx.beginPath(); ctx.moveTo(u.x, u.y); const n = 8; for (let i = 1; i <= n; i++) { const f = i / n; ctx.lineTo(u.x + (o.x - u.x) * f + Math.sin(t * 20 + i) * 5, u.y + (o.y - u.y) * f + Math.cos(t * 20 + i) * 5); }
        ctx.lineWidth = 4 + 4 * k; ctx.strokeStyle = `rgba(168,85,247,${0.4 + 0.4 * k})`; ctx.stroke();
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r + 6 + 6 * (1 - k), 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(192,132,252,${0.5 + 0.5 * k})`; ctx.stroke();
      }
      if (this.freezeFx > T) { ctx.fillStyle = `rgba(160,220,255,${0.12 * Math.min(1, (this.freezeFx - T) / 0.5)})`; ctx.fillRect(AR.x, AR.y, AR.w, AR.h); }
      if (this.weather === 'fog') {
        ctx.fillStyle = 'rgba(205,214,224,0.16)'; ctx.fillRect(AR.x, AR.y, AR.w, AR.h);
        for (let i = 0; i < 6; i++) { const x = AR.x + ((i * 211 + t * 18) % (AR.w + 300)) - 150, y = AR.y + 120 + i * 140; ell(ctx, x, y, 220, 90, 0, 'rgba(225,232,240,0.13)', 0); }
      } else if (this.weather === 'rain') {
        ctx.fillStyle = 'rgba(20,30,60,0.14)'; ctx.fillRect(AR.x, AR.y, AR.w, AR.h);
        ctx.beginPath(); for (let i = 0; i < 80; i++) { const x = AR.x + ((i * 97.3 + t * 140) % AR.w), y = AR.y + ((i * 53.1 + t * 900) % AR.h); ctx.moveTo(x, y); ctx.lineTo(x - 6, y - 22); }
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(190,215,255,0.45)'; ctx.stroke();
      } else if (this.weather === 'sandstorm') {
        ctx.fillStyle = 'rgba(201,139,85,0.17)'; ctx.fillRect(AR.x, AR.y, AR.w, AR.h);
        ctx.beginPath(); for (let i = 0; i < 50; i++) { const x = AR.x + ((i * 173 + t * 520) % AR.w), y = AR.y + ((i * 61.7) % AR.h); ctx.moveTo(x, y); ctx.lineTo(x - 40, y + 3); }
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(240,200,150,0.4)'; ctx.stroke();
      } else if (this.weather === 'eclipse') { ctx.fillStyle = 'rgba(40,0,12,0.26)'; ctx.fillRect(AR.x, AR.y, AR.w, AR.h); }
      if (this.mod === 'night') { ctx.fillStyle = 'rgba(4,10,32,0.42)'; ctx.fillRect(AR.x, AR.y, AR.w, AR.h); }
      if (this.glitchFx > T) {
        const j = Math.floor(t * 30);
        for (let i = 0; i < 5; i++) { const h1 = ((j + i) * 2654435761) >>> 0, y = AR.y + (h1 % AR.h), hh = 6 + (h1 >>> 10) % 24; ctx.fillStyle = i % 2 ? 'rgba(255,40,80,0.18)' : 'rgba(40,220,255,0.18)'; ctx.fillRect(AR.x, y, AR.w, hh); }
      }
      if (this.diceFx && T - this.diceFx.t0 < 1.2) {
        const d = this.diceFx, k = (T - d.t0) / 1.2, s = 26, x = d.x, y = d.y - 40 - k * 60;
        ctx.globalAlpha = clamp((1 - k) * 2.5, 0, 1);
        ctx.save(); ctx.translate(x, y); ctx.rotate(k * 6);
        roundRect(ctx, -s / 2, -s / 2, s, s, 5); ctx.fillStyle = '#F4F6FB'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = COL.ink; ctx.stroke();
        ctx.fillStyle = COL.ink; for (const [a, b] of [[-6, -6], [6, 6], [0, 0], [6, -6], [-6, 6]]) { ctx.beginPath(); ctx.arc(a, b, 2.2, 0, TAU); ctx.fill(); }
        ctx.restore(); ctx.globalAlpha = 1;
      }
      this.drawOver2(ctx);
    },
    extCosmetic(dt) {
      if (this.skins) this.skinFx(dt);
      for (const u of this.units) {
        const U = UNIT[u.type];
        if (U.mount || u.type === 'hellhound') {
          const v = Math.hypot(u.vx, u.vy), want = v > 15 ? Math.atan2(u.vy, u.vx) : u.face;
          if (u.mface === undefined) u.mface = u.face;
          let df = want - u.mface; df = Math.atan2(Math.sin(df), Math.cos(df));
          u.mface += clamp(df * Math.min(1, dt * 8), -6 * dt, 6 * dt);
        }
        if (u.type === 'phoenix' && !u.ashT && this.FX.chance(dt * 20)) this.parts.push({ x: u.x + this.FX.range(-u.r, u.r), y: u.y + this.FX.range(-u.r, u.r), vx: 0, vy: -30, life: 0.5, age: 0, size: 5, color: this.FX.chance(0.5) ? '#FFD23F' : '#FF9F1C', grav: 0 });
      }
    },
  };
  // ----- maps whose ground does something (rules.maps: godboard, furnace, frozen, grave, overgrown, clockwork, shattered, mirror) -----
  // Every one is the same for both sides (mirrored top to bottom), so no side gets the better ground.
  const MAP_MECH = { godboard: { tiles: 1 }, furnace: { lava: 1 }, frozen: { ice: 1 }, grave: { bones: 1 }, overgrown: { vines: 1 }, clockwork: { gears: 1 }, shattered: { void: 1 }, mirror: { flip: 1 } };
  const XOB = { rook: 1, basalt: 1, icepillar: 1, rib: 1, skull: 1, statue: 1, gear: 1, void: 1, shard: 1, pelvis: 1 };
  const CLOCK_PLATES = [[0, -235, 118], [0, 235, 118], [0, 0, 92]];
  const VINE_ZONES = [[-300, -150, 90], [300, -150, 90], [-300, 150, 90], [300, 150, 90], [0, -330, 80], [0, 330, 80]];
  const THICKETS = [[-150, -40, 60], [150, -40, 60], [-150, 40, 60], [150, 40, 60], [-410, -300, 60], [410, -300, 60], [-410, 300, 60], [410, 300, 60]];
  const ARMY_MAPS = {
    mapInit() {
      const m = this.mapMech, F = this.fixed || this.target;
      if (m.tiles) this.tiles = { next: 4, list: [] };
      if (m.lava) this.rivers = { next: 7, list: [] };
      if (m.ice) { this.iceK = 2.4; this.holes = []; this.cracks2 = new Map(); this.iceAt = 0; }
      if (m.bones) this.bones = { next: 10, warn: null };
      if (m.vines) this.statues = { next: 8, fire: null };
      if (m.gears) this.gears = { dir: 1, flipAt: 0.33 * F, ang: 0 };
      if (m.void) this.fallers = [];
      if (m.flip) this.flips = { next: 10 };
      this.zoneAt = 0;
    },
    mapTick(h) {
      const T = this.fightT, m = this.mapMech, S = this.SR, cx = AR.x + AR.w / 2, cy = AR.y + AR.h / 2;
      if (m.tiles) {
        // the Godboard: every few seconds squares light up; red ones strike with lightning, gold ones make troops stronger
        const tl = this.tiles;
        if (T >= tl.next) {
          tl.next = T + 5;
          const used = new Set();
          for (let k = 0; k < 3; k++) {
            let c, r; do { c = S.int(0, 7); r = S.int(0, 3); } while (used.has(c * 8 + r)); used.add(c * 8 + r);
            const kind = k === 0 || S.chance(0.4) ? 'boost' : 'zap';
            for (const rr of [r, 7 - r]) tl.list.push({ c, r: rr, kind, t0: T, at: T + 1.2, end: kind === 'zap' ? T + 1.5 : T + 5 });
          }
        }
        for (const s of tl.list) {
          const x0 = AR.x + s.c * 120, y0 = AR.y + s.r * 120;
          if (s.kind === 'zap' && !s.hit && T >= s.at) {
            s.hit = true;
            for (const o of this.near(x0 + 60, y0 + 60, 90)) if (o.x > x0 && o.x < x0 + 120 && o.y > y0 && o.y < y0 + 120) { this._kind = 'blast'; this.damage(o, 7 * Math.max(UNIT[o.type].armor, 0.6), null); }
            this.burst(x0 + 60, y0 + 60, '#BFE6FF', 10, 300, 0.4, 7); this.snd('thunder', { pan: (x0 + 60 - AR.x) / AR.w * 1.4 - 0.7 });
          }
          if (s.kind === 'boost' && T >= s.at && T < s.end) for (const o of this.near(x0 + 60, y0 + 60, 90)) if (o.x > x0 && o.x < x0 + 120 && o.y > y0 && o.y < y0 + 120) o.tileT = T + 2;
        }
        tl.list = tl.list.filter(s => T < s.end);
      }
      if (m.lava) {
        // the World Furnace: lava rivers pour across the field and move every few seconds; fireproof troops don't care
        const rv = this.rivers;
        if (T >= rv.next) {
          rv.next = T + 10;
          const xs = S.shuffle([90, 170, 260, 350]).slice(0, S.chance(0.5) ? 1 : 2);
          rv.list = xs.flatMap(dx => [-dx, dx]).map(dx => ({ x: cx + dx, w: 50, t0: T, warn: T + 1.6, end: T + 9.5 }));
          if (!this.lavaSaid) { this.lavaSaid = true; this.bannerQ.push({ at: T + 1.6, text: 'THE LAVA FLOWS!', col: '#FF6B3D' }); }
        }
        for (const l of rv.list) if (T >= l.warn && T < l.end) for (const o of this.units) {
          if (o.dead || o.flying || UNIT[o.type].fireproof || Math.abs(o.x - l.x) > l.w / 2 + o.r * 0.5) continue;
          this.dot(o, 6 * h * this.hpScale, null); this.slowDown(o, 0.7, 0.3);
        }
      }
      if (m.ice) {
        // the Frozen End: everyone slides on the ice, and big units crack it until it breaks into icy water
        if (T >= this.iceAt) {
          this.iceAt = T + 0.5;
          for (const o of this.units) {
            if (o.dead || o.flying || UNIT[o.type].rank !== 0 || this.holes.length >= 8 || Math.hypot(o.vx, o.vy) < 6) continue;
            const key = ((o.x - AR.x) / 80 | 0) * 64 + ((o.y - AR.y) / 80 | 0), n = (this.cracks2.get(key) || 0) + 1;
            this.cracks2.set(key, n);
            if (n === 4) { const hx = AR.x + ((key / 64 | 0) + 0.5) * 80, hy = AR.y + (key % 64 + 0.5) * 80; this.holes.push({ x: hx, y: hy, r: 38, t0: T }); this.burst(hx, hy, '#DCEBFA', 14, 260, 0.6, 7); this.snd('stone', { pan: (hx - AR.x) / AR.w * 1.4 - 0.7 }); if (!this.iceSaid) { this.iceSaid = true; this.banner('THE ICE BREAKS!', '#BFE6FF', 1.4); } }
          }
        }
        for (const hl of this.holes) for (const o of this.near(hl.x, hl.y, hl.r)) if (!o.flying) { this.dot(o, 5 * h * this.hpScale, null); this.slowDown(o, 0.45, 0.3); }
      }
      if (m.bones) {
        // the Titan's Grave: the giant's ribs give cover, and every so often a pair of them gives way
        const b = this.bones;
        if (b.warn && T >= b.warn.at) {
          for (const ob of b.warn.ribs) {
            if (!this.obstacles.includes(ob)) continue;
            for (const o of this.units) if (!o.dead && o.x > ob.x0 - 30 && o.x < ob.x1 + 30 && o.y > ob.y0 - 30 && o.y < ob.y1 + 30) { this._kind = 'blast'; this.damage(o, 6, null); this.knock(o, (ob.x0 + ob.x1) / 2, (ob.y0 + ob.y1) / 2, 30); }
            this.breakObstacle(ob);
          }
          b.warn = null;
          if (!this.boneSaid) { this.boneSaid = true; this.banner('THE BONES COLLAPSE!', '#E9E2D0', 1.5); }
        }
        if (!b.warn && T >= b.next) {
          b.next = T + 9;
          const ribs = this.obstacles.filter(o => o.kind === 'rib' && o.y1 < cy);
          if (ribs.length) {
            const top = ribs[S.int(0, ribs.length - 1)], twin = this.obstacles.find(o => o.kind === 'rib' && Math.abs(o.x0 - top.x0) < 1 && o.y0 > cy);
            b.warn = { at: T + 1.2, ribs: twin ? [top, twin] : [top] }; this.shake(4); this.snd('rumble');
          }
        }
      }
      if (m.vines) {
        // the Overgrown Kingdom: vines slow troops down, thickets hide them from archers, statues wake up and strike
        if (T >= this.zoneAt) {
          this.zoneAt = T + 0.25;
          for (const o of this.units) {
            if (o.dead) continue;
            const x = o.x - cx, y = o.y - cy;
            o.vines = !o.flying && VINE_ZONES.some(([zx, zy, zr]) => (x - zx) ** 2 + (y - zy) ** 2 < zr * zr);
            o.hidden = !o.flying && THICKETS.some(([zx, zy, zr]) => (x - zx) ** 2 + (y - zy) ** 2 < zr * zr);
          }
        }
        const st = this.statues;
        if (st.fire && T >= st.fire.at) {
          for (const s of st.fire.list) {
            let best = null, bd = 280 * 280;
            for (const o of this.units) { if (o.dead || o.phased) continue; const d = (o.x - s.x) ** 2 + (o.y - s.y) ** 2; if (d < bd) { bd = d; best = o; } }
            if (best) { this.beams.push({ x0: s.x, y0: s.y, x1: best.x, y1: best.y, t0: T, life: 0.5, col: '#7CFFB0', w: 7 }); this._kind = 'blast'; this.damage(best, 6, null); this.burst(best.x, best.y, '#9AA3B0', 8, 200, 0.4, 6); }
          }
          st.fire = null; this.snd('zap');
        }
        if (!st.fire && T >= st.next) {
          st.next = T + 7;
          const list = this.obstacles.filter(o => o.kind === 'statue'), side = S.chance(0.5) ? 1 : -1;
          const pair = list.filter(o => Math.sign(o.x - cx) === side);
          if (pair.length) { st.fire = { at: T + 1, list: pair }; for (const s of pair) s.wake = T; if (!this.statueSaid) { this.statueSaid = true; this.banner('THE STATUES AWAKEN!', '#7CFFB0', 1.4); } }
        }
      }
      if (m.gears) {
        // the Clockwork Colosseum: round platforms turn and carry troops with them, and the gears reverse a third of the way in
        const g = this.gears;
        if (T >= g.flipAt) { g.flipAt = T + 0.33 * (this.fixed || this.target); g.dir *= -1; this.banner('THE GEARS REVERSE!', '#E3B341', 1.4); this.snd('stone'); }
        g.ang += g.dir * 0.55 * h;
        const w = g.dir * 0.55 * h, cw = Math.cos(w), sw = Math.sin(w);
        for (const [px, py, pr] of CLOCK_PLATES) {
          const ox = cx + px, oy = cy + py;
          for (const o of this.near(ox, oy, pr)) { if (o.flying || UNIT[o.type].immovable) continue; const dx = o.x - ox, dy = o.y - oy; o.x = ox + dx * cw - dy * sw; o.y = oy + dx * sw + dy * cw; }
        }
      }
      if (m.void) {
        // the Shattered Sky: troops knocked off an island fall into the void
        for (const o of this.units) {
          if (o.dead || o.flying || o.phased) continue;
          for (const ob of this.obstacles) {
            if (!ob.void) continue;
            const inside = ob.circle ? Math.hypot(o.x - ob.x, o.y - ob.y) < ob.r - o.r * 0.3 : o.x > ob.x0 + o.r * 0.3 && o.x < ob.x1 - o.r * 0.3 && o.y > ob.y0 + o.r * 0.3 && o.y < ob.y1 - o.r * 0.3;
            if (!inside) continue;
            this.fallers.push({ x: o.x, y: o.y, r: o.r, c: TEAMS[o.team].c, t0: T });
            if (T >= (this.fallSaid || 0)) { this.fallSaid = T + 3; this.float(o.x, o.y - 20, 'FELL!', '#BFE6FF', 26, 0.8); }
            this.xf.falls = (this.xf.falls || 0) + 1;
            this._dot = true; this.damage(o, o.hp + 999, null); this._dot = false;
            break;
          }
        }
        this.fallers = this.fallers.filter(f => T - f.t0 < 0.8);
      }
      if (m.flip && T >= this.flips.next) {
        // the Mirror Dimension: the whole battle flips left to right, and mirror images of a few troops appear for a moment
        this.flips.next = T + 12;
        for (const o of this.units) { o.x = 2 * cx - o.x; if (o.px !== undefined) o.px = 2 * cx - o.px; o.vx = -o.vx; o.face = Math.PI - o.face; if (o.mface !== undefined) o.mface = Math.PI - o.mface; if (o.kx !== undefined) o.kx = -o.kx; o.wp = null; o.cover = null; }
        for (const a of this.arrows) { a.x = 2 * cx - a.x; a.vx = -a.vx; if (a.px !== undefined) a.px = 2 * cx - a.px; if (a.sx !== undefined) { a.sx = 2 * cx - a.sx; a.tx = 2 * cx - a.tx; } }
        for (const t of this.teamIds()) {
          const mine = this.units.filter(o => o.team === t && !o.dead && !UNIT[o.type].uncounted && UNIT[o.type].rank !== 0);
          for (let k = 0; k < Math.min(3, mine.length); k++) { const o = mine[S.int(0, mine.length - 1)]; this.makeDecoy(t, 2 * cx - o.x, o.y, 'mirror', 5, null); }
        }
        this.flipFx = T; this.banner('THE WORLD FLIPS!', '#C4B5FD', 1.4); this.snd('glitch');
      }
    },
    // the moving parts of these maps, drawn every frame over the ground
    drawMapDyn(ctx) {
      const T = this.fightT, t = this.t, cx = AR.x + AR.w / 2, cy = AR.y + AR.h / 2;
      if (this.tiles) for (const s of this.tiles.list) {
        const x0 = AR.x + s.c * 120, y0 = AR.y + s.r * 120, warn = T < s.at, k = warn ? 0.4 + 0.4 * Math.sin(t * 16) : 1;
        if (s.kind === 'zap') { ctx.fillStyle = `rgba(229,72,77,${0.28 * k})`; ctx.fillRect(x0 + 4, y0 + 4, 112, 112); ctx.lineWidth = 4; ctx.strokeStyle = `rgba(255,120,120,${0.8 * k})`; ctx.strokeRect(x0 + 6, y0 + 6, 108, 108);
          if (!warn && T - s.at < 0.3) { ctx.beginPath(); let lx = x0 + 60, ly = AR.y; ctx.moveTo(lx, ly); for (let i = 1; i <= 6; i++) { ly = AR.y + (y0 + 60 - AR.y) * i / 6; lx = x0 + 60 + (i % 2 ? 14 : -14) * (i < 6 ? 1 : 0); ctx.lineTo(lx, ly); } ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(160,220,255,0.6)'; ctx.stroke(); ctx.lineWidth = 3.5; ctx.strokeStyle = '#FFFFFF'; ctx.stroke(); } }
        else { ctx.fillStyle = `rgba(255,210,63,${0.22 * k})`; ctx.fillRect(x0 + 4, y0 + 4, 112, 112); ctx.lineWidth = 4; ctx.strokeStyle = `rgba(255,226,122,${0.85 * k})`; ctx.strokeRect(x0 + 6, y0 + 6, 108, 108); }
      }
      if (this.rivers) for (const l of this.rivers.list) {
        if (T >= l.end) continue;
        const warn = T < l.warn, k = warn ? clamp((T - l.t0) / 1.6, 0, 1) : Math.min(1, (l.end - T) / 0.6);
        if (warn) { ctx.fillStyle = `rgba(255,107,61,${0.12 + 0.12 * Math.sin(t * 12)})`; ctx.fillRect(l.x - l.w / 2, AR.y, l.w, AR.h * k); continue; }
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) { const y = AR.y + AR.h * i / 24, x = l.x - l.w / 2 + Math.sin(i * 0.9 + t * 2) * 6; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        for (let i = 24; i >= 0; i--) { const y = AR.y + AR.h * i / 24, x = l.x + l.w / 2 + Math.sin(i * 0.9 + t * 2 + 1) * 6; ctx.lineTo(x, y); }
        ctx.closePath(); ctx.globalAlpha = k; ctx.fillStyle = '#E2571E'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#FDBA74'; ctx.stroke();
        for (let i = 0; i < 6; i++) disc(ctx, l.x + Math.sin(i * 2.1 + t) * l.w * 0.25, AR.y + ((i * 167 + t * 60) % AR.h), 4 + 2 * Math.sin(t * 5 + i), '#FDE68A', 0);
        ctx.globalAlpha = 1;
      }
      if (this.holes) for (const hl of this.holes) { disc(ctx, hl.x, hl.y, hl.r, '#0B2A44', 3); disc(ctx, hl.x - 6, hl.y - 6, hl.r * 0.5, 'rgba(120,200,255,0.25)', 0); ctx.beginPath(); ctx.arc(hl.x, hl.y, hl.r + 6, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(230,246,255,0.6)'; ctx.stroke(); }
      if (this.bones && this.bones.warn) for (const ob of this.bones.warn.ribs) { const j = Math.sin(t * 50) * 2; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,90,60,0.8)'; ctx.strokeRect(ob.x0 - 4 + j, ob.y0 - 4, ob.x1 - ob.x0 + 8, ob.y1 - ob.y0 + 8); }
      if (this.statues) for (const s of this.obstacles) if (s.kind === 'statue') {
        const awake = s.wake !== undefined && T - s.wake < 1.3, k = awake ? 0.6 + 0.4 * Math.sin(t * 14) : 0.25;
        ctx.fillStyle = `rgba(124,255,176,${k})`; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(s.x + sd * s.r * 0.25, s.y - s.r * 0.15, 3.5, 0, TAU); ctx.fill(); }
        if (awake) { ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 6, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(124,255,176,${0.5 * k})`; ctx.stroke(); }
      }
      if (this.gears) {
        // turning platforms (arrows show the way they spin) and the big gears
        for (const [px, py, pr] of CLOCK_PLATES) {
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(227,179,65,0.35)';
          for (let k = 0; k < 4; k++) { const a = this.gears.ang + k * TAU / 4; ctx.beginPath(); ctx.arc(cx + px, cy + py, pr * 0.8, a, a + 0.9); ctx.stroke(); const ex = cx + px + Math.cos(a + 0.9) * pr * 0.8, ey = cy + py + Math.sin(a + 0.9) * pr * 0.8, d = this.gears.dir; tri(ctx, ex + Math.cos(a + 0.9 + d * 1.57) * 8, ey + Math.sin(a + 0.9 + d * 1.57) * 8, ex + Math.cos(a + 0.9) * 6, ey + Math.sin(a + 0.9) * 6, ex - Math.cos(a + 0.9) * 6, ey - Math.sin(a + 0.9) * 6, 'rgba(227,179,65,0.5)', 0); }
        }
        for (const ob of this.obstacles) if (ob.kind === 'gear') {
          const a0 = this.gears.ang * (ob.x < cx ? 1.6 : -1.6) * (ob.r < 40 ? -1.8 : 1), n = ob.r < 40 ? 8 : 12;
          ctx.beginPath(); for (let k = 0; k < n * 2; k++) { const a = a0 + k / (n * 2) * TAU, rr = k % 2 ? ob.r * 0.86 : ob.r * 1.02; if (k) ctx.lineTo(ob.x + Math.cos(a) * rr, ob.y + Math.sin(a) * rr); else ctx.moveTo(ob.x + Math.cos(a) * rr, ob.y + Math.sin(a) * rr); }
          ctx.closePath(); ctx.fillStyle = '#B5893A'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = COL.ink; ctx.stroke();
          disc(ctx, ob.x, ob.y, ob.r * 0.55, '#8A6420', 2.5); disc(ctx, ob.x, ob.y, ob.r * 0.18, '#2A2018', 2);
          for (let k = 0; k < 4; k++) { const a = a0 + k * TAU / 4; stick(ctx, ob.x + Math.cos(a) * ob.r * 0.2, ob.y + Math.sin(a) * ob.r * 0.2, ob.x + Math.cos(a) * ob.r * 0.52, ob.y + Math.sin(a) * ob.r * 0.52, 3, '#C9A050'); }
        }
      }
      if (this.fallers) for (const f of this.fallers) { const k = (T - f.t0) / 0.8; disc(ctx, f.x, f.y, f.r * (1 - k * 0.8), f.c, 2); ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - k * 0.8), 0, TAU); ctx.fillStyle = `rgba(5,7,13,${k})`; ctx.fill(); }
      if (this.flipFx !== undefined && T - this.flipFx < 0.5) { const k = 1 - (T - this.flipFx) / 0.5; ctx.fillStyle = `rgba(196,181,253,${0.35 * k})`; ctx.fillRect(AR.x, AR.y, AR.w, AR.h); ctx.lineWidth = 6; ctx.strokeStyle = `rgba(255,255,255,${0.8 * k})`; ctx.beginPath(); ctx.moveTo(cx, AR.y); ctx.lineTo(cx, AR.y + AR.h); ctx.stroke(); }
    },
    // the new obstacle kinds, painted once on the map layer
    paintObstacle(g, o, ox, oy, S) {
      const INK = COL.ink;
      if (o.void) {
        // a hole in the world: the dark sky under the floating islands, with a few stars and a rocky rim
        const fill = '#05070D';
        g.beginPath(); if (o.circle) g.arc(o.x - ox, o.y - oy, o.r, 0, TAU); else g.rect(o.x0 - ox, o.y0 - oy, o.x1 - o.x0, o.y1 - o.y0);
        g.fillStyle = fill; g.fill(); g.lineWidth = 5; g.strokeStyle = '#3A4256'; g.stroke(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
        const R = rng(Math.round(o.circle ? o.x * 7 + o.y : o.x0 * 13 + o.y0));
        g.fillStyle = 'rgba(255,255,255,0.55)';
        for (let k = 0; k < (o.circle ? 4 : 10); k++) { const x = o.circle ? o.x - ox + R.range(-o.r * 0.6, o.r * 0.6) : R.range(o.x0 - ox + 6, o.x1 - ox - 6), y = o.circle ? o.y - oy + R.range(-o.r * 0.6, o.r * 0.6) : R.range(o.y0 - oy + 4, o.y1 - oy - 4); g.beginPath(); g.arc(x, y, R.range(0.8, 1.8), 0, TAU); g.fill(); }
        return;
      }
      if (o.circle) {
        const x = o.x - ox, y = o.y - oy, r = o.r;
        g.beginPath(); g.ellipse(x + 5, y + 7, r, r * 0.9, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,0.38)'; g.fill();
        if (o.kind === 'rook') {
          g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = '#D9D2C2'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
          for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78, r * 0.17, 0, TAU); g.fillStyle = k % 2 ? '#C2BAA8' : '#EDE7DA'; g.fill(); g.lineWidth = 1.5; g.stroke(); }
          g.beginPath(); g.arc(x, y, r * 0.45, 0, TAU); g.fillStyle = '#B5AD9A'; g.fill(); g.lineWidth = 2; g.stroke();
        } else if (o.kind === 'basalt') {
          g.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + 0.3, rr = r * (0.88 + 0.12 * ((k * 3) % 2)); if (k) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
          g.closePath(); g.fillStyle = '#2A2422'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
          g.lineWidth = 2.5; g.strokeStyle = '#FF7A2E'; g.beginPath(); g.moveTo(x - r * 0.5, y - r * 0.1); g.lineTo(x - r * 0.1, y + r * 0.1); g.lineTo(x + r * 0.2, y - r * 0.3); g.moveTo(x - r * 0.1, y + r * 0.1); g.lineTo(x + r * 0.05, y + r * 0.5); g.stroke();
        } else if (o.kind === 'icepillar' || o.kind === 'shard') {
          const ice = o.kind === 'icepillar';
          g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + 0.5; if (k) g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
          g.closePath(); g.fillStyle = ice ? '#A9D6F5' : '#C9C3F2'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
          g.beginPath(); g.moveTo(x - r * 0.4, y - r * 0.5); g.lineTo(x, y + r * 0.1); g.lineTo(x + r * 0.45, y - r * 0.35); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.75)'; g.stroke();
          g.beginPath(); g.arc(x - r * 0.25, y - r * 0.3, r * 0.15, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fill();
        } else if (o.kind === 'skull' || o.kind === 'pelvis') {
          g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = '#E3DCC8'; g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
          if (o.kind === 'skull') { g.fillStyle = '#2A2620'; for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(x + r * 0.25, y + sd * r * 0.32, r * 0.2, r * 0.17, 0, 0, TAU); g.fill(); } g.beginPath(); g.moveTo(x + r * 0.62, y - r * 0.08); g.lineTo(x + r * 0.75, y); g.lineTo(x + r * 0.62, y + r * 0.08); g.closePath(); g.fill(); }
          else { g.beginPath(); g.arc(x, y, r * 0.45, 0, TAU); g.fillStyle = '#2A2620'; g.fill(); }
        } else if (o.kind === 'statue') {
          g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = '#6B7568'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
          g.beginPath(); g.arc(x, y, r * 0.62, 0, TAU); g.fillStyle = '#7F8A7B'; g.fill(); g.lineWidth = 2; g.stroke();
          g.fillStyle = 'rgba(70,140,80,0.6)'; for (let k = 0; k < 4; k++) { const a = k * 1.7 + 0.4; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, r * 0.2, 0, TAU); g.fill(); }
        } else if (o.kind === 'gear') {
          g.beginPath(); g.arc(x, y, r * 1.05, 0, TAU); g.fillStyle = '#3A2A18'; g.fill();
        } else { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = '#4A5368'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke(); }
        return;
      }
      const x = o.x0 - ox, y = o.y0 - oy, w = o.x1 - o.x0, h = o.y1 - o.y0;
      g.fillStyle = 'rgba(0,0,0,0.38)'; roundRect(g, x + 5, y + 7, w, h, 6); g.fill();
      if (o.kind === 'rib') {
        roundRect(g, x, y, w, h, Math.min(w, h) / 2); g.fillStyle = '#E3DCC8'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
        g.lineWidth = 2; g.strokeStyle = 'rgba(120,110,90,0.6)'; g.beginPath(); g.moveTo(x + w / 2, y + 6); g.lineTo(x + w / 2, y + h - 6); g.stroke();
      } else { roundRect(g, x, y, w, h, 3); g.fillStyle = '#4A5368'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke(); }
    },
    // what's left of a broken obstacle: rubble on the ground (stumps and ash for trees, bone shards for ribs)
    paintRubble(g, ox, oy) {
      for (const rb of this.rubble) {
        const R = rng(Math.round(rb.x * 31 + rb.y * 17)), x = rb.x - ox, y = rb.y - oy, tree = rb.kind === 'tree' || rb.kind === 'pine';
        g.beginPath(); g.ellipse(x, y, rb.r * 0.9, rb.r * 0.7, 0, 0, TAU); g.fillStyle = tree ? 'rgba(20,14,10,0.55)' : 'rgba(0,0,0,0.25)'; g.fill();
        if (tree) { g.beginPath(); g.arc(x, y, rb.r * 0.3, 0, TAU); g.fillStyle = '#5B3A22'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = COL.ink; g.stroke(); continue; }
        const col = OB_DUST[rb.kind] || '#8A8F98';
        for (let k = 0; k < 7; k++) {
          const cx2 = x + R.range(-rb.r * 0.7, rb.r * 0.7), cy2 = y + R.range(-rb.r * 0.5, rb.r * 0.5), cr = R.range(3, Math.max(4, rb.r * 0.22));
          g.beginPath(); for (let v = 0; v < 5; v++) { const b = v / 5 * TAU + k; if (v) g.lineTo(cx2 + Math.cos(b) * cr, cy2 + Math.sin(b) * cr); else g.moveTo(cx2 + Math.cos(b) * cr, cy2 + Math.sin(b) * cr); }
          g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = 1.5; g.strokeStyle = COL.ink; g.stroke();
        }
      }
    },
  };
  // =====================================================================
  // The big troop batch, battle systems and power-ups. Everything here only runs when a battle has one of the new troops,
  // new army types, maps or systems in it (game.ext), so older battles play out exactly as before.
  // =====================================================================
  // champion names: made up, never real people
  const CHAMP_FIRST = ['GRIM', 'BRAKK', 'VEXA', 'KORRIN', 'DRAVEN', 'SIRA', 'MORGRA', 'TALVO', 'RUNA', 'ZEDRIK', 'ASHKA', 'IVOR', 'NYRA', 'ORLOK', 'BRAMBLE', 'KAELEN', 'TOVA', 'GRUNDA', 'PELL', 'OSKA'];
  const CHAMP_EPITHET = ['THE BOLD', 'IRONHIDE', 'THE UNBROKEN', 'STORMBORN', 'THE SWIFT', 'NIGHTFANG', 'STEELHEART', 'THE MAD', 'FIREBRAND', 'BONECRUSHER', 'THE LUCKY', 'SKULLTAKER', 'THE WALL', 'GRAVEBANE'];
  const CALLSIGNS = ['VIPER', 'GHOST', 'BLAZE', 'HAVOC', 'RAVEN', 'NOMAD', 'SABRE', 'COBRA', 'ZERO', 'ECHO'];
  const MODERNISH = { rifleman: 1, gunner: 1, sniper: 1, grenadier: 1, trooper: 1, robot: 1 };
  const MUT_LABEL = { wings: 'WINGS', spellward: 'SPELL WARD', vampiric: 'VAMPIRIC', spikes: 'SPIKES', regen: 'REGEN', venom: 'VENOM', swift: 'SWIFT' };
  // troop combinations that unlock a bonus for that army (rules.systems.synergies)
  const SYNERGIES = [
    { name: 'SHIELD WALL', ok: c => (c.shieldbearer || 0) + (c.royalguard || 0) + (c.turtle || 0) * 4 >= 4 && (c.archer || 0) + (c.longbow || 0) + (c.crossbowman || 0) + (c.elf || 0) + (c.firearcher || 0) >= 6, ranged: 1.15 },
    { name: 'PACK HUNT', ok: c => (c.wolfrider || 0) >= 4 || (c.hellhound || 0) >= 5, pack: 1 },
    { name: 'DARK RITUAL', ok: c => (c.necromancer || 0) >= 2 && (c.skeleton || 0) >= 12, ritual: 1 },
    { name: 'WAR DRUMS', ok: c => (c.drummer || 0) >= 1 && (c.orc || 0) + (c.berserker || 0) + (c.boarrider || 0) >= 8, drums: 1 },
    { name: 'HELLFIRE', ok: c => (c.imp || 0) + (c.warlock || 0) + (c.demon || 0) + (c.hellhound || 0) >= 10, fire: 1.5 },
    { name: 'CLOCKWORK', ok: c => (c.engineer || 0) >= 3 && (c.dwarf || 0) >= 6, turrets: 1.4 },
    { name: 'NATURE\'S CALL', ok: c => (c.druid || 0) >= 2 && (c.treant || 0) >= 2, nature: 1 },
    { name: 'SPELLBLADES', ok: c => (c.knight || 0) + (c.swordsman || 0) >= 6 && (c.wizard || 0) >= 4, arcane: 1 },
    { name: 'GUNS AND STEEL', ok: c => (c.rifleman || 0) + (c.gunner || 0) >= 6 && (c.tank || 0) + (c.mech || 0) >= 1, steel: 1 },
    { name: 'NINJA CLAN', ok: c => (c.ninja || 0) >= 6 && (c.samurai || 0) >= 4, clan: 1 },
  ];
  const SYN_TEXT = { 'SHIELD WALL': 'ARCHERS +15%', 'PACK HUNT': 'RIDERS FASTER', 'DARK RITUAL': 'MORE RAISED DEAD', 'WAR DRUMS': 'FASTER AXES', HELLFIRE: 'HOTTER FIRE', CLOCKWORK: 'TOUGHER TURRETS',
    'NATURE\'S CALL': 'TREES HEAL', SPELLBLADES: 'BLADES +15%', 'GUNS AND STEEL': 'GUNNERS TOUGHER', 'NINJA CLAN': 'NINJAS FASTER' };
  // new supply-drop kinds (rules.systems.powerups)
  const POWERUPS = ['freeze', 'portal', 'phoenix', 'chain', 'dice', 'crystal', 'singularity', 'crown'];
  Object.assign(CRATE, {
    freeze: { box: '#BFE6FF', icon: '#2F6BDB', chute: '#7CC8FF', glow: '#BFE6FF' },
    portal: { box: '#6D28D9', icon: '#E9D5FF', chute: '#8B5CF6', glow: '#C084FC' },
    phoenix: { box: '#F97316', icon: '#FFD23F', chute: '#EA580C', glow: '#FDBA74' },
    chain: { box: '#1E3A8A', icon: '#FDE047', chute: '#3B82F6', glow: '#93C5FD' },
    dice: { box: '#F4F6FB', icon: '#2A2F3A', chute: '#E5484D', glow: '#FFFFFF' },
    crystal: { box: '#0F766E', icon: '#5EEAD4', chute: '#14B8A6', glow: '#99F6E4' },
    singularity: { box: '#111827', icon: '#A78BFA', chute: '#4C1D95', glow: '#A78BFA' },
    crown: { box: '#7C2D12', icon: '#FFD23F', chute: '#B45309', glow: '#FDE68A' },
  });
  // how tough each kind of obstacle is when terrain can be destroyed (rules.systems.destructible)
  const OB_HP = { rock: 70, pillar: 45, wall: 55, sandbag: 40, crater: 999, roof: 120, crate: 25, tree: 35, bush: 15, ruin: 60, car: 50, crystal: 40, mushroom: 30, mesa: 160, rib: 50, gear: 999, statue: 80, pine: 35, battlement: 90, tower: 140 };
  const OB_DUST = { rock: '#8A8F98', pillar: '#B9B2A2', wall: '#B9B2A2', sandbag: '#C2A878', tree: '#5B3A22', crystal: '#C4B5FD', mushroom: '#F4A6C6', mesa: '#C98B55', rib: '#E9E2D0', crate: '#B07A3E', car: '#5B6472', roof: '#6B7280', ruin: '#8E8A80', statue: '#9AA3B0', battlement: '#A3A6B4', tower: '#A3A6B4' };
  const BIG_BLAST = { shell: 1, cannonball: 1, bomb: 1, meteor: 1, boulder: 1, slam: 1 };
  const XSHOT = { firearrow: 1, dart: 1, soul: 1, spark: 1, firebolt: 1, beam: 1, boulder: 1, flask: 1, hellfire: 1 };

  // ----- more battlefields (rules.maps): each mirrored top to bottom, with its own ground and obstacles -----
  Object.assign(MAPS, {
    // Pirate Beach: sand, palm trees, rocks and a wrecked boat's cargo, with surf along both sides
    beach: mirrorMap([
      { c: [-300, -120, 30], kind: 'palm' }, { c: [300, -120, 30], kind: 'palm' }, { c: [0, -250, 28], kind: 'palm' },
      { c: [-150, -60, 22], kind: 'rock' }, { c: [150, -60, 22], kind: 'rock' },
      { b: [-410, -300, 46, 46], kind: 'crate' }, { b: [364, -300, 46, 46], kind: 'crate' }, { c: [-200, -330, 24], kind: 'palm' }, { c: [200, -330, 24], kind: 'palm' },
    ]),
    // Snowy Pass: pines heavy with snow and snow-capped boulders
    snow: mirrorMap([
      { c: [-330, -90, 30], kind: 'pine' }, { c: [330, -90, 30], kind: 'pine' }, { c: [0, -190, 34], kind: 'snowrock' },
      { c: [-170, -300, 26], kind: 'pine' }, { c: [170, -300, 26], kind: 'pine' }, { c: [-420, -270, 24], kind: 'snowrock' }, { c: [420, -270, 24], kind: 'snowrock' },
      { c: [-140, -70, 18], kind: 'pine' }, { c: [140, -70, 18], kind: 'pine' },
    ]),
    // Dune Sea: rippled sand, cactus and flat-topped mesas
    dunes: mirrorMap([
      { c: [0, -150, 34], kind: 'mesa' }, { c: [-330, -60, 22], kind: 'cactus' }, { c: [330, -60, 22], kind: 'cactus' },
      { c: [-220, -270, 20], kind: 'cactus' }, { c: [220, -270, 20], kind: 'cactus' }, { c: [-420, -200, 30], kind: 'mesa' }, { c: [420, -200, 30], kind: 'mesa' },
    ]),
    // Murk Swamp: dead trees, reeds and puddles of black water
    swamp: mirrorMap([
      { c: [-300, -110, 30], kind: 'deadtree' }, { c: [300, -110, 30], kind: 'deadtree' }, { c: [0, -260, 28], kind: 'deadtree' },
      { c: [-150, -60, 20], kind: 'bush' }, { c: [150, -60, 20], kind: 'bush' }, { c: [-420, -300, 22], kind: 'bush' }, { c: [420, -300, 22], kind: 'bush' },
      { d: [-200, -210, 46], kind: 'puddle' }, { d: [200, -210, 46], kind: 'puddle' }, { d: [-380, 0, 40], kind: 'puddle' }, { d: [380, 0, 40], kind: 'puddle' }, { d: [0, -90, 34], kind: 'puddle' },
    ]),
    // Neon City: glowing blocks and crates on a dark street grid
    neon: mirrorMap([
      { b: [-380, -170, 120, 90], kind: 'neonblock' }, { b: [260, -170, 120, 90], kind: 'neonblock' }, { b: [-60, -320, 120, 70], kind: 'neonblock' },
      { b: [-176, -78, 40, 40], kind: 'crate' }, { b: [136, -78, 40, 40], kind: 'crate' }, { b: [-450, -360, 70, 50], kind: 'neonblock' }, { b: [380, -360, 70, 50], kind: 'neonblock' },
    ]),
    // Sky Temple: stone tiles, rows of pillars, guardian statues and a crystal altar in the middle
    temple: mirrorMap([
      { c: [0, 0, 30], kind: 'crystal' },
      { c: [-330, -90, 22], kind: 'pillar' }, { c: [330, -90, 22], kind: 'pillar' }, { c: [-330, -230, 22], kind: 'pillar' }, { c: [330, -230, 22], kind: 'pillar' },
      { c: [-150, -300, 26], kind: 'statue' }, { c: [150, -300, 26], kind: 'statue' }, { c: [-150, -150, 20], kind: 'pillar' }, { c: [150, -150, 20], kind: 'pillar' },
    ]),
    // Haunted Graveyard: rows of tombstones and dead trees
    graveyard: mirrorMap([
      { b: [-330, -110, 30, 40], kind: 'tomb' }, { b: [300, -110, 30, 40], kind: 'tomb' }, { b: [-200, -70, 30, 40], kind: 'tomb' }, { b: [170, -70, 30, 40], kind: 'tomb' },
      { b: [-15, -200, 30, 40], kind: 'tomb' }, { c: [-400, -280, 30], kind: 'deadtree' }, { c: [400, -280, 30], kind: 'deadtree' },
      { b: [-260, -300, 30, 40], kind: 'tomb' }, { b: [230, -300, 30, 40], kind: 'tomb' }, { c: [0, -350, 24], kind: 'deadtree' },
    ]),
    // Moon Base: grey dust, craters and base modules
    moon: mirrorMap([
      { b: [-400, -200, 130, 100], kind: 'building' }, { b: [270, -200, 130, 100], kind: 'building' }, { c: [0, -150, 30], kind: 'rock' },
      { c: [-200, -70, 20], kind: 'rock' }, { c: [200, -70, 20], kind: 'rock' },
      { d: [-250, 0, 34], kind: 'crater' }, { d: [250, 0, 34], kind: 'crater' }, { d: [-120, -270, 26], kind: 'crater' }, { d: [120, -270, 26], kind: 'crater' }, { d: [0, -400, 30], kind: 'crater' },
    ]),
  });
  Object.assign(MAP_THEME, {
    beach: {
      floor: '#3A3122', grid: 'rgba(255,240,200,0.05)', mid: 'rgba(255,245,220,0.10)',
      texture: g => {
        scatter(0xBEAC, 16, S => { g.beginPath(); g.ellipse(S.range(0, AR.w), S.range(0, AR.h), S.range(40, 90), S.range(20, 40), S.range(0, 3), 0, TAU); g.fillStyle = S.chance(0.5) ? 'rgba(255,220,150,0.07)' : 'rgba(0,0,0,0.12)'; g.fill(); });
        // the sea along both sides, with a line of foam
        for (const sg of [0, 1]) {
          const x0 = sg ? AR.w - 54 : 0;
          g.fillStyle = '#12324A'; g.fillRect(x0, 0, 54, AR.h);
          g.beginPath(); for (let k = 0; k <= 32; k++) { const y = AR.h * k / 32, x = (sg ? AR.w - 54 : 54) + Math.sin(k * 1.4) * 6 * (sg ? -1 : 1); if (k) g.lineTo(x, y); else g.moveTo(x, y); }
          g.lineWidth = 6; g.strokeStyle = 'rgba(230,245,255,0.55)'; g.stroke();
        }
        scatter(0x5E11, 30, S => { const x = S.range(70, AR.w - 70), y = S.range(10, AR.h - 10); g.beginPath(); g.arc(x, y, S.range(2, 4), 0, TAU); g.fillStyle = 'rgba(255,240,220,0.18)'; g.fill(); });
      },
    },
    snow: {
      floor: '#26323F', grid: 'rgba(220,235,255,0.05)', mid: 'rgba(235,245,255,0.12)',
      texture: g => {
        scatter(0x5A0, 18, S => { g.beginPath(); g.ellipse(S.range(0, AR.w), S.range(0, AR.h), S.range(50, 110), S.range(24, 50), S.range(0, 3), 0, TAU); g.fillStyle = 'rgba(225,238,255,0.08)'; g.fill(); });
        scatter(0x5A1, 70, S => { g.beginPath(); g.arc(S.range(0, AR.w), S.range(0, AR.h), S.range(1.5, 3.5), 0, TAU); g.fillStyle = 'rgba(255,255,255,0.22)'; g.fill(); });
      },
    },
    dunes: {
      floor: '#33261A', grid: 'rgba(255,220,170,0.04)', mid: 'rgba(255,230,200,0.10)',
      texture: g => {
        g.lineCap = 'round';
        scatter(0xD0E, 40, S => { const x = S.range(-40, AR.w), y = S.range(0, AR.h), l = S.range(60, 140); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - S.range(6, 14), x + l, y); g.lineWidth = 3; g.strokeStyle = S.chance(0.5) ? 'rgba(255,210,150,0.10)' : 'rgba(0,0,0,0.16)'; g.stroke(); });
      },
    },
    swamp: {
      floor: '#18211A', grid: 'rgba(180,220,170,0.04)', mid: 'rgba(210,240,200,0.08)',
      texture: g => {
        scatter(0x5EA, 16, S => { g.beginPath(); g.ellipse(S.range(0, AR.w), S.range(0, AR.h), S.range(40, 90), S.range(24, 50), S.range(0, 3), 0, TAU); g.fillStyle = S.chance(0.5) ? 'rgba(90,110,60,0.12)' : 'rgba(0,0,0,0.18)'; g.fill(); });
        g.lineCap = 'round'; g.lineWidth = 2.5; g.strokeStyle = '#3D5233';
        scatter(0x5EB, 60, S => { const x = S.range(10, AR.w - 10), y = S.range(10, AR.h - 10); g.beginPath(); for (const a of [-0.35, 0, 0.35]) { g.moveTo(x, y); g.lineTo(x + Math.sin(a) * 12, y - Math.cos(a) * 12); } g.stroke(); });
      },
    },
    neon: {
      floor: '#0B0B1A', grid: null, mid: 'rgba(255,90,220,0.25)',
      texture: g => {
        g.lineWidth = 2;
        for (let x = 60; x < AR.w; x += 60) { g.strokeStyle = x % 240 === 0 ? 'rgba(80,220,255,0.20)' : 'rgba(80,220,255,0.07)'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, AR.h); g.stroke(); }
        for (let y = 60; y < AR.h; y += 60) { g.strokeStyle = y % 240 === 0 ? 'rgba(255,90,220,0.20)' : 'rgba(255,90,220,0.07)'; g.beginPath(); g.moveTo(0, y); g.lineTo(AR.w, y); g.stroke(); }
      },
    },
    temple: {
      floor: '#2A2620', grid: null, mid: 'rgba(255,230,180,0.10)',
      texture: g => {
        g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,0.35)';
        for (let y = 0; y < AR.h; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(AR.w, y); g.stroke(); for (let x = (y / 48) % 2 ? 0 : 48; x < AR.w; x += 96) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 48); g.stroke(); } }
        scatter(0x7E3, 22, S => { g.fillStyle = S.chance(0.5) ? 'rgba(255,230,180,0.05)' : 'rgba(0,0,0,0.10)'; g.fillRect(Math.floor(S.range(0, AR.w / 48)) * 48, Math.floor(S.range(0, AR.h / 48)) * 48, 48, 48); });
        const cx = AR.w / 2, cy = AR.h / 2; g.lineWidth = 4; g.strokeStyle = 'rgba(255,215,140,0.16)'; g.beginPath(); g.arc(cx, cy, 70, 0, TAU); g.stroke();
      },
    },
    graveyard: {
      floor: '#1A1822', grid: 'rgba(200,190,230,0.04)', mid: 'rgba(220,210,255,0.08)',
      texture: g => {
        scatter(0x6A7, 14, S => { g.beginPath(); g.ellipse(S.range(0, AR.w), S.range(0, AR.h), S.range(50, 100), S.range(26, 50), S.range(0, 3), 0, TAU); g.fillStyle = S.chance(0.5) ? 'rgba(120,110,160,0.08)' : 'rgba(0,0,0,0.18)'; g.fill(); });
        g.lineCap = 'round'; g.lineWidth = 2; g.strokeStyle = '#33303F';
        scatter(0x6A8, 50, S => { const x = S.range(10, AR.w - 10), y = S.range(10, AR.h - 10); g.beginPath(); for (const a of [-0.4, 0, 0.4]) { g.moveTo(x, y); g.lineTo(x + Math.sin(a) * 9, y - Math.cos(a) * 9); } g.stroke(); });
      },
    },
    moon: {
      floor: '#23252B', grid: 'rgba(230,230,240,0.04)', mid: 'rgba(240,240,250,0.10)',
      texture: g => {
        scatter(0x300, 28, S => { const x = S.range(0, AR.w), y = S.range(0, AR.h), r = S.range(8, 26); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fill(); g.beginPath(); g.arc(x - r * 0.15, y - r * 0.15, r, Math.PI * 1.0, Math.PI * 1.6); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.07)'; g.stroke(); });
      },
    },
  });
  Object.assign(OB_HP, { palm: 35, pine: 35, cactus: 25, deadtree: 30, snowrock: 70, tomb: 45, neonblock: 70 });
  Object.assign(OB_DUST, { palm: '#5B3A22', pine: '#E0F2FE', cactus: '#4E8A3A', deadtree: '#5B4636', snowrock: '#E0F2FE', tomb: '#8E8A99', neonblock: '#C084FC' });
  // the new colours, and their emojis for titles (see render.js)
  Object.assign(PALETTES, {
    MAGENTA: { c: '#E83FD1', d: '#8A1A7A', l: '#F9C2F0' },
    SKY: { c: '#4FC3F7', d: '#0B6A97', l: '#C9ECFC' },
    MINT: { c: '#3EE6A8', d: '#0E7F57', l: '#C2F8E2' },
    AMBER: { c: '#FFA62B', d: '#A35C00', l: '#FFE0AE' },
    CRIMSON: { c: '#C8102E', d: '#6E0718', l: '#F6A8B4' },
    NAVY: { c: '#3049B8', d: '#16236A', l: '#B9C5F5' },
    LAVENDER: { c: '#B79CFF', d: '#5E45B8', l: '#ECE4FF' },
    OLIVE: { c: '#9AAA33', d: '#4E5A12', l: '#E2EBAE' },
    ROSE: { c: '#FF7A9C', d: '#A8304F', l: '#FFD0DC' },
    SAND: { c: '#E3C07A', d: '#8A6B2E', l: '#F6E7C6' },
  });

  const ARMY_EXT = {
    // ----- setup -----
    initSys() {
      const o = this.opts;
      this.sys = { evo: !!o.evolution, champ: !!o.champions, traits: o.traits || 0, crits: !!o.crits, syn: !!o.synergies, weather: o.weather || 0, mods: o.modifiers || 0,
        portals: o.portals || 0, sudden: !!o.suddenDeath, extinct: !!o.extinction, loot: !!o.weaponDrops, destruct: !!o.destructible, powerups: !!o.powerups,
        transform: !!o.bossTransform, living: !!o.livingWeapons };
      this.sysOn = Object.values(this.sys).some(Boolean);
      this.SR = rng(((this.seed >>> 0) ^ 0x51C0DE5) >>> 0);
      this.mapMech = MAP_MECH[this.opts.map] || null;
      for (const o of this.obstacles) if (o.kind === 'void') o.void = true;
      this.ext = this.sysOn || !!this.mapMech || this.doc.some(d => d.forbidden || d.copycat || d.fuse || Object.keys(d.mix).concat(d.heavy || []).some(k => UNIT[k] && UNIT[k].ext));
      this.clouds = []; this.fires = []; this.fields = []; this.calls = []; this.spawnQ = []; this.beams = []; this.corpses = []; this.loot = []; this.rubble = []; this.bannerQ = [];
      this.fallen = [[], [], []]; this.copyAt = []; this.copyN = []; this.fused = []; this.possessDone = []; this.champOf = []; this.panic = [0, 0, 0];
      this.deaths = 0;
      this.xf = { titles: [], muts: [], bribes: 0, sheep: 0, revives: 0, raised: 0, walls: 0 };
      this.initCombat(); this.initTribeOpts();
    },
    initExt() {
      const F = this.fixed || this.target, S = this.SR;
      this.str0 = this.teamIds().map(t => this.strength(t));
      if (this.sys.syn) {
        this.syn = [{}, {}, {}];
        for (const t of this.teamIds()) {
          const c = {};
          for (const u of this.units) if (u.team === t) c[u.type] = (c[u.type] || 0) + 1;
          for (const wv of this.waves[t]) for (const k of wv.list) c[k] = (c[k] || 0) + 1;
          const s = SYNERGIES.find(x => x.ok(c));
          if (s) { this.syn[t] = s; this.xf.syn = s.name; this.bannerQ.push({ at: 1.4 + this.bannerQ.length * 1.7, text: `${TEAMS[t].name} SYNERGY: ${s.name}`, col: TEAMS[t].c }); }
        }
        for (const u of this.units) this.applySyn(u, UNIT[u.type]);
      }
      // weather and battle modifiers use their own dice, so turning them on doesn't change anything else
      if (this.sys.weather && S.chance(this.sys.weather)) this.weather = S.pick(['fog', 'rain', 'sandstorm', 'eclipse', 'bloodmoon']);
      if (this.sys.mods && S.chance(this.sys.mods)) {
        const list = ['lowgrav', 'fast', 'night'];
        if (this.units.some(u => UNIT[u.type].heal) || this.waves.some(w => w.some(v => v.list.some(k => UNIT[k].heal)))) list.push('reverse');
        this.mod = S.pick(list);
      }
      const WX = { fog: 'FOG ROLLS IN', rain: 'RAIN: FIRE IS WEAKER', sandstorm: 'SANDSTORM!', eclipse: 'ECLIPSE: THE DEAD RISE', bloodmoon: 'BLOOD MOON: KILLS HEAL' };
      const MX = { lowgrav: 'LOW GRAVITY!', fast: 'DOUBLE SPEED!', night: 'PERMANENT NIGHT', reverse: 'REVERSED HEALING!' };
      if (this.weather) { this.xf.weather = this.weather; this.bannerQ.unshift({ at: 1.2, text: WX[this.weather], col: '#BFE6FF' }); }
      if (this.mod) { this.xf.mod = this.mod; this.bannerQ.unshift({ at: 1.2, text: MX[this.mod], col: COL.gold }); }
      this.bannerQ.forEach((b, i) => { b.at = 1.2 + i * 1.7; });
      this.sysEv = [];
      if (this.sys.portals && S.chance(this.sys.portals)) this.sysEv.push({ type: 'portal', at: S.range(0.3, 0.42) * F });
      // (with pacing on, sudden death comes 12 s before the time limit instead, so it closes the battle out right at the end)
      if (this.sys.sudden) this.sysEv.push({ type: 'sudden', at: this.opts.pace && this.fixed ? this.fixed - 15 : 0.62 * F, kind: S.pick(this.N === 3 ? ['ring', 'meteors', 'boss'] : ['ring', 'lava', 'meteors', 'boss']) });
      if (this.sys.extinct) this.sysEv.push({ type: 'extinct', from: 0.4 * F, until: 0.62 * F });
      if (this.mapMech) this.mapInit();
    },
    // per-troop setup when it joins the battle
    extUnit(u, U) {
      this.ext = true;
      u.born = this.fightT;
      if (U.heads) u.heads = U.heads;
      if (U.revive) u.lives = U.revive;
      if (U.raise) this.hasRaise = true;
      if (U.aura) this.hasAura = true;
      if (U.soul) this.hasSmith = true;
      if (U.smash) this.titanOn = true;
      if (this.syn) this.applySyn(u, U);
      if (U.abil2) this.extUnit2(u, U);
      if (U.abil3) this.extUnit3(u, U);
      if (this.cmb || this.heroTeam >= 0) this.combatUnit(u, U);
      if (this.tribes) this.tribeUnit(u, U);
      if (this.sys && this.sys.traits && U.rank > 0 && !U.uncounted && this.SR.chance(this.sys.traits)) u.trait = this.SR.pick(['coward', 'explosive', 'vampiric', 'undying']);
    },
    applySyn(u, U) {
      const s = this.syn && this.syn[u.team]; if (!s || u.synDone) return;
      u.synDone = true;
      if (s.ranged && U.ranged && !U.lob) u.dmgK = (u.dmgK || 1) * s.ranged;
      if (s.pack && (u.type === 'wolfrider' || u.type === 'hellhound')) { u.spdK = 1.15; u.dmgK = (u.dmgK || 1) * 1.1; }
      if (s.drums && (u.type === 'orc' || u.type === 'berserker' || u.type === 'boarrider')) u.cdK = 0.85;
      if (s.turrets && u.type === 'turret') { u.max *= s.turrets; u.hp *= s.turrets; }
      if (s.nature && u.type === 'treant') u.regen = 1;
      if (s.arcane && (u.type === 'knight' || u.type === 'swordsman')) u.dmgK = (u.dmgK || 1) * 1.15;
      if (s.steel && (u.type === 'rifleman' || u.type === 'gunner' || u.type === 'grenadier')) u.synDef = 0.85;
      if (s.clan && u.type === 'ninja') u.spdK = 1.15;
    },
    // ----- statuses -----
    burn(o, dps, dur, by) {
      if (o.dead || UNIT[o.type].fireproof) return;
      if (this.fireG && by && !o.flying) this.ignite(o.x, o.y, 0.01);
      const T = this.fightT;
      o.burnD = o.burnT > T ? Math.max(o.burnD, dps) : dps; o.burnT = Math.max(o.burnT || 0, T + dur); o.burnBy = by;
    },
    poison(o, dps, dur, by) {
      if (o.dead || /^(robot|mech|tank|turret|golem|cannon)$/.test(o.type)) return;
      const T = this.fightT;
      o.poisD = o.poisT > T ? Math.max(o.poisD, dps) : dps; o.poisT = Math.max(o.poisT || 0, T + dur); o.poisBy = by;
    },
    slowDown(o, k, dur) {
      if (o.dead) return;
      const T = this.fightT, O = UNIT[o.type];
      if (O.rank === 0) k = Math.max(k, 0.7);
      o.slowK = o.slowT > T ? Math.min(o.slowK, k) : k; o.slowT = Math.max(o.slowT || 0, T + dur);
    },
    hitFx(o, F, by) {
      if (!o || o.dead) return;
      const s = by && this.syn && this.syn[by.team];
      if (F.burn) this.burn(o, F.burn * (s && s.fire || 1), 3, by);
      if (F.poison) this.poison(o, F.poison, 4, by);
      if (F.slow) this.slowDown(o, F.slow[0], F.slow[1]);
      if (by && by.mut === 'venom') this.poison(o, 0.8, 3, by);
    },
    // damage over time skips armour, crits and the white flash
    dot(o, amt, by) {
      o.hp -= amt;
      if (o.hp <= 0 && !o.dead) { this._dot = true; this.damage(o, 0.01, by || null); this._dot = false; }
    },
    heal(o, amt) {
      if (this.mod === 'reverse') { this.dot(o, amt * 0.7, null); o.flash = Math.max(o.flash, 0.5); return; }
      o.hp = Math.min(o.max, o.hp + amt);
    },
    // push a troop away from a point (it slides, then slows down)
    knock(o, fx, fy, amt) {
      const O = UNIT[o.type];
      if (o.dead || O.immovable || O.unstoppable) return;
      if (O.rank === 0) amt *= 0.3;
      if (this.mod === 'lowgrav' || this.zeroG > this.fightT) amt *= 2.5;
      const dx = o.x - fx, dy = o.y - fy, d = Math.hypot(dx, dy) || 1;
      o.kx = (o.kx || 0) + dx / d * amt * 7; o.ky = (o.ky || 0) + dy / d * amt * 7;
    },
    turn(u, ang, h) { let df = ang - u.face; df = Math.atan2(Math.sin(df), Math.cos(df)); const cap = 9 * h; u.face += clamp(df * Math.min(1, h * 12), -cap, cap); },
    // troops within r of a point (uses the spatial hash from the start of this tick)
    near(x, y, r) {
      const out = [], c0 = Math.floor((x - r - AR.x) / 64), c1 = Math.floor((x + r - AR.x) / 64), r0 = Math.floor((y - r - AR.y) / 64), r1 = Math.floor((y + r - AR.y) / 64), r2 = r * r;
      for (let i = Math.max(0, c0); i <= c1; i++) for (let j = Math.max(0, r0); j <= r1; j++) {
        const b = this.grid.get(i * 64 + j); if (!b) continue;
        for (const o of b) if (!o.dead && (o.x - x) ** 2 + (o.y - y) ** 2 < r2) out.push(o);
      }
      return out;
    },
    vanish(o) {
      if (o.dead) return;
      o.dead = true;
      if (!UNIT[o.type].uncounted) this.alive[o.team]--;
      this.burst(o.x, o.y, UNIT[o.type].decoy ? '#C084FC' : TEAMS[o.team].c, 6, 160, 0.4, 5);
    },
    switchTeam(o, team) {
      const old = o.team; if (old === team || o.dead) return;
      if (!UNIT[o.type].uncounted) { this.alive[old]--; this.alive[team]++; }
      o.team = team; o.target = null; o.retarget = 0; o.flag = false;
      this.gained = this.gained || [0, 0, 0]; if (team < 3) this.gained[team]++;
      for (const v of this.units) if (v.target === o) v.target = null;
    },
    // ----- modifiers used in the main loop -----
    dmgMod(u, dmg, from) {
      if (this._dot) return dmg;
      if (u.phased || u.ashT) return 0;
      const T = this.fightT;
      if (u.stoneT > T) return 0;
      let crit = false;
      if (from) {
        const F = UNIT[from.type];
        let k = from.dmgK || 1;
        if (from.auraDmg) k *= from.auraDmg;
        if (from.panicT > T || (this.panic[from.team] > T && !(from.crownT > T))) k *= 0.7;
        if (F.antiBig && (UNIT[u.type].rank === 0 || UNIT[u.type].mount)) k *= F.antiBig;
        if (F.rampage) k *= Math.min(1.8, 1 + this.deaths * 0.004);
        if ((this.weather === 'eclipse' || (this.dark && this.dark.k > 0.5)) && DARK[from.type]) k *= 1.25;
        if (from.bossK) k *= from.bossK;
        if (from.tileT > T) k *= 1.3;
        if (this.hill && this.hill.team === from.team) k *= this.hill.buff;
        if (u.duelist && from.duelist && this.duel && !this.duel.done) k *= this.duel.k;
        if (this.tribes) k *= this.tribeOut(u, from);
        if (this.wq) k *= this.worldDmg(u, from);
        if (this.cast3on) k *= this.dmg3(u, from);
        if (this.sys.crits && from.team !== u.team && !F.uncounted && this.SR.chance(0.07)) { k *= 2; crit = true; }
        dmg *= k;
      }
      let d = u.auraDef || 1;
      if (this.kingSafe && UNIT[u.type].king && T < this.kingSafe) d *= 0.25;
      if (this.tribes) d *= this.tribeIn(u, from);
      if (u.barkT > T) d *= 0.75;
      if (u.forged) d *= 0.8;
      if (u.synDef) d *= u.synDef;
      if (u.sheepT > T) d *= 1.5;
      if (u.planted) d *= 0.6;
      if (u.fleshed) d *= 1.6;
      if (u.weak && this._kind === u.weak) d *= 2;
      if (u.mut === 'spellward' && this._kind === 'blast') d *= 0.5;
      this._kind = null;
      dmg *= d;
      if (crit) {
        this.knock(u, from.x, from.y, 14); this.dmgNum(u, dmg, true); this.snd('crit', { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7 });
        if (u.hp - dmg <= 0 && (UNIT[u.type].rank === 0 || UNIT[u.type].cost >= 3) && this.camEv) this.camEv.push({ type: 'hitstop' });
      } else if ((UNIT[u.type].rank === 0 || u.boss) && dmg >= 2) this.dmgNum(u, dmg, false);
      return dmg;
    },
    // damage numbers: crits, and big hits on giants and bosses, at most about seven a second so the screen stays readable
    dmgNum(u, dmg, crit) {
      const T = this.fightT;
      if (!crit && T < (u.numAt || 0)) return;
      if (T >= (this.numT || 0)) { this.numT = T + 1; this.numN = 0; }
      if (this.numN >= (this.opts.ui >= 2 ? 2 : this.cmb ? 3 : 7)) return;
      this.numN++; u.numAt = T + 0.35;
      const v = Math.max(1, Math.round(dmg * 10));
      this.float(u.x + this.FX.range(-12, 12), u.y - u.r - 6, crit ? `${v}!` : String(v), crit ? '#FF9F1C' : '#FFFFFF', crit ? 34 : 24, 0.75);
    },
    cdMod(u) {
      const T = this.fightT; let k = u.auraHaste || 1;
      if (this.turboT > T) k *= 0.4;
      if (this.mod === 'fast') k *= 0.75;
      if (this.wq) k *= this.worldCd();
      if (u.slowT > T) k *= 1.25;
      if (u.panicT > T || (this.panic[u.team] > T && !(u.crownT > T))) k *= 1.25;
      if (u.cdK) k *= u.cdK;
      return k;
    },
    spdMod(u, U) {
      if (u.planted || u.rooted) return 0;
      const T = this.fightT; let k = u.spdK || 1;
      if (this.moon && u.team !== this.moon.team) k *= 1 - 0.2 * this.moon.k;
      if (this.wq) k *= this.worldSpd(u);
      if (u.slowT > T) k *= u.slowK;
      if (u.poisT > T) k *= 0.85;
      if (u.panicT > T || (this.panic[u.team] > T && !(u.crownT > T))) k *= 0.8;
      if (this.mod === 'fast') k *= 1.5;
      if (this.turboT > T) k *= 1.3;
      if (u.vines) k *= 0.6;
      if (this.tribes && u.tribe) k *= this.tribeSpd(u);
      return k;
    },
    rangeMod(u, U) { let k = 1; if (this.dark && u.team !== this.dark.team) k *= 1 - 0.35 * this.dark.k; if (this.weather === 'fog') k *= 0.65; if (this.mod === 'night') k *= 0.75; if (this.iceK) k *= 0.85; return k; },
    pickTarget(u, U) {
      const T = this.fightT, conf = u.confT > T, hunter = U.hunter, hunts = u.hunts;
      let best = null, bd = Infinity;
      // tribe tactics: shooters focus one target, the chief's guards go for whoever threatens him, flankers hunt shooters and healers
      if (this.tribes && u.tribe && !conf) { const f = this.tribeTarget(u, U); if (f) return f; }
      const flank = this.tribes && u.tribe && u.tribe.tactic === 'flank';
      // smarter fighting: don't all pile onto one enemy; prefer enemies in front (your own lane); fast fighters go for shooters
      const sm = this.smart && !conf ? this.smartPick(u, U) : null;
      for (const o of this.units) {
        if (o.dead || o.phased || o.ashT || o === u || o.cloak) continue;
        if (o.team === u.team && !conf) continue;
        if (hunts !== undefined && o.team !== hunts) continue;
        const O = UNIT[o.type];
        let d = (o.x - u.x) ** 2 + (o.y - u.y) ** 2;
        if (o.hidden && U.ranged && d > 14400) continue;
        if (O.decoy) d *= 0.45;
        if (hunter === 'ranged' && (O.ranged || O.healer) && d < 250000) d *= 0.25;
        if (hunter === 'commander' && (O.commander || O.rank === 0 || O.cost >= 5)) d *= 0.2;
        if (flank && (O.ranged || O.healer) && d < 360000) d *= 0.3;
        if (sm) d = this.smartScore(u, o, O, d, sm);
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    },
    // a druid's pulse: heals everyone around it and gives them bark skin
    pulseHeal(u, U) {
      let n = 0;
      for (const o of this.near(u.x, u.y, U.healRange)) { if (o.team !== u.team || o === u) continue; if (o.hp < o.max) { this.heal(o, U.heal); o.healFlash = 1; n++; } o.barkT = this.fightT + 3; }
      u.healFx = 1; u.healTo = null;
      if (n) this.snd('heal', { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7 });
    },
    // horse archers ride round their target while they shoot
    kite(u, nx, ny, d, RG, spd) {
      if (u.kiteSide === undefined) u.kiteSide = u.gait > Math.PI ? 1 : -1;
      const m = 70;
      if ((u.x < AR.x + m || u.x > AR.x + AR.w - m || u.y < AR.y + m || u.y > AR.y + AR.h - m) && this.fightT >= (u.kiteFlip || 0)) { u.kiteSide *= -1; u.kiteFlip = this.fightT + 1.5; }
      const s = u.kiteSide, back = d < RG * 0.6 ? -0.7 : d > RG * 0.9 ? 0.4 : 0;
      this.ndx = (-ny * s * 0.8 + nx * back) * spd; this.ndy = (nx * s * 0.8 + ny * back) * spd;
    },
    tagShot(a, u, U) {
      if (U.shot) a.kind = U.shot;
      if (U.burn || U.poison || U.slow || u.mut === 'venom') a.fx = U;
      if (this.weather === 'sandstorm' && !LOBS[a.kind]) { const j = this.R.range(-0.14, 0.14), c = Math.cos(j), s = Math.sin(j), vx = a.vx; a.vx = vx * c - a.vy * s; a.vy = vx * s + a.vy * c; }
    },
    shootAt(u, o, dmg, v) {
      const dx = o.x - u.x, dy = o.y - u.y, d = Math.hypot(dx, dy) || 1;
      this.arrows.push({ tracer: true, team: u.team, x: u.x + dx / d * (u.r + 4), y: u.y + dy / d * (u.r + 4), vx: dx / d * v, vy: dy / d * v, life: d / v * 1.4 + 0.1, dmg, bolt: false, pierce: 0, from: u });
    },
    lobAt(u, x, y, kind, dmg, splash, v) {
      const T = Math.max(0.15, Math.hypot(x - u.x, y - u.y) / v);
      this.arrows.push({ team: u.team, kind, x: u.x, y: u.y, sx: u.x, sy: u.y, tx: x, ty: y, t: 0, T, dmg, splash, vx: (x - u.x) / T, vy: (y - u.y) / T, from: u });
    },
    // ----- melee hooks -----
    meleeHit(u, U, t, hit) {
      this._kind = 'blade';
      const T = this.fightT, pan = (u.x - AR.x) / AR.w * 1.4 - 0.7;
      if (U.charge && (u.runT || 0) >= 0.55) {
        hit *= U.charge; u.runT = 0; u.charged = true;
        this.knock(t, u.x, u.y, (U.knock || 22) * 1.5);
        if (U.mount && !U.flying) u.backT = T + 0.75;
        this.burst(t.x, t.y, '#C9A36A', 6, 220, 0.4, 6); this.snd('stomp', { pan });
        if (T >= (this.chargeSaid || 0)) { this.chargeSaid = T + 3; this.float(u.x, u.y - u.r - 12, 'CHARGE!', COL.gold, 30, 0.8); }
      }
      if (this.cmb && this.cmb.moves) hit = this.combatHit(u, U, t, hit);
      if (u.cloak) { hit *= 4; u.cloak = false; u.cloakAt = T + 5; this.float(t.x, t.y - t.r - 12, 'BACKSTAB!', '#E5E7EB', 26, 0.8); this.burst(u.x, u.y, '#3A3F4B', 8, 160, 0.4, 6); }
      if (u.strikeK) { hit *= u.strikeK; u.strikeK = 0; this.float(t.x, t.y - t.r - 12, 'REAPED!', '#C084FC', 28, 0.8); this.burst(t.x, t.y, '#8B5CF6', 8, 240, 0.4, 6); }
      return hit;
    },
    meleeFx(u, U, t) {
      if (U.knock && !u.charged && !U.splash) this.knock(t, u.x, u.y, U.knock);
      if (U.splash && U.knock) for (const o of this.near(t.x, t.y, U.splash + 30)) if (o.team !== u.team) this.knock(o, t.x, t.y, U.knock * 0.6);
      u.charged = false;
      this.hitFx(t, U, u);
      if (u.trait === 'vampiric' || u.mut === 'vampiric') { u.hp = Math.min(u.max, u.hp + U.dmg * 0.35); u.drainFx = 1; }
      if (u.heads > 1) {
        // the other heads bite other troops in reach
        const list = this.near(u.x, u.y, u.r + U.reach + 30).filter(o => o.team !== u.team && o !== t && !o.flying && !o.phased);
        u.bites = [t]; u.biteT = this.fightT;
        for (let k = 0; k < u.heads - 1 && list.length; k++) { const o = list.splice(Math.floor(this.R.next() * list.length), 1)[0]; this._kind = 'blade'; this.damage(o, U.dmg * this.dmgMul, u); u.bites.push(o); }
      }
      if (this.cmb && this.cmb.moves && !t.dead) this.combatFx(u, U, t);
      if (u.stomp) {
        for (const o of this.near(t.x, t.y, u.stomp)) if (o.team !== u.team && o !== t) { this._kind = 'blade'; this.damage(o, U.dmg * 0.6 * this.dmgMul, u); this.knock(o, t.x, t.y, 16); }
        this.shake(6); this.snd('stomp', { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7 });
      }
    },
    // bosses change at 75%, 50% and 25% health: a shockwave, harder hits, more speed (and at 25%, help arrives)
    bossCheck(u) {
      if (u.dead || u.hp <= 0) return;
      const f = u.hp / u.max, ph = f < 0.25 ? 3 : f < 0.5 ? 2 : f < 0.75 ? 1 : 0;
      if (ph <= (u.phaseN || 0)) return;
      u.phaseN = ph;
      u.bossK = 1 + ph * 0.2;
      if (u.spdK0 === undefined) u.spdK0 = u.spdK || 1;
      u.spdK = u.spdK0 * (1 + ph * 0.1);
      if (u.type === 'hydra' && ph >= 2) u.heads = 5;
      for (const o of this.near(u.x, u.y, u.r + 90)) if (o.team !== u.team && !o.phased) { this._kind = 'blast'; this.damage(o, 2.5, u); this.knock(o, u.x, u.y, 40); }
      if (ph === 3 && u.team < 3) {
        const base = this.doc[u.team].base || 'soldier';
        for (let k = 0; k < 3; k++) { const a = k / 3 * TAU; this.spawnQ.push({ at: this.fightT + 0.3, team: u.team, type: base, x: u.x + Math.cos(a) * (u.r + 18), y: u.y + Math.sin(a) * (u.r + 18) }); }
      }
      this.banner(`${TEAMS[u.team].name} ${labelOf(u.type)} · PHASE ${ph + 1}`, TEAMS[u.team].c, 1.6);
      this.burst(u.x, u.y, '#FF6B3D', 16, 360, 0.5, 8); this.shake(10); this.snd('roar', { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7 });
      if (this.camEv && ph >= 2) this.camEv.push({ type: 'spot', follow: u, prio: 72, dur: 1.8, z: 1.8, slow: ph === 3 });
    },
    // ----- being hit -----
    onHit(u, from, dmg) {
      if (this.cast3on) this.hit3(u, from, dmg);
      if (this.tribes) this.tribeHit(u, from, dmg);
      if (this.evo) this.evoHit(u, from, dmg);
      const U = UNIT[u.type], F = UNIT[from.type], T = this.fightT;
      // mirror knight: turns into a copy of the troop that hit it
      if ((U.mirror || u.mirror) && !u.dead && T >= (u.mirrorAt || 0) && from.type !== u.type && F.rank !== 0 && !F.uncounted && !F.healer && !F.decoy) {
        u.mirror = true; u.mirrorAt = T + 2.5;
        u.type = from.type; u.r = F.r; u.m = F.r * F.r; u.flying = !!F.flying; u.cd = Math.min(u.cd, F.cd);
        this.burst(u.x, u.y, '#DCE6F2', 10, 220, 0.4, 6);
        if (T >= (this.mirSaid || 0)) { this.mirSaid = T + 2; this.float(u.x, u.y - u.r - 12, 'MIRRORED!', '#DCE6F2', 26, 0.8); }
      }
      // mirror king: whoever hits it can get a mirrored copy fighting for the king
      if (U.copies && !from.dead && T >= (u.copyAt || 0) && (u.made || 0) < 14 && F.rank !== 0 && !F.uncounted && !F.decoy && this.R.chance(0.35)) {
        u.copyAt = T + 0.8; u.made = (u.made || 0) + 1;
        this.spawnQ.push({ at: T + 0.25, team: u.team, type: from.type, x: clamp(2 * u.x - from.x, AR.x + 20, AR.x + AR.w - 20), y: clamp(2 * u.y - from.y, AR.y + 20, AR.y + AR.h - 20), mimic: 'mirror' });
        this.snd('zap', { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7 });
      }
      // spikes mutation: melee attackers get hurt back
      if (u.mut === 'spikes' && !this._thorn && !F.ranged && !from.dead) { this._thorn = true; this.damage(from, dmg * 0.3, u); this._thorn = false; }
    },
    // ----- cheating death: the Immortal Fraud, the phoenix, the undying trait -----
    cheatDeath(u, from) {
      if (this.cast3on) {
        if (this.timeSave(u)) return true;
        if (UNIT[u.type].deathbomb && !u.bombed) { u.bombed = true; this.explode({ team: u.team, kind: 'bomb', x: u.x, y: u.y, splash: 70, dmg: 4, from: u }); }
      }
      const U = UNIT[u.type], T = this.fightT;
      if (U.fraud && u.lives > 0) {
        u.lives--; const n = U.revive - u.lives;
        u.weak = ['blade', 'shot', 'blast'][n % 3];
        u.dmgK = (u.dmgK || 1) * 1.4;
        if (u.lives === 0) { u.r = 30; u.m = 900; u.max *= 2; u.boss = true; u.title = 'TRUE FORM'; this.banner('THE FRAUD\'S TRUE FORM!', TEAMS[u.team].c, 2); if (this.camEv) this.camEv.push({ type: 'spot', follow: u, prio: 83, dur: 2.4, z: 1.9, slow: true }); }
        else { u.r += 2; u.m = u.r * u.r; this.banner(`THE FRAUD RETURNS · ${n}/${U.revive}`, TEAMS[u.team].c, 1.5); }
        u.hp = u.max; u.flash = 1; this.xf.revives++;
        this.burst(u.x, u.y, COL.gold, 18, 320, 0.6, 8); this.snd('evolve');
        return true;
      }
      if (U.revive && !U.fraud && u.lives > 0) {
        // the phoenix falls into ashes and rises again
        u.lives--; u.hp = 0.01; u.ashT = T + 2.2; u.phased = true; u.vx = 0; u.vy = 0; u.flying = false;
        this.burst(u.x, u.y, '#FF9F1C', 20, 320, 0.7, 9); this.burst(u.x, u.y, '#6B7280', 10, 120, 1, 10, -30);
        this.banner(`${TEAMS[u.team].name} PHOENIX FALLS...`, TEAMS[u.team].c, 1.6);
        if (this.camEv) this.camEv.push({ type: 'spot', follow: u, prio: 81, dur: 3.2, z: 2, slow: true });
        return true;
      }
      if (u.trait === 'undying' && !u.undyingUsed) { u.undyingUsed = true; u.hp = 1; this.float(u.x, u.y - u.r - 10, 'UNDYING!', COL.gold, 24, 0.9); return true; }
      return false;
    },
    // ----- after a troop dies -----
    onDeath(u, from) {
      const U = UNIT[u.type], T = this.fightT, killer = from && from.team !== u.team ? from : null;
      if (!U.uncounted) this.deaths++;
      if (!U.uncounted && U.rank !== 0 && u.team < 3) { const f = this.fallen[u.team]; f.push({ type: u.type, x: u.x, y: u.y }); if (f.length > 30) f.shift(); }
      if (this.hasRaise && !U.uncounted && U.rank !== 0) { this.corpses.push({ x: u.x, y: u.y, t: T }); if (this.corpses.length > 50) this.corpses.shift(); }
      if (this.hasSmith && !U.uncounted) for (const s of this.units) if (!s.dead && UNIT[s.type].soul && (s.x - u.x) ** 2 + (s.y - u.y) ** 2 < 57600) this.collectSoul(s, u);
      // morale: losing a general (whole army) or a standard bearer (troops near it) makes troops panic
      if (U.commander && killer) {
        if (U.commander === 2) { this.panic[u.team] = T + 3; this.banner(`${TEAMS[u.team].name} GENERAL HAS FALLEN!`, this.foeCol(u, from), 2); if (this.camEv) this.camEv.push({ type: 'spot', x: u.x, y: u.y, prio: 79, dur: 2, z: 2, slow: true }); }
        else for (const o of this.near(u.x, u.y, 170)) if (o.team === u.team && !(o.crownT > T)) o.panicT = T + 1.8;
      }
      if (killer && !killer.dead) {
        const K = UNIT[killer.type];
        // the Thousand-Man takes the body in
        if (K.grow) {
          killer.r = Math.min(54, killer.r + 1.2); killer.m = killer.r * killer.r; killer.max += 8 * this.hpScale; killer.hp += 8 * this.hpScale; killer.dmgK = (killer.dmgK || 1) + 0.06;
          (killer.bodies || (killer.bodies = [])).push(TEAMS[u.team].c); if (killer.bodies.length > 26) killer.bodies.shift();
          if (killer.kills === 8) killer.stomp = 40; if (killer.kills === 16) { killer.stomp = 60; this.banner('THE THOUSAND-MAN GROWS!', TEAMS[killer.team].c, 1.6); }
        }
        if (K.empower && U.cost >= 3) { killer.dmgK = (killer.dmgK || 1) * 1.12; killer.r = Math.min(28, killer.r + 1); killer.m = killer.r * killer.r; this.float(killer.x, killer.y - killer.r - 12, 'STRONGER', '#E5484D', 24, 0.8); }
        this.evolve(killer, u);
        if (this.sys.champ && (killer.kills || 0) >= 10 && !killer.champ && K.rank !== 0 && killer.team < 3 && !(this.champOf[killer.team] && !this.champOf[killer.team].dead)) this.makeChampion(killer);
      }
      if (this.sys.loot && U.rank !== 0 && !U.uncounted && this.loot.length < 10 && this.SR.chance(0.22)) this.loot.push({ x: u.x, y: u.y, end: T + 7, kind: U.ranged ? (U.bullet || U.laser ? 'gun' : 'bow') : 'sword', a: this.FX.range(0, TAU) });
      if (u.trait === 'explosive') this.explode({ team: u.team, kind: 'bomb', x: u.x, y: u.y, splash: 44, dmg: 5, from: u });
      if (U.garrison) {
        // the walking fortress falls and its garrison pours out
        const list = ['archer', 'archer', 'archer', 'archer', 'knight', 'knight'];
        list.forEach((k, i) => { const a = i / list.length * TAU; this.spawnQ.push({ at: T + 0.3 + i * 0.08, team: u.team, type: k, x: u.x + Math.cos(a) * 34, y: u.y + Math.sin(a) * 34 }); });
        this.banner('THE GARRISON POURS OUT!', TEAMS[u.team].c, 1.8);
      }
      if (U.revive && !U.fraud) this.fires.push({ x: u.x, y: u.y, r: 110, end: T + 4, t0: T, team: u.team, by: u, dps: 2 });
      if (u.team === MONSTERS && U.rank === 0) this.banner('THE MONSTER IS SLAIN!', this.foeCol(u, from), 1.6);
      if (u.champ && killer) this.banner(`${u.champ} HAS FALLEN!`, this.foeCol(u, from), 1.8);
      this.onDeath2(u, from);
      this.onDeath3(u, from);
      if (this.tribes) this.onDeath4(u, from);
    },
    collectSoul(s, v) {
      s.souls = (s.souls || 0) + 1;
      this.beams.push({ x0: v.x, y0: v.y, x1: s.x, y1: s.y, t0: this.fightT, life: 0.4, col: '#7CF3FF', w: 3 });
      if (s.souls < 4) return;
      s.souls -= 4;
      // forge: the three nearest allies that aren't forged yet get soul armour and a soul blade
      const list = this.near(s.x, s.y, 220).filter(o => o.team === s.team && o !== s && !o.forged && !UNIT[o.type].uncounted)
        .sort((a, b) => ((a.x - s.x) ** 2 + (a.y - s.y) ** 2) - ((b.x - s.x) ** 2 + (b.y - s.y) ** 2)).slice(0, 3);
      for (const o of list) { o.forged = true; o.dmgK = (o.dmgK || 1) * 1.25; this.burst(o.x, o.y, '#7CF3FF', 6, 160, 0.4, 5, -40); }
      if (list.length) { this.snd('clang', { pan: (s.x - AR.x) / AR.w * 1.4 - 0.7 }); s.muzzle = 1; }
    },
    // ----- evolution, slayers and champions -----
    evolve(u, v) {
      if (!u || u.dead || u.team >= 3) return;
      const U = UNIT[u.type], V = UNIT[v.type];
      if (U.rank === 0 || U.uncounted || V.decoy) return;
      const forb = !!this.doc[u.team].forbidden;
      if (!this.sys.evo && !forb) return;
      (u.ate || (u.ate = [])).push(v.type);
      const pan = (u.x - AR.x) / AR.w * 1.4 - 0.7;
      if (V.rank === 0) {
        if (u.slayer && forb) { this.godEater(u, v); return; }
        if (!u.slayer) {
          u.slayer = true;
          u.title = `${labelOf(v.type).replace(/^(THE |ANCIENT |WAR |WALKING |BONE |DREAD |BOULDER |LIVING |TIMELINE |HOURGLASS |KAMIKAZE )/, '')} SLAYER`;
          u.dmgK = (u.dmgK || 1) * (forb ? 1.8 : 1.25); u.max += (forb ? 40 : 12) * this.hpScale; u.hp = u.max; u.r += forb ? 4 : 1; u.m = u.r * u.r;
          this.banner(`${forb ? 'A PEASANT' : TEAMS[u.team].name} IS NOW ${u.title}!`, TEAMS[u.team].c, 2);
          this.burst(u.x, u.y, COL.gold, 16, 280, 0.6, 7); this.snd('evolve', { pan });
          if (this.camEv) this.camEv.push({ type: 'spot', follow: u, prio: 78, dur: 2.2, z: 2.1, slow: true });
          this.xf.titles.push(u.title);
        }
        return;
      }
      const k = u.kills || 0, need2 = forb ? 2 : 4, need3 = forb ? 5 : 8;
      if ((u.lvl || 1) < 2 && k >= need2) this.levelUp(u, 2, forb);
      else if (u.lvl === 2 && k >= need3) this.levelUp(u, 3, forb);
    },
    levelUp(u, lvl, forb) {
      u.lvl = lvl;
      const g = forb ? 1.35 : 1.2;
      u.dmgK = (u.dmgK || 1) * g; u.max *= g; u.hp = Math.min(u.max, u.hp + u.max * 0.3); u.r += lvl === 2 ? 1 : 2; u.m = u.r * u.r;
      let name = forb ? (lvl === 2 ? 'FIGHTER' : 'CHAMPION') : (lvl === 2 ? 'VETERAN' : 'ELITE');
      if (lvl === 3) { u.mut = this.mutationFor(u); this.applyMut(u); name += ' · ' + MUT_LABEL[u.mut]; this.xf.muts.push(u.mut); }
      this.float(u.x, u.y - u.r - 14, name, lvl === 3 ? COL.gold : '#FFFFFF', lvl === 3 ? 26 : 22, 1);
      this.burst(u.x, u.y, COL.gold, 10, 200, 0.5, 6, -60); this.snd('evolve', { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7 });
    },
    // what a troop mutates into depends on what it killed (kill fliers and grow wings, kill mages and shrug off spells)
    mutationFor(u) {
      const ate = u.ate || [];
      if (ate.some(k => UNIT[k].flying)) return 'wings';
      if (ate.some(k => /wizard|necromancer|warlock|alchemist|illusionist|druid/.test(k))) return 'spellward';
      if (ate.includes('vampire')) return 'vampiric';
      return this.SR.pick(['spikes', 'regen', 'venom', 'swift']);
    },
    applyMut(u) {
      if (u.mut === 'wings') u.flying = true;
      if (u.mut === 'regen') u.regen = (u.regen || 0) + 1;
      if (u.mut === 'swift') u.spdK = (u.spdK || 1) * 1.25;
    },
    godEater(u, v) {
      if (u.god) return;
      u.god = true; u.title = 'GOD EATER';
      u.r = Math.max(u.r, 30); u.m = u.r * u.r; u.max += 100 * this.hpScale; u.hp = u.max; u.dmgK = (u.dmgK || 1) * 2.5;
      this.banner('A PEASANT BECAME A GOD EATER!', TEAMS[u.team].c, 2.4);
      this.burst(u.x, u.y, COL.gold, 30, 420, 0.8, 9); this.shake(14); this.snd('roar');
      if (this.camEv) this.camEv.push({ type: 'spot', follow: u, prio: 86, dur: 2.8, z: 2.1, slow: true });
      this.xf.titles.push('GOD EATER'); this.xf.godEater = true;
    },
    makeChampion(u) {
      const S = this.SR;
      u.champ = MODERNISH[u.type] ? `${S.pick(CALLSIGNS)}-${S.int(2, 9)}` : `${S.pick(CHAMP_FIRST)} ${S.pick(CHAMP_EPITHET)}`;
      this.champOf[u.team] = u;
      u.max *= 1.25; u.hp = Math.min(u.max, u.hp + u.max * 0.4); u.dmgK = (u.dmgK || 1) * 1.15;
      this.banner(`CHAMPION: ${u.champ}`, TEAMS[u.team].c, 2);
      this.snd('bell');
      if (this.camEv) this.camEv.push({ type: 'spot', follow: u, prio: 62, dur: 2.4, z: 1.9 });
      if (!this.xf.champ || u.kills > this.xf.champ.kills) this.xf.champ = { name: u.champ, type: u.type, kills: u.kills };
    },
    // ----- per-troop abilities, every tick -----
    preUnit(u, U, h) {
      const T = this.fightT;
      if (this.frozenT > T && !(u.walkT > T)) return true; // world event: time stops for everyone but the time-walkers
      if (u.kx !== undefined) {
        u.x += u.kx * h; u.y += u.ky * h;
        const dk = Math.exp(-7 * h); u.kx *= dk; u.ky *= dk;
        if (Math.abs(u.kx) + Math.abs(u.ky) < 5) { u.kx = undefined; u.ky = undefined; }
      }
      if ((this.cmb || this.mode) && this.preUnit3(u, U, h)) return true;
      if (u.ashT) {
        if (T >= u.ashT) {
          // the phoenix rises from its ashes in a burst of flame
          u.ashT = 0; u.phased = false; u.flying = true; u.hp = u.max * 0.6;
          this.explode({ team: u.team, kind: 'fireball', x: u.x, y: u.y, splash: 95, dmg: 4, from: u });
          for (const o of this.near(u.x, u.y, 110)) if (o.team !== u.team) this.burn(o, 1.5, 3, u);
          this.burst(u.x, u.y, '#FFD23F', 24, 420, 0.7, 9);
          this.banner(`${TEAMS[u.team].name} PHOENIX RISES!`, TEAMS[u.team].c, 1.8); this.snd('roar');
        }
        return true;
      }
      if (u.fuseTo) {
        const f = u.fuseTo, dx = f.x - u.x, dy = f.y - u.y, d = Math.hypot(dx, dy) || 1, s = Math.min(d, 300 * h);
        u.phased = true; u.x += dx / d * s; u.y += dy / d * s;
        if (T >= f.at) this.vanish(u);
        return true;
      }
      if (u.burnT > T) { if (!U.fireproof) this.dot(u, u.burnD * h * (this.weather === 'rain' ? 0.5 : 1) * (U.fireweak || 1), u.burnBy); if (u.dead) return true; }
      if (u.poisT > T) { this.dot(u, u.poisD * h, u.poisBy); if (u.dead) return true; }
      const rg = (U.regen || 0) + (u.regen || 0);
      if (rg && !(u.burnT > T) && u.hp < u.max) { this.heal(u, rg * h * this.hpScale); if (u.dead) return true; }
      if (U.decoy) { if (T > u.decoyEnd) this.vanish(u); return true; }
      if (u.frozeT > T) { u.vx = 0; u.vy = 0; return true; }
      if ((u.grabbed || u.thrown || u.ghostEnd || u.stoneT || u.asleep || u.charmT) && this.preUnit2(u, U, h)) return true;
      if (u.sheepT > T) {
        // a sheep can't fight: it just wanders about
        const a = u.gait + T * 0.7; u.vx = Math.cos(a) * 18; u.vy = Math.sin(a) * 18; u.x += u.vx * h; u.y += u.vy * h; this.turn(u, a, h);
        return true;
      }
      if (u.phased) {
        if (u.phaseTo) { const dx = u.phaseTo.x - u.x, dy = u.phaseTo.y - u.y, d = Math.hypot(dx, dy) || 1, s = Math.min(d, 560 * h); u.x += dx / d * s; u.y += dy / d * s; this.turn(u, Math.atan2(dy, dx), h); }
        if (T >= u.phaseEnd) { u.phased = false; u.phaseTo = null; u.strikeK = 2.5; u.cd = 0; this.burst(u.x, u.y, '#8B5CF6', 10, 220, 0.4, 6); }
        return true;
      }
      const t = u.target && !u.target.dead ? u.target : null;
      if (u.backT > T && t) {
        // cavalry wheels away after a charge, to build up speed for the next one
        const dx = u.x - t.x, dy = u.y - t.y, d = Math.hypot(dx, dy) || 1, sp = U.speed * this.speedMul * 0.95, k = Math.min(1, 7 * h);
        u.vx += (dx / d * sp - u.vx) * k; u.vy += (dy / d * sp - u.vy) * k; u.x += u.vx * h; u.y += u.vy * h; this.turn(u, Math.atan2(u.vy, u.vx), h);
        if (U.charge) u.runT = (u.runT || 0) + h * 0.5;
        return true;
      }
      if (u.trait === 'coward' && u.hp < u.max * 0.4 && t) {
        const dx = u.x - t.x, dy = u.y - t.y, d = Math.hypot(dx, dy) || 1;
        if (d < 110) {
          const sp = U.speed * this.speedMul, k = Math.min(1, 7 * h);
          u.vx += (dx / d * sp - u.vx) * k; u.vy += (dy / d * sp - u.vy) * k; u.x += u.vx * h; u.y += u.vy * h;
          if (T >= (u.fearSaid || 0)) { u.fearSaid = T + 3; this.float(u.x, u.y - u.r - 8, 'RUN!', '#BFE6FF', 20, 0.7); }
          return true;
        }
      }
      if (U.abil) this.ability(u, U, h, t);
      if (U.abil2 && !u.dead) this.ability2(u, U, h, t);
      if (U.abil3 && !u.dead && this.ability3(u, U, h, t)) return true;
      return u.dead;
    },
    ability(u, U, h, t) {
      const T = this.fightT, pan = (u.x - AR.x) / AR.w * 1.4 - 0.7;
      if (U.charge) {
        const v = Math.hypot(u.vx, u.vy);
        if (t && v > U.speed * 0.55 && Math.hypot(t.x - u.x, t.y - u.y) > u.r + t.r + 24) u.runT = (u.runT || 0) + h;
        else if (v < U.speed * 0.3) u.runT = Math.max(0, (u.runT || 0) - h * 2);
      }
      if (U.trample && T >= (u.trampleAt || 0) && Math.hypot(u.vx, u.vy) > 15) {
        u.trampleAt = T + 0.25;
        for (const o of this.near(u.x, u.y, u.r + 24)) {
          if (o.team === u.team || o.flying || UNIT[o.type].rank === 0 || o.phased) continue;
          if (Math.hypot(o.x - u.x, o.y - u.y) < u.r + o.r + 2) { this._kind = 'blade'; this.damage(o, U.trample * 0.5 * this.dmgMul, u); this.knock(o, u.x, u.y, 14); }
        }
      }
      if (U.smash && T >= (u.smashAt || 0)) {
        u.smashAt = T + 0.2;
        for (const ob of this.obstacles.slice()) { if (ob.void || ob.hard) continue; const p = this.closestOn(ob, u.x, u.y); if (Math.hypot(p.x - u.x, p.y - u.y) < u.r + 14) this.hurtObstacle(ob, 9, p.x, p.y); }
      }
      if (U.volley && T >= (u.volleyAt || 0)) {
        // archers on the walls shoot more targets; the gate cannon fires every few seconds
        u.volleyAt = T + U.cd;
        const list = this.near(u.x, u.y, U.range).filter(o => o.team !== u.team && !UNIT[o.type].decoy && !o.phased && o !== t);
        for (let k = 0; k < U.volley - 1 && list.length; k++) this.shootAt(u, list.splice(Math.floor(this.R.next() * list.length), 1)[0], U.dmg, 620);
        if (t && !U.bell && T >= (u.cannonAt || 1.5)) { u.cannonAt = T + 3.2; this.lobAt(u, t.x, t.y, 'cannonball', 5, 46, 760); u.muzzle = 1; this.snd('cannon', { pan }); }
      }
      if (U.raise && T >= (u.abT || 0)) {
        u.abT = T + U.raise;
        const s = this.syn && this.syn[u.team];
        // two (three with the Dark Ritual synergy) at a time, and at most 40 raised per army in a battle
        this.raisedN = this.raisedN || [0, 0, 0];
        let n = Math.min(2 + (s && s.ritual ? 1 : 0), 40 - (this.raisedN[u.team] || 0)); const n0 = n;
        for (const c of this.corpses) {
          if (n <= 0) break;
          if (c.used || T - c.t > 10 || (c.x - u.x) ** 2 + (c.y - u.y) ** 2 > 32400) continue;
          c.used = true; n--; this.raisedN[u.team]++;
          this.spawnQ.push({ at: T + 0.6, team: u.team, type: 'skeleton', x: c.x, y: c.y, rise: true });
          this.beams.push({ x0: u.x, y0: u.y, x1: c.x, y1: c.y, t0: T, life: 0.6, col: '#7CFFB0', w: 4 });
          this.xf.raised++;
        }
        if (n < n0) { u.muzzle = 1; this.snd('groan', { pan }); }
      }
      if (U.gadget && t && T >= (u.abT || 0)) {
        u.abT = T + U.gadget;
        const d = Math.hypot(t.x - u.x, t.y - u.y) || 1;
        if (d < 460 && this.units.filter(o => o.owner === u && !o.dead).length < 2) {
          const nx = (t.x - u.x) / d, ny = (t.y - u.y) / d, p = { x: u.x + nx * 28, y: u.y + ny * 28, r: 14 };
          if (this.obstacles.length) for (let k = 0; k < 3; k++) this.pushOut(p);
          const tu = this.addUnit(u.team, 'turret', clamp(p.x, AR.x + 16, AR.x + AR.w - 16), clamp(p.y, AR.y + 16, AR.y + AR.h - 16));
          tu.owner = u; tu.face = Math.atan2(ny, nx);
          this.burst(tu.x, tu.y, '#C9A36A', 8, 160, 0.4, 6); this.snd('thunk', { pan });
        }
      }
      if (U.decoys && t && T >= (u.abT || 0)) {
        u.abT = T + U.decoys;
        const dx = t.x - u.x, dy = t.y - u.y, d = Math.hypot(dx, dy) || 1;
        if (d < 420 && this.units.filter(o => o.owner === u && !o.dead).length < 4) {
          for (const sd of [-1, 1]) this.makeDecoy(u.team, u.x + dx * 0.5 - dy / d * sd * 40, u.y + dy * 0.5 + dx / d * sd * 40, 'illusion', 7, u);
          u.muzzle = 1; this.snd('phase', { pan });
        }
      }
      if (U.phase && t && !u.phased && T >= (u.abT || 0)) {
        const dx = t.x - u.x, dy = t.y - u.y, d = Math.hypot(dx, dy) || 1;
        if (d < 300 && d > 50) {
          u.abT = T + U.phase; u.phased = true; u.phaseEnd = T + 0.85;
          u.phaseTo = { x: clamp(t.x + dx / d * (t.r + u.r + 6), AR.x + u.r, AR.x + AR.w - u.r), y: clamp(t.y + dy / d * (t.r + u.r + 6), AR.y + u.r, AR.y + AR.h - u.r) };
          this.burst(u.x, u.y, '#8B5CF6', 10, 200, 0.4, 6); this.snd('phase', { pan });
        }
      }
      if (U.gravity && t && T >= (u.abT || 0)) {
        u.abT = T + 1;
        const cx = u.x + Math.cos(u.face) * 70, cy = u.y + Math.sin(u.face) * 70;
        if (this.near(cx, cy, 170).filter(o => o.team !== u.team && !UNIT[o.type].immovable).length >= 4) {
          u.abT = T + U.gravity; u.muzzle = 1;
          this.fields.push({ kind: 'pull', x: cx, y: cy, r: 170, t0: T, end: T + 1.3, team: u.team, pow: 170 });
          this.snd('portal', { pan });
        }
      }
      if (U.trap && t && Math.hypot(t.x - u.x, t.y - u.y) - t.r - u.r < 14) {
        // the false soldier springs its trap
        this.explode({ team: u.team, kind: 'spikes', x: u.x, y: u.y, splash: 62, dmg: 6, from: u });
        for (let k = 0; k < 3; k++) { const a = u.face + Math.PI + (k - 1) * 0.9; this.makeDecoy(u.team, u.x + Math.cos(a) * 36, u.y + Math.sin(a) * 36, 'scarecrow', 6, null); }
        if (T >= (this.trapSaid || 0)) { this.trapSaid = T + 4; this.float(u.x, u.y - 22, 'IT\'S A TRAP!', '#FF6B3D', 30, 1); }
        u.sprung = true; this.damage(u, u.hp + 99, null);
        return;
      }
      if (U.plant) {
        const d = t ? Math.hypot(t.x - u.x, t.y - u.y) : 1e9;
        if (!u.planted && d < 260) { u.planted = true; u.shell = 18; this.burst(u.x, u.y, '#7A6A55', 8, 160, 0.5, 6); this.snd('thunk', { pan }); }
        else if (u.planted && d > 420) { u.planted = false; u.shell = 0; }
      }
      if (U.unmake && T >= (u.abT || 0)) {
        u.abT = T + U.unmake;
        let best = null, bv = 0;
        for (const o of this.near(u.x, u.y, 420)) {
          const O = UNIT[o.type];
          if (o.team === u.team || o.sheepT > T || O.uncounted || O.decoy || o.phased) continue;
          if (O.rank === 0 && o.fleshed && !o.flying) continue;
          const v = O.cost + (O.rank === 0 ? 50 : 0); if (v > bv) { bv = v; best = o; }
        }
        if (best) {
          this.beams.push({ x0: u.x, y0: u.y, x1: best.x, y1: best.y, t0: T, life: 0.7, col: '#C084FC', w: 9 });
          u.muzzle = 1; this.snd('zap', { pan });
          if (UNIT[best.type].rank !== 0) {
            best.sheepT = T + 7; best.vx = 0; best.vy = 0; this.xf.sheep++;
            this.burst(best.x, best.y, '#FFFFFF', 10, 160, 0.5, 7); this.float(best.x, best.y - 24, 'BAAA!', '#FFFFFF', 26, 0.9);
            if (!this.sheepSaid) { this.sheepSaid = true; this.banner('TURNED INTO A SHEEP!', TEAMS[u.team].c, 1.6); }
          } else if (best.flying) {
            best.flying = false; best.grounded = true; this.damage(best, best.max * 0.12, u); this.shake(12);
            this.banner(`THE ${labelOf(best.type)} FALLS!`, TEAMS[u.team].c, 1.6);
            if (this.camEv) this.camEv.push({ type: 'spot', x: best.x, y: best.y, prio: 76, dur: 2, z: 1.9, slow: true });
          } else {
            best.fleshed = true; this.banner('STEEL TURNS TO FLESH!', TEAMS[u.team].c, 1.6);
            if (this.camEv) this.camEv.push({ type: 'spot', x: best.x, y: best.y, prio: 66, dur: 1.8, z: 1.9 });
          }
        }
      }
      if (U.bribe && T >= (u.abT || 0)) {
        u.abT = T + U.bribe;
        if ((u.bribes || 0) < 10) {
          let best = null, bd = 144400;
          for (const o of this.units) {
            if (o.dead || o.team === u.team || o.team === MONSTERS) continue;
            const O = UNIT[o.type]; if (O.rank === 0 || O.commander || O.uncounted || O.decoy || O.bribe) continue;
            const d = (o.x - u.x) ** 2 + (o.y - u.y) ** 2; if (d < bd) { bd = d; best = o; }
          }
          if (best) {
            u.bribes = (u.bribes || 0) + 1; this.xf.bribes++;
            this.switchTeam(best, u.team); best.bribed = T;
            for (let k = 0; k < 6; k++) this.parts.push({ x: u.x, y: u.y, vx: (best.x - u.x) * 2 + this.FX.range(-60, 60), vy: (best.y - u.y) * 2 + this.FX.range(-60, 60), life: 0.5, age: 0, size: 8, color: COL.gold, grav: 0 });
            this.float(best.x, best.y - 22, 'BRIBED!', COL.gold, 26, 1); this.snd('coin', { pan });
            if (u.bribes === 1) this.banner('THE BILLIONAIRE IS BUYING!', TEAMS[u.team].c, 1.6);
          }
        }
      }
      if (U.well && t && T >= (u.abT || 0) && Math.hypot(t.x - u.x, t.y - u.y) < 320) {
        u.abT = T + U.well; u.muzzle = 1;
        this.fields.push({ kind: 'well', x: u.x, y: u.y, follow: u, r: 300, t0: T, end: T + 1.6, team: u.team, pow: 210, slam: { dmg: 4, r: 100, from: u } });
        this.snd('portal', { pan });
        if (!u.wellSaid) { u.wellSaid = true; this.banner('THE GRAVITY TYRANT PULLS!', TEAMS[u.team].c, 1.6); if (this.camEv) this.camEv.push({ type: 'spot', follow: u, prio: 64, dur: 2.2, z: 1.5 }); }
      }
      if (U.shepherd && T >= (u.abT || 0)) {
        u.abT = T + U.shepherd;
        const cand = this.near(u.x, u.y, 440).filter(o => o.team !== u.team && !UNIT[o.type].decoy);
        let best = null, bn = 2;
        for (let k = 0; k < cand.length; k += Math.max(1, cand.length / 24 | 0)) { const c = cand[k]; let n = 0; for (const o of cand) if ((o.x - c.x) ** 2 + (o.y - c.y) ** 2 < 4900) n++; if (n > bn) { bn = n; best = c; } }
        if (best) {
          const age = T - (u.born || 0);
          this.calls.push({ x: best.x, y: best.y, at: T + 1, t0: T, r: 38 + Math.min(42, age * 1.2), dmg: 5 + Math.min(4, age * 0.12), team: u.team, from: u, kind: 'meteor' });
          u.muzzle = 1; this.snd('meteor', { pan });
          if (!u.metSaid) { u.metSaid = true; this.banner('THE SHEPHERD CALLS THE SKY', TEAMS[u.team].c, 1.6); }
        }
      }
      if (U.glitch && T >= (u.abT || 0)) {
        u.abT = T + U.glitch;
        const R = this.R, kind = R.pick(['SWAP', 'TURBO', 'ZERO-G', 'CLONE', 'BLINK']);
        this.glitchFx = T + 0.5; this.snd('glitch', { pan });
        if (kind === 'SWAP') {
          const mine = this.units.filter(o => o.team === u.team && !o.dead && UNIT[o.type].rank !== 0 && !o.flying && !UNIT[o.type].uncounted);
          const theirs = this.units.filter(o => o.team !== u.team && !o.dead && UNIT[o.type].rank !== 0 && !o.flying && !UNIT[o.type].uncounted);
          for (let k = 0; k < Math.min(6, mine.length, theirs.length); k++) { const a = mine[Math.floor(R.next() * mine.length)], b = theirs[Math.floor(R.next() * theirs.length)]; const x = a.x, y = a.y; a.x = b.x; a.y = b.y; b.x = x; b.y = y; a.wp = null; b.wp = null; }
        } else if (kind === 'TURBO') this.turboT = T + 3;
        else if (kind === 'ZERO-G') this.zeroG = T + 3;
        else if (kind === 'CLONE') { if (this.units.filter(o => o.type === 'glitch' && o.team === u.team && !o.dead).length < 3) this.spawnQ.push({ at: T + 0.1, team: u.team, type: 'glitch', x: u.x + 22, y: u.y }); }
        else { const e = this.units.filter(o => o.team !== u.team && !o.dead); if (e.length) { const o = e[Math.floor(R.next() * e.length)]; u.x = clamp(o.x + 28, AR.x + u.r, AR.x + AR.w - u.r); u.y = o.y; u.wp = null; } }
        this.banner(`GLITCH: ${kind}!`, '#7CF3FF', 1.3);
      }
      if (U.possess && !this.possessDone[u.team]) {
        if (u.castOn) {
          const o = u.castOn;
          if (o.dead || o.team === u.team) u.castOn = null;
          else if (T >= u.castT) {
            u.castOn = null; this.possessDone[u.team] = true;
            this.switchTeam(o, u.team); o.possessed = true;
            this.banner(`${TEAMS[u.team].name} POSSESSES THE ${labelOf(o.type)}!`, TEAMS[u.team].c, 2.2);
            this.burst(o.x, o.y, '#A855F7', 22, 360, 0.7, 8); this.snd('roar');
            if (this.camEv) this.camEv.push({ type: 'spot', follow: o, prio: 84, dur: 2.6, z: 1.9, slow: true });
            this.xf.possess = o.type;
          }
        } else if (T >= (u.abT || 0)) {
          u.abT = T + 1;
          let best = null, bv = 4.5;
          for (const o of this.near(u.x, u.y, 380)) { if (o.team === u.team || o.team === MONSTERS) continue; const O = UNIT[o.type]; if (O.uncounted || O.decoy || O.fraud || o.phased) continue; const v = O.cost + (O.rank === 0 ? 30 : 0); if (v > bv) { bv = v; best = o; } }
          if (best) { u.castOn = best; u.castT = T + 1.1; this.snd('portal', { pan }); }
        }
      }
    },
    makeDecoy(team, x, y, look, life, owner) {
      const p = { x, y, r: 11 };
      if (this.obstacles.length) for (let k = 0; k < 3; k++) this.pushOut(p);
      const o = this.addUnit(team, 'decoy', clamp(p.x, AR.x + 12, AR.x + AR.w - 12), clamp(p.y, AR.y + 12, AR.y + AR.h - 12));
      o.look = look; o.decoyEnd = this.fightT + life; o.owner = owner; o.face = owner ? owner.face : o.face;
      this.burst(o.x, o.y, look === 'scarecrow' ? '#C2A878' : '#C084FC', 6, 140, 0.4, 5);
      return o;
    },
    // ----- obstacles that break, craters that stay -----
    hurtObstacle(ob, dmg, x, y, fire) {
      if (ob.hp === undefined) ob.hp = OB_HP[ob.kind] || 60;
      if (ob.hp > 900) return;
      if (fire && (ob.kind === 'tree' || ob.kind === 'pine' || ob.kind === 'palm' || ob.kind === 'deadtree')) ob.burning = Math.max(ob.burning || 0, this.fightT + 4);
      ob.hp -= dmg;
      if (this.FX.chance(0.5)) this.burst(x, y, OB_DUST[ob.kind] || '#8A8F98', 3, 160, 0.4, 5);
      if (ob.hp <= 0) this.breakObstacle(ob);
    },
    breakObstacle(ob) {
      const i = this.obstacles.indexOf(ob); if (i < 0) return;
      this.obstacles.splice(i, 1);
      const cx = ob.circle ? ob.x : (ob.x0 + ob.x1) / 2, cy = ob.circle ? ob.y : (ob.y0 + ob.y1) / 2, sz = ob.circle ? ob.r : Math.max(ob.x1 - ob.x0, ob.y1 - ob.y0) / 2;
      this.rubble.push({ x: cx, y: cy, r: sz, kind: ob.kind, ob });
      this.burst(cx, cy, OB_DUST[ob.kind] || '#8A8F98', 18, 340, 0.7, 9); this.burst(cx, cy, '#5B6472', 10, 200, 0.9, 11, -30);
      this.shake(8); this.snd('stone', { pan: (cx - AR.x) / AR.w * 1.4 - 0.7 });
      this.mapLayer = null; this.mapHi = null;
      for (const u of this.units) { u.wp = null; u.cover = null; }
      this.xf.walls++;
      if (!this.wallSaid) { this.wallSaid = true; this.banner(ob.kind === 'tree' || ob.kind === 'pine' ? 'THE FOREST BURNS!' : 'THE WALLS CRUMBLE!', COL.gold, 1.5); }
    },
    crater(x, y, r) {
      if ((this.craters = (this.craters || 0) + 1) > 40) return;
      for (const [c, S] of [[this.ground, 1], [this.groundHi, 2]]) {
        if (!c) continue;
        const g = c.getContext('2d'), cx = (x - AR.x) * S, cy = (y - AR.y) * S;
        g.beginPath(); g.arc(cx, cy, r * S, 0, TAU); g.fillStyle = 'rgba(0,0,0,0.22)'; g.fill();
        g.beginPath(); g.arc(cx, cy, r * 0.6 * S, 0, TAU); g.fillStyle = 'rgba(0,0,0,0.22)'; g.fill();
        g.beginPath(); g.arc(cx - r * 0.12 * S, cy - r * 0.12 * S, r * 0.92 * S, Math.PI * 0.9, Math.PI * 1.6); g.lineWidth = 3 * S; g.strokeStyle = 'rgba(255,255,255,0.07)'; g.stroke();
      }
    },
    explodeFx(a) {
      const T = this.fightT;
      if (a.kind === 'flask') { if (this.clouds.length < 14) this.clouds.push({ x: a.x, y: a.y, r: a.splash, end: T + 4, t0: T, team: a.team, by: a.from }); this.snd('splash', { pan: (a.x - AR.x) / AR.w * 1.4 - 0.7 }); }
      if (a.kind === 'hellfire' && this.fires.length < 16) this.fires.push({ x: a.x, y: a.y, r: a.splash * 0.85, end: T + 3, t0: T, team: a.team, by: a.from, dps: 1.2 });
      if (a.kind === 'spikes') this.burst(a.x, a.y, '#D9DEE6', 14, 380, 0.4, 6);
      if (a.kind === 'frostbolt') { this.burst(a.x, a.y, '#DCEFFF', 12, 300, 0.45, 6); for (const o of this.near(a.x, a.y, a.splash)) if (o.team !== a.team && UNIT[o.type].rank !== 0 && this.R.chance(0.2)) o.frozeT = T + 1.2; }
      if (this.sys.destruct || this.titanOn) {
        for (const ob of this.obstacles.slice()) {
          if (ob.hard || ob.void) continue;
          const p = this.closestOn(ob, a.x, a.y), d = Math.hypot(p.x - a.x, p.y - a.y);
          if (d < a.splash) this.hurtObstacle(ob, a.dmg * 2.2 * (1 - d / a.splash * 0.5), p.x, p.y, a.kind === 'fireball' || a.kind === 'hellfire' || a.kind === 'meteor');
        }
        if (BIG_BLAST[a.kind]) this.crater(a.x, a.y, a.splash * 0.55);
      }
    },
    // ----- the rest of each tick -----
    postStep(h) {
      const T = this.fightT;
      if ((this.hasAura || this.crownOn > T - 0.3) && T >= (this.auraAt || 0)) { this.auraAt = T + 0.25; this.refreshAuras(); }
      if (this.clouds.length || this.fires.length) {
        for (const c of this.clouds) for (const o of this.near(c.x, c.y, c.r)) if (o.team !== c.team) { this.poison(o, 1.0, 0.8, c.by); this.slowDown(o, 0.6, 0.5); }
        for (const f of this.fires) for (const o of this.near(f.x, f.y, f.r)) if (o.team !== f.team && !o.flying) this.burn(o, f.dps, 1, f.by);
        this.clouds = this.clouds.filter(c => T < c.end); this.fires = this.fires.filter(f => T < f.end);
      }
      for (const f of this.fields) {
        if (f.follow && !f.follow.dead) { f.x = f.follow.x; f.y = f.follow.y; }
        const k = clamp((T - f.t0) / 0.3, 0, 1);
        for (const o of this.near(f.x, f.y, f.r)) {
          if (o.team === f.team || UNIT[o.type].immovable || o === f.follow || o.phased) continue;
          const dx = f.x - o.x, dy = f.y - o.y, d = Math.hypot(dx, dy) || 1;
          if (d < 24 + o.r) continue;
          const s = Math.min(f.pow * k * h * (UNIT[o.type].rank === 0 ? 0.3 : 1), d - 20);
          o.x += dx / d * s; o.y += dy / d * s;
        }
        if (T >= f.end && !f.done) {
          f.done = true;
          if (f.slam) { this.explode({ team: f.team, kind: 'slam', x: f.x, y: f.y, splash: f.slam.r, dmg: f.slam.dmg, from: f.slam.from }); for (const o of this.near(f.x, f.y, f.slam.r + 60)) if (o.team !== f.team) this.knock(o, f.x, f.y, 45); this.shake(14); }
          if (f.blast) { this.explode({ team: f.team, kind: 'bomb', x: f.x, y: f.y, splash: f.blast.r, dmg: f.blast.dmg, from: null }); for (const o of this.near(f.x, f.y, f.blast.r + 90)) if (o.team !== f.team) this.knock(o, f.x, f.y, 80); this.shake(18); }
        }
      }
      if (this.fields.length) this.fields = this.fields.filter(f => !f.done);
      if (this.calls.length) { for (const c of this.calls) if (!c.done && T >= c.at) { c.done = true; this.explode({ team: c.team, kind: c.kind, x: c.x, y: c.y, splash: c.r, dmg: c.dmg, from: c.from }); } this.calls = this.calls.filter(c => !c.done); }
      if (this.spawnQ.length) {
        for (const s of this.spawnQ) {
          if (s.done || T < s.at) continue;
          s.done = true;
          const U = UNIT[s.type], p = { x: s.x, y: s.y, r: U.r };
          if (this.obstacles.length && !U.flying) for (let k = 0; k < 3; k++) this.pushOut(p);
          const o = this.addUnit(s.team, s.type, clamp(p.x, AR.x + U.r, AR.x + AR.w - U.r), clamp(p.y, AR.y + U.r, AR.y + AR.h - U.r));
          if (s.mimic) o.mimic = s.mimic;
          if (s.hpK) { o.max *= s.hpK; o.hp = o.max; }
          if (s.hp) o.hp = Math.min(o.max, s.hp * o.max);
          if (s.hunts !== undefined) { o.hunts = s.hunts; o.ancient = true; }
          if (s.hollow) o.hollow = true;
          if (s.ghost) { o.ghost = true; o.ghostEnd = T + 14; }
          if (s.team < 3) { this.gained = this.gained || [0, 0, 0]; this.gained[s.team]++; }
          this.burst(o.x, o.y, s.rise ? '#7CFFB0' : s.portal ? '#C084FC' : COL.gold, s.big ? 24 : 8, s.big ? 360 : 180, 0.5, s.big ? 9 : 6, -40);
          if (s.rise) this.snd('groan', { pan: (o.x - AR.x) / AR.w * 1.4 - 0.7 });
          if (s.big) this.shake(12);
        }
        this.spawnQ = this.spawnQ.filter(s => !s.done);
      }
      for (const t of this.teamIds()) { const d = this.doc[t]; if (d.copycat) this.copycatTick(t); if (d.fuse) this.fuseTick(t); }
      for (const b of this.bannerQ) if (!b.done && T >= b.at) { b.done = true; this.banner(b.text, b.col, 1.6); }
      if (this.sysEv) for (const ev of this.sysEv) if (!ev.done) this['sx_' + ev.type](ev, h);
      if (this.ring) this.ringTick(h);
      if (this.lava) this.lavaTick(h);
      if (this.zeroG > T) for (const o of this.units) if (!o.dead && !UNIT[o.type].immovable) { o.x += Math.cos(o.gait + T * 2.2) * 34 * h; o.y += Math.sin(o.gait * 1.3 + T * 1.9) * 34 * h; }
      if (this.loot.length && T >= (this.lootAt || 0)) { this.lootAt = T + 0.1; this.lootTick(); }
      if (this.mapMech) this.mapTick(h);
      if (this.beams.length) this.beams = this.beams.filter(b => T - b.t0 < b.life);
      if (T >= (this.cleanAt || 0)) {
        // a side with no troops left loses its turrets and decoys too
        this.cleanAt = T + 0.25;
        const tot = this.totals();
        for (const o of this.units) if (!o.dead && o.team < 3 && UNIT[o.type].uncounted && tot[o.team] === 0) this.vanish(o);
      }
      this.postStep2(h);
      this.postStep3(h);
      if (this.tribes) this.postStep4(h);
      if (this.wq) this.worldTick(h);
      if (this.fireG) this.fireTick();
      if (this.swarms) this.cast3Tick(h);
    },
    refreshAuras() {
      const T = this.fightT;
      for (const u of this.units) { u.auraDmg = undefined; u.auraDef = undefined; u.auraHaste = undefined; }
      for (const s of this.units) {
        if (s.dead) continue;
        const A = UNIT[s.type].aura, crown = s.crownT > T;
        if (!A && !crown) continue;
        const r = crown ? 190 : A.r;
        for (const o of this.near(s.x, s.y, r)) {
          if (o.team !== s.team) continue;
          if (crown) o.auraDmg = Math.max(o.auraDmg || 1, 1.3);
          if (A && A.dmg) o.auraDmg = Math.max(o.auraDmg || 1, A.dmg);
          if (A && A.def) o.auraDef = Math.min(o.auraDef || 1, A.def);
          if (A && A.haste) o.auraHaste = Math.min(o.auraHaste || 1, A.haste);
        }
        if (A && A.haste && T >= (s.drumAt || 0)) { s.drumAt = T + 2.2; this.snd('drum', { pan: (s.x - AR.x) / AR.w * 1.4 - 0.7 }); }
      }
    },
    lootTick() {
      const T = this.fightT;
      // weapons nobody picked up come alive and attack everyone (rules.systems.livingWeapons)
      if (this.sys.living) for (const l of this.loot) if (!l.taken && !l.woke && T >= l.end - 0.1 && (this.bladesN || 0) < 4) {
        l.woke = true; if (T < 0.35 * (this.fixed || this.target) || !this.SR.chance(0.3)) continue;
        l.taken = true; this.bladesN = (this.bladesN || 0) + 1;
        this.spawnQ.push({ at: T, team: MONSTERS, type: 'livingblade', x: l.x, y: l.y });
        if (!this.bladeSaid) { this.bladeSaid = true; this.banner('THE WEAPONS COME ALIVE!', TEAMS[MONSTERS].c, 1.6); }
        this.xf.living = true;
      }
      this.loot = this.loot.filter(l => T < l.end && !l.taken);
      for (const l of this.loot) for (const o of this.near(l.x, l.y, 24)) {
        const O = UNIT[o.type];
        if (o.armed || O.rank === 0 || O.uncounted || O.healer || o.sheepT > T) continue;
        l.taken = true; o.armed = l.kind; o.dmgK = (o.dmgK || 1) * 1.25;
        this.float(o.x, o.y - o.r - 10, 'ARMED UP', COL.gold, 22, 0.7);
        break;
      }
    },
    copycatTick(t) {
      const T = this.fightT, F = this.fixed || this.target;
      if (this.copyAt[t] === undefined) this.copyAt[t] = 0.16 * F;
      if (T < this.copyAt[t]) return;
      this.copyAt[t] = T + 0.2 * F;
      if ((this.copyN[t] || 0) >= 4) return;
      const cats = this.units.filter(o => o.team === t && o.type === 'copycat' && !o.dead); if (!cats.length) return;
      let best = null;
      for (const o of this.units) { if (o.dead || o.team === t || o.team === MONSTERS) continue; const O = UNIT[o.type]; if (O.uncounted || O.decoy || O.fraud || O.healer) continue; if (!best || O.cost > UNIT[best.type].cost) best = o; }
      if (!best) return;
      const c = cats[Math.floor(this.R.next() * cats.length)], big = UNIT[best.type].rank === 0;
      this.copyN[t] = (this.copyN[t] || 0) + 1;
      for (let k = 0, n = big ? 1 : 3; k < n; k++) this.spawnQ.push({ at: T + 0.5, team: t, type: best.type, x: c.x + (k - (n - 1) / 2) * 26, y: c.y, mimic: 'copy', big });
      this.banner(`COPYCATS COPY THE ${labelOf(best.type)}!`, TEAMS[t].c, 2);
      this.burst(c.x, c.y, '#C084FC', 14, 260, 0.5, 7); this.snd('glitch');
      if (this.camEv) this.camEv.push({ type: 'spot', x: c.x, y: c.y, prio: 57, dur: 2, z: 1.9 });
      this.xf.copied = best.type;
    },
    fuseTick(t) {
      const T = this.fightT, F = this.fixed || this.target;
      if (this.fused[t] || T < 0.3 * F || T < (this.fuseAt || 0)) return;
      this.fuseAt = T + 0.5;
      const sk = this.units.filter(o => o.team === t && o.type === 'skeleton' && !o.dead && !o.fuseTo);
      if (sk.length < 16) { if (T > 0.6 * F) this.fused[t] = true; return; }
      this.fused[t] = true;
      let cx = 0, cy = 0; for (const o of sk) { cx += o.x; cy += o.y; } cx /= sk.length; cy /= sk.length;
      sk.sort((a, b) => ((a.x - cx) ** 2 + (a.y - cy) ** 2) - ((b.x - cx) ** 2 + (b.y - cy) ** 2));
      const p = { x: cx, y: cy, r: 40 }; if (this.obstacles.length) for (let k = 0; k < 3; k++) this.pushOut(p);
      for (const o of sk.slice(0, 12)) o.fuseTo = { x: p.x, y: p.y, at: T + 0.9 };
      this.spawnQ.push({ at: T + 0.95, team: t, type: 'bonecolossus', x: p.x, y: p.y, big: true });
      this.banner('12 SKELETONS FUSE!', TEAMS[t].c, 2.2);
      this.snd('rumble');
      if (this.camEv) this.camEv.push({ type: 'spot', x: p.x, y: p.y, prio: 82, dur: 2.6, z: 1.7, slow: true });
      this.xf.fusion = true;
    },
    // ----- system events: portals, sudden death, extinction -----
    sx_portal(ev) {
      const T = this.fightT;
      if (T < ev.at) return;
      ev.done = true;
      const S = this.SR, cx = AR.x + AR.w / 2, cy = AR.y + AR.h / 2;
      const pack = S.pick([['troll', 'troll', 'imp', 'imp', 'imp', 'imp'], ['cyclops'], ['wolfrider', 'wolfrider', 'wolfrider', 'wolfrider', 'wolfrider'], ['golem', 'imp', 'imp', 'imp'], ['demon', 'demon', 'hellhound', 'hellhound'], ['hydra']]);
      pack.forEach((k, i) => { const a = i / pack.length * TAU; this.spawnQ.push({ at: T + 0.8 + i * 0.15, team: MONSTERS, type: k, x: cx + Math.cos(a) * (pack.length > 1 ? 30 : 0), y: cy + Math.sin(a) * (pack.length > 1 ? 30 : 0), portal: true, big: UNIT[k].rank === 0 }); });
      this.portal = { x: cx, y: cy, t0: T, end: T + 3.5 };
      this.banner('A PORTAL OPENS!', '#A855F7', 1.6); this.bannerQ.push({ at: T + 1.7, text: 'MONSTERS ATTACK EVERYONE!', col: TEAMS[MONSTERS].c });
      this.snd('portal'); this.snd('roar');
      if (this.camEv) this.camEv.push({ type: 'spot', x: cx, y: cy, prio: 77, dur: 2.6, z: 1.6, slow: true });
      this.xf.portal = pack[0];
    },
    sx_sudden(ev) {
      const T = this.fightT;
      if (T < ev.at) return;
      ev.done = true;
      // only when nobody is close to losing yet
      const alive = this.teamIds().filter(t => this.alive[t] + this.reserve[t] > 0);
      if (alive.length < 2 || alive.some(t => this.strength(t) / (this.str0[t] || 1) < 0.25)) return;
      const cx = AR.x + AR.w / 2, cy = AR.y + AR.h / 2;
      this.xf.sudden = ev.kind;
      if (!this.chapter(`SUDDEN DEATH: ${{ ring: 'THE ARENA SHRINKS', lava: 'THE LAVA RISES', meteors: 'METEOR STORM', boss: 'A TITAN AWAKENS' }[ev.kind]}`, '#E5484D')) this.banner('SUDDEN DEATH!', '#E5484D', 1.5);
      if (!this.ui2) this.bannerQ.push({ at: T + 1.6, text: { ring: 'THE ARENA SHRINKS!', lava: 'THE LAVA RISES!', meteors: 'METEOR STORM!', boss: 'A TITAN AWAKENS!' }[ev.kind], col: COL.gold });
      this.snd('alarm');
      if (ev.kind === 'ring') this.ring = { t0: T, dur: 12, r0: 700, r1: 250 };
      else if (ev.kind === 'lava') this.lava = { t0: T, dur: 12, max: 300 };
      else if (ev.kind === 'meteors') {
        if (!this.ER) this.ER = rng(((this.seed >>> 0) ^ 0xA1D80F) >>> 0);
        this.events = this.events || [];
        this.events.push({ type: 'meteors', at: T + 0.5, style: 'meteors', t: 0 }, { type: 'meteors', at: T + 3, style: 'meteors', t: 0 });
      } else {
        this.spawnQ.push({ at: T + 1, team: MONSTERS, type: 'titan', x: cx, y: cy, portal: true, big: true, hpK: 0.8 });
        this.portal = { x: cx, y: cy, t0: T, end: T + 3 };
        this.snd('portal');
      }
      if (this.camEv) this.camEv.push({ type: 'spot', x: cx, y: cy, prio: 74, dur: 2.4, z: ev.kind === 'boss' ? 1.6 : 1.04 });
    },
    ringTick(h) {
      const T = this.fightT, g = this.ring, k = clamp((T - g.t0) / g.dur, 0, 1), r = g.r0 + (g.r1 - g.r0) * k * k * (3 - 2 * k), cx = AR.x + AR.w / 2, cy = AR.y + AR.h / 2;
      g.r = r;
      for (const o of this.units) {
        if (o.dead) continue;
        const dx = o.x - cx, dy = o.y - cy, d = Math.hypot(dx, dy) || 1;
        if (d > r) { this.dot(o, 5 * h * this.hpScale, null); o.x -= dx / d * 70 * h; o.y -= dy / d * 70 * h; }
      }
    },
    lavaTick(h) {
      const T = this.fightT, L = this.lava, k = clamp((T - L.t0) / L.dur, 0, 1), w = L.max * k * k * (3 - 2 * k);
      L.w = w;
      for (const o of this.units) {
        if (o.dead || o.flying || UNIT[o.type].fireproof) continue;
        if (o.x < AR.x + w) { this.dot(o, 6 * h * this.hpScale, null); o.x += 70 * h; }
        else if (o.x > AR.x + AR.w - w) { this.dot(o, 6 * h * this.hpScale, null); o.x -= 70 * h; }
      }
    },
    sx_extinct(ev) {
      const T = this.fightT;
      if (T < ev.from || T < (ev.next || 0)) return;
      if (T > ev.until) { ev.done = true; return; }
      ev.next = T + 1;
      const ids = this.teamIds().filter(t => this.alive[t] + this.reserve[t] > 0); if (ids.length < 2) return;
      // only for a real wipe-out in the making: the leader still has most of its army and everyone else is down to a fraction of theirs
      const s = ids.map(t => this.strength(t)), fr = ids.map((t, i) => s[i] / (this.str0[t] || 1)), m = s.indexOf(Math.max(...s));
      if (fr[m] < 0.6 || !s.every((v, i) => i === m || (v * 4 < s[m] && fr[i] < 0.3))) return;
      ev.done = true;
      // one army is crushing the rest: an ancient hunter wakes up and goes after it
      const team = ids[m], cx = AR.x + AR.w / 2, cy = AR.y + AR.h / 2;
      this.spawnQ.push({ at: T + 1, team: MONSTERS, type: 'titan', x: cx, y: cy, portal: true, big: true, hunts: team, hpK: 0.7 });
      this.portal = { x: cx, y: cy, t0: T, end: T + 3 };
      this.banner('EXTINCTION EVENT!', '#A855F7', 1.6);
      this.bannerQ.push({ at: T + 1.7, text: `IT HUNTS ${TEAMS[team].name}!`, col: TEAMS[MONSTERS].c });
      this.snd('portal'); this.snd('roar');
      if (this.camEv) this.camEv.push({ type: 'spot', x: cx, y: cy, prio: 78, dur: 2.6, z: 1.6, slow: true });
      this.xf.extinct = TEAMS[team].name;
    },
    // ----- the new supply-drop power-ups -----
    powerup(kind, ev, team) {
      if (kind === 'clone' || kind === 'ghosts') return this.powerup2(kind, ev, team);
      const T = this.fightT, name = TEAMS[team].name, S = this.SR;
      const foes = this.units.filter(o => !o.dead && o.team !== team);
      if (kind === 'freeze') {
        for (const o of foes) o.frozeT = T + 3;
        this.freezeFx = T + 3; this.snd('freeze');
        return `${name} FREEZES TIME!`;
      }
      if (kind === 'portal') {
        // a squad steps out of a portal behind the enemy lines
        const doc = this.doc[team], keys = Object.keys(doc.mix).filter(k => UNIT[k] && !UNIT[k].healer && UNIT[k].rank !== 0 && !UNIT[k].commander && !UNIT[k].uncounted && !UNIT[k].bribe);
        const elite = keys.length ? keys.reduce((a, b) => (UNIT[b].cost > UNIT[a].cost ? b : a)) : doc.base || 'soldier', n = clamp(Math.round(16 / UNIT[elite].cost), 3, 8);
        let px, py;
        if (this.N === 2) { px = clamp(ev.x, AR.x + 120, AR.x + AR.w - 120); py = team === 0 ? AR.y + AR.h - 90 : AR.y + 90; }
        else { const ids = this.teamIds().filter(t => t !== team); const st = ids.map(t => this.strength(t)), f = ids[st.indexOf(Math.max(...st))], a = this.homeAngle(f); px = AR.x + AR.w / 2 + Math.cos(a) * 380; py = AR.y + AR.h / 2 + Math.sin(a) * 380; }
        for (let k = 0; k < n; k++) { const a = k / n * TAU; this.spawnQ.push({ at: T + 0.6 + k * 0.05, team, type: elite, x: px + Math.cos(a) * 28, y: py + Math.sin(a) * 28, portal: true }); }
        this.portal = { x: px, y: py, t0: T, end: T + 2.2 }; this.snd('portal');
        if (this.camEv) this.camEv.push({ type: 'spot', x: px, y: py, prio: 58, dur: 1.8, z: 1.8 });
        return `${name} OPENS A PORTAL!`;
      }
      if (kind === 'phoenix') {
        const list = this.fallen[team].splice(-8);
        list.forEach((f, i) => this.spawnQ.push({ at: T + 0.3 + i * 0.07, team, type: f.type, x: f.x, y: f.y, hp: 0.5, rise: false }));
        this.burst(ev.x, ev.y, '#FF9F1C', 20, 360, 0.6, 8);
        return list.length ? `${name}: ${list.length} TROOPS REVIVED!` : `${name}: PHOENIX HEART!`;
      }
      if (kind === 'chain') {
        // a bolt that jumps from enemy to enemy, weaker with each jump
        let x = ev.x, y = ev.y, dmg = 8;
        const hit = new Set();
        for (let k = 0; k < 10; k++) {
          let best = null, bd = (k ? 150 : 300) ** 2;
          for (const o of foes) { if (o.dead || hit.has(o) || o.phased) continue; const d = (o.x - x) ** 2 + (o.y - y) ** 2; if (d < bd) { bd = d; best = o; } }
          if (!best) break;
          hit.add(best); this.beams.push({ x0: x, y0: y, x1: best.x, y1: best.y, t0: T + k * 0.04, life: 0.45, col: '#FDE047', w: 5, zig: true });
          this._kind = 'blast'; this.damage(best, dmg * Math.max(UNIT[best.type].armor, 0.6), null);
          x = best.x; y = best.y; dmg *= 0.85;
        }
        this.snd('thunder');
        return `${name}: CHAIN LIGHTNING!`;
      }
      if (kind === 'dice') {
        const roll = S.pick(['giant', 'tiny', 'speed', 'confusion', 'healing', 'knockback']);
        const mine = this.near(ev.x, ev.y, 280).filter(o => o.team === team), theirs = this.near(ev.x, ev.y, 300).filter(o => o.team !== team);
        if (roll === 'giant') for (const o of mine) { if (UNIT[o.type].rank === 0) continue; o.r *= 1.3; o.m = o.r * o.r; o.max *= 1.3; o.hp *= 1.3; o.dmgK = (o.dmgK || 1) * 1.2; }
        if (roll === 'tiny') for (const o of theirs) { if (UNIT[o.type].rank === 0) continue; o.r *= 0.7; o.m = o.r * o.r; o.max *= 0.7; o.hp *= 0.7; o.dmgK = (o.dmgK || 1) * 0.75; }
        if (roll === 'speed') this.buffs[team].speed = T + 8;
        if (roll === 'confusion') for (const o of theirs) { o.confT = T + 4; o.retarget = 0; }
        if (roll === 'healing') for (const o of this.units) if (o.team === team && !o.dead) { o.hp = o.max; o.healFlash = 1; }
        if (roll === 'knockback') for (const o of theirs) { this.knock(o, ev.x, ev.y, 70); this._kind = 'blast'; this.damage(o, 2, null); }
        this.diceFx = { x: ev.x, y: ev.y, t0: T, roll };
        this.xf.dice = roll;
        return `${name} ROLLS: ${{ giant: 'GIANT SIZE', tiny: 'TINY ENEMIES', speed: 'SPEED', confusion: 'CONFUSION', healing: 'FULL HEAL', knockback: 'SHOCKWAVE' }[roll]}!`;
      }
      if (kind === 'crystal') {
        const list = this.units.filter(o => o.team === team && !o.dead && UNIT[o.type].rank !== 0 && !UNIT[o.type].uncounted);
        if (!list.length) return `${name}: EVOLUTION CRYSTAL!`;
        const u = list.reduce((a, b) => ((b.kills || 0) > (a.kills || 0) ? b : a));
        if ((u.lvl || 1) < 2) this.levelUp(u, 2, false);
        if (u.lvl === 2) this.levelUp(u, 3, false);
        u.dmgK = (u.dmgK || 1) * 1.3;
        this.beams.push({ x0: ev.x, y0: ev.y, x1: u.x, y1: u.y, t0: T, life: 0.6, col: '#5EEAD4', w: 6 });
        if (this.camEv) this.camEv.push({ type: 'spot', follow: u, prio: 60, dur: 2, z: 2 });
        return `${name}: EVOLUTION CRYSTAL!`;
      }
      if (kind === 'singularity') {
        this.fields.push({ kind: 'singularity', x: ev.x, y: ev.y, r: 260, t0: T, end: T + 1.5, team, pow: 260, blast: { dmg: 6, r: 120 } });
        this.snd('portal');
        // a God Eater that touches a black hole becomes something else entirely
        const god = this.units.find(o => o.team === team && o.god && !o.dead);
        if (god && !god.cosmic) { god.cosmic = true; god.title = 'COSMIC ENTITY'; god.r = 40; god.m = 1600; god.dmgK *= 1.5; god.max *= 1.5; god.hp = god.max; this.bannerQ.push({ at: T + 1.8, text: 'A COSMIC ENTITY IS BORN!', col: '#A78BFA' }); this.xf.titles.push('COSMIC ENTITY'); }
        return `${name}: POCKET SINGULARITY!`;
      }
      if (kind === 'crown') {
        const list = this.units.filter(o => o.team === team && !o.dead && !UNIT[o.type].uncounted);
        if (list.length) { const u = list.reduce((a, b) => (UNIT[b.type].cost * b.hp > UNIT[a.type].cost * a.hp ? b : a)); u.crownT = T + 10; this.crownOn = T + 10; this.auraAt = 0; if (this.camEv) this.camEv.push({ type: 'spot', follow: u, prio: 59, dur: 1.8, z: 2 }); }
        return `${name}: KING'S CROWN!`;
      }
      return `${name} GRABS THE DROP`;
    },
  };
  // =====================================================================
  // Second batch: more magic (frost witches, liches, storm callers, spirits), beasts and siege, the rest of the crazy units
  // (Star Eater, Timeline Executioner, Walking Cathedral, Storm Emperor, Worldroot, Hourglass Titan, Moon Caller, Unqualified King,
  // the General Who Cannot Lose, the Empty Army, the Player, the Universe, the Living Fortress), living weapons, boss transformations,
  // a blood moon, stampedes, the kraken, and two more power-ups.
  // =====================================================================
  const NEW_UNITS2 = ['frostwitch', 'lich', 'stormcaller', 'wisp', 'gargoyle', 'assassin', 'siegegunner', 'catapult', 'mammoth', 'rhino', 'ogre', 'drone', 'helicopter', 'siren', 'hollow',
    'livingblade', 'stareater', 'timeexec', 'cathedral', 'stormemperor', 'worldroot', 'hourglass', 'mooncaller', 'unqualifiedking', 'generalnolose', 'theplayer', 'universe', 'livingfortress'];
  for (const k of NEW_UNITS2) { const U = UNIT[k]; U.ext = true; U.abil = true; U.abil2 = true; ROSTER[k] = 1; }
  for (const k of ['frostwitch', 'stormcaller', 'assassin', 'siegegunner', 'siren', 'ogre', 'mooncaller', 'unqualifiedking', 'generalnolose', 'universe']) LIVING[k] = 1;
  for (const k of ['catapult', 'mammoth', 'rhino', 'ogre', 'helicopter', 'stareater', 'timeexec', 'cathedral', 'stormemperor', 'worldroot', 'hourglass', 'theplayer', 'livingfortress',
    'mooncaller', 'generalnolose', 'unqualifiedking', 'gargoyle', 'lich']) HPBAR[k] = 1;
  LOBS.frostbolt = 1; LOBS.mortar = 1; BIG_BLAST.mortar = 1; XSHOT.frostbolt = 1; XSHOT.mortar = 1;
  DARK.lich = 1; DARK.gargoyle = 1; MODERNISH.drone = 1; MODERNISH.helicopter = 1;
  Object.assign(UNIT_LABEL, { frostwitch: 'FROST WITCH', stormcaller: 'STORM CALLER', wisp: 'FOREST SPIRIT', siegegunner: 'SIEGE GUNNER', mammoth: 'WAR MAMMOTH', rhino: 'WAR RHINO',
    drone: 'KAMIKAZE DRONE', helicopter: 'HELICOPTER', hollow: 'EMPTY ARMOUR', livingblade: 'LIVING BLADE', stareater: 'STAR EATER', timeexec: 'TIMELINE EXECUTIONER',
    cathedral: 'WALKING CATHEDRAL', stormemperor: 'STORM EMPEROR', worldroot: 'THE WORLDROOT', hourglass: 'HOURGLASS TITAN', mooncaller: 'MOON CALLER', unqualifiedking: 'UNQUALIFIED KING',
    generalnolose: 'UNDEFEATED GENERAL', theplayer: 'THE PLAYER', universe: 'THE UNIVERSE', livingfortress: 'LIVING FORTRESS' });
  POWERUPS.push('clone', 'ghosts');
  Object.assign(CRATE, {
    clone: { box: '#0EA5E9', icon: '#F4F6FB', chute: '#38BDF8', glow: '#BAE6FD' },
    ghosts: { box: '#334155', icon: '#E2E8F0', chute: '#64748B', glow: '#CBD5E1' },
  });
  for (const k of ['frostwitch', 'stormcaller', 'wisp', 'rhino', 'ogre', 'livingblade', 'stareater', 'timeexec', 'stormemperor', 'worldroot', 'hourglass', 'mooncaller', 'unqualifiedking']) UNIT_ERA[k] = 'fantasy';
  for (const k of ['siegegunner', 'catapult', 'mammoth', 'cathedral', 'generalnolose', 'theplayer', 'universe', 'livingfortress']) UNIT_ERA[k] = 'medieval';
  for (const k of ['lich', 'gargoyle', 'hollow']) UNIT_ERA[k] = 'horror';
  UNIT_ERA.drone = 'modern'; UNIT_ERA.helicopter = 'modern'; UNIT_ERA.siren = 'pirate'; UNIT_ERA.assassin = 'samurai';
  // ----- the second batch of army types, added at the end of their genre lists (old battles never pick from these lists) -----
  const D2 = (name, base, mix, extra) => Object.assign({ name, base, mix, budget: 1, budget60: 1 }, extra || {});
  GENRES.medieval.push(
    D2('SIEGE', 'soldier', { soldier: 0.4, pikeman: 0.25, siegegunner: 0.2, crossbowman: 0.15 }, { heavy: ['catapult', 'catapult'] }),
    D2('MAMMOTHS', 'soldier', { berserker: 0.5, spearman: 0.3, archer: 0.2 }, { heavy: ['mammoth', 'mammoth'] }),
    D2('CATHEDRAL', 'soldier', { soldier: 0.4, archer: 0.3, healer: 0.15, knight: 0.15 }, { heavy: ['cathedral'] }),
    D2('NEVERLOSE', 'soldier', { swordsman: 0.35, pikeman: 0.25, archer: 0.25, lancer: 0.15 }, { heavy: ['generalnolose'] }),
    D2('PLAYER', 'soldier', { soldier: 0.5, archer: 0.3, knight: 0.2 }, { heavy: ['theplayer'] }),
    D2('UNIVERSE', 'soldier', { soldier: 0.5, universe: 0.25, archer: 0.25 }),
    D2('LIVINGFORT', 'soldier', { soldier: 0.45, archer: 0.35, crossbowman: 0.2 }, { heavy: ['livingfortress'] }));
  GENRES.fantasy.push(
    D2('FROST', 'dwarf', { frostwitch: 0.3, dwarf: 0.4, crossbowman: 0.3 }, { heavy: ['mammoth'] }),
    D2('TEMPEST', 'skeleton', { stormcaller: 0.3, elf: 0.4, swordsman: 0.3 }),
    D2('SPIRITS', 'wisp', { wisp: 0.4, elf: 0.3, druid: 0.15, treant: 0.15 }),
    D2('RHINOS', 'skeleton', { orc: 0.5, rhino: 0.2, boarrider: 0.3 }),
    D2('OGRES', 'skeleton', { ogre: 0.3, orc: 0.4, skeleton: 0.3 }),
    D2('STAREATER', 'imp', { skeleton: 0.5, warlock: 0.25, imp: 0.25 }, { heavy: ['stareater'] }),
    D2('TIMELINE', 'skeleton', { swordsman: 0.5, archer: 0.3, wizard: 0.2 }, { heavy: ['timeexec'] }),
    D2('STORMEMPEROR', 'skeleton', { stormcaller: 0.25, elf: 0.4, swordsman: 0.35 }, { heavy: ['stormemperor'] }),
    D2('WORLDROOT', 'wisp', { elf: 0.45, druid: 0.15, treant: 0.1, wisp: 0.3 }, { heavy: ['worldroot'] }),
    D2('HOURGLASS', 'dwarf', { dwarf: 0.5, crossbowman: 0.3, wizard: 0.2 }, { heavy: ['hourglass'] }),
    D2('MOONCALLER', 'skeleton', { elf: 0.5, swordsman: 0.3, wisp: 0.2 }, { heavy: ['mooncaller'] }),
    D2('GOBLINKING', 'imp', { orc: 0.4, skeleton: 0.4, imp: 0.2 }, { heavy: ['unqualifiedking'] }));
  GENRES.horror.push(
    D2('LICHES', 'skeleton', { skeleton: 0.6, zombie: 0.2, lich: 0.2 }),
    D2('GARGOYLES', 'zombie', { gargoyle: 0.35, zombie: 0.35, vampire: 0.3 }),
    D2('EMPTY', 'hollow', { hollow: 1 }));
  GENRES.modern.push(
    D2('DRONES', 'rifleman', { rifleman: 0.6, drone: 0.4 }),
    D2('AIRBORNE', 'rifleman', { rifleman: 0.6, gunner: 0.25, grenadier: 0.15 }, { heavy: ['helicopter'] }));
  GENRES.pirate.push(D2('SIRENS', 'pirate', { pirate: 0.5, musketeer: 0.25, siren: 0.25 }));
  GENRES.samurai.push(D2('ASSASSINS', 'ninja', { assassin: 0.45, ninja: 0.55 }));
  Object.assign(DOC_LABEL, { STAREATER: 'STAR EATER', STORMEMPEROR: 'STORM EMPEROR', LIVINGFORT: 'LIVING FORTRESS', NEVERLOSE: 'UNDEFEATED', MOONCALLER: 'MOON CALLER', GOBLINKING: 'GOBLIN KING',
    EMPTY: 'EMPTY ARMY', PLAYER: 'THE PLAYER' });
  const MACHINE = { tank: 1, mech: 1, cannon: 1, turret: 1, robot: 1, golem: 1, fortress: 1, helicopter: 1, drone: 1, catapult: 1 };
  // ===== third batch (rules.cast3): thirty new troops, each with its own move, plus three helpers they make =====
  // (original characters; abilities in ARMY_CAST3, drawings in drawCast3. Old battles never pick them: their armies are
  // added at the end of the genre lists, and creative match-ups only use them when rules.cast3 is on.)
  Object.assign(UNIT, {
    builder: { r: 12, hp: 9, dmg: 1, cd: 0.7, reach: 4, speed: 84, cost: 2.6, rank: 2, armor: 0.85, build: 8 },
    watchtower: { r: 15, hp: 12, dmg: 0.9, cd: 1.1, range: 290, speed: 0, cost: 0.6, ranged: true, rank: 2, armor: 0.6, uncounted: true, immovable: true },
    bomber: { r: 12, hp: 6, dmg: 7, cd: 1, reach: 3, speed: 130, cost: 2.2, rank: 2, armor: 1, keg: 70 },
    gravewitch: { r: 12, hp: 7, dmg: 1, cd: 1.6, range: 240, speed: 72, cost: 3.4, ranged: true, bullet: 800, shot: 'soul', rank: 3, armor: 1, summon: 7 },
    bonelet: { r: 8, hp: 0.6, dmg: 0.9, cd: 0.5, reach: 4, speed: 150, cost: 0.35, rank: 2, armor: 1 },
    shaman: { r: 12, hp: 8, dmg: 1.2, cd: 1.4, range: 230, speed: 76, cost: 3, ranged: true, bullet: 700, shot: 'dart', rank: 3, armor: 1, totem: 10 },
    totem: { r: 11, hp: 10, dmg: 0, cd: 99, reach: 0, speed: 0, cost: 0, rank: 2, armor: 0.7, uncounted: true, immovable: true, aura: { r: 150, dmg: 1.15, haste: 0.82 } },
    goblin: { r: 9, hp: 4, dmg: 1.3, cd: 0.4, reach: 4, speed: 140, cost: 1, rank: 2, armor: 1, dodge: 0.2, backstab: 2 },
    timetraveller: { r: 12, hp: 10, dmg: 1.5, cd: 0.6, reach: 5, speed: 96, cost: 5, rank: 1, armor: 0.85, chrono: 1 },
    mr3d: { r: 14, hp: 15, dmg: 2, cd: 0.6, reach: 6, speed: 94, cost: 6, rank: 1, armor: 0.8, pop3d: 11 },
    juggernaut: { r: 19, hp: 40, dmg: 2.6, cd: 1, reach: 6, speed: 60, cost: 7, rank: 1, armor: 0.4, unstoppable: true, jugg: true },
    hookman: { r: 13, hp: 11, dmg: 1.6, cd: 0.65, reach: 5, speed: 88, cost: 3, rank: 1, armor: 0.85, hook: 6 },
    bard: { r: 12, hp: 7, dmg: 0.8, cd: 1, range: 200, speed: 82, cost: 3, ranged: true, bullet: 600, shot: 'dart', rank: 3, armor: 1, aura: { r: 160, dmg: 1.15, haste: 0.85 }, song: true },
    beekeeper: { r: 12, hp: 7, dmg: 0.6, cd: 1.5, range: 230, speed: 80, cost: 2.8, ranged: true, bullet: 500, shot: 'dart', rank: 3, armor: 1, bees: 6 },
    chef: { r: 14, hp: 12, dmg: 1.2, cd: 2.2, range: 240, speed: 74, cost: 3, ranged: true, lob: 'pie', bullet: 520, splash: 40, slow: [0.5, 2], rank: 3, armor: 0.9, feast: 9 },
    jester: { r: 11, hp: 6, dmg: 0.7, cd: 2, range: 240, speed: 96, cost: 2.6, ranged: true, lob: 'confetti', bullet: 560, splash: 55, rank: 3, armor: 1, laugh: 1.1 },
    mimic: { r: 14, hp: 16, dmg: 5, cd: 1.2, reach: 6, speed: 40, cost: 3.2, rank: 1, armor: 0.6, ambush: true },
    jetpack: { r: 12, hp: 7, dmg: 0.8, cd: 0.3, range: 220, speed: 120, cost: 3, ranged: true, bullet: 900, rank: 2, armor: 1, flying: true, jet: 5 },
    werewolf: { r: 13, hp: 14, dmg: 2, cd: 0.6, reach: 5, speed: 94, cost: 4, rank: 1, armor: 0.85, howl: true },
    oracle: { r: 12, hp: 6, dmg: 0.8, cd: 1.3, range: 260, speed: 76, cost: 3, ranged: true, bullet: 800, shot: 'soul', rank: 3, armor: 1, foresee: 7 },
    balloon: { r: 22, hp: 28, dmg: 5, cd: 2.4, range: 46, speed: 54, cost: 7, ranged: true, lob: 'bomb', bullet: 260, splash: 62, rank: 0, armor: 0.7, flying: true, deathbomb: true },
    sumo: { r: 17, hp: 30, dmg: 2.2, cd: 0.9, reach: 5, speed: 70, cost: 5, rank: 1, armor: 0.6, stomp: 6 },
    sandman: { r: 12, hp: 7, dmg: 0.6, cd: 1.6, range: 240, speed: 78, cost: 3, ranged: true, bullet: 600, shot: 'dart', rank: 3, armor: 1, sleep: 9 },
    valkyrie: { r: 13, hp: 13, dmg: 2, cd: 0.6, reach: 5, speed: 104, cost: 4.5, rank: 1, armor: 0.8, flying: true, dive: 7 },
    paladin: { r: 15, hp: 20, dmg: 1.8, cd: 0.75, reach: 5, speed: 74, cost: 4.5, rank: 1, armor: 0.6, bubble: 10 },
    pyro: { r: 12, hp: 9, dmg: 0.9, cd: 0.25, reach: 52, speed: 82, cost: 3, rank: 2, armor: 0.9, breath: 70 },
    medicdrone: { r: 10, hp: 5, dmg: 0, cd: 1.4, range: 160, speed: 96, cost: 2.4, healer: true, heal: 3.5, healRange: 120, rank: 3, armor: 1, flying: true },
    yeti: { r: 17, hp: 26, dmg: 2.4, cd: 1.6, range: 220, speed: 66, cost: 5, ranged: true, lob: 'frostbolt', bullet: 520, splash: 50, slow: [0.5, 2], rank: 1, armor: 0.7 },
    shadowninja: { r: 11, hp: 8, dmg: 2.2, cd: 0.45, reach: 5, speed: 124, cost: 3, rank: 2, armor: 1, dodge: 0.3, clones: 8 },
    gunslinger: { r: 11, hp: 7, dmg: 1.1, cd: 0.18, range: 230, speed: 86, cost: 2.6, ranged: true, bullet: 1100, rank: 3, armor: 1, reload: 6 },
    axethrower: { r: 13, hp: 10, dmg: 2.2, cd: 1.5, range: 230, speed: 82, cost: 2.6, ranged: true, bullet: 520, shot: 'axe', rank: 3, armor: 0.9 },
    gorgon: { r: 13, hp: 10, dmg: 1, cd: 1.3, range: 230, speed: 74, cost: 4, ranged: true, bullet: 700, shot: 'soul', rank: 3, armor: 0.9, gaze: 8 },
    phalanx: { r: 13, hp: 14, dmg: 1.4, cd: 0.7, reach: 9, speed: 72, cost: 2.4, rank: 1, armor: 0.75, wall: true },
    tesla: { r: 12, hp: 8, dmg: 1.2, cd: 1.2, range: 200, speed: 78, cost: 3.2, ranged: true, bullet: 1600, rank: 3, armor: 1, chain: 3 },
  });
  const CAST3 = ['builder', 'bomber', 'gravewitch', 'shaman', 'goblin', 'timetraveller', 'mr3d', 'juggernaut', 'hookman', 'bard', 'beekeeper', 'chef', 'jester', 'mimic', 'jetpack',
    'werewolf', 'oracle', 'balloon', 'sumo', 'sandman', 'valkyrie', 'paladin', 'pyro', 'medicdrone', 'yeti', 'shadowninja', 'gunslinger', 'axethrower', 'gorgon', 'phalanx', 'tesla'];
  const CAST3_ALL = CAST3.concat(['watchtower', 'totem', 'bonelet']);
  const CAST3_SET = new Set(CAST3_ALL);
  for (const k of CAST3_ALL) { const U = UNIT[k]; U.ext = true; U.abil3 = true; ROSTER[k] = 1; }
  for (const k of ['builder', 'bomber', 'shaman', 'timetraveller', 'mr3d', 'hookman', 'bard', 'beekeeper', 'chef', 'jester', 'jetpack', 'werewolf', 'oracle', 'sumo', 'sandman', 'valkyrie', 'paladin',
    'pyro', 'shadowninja', 'gunslinger', 'axethrower', 'phalanx', 'tesla', 'goblin', 'gravewitch']) LIVING[k] = 1;
  for (const k of ['juggernaut', 'balloon', 'sumo', 'yeti', 'paladin']) HPBAR[k] = 1;
  LOBS.pie = 1; LOBS.confetti = 1; LOBS.bomb = 1; XSHOT.pie = 1; XSHOT.confetti = 1; XSHOT.bomb = 1; XSHOT.axe = 1;
  DARK.gravewitch = 1; DARK.bonelet = 1; DARK.gorgon = 1; MODERNISH.jetpack = 1; MODERNISH.gunslinger = 1; MODERNISH.pyro = 1; MODERNISH.medicdrone = 1; MODERNISH.tesla = 1;
  MACHINE.watchtower = 1; MACHINE.medicdrone = 1; MACHINE.balloon = 1;
  Object.assign(UNIT_LABEL, { builder: 'BUILDER', watchtower: 'WATCHTOWER', bomber: 'BARREL BOMBER', gravewitch: 'GRAVE WITCH', bonelet: 'SKELETON', shaman: 'TOTEM SHAMAN', totem: 'WAR TOTEM',
    goblin: 'DARK GOBLIN', timetraveller: 'TIME TRAVELLER', mr3d: 'MR 3D', juggernaut: 'JUGGERNAUT', hookman: 'CHAIN HOOK', bard: 'BARD', beekeeper: 'BEEKEEPER', chef: 'WAR CHEF',
    jester: 'JESTER', mimic: 'MIMIC', jetpack: 'JETPACK TROOPER', werewolf: 'WEREWOLF', oracle: 'ORACLE', balloon: 'BALLOON BOMBER', sumo: 'SUMO', sandman: 'SANDMAN', valkyrie: 'VALKYRIE',
    paladin: 'PALADIN', pyro: 'FLAMETHROWER', medicdrone: 'MEDIC DRONE', yeti: 'YETI', shadowninja: 'SHADOW NINJA', gunslinger: 'GUNSLINGER', axethrower: 'AXE THROWER', gorgon: 'GORGON',
    phalanx: 'PHALANX', tesla: 'TESLA GUNNER' });
  for (const k of ['builder', 'bomber', 'juggernaut', 'bard', 'beekeeper', 'chef', 'jester', 'balloon', 'paladin', 'phalanx', 'watchtower']) UNIT_ERA[k] = 'medieval';
  for (const k of ['shaman', 'goblin', 'mimic', 'oracle', 'sandman', 'valkyrie', 'yeti', 'axethrower', 'gorgon', 'totem']) UNIT_ERA[k] = 'fantasy';
  for (const k of ['gravewitch', 'werewolf', 'bonelet']) UNIT_ERA[k] = 'horror';
  for (const k of ['jetpack', 'gunslinger', 'pyro', 'medicdrone']) UNIT_ERA[k] = 'modern';
  for (const k of ['timetraveller', 'mr3d', 'tesla']) UNIT_ERA[k] = 'scifi';
  UNIT_ERA.hookman = 'pirate'; UNIT_ERA.sumo = 'samurai'; UNIT_ERA.shadowninja = 'samurai';
  // their armies, at the end of the genre lists
  GENRES.medieval.push(
    D2('BUILDERS', 'soldier', { builder: 0.3, soldier: 0.4, crossbowman: 0.3 }),
    D2('BOMBERS', 'soldier', { bomber: 0.35, swordsman: 0.35, archer: 0.3 }),
    D2('JUGGERNAUTS', 'soldier', { juggernaut: 0.25, spearman: 0.45, archer: 0.3 }),
    D2('MINSTRELS', 'soldier', { bard: 0.2, swordsman: 0.5, archer: 0.3 }),
    D2('BEEKEEPERS', 'soldier', { beekeeper: 0.3, pikeman: 0.4, soldier: 0.3 }),
    D2('FEAST', 'soldier', { chef: 0.3, berserker: 0.4, soldier: 0.3 }),
    D2('CIRCUS', 'soldier', { jester: 0.35, swordsman: 0.35, spearman: 0.3 }),
    D2('BALLOONS', 'soldier', { soldier: 0.5, archer: 0.3, builder: 0.2 }, { heavy: ['balloon', 'balloon'] }),
    D2('PALADINS', 'soldier', { paladin: 0.3, healer: 0.2, soldier: 0.5 }),
    D2('PHALANX', 'soldier', { phalanx: 0.6, archer: 0.4 }));
  GENRES.fantasy.push(
    D2('TOTEMS', 'skeleton', { shaman: 0.3, orc: 0.45, archer: 0.25 }),
    D2('GOBLINS', 'skeleton', { goblin: 0.6, orc: 0.25, shaman: 0.15 }),
    D2('MIMICS', 'skeleton', { mimic: 0.3, dwarf: 0.4, elf: 0.3 }),
    D2('ORACLES', 'skeleton', { oracle: 0.25, elf: 0.45, swordsman: 0.3 }),
    D2('DREAMERS', 'skeleton', { sandman: 0.3, elf: 0.35, swordsman: 0.35 }),
    D2('VALKYRIES', 'skeleton', { valkyrie: 0.35, berserker: 0.4, archer: 0.25 }),
    D2('YETIS', 'dwarf', { yeti: 0.25, dwarf: 0.45, frostwitch: 0.3 }),
    D2('AXES', 'skeleton', { axethrower: 0.4, berserker: 0.6 }),
    D2('GORGONS', 'skeleton', { gorgon: 0.25, orc: 0.45, elf: 0.3 }));
  GENRES.horror.push(
    D2('GRAVEWITCHES', 'zombie', { gravewitch: 0.3, zombie: 0.4, skeleton: 0.3 }),
    D2('WEREWOLVES', 'zombie', { werewolf: 0.45, zombie: 0.35, vampire: 0.2 }));
  GENRES.modern.push(
    D2('JETPACKS', 'rifleman', { jetpack: 0.35, rifleman: 0.4, medicdrone: 0.25 }),
    D2('GUNSLINGERS', 'rifleman', { gunslinger: 0.45, rifleman: 0.35, grenadier: 0.2 }),
    D2('PYROS', 'rifleman', { pyro: 0.35, rifleman: 0.45, medicdrone: 0.2 }));
  GENRES.scifi.push(
    D2('TIMEKEEPERS', 'trooper', { timetraveller: 0.2, trooper: 0.5, robot: 0.3 }),
    D2('3D', 'trooper', { mr3d: 0.2, trooper: 0.5, tesla: 0.3 }),
    D2('TESLAS', 'trooper', { tesla: 0.4, trooper: 0.4, robot: 0.2 }));
  GENRES.pirate.push(D2('HOOKS', 'pirate', { hookman: 0.35, pirate: 0.4, musketeer: 0.25 }), D2('POWDER', 'pirate', { bomber: 0.3, pirate: 0.45, musketeer: 0.25 }));
  GENRES.samurai.push(D2('SUMO', 'ninja', { sumo: 0.25, samurai: 0.4, ninja: 0.35 }), D2('SHADOWS', 'ninja', { shadowninja: 0.45, ninja: 0.3, samurai: 0.25 }));
  Object.assign(DOC_LABEL, { GRAVEWITCHES: 'GRAVE WITCHES', TIMEKEEPERS: 'TIME TRAVELLERS', '3D': 'MR 3D CREW', BEEKEEPERS: 'BEEKEEPERS', JETPACKS: 'JETPACK SQUAD', GUNSLINGERS: 'GUNSLINGERS', PYROS: 'FLAMETHROWERS', TESLAS: 'TESLA SQUAD', HOOKS: 'CHAIN HOOKS', POWDER: 'POWDER CREW', FEAST: 'WAR CHEFS', CIRCUS: 'JESTERS', DREAMERS: 'SANDMEN', AXES: 'AXE THROWERS', MINSTRELS: 'BARDS' });
  const UNIVERSE_ARMIES = ['skeleton', 'robot', 'ninja', 'pirate', 'orc', 'trooper', 'zombie', 'elf', 'samurai', 'vampire', 'dwarf', 'imp'];

  const ARMY_EXT2 = {
    extUnit2(u, U) {
      if (U.cloak) u.cloak = true;
      if (U.castle) u.asleep = true;
      if (U.bell) this.hasRaise = true;
    },
    // statuses that take over a troop for a moment: grabbed by the Player, thrown, charmed, turned to stone, asleep
    preUnit2(u, U, h) {
      const T = this.fightT;
      if (u.grabbed) { const g = u.grabbed; if (g.dead) u.grabbed = null; else { u.x = g.x + Math.cos(g.face) * g.r * 0.6; u.y = g.y + Math.sin(g.face) * g.r * 0.6; u.vx = 0; u.vy = 0; return true; } }
      if (u.thrown) {
        const th = u.thrown, p = clamp((T - th.t0) / th.T, 0, 1);
        u.x = th.sx + (th.tx - th.sx) * p; u.y = th.sy + (th.ty - th.sy) * p; u.lift = Math.sin(Math.PI * p) * 70;
        if (p >= 1) {
          u.thrown = null; u.phased = false; u.lift = 0;
          this.explode({ team: th.team, kind: 'slam', x: u.x, y: u.y, splash: 60, dmg: 6, from: th.by && !th.by.dead ? th.by : null });
          if (!u.dead) { this._dot = true; this.damage(u, u.max * 0.35, th.by || null); this._dot = false; }
          this.shake(10);
        }
        return true;
      }
      if (u.ghostEnd && T > u.ghostEnd) { this.vanish(u); return true; }
      if (u.stoneT > T) { u.vx = 0; u.vy = 0; return true; }
      if (u.asleep) {
        const t = u.target && !u.target.dead ? u.target : this.pickTarget(u, U);
        if ((t && Math.hypot(t.x - u.x, t.y - u.y) < 190) || T > 0.45 * (this.fixed || this.target)) {
          u.asleep = false; this.shake(12); this.snd('roar');
          this.banner('THE CASTLE IS ALIVE!', TEAMS[u.team].c, 1.8); this.xf.castle = true;
          if (this.camEv) this.camEv.push({ type: 'spot', follow: u, prio: 81, dur: 2.2, z: 1.7, slow: true });
        } else { u.vx = 0; u.vy = 0; return true; }
      }
      if (u.charmT > T && u.charmBy && !u.charmBy.dead) {
        // charmed by a siren: walks towards her and doesn't fight
        const c = u.charmBy, dx = c.x - u.x, dy = c.y - u.y, d = Math.hypot(dx, dy) || 1, sp = U.speed * 0.6, k = Math.min(1, 7 * h);
        const want = d > 40 ? sp : 0;
        u.vx += (dx / d * want - u.vx) * k; u.vy += (dy / d * want - u.vy) * k; u.x += u.vx * h; u.y += u.vy * h; this.turn(u, Math.atan2(dy, dx), h);
        return true;
      }
      return false;
    },
    ability2(u, U, h, t) {
      const T = this.fightT, F = this.fixed || this.target, pan = (u.x - AR.x) / AR.w * 1.4 - 0.7;
      const byDist = (a, b) => ((a.x - u.x) ** 2 + (a.y - u.y) ** 2) - ((b.x - u.x) ** 2 + (b.y - u.y) ** 2);
      const foesNear = r => this.near(u.x, u.y, r).filter(o => o.team !== u.team && !o.phased && !o.cloak && !UNIT[o.type].decoy);
      if (U.drainAll && T >= (u.abT || u.born + 2)) {
        // the lich drains the three nearest enemies and shares the life with its army
        u.abT = T + U.drainAll;
        const foes = foesNear(220).sort(byDist).slice(0, 3);
        for (const o of foes) { this._kind = 'blast'; this.damage(o, 3, u); this.beams.push({ x0: o.x, y0: o.y, x1: u.x, y1: u.y, t0: T, life: 0.6, col: '#7CFFB0', w: 4 }); }
        if (foes.length) { for (const o of this.near(u.x, u.y, 200).filter(o => o.team === u.team).sort(byDist).slice(0, 4)) { this.heal(o, foes.length * 1.2 * this.hpScale); o.healFlash = 1; } u.muzzle = 1; this.snd('groan', { pan }); }
      }
      if (U.storm && t && T >= (u.abT || 0)) {
        u.abT = T + U.storm;
        if (Math.hypot(t.x - u.x, t.y - u.y) < U.range * 1.1) { this.calls.push({ x: t.x, y: t.y, at: T + 0.6, t0: T, r: 42, dmg: 6, team: u.team, from: u, kind: 'lightning' }); u.muzzle = 1; }
      }
      if (U.stone && !(u.stoneT > T) && u.hp < u.max * 0.6 && T >= (u.abT || 0)) { u.abT = T + U.stone; u.stoneT = T + 1.6; this.burst(u.x, u.y, '#9AA3B0', 8, 160, 0.5, 6); this.snd('stone', { pan }); }
      if (U.cloak && !u.cloak && T >= (u.cloakAt || 0)) { u.cloak = true; for (const v of this.units) if (v.target === u) v.target = null; this.burst(u.x, u.y, '#3A3F4B', 6, 120, 0.4, 5); }
      if (U.eat && T >= (u.abT || u.born + 3) && u.hp < u.max * 0.85) {
        u.abT = T + U.eat;
        const prey = this.near(u.x, u.y, u.r + 36).filter(o => o.team === u.team && o !== u && UNIT[o.type].rank !== 0 && !UNIT[o.type].uncounted && !UNIT[o.type].eat && o.hp < o.max * 0.75)[0];
        if (prey) {
          this.burst(prey.x, prey.y, TEAMS[prey.team].c, 8, 160, 0.4, 6); this.vanish(prey);
          u.max += 8 * this.hpScale; u.hp = Math.min(u.max, u.hp + u.max * 0.5); u.r = Math.min(30, u.r + 1.5); u.m = u.r * u.r; u.dmgK = (u.dmgK || 1) + 0.08; u.lunge = 1;
          this.float(u.x, u.y - u.r - 10, 'GULP!', '#FFB4A2', 26, 0.8); this.snd('pop', { pan, big: true }); this.xf.eaten = (this.xf.eaten || 0) + 1;
          if (!this.ogreSaid) { this.ogreSaid = true; this.banner('THE OGRES EAT THEIR OWN!', TEAMS[u.team].c, 1.6); }
        }
      }
      if (U.kamikaze && t && Math.hypot(t.x - u.x, t.y - u.y) < u.r + t.r + 6) {
        this.explode({ team: u.team, kind: 'bomb', x: u.x, y: u.y, splash: 45, dmg: U.dmg, from: u });
        this._dot = true; this.damage(u, u.hp + 99, null); this._dot = false;
        return;
      }
      if (U.rockets && t && T >= (u.abT || u.born + 2)) {
        u.abT = T + U.rockets;
        if (Math.hypot(t.x - u.x, t.y - u.y) < U.range) { for (let k = 0; k < 2; k++) this.lobAt(u, t.x + this.R.range(-25, 25), t.y + this.R.range(-25, 25), 'rocket', 3, 40, 700); this.snd('rocket', { pan }); }
      }
      if (U.charm && T >= (u.abT || u.born + 3)) {
        u.abT = T + U.charm;
        const list = foesNear(190).filter(o => UNIT[o.type].rank !== 0).slice(0, 6);
        for (const o of list) { o.charmT = T + 2.5; o.charmBy = u; o.retarget = 0; }
        if (list.length) { u.muzzle = 1; this.snd('heal', { pan }); this.notes = (this.notes || []).concat([{ x: u.x, y: u.y, t0: T }]).slice(-6); if (!this.sirenSaid) { this.sirenSaid = true; this.banner('THE SIRENS ARE SINGING', TEAMS[u.team].c, 1.5); } }
      }
      if (U.tempest) {
        if (T >= (u.abT || u.born + 2)) {
          // lightning hunts the strongest enemy on the field
          u.abT = T + U.tempest;
          let best = null, bv = 0;
          for (const o of foesNear(520)) { const v = UNIT[o.type].cost * o.hp; if (v > bv) { bv = v; best = o; } }
          if (best) this.calls.push({ x: best.x, y: best.y, at: T + 0.5, t0: T, r: 40, dmg: 8, team: u.team, from: u, kind: 'lightning' });
        }
        if (T >= (u.gustAt || u.born + 4)) {
          u.gustAt = T + 5;
          const list = foesNear(200); for (const o of list) this.knock(o, u.x, u.y, 40);
          if (list.length) { this.snd('wind', { pan }); this.fields.push({ kind: 'gust', x: u.x, y: u.y, r: 200, t0: T, end: T + 0.6, team: u.team, pow: 0 }); }
        }
      }
      if (U.eclipse) {
        // the Star Eater swallows the sun: darkness grows, enemies see less and wither; then a black hole
        const k = clamp((T - u.born) / (0.45 * F), 0, 1);
        this.dark = { team: u.team, k: Math.max(this.dark ? this.dark.k : 0, k) };
        if (!u.holed && T - u.born >= 0.4 * F) {
          const cand = foesNear(520); let best = null, bn = 3;
          for (let i = 0; i < cand.length; i += Math.max(1, cand.length / 20 | 0)) { const c = cand[i]; let n = 0; for (const o of cand) if ((o.x - c.x) ** 2 + (o.y - c.y) ** 2 < 8100) n++; if (n > bn) { bn = n; best = c; } }
          if (best) {
            u.holed = true;
            this.fields.push({ kind: 'singularity', x: best.x, y: best.y, r: 230, t0: T, end: T + 2, team: u.team, pow: 240, blast: { dmg: 10, r: 140 } });
            this.banner('THE STAR EATER OPENS A BLACK HOLE!', TEAMS[u.team].c, 2); this.snd('portal'); this.xf.blackhole = true;
            if (this.camEv) this.camEv.push({ type: 'spot', x: best.x, y: best.y, prio: 83, dur: 2.6, z: 1.5, slow: true });
          }
        }
      }
      if (U.rewind) {
        // the Timeline Executioner remembers where every enemy near it was, and every few seconds sends them back there
        if (T >= (u.histAt || 0)) {
          u.histAt = T + 1;
          for (const o of this.near(u.x, u.y, 460)) if (o.team !== u.team) { (o.hist || (o.hist = [])).push(o.x, o.y, o.hp); if (o.hist.length > 15) o.hist.splice(0, 3); }
        }
        if (T >= (u.abT || u.born + 9)) {
          u.abT = T + U.rewind;
          const list = foesNear(350).filter(o => o.hist && o.hist.length >= 12);
          if (list.length >= 3) {
            for (const o of list) { o.x = o.hist[o.hist.length - 12]; o.y = o.hist[o.hist.length - 11]; o.hp = Math.max(o.hp, Math.min(o.max, o.hist[o.hist.length - 10])); o.px = o.x; o.py = o.y; o.wp = null; o.vx = 0; o.vy = 0; o.hist = null; }
            // ...but it remembers: two of them are executed on the spot
            const doomed = list.filter(o => UNIT[o.type].rank !== 0).sort(byDist).slice(0, 2);
            for (const o of doomed) { this.beams.push({ x0: u.x, y0: u.y, x1: o.x, y1: o.y, t0: T, life: 0.5, col: '#FDE68A', w: 6 }); this.float(o.x, o.y - o.r - 10, 'EXECUTED', '#FDE68A', 22, 0.8); this.damage(o, o.hp + 999, u); }
            this.rewindFx = { x: u.x, y: u.y, t0: T }; this.snd('phase', { pan });
            if (!u.rewSaid) { u.rewSaid = true; this.banner('TIME REWINDS!', '#FDE68A', 1.6); if (this.camEv) this.camEv.push({ type: 'spot', follow: u, prio: 70, dur: 2, z: 1.7 }); }
            this.xf.rewinds = (this.xf.rewinds || 0) + 1;
          }
        }
      }
      if (U.bell && T >= (u.abT || u.born + 6)) {
        // the cathedral bell: the dead around it rise, and its army is healed
        u.abT = T + U.bell;
        this.raisedN = this.raisedN || [0, 0, 0];
        let n = Math.min(6, 40 - this.raisedN[u.team]);
        for (const c of this.corpses) { if (n <= 0) break; if (c.used || T - c.t > 12 || (c.x - u.x) ** 2 + (c.y - u.y) ** 2 > 102400) continue; c.used = true; n--; this.raisedN[u.team]++; this.spawnQ.push({ at: T + 0.8, team: u.team, type: 'skeleton', x: c.x, y: c.y, rise: true }); this.xf.raised++; }
        for (const o of this.near(u.x, u.y, 260)) if (o.team === u.team) { this.heal(o, 3 * this.hpScale); o.healFlash = 1; }
        this.bellFx = { x: u.x, y: u.y, t0: T }; this.snd('bell', { pan });
      }
      if (U.roots) {
        // the Worldroot plants itself, then its roots spread, rooting and draining enemies; trees bring new creatures
        if (!u.plantT && T - u.born > 4) { u.plantT = T; u.rooted = true; (this.rootUnits || (this.rootUnits = new Set())).add(u); this.banner('THE WORLDROOT TAKES ROOT', TEAMS[u.team].c, 1.5); this.snd('rumble'); }
        if (u.plantT) {
          u.rootR = 80 + Math.min(340, (T - u.plantT) * 14);
          if (T >= (u.rootAt || 0)) { u.rootAt = T + 0.25; for (const o of this.near(u.x, u.y, u.rootR)) if (o.team !== u.team && !o.flying) { this.slowDown(o, 0.55, 0.35); this.dot(o, 0.15 * 0.25 * this.hpScale, u); } }
          if (T >= (u.abT || u.plantT + 6) && (u.grown || 0) < 10) {
            u.abT = T + 10;
            for (let k = 0; k < 2; k++) { const a = this.R.range(0, TAU), d = u.rootR * 0.6; u.grown = (u.grown || 0) + 1; this.spawnQ.push({ at: T + 0.5, team: u.team, type: k ? 'wisp' : 'treant', x: clamp(u.x + Math.cos(a) * d, AR.x + 30, AR.x + AR.w - 30), y: clamp(u.y + Math.sin(a) * d, AR.y + 30, AR.y + AR.h - 30), rise: true }); }
          }
        }
      }
      if (U.ages) {
        if (T >= (u.ageTick || 0)) {
          u.ageTick = T + 0.25;
          for (const o of this.near(u.x, u.y, 220)) {
            if (o.team === u.team) { if (o.hp < o.max) this.heal(o, 1.5 * 0.25 * this.hpScale); }
            else if (MACHINE[o.type]) this.dot(o, 2 * 0.25 * this.hpScale, u);
          }
        }
        if (T >= (u.abT || u.born + 5)) {
          // wounded enemies close by age into skeletons that fight for the titan
          u.abT = T + U.ages; this.agedN = this.agedN || 0;
          for (const o of foesNear(220)) {
            if (this.agedN >= 20 || !LIVING[o.type] || UNIT[o.type].rank === 0 || o.hp > o.max * 0.6 || o.team === MONSTERS) continue;
            this.agedN++; this.switchTeam(o, u.team);
            const S = UNIT.skeleton; o.type = 'skeleton'; o.r = S.r; o.m = S.r * S.r; o.max = S.hp * this.hpScale; o.hp = o.max * 0.8; o.flying = false; o.cd = S.cd;
            this.burst(o.x, o.y, '#E8E2D0', 6, 140, 0.4, 5); this.float(o.x, o.y - 18, 'AGED!', '#E8E2D0', 20, 0.7);
            this.xf.aged = (this.xf.aged || 0) + 1;
          }
          this.sandFx = { x: u.x, y: u.y, t0: T };
        }
      }
      if (U.moon) {
        const k = clamp((T - u.born) / (0.5 * F), 0, 1);
        this.moon = { team: u.team, k: Math.max(this.moon ? this.moon.k : 0, k) };
        if (k >= 0.5 && !this.moonPulled) {
          // the moon gets so close that enemy fliers are pulled out of the sky
          this.moonPulled = true; let n = 0;
          for (const o of this.units) if (!o.dead && o.flying && o.team !== u.team) { o.flying = false; o.grounded = true; this.damage(o, o.max * 0.1, u); n++; }
          this.banner(n ? 'THE MOON PULLS THEM DOWN!' : 'THE MOON IS RISING!', TEAMS[u.team].c, 1.8); this.shake(10); this.xf.moon = true;
        }
      }
      if (U.defect && T >= (u.abT || u.born + 4)) {
        u.abT = T + U.defect; this.defectN = this.defectN || 0;
        const list = foesNear(210).filter(o => UNIT[o.type].rank !== 0 && !UNIT[o.type].commander && !UNIT[o.type].uncounted && o.team !== MONSTERS).sort(byDist).slice(0, 3);
        for (const o of list) { if (this.defectN >= 15) break; this.defectN++; this.switchTeam(o, u.team); o.bribed = T; this.float(o.x, o.y - 20, 'ALL HAIL!', COL.gold, 22, 0.8); }
        if (list.length) { this.snd('bell', { pan }); this.xf.defect = (this.xf.defect || 0) + list.length; if (!this.kingSaid) { this.kingSaid = true; this.banner('ALL HAIL THE GOBLIN KING?!', TEAMS[u.team].c, 1.8); } }
      }
      if (U.rewindAll) this.snapTick(u);
      if (U.grab) {
        if (u.holding) {
          const o = u.holding;
          if (o.dead) u.holding = null;
          else if (T >= u.throwAt) {
            // ...and throws it at the thickest group of its enemies
            const cand = foesNear(460).filter(v => v !== o); let best = null, bn = 0;
            for (let i = 0; i < cand.length; i += Math.max(1, cand.length / 20 | 0)) { const c = cand[i]; let n = 0; for (const v of cand) if ((v.x - c.x) ** 2 + (v.y - c.y) ** 2 < 6400) n++; if (n > bn) { bn = n; best = c; } }
            const tx = best ? best.x : clamp(u.x + Math.cos(u.face) * 200, AR.x + 30, AR.x + AR.w - 30), ty = best ? best.y : clamp(u.y + Math.sin(u.face) * 200, AR.y + 30, AR.y + AR.h - 30);
            o.grabbed = null; o.phased = true; o.thrown = { sx: o.x, sy: o.y, tx, ty, t0: T, T: 0.6, team: u.team, by: u }; u.holding = null; u.lunge = 1;
            this.snd('whoosh', { pan });
          }
        } else if (T >= (u.abT || u.born + 3)) {
          const o = foesNear(160).filter(v => !UNIT[v.type].immovable && !v.thrown && !v.grabbed).sort(byDist)[0];
          u.abT = T + (o ? U.grab : 0.5);
          if (o) {
            u.holding = o; o.grabbed = u; o.target = null; u.throwAt = T + 0.8; this.xf.grabbed = (this.xf.grabbed || 0) + 1;
            this.float(o.x, o.y - o.r - 12, 'GRABBED!', '#FFFFFF', 22, 0.7);
            if (!this.playerSaid) { this.playerSaid = true; this.banner('THE PLAYER JOINS THE GAME!', TEAMS[u.team].c, 1.8); if (this.camEv) this.camEv.push({ type: 'spot', follow: u, prio: 75, dur: 2.2, z: 1.6, slow: true }); }
          }
        }
      }
      if (U.castle && !u.asleep && t && T >= (u.abT || 0)) {
        // the Living Fortress swallows the troops in front of its gate
        u.abT = T + 5;
        const fx = Math.cos(u.face), fy = Math.sin(u.face);
        const list = foesNear(u.r + 50).filter(o => UNIT[o.type].rank !== 0 && (o.x - u.x) * fx + (o.y - u.y) * fy > 0).slice(0, 3);
        for (const o of list) { this.float(o.x, o.y - 16, 'CHOMP!', '#FF6B3D', 22, 0.7); this.damage(o, o.hp + 999, u); }
        if (list.length) { u.lunge = 1; this.snd('stomp', { pan }); this.shake(6); this.xf.swallowed = (this.xf.swallowed || 0) + list.length; }
      }
    },
    // ----- the General Who Cannot Lose: snapshots of the whole battle, and a rewind -----
    snapTick(u) {
      const T = this.fightT, team = u.team;
      this.rewound = this.rewound || [];
      if (this.rewound[team]) return;
      if (T >= (this.snapAt || 0)) {
        this.snapAt = T + 2;
        (this.snaps || (this.snaps = [])).push(this.takeSnap()); if (this.snaps.length > 9) this.snaps.shift();
      }
      if (this.pendingRewind || T < 16) return;
      const str = this.strength(team) / ((this.str0 && this.str0[team]) || 1);
      if (str < 0.28 || u.hp < u.max * 0.25) {
        // (done after this tick's troops have moved, so nothing acts on the old copies)
        const snap = this.snaps.find(s => T - s.t >= 12) || this.snaps[0];
        if (snap && T - snap.t >= 6) this.pendingRewind = { snap, team };
      }
    },
    takeSnap() {
      const map = new Map();
      const units = this.units.filter(o => !o.dead).map(o => { const c = Object.assign({}, o); map.set(o, c); return c; });
      for (const c of units) { c.target = null; c.wp = null; c.cover = null; c.castOn = null; c.bites = null; c.hist = null; c.holding = null; c.grabbed = null; c.thrown = null; c.lift = 0; c.phased = !!(c.ashT || c.fuseTo || c.phaseTo); c.owner = map.get(c.owner) || null; c.charmBy = null; c.charmT = 0; if (c.bodies) c.bodies = c.bodies.slice(); }
      return { t: this.fightT, units, map, alive: this.alive.slice(), reserve: this.reserve.slice(), waves: this.waves.map(w => w.map(v => !!v.done)), gained: (this.gained || [0, 0, 0]).slice(), deaths: this.deaths };
    },
    restoreSnap(s, team) {
      const map = new Map(), cur = new Set(this.units);
      this.units = s.units.map(o => { const c = Object.assign({}, o); map.set(o, c); return c; });
      for (const c of this.units) { c.owner = map.get(c.owner) || null; c.px = c.x; c.py = c.y; c.retarget = 0; c.dead = false; if (c.bodies) c.bodies = c.bodies.slice(); }
      // anything else that points at a troop (battle events) now points at its rewound copy, or at nothing if it didn't exist yet
      const re = v => (cur.has(v) ? map.get(s.map.get(v)) || null : v);
      for (const ev of this.events || []) for (const k of Object.keys(ev)) {
        const v = ev[k];
        if (v && typeof v === 'object') { if (cur.has(v)) ev[k] = re(v); else if (Array.isArray(v) && v.some(x => cur.has(x))) ev[k] = v.map(re).filter(Boolean); else if (v instanceof Set) ev[k] = new Set([...v].map(re).filter(Boolean)); }
      }
      // tribes' chiefs, the kings and the duellists also point at their rewound copies; regrouping and focus targets start fresh
      if (this.tribes) { for (const tb of this.tribes) { tb.chief = tb.chief ? re(tb.chief) : null; tb.focus = null; } for (const c of this.units) { c.regT = 0; c.regTo = null; } }
      if (this.kings) this.kings = this.kings.map(k => (k ? re(k) || k : k));
      if (this.duel) { this.duel.a = re(this.duel.a) || this.duel.a; this.duel.b = re(this.duel.b) || this.duel.b; }
      this.alive = s.alive.slice(); this.reserve = s.reserve.slice(); this.waves.forEach((w, t) => w.forEach((v, i) => { v.done = s.waves[t][i]; })); this.gained = s.gained.slice(); this.deaths = s.deaths;
      this.arrows = []; this.fields = []; this.calls = []; this.spawnQ = []; this.clouds = []; this.fires = []; this.beams = []; this.rising = [];
      this.best = [null, null, null]; this.best[MONSTERS] = null;
      for (const c of this.units) if (c.kills && (!this.best[c.team] || c.kills > this.best[c.team].kills)) this.best[c.team] = c;
      this.champOf = []; for (const c of this.units) if (c.champ && c.team < 3) this.champOf[c.team] = c;
      this.tag = null;
      if (this.rootUnits) this.rootUnits = new Set(this.units.filter(c => c.plantT && UNIT[c.type].roots));
      // ...and its army remembers what happened: it hits a quarter harder
      for (const c of this.units) if (c.team === team) c.dmgK = (c.dmgK || 1) * 1.25;
      this.rewound[team] = true; this.rewindAll = { t0: this.fightT };
      this.banner('THE GENERAL CANNOT LOSE: REWIND!', TEAMS[team].c, 2.4); this.snd('glitch'); this.snd('phase');
      const gen = this.units.find(c => c.team === team && UNIT[c.type].rewindAll);
      if (this.camEv) this.camEv.push({ type: 'spot', follow: gen, x: gen ? gen.x : AR.x + AR.w / 2, y: gen ? gen.y : AR.y + AR.h / 2, prio: 95, dur: 2.6, z: 1.5, slow: true });
      this.xf.rewound = TEAMS[team].name;
    },
    // ----- after a troop dies (second batch) -----
    onDeath2(u, from) {
      const U = UNIT[u.type], T = this.fightT, killer = from && from.team !== u.team && !from.dead ? from : null;
      if (killer && (UNIT[killer.type].haunt || killer.hollow) && U.rank !== 0 && !U.uncounted && !U.commander && !U.cosmos && !U.fraud && !U.bribe && !u.hollow && !u.ghost && killer.team < 3) {
        // the Empty Army: the fallen troop's gear gets up and fights on as a hollow copy
        this.hollowN = this.hollowN || [0, 0, 0];
        if (this.hollowN[killer.team] < 40) { this.hollowN[killer.team]++; this.spawnQ.push({ at: T + 0.5, team: killer.team, type: u.type, x: u.x, y: u.y, hollow: true }); this.xf.hollow = (this.xf.hollow || 0) + 1; }
      }
      if (U.bloom) { for (const o of this.near(u.x, u.y, 110)) if (o.team === u.team) { this.heal(o, 4 * this.hpScale); o.healFlash = 1; } this.burst(u.x, u.y, '#7CFFB0', 10, 200, 0.6, 6, -40); }
      if (U.cosmos && u.team < 3) {
        this.univN = this.univN || [0, 0, 0];
        if (this.univN[u.team] < 3) {
          this.univN[u.team]++;
          const type = UNIVERSE_ARMIES[Math.floor(this.R.next() * UNIVERSE_ARMIES.length)];
          for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; this.spawnQ.push({ at: T + 0.7 + k * 0.08, team: u.team, type, x: u.x + Math.cos(a) * 26, y: u.y + Math.sin(a) * 26, portal: true }); }
          (this.galaxies || (this.galaxies = [])).push({ x: u.x, y: u.y, t0: T });
          if (!this.univSaid) { this.univSaid = true; this.banner('A UNIVERSE OPENS INSIDE HIM!', TEAMS[u.team].c, 1.8); if (this.camEv) this.camEv.push({ type: 'spot', x: u.x, y: u.y, prio: 77, dur: 2.2, z: 1.9, slow: true }); }
          this.xf.universe = (this.xf.universe || 0) + 1; this.snd('portal');
        }
      }
      if (U.tempest && !this.permaStorm) { this.permaStorm = { next: T + 2 }; this.bannerQ.push({ at: T + 1.7, text: 'THE STORM REMAINS!', col: '#BFE6FF' }); }
      if (this.weather === 'bloodmoon' && killer) { killer.hp = Math.min(killer.max, killer.hp + killer.max * 0.3); killer.drainFx = 1; }
    },
    // ----- the rest of each tick (second batch) -----
    postStep2(h) {
      const T = this.fightT, F = this.fixed || this.target;
      // the Star Eater's darkness fades if it falls; the darkness withers its enemies
      if (this.dark) {
        if (!this.units.some(o => !o.dead && UNIT[o.type].eclipse && o.team === this.dark.team)) this.dark.k = Math.max(0, this.dark.k - h * 0.3);
        if (this.dark.k > 0.4) for (const o of this.units) if (!o.dead && o.team !== this.dark.team && o.team < 3) this.dot(o, 0.05 * this.dark.k * h * this.hpScale, null);
      }
      if (this.moon) {
        if (!this.units.some(o => !o.dead && UNIT[o.type].moon && o.team === this.moon.team)) this.moon.k = Math.max(0, this.moon.k - h * 0.25);
        const tide = this.moon.k >= 0.6 ? (this.moon.k - 0.6) / 0.4 * 200 : 0;
        this.moon.tide = tide;
        if (tide > 1 && T >= (this.tideAt || 0)) {
          this.tideAt = T + 0.25;
          for (const o of this.units) if (!o.dead && !o.flying && o.team !== this.moon.team && (o.x < AR.x + tide || o.x > AR.x + AR.w - tide)) { this.slowDown(o, 0.5, 0.35); this.dot(o, 0.12 * this.hpScale, null); }
        }
      }
      if (this.permaStorm && T >= this.permaStorm.next) {
        // the Storm Emperor's storm: lightning in mirrored pairs, so neither side gets hit more on purpose
        this.permaStorm.next = T + 4;
        const x = this.R.range(AR.x + 80, AR.x + AR.w - 80), dy = this.R.range(40, 380), mid = AR.y + AR.h / 2;
        for (const y of [mid - dy, mid + dy]) this.calls.push({ x, y, at: T + 0.7, t0: T, r: 42, dmg: 6, team: -1, from: null, kind: 'lightning' });
      }
      // a commander left alone with its army gone transforms into a monster
      if (this.sys.transform && T >= (this.transAt || 0)) {
        this.transAt = T + 0.5; this.transformed = this.transformed || [];
        const tot = this.totals();
        for (const t of this.teamIds()) {
          if (this.transformed[t] || tot[t] > 2 || tot[t] === 0) continue;
          const g = this.units.find(o => !o.dead && o.team === t && UNIT[o.type].commander === 2 && !UNIT[o.type].healer);
          if (!g) continue;
          this.transformed[t] = true;
          g.r = 34; g.m = g.r * g.r; g.max = 160 * this.hpScale; g.hp = g.max; g.dmgK = (g.dmgK || 1) * 3; g.stomp = 50; g.boss = true; g.transformed = true; g.title = 'TRANSFORMED'; g.flying = false;
          this.banner(`${TEAMS[t].name} ${labelOf(g.type).replace(/^THE /, '')} TRANSFORMS!`, TEAMS[t].c, 2.2); this.shake(16); this.snd('roar');
          this.burst(g.x, g.y, '#E5484D', 26, 420, 0.7, 9);
          if (this.camEv) this.camEv.push({ type: 'spot', follow: g, prio: 88, dur: 2.6, z: 1.8, slow: true });
          this.xf.transform = labelOf(g.type);
        }
      }
      if (this.notes) this.notes = this.notes.filter(n => T - n.t0 < 1.2);
      if (this.pendingRewind) { const p = this.pendingRewind; this.pendingRewind = null; this.restoreSnap(p.snap, p.team); }
    },
    // ----- the new hazards: a stampede, the kraken (pirate battles) -----
    ev_stampede(ev, h) {
      if (!ev.started) {
        if (this.fightT < ev.at) return;
        const E = this.ER, dir = E.chance(0.5) ? 1 : -1, mid = AR.y + AR.h / 2, d1 = E.range(70, 160), d2 = E.range(220, 340);
        ev.herd = [];
        for (const dy of [d1, d2]) for (const sg of [-1, 1]) ev.herd.push({ x: dir > 0 ? AR.x - 80 - E.range(0, 120) : AR.x + AR.w + 80 + E.range(0, 120), y: mid + sg * dy, kind: dy === d1 ? 'mammoth' : 'rhino', hit: new Set(), gait: E.range(0, TAU) });
        // the same delay for each mirrored pair, so both sides get hit at the same time
        for (let i = 0; i < ev.herd.length; i += 2) ev.herd[i + 1].x = ev.herd[i].x;
        Object.assign(ev, { started: true, dir });
        this.banner('STAMPEDE!', COL.gold, 2); this.snd('rumble'); this.snd('alarm');
        if (this.facts) this.facts.hazard = 'stampede'; this.xf.stampede = true;
        if (this.camEv) this.camEv.push({ type: 'hazard', ev });
      }
      ev.t += h;
      let live = 0;
      for (const a of ev.herd) {
        a.x += ev.dir * 280 * h;
        if (a.x > AR.x - 160 && a.x < AR.x + AR.w + 160) live++;
        const R = a.kind === 'mammoth' ? 34 : 24;
        for (const o of this.near(a.x, a.y, R + 20)) {
          if (o.flying || a.hit.has(o) || UNIT[o.type].immovable) continue;
          a.hit.add(o); this._kind = 'blade'; this.damage(o, 4 * (UNIT[o.type].rank === 0 ? 2 : 1), null);
          this.knock(o, o.x, a.y + (o.y < a.y ? 30 : -30), 45);
        }
        if (this.FX.chance(h * 20)) this.burst(a.x - ev.dir * R, a.y + this.FX.range(-R, R), '#8A7A5A', 2, 80, 0.5, 6, -20);
      }
      this.shake(3);
      if (ev.t > 1 && !live) ev.done = true;
      if (ev.t > 9) ev.done = true;
    },
    ev_kraken(ev, h) {
      if (!ev.started) {
        if (this.fightT < ev.at) return;
        const E = this.ER, mid = AR.y + AR.h / 2;
        ev.arms = [];
        for (let k = 0; k < 3; k++) { const x = AR.x + 160 + k * (AR.w - 320) / 2 + E.range(-60, 60), dy = E.range(80, 300), ph = E.range(0, TAU); for (const sg of [-1, 1]) ev.arms.push({ x, y: mid + sg * dy, ph, sg }); }
        Object.assign(ev, { started: true });
        this.banner('THE KRAKEN!', '#A855F7', 2); this.snd('roar'); this.snd('rumble'); this.shake(12);
        if (this.facts) this.facts.hazard = 'kraken'; this.xf.kraken = true;
        if (this.camEv) this.camEv.push({ type: 'hazard', ev });
      }
      ev.t += h;
      const up = clamp(ev.t / 0.6, 0, 1) * clamp((4.2 - ev.t) / 0.6, 0, 1);
      for (const a of ev.arms) {
        // each tentacle sweeps round its hole, grabbing and squeezing whoever it touches
        const ang = a.ph + ev.t * 1.6 * a.sg, tx = a.x + Math.cos(ang) * 70 * up, ty = a.y + Math.sin(ang) * 70 * up;
        a.tx = tx; a.ty = ty;
        if (up > 0.5) for (const o of this.near(tx, ty, 40)) if (!o.flying) { this.dot(o, 3.5 * h * this.hpScale, null); o.x += (a.x - o.x) * h * 1.5; o.y += (a.y - o.y) * h * 1.5; }
      }
      if (ev.t > 4.3) ev.done = true;
    },
    drawEvent2(ctx, ev) {
      if (ev.type === 'stampede' && ev.started && !ev.done) {
        for (const a of ev.herd) {
          if (a.x < AR.x - 120 || a.x > AR.x + AR.w + 120) continue;
          const fake = { r: a.kind === 'mammoth' ? 34 : 24, face: ev.dir > 0 ? 0 : Math.PI, mface: ev.dir > 0 ? 0 : Math.PI, vx: ev.dir * 280, vy: 0, gait: a.gait, lunge: 0, type: a.kind, x: a.x, y: a.y };
          if (a.kind === 'mammoth') this.drawMount(ctx, fake, a.x, a.y, 'mammoth', TEAMS[MONSTERS]);
          else this.drawRoster2(ctx, fake, a.x, a.y, TEAMS[MONSTERS]);
        }
      }
      if (ev.type === 'kraken' && ev.started && !ev.done) {
        const up = clamp(ev.t / 0.6, 0, 1) * clamp((4.2 - ev.t) / 0.6, 0, 1);
        for (const a of ev.arms) {
          disc(ctx, a.x, a.y, 26 * up + 4, '#0B1E33', 3);
          if (up <= 0.05) continue;
          const mx = (a.x + a.tx) / 2 + Math.cos(ev.t * 3 + a.ph) * 20, my = (a.y + a.ty) / 2 + Math.sin(ev.t * 3 + a.ph) * 20;
          ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, a.tx, a.ty);
          ctx.lineWidth = 24 * up + 3; ctx.strokeStyle = COL.ink; ctx.stroke(); ctx.lineWidth = 24 * up; ctx.strokeStyle = '#9D4EDD'; ctx.stroke();
          ctx.lineWidth = 10 * up; ctx.strokeStyle = '#C77DFF'; ctx.stroke();
          for (let k = 1; k < 4; k++) { const f = k / 4, sx = (1 - f) * (1 - f) * a.x + 2 * (1 - f) * f * mx + f * f * a.tx, sy = (1 - f) * (1 - f) * a.y + 2 * (1 - f) * f * my + f * f * a.ty; disc(ctx, sx, sy, 3.5 * up, '#F4E1FF', 1.2); }
        }
      }
    },
    // the new supply-drop power-ups (second batch)
    powerup2(kind, ev, team) {
      const T = this.fightT, name = TEAMS[team].name, S = this.SR;
      if (kind === 'clone') {
        const mine = this.units.filter(o => o.team === team && !o.dead && UNIT[o.type].rank !== 0 && !UNIT[o.type].uncounted && !UNIT[o.type].commander);
        const n = Math.min(6, mine.length);
        for (let k = 0; k < n; k++) { const o = mine[S.int(0, mine.length - 1)]; this.spawnQ.push({ at: T + 0.4, team, type: o.type, x: o.x + S.range(-24, 24), y: o.y + S.range(-24, 24), mimic: 'copy' }); this.beams.push({ x0: ev.x, y0: ev.y, x1: o.x, y1: o.y, t0: T, life: 0.5, col: '#38BDF8', w: 4 }); }
        return `${name}: CLONE RAY!`;
      }
      if (kind === 'ghosts') {
        const list = this.fallen[team].splice(-10);
        list.forEach((f, i) => this.spawnQ.push({ at: T + 0.4 + i * 0.05, team, type: f.type, x: f.x, y: f.y, ghost: true }));
        this.snd('groan');
        return list.length ? `${name}: GHOST ARMY RISES!` : `${name}: GHOST ARMY!`;
      }
      return `${name} GRABS THE DROP`;
    },
  };
  // ----- looks of the second troop batch (flat cartoon, black outlines, team colours) -----
  const ARMY_DRAW2 = {
    drawMammoth(ctx, u, x, y, tm) {
      const r = u.r, a = u.mface !== undefined ? u.mface : u.face, mv = Math.hypot(u.vx, u.vy) > 12, ph = this.t * 10 + u.gait, gal = mv ? Math.sin(ph) : 0, INK = COL.ink, FUR = '#6B4A32';
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      for (const [lx, ly] of [[0.45, -0.58], [0.45, 0.58], [-0.5, -0.58], [-0.5, 0.58]]) { const ex = r * lx + gal * r * 0.08 * Math.sign(lx * ly), ey = r * ly; ctx.moveTo(ex + r * 0.21, ey); ctx.ellipse(ex, ey, r * 0.21, r * 0.18, 0, 0, TAU); }
      ctx.fillStyle = '#4A3424'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.9, 0); ctx.lineTo(-r * 1.2, Math.sin(ph * 0.5) * r * 0.15); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
      // a shaggy coat: a bumpy outline all the way round
      ctx.beginPath();
      for (let k = 0; k <= 32; k++) { const t = k / 32 * TAU, rr = k % 2 ? 1.07 : 0.98, px = Math.cos(t) * r * 0.98 * rr - r * 0.05, py = Math.sin(t) * r * 0.78 * rr; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.closePath(); ctx.fillStyle = FUR; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath(); for (let k = 0; k < 6; k++) { const yy = (k - 2.5) * r * 0.22; ctx.moveTo(-r * 0.75, yy); ctx.quadraticCurveTo(-r * 0.4, yy + r * 0.06, -r * 0.1, yy); } ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(4,6,11,0.3)'; ctx.stroke();
      ell(ctx, r * 0.8, 0, r * 0.42, r * 0.4, 0, FUR, 3);
      disc(ctx, r * 0.72, 0, r * 0.25, '#7A5A40', 0);
      // long curling tusks
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 1.0, sd * r * 0.16); ctx.quadraticCurveTo(r * 1.55, sd * r * 0.62, r * 1.62, sd * r * 0.12); ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#F4F1E6'; ctx.stroke(); }
      const sw = Math.sin(this.t * 4 + u.gait) * r * 0.25 + (u.lunge || 0) * r * 0.3;
      ctx.beginPath(); ctx.moveTo(r * 1.08, 0); ctx.quadraticCurveTo(r * 1.45, sw * 0.5, r * 1.58, sw); ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 8; ctx.strokeStyle = FUR; ctx.stroke();
      roundRect(ctx, -r * 0.55, -r * 0.42, r * 0.8, r * 0.84, 6); ctx.fillStyle = tm.c; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = tm.l; ctx.strokeRect(-r * 0.45, -r * 0.32, r * 0.6, r * 0.64);
      disc(ctx, -r * 0.15, 0, r * 0.2, tm.d, 2);
      ctx.restore();
    },
    drawRoster2(ctx, u, x, y, tm) {
      if (CAST3_SET.has(u.type)) return this.drawCast3(ctx, u, x, y, tm);
      const r = u.r, f = u.face, fx = Math.cos(f), fy = Math.sin(f), px = -fy, py = fx, INK = COL.ink, T = this.t, lg = u.lunge || 0;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const cx = x - fx * r * 0.1, cy = y - fy * r * 0.1;
      const ring = (rr, w, c) => { ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.lineWidth = w; ctx.strokeStyle = c; ctx.stroke(); };
      const eyes = (hx, hy, fwd, sp, rr, c) => { ctx.fillStyle = c; ctx.beginPath(); for (const sd of [-1, 1]) { const ex = hx + fx * fwd + px * sd * sp, ey = hy + fy * fwd + py * sd * sp; ctx.moveTo(ex + rr, ey); ctx.arc(ex, ey, rr, 0, TAU); } ctx.fill(); };
      const P = (a, b) => [x + fx * a + px * b, y + fy * a + py * b];
      const staff = (len, col) => { const [sx, sy] = P(0, r * 0.65), ex = sx + fx * (r + len), ey = sy + fy * (r + len); stick(ctx, sx - fx * 6, sy - fy * 6, ex, ey, 3, col); return [ex, ey]; };
      switch (u.type) {
        case 'king': this.drawKing(ctx, u, x, y, tm); break;
        case 'frostwitch': {
          const [ex, ey] = staff(12, '#B9D7EA'), m = u.muzzle || 0;
          disc(ctx, x, y, r, tm.c, 3);
          disc(ctx, x - fx * 2, y - fy * 2, r * 0.66, '#DCEFFF', 2); disc(ctx, x - fx * 2.5, y - fy * 2.5, r * 0.3, '#7CC8FF', 1.5);
          disc(ctx, ex, ey, 9 + 5 * m, `rgba(191,230,255,${0.3 + 0.4 * m})`, 0);
          ctx.save(); ctx.translate(ex, ey); ctx.rotate(T * 2 + u.gait);
          ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(4, 0); ctx.lineTo(0, 7); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fillStyle = '#E6F6FF'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
          ctx.restore();
          break;
        }
        case 'lich': {
          ctx.beginPath(); for (let k = 0; k < 2; k++) { const a = T * 2.5 + u.gait + k * Math.PI, ox = x + Math.cos(a) * (r + 9), oy = y + Math.sin(a) * (r + 9); ctx.moveTo(ox + 3.5, oy); ctx.arc(ox, oy, 3.5, 0, TAU); } ctx.fillStyle = 'rgba(124,255,176,0.85)'; ctx.fill();
          const [ex, ey] = staff(10, '#3A3330');
          disc(ctx, ex, ey, 5, '#7CFFB0', 1.5);
          disc(ctx, x, y, r, '#1F2A2A', 3); ring(r - 2.5, 3, tm.c);
          const [hx, hy] = P(r * 0.12, 0); disc(ctx, hx, hy, r * 0.52, '#E8E2D0', 2);
          eyes(hx, hy, r * 0.18, r * 0.17, 2.2, '#22C55E');
          ctx.beginPath(); ctx.arc(hx, hy, r * 0.52, f + 2, f + 4.3); ctx.lineWidth = 3; ctx.strokeStyle = COL.gold; ctx.stroke();
          break;
        }
        case 'stormcaller': {
          const [ex, ey] = staff(12, '#6B5A3A'), fl = 0.6 + 0.4 * Math.sin(T * 23 + u.gait);
          disc(ctx, x, y, r, tm.c, 3); disc(ctx, x - fx * 2, y - fy * 2, r * 0.6, '#2B3A67', 2);
          disc(ctx, ex, ey, 6 + 4 * fl, 'rgba(253,224,71,0.3)', 0);
          ctx.beginPath(); ctx.moveTo(ex - 4, ey - 7); ctx.lineTo(ex + 2, ey - 1); ctx.lineTo(ex - 2, ey + 1); ctx.lineTo(ex + 4, ey + 7); ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#FDE047'; ctx.stroke();
          break;
        }
        case 'wisp': {
          const pl = 0.7 + 0.3 * Math.sin(T * 6 + u.gait);
          disc(ctx, x - fx * 10, y - fy * 10, r * 0.6, 'rgba(160,255,200,0.35)', 0); disc(ctx, x - fx * 17, y - fy * 17, r * 0.35, 'rgba(160,255,200,0.25)', 0);
          disc(ctx, x, y, r * 2.1 * pl, 'rgba(160,255,200,0.28)', 0);
          disc(ctx, x, y, r, '#E6FFF0', 2.5); disc(ctx, x, y, r * 0.5, tm.c, 0);
          break;
        }
        case 'gargoyle': {
          const stone = u.stoneT > this.fightT, fl = stone ? 0.55 : 0.88 + 0.12 * Math.sin(T * 9 + u.gait), G = stone ? '#A3A9B1' : '#7D8593';
          ell(ctx, x + 10, y + 24, r * 1.4, r * 0.7, f, 'rgba(0,0,0,0.25)', 0);
          // wide bat wings, folded when it turns to stone
          ctx.beginPath();
          for (const sd of [-1, 1]) {
            const a0 = P(r * 0.3, sd * r * 0.3), a1 = P(r * 0.1, sd * r * 2.7 * fl), a2 = P(-r * 1.0, sd * r * 2.3 * fl), a3 = P(-r * 0.45, sd * r * 0.35);
            ctx.moveTo(...a0); ctx.lineTo(...a1); ctx.quadraticCurveTo(...P(-r * 0.35, sd * r * 1.6 * fl), ...a2); ctx.quadraticCurveTo(...P(-r * 0.75, sd * r * 1.1 * fl), ...a3); ctx.closePath();
          }
          ctx.fillStyle = G; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
          ctx.beginPath(); for (const sd of [-1, 1]) { ctx.moveTo(...P(0, sd * r * 0.6)); ctx.lineTo(...P(r * 0.05, sd * r * 2.4 * fl)); ctx.moveTo(...P(-r * 0.1, sd * r * 0.6)); ctx.lineTo(...P(-r * 0.85, sd * r * 2.1 * fl)); }
          ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(4,6,11,0.45)'; ctx.stroke();
          disc(ctx, x, y, r * 0.8, G, 3); ring(r * 0.8 - 2.5, 2.5, tm.c);
          const [hx, hy] = P(r * 0.75, 0); disc(ctx, hx, hy, r * 0.4, G, 2.5);
          for (const sd of [-1, 1]) tri(ctx, ...P(r * 0.7, sd * r * 0.2), ...P(r * 0.42, sd * r * 0.6), ...P(r * 0.9, sd * r * 0.32), '#4B5160');
          if (!stone) eyes(hx, hy, r * 0.15, r * 0.15, 2.2, '#FF6B3D');
          else { ctx.beginPath(); ctx.moveTo(...P(-r * 0.6, -r * 0.3)); ctx.lineTo(...P(0, 0)); ctx.lineTo(...P(r * 0.2, r * 0.45)); ctx.moveTo(...P(0, 0)); ctx.lineTo(...P(-r * 0.2, r * 0.5)); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(4,6,11,0.6)'; ctx.stroke(); }
          break;
        }
        case 'assassin': {
          for (const sd of [-1, 1]) { const sw = sd > 0 ? lg * 1.1 : 0, a = f + sd * (0.55 - sw), [bx, by] = P(r * 0.3, sd * r * 0.72); stick(ctx, bx, by, bx + Math.cos(a) * 14, by + Math.sin(a) * 14, 2.5, COL.steel); }
          disc(ctx, x, y, r, '#1A1D24', 3);
          stick(ctx, ...P(-r * 0.7, -r * 0.55), ...P(r * 0.7, r * 0.55), 3, tm.c);
          disc(ctx, x - fx * 2, y - fy * 2, r * 0.55, '#262A33', 2);
          eyes(x - fx * 2, y - fy * 2, r * 0.36, r * 0.16, 1.6, '#F4F6FB');
          break;
        }
        case 'siegegunner': {
          const [mx, my] = P(r * 0.35, r * 0.85);
          disc(ctx, x, y, r, tm.c, 3); disc(ctx, x - fx * 2, y - fy * 2, r * 0.6, '#B08D57', 2);
          ctx.save(); ctx.translate(mx, my); ctx.rotate(f);
          roundRect(ctx, -8, -6, 18, 12, 3); ctx.fillStyle = '#3A3F47'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
          disc(ctx, 10, 0, 6.5, '#2B2F36', 2); disc(ctx, 10, 0, 3.5, '#0B0C0F', 0);
          ctx.restore();
          if (u.muzzle > 0) disc(ctx, mx + fx * 15, my + fy * 15, 9 * u.muzzle, `rgba(255,220,120,${u.muzzle})`, 0);
          break;
        }
        case 'catapult': {
          // the arm flies forward when it throws, then is wound back while it reloads
          const m = clamp((u.cd / UNIT.catapult.cd - 0.55) / 0.35, 0, 1), ax = r * 0.95 * (2 * m - 1);
          ctx.save(); ctx.translate(x, y); ctx.rotate(f);
          ctx.beginPath(); for (const sd of [-1, 1]) for (const lx of [-0.6, 0.6]) ctx.rect(r * lx - r * 0.22, sd * r * 0.8 - r * 0.12, r * 0.44, r * 0.24);
          ctx.fillStyle = '#3A2A1A'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
          roundRect(ctx, -r * 0.95, -r * 0.65, r * 1.9, r * 1.3, 6); ctx.fillStyle = '#8A6A49'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-r * 0.95, -r * 0.3); ctx.lineTo(r * 0.95, -r * 0.3); ctx.moveTo(-r * 0.95, r * 0.3); ctx.lineTo(r * 0.95, r * 0.3); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(4,6,11,0.35)'; ctx.stroke();
          roundRect(ctx, -r * 0.85, -r * 0.5, r * 0.45, r, 3); ctx.fillStyle = tm.c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ax, 0); ctx.lineWidth = 10; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = '#C9A36A'; ctx.stroke();
          disc(ctx, ax, 0, r * 0.3, '#5B3A22', 2.5);
          if (m < 0.3) disc(ctx, ax, 0, r * 0.2, '#8A8F98', 2);
          disc(ctx, 0, 0, 4, '#3A3F47', 1.5);
          ctx.restore();
          break;
        }
        case 'mammoth': break;
        case 'rhino': {
          const mv = Math.hypot(u.vx, u.vy) > 12, ph = this.t * 12 + u.gait;
          ctx.save(); ctx.translate(x, y); ctx.rotate(f);
          ctx.beginPath(); for (const [lx, ly, p] of [[0.55, -0.62, 0], [0.55, 0.62, Math.PI], [-0.55, -0.62, Math.PI], [-0.55, 0.62, 0]]) { const lx2 = r * lx + (mv ? Math.sin(ph + p) * r * 0.2 : 0), ly2 = r * ly; ctx.moveTo(lx2 + r * 0.2, ly2); ctx.ellipse(lx2, ly2, r * 0.2, r * 0.14, 0, 0, TAU); }
          ctx.fillStyle = '#5B6068'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
          ell(ctx, 0, 0, r * 1.15, r * 0.72, 0, '#8E949C', 3);
          roundRect(ctx, -r * 0.6, -r * 0.58, r * 0.95, r * 1.16, 6); ctx.fillStyle = tm.c; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
          ell(ctx, r * 0.98, 0, r * 0.42, r * 0.36, 0, '#8E949C', 2.5);
          for (const sd of [-1, 1]) tri(ctx, r * 0.78, sd * r * 0.2, r * 0.64, sd * r * 0.44, r * 0.88, sd * r * 0.3, '#6E737C');
          tri(ctx, r * 1.22, -r * 0.13, r * 1.8 + lg * r * 0.2, 0, r * 1.22, r * 0.13, '#F4F1E6', 2);
          tri(ctx, r * 1.02, -r * 0.08, r * 1.22, 0, r * 1.02, r * 0.08, '#F4F1E6', 1.5);
          ctx.restore();
          if ((u.runT || 0) > 0.4) disc(ctx, x + fx * r * 1.8, y + fy * r * 1.8, 7, 'rgba(255,240,180,0.6)', 0);
          break;
        }
        case 'ogre': {
          const a = f + 0.8 - lg * 1.4, [bx, by] = P(r * 0.2, r * 0.8), L = r * 1.4;
          stick(ctx, bx, by, bx + Math.cos(a) * L, by + Math.sin(a) * L, 7, '#7A5230');
          disc(ctx, bx + Math.cos(a) * L * 1.04, by + Math.sin(a) * L * 1.04, r * 0.34, '#7A5230', 2.5);
          disc(ctx, x, y, r, '#9CA86A', 3.5);
          ctx.beginPath(); ctx.arc(x, y, r * 0.74, f + 1.9, f + 4.4); ctx.lineWidth = 7; ctx.strokeStyle = tm.c; ctx.stroke();
          const [hx, hy] = P(r * 0.48, 0); disc(ctx, hx, hy, r * 0.42, '#B3BE7C', 2.5);
          for (const sd of [-1, 1]) tri(ctx, ...P(r * 0.8, sd * r * 0.12), ...P(r * 0.98, sd * r * 0.2), ...P(r * 0.8, sd * r * 0.28), '#F4F1E6', 1.2);
          eyes(hx, hy, r * 0.12, r * 0.15, 2, '#2A2F3A');
          break;
        }
        case 'drone': {
          ell(ctx, x + 8, y + 18, r * 1.2, r * 0.8, 0, 'rgba(0,0,0,0.2)', 0);
          ctx.save(); ctx.translate(x, y); ctx.rotate(f);
          ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(-r, r); ctx.lineTo(r, -r); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#5B6472'; ctx.stroke();
          const sp = this.t * 40 + u.gait;
          ctx.beginPath(); for (const [ax, ay] of [[-r, -r], [r, r], [-r, r], [r, -r]]) { ctx.moveTo(ax + Math.cos(sp) * 6, ay + Math.sin(sp) * 6); ctx.lineTo(ax - Math.cos(sp) * 6, ay - Math.sin(sp) * 6); }
          ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(230,236,244,0.85)'; ctx.stroke();
          roundRect(ctx, -r * 0.6, -r * 0.45, r * 1.2, r * 0.9, 3); ctx.fillStyle = tm.c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
          if (Math.sin(this.t * 10 + u.gait) > 0) disc(ctx, r * 0.5, 0, 2.2, '#FF3B3B', 0);
          ctx.restore();
          break;
        }
        case 'helicopter': {
          ell(ctx, x + 22, y + 48, r * 1.2, r * 0.5, f, 'rgba(0,0,0,0.25)', 0);
          ctx.save(); ctx.translate(x, y); ctx.rotate(f);
          ctx.beginPath(); ctx.moveTo(-r * 0.4, 0); ctx.lineTo(-r * 1.5, 0); ctx.lineWidth = r * 0.24 + 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = r * 0.24; ctx.strokeStyle = tm.d; ctx.stroke();
          const ta = this.t * 34; ctx.beginPath(); ctx.moveTo(-r * 1.5 + Math.cos(ta) * 3, -r * 0.32); ctx.lineTo(-r * 1.5 - Math.cos(ta) * 3, r * 0.32); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(220,230,240,0.75)'; ctx.stroke();
          roundRect(ctx, -r * 0.2, -r * 0.78, r * 0.35, r * 1.56, 3); ctx.fillStyle = '#3A404C'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
          ctx.beginPath(); for (const sd of [-1, 1]) ctx.rect(-r * 0.28, sd * r * 0.72 - r * 0.11, r * 0.58, r * 0.22); ctx.fillStyle = '#5B6472'; ctx.fill(); ctx.stroke();
          ell(ctx, r * 0.05, 0, r * 0.88, r * 0.42, 0, tm.c, 3.5);
          ell(ctx, r * 0.52, 0, r * 0.32, r * 0.26, 0, '#8FE3FF', 2.5);
          disc(ctx, 0, 0, r * 1.45, 'rgba(220,230,240,0.10)', 0);
          const ra = this.t * 30; ctx.beginPath(); for (let k = 0; k < 2; k++) { const a = ra + k * Math.PI / 2; ctx.moveTo(Math.cos(a) * r * 1.45, Math.sin(a) * r * 1.45); ctx.lineTo(-Math.cos(a) * r * 1.45, -Math.sin(a) * r * 1.45); }
          ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(30,34,42,0.75)'; ctx.stroke();
          disc(ctx, 0, 0, 5, '#2A2F3A', 2);
          if (u.muzzle > 0) disc(ctx, r * 0.98, 0, 7 * u.muzzle, `rgba(255,220,120,${u.muzzle})`, 0);
          ctx.restore();
          break;
        }
        case 'siren': {
          const wv = Math.sin(T * 4 + u.gait) * 3;
          ctx.beginPath(); ctx.moveTo(...P(0, -r * 0.6)); ctx.quadraticCurveTo(...P(-r * 1.6, -r * 0.5 + wv), ...P(-r * 1.9, wv)); ctx.quadraticCurveTo(...P(-r * 1.6, r * 0.5 + wv), ...P(0, r * 0.6)); ctx.closePath();
          ctx.fillStyle = '#2DD4BF'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
          disc(ctx, x, y, r, tm.c, 3); disc(ctx, x - fx * 1.5, y - fy * 1.5, r * 0.55, '#2DD4BF', 2);
          disc(ctx, ...P(r * 0.75, r * 0.5), 4.5, '#F9A8D4', 1.5);
          break;
        }
        case 'hollow': {
          const bob = Math.sin(T * 3 + u.gait) * 1.5, yy = y + bob;
          disc(ctx, x, yy, r + 5, 'rgba(124,243,255,0.13)', 0);
          const a = f + 0.75 - lg * 1.3, [bx, by] = P(r * 0.3, r * 0.75); stick(ctx, bx, by + bob, bx + Math.cos(a) * 20, by + bob + Math.sin(a) * 20, 3, COL.steel);
          stick(ctx, x - fx * 1.5, yy - fy * 1.5, x - fx * (r + 5), yy - fy * (r + 5), 2.5, tm.c);
          disc(ctx, x, yy, r, '#AEB6C6', 3); disc(ctx, x - fx, yy - fy, r * 0.62, '#D9DEE6', 2);
          ctx.beginPath(); ctx.moveTo(x + fx * r * 0.3 + px * r * 0.38, yy + fy * r * 0.3 + py * r * 0.38); ctx.lineTo(x + fx * r * 0.3 - px * r * 0.38, yy + fy * r * 0.3 - py * r * 0.38); ctx.lineWidth = 4; ctx.strokeStyle = '#0B0C0F'; ctx.stroke();
          eyes(x, yy, r * 0.3, r * 0.16, 1.5, '#7CF3FF');
          break;
        }
        case 'livingblade': {
          const a = T * 9 + u.gait, ca = Math.cos(a), sa = Math.sin(a);
          ell(ctx, x + 6, y + 14, 12, 4, a, 'rgba(0,0,0,0.2)', 0);
          stick(ctx, x - ca * 15, y - sa * 15, x + ca * 15, y + sa * 15, 3.5, COL.steel);
          stick(ctx, x - ca * 7 - sa * 6, y - sa * 7 + ca * 6, x - ca * 7 + sa * 6, y - sa * 7 - ca * 6, 3, COL.gold);
          disc(ctx, x - ca * 12, y - sa * 12, 3.5, '#A855F7', 1.5); disc(ctx, x - ca * 12, y - sa * 12, 1.4, '#FDE047', 0);
          break;
        }
        case 'stareater': {
          const pl = 0.5 + 0.5 * Math.sin(T * 2 + u.gait);
          disc(ctx, x, y, r + 10 + pl * 5, 'rgba(76,29,149,0.25)', 0);
          ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + T * 0.5, w = Math.sin(T * 3 + k) * 0.3; ctx.moveTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); ctx.quadraticCurveTo(x + Math.cos(a + w) * r * 1.3, y + Math.sin(a + w) * r * 1.3, x + Math.cos(a + w * 2) * r * 1.55, y + Math.sin(a + w * 2) * r * 1.55); }
          ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 5.5; ctx.strokeStyle = '#2E2A5A'; ctx.stroke();
          disc(ctx, x, y, r, '#0B0A1A', 4); ring(r - 4, 4, tm.c);
          ctx.beginPath(); for (let k = 0; k < 12; k++) { const h1 = Math.imul(k + 1, 2654435761) >>> 0, a = (h1 % 628) / 100 + T * 0.2, d = r * (0.25 + 0.55 * ((h1 >>> 12) % 100) / 100), sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d; ctx.moveTo(sx + 1.7, sy); ctx.arc(sx, sy, 1.7, 0, TAU); }
          ctx.fillStyle = '#F4F6FB'; ctx.fill();
          const mo = 0.55 + lg * 0.35, [mx, my] = P(r * 0.2, 0);
          ctx.beginPath(); ctx.moveTo(mx, my); ctx.arc(mx, my, r * 0.72, f - mo, f + mo); ctx.closePath(); ctx.fillStyle = '#3B0A1E'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
          ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = f - mo + (k + 0.5) / 5 * 2 * mo, ox = mx + Math.cos(a) * r * 0.72, oy = my + Math.sin(a) * r * 0.72; ctx.moveTo(ox + Math.cos(a + 1.5) * 5, oy + Math.sin(a + 1.5) * 5); ctx.lineTo(mx + Math.cos(a) * r * 0.5, my + Math.sin(a) * r * 0.5); ctx.lineTo(ox + Math.cos(a - 1.5) * 5, oy + Math.sin(a - 1.5) * 5); ctx.closePath(); }
          ctx.fillStyle = '#F4F1E6'; ctx.fill();
          ctx.beginPath(); for (const sd of [-1, 1]) for (const o of [1.25, 1.65, 2.05]) { const a = f + sd * o, ex = x + Math.cos(a) * r * 0.62, ey = y + Math.sin(a) * r * 0.62; ctx.moveTo(ex + 4.5, ey); ctx.arc(ex, ey, 4.5, 0, TAU); }
          ctx.fillStyle = '#FDE047'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
          break;
        }
        case 'timeexec': {
          ctx.beginPath(); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU - T * 0.8; ctx.moveTo(x + Math.cos(a) * (r + 5), y + Math.sin(a) * (r + 5)); ctx.lineTo(x + Math.cos(a) * (r + 10), y + Math.sin(a) * (r + 10)); }
          ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(253,230,138,0.75)'; ctx.stroke();
          const a = f + 0.8 - lg * 1.5, [bx, by] = P(r * 0.2, r * 0.8), L = r * 1.6, ex = bx + Math.cos(a) * L, ey = by + Math.sin(a) * L, ca = Math.cos(a), sa = Math.sin(a);
          stick(ctx, bx, by, ex, ey, 4, '#3A2A1A');
          ctx.beginPath(); ctx.moveTo(ex - ca * 12, ey - sa * 12); ctx.quadraticCurveTo(ex - sa * 20, ey + ca * 20, ex + ca * 6, ey + sa * 6); ctx.closePath(); ctx.fillStyle = '#D9DEE6'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
          disc(ctx, x, y, r, '#1A1D24', 3.5); ring(r - 3, 3, tm.c);
          disc(ctx, x - fx * 2, y - fy * 2, r * 0.6, '#0B0C0F', 2);
          const [kx, ky] = P(-r * 0.42, 0); disc(ctx, kx, ky, r * 0.3, '#FDE68A', 2);
          ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + Math.cos(-T * 3) * r * 0.24, ky + Math.sin(-T * 3) * r * 0.24); ctx.moveTo(kx, ky); ctx.lineTo(kx + Math.cos(-T * 0.4) * r * 0.16, ky + Math.sin(-T * 0.4) * r * 0.16); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
          eyes(x - fx * 2, y - fy * 2, r * 0.38, r * 0.16, 1.8, '#FDE68A');
          break;
        }
        case 'cathedral': {
          const mv = Math.hypot(u.vx, u.vy) > 4, st = Math.sin(T * 3 + u.gait) * r * 0.12;
          ctx.save(); ctx.translate(x, y); ctx.rotate(f);
          ctx.beginPath(); for (const sd of [-1, 1]) for (const lx of [-0.6, 0.55]) { const ex = r * lx + (mv ? st * sd * Math.sign(lx) : 0), ey = sd * r * 0.72; ctx.moveTo(ex + r * 0.22, ey); ctx.ellipse(ex, ey, r * 0.22, r * 0.16, 0, 0, TAU); }
          ctx.fillStyle = '#6B6F78'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
          // the nave and transept, a cross seen from above, under a slate roof
          const W = r * 0.42, L = r * 0.95, Tr = r * 0.8;
          ctx.beginPath(); ctx.moveTo(-L, -W); ctx.lineTo(r * 0.05, -W); ctx.lineTo(r * 0.05, -Tr); ctx.lineTo(r * 0.45, -Tr); ctx.lineTo(r * 0.45, -W); ctx.lineTo(L * 0.6, -W); ctx.arc(L * 0.6, 0, W, -Math.PI / 2, Math.PI / 2); ctx.lineTo(r * 0.45, W); ctx.lineTo(r * 0.45, Tr); ctx.lineTo(r * 0.05, Tr); ctx.lineTo(r * 0.05, W); ctx.lineTo(-L, W); ctx.closePath();
          ctx.fillStyle = '#C9C3B4'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L * 0.6 + W, 0); ctx.moveTo(r * 0.25, -Tr); ctx.lineTo(r * 0.25, Tr); ctx.lineWidth = 3; ctx.strokeStyle = '#5B6472'; ctx.stroke();
          ctx.fillStyle = tm.c; ctx.beginPath(); ctx.rect(-r * 0.6, W - 1, r * 0.3, r * 0.2); ctx.rect(-r * 0.6, -W - r * 0.2 + 1, r * 0.3, r * 0.2); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
          // a rose window over the crossing, the bell tower at the back
          for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(r * 0.25, 0); ctx.arc(r * 0.25, 0, r * 0.22, k * TAU / 6, (k + 1) * TAU / 6); ctx.closePath(); ctx.fillStyle = ['#E5484D', '#3B82F6', '#FDE047'][k % 3]; ctx.fill(); }
          ctx.beginPath(); ctx.arc(r * 0.25, 0, r * 0.22, 0, TAU); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
          disc(ctx, -L + r * 0.05, 0, r * 0.3, '#B9B2A2', 3);
          ctx.beginPath(); ctx.moveTo(-L - r * 0.08, 0); ctx.lineTo(-L + r * 0.18, 0); ctx.moveTo(-L + r * 0.05, -r * 0.13); ctx.lineTo(-L + r * 0.05, r * 0.13); ctx.lineWidth = 3; ctx.strokeStyle = COL.gold; ctx.stroke();
          if (u.muzzle) { ctx.fillStyle = `rgba(255,236,170,${0.7 * u.muzzle})`; ctx.beginPath(); for (const sd of [-1, 1]) for (const lx of [-0.5, -0.2, 0.6]) { ctx.moveTo(r * lx + 4, sd * W * 0.6); ctx.arc(r * lx, sd * W * 0.6, 4, 0, TAU); } ctx.fill(); }
          ctx.restore();
          break;
        }
        case 'stormemperor': {
          const flap = 0.75 + 0.25 * Math.sin(this.t * 6 + u.gait);
          ell(ctx, x + 16, y + 40, r * 1.2, r * 0.7, f, 'rgba(0,0,0,0.3)', 0);
          ctx.save(); ctx.translate(x, y); ctx.rotate(f); ctx.lineJoin = 'round';
          ctx.beginPath();
          for (const sd of [-1, 1]) { ctx.moveTo(r * 0.35, sd * r * 0.3); ctx.lineTo(-r * 0.1, sd * r * 1.9 * flap); ctx.lineTo(-r * 0.5, sd * r * 1.5 * flap); ctx.lineTo(-r * 0.85, sd * r * 1.7 * flap); ctx.lineTo(-r * 0.6, sd * r * 0.3); ctx.closePath(); }
          ctx.fillStyle = '#1E293B'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
          ctx.beginPath(); for (const sd of [-1, 1]) { ctx.moveTo(r * 0.1, sd * r * 0.4); ctx.lineTo(-r * 0.15, sd * r * 1.0 * flap); ctx.lineTo(-r * 0.05, sd * r * 1.2 * flap); ctx.lineTo(-r * 0.4, sd * r * 1.55 * flap); }
          ctx.lineWidth = 2.5; ctx.strokeStyle = '#FDE047'; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.18); ctx.quadraticCurveTo(-r * 1.4, 0, -r * 1.8, Math.sin(this.t * 4 + u.gait) * r * 0.25); ctx.quadraticCurveTo(-r * 1.4, 0, -r * 0.7, r * 0.18); ctx.closePath(); ctx.fillStyle = tm.d; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
          ell(ctx, 0, 0, r * 0.85, r * 0.5, 0, tm.d, 3);
          ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.lineWidth = 4; ctx.strokeStyle = tm.c; ctx.stroke();
          disc(ctx, r * 0.95, 0, r * 0.36, tm.d, 3);
          for (const sd of [-1, 1]) for (const k of [0, 1]) tri(ctx, r * (0.82 - k * 0.2), sd * r * 0.2, r * (0.52 - k * 0.2), sd * r * (0.56 + k * 0.06), r * (0.92 - k * 0.2), sd * r * 0.3, COL.gold);
          ctx.fillStyle = '#BFE6FF'; ctx.beginPath(); for (const sd of [-1, 1]) { ctx.moveTo(r * 1.08 + r * 0.07, sd * r * 0.14); ctx.arc(r * 1.08, sd * r * 0.14, r * 0.07, 0, TAU); } ctx.fill();
          ctx.restore();
          // crackles of lightning around it
          const j = Math.floor(this.t * 10 + u.gait * 5);
          if (j % 3 === 0) { const h1 = Math.imul(j + 7, 2654435761) >>> 0, a = (h1 % 628) / 100; let bx = x + Math.cos(a) * r * 0.9, by = y + Math.sin(a) * r * 0.9; ctx.beginPath(); ctx.moveTo(bx, by); for (let k = 1; k <= 3; k++) { bx += Math.cos(a + (k % 2 ? 0.6 : -0.6)) * 14; by += Math.sin(a + (k % 2 ? 0.6 : -0.6)) * 14; ctx.lineTo(bx, by); } ctx.lineWidth = 3; ctx.strokeStyle = '#FDE047'; ctx.stroke(); }
          break;
        }
        case 'worldroot': {
          ctx.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + u.gait, L = r * (1.25 + 0.15 * Math.sin(k * 1.7)); ctx.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); ctx.quadraticCurveTo(x + Math.cos(a + 0.25) * r * 0.95, y + Math.sin(a + 0.25) * r * 0.95, x + Math.cos(a + 0.1) * L, y + Math.sin(a + 0.1) * L); }
          ctx.lineWidth = 11; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = '#6B4A2E'; ctx.stroke();
          const sw = Math.sin(T * 1.5 + u.gait) * 2;
          ctx.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + 0.4, qx = x + Math.cos(a) * r * 0.55 + sw, qy = y + Math.sin(a) * r * 0.55; ctx.moveTo(qx + r * 0.5, qy); ctx.arc(qx, qy, r * 0.5, 0, TAU); }
          ctx.fillStyle = '#2F7A3A'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
          disc(ctx, x + sw, y, r * 0.78, '#3E9A4A', 0);
          ctx.beginPath(); ctx.arc(x + sw, y, r * 0.52, 0, TAU); ctx.lineWidth = 6; ctx.strokeStyle = tm.c; ctx.stroke();
          ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.3, qx = x + sw + Math.cos(a) * r * 0.78, qy = y + Math.sin(a) * r * 0.78; ctx.moveTo(qx + 4.5, qy); ctx.arc(qx, qy, 4.5, 0, TAU); }
          ctx.fillStyle = '#FDE68A'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
          eyes(x + sw, y, r * 0.15, r * 0.16, 3.2, '#FDE68A');
          break;
        }
        case 'hourglass': {
          for (const sd of [-1, 1]) { const a = f + sd * (1.0 - (sd > 0 ? lg * 0.6 : 0)), bx = x + Math.cos(f + sd * 1.4) * r * 0.85, by = y + Math.sin(f + sd * 1.4) * r * 0.85, ex = bx + Math.cos(a) * r * 0.7, ey = by + Math.sin(a) * r * 0.7; stick(ctx, bx, by, ex, ey, 12, '#8E8A80'); disc(ctx, ex, ey, r * 0.26, '#8E8A80', 3); }
          disc(ctx, x, y, r, '#A8A293', 4); ring(r - 4, 4, tm.c);
          ctx.save(); ctx.translate(x - fx * r * 0.12, y - fy * r * 0.12); ctx.rotate(f + Math.PI / 2);
          const H = r * 0.55, Wd = r * 0.36, s = (T * 0.15 + u.gait) % 1;
          ctx.beginPath(); ctx.moveTo(-Wd, -H); ctx.lineTo(Wd, -H); ctx.lineTo(0, 0); ctx.lineTo(Wd, H); ctx.lineTo(-Wd, H); ctx.lineTo(0, 0); ctx.closePath(); ctx.fillStyle = 'rgba(220,240,255,0.6)'; ctx.fill();
          ctx.fillStyle = '#E9C46A'; ctx.beginPath(); ctx.moveTo(-Wd * 0.85 * (1 - s), -H * 0.85 * (1 - s)); ctx.lineTo(Wd * 0.85 * (1 - s), -H * 0.85 * (1 - s)); ctx.lineTo(0, -1); ctx.closePath();
          ctx.moveTo(-Wd * 0.85 * s, H * 0.88); ctx.lineTo(Wd * 0.85 * s, H * 0.88); ctx.lineTo(0, H * 0.88 * (1 - s)); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, H * 0.88); ctx.lineWidth = 1.5; ctx.strokeStyle = '#E9C46A'; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-Wd, -H); ctx.lineTo(Wd, -H); ctx.lineTo(0, 0); ctx.lineTo(Wd, H); ctx.lineTo(-Wd, H); ctx.lineTo(0, 0); ctx.closePath(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
          ctx.beginPath(); ctx.rect(-Wd - 4, -H - 5, 2 * Wd + 8, 5); ctx.rect(-Wd - 4, H, 2 * Wd + 8, 5); ctx.fillStyle = COL.gold; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
          ctx.restore();
          const [hx, hy] = P(r * 0.72, 0); disc(ctx, hx, hy, r * 0.3, '#A8A293', 3); eyes(hx, hy, r * 0.1, r * 0.12, 3, '#FDE68A');
          break;
        }
        case 'mooncaller': {
          const [ex, ey] = staff(12, '#9CA3AF');
          disc(ctx, x, y, r, tm.c, 3); disc(ctx, x - fx * 2, y - fy * 2, r * 0.6, '#C7D2FE', 2);
          disc(ctx, ex, ey, 12, 'rgba(244,241,230,0.22)', 0);
          disc(ctx, ex, ey, 7, '#F4F1E6', 2); disc(ctx, ex + fx * 3 + px * 2, ey + fy * 3 + py * 2, 5.5, '#4B5A8A', 0);
          break;
        }
        case 'unqualifiedking': {
          ctx.beginPath(); ctx.moveTo(x - fx * 2, y - fy * 2); ctx.arc(x - fx * 2, y - fy * 2, r * 1.4, f + 1.6, f + 4.7); ctx.closePath(); ctx.fillStyle = tm.c; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
          for (const sd of [-1, 1]) tri(ctx, ...P(0, sd * r * 0.6), ...P(-r * 0.3, sd * r * 1.45), ...P(r * 0.3, sd * r * 0.85), '#7BC96F', 2);
          disc(ctx, x, y, r, '#7BC96F', 2.5);
          star(ctx, x - fx, y - fy, r * 1.0, 6, 0.6); ctx.fillStyle = COL.gold; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
          disc(ctx, x - fx, y - fy, r * 0.45, '#E5484D', 1.5);
          stick(ctx, ...P(r * 0.2, r * 0.85), ...P(r + 7, r * 0.85), 2, COL.gold); disc(ctx, ...P(r + 8, r * 0.85), 3, '#7CF3FF', 1.2);
          break;
        }
        case 'generalnolose': {
          const a = f + 0.7 - lg * 1.3, sx = cx + Math.cos(f + 1.2) * r * 0.5, sy = cy + Math.sin(f + 1.2) * r * 0.5;
          stick(ctx, sx, sy, sx + Math.cos(a) * 24, sy + Math.sin(a) * 24, 3.5, COL.gold);
          ctx.beginPath(); ctx.moveTo(cx + px * r * 0.5, cy + py * r * 0.5);
          ctx.quadraticCurveTo(cx - fx * r * 1.1 + px * r * 0.65, cy - fy * r * 1.1 + py * r * 0.65, cx - fx * r * 1.3, cy - fy * r * 1.3);
          ctx.quadraticCurveTo(cx - fx * r * 1.1 - px * r * 0.65, cy - fy * r * 1.1 - py * r * 0.65, cx - px * r * 0.5, cy - py * r * 0.5); ctx.closePath();
          ctx.fillStyle = tm.c; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
          disc(ctx, cx, cy, r * 0.58, '#E9C46A', 2.5); disc(ctx, cx, cy, r * 0.36, '#D4A63A', 2);
          ctx.beginPath(); ctx.arc(cx, cy, r * 0.4, f + 0.6, f + TAU - 0.6); ctx.lineWidth = 4; ctx.strokeStyle = '#3FA34D'; ctx.stroke();
          break;
        }
        case 'theplayer': {
          const k = u.holding ? 1 : clamp(lg, 0, 1);
          ell(ctx, x + 26, y + 60, r * 0.95, r * 0.6, f, 'rgba(0,0,0,0.25)', 0);
          ctx.save(); ctx.translate(x, y); ctx.rotate(f);
          roundRect(ctx, -r * 1.3, -r * 0.52, r * 0.5, r * 1.04, 8); ctx.fillStyle = tm.c; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
          const G = '#F4F6FB';
          ctx.beginPath(); for (let i = 0; i < 4; i++) { const yy = (i - 1.5) * r * 0.27, L = r * (0.95 - Math.abs(i - 1.5) * 0.12) * (1 - 0.55 * k); ctx.moveTo(r * 0.2, yy); ctx.lineTo(r * 0.2 + L, yy); }
          ctx.lineWidth = r * 0.25 + 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = r * 0.25; ctx.strokeStyle = G; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 0.55); ctx.lineTo(r * 0.3 - k * r * 0.15, -r * 0.95 + k * r * 0.35); ctx.lineWidth = r * 0.27 + 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = r * 0.27; ctx.strokeStyle = G; ctx.stroke();
          roundRect(ctx, -r * 0.88, -r * 0.62, r * 1.2, r * 1.24, r * 0.36); ctx.fillStyle = G; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
          ctx.beginPath(); for (let i = -1; i <= 1; i++) { ctx.moveTo(-r * 0.58, i * r * 0.26); ctx.lineTo(-r * 0.08, i * r * 0.26); } ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(4,6,11,0.35)'; ctx.stroke();
          ctx.restore();
          break;
        }
        case 'universe': {
          const a = f + 0.75 - lg * 1.3, [bx, by] = P(r * 0.3, r * 0.75); stick(ctx, bx, by, bx + Math.cos(a) * 18, by + Math.sin(a) * 18, 2.5, COL.steel);
          disc(ctx, x, y, r, tm.c, 3); disc(ctx, x - fx, y - fy, r * 0.62, '#14112B', 2);
          ctx.beginPath(); for (let k = 0; k < 4; k++) { const a2 = T * (0.6 + k * 0.2) + k * 1.7 + u.gait, d = r * 0.4 * (0.35 + 0.65 * ((k * 37) % 10) / 10), sx = x - fx + Math.cos(a2) * d, sy = y - fy + Math.sin(a2) * d; ctx.moveTo(sx + 1.3, sy); ctx.arc(sx, sy, 1.3, 0, TAU); }
          ctx.fillStyle = '#F4F6FB'; ctx.fill();
          break;
        }
        case 'livingfortress': {
          const awake = !u.asleep, mv = awake && Math.hypot(u.vx, u.vy) > 6, st = Math.sin(T * 6 + u.gait), S = r * 0.8;
          ctx.save(); ctx.translate(x, y); ctx.rotate(f);
          if (awake) {
            ctx.beginPath(); for (const sd of [-1, 1]) for (const lx of [-0.55, 0.55]) { const ex = r * lx + (mv ? st * r * 0.12 * sd * Math.sign(lx) : 0), ey = sd * r * 0.92; ctx.moveTo(ex + r * 0.2, ey); ctx.ellipse(ex, ey, r * 0.2, r * 0.15, 0, 0, TAU); }
            ctx.fillStyle = '#6B6F78'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
            for (const sd of [-1, 1]) { const e = r * (0.45 + 0.4 * lg); stick(ctx, r * 0.3, sd * r * 0.85, r * 0.3 + e, sd * r * 0.98, 9, '#8E8A80'); disc(ctx, r * 0.3 + e, sd * r * 0.98, 7, '#8E8A80', 2.5); }
          }
          roundRect(ctx, -S, -S, 2 * S, 2 * S, 4); ctx.fillStyle = '#B9B2A2'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
          ctx.beginPath(); for (let i = -2; i <= 2; i++) { const o = i * S * 0.32; ctx.rect(o - 4, -S - 3, 8, 6); ctx.rect(o - 4, S - 3, 8, 6); ctx.rect(-S - 3, o - 4, 6, 8); ctx.rect(S - 3, o - 4, 6, 8); }
          ctx.fillStyle = '#8E8A80'; ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
          roundRect(ctx, -S * 0.55, -S * 0.55, S * 1.1, S * 1.1, 3); ctx.fillStyle = '#9A9486'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
          ctx.beginPath(); for (const [ax, ay] of [[-S, -S], [S, -S], [-S, S], [S, S]]) { ctx.moveTo(ax + r * 0.3, ay); ctx.arc(ax, ay, r * 0.3, 0, TAU); }
          ctx.fillStyle = '#A8A293'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
          ctx.beginPath(); for (const [ax, ay] of [[-S, -S], [S, -S], [-S, S], [S, S]]) { ctx.moveTo(ax + r * 0.17, ay); ctx.arc(ax, ay, r * 0.17, 0, TAU); }
          ctx.fillStyle = tm.c; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
          if (awake) {
            // the gate is a mouth now, full of teeth, and the front towers have eyes
            const op = 0.45 + 0.55 * lg;
            ctx.beginPath(); ctx.ellipse(S, 0, r * 0.18 + r * 0.16 * op, r * 0.42, 0, Math.PI / 2, Math.PI * 1.5); ctx.closePath(); ctx.fillStyle = '#3B0A1E'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
            ctx.beginPath(); for (let k = 0; k < 4; k++) { const yy = (k - 1.5) * r * 0.2; ctx.moveTo(S, yy - 5); ctx.lineTo(S - 9, yy); ctx.lineTo(S, yy + 5); ctx.closePath(); } ctx.fillStyle = '#F4F1E6'; ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
            ctx.beginPath(); for (const sd of [-1, 1]) { ctx.moveTo(S + 6, sd * S); ctx.arc(S, sd * S, 6, 0, TAU); } ctx.fillStyle = '#FF6B3D'; ctx.fill();
          } else { roundRect(ctx, S - 7, -r * 0.24, 11, r * 0.48, 2); ctx.fillStyle = '#5B3A22'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); }
          ctx.save(); ctx.transform(1, Math.sin(T * 5 + u.gait) * 0.12, 0, 1, 0, 0); roundRect(ctx, 0, -7, 22, 13, 2); ctx.fillStyle = tm.c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
          disc(ctx, 0, 0, 3, COL.gold, 1.5);
          ctx.restore();
          break;
        }
        default: disc(ctx, x, y, r, tm.c, 3);
      }
    },
    // statuses from the second batch: charmed, turned to stone, hollow copies, ghosts, transformed commanders
    drawStatus2(ctx, u, x, y, tm) {
      const T = this.fightT, t = this.t, r = u.r;
      if (u.charmT > T) { const hx = x, hy = y - r - 11 - 2 * Math.sin(t * 6); ctx.beginPath(); ctx.arc(hx - 3, hy, 3.6, 0, TAU); ctx.arc(hx + 3, hy, 3.6, 0, TAU); ctx.moveTo(hx - 6.5, hy + 1); ctx.lineTo(hx, hy + 8); ctx.lineTo(hx + 6.5, hy + 1); ctx.fillStyle = '#F472B6'; ctx.fill(); }
      if (u.stoneT > T) { ctx.beginPath(); ctx.arc(x, y, r + 3, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(210,214,220,0.85)'; ctx.stroke(); }
      if (u.hollow) { ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.arc(x, y, r + 3, -t * 2, -t * 2 + TAU); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(124,243,255,0.85)'; ctx.stroke(); ctx.setLineDash([]); }
      if (u.ghost) disc(ctx, x, y, r + 5, 'rgba(226,232,240,0.16)', 0);
      if (u.transformed) { ctx.beginPath(); ctx.arc(x, y, r + 5 + 2 * Math.sin(t * 8), 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(229,72,77,0.7)'; ctx.stroke(); }
    },
    // under the troops: the Worldroot's roots, lightning about to strike, the rising tide
    drawField2(ctx) {
      const T = this.fightT, t = this.t;
      if (this.rootUnits) for (const u of this.rootUnits) {
        if (u.dead || !u.rootR) continue;
        const R = u.rootR;
        disc(ctx, u.x, u.y, R, 'rgba(62,154,74,0.10)', 0);
        // twelve roots, each a wiggly line of three bends
        ctx.beginPath();
        for (let k = 0; k < 12; k++) {
          const a = k / 12 * TAU + u.gait, sg = k % 2 ? 1 : -1;
          let qx = u.x + Math.cos(a) * u.r, qy = u.y + Math.sin(a) * u.r; ctx.moveTo(qx, qy);
          for (let sgm = 1; sgm <= 3; sgm++) {
            const d = u.r + (R - u.r) * sgm / 3 * 0.97, aa = a + sg * 0.1 * sgm, ex = u.x + Math.cos(aa) * d, ey = u.y + Math.sin(aa) * d, w = (sgm % 2 ? 1 : -1) * sg * (R * 0.07 + 6);
            ctx.quadraticCurveTo((qx + ex) / 2 - Math.sin(aa) * w, (qy + ey) / 2 + Math.cos(aa) * w, ex, ey); qx = ex; qy = ey;
          }
        }
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(40,28,18,0.6)'; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#7A5A40'; ctx.stroke();
      }
      for (const c of this.calls) {
        if (c.kind !== 'lightning') continue;
        const k = clamp((T - c.t0) / Math.max(0.01, c.at - c.t0), 0, 1);
        disc(ctx, c.x, c.y, c.r * 0.7 * k, 'rgba(15,23,42,0.2)', 0);
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r * (0.4 + 0.6 * k), 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(160,220,255,${0.3 + 0.6 * k})`; ctx.stroke();
      }
      if (this.moon && this.moon.tide > 1) {
        const w = this.moon.tide;
        for (const [x0, sg] of [[AR.x, 1], [AR.x + AR.w, -1]]) {
          ctx.fillStyle = 'rgba(56,120,200,0.38)'; ctx.fillRect(sg > 0 ? x0 : x0 - w, AR.y, w, AR.h);
          ctx.beginPath(); for (let k = 0; k <= 24; k++) { const yy = AR.y + AR.h * k / 24, xx = x0 + sg * (w + Math.sin(k * 1.3 + t * 2.5) * 7); if (k) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }
          ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(219,234,254,0.8)'; ctx.stroke();
        }
      }
    },
    // over the troops: darkness, the moon, the blood moon, the storm, rewinds, the bell, galaxies, the sirens' song
    drawOver2(ctx) {
      const T = this.fightT, t = this.t;
      if (this.weather === 'bloodmoon') { ctx.fillStyle = 'rgba(120,10,20,0.2)'; ctx.fillRect(AR.x, AR.y, AR.w, AR.h); }
      if (this.permaStorm) {
        ctx.fillStyle = 'rgba(15,23,42,0.2)'; ctx.fillRect(AR.x, AR.y, AR.w, AR.h);
        ctx.beginPath(); for (let i = 0; i < 60; i++) { const x = AR.x + ((i * 97.3 + t * 160) % AR.w), y = AR.y + ((i * 53.1 + t * 950) % AR.h); ctx.moveTo(x, y); ctx.lineTo(x - 7, y - 24); }
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(190,215,255,0.4)'; ctx.stroke();
      }
      if (this.dark && this.dark.k > 0.02) { ctx.fillStyle = `rgba(4,3,12,${0.45 * this.dark.k})`; ctx.fillRect(AR.x, AR.y, AR.w, AR.h); }
      if (this.moon && this.moon.k > 0.02) {
        const k = this.moon.k, R = 40 + 120 * k, mx = AR.x + AR.w / 2, my = AR.y + 60 + 40 * k;
        ctx.fillStyle = `rgba(150,170,230,${0.1 * k})`; ctx.fillRect(AR.x, AR.y, AR.w, AR.h);
        disc(ctx, mx, my, R * 1.35, `rgba(244,241,230,${0.08 * k})`, 0); disc(ctx, mx, my, R, `rgba(244,241,230,${0.32 * k})`, 0);
        ctx.beginPath(); for (const [ox, oy, rr] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.24], [-0.05, 0.4, 0.12]]) { ctx.moveTo(mx + ox * R + rr * R, my + oy * R); ctx.arc(mx + ox * R, my + oy * R, rr * R, 0, TAU); }
        ctx.fillStyle = `rgba(190,185,170,${0.25 * k})`; ctx.fill();
      }
      if (this.weather === 'bloodmoon') { const mx = AR.x + AR.w - 110, my = AR.y + 90; disc(ctx, mx, my, 70, 'rgba(229,72,77,0.15)', 0); disc(ctx, mx, my, 46, 'rgba(200,40,50,0.55)', 0); }
      if (this.bellFx && T - this.bellFx.t0 < 1.1) {
        const b = this.bellFx, p = (T - b.t0) / 1.1;
        ctx.beginPath(); for (let i = 0; i < 3; i++) { const rr = 50 + p * 240 - i * 50; if (rr > 4) { ctx.moveTo(b.x + rr, b.y); ctx.arc(b.x, b.y, rr, 0, TAU); } }
        ctx.lineWidth = 4; ctx.strokeStyle = `rgba(255,214,102,${0.7 * (1 - p)})`; ctx.stroke();
      }
      if (this.rewindFx && T - this.rewindFx.t0 < 0.9) {
        const b = this.rewindFx, p = (T - b.t0) / 0.9, R = 60 + p * 300;
        ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, TAU); ctx.lineWidth = 6; ctx.strokeStyle = `rgba(253,230,138,${0.6 * (1 - p)})`; ctx.stroke();
        ctx.beginPath(); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + p * 6; ctx.moveTo(b.x + Math.cos(a) * (R - 12), b.y + Math.sin(a) * (R - 12)); ctx.lineTo(b.x + Math.cos(a) * R, b.y + Math.sin(a) * R); } ctx.lineWidth = 3; ctx.stroke();
      }
      if (this.rewindAll && T - this.rewindAll.t0 < 1.4) {
        const k = 1 - (T - this.rewindAll.t0) / 1.4, cx = AR.x + AR.w / 2, cy = AR.y + AR.h / 2;
        ctx.fillStyle = `rgba(253,230,138,${0.3 * k})`; ctx.fillRect(AR.x, AR.y, AR.w, AR.h);
        ctx.fillStyle = `rgba(4,6,11,${0.18 * k})`; for (let i = 0; i < 14; i++) ctx.fillRect(AR.x, AR.y + ((i * 83 + t * 900) % AR.h), AR.w, 5);
        ctx.globalAlpha = k; ctx.beginPath(); for (const o of [0, 70]) { ctx.moveTo(cx + 40 - o, cy - 50); ctx.lineTo(cx - 30 - o, cy); ctx.lineTo(cx + 40 - o, cy + 50); ctx.closePath(); }
        ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = COL.ink; ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (this.sandFx && T - this.sandFx.t0 < 1.2) {
        const b = this.sandFx, p = (T - b.t0) / 1.2;
        ctx.beginPath(); for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + p * 5, d = 60 + p * 160, sx = b.x + Math.cos(a) * d, sy = b.y + Math.sin(a) * d; ctx.moveTo(sx + 3.5, sy); ctx.arc(sx, sy, 3.5, 0, TAU); }
        ctx.fillStyle = `rgba(233,196,106,${0.8 * (1 - p)})`; ctx.fill();
      }
      for (const g of this.galaxies || []) {
        const p = (T - g.t0) / 2.4; if (p < 0 || p > 1) continue;
        const R = 70 * Math.sin(Math.PI * Math.min(1, p * 1.2)), rot = t * 3;
        disc(ctx, g.x, g.y, R * 1.1, `rgba(76,29,149,${0.35 * (1 - p)})`, 0);
        ctx.beginPath(); for (let arm = 0; arm < 3; arm++) for (let s = 0; s <= 16; s++) { const a = arm * TAU / 3 + s * 0.32 + rot, d = s / 16 * R, sx = g.x + Math.cos(a) * d, sy = g.y + Math.sin(a) * d; if (s) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); }
        ctx.lineWidth = 4; ctx.strokeStyle = `rgba(244,114,182,${0.8 * (1 - p)})`; ctx.stroke();
        disc(ctx, g.x, g.y, 8 * (1 - p) + 2, '#FFFFFF', 0);
      }
      if (this.notes) for (const n of this.notes) {
        const p = (T - n.t0) / 1.2;
        for (let k = 0; k < 3; k++) { const nx = n.x + Math.cos(k * 2.1 + p * 3) * (20 + p * 60), ny = n.y - 16 - p * 50 + Math.sin(k * 2.1 + p * 3) * 14; ctx.globalAlpha = 1 - p; disc(ctx, nx, ny, 4, '#F9A8D4', 1.5); stick(ctx, nx + 3.5, ny, nx + 3.5, ny - 12, 1.2, '#F9A8D4'); }
        ctx.globalAlpha = 1;
      }
    },
    // icons on the new supply crates
    crateIcon2(ctx, kind, x, y, b) {
      const I = CRATE[kind].icon;
      ctx.fillStyle = I; ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.5;
      if (kind === 'freeze') { ctx.beginPath(); for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; ctx.moveTo(x + Math.cos(a) * b * 0.75, y + Math.sin(a) * b * 0.75); ctx.lineTo(x - Math.cos(a) * b * 0.75, y - Math.sin(a) * b * 0.75); } ctx.lineWidth = 3; ctx.strokeStyle = I; ctx.stroke(); }
      else if (kind === 'portal') { ctx.beginPath(); ctx.ellipse(x, y, b * 0.42, b * 0.68, 0, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = I; ctx.stroke(); }
      else if (kind === 'phoenix') { ctx.beginPath(); ctx.moveTo(x, y - b * 0.8); ctx.quadraticCurveTo(x + b * 0.75, y - b * 0.1, x + b * 0.45, y + b * 0.65); ctx.lineTo(x - b * 0.45, y + b * 0.65); ctx.quadraticCurveTo(x - b * 0.75, y - b * 0.1, x, y - b * 0.8); ctx.fill(); ctx.stroke(); }
      else if (kind === 'chain') { ctx.beginPath(); ctx.moveTo(x + b * 0.2, y - b * 0.85); ctx.lineTo(x - b * 0.5, y + b * 0.1); ctx.lineTo(x - b * 0.02, y + b * 0.1); ctx.lineTo(x - b * 0.25, y + b * 0.85); ctx.lineTo(x + b * 0.5, y - b * 0.15); ctx.lineTo(x + b * 0.02, y - b * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else if (kind === 'dice') { ctx.beginPath(); for (const [a, c] of [[-0.4, -0.4], [0.4, 0.4], [0, 0], [0.4, -0.4], [-0.4, 0.4]]) { ctx.moveTo(x + a * b + b * 0.14, y + c * b); ctx.arc(x + a * b, y + c * b, b * 0.14, 0, TAU); } ctx.fill(); }
      else if (kind === 'crystal') { ctx.beginPath(); ctx.moveTo(x, y - b * 0.8); ctx.lineTo(x + b * 0.5, y); ctx.lineTo(x, y + b * 0.8); ctx.lineTo(x - b * 0.5, y); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else if (kind === 'singularity') { disc(ctx, x, y, b * 0.4, '#05060A', 1.5); ctx.beginPath(); ctx.arc(x, y, b * 0.66, 0.4, 4.6); ctx.lineWidth = 2.5; ctx.strokeStyle = I; ctx.stroke(); }
      else if (kind === 'crown') { ctx.beginPath(); ctx.moveTo(x - b * 0.7, y + b * 0.45); ctx.lineTo(x - b * 0.7, y - b * 0.4); ctx.lineTo(x - b * 0.32, y); ctx.lineTo(x, y - b * 0.6); ctx.lineTo(x + b * 0.32, y); ctx.lineTo(x + b * 0.7, y - b * 0.4); ctx.lineTo(x + b * 0.7, y + b * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else if (kind === 'clone') { disc(ctx, x - b * 0.25, y, b * 0.42, I, 1.5); disc(ctx, x + b * 0.25, y, b * 0.42, I, 1.5); }
      else if (kind === 'ghosts') { ctx.beginPath(); ctx.arc(x, y - b * 0.1, b * 0.5, Math.PI, 0); ctx.lineTo(x + b * 0.5, y + b * 0.6); ctx.lineTo(x + b * 0.17, y + b * 0.4); ctx.lineTo(x - b * 0.17, y + b * 0.6); ctx.lineTo(x - b * 0.5, y + b * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = COL.ink; ctx.beginPath(); for (const sd of [-1, 1]) { ctx.moveTo(x + sd * b * 0.18 + b * 0.09, y - b * 0.1); ctx.arc(x + sd * b * 0.18, y - b * 0.1, b * 0.09, 0, TAU); } ctx.fill(); }
    },
  };
  // =====================================================================
  // Intelligent combat (rules.combat): fighting styles with visible moves, weapons for the basic troops, roster cards,
  // army skins, and battle modes (protect the king, champion duel, last stand). Everything here is off unless
  // opts.combat / opts.skins / opts.mode are set, so older battles play out exactly as before.
  // =====================================================================
  UNIT.king = { r: 15, hp: 30, dmg: 1.4, cd: 0.9, range: 230, speed: 58, cost: 4, healer: true, heal: 0, healRange: 0, rank: 1, armor: 0.6, commander: 1, king: true };
  UNIT.king.ext = true; ROSTER.king = 1; LIVING.king = 1; HPBAR.king = 1; UNIT_LABEL.king = 'KING'; UNIT_ERA.king = 'medieval';
  // each melee troop's fighting style: blades parry and riposte, shields block and bash, axes and clubs cleave,
  // spears thrust through, maces and hammers stun, agile fighters dodge
  const STYLE = { swordsman: 'blade', samurai: 'blade', duelist: 'blade', pirate: 'blade', mirrorknight: 'blade', deathknight: 'blade', general: 'blade', generalnolose: 'blade',
    hollow: 'blade', universe: 'blade', vampire: 'agile', shieldbearer: 'shield', berserker: 'cleave', orc: 'cleave', troll: 'cleave', ogre: 'cleave', dwarf: 'cleave',
    bonecolossus: 'cleave', timeexec: 'cleave', giant: 'cleave', spearman: 'thrust', pikeman: 'thrust', lancer: 'thrust', boarrider: 'thrust', peasant: 'thrust', royalguard: 'thrust',
    knight: 'crush', soulsmith: 'crush', golem: 'crush', hourglass: 'crush', ninja: 'agile', assassin: 'agile', falsesoldier: 'blade', mirrorking: 'blade' };
  // troops without a weapon of their own get one (soldiers get a different one each, so one army has visibly different fighters)
  const GEAR_POOL = { soldier: ['blade', 'shield', 'cleave', 'thrust', 'crush'], skeleton: ['blade', 'thrust', 'blade'], knight: ['crush'], giant: ['cleave'], king: ['blade'] };
  const AGILE = { ninja: 1, duelist: 1, assassin: 1, vampire: 1 };
  // what each troop is good at, in two or three words (roster cards and close-up tags)
  const SPEC = {
    soldier: 'MIXED WEAPONS', archer: 'ARROWS', crossbowman: 'ARMOUR-PIERCING', swordsman: 'PARRIES', spearman: 'LONG REACH', shieldbearer: 'BLOCKS', berserker: 'CLEAVES',
    healer: 'HEALS', knight: 'STUNS', giant: 'STOMPS', rifleman: 'RIFLE', gunner: 'MACHINE GUN', sniper: 'SNIPES', grenadier: 'GRENADES', tank: 'SHELLS', wizard: 'FIREBALLS',
    dragon: 'FIRE BREATH', orc: 'CLEAVES', skeleton: 'ARROW-PROOF', elf: 'LONG RANGE', trooper: 'LASERS', robot: 'BULLET-PROOF', mech: 'ROCKETS', pirate: 'PARRIES',
    musketeer: 'MUSKET', cannon: 'CANNONBALLS', zombie: 'INFECTS', vampire: 'DRAINS LIFE', ninja: 'DODGES', samurai: 'PARRIES', pikeman: 'ANTI-CAVALRY', duelist: 'PARRY & DODGE',
    royalguard: 'HALBERD', lancer: 'CHARGES', horsearcher: 'HIT & RUN', longbow: 'LONGEST RANGE', firearcher: 'FIRE ARROWS', poisoner: 'POISON', bannerman: 'ARMY SHIELD',
    drummer: 'WAR DRUMS', general: 'COMMANDS', peasant: 'EVOLVES', elephant: 'TRAMPLES', necromancer: 'RAISES DEAD', bonecolossus: 'CLEAVES', deathknight: 'HUNTS BIG ONES',
    wolfrider: 'HUNTS ARCHERS', boarrider: 'KNOCKBACK', troll: 'REGENERATES', cyclops: 'THROWS ROCKS', druid: 'HEALS', treant: 'ROOTS', illusionist: 'DECOYS', imp: 'FIRE BOLTS',
    demon: 'GROWS ANGRIER', hellhound: 'BURNING BITE', warlock: 'POSSESSES', dwarf: 'CLEAVES', engineer: 'BUILDS TURRETS', turret: 'AUTO-FIRE', golem: 'UNSTOPPABLE',
    hydra: 'MANY HEADS', titan: 'SMASHES WALLS', phoenix: 'REBORN', fortress: 'GARRISON', griffin: 'DIVES', mirrorknight: 'COPIES', phasereaper: 'TELEPORTS',
    alchemist: 'POISON CLOUDS', gravitymonk: 'PULLS', soulsmith: 'FORGES', falsesoldier: 'TRAP', turtle: 'SHELL WALL', thousandman: 'ABSORBS', copycat: 'COPIES',
    immortal: 'REVIVES', mirrorking: 'MIRRORS', unmaker: 'SHEEPIFIES', billionaire: 'BRIBES', gravitytyrant: 'GRAVITY WELL', meteorshepherd: 'METEORS', glitch: 'GLITCHES',
    frostwitch: 'FREEZES', lich: 'DRAINS LIFE', stormcaller: 'LIGHTNING', wisp: 'HEALS ON DEATH', gargoyle: 'TURNS TO STONE', assassin: 'INVISIBLE', siegegunner: 'MORTAR',
    catapult: 'BOULDERS', mammoth: 'TRAMPLES', rhino: 'CHARGES', ogre: 'EATS ALLIES', drone: 'EXPLODES', helicopter: 'ROCKETS', siren: 'CHARMS', hollow: 'TAKES GEAR',
    livingblade: 'ALIVE', stareater: 'BLACK HOLE', timeexec: 'REWINDS', cathedral: 'RAISES DEAD', stormemperor: 'STORM', worldroot: 'ROOTS', hourglass: 'AGES FOES',
    mooncaller: 'PULLS MOON', unqualifiedking: 'MAKES DEFECTORS', generalnolose: 'REWINDS BATTLE', theplayer: 'GRABS & THROWS', universe: 'HIDDEN ARMY', livingfortress: 'SWALLOWS',
    king: 'PROTECT HIM', decoy: 'FAKE',
  };
  const STYLE_SPEC = { blade: 'PARRIES', shield: 'BLOCKS', cleave: 'CLEAVES', thrust: 'PIERCES', crush: 'STUNS', agile: 'DODGES' };
  const specOf = type => SPEC[type] || (UNIT[type] && UNIT[type].ranged ? 'SHOOTS' : STYLE_SPEC[STYLE[type]] || 'FIGHTS');
  // army skins: looks only (an aura under each troop and a ring over it)
  const SKINS = {
    royal: { name: 'ROYAL', ring: '#FFD23F', w: 2.5 },
    neon: { name: 'NEON', glow: 'light', ring: 'light', w: 3, glowA: 0.22 },
    shadow: { name: 'SHADOW', glow: '#140A23', glowA: 0.6, ring: '#A855F7', w: 2 },
    frost: { name: 'FROST', glow: '#BAE6FD', glowA: 0.24, ring: '#E0F2FE', w: 2, fx: '#E0F2FE' },
    lava: { name: 'LAVA', glow: '#FF6E1E', glowA: 0.24, ring: '#FF8A1F', w: 2.5, fx: '#FFB020' },
    ghost: { name: 'GHOST', glow: '#7CF3FF', glowA: 0.14, ring: '#A5F3FC', w: 2, dash: true },
    toxic: { name: 'TOXIC', glow: '#7CFF6B', glowA: 0.18, ring: '#A3FF8F', w: 2.5, fx: '#7CFF6B' },
    gold: { name: 'GOLDEN', glow: '#FFD23F', glowA: 0.16, ring: '#FFE27A', w: 3 },
  };
  const MODE_HOOK = { king: 'PROTECT THE KING!', duel: 'CHAMPION DUEL!', heroes: 'LAST STAND!', mirror: 'MIRROR MATCH!', hill: 'KING OF THE HILL!' };

  const ARMY_COMBAT = {
    initCombat() {
      const c = this.opts.combat || {};
      this.cmb = c.moves || c.roster || c.fewerBullets ? c : null;
      this.CR = rng(((this.seed >>> 0) ^ 0xC0B4A7) >>> 0);
      this.smart = !!c.smart; // smarter fighting (rules.combat.smart): spread out over targets, hold a front, flank, fall back when badly hurt
      this.skins = this.opts.skins && this.opts.skins.some(Boolean) ? this.opts.skins.map(k => (k && SKINS[k] ? k : null)) : null;
      this.mode = this.opts.mode && MODE_HOOK[this.opts.mode] ? this.opts.mode : null;
      this.heroTeam = this.mode === 'heroes' ? (this.opts.heroes || 0) : -1;
      this.sparks = []; this.routed = [];
      if (this.cmb || this.skins || this.mode) this.ext = true;
    },
    // the weapon and style each troop fights with (its own dice, so turning this on changes nothing else)
    combatUnit(u, U) {
      // tougher troops (rules.combat.hp), so each fight lasts long enough to see the moves
      if (this.cmb && this.cmb.hp && this.cmb.hp !== 1) { u.max *= this.cmb.hp; u.hp = u.max; }
      if (this.cmb && this.cmb.moves) {
        const pool = GEAR_POOL[u.type];
        if (pool) { u.gear = pool.length > 1 ? this.CR.pick(pool) : pool[0]; u.cst = u.gear; } else u.cst = STYLE[u.type];
      }
      if (this.heroTeam === u.team && !U.uncounted) {
        // last stand: a few heroes, each about as strong as a small squad
        u.hero = true; u.max *= 2.2; u.hp = u.max; u.dmgK = (u.dmgK || 1) * 1.6; u.r = Math.round(u.r * 1.2); u.m = u.r * u.r * (U.immovable ? 400 : 1);
      }
    },
    // the attacker's riposte and the defender's parry, dodge or block (called for every plain melee hit)
    combatHit(u, U, t, hit) {
      const T = this.fightT, Tt = UNIT[t.type], C = this.CR;
      if (u.riposte) { u.riposte = false; hit *= 1.5; this.callout(u, 'RIPOSTE', COL.gold); }
      if (Tt.rank === 0 || U.rank === 0 || t.stunT > T || t.frozeT > T || t.sheepT > T || !(hit > 0)) return hit;
      const st = t.cst, ang = Math.atan2(u.y - t.y, u.x - t.x), front = Math.cos(ang - t.face) > 0.35;
      if ((st === 'agile' || AGILE[t.type]) && T >= (t.dodgeAt || 0) && C.chance(0.22)) {
        t.dodgeAt = T + 1; t.dodgeFx = 1; t.dodgeSide = C.chance(0.5) ? 1 : -1;
        const px = -Math.sin(ang) * t.dodgeSide, py = Math.cos(ang) * t.dodgeSide; t.x += px * 9; t.y += py * 9;
        this.callout(t, 'DODGE', '#A7F3D0');
        return 0;
      }
      if (st === 'blade' && front && T >= (t.parryAt || 0) && C.chance(0.22)) {
        t.parryAt = T + 1.4; t.riposte = true; t.cd = Math.min(t.cd, 0.08);
        this.clash(t, u, '#FFFFFF'); this.callout(t, 'PARRY', '#F4F6FB');
        return 0;
      }
      if (st === 'shield' && front && C.chance(0.3)) {
        this.clash(t, u, '#93C5FD'); this.callout(t, 'BLOCK', '#93C5FD');
        return hit * 0.2;
      }
      return hit;
    },
    // the sound of a melee hit: each weapon style has its own (off unless rules.sound.weapons is on, so old videos sound the same)
    hitSfx(u, t) {
      if (UNIT[t.type].block) return 'thunk';
      if (!this.opts.weaponSfx) return 'clash';
      return { blade: 'clash', shield: 'bonk', cleave: 'chop', thrust: 'stab', crush: 'crush', agile: 'shing' }[u.cst] || 'clash';
    },
    // after a melee hit lands: cleaves, thrusts that go through, stuns and shield bashes, and the swing's trail
    combatFx(u, U, t) {
      const T = this.fightT, st = u.cst, C = this.CR, Tt = UNIT[t.type];
      const a = Math.atan2(t.y - u.y, t.x - u.x);
      u.hits = (u.hits || 0) + 1;
      if (st === 'cleave' && u.hits % 3 === 0 && !U.splash) {
        let n = 0;
        for (const o of this.near(u.x, u.y, u.r + (U.reach || 5) + 26)) {
          if (o === t || o.team === u.team || o.flying || o.phased || o.cloak) continue;
          this._kind = 'blade'; this.damage(o, U.dmg * 0.7 * this.dmgMul, u); this.knock(o, u.x, u.y, 12); n++;
        }
        u.slash = { t0: this.t, kind: 'cleave', a, side: 1 };
        if (n) this.callout(u, 'CLEAVE', '#FCA5A5');
        return;
      }
      if (st === 'thrust') {
        // the point goes through into whoever stands right behind
        const dx = Math.cos(a), dy = Math.sin(a);
        let best = null, bd = 1e9;
        for (const o of this.near(t.x + dx * 30, t.y + dy * 30, 34)) {
          if (o === t || o.team === u.team || o.flying || o.phased || o.cloak) continue;
          const along = (o.x - t.x) * dx + (o.y - t.y) * dy; if (along < 4) continue;
          if (along < bd) { bd = along; best = o; }
        }
        if (best) { this._kind = 'blade'; this.damage(best, U.dmg * 0.6 * this.dmgMul, u); this.callout(u, 'PIERCE', '#FDE68A'); }
        u.slash = { t0: this.t, kind: 'thrust', a, side: 1 };
        return;
      }
      if (st === 'crush' && Tt.rank !== 0 && !t.dead && C.chance(0.18)) { t.stunT = T + 0.6; this.callout(t, 'STUNNED', '#FDE047'); }
      if (st === 'shield' && u.hits % 3 === 0 && !t.dead) { this.knock(t, u.x, u.y, 30); if (Tt.rank !== 0) t.stunT = T + 0.45; this.callout(u, 'BASH', '#93C5FD'); }
      u.slashSide = -(u.slashSide || 1);
      if (!U.sword) u.slash = { t0: this.t, kind: st || 'hit', a, side: u.slashSide };
    },
    // a metal-on-metal flash between two fighters
    clash(a, b, col) {
      const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      this.sparks.push({ x, y, t0: this.t, col }); if (this.sparks.length > 30) this.sparks.shift();
      this.burst(x, y, '#FFE27A', 5, 220, 0.25, 4); this.snd('clang', { pan: (x - AR.x) / AR.w * 1.4 - 0.7 });
    },
    // a short label over a fighter for a special move; at most about four a second so the screen stays readable
    callout(u, text, col) {
      const T = this.fightT;
      if (!this.cmb || T < (u.coAt || 0)) return;
      if (this.ui2 && this.story && this.t < 4.3) return; // UI 2.0: quiet while the opening story card is up
      if (T >= (this.coWin || 0)) { this.coWin = T + 1; this.coN = 0; }
      if (this.coN >= (this.opts.ui >= 2 ? 2 : 3) || T < ((this.coTxt || (this.coTxt = {}))[text] || 0)) return;
      this.coN++; u.coAt = T + 1.5; this.coTxt[text] = T + 0.7;
      this.float(u.x, u.y - u.r - 10, text, col, 22, 0.7);
    },
    // ----- battle modes -----
    initModes() {
      const T = this.fightT, cx = AR.x + AR.w / 2;
      if (this.mode) this.hook = MODE_HOOK[this.mode];
      if (this.mode === 'king') {
        // each army's king waits at the back behind a royal shield (takes a quarter of the damage) for the first 40% of the battle;
        // if he falls, his army loses heart for the rest of the battle
        this.kingSafe = 0.4 * (this.fixed || this.target);
        this.kings = [];
        for (const t of this.teamIds()) {
          const y = this.N === 2 ? (t === 0 ? AR.y + 34 : AR.y + AR.h - 34) : AR.y + AR.h / 2 + Math.sin(this.homeAngle(t)) * 420;
          const x = this.N === 2 ? cx : cx + Math.cos(this.homeAngle(t)) * 420;
          const k = this.addUnit(t, 'king', x, y); k.face = t === 0 ? Math.PI / 2 : -Math.PI / 2; this.kings[t] = k; this.start[t]++;
        }
        this.bannerQ.push({ at: 1.3, text: 'KILL THE KING TO WIN!', col: COL.gold });
      }
      if (this.mode === 'duel' && this.N === 2) {
        // each army's best fighter steps forward and they duel in the middle while both armies watch
        const champ = team => {
          let best = null, bv = -1;
          for (const u of this.units) {
            if (u.team !== team) continue;
            const U = UNIT[u.type]; if (U.rank === 0 || U.uncounted || U.healer || U.decoy || U.king) continue;
            const v = U.cost + (U.ranged ? 0 : 5) - Math.abs(u.x - cx) * 0.002;
            if (v > bv) { bv = v; best = u; }
          }
          return best;
        };
        const a = champ(0), b = champ(1);
        if (a && b) {
          const mid = AR.y + AR.h / 2;
          for (const [u, y] of [[a, mid - 60], [b, mid + 60]]) { u.x = cx; u.y = y; u.px = u.x; u.py = u.y; u.max *= 3; u.hp = u.max; u.r += 2; u.m = u.r * u.r; u.duelist = true; u.title = 'CHAMPION'; }
          a.face = Math.PI / 2; b.face = -Math.PI / 2;
          // duel damage is scaled so the stronger champion would win in about nine seconds of fighting (no endless stand-offs)
          const ttk = (x, o) => o.max / Math.max(0.05, UNIT[x.type].dmg * (x.dmgK || 1) * (UNIT[o.type].armor ?? 1) / Math.max(0.2, UNIT[x.type].cd || 1));
          this.duel = { a, b, end: 14, k: clamp(Math.min(ttk(a, b), ttk(b, a)) / 9, 1, 25) };
          this.bannerQ.push({ at: 1.2, text: `${labelOf(a.type)} VS ${labelOf(b.type)}`, col: COL.gold });
        }
      }
      if (this.heroTeam >= 0) this.bannerQ.push({ at: 1.3, text: `${this.start[this.heroTeam]} HEROES MAKE A STAND`, col: TEAMS[this.heroTeam].c });
      if (this.mode === 'hill' && this.N === 2) {
        // a hill in the middle: the army with more troops on it slowly takes it, and hits 25% harder while it holds it
        this.hill = { x: cx, y: AR.y + AR.h / 2, r: 150, c: 0, team: -1, buff: 1.25, n: [0, 0], k: 0, caps: 0 };
        this.bannerQ.push({ at: 1.3, text: 'HOLD THE HILL: +25% POWER', col: COL.gold });
      }
      this.bannerQ.forEach((b, i) => { b.at = Math.max(b.at, 1.2 + i * 1.7); });
    },
    // statuses from intelligent combat and the modes: stunned, holding for the duel
    preUnit3(u, U, h) {
      const T = this.fightT;
      if (u.stunT > T) { u.vx = 0; u.vy = 0; return true; }
      const d = this.duel;
      if (d && !d.done) {
        if (u === d.a || u === d.b) { const o = u === d.a ? d.b : d.a; if (!o.dead) { u.target = o; u.retarget = 1; } return false; }
        // everyone else holds the line and watches
        const mid = AR.y + AR.h / 2;
        u.vx *= 0.8; u.vy *= 0.8; this.turn(u, Math.atan2(mid - u.y, AR.x + AR.w / 2 - u.x), h);
        return true;
      }
      return false;
    },
    postStep3(h) {
      const T = this.fightT, d = this.duel, H = this.hill;
      if (this.kingSafe && !this.shieldDown && T >= this.kingSafe) {
        this.shieldDown = true; this.banner('THE ROYAL SHIELDS ARE DOWN!', COL.gold, 1.8); this.snd('alarm');
        const k = this.kings.find(x => x && !x.dead);
        if (k && this.camEv) this.camEv.push({ type: 'spot', follow: k, prio: 75, dur: 1.5, z: 1.9 });
      }
      if (H && this.phase === 'fight' && ++H.k % 6 === 0) {
        // who is on the hill (checked every 6 ticks, 20 times a second)
        H.n[0] = 0; H.n[1] = 0;
        for (const o of this.near(H.x, H.y, H.r)) if (o.team < 2 && !UNIT[o.type].uncounted) H.n[o.team]++;
        const dir = H.n[0] > H.n[1] ? 1 : H.n[1] > H.n[0] ? -1 : 0;
        H.c = clamp(H.c + dir * h * 6 / 3, -1, 1);
        if (H.team >= 0 && (H.team === 0 ? H.c <= 0 : H.c >= 0)) { H.team = -1; this.snd('alarm'); }
        const took = H.c >= 1 ? 0 : H.c <= -1 ? 1 : -1;
        if (took >= 0 && H.team !== took) {
          H.team = took; H.caps++; this.xf.hill = H.caps; this.xf.hillTeam = took;
          this.banner(`${TEAMS[took].name} TAKES THE HILL!`, TEAMS[took].c, 1.6); this.snd('bell');
          if (this.camEv) this.camEv.push({ type: 'spot', x: H.x, y: H.y, prio: 70, dur: 1.4, z: 1.7 });
        }
      }
      if (d && !d.cam && this.camEv) { d.cam = true; this.camEv.push({ type: 'spot', follow: d.a, x: AR.x + AR.w / 2, y: AR.y + AR.h / 2, prio: 92, dur: 4.5, z: 2.1 }); }
      if (d && !d.done && (d.a.dead || d.b.dead || T > d.end)) {
        d.done = true;
        const w = d.a.dead && !d.b.dead ? d.b : d.b.dead && !d.a.dead ? d.a : null;
        if (w) { this.banner(`${TEAMS[w.team].name} CHAMPION WINS THE DUEL!`, TEAMS[w.team].c, 1.8); this.xf.duel = labelOf(w.type); this.xf.duelTeam = w.team; if (this.camEv) this.camEv.push({ type: 'spot', follow: w, prio: 85, dur: 1.8, z: 2.2, slow: true }); }
        else this.banner('NO WINNER: CHARGE!', COL.gold, 1.6);
        for (const u of this.units) { u.retarget = 0; if (u.duelist && !u.dead) u.duelist = false; }
        this.snd('alarm');
      }
      if (this.sparks.length) this.sparks = this.sparks.filter(s => this.t - s.t0 < 0.3);
    },
    onDeath3(u, from) {
      const U = UNIT[u.type];
      if (U.king && this.mode === 'king' && u.team < 3 && !this.routed[u.team]) this.kingFall(u.team, from);
    },
    // a fallen king: his army loses heart for the rest of the battle (weaker, slower, a "!" over every troop)
    kingFall(team, from) {
      const T = this.fightT;
      this.routed[team] = true; this.panic[team] = 1e9;
      this.banner(`THE ${TEAMS[team].name} KING HAS FALLEN!`, this.foeCol({ team }, from), 2.2);
      this.bannerQ.push({ at: T + 2, text: `${TEAMS[team].name} ARMY LOSES HEART!`, col: COL.gold });
      this.shake(12); this.snd('roar');
      if (this.camEv) this.camEv.push({ type: 'spot', x: this.kings[team].x, y: this.kings[team].y, prio: 90, dur: 2.4, z: 1.8, slow: true });
      this.xf.king = TEAMS[team].name; this.xf.kingTeam = team;
    },
    // ----- drawing -----
    // the weapon a basic troop carries (sword, sword and shield, axe, spear, mace; a knight's war hammer; a giant's club)
    drawGear(ctx, u, x, y, tm) {
      const r = u.r, f = u.face, lg = u.lunge || 0, P = (a, d) => [x + Math.cos(f + a) * d, y + Math.sin(f + a) * d];
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const big = u.type === 'knight' || u.type === 'giant';
      if (u.gear === 'shield') {
        const [sx, sy] = P(-0.75, r * 0.82);
        disc(ctx, sx, sy, r * 0.56, tm.l, 2.5); disc(ctx, sx, sy, r * 0.18, COL.gold, 1.5);
      }
      if (u.gear === 'thrust') {
        const reach = r + 22 + lg * 12, [bx, by] = P(Math.PI - 0.5, r * 0.5), [tx, ty] = P(0.42, reach);
        stick(ctx, bx, by, tx, ty, 2.5, COL.wood);
        const dx = Math.cos(f), dy = Math.sin(f);
        tri(ctx, tx + dx * 9, ty + dy * 9, tx - dy * 4, ty + dx * 4, tx + dy * 4, ty - dx * 4, COL.steel, 1.5);
        return;
      }
      // swung weapons: rest out to the right, sweep across on each attack
      const a = f + 0.85 - lg * 1.5, [hx, hy] = P(1.05, r * 0.78), len = big ? r * 1.25 : r + 9;
      const ex = hx + Math.cos(a) * len, ey = hy + Math.sin(a) * len;
      if (u.gear === 'blade' || u.gear === 'shield') {
        stick(ctx, hx, hy, ex, ey, 2.5, COL.steel);
        const gx = hx + Math.cos(a) * 4, gy = hy + Math.sin(a) * 4;
        stick(ctx, gx - Math.sin(a) * 5, gy + Math.cos(a) * 5, gx + Math.sin(a) * 5, gy - Math.cos(a) * 5, 2, COL.gold);
      } else if (u.gear === 'cleave') {
        stick(ctx, hx, hy, ex, ey, big ? 6 : 2.5, COL.wood);
        if (u.type === 'giant') disc(ctx, ex, ey, r * 0.3, '#7A5230', 2.5);
        else { ctx.beginPath(); ctx.arc(ex - Math.cos(a) * 3, ey - Math.sin(a) * 3, 7, a - Math.PI / 2 + 0.25, a + Math.PI / 2 - 0.25, true); ctx.closePath(); ctx.fillStyle = COL.steel; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke(); }
      } else if (u.gear === 'crush') {
        stick(ctx, hx, hy, ex, ey, big ? 4 : 2.5, COL.wood);
        if (u.type === 'knight') {
          // a war hammer: a block of steel across the end of the handle
          const px = -Math.sin(a), py = Math.cos(a), w2 = 8, h2 = 5;
          ctx.beginPath(); ctx.moveTo(ex + px * w2 - Math.cos(a) * h2, ey + py * w2 - Math.sin(a) * h2); ctx.lineTo(ex + px * w2 + Math.cos(a) * h2, ey + py * w2 + Math.sin(a) * h2);
          ctx.lineTo(ex - px * w2 + Math.cos(a) * h2, ey - py * w2 + Math.sin(a) * h2); ctx.lineTo(ex - px * w2 - Math.cos(a) * h2, ey - py * w2 - Math.sin(a) * h2); ctx.closePath();
          ctx.fillStyle = COL.steel; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke();
        } else {
          ctx.beginPath(); for (let k = 0; k < 6; k++) { const b = k / 6 * TAU; ctx.moveTo(ex + Math.cos(b) * 4, ey + Math.sin(b) * 4); ctx.lineTo(ex + Math.cos(b) * 8, ey + Math.sin(b) * 8); }
          ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke(); disc(ctx, ex, ey, 5, COL.steel, 1.5);
        }
      }
    },
    // a crown on each king
    drawKing(ctx, u, x, y, tm) {
      // a royal-purple cape behind, the body in the army's colour, a sceptre and a big gold crown
      const r = u.r, f = u.face || 0, c = Math.cos(f), s = Math.sin(f);
      if (!u.fake) {
        ctx.beginPath(); ctx.arc(x, y, r + 10 + 2 * Math.sin(this.t * 4), 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,210,63,0.45)'; ctx.stroke();
        // the royal shield, while it lasts
        if (this.kingSafe && this.fightT < this.kingSafe) { ctx.beginPath(); ctx.arc(x, y, r + 20, 0, TAU); ctx.fillStyle = 'rgba(253,224,71,0.12)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(253,224,71,0.7)'; ctx.stroke(); }
      }
      ctx.beginPath(); ctx.ellipse(x - c * r * 0.4, y - s * r * 0.4, r * 1.2, r * 1.05, f, 0, TAU); ctx.fillStyle = '#6D28D9'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = COL.ink; ctx.stroke();
      disc(ctx, x, y, r * 0.88, tm.c, 3);
      const hx = x + Math.cos(f + 1.1) * r * 0.85, hy = y + Math.sin(f + 1.1) * r * 0.85;
      stick(ctx, hx - c * r * 0.3, hy - s * r * 0.3, hx + c * r * 0.95, hy + s * r * 0.95, 3, COL.gold);
      disc(ctx, hx + c * r * 1.05, hy + s * r * 1.05, 4, '#E5484D', 1.5);
      // the crown, seen from above like everything else: a gold band sitting on the head with five points around it,
      // a velvet cap inside, a jewel at the foot of each point and a little gold cross on top
      const cr = r * 0.54;
      ctx.save(); ctx.translate(x - c * r * 0.06, y - s * r * 0.06); ctx.rotate(f);
      ctx.beginPath(); ctx.ellipse(1.5, 2.5, cr * 1.3, cr * 1.3, 0, 0, TAU); ctx.fillStyle = 'rgba(4,6,11,0.22)'; ctx.fill();
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { const a = k / 10 * TAU, rr = k % 2 ? cr * 1.02 : cr * 1.34; k ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fillStyle = COL.gold; ctx.fill(); ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.strokeStyle = COL.ink; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, cr * 0.74, 0, TAU); ctx.fillStyle = '#7A1E9E'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(-cr * 0.18, -cr * 0.2, cr * 0.32, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
      for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; disc(ctx, Math.cos(a) * cr * 0.92, Math.sin(a) * cr * 0.92, Math.max(1.6, cr * 0.15), k % 2 ? '#3B82F6' : '#E5484D', 1); }
      ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-cr * 0.28, 0); ctx.lineTo(cr * 0.28, 0); ctx.moveTo(0, -cr * 0.28); ctx.lineTo(0, cr * 0.28);
      ctx.lineWidth = 4; ctx.strokeStyle = COL.ink; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = COL.gold; ctx.stroke();
      ctx.restore();
    },
    // trails of melee moves, clash sparks, hero and stun marks (in the battle, under the camera)
    // the hill: a raised mound in the middle, a ring that fills with the colour of the army taking it, and a flag
    drawHill(ctx) {
      const H = this.hill, t = this.t, own = H.team >= 0 ? TEAMS[H.team] : null, lead = H.c > 0 ? TEAMS[0] : H.c < 0 ? TEAMS[1] : null;
      ctx.beginPath(); ctx.arc(H.x, H.y, H.r, 0, TAU); ctx.fillStyle = own ? own.c : 'rgba(255,255,255,1)'; ctx.globalAlpha = own ? 0.13 : 0.05; ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(H.x, H.y, H.r * 0.62, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill();
      ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 20;
      ctx.beginPath(); ctx.arc(H.x, H.y, H.r, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.stroke();
      ctx.setLineDash([]);
      if (lead && Math.abs(H.c) > 0.01) {
        ctx.beginPath(); ctx.arc(H.x, H.y, H.r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.abs(H.c)); ctx.lineWidth = 9; ctx.strokeStyle = lead.c; ctx.lineCap = 'round'; ctx.stroke();
      }
      const fx = H.x, fy = H.y;
      ctx.lineCap = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(fx, fy + 10); ctx.lineTo(fx, fy - 40); ctx.stroke();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#D9B26F'; ctx.stroke();
      ctx.save(); ctx.translate(fx, fy - 40); ctx.transform(1, Math.sin(t * 6) * 0.12, 0, 1, 0, 0);
      if (own) drawFlag(ctx, own.key, 0, 0, 34, 22, 2.5);
      else { ctx.fillStyle = '#E8E6E1'; ctx.fillRect(0, 0, 34, 22); ctx.lineWidth = 2.5; ctx.strokeStyle = COL.ink; ctx.strokeRect(0, 0, 34, 22); }
      ctx.restore();
    },
    drawCombatFx(ctx) {
      const t = this.t, T = this.fightT;
      ctx.lineCap = 'round';
      for (const u of this.units) {
        if (u.dead) continue;
        const s = u.slash;
        if (s && t - s.t0 < 0.22) {
          const k = (t - s.t0) / 0.22, al = 1 - k;
          if (s.kind === 'cleave') {
            ctx.beginPath(); ctx.arc(u.x, u.y, u.r + 18, s.a, s.a + TAU * Math.min(1, k * 1.8)); ctx.lineWidth = 9; ctx.strokeStyle = `rgba(255,228,196,${0.75 * al})`; ctx.stroke();
          } else if (s.kind === 'thrust') {
            const dx = Math.cos(s.a), dy = Math.sin(s.a), l0 = u.r + 6, l1 = u.r + 30 + 14 * k;
            ctx.beginPath(); ctx.moveTo(u.x + dx * l0, u.y + dy * l0); ctx.lineTo(u.x + dx * l1, u.y + dy * l1); ctx.lineWidth = 6; ctx.strokeStyle = `rgba(255,255,255,${0.7 * al})`; ctx.stroke();
          } else if (s.kind === 'crush') {
            const ix = u.x + Math.cos(s.a) * (u.r + 14), iy = u.y + Math.sin(s.a) * (u.r + 14);
            ctx.beginPath(); ctx.arc(ix, iy, 5 + 16 * k, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = `rgba(253,224,71,${0.8 * al})`; ctx.stroke();
          } else {
            const a0 = s.a - 1.15 * s.side, sweep = 2.3 * s.side * Math.min(1, k * 1.7);
            ctx.beginPath(); ctx.arc(u.x, u.y, u.r + 12, Math.min(a0, a0 + sweep), Math.max(a0, a0 + sweep)); ctx.lineWidth = s.kind === 'shield' ? 8 : 5;
            ctx.strokeStyle = s.kind === 'shield' ? `rgba(147,197,253,${0.75 * al})` : `rgba(255,255,255,${0.65 * al})`; ctx.stroke();
          }
        }
        if (u.stunT > T) {
          // little stars circling over a stunned fighter
          ctx.fillStyle = '#FDE047';
          for (let k = 0; k < 3; k++) { const a = t * 7 + k * TAU / 3; star(ctx, u.x + Math.cos(a) * u.r * 0.8, u.y - u.r - 6 + Math.sin(a) * 4, 4.5, 5, 0.45); ctx.fill(); }
        }
      }
      for (const s of this.sparks) {
        const k = (t - s.t0) / 0.3; if (k < 0 || k > 1) continue;
        const L = 8 + 22 * k;
        ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; ctx.moveTo(s.x + Math.cos(a) * L * 0.3, s.y + Math.sin(a) * L * 0.3); ctx.lineTo(s.x + Math.cos(a) * L, s.y + Math.sin(a) * L); }
        ctx.lineWidth = 3.5; ctx.strokeStyle = rgba(s.col, 1 - k); ctx.stroke();
        disc(ctx, s.x, s.y, 6 * (1 - k) + 1, `rgba(255,255,255,${1 - k})`, 0);
      }
    },
    // skins: an aura under every troop of that army and a ring over it, each drawn as one batch
    drawSkins(ctx, list, over) {
      for (let team = 0; team < this.N; team++) {
        const k = this.skins && this.skins[team]; if (!k) continue;
        const S = SKINS[k], tm = TEAMS[team];
        const col = c => (c === 'light' ? tm.l : c);
        ctx.beginPath();
        let any = false;
        for (const u of list) { if (u.team !== team || u.dead || u.cloak) continue; const rr = u.r + (over ? 2.5 : 7); ctx.moveTo(u.x + rr, u.y); ctx.arc(u.x, u.y, rr, 0, TAU); any = true; }
        if (!any) continue;
        if (!over && S.glow) { ctx.fillStyle = rgba(col(S.glow), S.glowA); ctx.fill(); }
        if (over && S.ring) { if (S.dash) ctx.setLineDash([5, 4]); ctx.lineWidth = S.w; ctx.strokeStyle = rgba(col(S.ring), 0.9); ctx.stroke(); if (S.dash) ctx.setLineDash([]); }
      }
      if (over && this.heroTeam >= 0) {
        // heroes: a bright gold ring
        ctx.beginPath(); let any = false;
        for (const u of list) if (u.hero && !u.dead) { ctx.moveTo(u.x + u.r + 4, u.y); ctx.arc(u.x, u.y, u.r + 4, 0, TAU); any = true; }
        if (any) { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,210,63,0.9)'; ctx.stroke(); }
      }
    },
    skinFx(dt) {
      if (!this.skins) return;
      const F = this.FX;
      for (const u of this.units) {
        if (u.dead) continue; const k = this.skins[u.team]; if (!k || !SKINS[k].fx || !F.chance(dt * 1.2)) continue;
        this.parts.push({ x: u.x + F.range(-u.r, u.r), y: u.y + F.range(-u.r, u.r), vx: 0, vy: -26, life: 0.6, age: 0, size: 4, color: SKINS[k].fx, grav: 0 });
      }
    },
    // the roster card at the start: every troop type in each army, with a portrait, its name, what it's good at and how many there are.
    // It covers the score area (not the battle) for the first few seconds.
    drawRosterCards(ctx) {
      if (!this.cmb || !this.cmb.roster) return;
      const t = this.t, aIn = clamp((t - 0.15) / 0.35, 0, 1), aOut = clamp((4.3 - t) / 0.45, 0, 1), al = Math.min(aIn, aOut);
      if (al <= 0) return;
      if (!this.rInfo) {
        this.rInfo = this.teamIds().map(team => {
          const n = {};
          for (const u of this.units) if (u.team === team && !UNIT[u.type].uncounted) n[u.type] = (n[u.type] || 0) + 1;
          for (const w of this.waves[team]) for (const k of w.list) n[k] = (n[k] || 0) + 1;
          return Object.entries(n).sort((p, q) => (p[0] === 'king' ? -1 : q[0] === 'king' ? 1 : 0) || ((UNIT[q[0]].rank === 0) - (UNIT[p[0]].rank === 0)) || q[1] - p[1]);
        });
      }
      const N = this.N, top = 222, H = 256, rowH = H / N, x0 = 30, W = VW - 60, lab = N === 3 ? 150 : 170;
      this.layReset();
      ctx.save();
      ctx.globalAlpha = al;
      roundRect(ctx, x0, top, W, H, 18); ctx.fillStyle = '#0A0E19'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = COL.frame; ctx.stroke();
      for (let i = 0; i < N; i++) {
        const tm = TEAMS[i], ry = top + i * rowH, slide = (1 - easeOutCubic(aIn)) * (i % 2 ? 260 : -260);
        if (i) { ctx.beginPath(); ctx.moveTo(x0 + 14, ry); ctx.lineTo(x0 + W - 14, ry); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.stroke(); }
        ctx.save(); ctx.translate(slide, 0);
        // the army's name on the left, in its colour
        // (every text shrinks to fit its space, so nothing ever runs into the portraits or the next column)
        this.fitText(ctx, tm.name, x0 + 18, ry + rowH * 0.36, lab - 26, N === 3 ? 28 : 34, 800, true, tm.c, 'left', 18);
        const sk = this.skins && this.skins[i] ? SKINS[this.skins[i]].name + ' ' : '';
        this.fitText(ctx, `${sk}${docLabel(this.doc[i])}`, x0 + 18, ry + rowH * 0.7, lab - 26, N === 3 ? 17 : 20, 700, false, COL.muted, 'left', 13);
        // at most three troop types per army, so every name and specialty can be read
        const list = this.rInfo[i], n = Math.min(list.length, 3), cw = (W - lab - 10) / 3, pr = Math.min(rowH * 0.34, 42);
        for (let j = 0; j < n; j++) {
          const [type, cnt] = list[j], U = UNIT[type], cx = x0 + lab + j * cw, px = cx + pr + 4, py = ry + rowH / 2;
          disc(ctx, px, py, pr, 'rgba(255,255,255,0.07)', 0);
          if (!slide) this.lay.push({ kind: 'circle', x: px - pr, y: py - pr, w: pr * 2, h: pr * 2 });
          const s = clamp(pr * 0.78 / U.r, 0.3, 1.7);
          ctx.save(); ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.clip(); ctx.translate(px, py); ctx.scale(s, s);
          try { this.drawPortrait(ctx, type, i); } catch (e) { disc(ctx, 0, 0, U.r, tm.c, 3); }
          ctx.restore();
          const tx = px + pr + 12, mw = cx + cw - tx - 8;
          const nm = labelOf(type).replace(/^THE /, '');
          this.fitText(ctx, nm, tx, py - rowH * 0.2, mw, nm.length > 11 ? 19 : 22, 800, true, COL.white, 'left', 14);
          this.fitText(ctx, type === 'king' && this.mode === 'king' ? 'PROTECT HIM' : specOf(type), tx, py + rowH * 0.03, mw, N === 3 ? 15 : 17, 700, false, COL.gold, 'left', 12);
          this.fitText(ctx, `×${cnt}`, tx, py + rowH * 0.27, Math.min(mw, 70), N === 3 ? 17 : 20, 800, true, tm.l, 'left', 13);
        }
        if (list.length > n) this.fitText(ctx, `+${list.length - n} MORE`, x0 + W - 14, ry + rowH - 14, 110, 18, 700, false, COL.muted, 'right', 13);
        ctx.restore();
      }
      ctx.restore();
      ctx.textBaseline = 'alphabetic';
    },
    skinName(i) { return this.skins && this.skins[i] ? SKINS[this.skins[i]].name + ' ' : ''; },
    drawPortrait(ctx, type, team) {
      const U = UNIT[type], pool = GEAR_POOL[type];
      const fake = { fake: true, type, team, r: U.r, x: 0, y: 0, face: -Math.PI / 2 + 0.5, mface: -Math.PI / 2 + 0.5, vx: 0, vy: 0, gait: 1.3, lunge: 0, swing: 0, hp: 1, max: 1, cd: 1,
        heads: U.heads || 0, bodies: [], souls: 0, decoyEnd: 99, look: 'illusion', lives: 1, muzzle: 0, flying: !!U.flying, gear: pool ? (type === 'soldier' ? 'shield' : pool[0]) : undefined };
      if (type === 'king') this.drawKing(ctx, fake, 0, 0, TEAMS[team]);
      else this.drawBody(ctx, fake, 0, 0, TEAMS[team], !!U.sword);
    },
  };
  // ----- living tribes (rules.tribes): a fixed pool of invented tribes per genre, so the same tribes come back video after video -----
  // each: [name, emblem, trait]. Names are invented; no real clans, houses, regiments or insignia.
  const TRIBE_POOL = {
    medieval: [['IRON BOAR CLAN', 'boar', 'smiths'], ['ORDER OF THE SILVER STAG', 'stag', 'zealots'], ['RED HAWK COMPANY', 'raven', 'hunters'], ['BLACK BEAR CLAN', 'bear', 'stoneskin'],
      ['ASH WOLF CLAN', 'wolf', 'hunters'], ['OAKSHIELD CLAN', 'oak', 'stoneskin'], ['STONEBRIDGE COMPANY', 'tower', 'miners'], ['GOLDEN LION ORDER', 'star', 'traders'],
      ['FROSTMERE CLAN', 'moon', 'miners'], ['RAVEN HILL CLAN', 'raven', 'zealots'], ['THORNWOOD COMPANY', 'oak', 'traders'], ['HIGHMOOR CLAN', 'stag', 'smiths'],
      ['STORM TOWER ORDER', 'tower', 'zealots'], ['COPPER CROWN COMPANY', 'star', 'traders'], ['GREYFANG CLAN', 'fang', 'hunters'], ['WILDBROOK CLAN', 'serpent', 'miners']],
    fantasy: [['MOONFANG TRIBE', 'moon', 'hunters'], ['EMBERROOT CIRCLE', 'flame', 'smiths'], ['STARWEAVE CIRCLE', 'star', 'traders'], ['MOSSBACK TRIBE', 'oak', 'stoneskin'],
      ['SUNSPIRE KIN', 'tower', 'zealots'], ['DUSKWING TRIBE', 'raven', 'hunters'], ['GLIMMERDEEP KIN', 'gear', 'miners'], ['THORNHEART CIRCLE', 'serpent', 'zealots'],
      ['FROSTWHISPER TRIBE', 'moon', 'stoneskin'], ['ASHMANTLE KIN', 'flame', 'smiths'], ['SILVERBOUGH CIRCLE', 'stag', 'traders'], ['STORMHORN TRIBE', 'boar', 'hunters'],
      ['HOLLOWBARK KIN', 'oak', 'miners'], ['GLOOMCAP CIRCLE', 'skull', 'zealots'], ['BRIGHTWATER TRIBE', 'crane', 'traders'], ['CINDERCLAW KIN', 'fang', 'smiths']],
    modern: [['VIPER COMPANY', 'serpent', 'hunters'], ['GRANITE BATTALION', 'tower', 'stoneskin'], ['FALCON SQUADRON', 'raven', 'traders'], ['IRONSIDE COMPANY', 'gear', 'smiths'],
      ['THUNDER PLATOON', 'star', 'zealots'], ['NIGHTJAR COMPANY', 'moon', 'hunters'], ['COPPERHEAD BATTALION', 'serpent', 'miners'], ['BULLDOG COMPANY', 'bear', 'stoneskin'],
      ['HAMMER PLATOON', 'gear', 'smiths'], ['KESTREL SQUADRON', 'crane', 'traders'], ['STONEWALL COMPANY', 'tower', 'stoneskin'], ['BADGER PLATOON', 'bear', 'miners'],
      ['LYNX COMPANY', 'wolf', 'hunters'], ['MUSTANG BATTALION', 'stag', 'zealots'], ['HARRIER SQUADRON', 'raven', 'traders'], ['WOLVERINE COMPANY', 'fang', 'smiths']],
    scifi: [['HELIX COHORT', 'gear', 'smiths'], ['NOVA LEGION', 'star', 'zealots'], ['QUASAR WING', 'moon', 'hunters'], ['VECTOR COHORT', 'gear', 'traders'],
      ['ION LEGION', 'flame', 'miners'], ['PULSAR WING', 'star', 'hunters'], ['ZENITH COHORT', 'tower', 'stoneskin'], ['ORBIT LEGION', 'moon', 'traders'],
      ['PHOTON WING', 'flame', 'zealots'], ['NEBULA COHORT', 'star', 'miners'], ['AXIOM LEGION', 'gear', 'stoneskin'], ['COMET WING', 'raven', 'hunters'],
      ['PRISM COHORT', 'tower', 'smiths'], ['VORTEX LEGION', 'serpent', 'zealots'], ['SOLAR WING', 'flame', 'traders'], ['CIPHER COHORT', 'skull', 'miners']],
    pirate: [['SALTFANG CREW', 'fang', 'hunters'], ['CREW OF THE BLACK GULL', 'raven', 'traders'], ['RUM BARREL CREW', 'anchor', 'smiths'], ['CREW OF THE GREY SHARK', 'fang', 'zealots'],
      ['TIDEBREAKER CREW', 'anchor', 'stoneskin'], ['CREW OF THE RED KRAKEN', 'serpent', 'hunters'], ['DRIFTWOOD CREW', 'oak', 'miners'], ['CREW OF THE GOLDEN PARROT', 'crane', 'traders'],
      ['STORMSAIL CREW', 'moon', 'zealots'], ['CREW OF THE SEA WOLF', 'wolf', 'hunters'], ['BILGEWATER CREW', 'skull', 'miners'], ['CREW OF THE IRON ANCHOR', 'anchor', 'smiths'],
      ['REEFJAW CREW', 'fang', 'stoneskin'], ['CREW OF THE NIGHT EEL', 'serpent', 'zealots'], ['GUNPOWDER CREW', 'flame', 'smiths'], ['CREW OF THE BONE COMPASS', 'skull', 'traders']],
    horror: [['COVEN OF ASH', 'flame', 'zealots'], ['THE ROTTING CHOIR', 'skull', 'stoneskin'], ['GRAVE LANTERN COVEN', 'moon', 'hunters'], ['THE HOLLOW BELL', 'tower', 'miners'],
      ['CRYPT MOTH COVEN', 'raven', 'traders'], ['THE PALE PROCESSION', 'skull', 'zealots'], ['BONE GARDEN COVEN', 'oak', 'smiths'], ['THE WEEPING GATE', 'tower', 'stoneskin'],
      ['GHOUL HOLLOW COVEN', 'fang', 'hunters'], ['THE BLACK CANDLE', 'flame', 'smiths'], ['MIRE WITCH COVEN', 'serpent', 'miners'], ['THE SILENT MILE', 'moon', 'traders'],
      ['NIGHTSHADE COVEN', 'serpent', 'zealots'], ['THE CROOKED SPIRE', 'tower', 'miners'], ['WORMWOOD COVEN', 'oak', 'hunters'], ['THE GRINNING MOON', 'moon', 'smiths']],
    samurai: [['HOUSE OF THE RED CRANE', 'crane', 'zealots'], ['IRON LOTUS SCHOOL', 'flame', 'smiths'], ['HOUSE OF THE SILVER TIGER', 'fang', 'hunters'], ['FALLING LEAF SCHOOL', 'oak', 'traders'],
      ['HOUSE OF THE JADE SERPENT', 'serpent', 'stoneskin'], ['STONE RIVER SCHOOL', 'tower', 'miners'], ['HOUSE OF THE BLACK KITE', 'raven', 'hunters'], ['CHERRY STORM SCHOOL', 'star', 'zealots'],
      ['HOUSE OF THE WHITE HERON', 'crane', 'traders'], ['THUNDER GATE SCHOOL', 'tower', 'stoneskin'], ['HOUSE OF THE MOON FOX', 'moon', 'hunters'], ['STILL WATER SCHOOL', 'crane', 'miners'],
      ['HOUSE OF THE CRIMSON CARP', 'serpent', 'smiths'], ['MOUNTAIN WIND SCHOOL', 'stag', 'zealots'], ['HOUSE OF THE GOLD DRAGONFLY', 'star', 'traders'], ['EMBER BLADE SCHOOL', 'flame', 'smiths']],
  };
  const TRIBE_ERAS = Object.keys(TRIBE_POOL);
  const TRAIT = {
    smiths: { name: 'SMITHS', say: 'forge for less' }, traders: { name: 'TRADERS', say: 'trade for more' }, hunters: { name: 'HUNTERS', say: 'more loot' },
    miners: { name: 'MINERS', say: 'more iron' }, zealots: { name: 'ZEALOTS', say: 'fierce while the chief lives' }, stoneskin: { name: 'STONESKIN', say: 'tougher troops' },
  };
  // weapon and armour tiers, named for the genre
  const TIER_NAMES = {
    blade: { w: ['STANDARD', 'IRON', 'STEEL', 'RUNIC'], a: ['NONE', 'CHAINMAIL', 'PLATE', 'RUNE-PLATE'], noun: 'BLADES' },
    modern: { w: ['STANDARD', 'HOLLOW-POINT', 'ARMOUR-PIERCING', 'INCENDIARY'], a: ['NONE', 'KEVLAR', 'CERAMIC', 'TITANIUM'], noun: 'ROUNDS' },
    scifi: { w: ['MK I', 'MK II', 'MK III', 'PLASMA'], a: ['NONE', 'SHIELDING II', 'SHIELDING III', 'SHIELDING IV'], noun: 'WEAPONS' },
    horror: { w: ['STANDARD', 'RUSTED', 'CURSED', 'BONE-FORGED'], a: ['NONE', 'GRAVE-CLOTH', 'IRON SHROUD', 'BONE-PLATE'], noun: 'BLADES' },
  };
  const TIER_SET = { modern: 'modern', scifi: 'scifi', horror: 'horror' };
  // glint colours per weapon tier (index = tier), and the glow for the top tier by set
  const W_COL = ['#FFFFFF', '#B7C0CA', '#F2F8FF', '#5EEAD4'], W_TOP = { blade: '#5EEAD4', modern: '#FF8A1F', scifi: '#C084FC', horror: '#A3E635' };
  const A_COL = ['', '#7C8794', '#DCE5EE', '#FFD23F'];
  // what each battle is fought for, by map
  const STAKE = {
    open: 'THE OPEN PLAINS', rocks: 'THE QUARRY', ruins: 'THE RUINED FORT', trenches: 'THE TRENCH LINE', city: 'THE CITY', forest: 'THE OLD FOREST', bombed: 'THE BOMBED CITY',
    enchanted: 'THE CRYSTAL GROVE', canyon: 'THE CANYON PASS', godboard: 'THE GODBOARD', furnace: 'THE WORLD FURNACE', frozen: 'THE FROZEN END', grave: "THE TITAN'S BONES",
    overgrown: 'THE OVERGROWN THRONE', clockwork: 'THE CLOCKWORK ARENA', shattered: 'THE SKY ISLANDS', mirror: 'THE MIRROR GATE', castle: 'THE CASTLE', beach: 'THE TREASURE COVE',
    snow: 'THE MOUNTAIN PASS', dunes: 'THE DESERT WELL', swamp: 'THE SWAMP SHRINE', neon: 'THE NEON DISTRICT', temple: 'THE SKY-TEMPLE RELIC', graveyard: 'THE HAUNTED CRYPT', moon: 'THE REACTOR',
  };
  const ORD = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'TH' : ['TH', 'ST', 'ND', 'RD'][n % 10] || 'TH'}`;
  const TAC_SHORT = { advance: 'ADVANCE', wall: 'WALL', flank: 'FLANK', focus: 'FOCUS', hold: 'HOLD', guard: 'GUARD', surround: 'SURROUND', charge: 'CHARGE', regroup: 'REGROUP' };
  const TAC_WORD = { advance: 'ADVANCE', wall: 'SHIELD WALL', flank: 'FLANK', focus: 'FOCUS FIRE', hold: 'HOLD THE LINE', guard: 'PROTECT THE CHIEF', surround: 'SURROUND', charge: 'CHARGE', regroup: 'REGROUP' };
  const MERCH_ITEMS = { rune: { name: 'RUNE OF FURY', price: 45 }, swords: { name: 'SELLSWORDS', price: 40 }, horn: { name: 'WAR HORN', price: 30 } };
  // a tribe's emblem: a simple flat glyph (light fill, ink outline) centred on (x, y), about s pixels in radius
  function drawEmblem(g, kind, x, y, s, col = '#F4F1E6') {
    g.save(); g.translate(x, y); g.scale(s / 20, s / 20);
    g.lineJoin = 'round'; g.lineCap = 'round'; g.fillStyle = col; g.strokeStyle = COL.ink; g.lineWidth = 2.6;
    const poly = (pts, fill = true) => { g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath(); if (fill) g.fill(); g.stroke(); };
    const ring = (a, b, r) => { g.beginPath(); g.arc(a, b, r, 0, TAU); g.fill(); g.stroke(); };
    const line = (pts, w = 4.5) => { g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.lineWidth = w + 3; g.strokeStyle = COL.ink; g.stroke(); g.lineWidth = w; g.strokeStyle = col; g.stroke(); g.lineWidth = 2.6; g.strokeStyle = COL.ink; };
    const dot = (a, b, r) => { g.beginPath(); g.arc(a, b, r, 0, TAU); g.fillStyle = COL.ink; g.fill(); g.fillStyle = col; };
    switch (kind) {
      case 'boar':
        poly([[-10, -6], [-14, -15], [-4, -10]]); poly([[10, -6], [14, -15], [4, -10]]);
        g.beginPath(); g.ellipse(0, 0, 12, 11, 0, 0, TAU); g.fill(); g.stroke();
        g.beginPath(); g.ellipse(0, 7, 6.5, 4.5, 0, 0, TAU); g.fill(); g.stroke(); dot(-2.3, 7, 1.3); dot(2.3, 7, 1.3);
        poly([[-6, 9], [-11, 3], [-8, 11]]); poly([[6, 9], [11, 3], [8, 11]]); dot(-5, -2, 1.6); dot(5, -2, 1.6);
        break;
      case 'stag':
        line([[-4, -4], [-9, -12], [-15, -14]]); line([[-9, -12], [-8, -18]]); line([[4, -4], [9, -12], [15, -14]]); line([[9, -12], [8, -18]]);
        poly([[-7, -4], [7, -4], [4, 10], [0, 14], [-4, 10]]); dot(-3, 1, 1.5); dot(3, 1, 1.5);
        break;
      case 'wolf':
        poly([[-12, -12], [-5, -6], [5, -6], [12, -12], [11, 2], [0, 15], [-11, 2]]); dot(-4.5, 0, 1.7); dot(4.5, 0, 1.7); dot(0, 10, 2.2);
        break;
      case 'raven':
        // a bird with its wings spread
        poly([[-17, -9], [-9, -3], [-4, -4], [-3, -10], [0, -13], [3, -10], [4, -4], [9, -3], [17, -9], [12, 2], [4, 3], [3, 9], [6, 14], [0, 12], [-6, 14], [-3, 9], [-4, 3], [-12, 2]]);
        poly([[-1.5, -9], [0, -5.5], [1.5, -9]]);
        break;
      case 'bear':
        ring(-9, -9, 5); ring(9, -9, 5); ring(0, 1, 12.5);
        g.beginPath(); g.ellipse(0, 6, 6, 4.5, 0, 0, TAU); g.fill(); g.stroke(); dot(0, 4.5, 2); dot(-5, -2, 1.6); dot(5, -2, 1.6);
        break;
      case 'serpent':
        line([[-12, 12], [-4, 10], [4, 4], [0, -2], [-6, -6], [-2, -12], [8, -12]], 5); ring(10, -12, 4.5);
        break;
      case 'crane':
        line([[-6, 12], [-2, 6]], 3); line([[2, 12], [1, 6]], 3);
        g.beginPath(); g.ellipse(-1, 2, 11, 6, -0.2, 0, TAU); g.fill(); g.stroke();
        line([[7, -1], [9, -9], [6, -14]], 3.5); ring(6, -14, 3.4); poly([[8, -15], [17, -13], [8, -12]]);
        break;
      case 'skull':
        g.beginPath(); g.arc(0, -2, 12, Math.PI * 0.85, Math.PI * 2.15); g.lineTo(7, 12); g.lineTo(-7, 12); g.closePath(); g.fill(); g.stroke();
        dot(-5, -1, 3.6); dot(5, -1, 3.6); poly([[0, 3], [-2, 7], [2, 7]], false);
        g.beginPath(); g.moveTo(-3, 12); g.lineTo(-3, 8.5); g.moveTo(1, 12); g.lineTo(1, 8.5); g.stroke();
        break;
      case 'gear': {
        g.beginPath();
        for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, rr = k % 2 ? 10 : 14; const p = [Math.cos(a) * rr, Math.sin(a) * rr]; k ? g.lineTo(...p) : g.moveTo(...p); }
        g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.arc(0, 0, 4.5, 0, TAU); g.fillStyle = COL.ink; g.fill();
        break;
      }
      case 'anchor':
        g.beginPath(); g.arc(0, -11, 3.8, 0, TAU); g.lineWidth = 7; g.strokeStyle = COL.ink; g.stroke(); g.lineWidth = 3.5; g.strokeStyle = col; g.stroke(); g.lineWidth = 2.6; g.strokeStyle = COL.ink;
        line([[0, -7], [0, 12]]); line([[-7, -3], [7, -3]], 4); line([[-12, 3], [-9, 10], [0, 12], [9, 10], [12, 3]], 4.5);
        break;
      case 'star':
        g.beginPath();
        for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k / 10 * TAU, rr = k % 2 ? 6.5 : 15; const p = [Math.cos(a) * rr, Math.sin(a) * rr]; k ? g.lineTo(...p) : g.moveTo(...p); }
        g.closePath(); g.fill(); g.stroke();
        break;
      case 'flame':
        g.beginPath(); g.moveTo(0, -16); g.bezierCurveTo(9, -6, 13, 2, 10, 8); g.bezierCurveTo(7, 15, -7, 15, -10, 8); g.bezierCurveTo(-12, 2, -6, -2, -4, -8); g.bezierCurveTo(-2, -3, 2, -6, 0, -16);
        g.closePath(); g.fill(); g.stroke();
        break;
      case 'moon':
        g.beginPath(); g.arc(0, 0, 14, Math.PI * 0.32, Math.PI * 1.68); g.arc(7, 0, 10.5, Math.PI * 1.55, Math.PI * 0.45, true); g.closePath(); g.fill(); g.stroke();
        break;
      case 'tower':
        poly([[-10, 13], [-9, -6], [-11, -6], [-11, -14], [-6, -14], [-6, -10], [-2, -10], [-2, -14], [2, -14], [2, -10], [6, -10], [6, -14], [11, -14], [11, -6], [9, -6], [10, 13]]);
        g.beginPath(); g.moveTo(-3.5, 13); g.lineTo(-3.5, 6); g.arc(0, 6, 3.5, Math.PI, 0); g.lineTo(3.5, 13); g.closePath(); g.fillStyle = COL.ink; g.fill();
        break;
      case 'oak':
        line([[0, 14], [0, 2]], 5);
        ring(-7, -3, 7); ring(7, -3, 7); ring(0, -9, 8.5);
        break;
      case 'fang':
        poly([[-12, -10], [-1, -10], [-6, 14]]); poly([[1, -10], [12, -10], [6, 14]]);
        break;
      default:
        ring(0, 0, 10);
    }
    g.restore();
  }
  // ----- pacing (rules.video.pace): every battle ends close to the time limit -----
  // Twice a second, the side that's losing is compared with where it should be on a curve that reaches zero just before the limit.
  // If it's falling faster, every hit in the battle (both sides alike) does less damage for a while; if it's well behind the curve,
  // hits do a little more. The final pushes still finish the battle. Only damage changes, never who is stronger.
  const ARMY_PACE = {
    paceTick() {
      const T = this.fightT;
      if (T < (this.paceAt || 0)) return;
      this.paceAt = T + 0.5;
      const ids = this.teamIds();
      if (!this.paceStart) this.paceStart = ids.map(t => Math.max(1, this.strength(t)));
      const frac = ids.map((t, i) => this.strength(t) / this.paceStart[i]).sort((a, b) => b - a);
      const P = this.opts.pace === true ? {} : this.opts.pace || {}, end = Math.max(10, this.cap - (P.margin ?? 1.5)), tgt = clamp(1 - Math.pow(T / end, P.curve ?? 1.8), 0.03, 1);
      const r = frac[1] / tgt;
      // under the curve: slow the fighting down (never below 15%); well over it from halfway on: speed it up a little
      let want = r < 1 ? clamp(Math.pow(r, 1.5), P.slowest ?? 0.15, 1) : T > end * 0.45 && r > 1.3 ? clamp(Math.sqrt(r / 1.3), 1, P.fastest ?? 1.5) : 1;
      // in the last few seconds, a side down to its last few troops is finished off rather than held on to (a wipe-out, not "time")
      const tot = this.totals().slice().sort((a, b) => b - a);
      if (T > end - 5 && tot[1] <= 3) want = Math.max(want, 1.5);
      this.paceK = (this.paceK === undefined ? 1 : this.paceK) + (want - (this.paceK === undefined ? 1 : this.paceK)) * 0.5;
    },
  };
  // ----- living tribes: tribes with chiefs, a war economy, the forge, trading, a merchant, tactics and a story (rules.tribes) -----
  // Everything here runs on its own dice (TR), and only when opts.tribes is on, so older battles play out exactly as before.
  const tName = n => (n.startsWith('THE ') ? n : `THE ${n}`);
  const sName = n => n.replace(/^THE /, '');
  const ARMY_TRIBES = {
    initTribeOpts() {
      this.ui2 = this.opts.ui >= 2;
      const o = this.opts.tribes;
      this.trb = o && o.on ? o : null;
      if (!this.trb) return;
      this.ext = true;
      this.TR = rng(((this.seed >>> 0) ^ 0x7121BE) >>> 0);
      this.econ = { kill: o.killGold ?? 2, chest: o.lossGold ?? 0.5, iron: o.ironEvery ?? 1.3, gold: o.forgeGold ?? 8, ore: o.forgeIron ?? 4, rate: o.ironPrice ?? 2.5 };
    },
    // which genre's tribes an army brings
    tribeEra(team) {
      const d = this.opts.doctrines && this.opts.doctrines[team];
      if (typeof d !== 'string') return 'wild';
      const e = eraOf(d);
      return TRIBE_POOL[e] ? e : 'wild';
    },
    roleOf(U) { return U.ranged && !U.healer ? 'shoot' : U.mount || (U.speed >= 100 && U.rank !== 0) ? 'ride' : 'foot'; },
    // called once the armies are on the field: split each army into tribes, pick chiefs, feuds and the story
    initTribes() {
      const TR = this.TR, o = this.trb, cx = AR.x + AR.w / 2;
      const per = this.N === 3 ? 1 : clamp(o.perArmy || 2, 1, 2);
      this.tribes = []; this.ticker = []; this.carts = []; this.tacLabels = []; this.tradeAt = [0, 0, 0]; this.merch = null; this.coins = [];
      this.merchAt = o.merchant === false ? Infinity : (this.fixed || this.target) * TR.range(0.36, 0.44);
      const used = new Set(), hist = (o.history && o.history.t) || {};
      for (const team of this.teamIds()) {
        const era = this.tribeEra(team);
        const pool = (era === 'wild' ? TRIBE_ERAS.flatMap(e => TRIBE_POOL[e].map(x => [...x, e])) : TRIBE_POOL[era].map(x => [...x, era])).filter(x => !used.has(x[0]));
        const mem = this.units.filter(u => u.team === team && !u.dead && !UNIT[u.type].uncounted);
        const cnt = { shoot: 0, ride: 0, foot: 0 };
        for (const u of mem) cnt[this.roleOf(UNIT[u.type])]++;
        const n = Math.max(1, mem.length), sh = cnt.shoot / n, rd = cnt.ride / n;
        // tribes follow roles when the army has a clear second role, otherwise they are its two wings
        const split = per < 2 ? 'one' : sh >= 0.2 && sh <= 0.8 ? 'shoot' : rd >= 0.2 && rd <= 0.8 ? 'ride' : 'wing';
        const tbs = [];
        for (let i = 0; i < per; i++) {
          const pick = pool.splice(Math.floor(TR.next() * pool.length), 1)[0]; used.add(pick[0]);
          const camp = this.N === 3
            ? { x: cx + Math.cos(this.homeAngle(team)) * 430, y: AR.y + AR.h / 2 + Math.sin(this.homeAngle(team)) * 430 }
            : { x: AR.x + AR.w * (per === 1 ? 0.5 : i === 0 ? 0.27 : 0.73), y: team === 0 ? AR.y + 30 : AR.y + AR.h - 30 };
          const tb = { id: this.tribes.length, team, idx: i, name: pick[0], emblem: pick[1], trait: pick[2], era: pick[3], set: TIER_SET[pick[3]] || 'blade',
            gold: 0, iron: 0, wt: 0, at: 0, ups: 0, kills: 0, tactic: 'advance', tacAt: 0.5 + i * 0.7 + team * 0.35, qmAt: 1 + i * 0.9 + team * 0.45,
            dealt: 0, taken: 0, shot: 0, n: mem.length, cx: camp.x, cy: camp.y, camp, chief: null, feud: null, side: i === 0 ? -1 : 1, split, rec: hist[pick[0]] || null,
            goldFx: 0, ironFx: 0, forgeT: -9, hornT: 0, focus: null };
          tbs.push(tb); this.tribes.push(tb);
        }
        for (const u of mem) u.tribe = tbs[this.tribeIndexFor(u, tbs, split, mem)];
        // reinforcements that haven't arrived yet are counted in their tribe too
        for (const tb of tbs) {
          tb.kind = this.tribeKind(tb);
          // the chief: the tribe's best regular troop (tougher, a little bigger, carrying the tribe banner)
          let best = null, bv = -1;
          for (const u of mem) {
            if (u.tribe !== tb) continue;
            const U = UNIT[u.type];
            if (U.rank === 0 || U.healer || U.king || u.duelist || U.decoy) continue;
            const v = (U.cost || 1) + (U.commander ? 3 : 0) - Math.abs(u.x - tb.camp.x) * 0.001;
            if (v > bv) { bv = v; best = u; }
          }
          if (best) { tb.chief = best; best.chief = tb; best.max *= 1.6; best.hp = best.max; best.r += 2; best.m = best.r * best.r; }
        }
      }
      this.pickFeud();
      this.story = this.makeStory();
      // the one-line version for the opening card (big type, readable at a glance), and the prize
      const st = this.story, tr = this.tribes;
      st.stake = STAKE[this.opts.map] || 'THE BATTLEFIELD';
      st.hook = { revenge: 'REVENGE FOR LAST TIME', streak: `${(st.foe && st.foe.rec && st.foe.rec.s) || 2} WINS IN A ROW. WHO STOPS THEM?`, underdog: 'THEY HAVE NEVER WON. UNTIL TODAY?',
        raid: 'THEY BURNED OUR FORGE', oath: 'AN OATH OF IRON', debut: 'THEIR FIRST BATTLE', stake: 'ONE PRIZE. ONE WINNER.' }[st.kind] || 'WHO WINS?';
      if (st.kind === 'underdog' || st.kind === 'debut') st.hero = st.hero || tr[0];
      // UI 2.0: the opening story card owns the top of the battlefield for the first 4 s, so the opening banners wait until after it
      if (this.ui2) for (const q of this.bannerQ || []) if (!q.done && q.at < 4.6) q.at += 3.4;
    },
    tribeIndexFor(u, tbs, split, mem) {
      if (tbs.length < 2) return 0;
      const U = UNIT[u.type], role = this.roleOf(U);
      if (split === 'shoot') return role === 'shoot' || U.healer ? 1 : 0;
      if (split === 'ride') return role === 'ride' ? 1 : 0;
      return u.x < AR.x + AR.w / 2 ? 0 : 1;
    },
    tribeKind(tb) {
      const c = { shoot: 0, ride: 0, foot: 0 };
      for (const u of this.units) if (u.tribe === tb && !u.dead) c[this.roleOf(UNIT[u.type])]++;
      return c.shoot >= c.ride && c.shoot >= c.foot ? 'shoot' : c.ride >= c.foot ? 'ride' : 'foot';
    },
    // a troop that arrives later (reinforcements, drops, the garrison) joins the tribe it fits
    tribeUnit(u, U) {
      if (!this.tribes || u.team > 2 || U.uncounted) return;
      const tbs = this.tribes.filter(tb => tb.team === u.team);
      if (!tbs.length) return;
      u.tribe = tbs[this.tribeIndexFor(u, tbs, tbs[0].split)];
    },
    // a blood feud between one tribe on each side: from their history if they met before, otherwise sometimes by the dice
    pickFeud() {
      if (this.N !== 2) return;
      const meet = (this.trb.history && this.trb.history.m) || {}, A = this.tribes.filter(t => t.team === 0), B = this.tribes.filter(t => t.team === 1);
      let best = null;
      for (const a of A) for (const b of B) {
        const m = meet[[a.name, b.name].sort().join('|')];
        if (m && (!best || m.at > best.m.at)) best = { a, b, m };
      }
      if (best) { best.a.feud = best.b; best.b.feud = best.a; this.feud = { a: best.a, b: best.b, last: best.m.w, n: best.m.n }; return; }
      if (this.TR.chance(this.trb.feudChance ?? 0.5)) {
        const a = A[Math.floor(this.TR.next() * A.length)], b = B[Math.floor(this.TR.next() * B.length)];
        a.feud = b; b.feud = a; this.feud = { a, b, raid: true };
      }
    },
    // the story: two short lines, the most dramatic one that is true
    makeStory() {
      const TR = this.TR, stake = STAKE[this.opts.map] || 'THE BATTLEFIELD', T = this.tribes, f = this.feud;
      const side = t => T.filter(x => x.team === t), other = tb => T.filter(x => x.team !== tb.team);
      const pickOf = list => list[Math.floor(TR.next() * list.length)];
      if (f && f.last) {
        const w = f.last === f.a.name ? f.a : f.b, l = w === f.a ? f.b : f.a;
        return { kind: 'revenge', lines: [`LAST TIME ${tName(w.name)} BEAT ${tName(l.name)}.`, `NOW ${tName(l.name)} WANT REVENGE AT ${stake}.`], hero: l, foe: w };
      }
      const streak = T.filter(t => t.rec && t.rec.s >= 2).sort((a, b) => b.rec.s - a.rec.s)[0];
      if (streak && this.N === 2) {
        const foe = pickOf(other(streak));
        return { kind: 'streak', lines: [`${tName(streak.name)} HAVE WON ${streak.rec.s} BATTLES IN A ROW.`, `${tName(foe.name)} SWEAR TO END IT AT ${stake}.`], hero: foe, foe: streak };
      }
      const under = T.filter(t => t.rec && t.rec.w === 0 && t.rec.l >= 2)[0];
      if (under) return { kind: 'underdog', lines: [`${tName(under.name)} HAVE NEVER WON A BATTLE.`, `TODAY THEY FIGHT FOR ${stake}.`], hero: under };
      if (f && f.raid) {
        const a = TR.chance(0.5) ? f.a : f.b, b = a === f.a ? f.b : f.a;
        return { kind: 'raid', lines: [`${tName(b.name)} RAIDED THE FORGE OF ${tName(a.name)}.`, `NOW THEY WANT THEIR IRON BACK AT ${stake}.`], hero: a, foe: b };
      }
      const roll = TR.next();
      if (this.N === 2 && roll < 0.35 && side(0).length > 1) {
        const s = TR.chance(0.5) ? 0 : 1, [a, c] = side(s), b = pickOf(side(1 - s));
        return { kind: 'oath', lines: [`${tName(a.name)} AND ${tName(c.name)} SWORE AN OATH OF IRON.`, `${tName(b.name)} MEAN TO BREAK IT AT ${stake}.`], hero: b };
      }
      const fresh = T.filter(t => !t.rec);
      if (roll < 0.7 && fresh.length) {
        const a = pickOf(fresh), b = pickOf(other(a));
        return { kind: 'debut', lines: [`${tName(a.name)} MARCH TO WAR FOR THE FIRST TIME.`, `${tName(b.name)} STAND IN THEIR WAY AT ${stake}.`], hero: a };
      }
      return { kind: 'stake', lines: [this.N === 3 ? 'THREE ARMIES WANT THE SAME PRIZE:' : 'BOTH ARMIES WANT THE SAME PRIZE:', `${stake}. ONLY ONE WILL HOLD IT AT SUNDOWN.`] };
    },
    // ----- the economy -----
    say(text, team) {
      this.ticker.unshift({ text, team, t: this.t });
      if (this.ticker.length > 4) this.ticker.length = 4;
    },
    // a tribe's trait only works while its chief lives
    hasTrait(tb, k) { return tb.trait === k && !tb.chiefDead; },
    nextCost(tb) { const k = this.evo ? 1 + 0.35 * tb.ups : tb.ups + 1, m = this.hasTrait(tb, 'smiths') ? 0.8 : 1; return { g: Math.round(this.econ.gold * k * m), i: Math.round(this.econ.ore * k * m) }; },
    tribeHit(u, from, dmg) {
      if (from.tribe) from.tribe.dealt += dmg;
      if (u.tribe) { u.tribe.taken += dmg; if (UNIT[from.type].ranged) u.tribe.shot += dmg; }
      if (from.tribe && u.tribe && from.tribe.feud === u.tribe && !this.feudSaid) {
        this.feudSaid = true;
        if (!this.chapter(`BLOOD FEUD: ${shortTribe(from.tribe.name)} VS ${shortTribe(u.tribe.name)}`, '#FF6B6B')) this.float(u.x, u.y - u.r - 26, 'BLOOD FEUD!', '#FF6B6B', 26, 1.2);
        this.say(`BLOOD FEUD: ${sName(from.tribe.name)} VS ${sName(u.tribe.name)}`, from.team);
        this.xf.feud = true;
      }
    },
    onDeath4(u, from) {
      const U = UNIT[u.type];
      if (U.uncounted || !this.tribes) return;
      const cost = U.cost || 1, e = this.econ, kt = from && from.tribe && from.team !== u.team ? from.tribe : null;
      // (a coin flies from the fallen troop to the killer tribe's row on the panel; looks only)
      if (kt && this.t > 7 && this.coins.length < 14 && u.team < 3) this.coins.push({ x: u.x, y: u.y, t0: this.t, tb: kt });
      if (kt) { kt.gold += e.kill * cost * (this.hasTrait(kt, 'hunters') ? 1.25 : 1); kt.kills++; if (this.t <= 7) kt.goldFx = this.t; if (u.tribe && u.tribe.wt + u.tribe.at >= 2) { kt.iron += 1; kt.ironFx = this.t; } }
      if (u.tribe) u.tribe.gold += e.chest * cost;
      if (u.tribe && u.tribe.chief === u && !u.tribe.chiefDead) {
        const tb = u.tribe, T = this.fightT; tb.chiefDead = true;
        for (const o of this.units) if (o.tribe === tb && !o.dead) o.panicT = Math.max(o.panicT || 0, T + 2.5);
        if (!this.chapter(`THE CHIEF OF ${tName(tb.name)} FALLS`, TEAMS[tb.team].c)) this.banner(`CHIEF OF ${tName(tb.name)} FALLS!`, this.foeCol(u, from), 1.8);
        this.say(`THE CHIEF OF ${tName(tb.name)} HAS FALLEN`, tb.team);
        this.xf.chiefs = (this.xf.chiefs || 0) + 1;
      }
    },
    // the quartermaster: buy armour when a tribe is taking more than it deals, weapons when it's winning its fights; trade when one resource is short
    quartermaster(tb) {
      const WM = this.wMax || 3, AM = this.aMax || 3;
      if (tb.wt >= WM && tb.at >= AM) return;
      const c = this.nextCost(tb), ratio = tb.taken / Math.max(1, tb.dealt);
      let pref = tb.kind === 'shoot' ? (ratio > 1.8 ? 'a' : 'w') : ratio > 1.15 ? 'a' : 'w';
      if (pref === 'w' && (tb.wt >= WM || (tb.wt - tb.at >= 2 && tb.at < AM))) pref = 'a';
      else if (pref === 'a' && (tb.at >= AM || (tb.at - tb.wt >= 2 && tb.wt < WM))) pref = 'w';
      if (tb.gold >= c.g && tb.iron >= c.i) { this.forge(tb, pref, c); return; }
      if (this.trb.trading !== false) this.tryTrade(tb, c);
    },
    forge(tb, which, c) {
      tb.gold -= c.g; tb.iron -= c.i; tb.ups++;
      const N = TIER_NAMES[tb.set], oldK = which === 'w' ? tb.wt : tb.at;
      if (which === 'w') { tb.wt++; this.say(`${sName(tb.name)} FORGE ${this.wName(tb, tb.wt)} ${N.noun}`, tb.team); }
      else { tb.at++; this.say(`${sName(tb.name)} PUT ON ${this.aName(tb, tb.at)}`, tb.team); }
      if (this.evo) this.evolveFx(tb, which, oldK);
      tb.forgeT = this.t; tb.forged = (tb.forged || 0) + 1; this.forges = (this.forges || 0) + 1;
      // sparks fly from a few of its troops and from the anvil at its camp
      let k = 0;
      for (const u of this.units) if (u.tribe === tb && !u.dead && k++ < 10) this.burst(u.x, u.y, which === 'w' ? '#FFB020' : '#E2E8F0', 3, 140, 0.4, 4, -40);
      this.burst(tb.camp.x, tb.camp.y, '#FFB020', 8, 200, 0.5, 5, -80);
      this.snd('pickup', { team: tb.team });
      if (which === 'w' && tb.wt === 3 && !this.evo) this.banner(`${sName(tb.name)} FORGE ${N.w[3]} ${N.noun}!`, TEAMS[tb.team].c, 1.6);
      if (which === 'w' && tb.wt === 3) { this.xf.tier3 = this.xf.tier3 || []; this.xf.tier3.push(tb.team); }
    },
    // two tribes of the same army swap iron for gold (or gold for iron) when it lets one of them forge; a cart carries the goods along the back line
    tryTrade(tb, c) {
      const T = this.fightT, sis = this.tribes.find(x => x.team === tb.team && x !== tb);
      if (!sis || T < this.tradeAt[tb.team]) return;
      const sc = this.nextCost(sis), rate = this.econ.rate;
      const price = (buyer, seller) => rate * (this.hasTrait(buyer, 'traders') ? 0.8 : 1) * (this.hasTrait(seller, 'traders') ? 1.2 : 1);
      if (tb.iron < c.i && tb.gold >= c.g) {
        // buy iron from the sister tribe
        const need = Math.ceil(c.i - tb.iron), spare = Math.floor(sis.iron - (sis.gold >= sc.g ? sc.i : 0)), p = price(tb, sis);
        if (spare >= need && tb.gold - c.g >= need * p) this.sendCart(sis, tb, need, Math.round(need * p));
      } else if (tb.gold < c.g && tb.iron >= c.i) {
        // sell spare iron to the sister tribe for gold
        const p = price(sis, tb), need = Math.ceil((c.g - tb.gold) / p), spare = Math.floor(tb.iron - c.i), sGold = sis.gold - (sis.iron >= sc.i ? sc.g : 0);
        if (spare >= need && sGold >= Math.round(need * p)) this.sendCart(tb, sis, need, Math.round(need * p));
      }
    },
    // ironFrom sends `iron` iron to buyer, who pays `gold` gold: both are set aside now and change hands when the cart arrives
    sendCart(ironFrom, buyer, iron, gold) {
      const T = this.fightT;
      ironFrom.iron -= iron; buyer.gold -= gold;
      this.carts.push({ from: ironFrom, to: buyer, iron, gold, t0: T, dur: 2, team: buyer.team });
      this.tradeAt[buyer.team] = T + (this.trb.tradeGap ?? 5);
      this.trades = (this.trades || 0) + 1;
      this.say(`${sName(ironFrom.name)} TRADE ${iron} IRON TO ${sName(buyer.name)} FOR ${gold} GOLD`, buyer.team);
    },
    // ----- the merchant caravan -----
    merchantTick() {
      const T = this.fightT, m = this.merch;
      if (!m && T >= this.merchAt) {
        const left = this.TR.chance(0.5);
        this.merch = { x: left ? AR.x + 64 : AR.x + AR.w - 64, y: AR.y + AR.h / 2, left, t0: T, end: T + 8, buyAt: this.N === 3 ? [T + 2, T + 3, T + 4] : [T + 2, T + 3.5], sold: [] };
        if (!this.chapter('THE MERCHANT ARRIVES')) this.banner('A MERCHANT ARRIVES!', COL.gold, 1.6); this.snd('bell');
        this.say('A MERCHANT CARAVAN ARRIVES', -1);
        if (this.camEv) this.camEv.push({ type: 'spot', x: this.merch.x, y: this.merch.y, prio: 60, dur: 1.4, z: 1.7 });
        return;
      }
      if (!m || m.gone) return;
      for (const team of this.teamIds()) {
        if (m.sold[team] !== undefined || T < m.buyAt[team]) continue;
        m.sold[team] = null;
        const tot = this.totals(), behind = tot[team] < Math.max(...this.teamIds().filter(t => t !== team).map(t => tot[t]));
        const off = behind ? 0.7 : 1;
        const tbs = this.tribes.filter(tb => tb.team === team && tb.n > 0).sort((a, b) => b.gold - a.gold);
        for (const tb of tbs) {
          const want = tb.wt < 2 ? 'rune' : behind ? 'swords' : 'horn';
          const order = [want, ...['rune', 'swords', 'horn'].filter(k => k !== want)];
          const item = order.find(k => tb.gold >= Math.round(MERCH_ITEMS[k].price * off));
          if (!item) continue;
          tb.gold -= Math.round(MERCH_ITEMS[item].price * off);
          this.buyItem(tb, item, behind);
          m.sold[team] = { tb, item };
          break;
        }
      }
      if (T >= m.end) { m.gone = true; this.say('THE MERCHANT MOVES ON', -1); }
    },
    itemName(tb, item) { return item === 'swords' && (tb.set === 'modern' || tb.set === 'scifi') ? 'MERCENARIES' : MERCH_ITEMS[item].name; },
    buyItem(tb, item, behind) {
      const T = this.fightT, name = this.itemName(tb, item);
      if (item === 'rune') {
        if (this.evo) { const old = tb.wt; tb.wt = Math.min(this.wMax, Math.max(tb.wt + 2, 4)); tb.forgeT = this.t; this.evolveFx(tb, 'w', old); }
        else { tb.wt = 3; tb.forgeT = this.t; }
      }
      if (item === 'horn') { tb.hornT = T + 6; this.snd('roar'); }
      if (item === 'swords') {
        const type = { modern: 'rifleman', scifi: 'trooper' }[tb.set] || (tb.era === 'pirate' ? 'pirate' : 'swordsman');
        for (let k = 0; k < 4; k++) {
          const u = this.addUnit(tb.team, type, tb.camp.x + (k - 1.5) * 26, tb.camp.y + (tb.team === 0 ? 30 : -30));
          u.tribe = tb; u.merc = true; u.face = tb.team === 0 ? Math.PI / 2 : -Math.PI / 2;
        }
        this.gained = this.gained || [0, 0, 0]; this.gained[tb.team] += 4;
      }
      this.banner(`${sName(tb.name)} BUY ${name}!`, TEAMS[tb.team].c, 1.6);
      this.say(`${sName(tb.name)} BUY ${name} FROM THE MERCHANT${behind ? ' (30% OFF)' : ''}`, tb.team);
      this.snd('powerup', { team: tb.team });
      this.xf.merchant = { team: tb.team, item, name, tribe: tb.name };
    },
    // ----- tactics -----
    tribeScan(tb) {
      let n = 0, sx = 0, sy = 0, melee = 0;
      for (const u of this.units) if (u.tribe === tb && !u.dead) { n++; sx += u.x; sy += u.y; if (!UNIT[u.type].ranged) melee++; }
      tb.n = n; tb.melee = melee;
      if (n) { tb.cx = sx / n; tb.cy = sy / n; }
    },
    decideTactic(tb) {
      const T = this.fightT, F = this.fixed || this.target;
      this.tribeScan(tb);
      if (!tb.n) { tb.tactic = 'advance'; return; }
      let near = Infinity, meleeNear = Infinity, big = null, shooters = 0, bigD = Infinity;
      for (const o of this.units) {
        if (o.dead || o.team === tb.team || o.team > 2 || UNIT[o.type].uncounted) continue;
        const O = UNIT[o.type], d = Math.hypot(o.x - tb.cx, o.y - tb.cy);
        if (d < near) near = d;
        if (!O.ranged && d < meleeNear) meleeNear = d;
        if ((O.ranged && !O.healer) || O.healer) shooters++;
        if (O.rank === 0 && d < bigD) { bigD = d; big = o; }
      }
      const ours = this.strength(tb.team), theirs = Math.max(...this.teamIds().filter(t => t !== tb.team).map(t => this.strength(t)));
      const ch = tb.chief && !tb.chief.dead ? tb.chief : null;
      let chiefThreat = 0;
      if (ch && ch.hp < ch.max * 0.5) for (const o of this.near(ch.x, ch.y, 170)) if (o.team !== tb.team && o.team < 3) chiefThreat++;
      let tac = 'advance';
      if (T > 12 && ours > theirs * 2 && tb.n >= 4) tac = 'charge';
      else if (chiefThreat >= 2 && tb.melee >= 3) tac = 'guard';
      else if (big && bigD < 280 && tb.melee >= 5) tac = 'surround';
      else if (tb.kind === 'shoot') tac = meleeNear < 190 ? 'hold' : 'focus';
      else if (tb.kind === 'ride' && T < 0.7 * F && shooters >= 3) tac = 'flank';
      else if (tb.kind === 'foot' && tb.shot > 2.5 && near > 170) tac = 'wall';
      if (tac === 'focus') this.pickFocus(tb);
      if (tac !== tb.tactic) {
        tb.tactic = tac;
        if (tac !== 'advance') this.tacLabel(tb, TAC_WORD[tac]);
        this.tacSeen = this.tacSeen || {}; this.tacSeen[tac] = (this.tacSeen[tac] || 0) + 1;
      }
    },
    // focus fire: the shooters pick one target together: an enemy shooter or healer in range, or whoever is closest to falling
    pickFocus(tb) {
      const f = tb.focus;
      if (f && !f.dead && this.fightT < (tb.focusAt || 0)) return;
      let best = null, bv = -1, rg = 0, k = 0;
      for (const u of this.units) if (u.tribe === tb && !u.dead && UNIT[u.type].ranged) { rg += UNIT[u.type].range; k++; }
      rg = k ? rg / k + 40 : 300;
      for (const o of this.units) {
        if (o.dead || o.team === tb.team || o.team > 2 || o.phased || o.cloak) continue;
        const O = UNIT[o.type], d = Math.hypot(o.x - tb.cx, o.y - tb.cy);
        if (d > rg || O.uncounted) continue;
        const threat = (O.dmg || 1) / Math.max(0.3, O.cd || 1) * (O.healer ? 2 : 1) * (O.ranged ? 1.4 : 1);
        const v = threat * (2 - o.hp / o.max) / Math.sqrt(Math.max(1, o.hp)) - d * 0.0005;
        if (v > bv) { bv = v; best = o; }
      }
      tb.focus = best; tb.focusAt = this.fightT + 3;
    },
    tacLabel(tb, text) {
      const T = this.fightT;
      if (T < (tb.labelAt || 0)) return;
      tb.labelAt = T + 4;
      this.tacLabels.push({ tb, text, t0: this.t });
      if (this.tacLabels.length > 2) this.tacLabels.shift();
    },
    tribeTarget(u, U) {
      const tb = u.tribe;
      if (tb.tactic === 'focus' && U.ranged && !U.healer && tb.focus && !tb.focus.dead && (tb.focus.x - u.x) ** 2 + (tb.focus.y - u.y) ** 2 < (U.range * 1.05) ** 2) return tb.focus;
      if (tb.tactic === 'guard' && !U.ranged && tb.chief && !tb.chief.dead && u !== tb.chief) {
        let best = null, bd = 160 * 160;
        for (const o of this.near(tb.chief.x, tb.chief.y, 160)) { if (o.team === u.team || o.team > 2 || o.phased) continue; const d = (o.x - tb.chief.x) ** 2 + (o.y - tb.chief.y) ** 2; if (d < bd) { bd = d; best = o; } }
        if (best) return best;
      }
      return null;
    },
    // how a tactic bends a troop's movement (the battle's own steering and obstacle avoidance still apply after this)
    tacMove(u, U, t, dvx, dvy) {
      this.tdx = dvx; this.tdy = dvy;
      const tb = u.tribe, T = this.fightT;
      if (U.rank === 0 || U.healer || u.duelist || U.king || u.stunT > T) return;
      const sp = U.speed * this.speedMul * (u.pace || 1) * this.spdMod(u, U);
      // regroup: a badly hurt troop falls back to a healer or its chief for a few seconds, once
      if (!u.regDone && u.hp < u.max * 0.3 && !u.chief && this.trb.tactics !== false && T > 5) {
        u.regDone = true;
        let to = null, bd = 600 * 600;
        for (const o of this.units) if (!o.dead && o.team === u.team && o !== u && (UNIT[o.type].healer || o === tb.chief)) { const d = (o.x - u.x) ** 2 + (o.y - u.y) ** 2; if (d < bd) { bd = d; to = o; } }
        if (to) { u.regT = T + 3; u.regTo = to; tb.regN = (tb.regN || 0) + 1; if (tb.regN % 3 === 0) this.tacLabel(tb, 'REGROUP'); this.xf.regroup = (this.xf.regroup || 0) + 1; }
      }
      if (u.regT > T && u.regTo && !u.regTo.dead) {
        const dx = u.regTo.x - u.x, dy = u.regTo.y - u.y, d = Math.hypot(dx, dy) || 1;
        if (d > 50) { this.tdx = dx / d * sp; this.tdy = dy / d * sp; } else { this.tdx *= 0.2; this.tdy *= 0.2; }
        return;
      }
      if (!t) return;
      const dx = t.x - u.x, dy = t.y - u.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
      switch (tb.tactic) {
        case 'wall': {
          // shield wall: keep close to the tribe and advance together
          if (U.ranged) break;
          const cx = tb.cx - u.x, cy = tb.cy - u.y, cd = Math.hypot(cx, cy) || 1;
          if (cd > 70) { const k = Math.min(1, (cd - 70) / 80) * 0.6 * sp; this.tdx += cx / cd * k; this.tdy += cy / cd * k; }
          break;
        }
        case 'flank': {
          // swing wide round the enemy line: the further the target, the wider the arc
          if (U.ranged && !U.mount) break;
          if (d > 150) { const k = clamp((d - 150) / 220, 0, 1) * 0.75 * sp, s = tb.side; this.tdx += -ny * s * k; this.tdy += nx * s * k; }
          break;
        }
        case 'hold': {
          // shooters back off from charging enemies while they keep shooting
          if (!U.ranged || U.healer) break;
          if (!UNIT[t.type].ranged && d < U.range * 0.62) { this.tdx = -nx * sp * 0.85; this.tdy = -ny * sp * 0.85; }
          break;
        }
        case 'guard': {
          const ch = tb.chief;
          if (U.ranged || !ch || ch.dead || u === ch) break;
          const cx = ch.x - u.x, cy = ch.y - u.y, cd = Math.hypot(cx, cy) || 1;
          if (cd > 60 && cd < 360 && d - u.r - t.r > (U.reach || 10) + 30) { this.tdx = cx / cd * sp; this.tdy = cy / cd * sp; }
          break;
        }
        case 'surround': {
          // spread round a big enemy instead of piling up on one side
          if (U.ranged || UNIT[t.type].rank !== 0 || d > 320) break;
          if (u.slot === undefined) u.slot = (this.slotN = (this.slotN || 0) + 1) % 8;
          const a = u.slot / 8 * TAU, px = t.x + Math.cos(a) * (t.r + u.r + 6), py = t.y + Math.sin(a) * (t.r + u.r + 6);
          const qx = px - u.x, qy = py - u.y, qd = Math.hypot(qx, qy) || 1;
          if (qd > 14 && d - u.r - t.r > (U.reach || 10)) { this.tdx = qx / qd * sp; this.tdy = qy / qd * sp; }
          break;
        }
      }
    },
    // damage dealt and taken, with the forge tiers, the feud, the war horn, zealots, stoneskin and the shield wall
    tribeOut(u, from) {
      const tb = from.tribe;
      if (!tb) return 1;
      let k = 1 + 0.1 * tb.wt;
      if (tb.feud && u.tribe === tb.feud) k *= 1.1;
      if (this.hasTrait(tb, 'zealots')) k *= 1.08;
      if (tb.hornT > this.fightT) k *= 1.3;
      return k;
    },
    tribeIn(u, from) {
      const tb = u.tribe;
      if (!tb) return 1;
      let d = 1 - 0.08 * tb.at;
      if (this.hasTrait(tb, 'stoneskin')) d *= 0.92;
      if (tb.tactic === 'wall' && from && UNIT[from.type].ranged && (u.x - tb.cx) ** 2 + (u.y - tb.cy) ** 2 < 130 * 130) d *= 0.85;
      return d;
    },
    tribeSpd(u) {
      const tb = u.tribe, T = this.fightT;
      if (!tb) return 1;
      let k = 1;
      if (tb.hornT > T) k *= 1.3;
      if (tb.tactic === 'charge') k *= 1.12;
      else if (tb.tactic === 'wall' && !UNIT[u.type].ranged) k *= 0.88;
      if (u.regT > T) k *= 1.1;
      return k;
    },
    postStep4(h) {
      if (!this.tribes || this.phase !== 'fight') return;
      const T = this.fightT, e = this.econ, dk = Math.exp(-h / 6), sk = Math.exp(-h / 4);
      for (const tb of this.tribes) {
        tb.dealt *= dk; tb.taken *= dk; tb.shot *= sk;
        // the camp digs iron while the tribe still has troops
        if (tb.n > 0) tb.iron += h / e.iron * (this.hasTrait(tb, 'miners') ? 1.6 : 1);
        if (this.trb.economy !== false && T >= tb.qmAt) { tb.qmAt = T + 2; this.quartermaster(tb); }
        if (T >= tb.tacAt) { tb.tacAt = T + 1.5; if (this.trb.tactics !== false) this.decideTactic(tb); else this.tribeScan(tb); }
      }
      // carts arriving at the other camp
      if (this.carts.length) {
        for (const c of this.carts) if (!c.done && T >= c.t0 + c.dur) {
          c.done = true; c.to.iron += c.iron; c.from.gold += c.gold;
          c.to.ironFx = this.t; c.from.goldFx = this.t; this.snd('pickup', { team: c.team });
        }
        this.carts = this.carts.filter(c => !c.done || T < c.t0 + c.dur + 0.4);
      }
      if (this.trb.merchant !== false) this.merchantTick();
    },
    // ----- facts for titles, the description and the chronicle -----
    tribeFacts() {
      if (!this.tribes) return null;
      const w = this.winner, hist = (this.trb.history && this.trb.history.t) || {};
      const lead = w >= 0 ? this.tribes.filter(t => t.team === w).sort((a, b) => b.kills - a.kills)[0] : null;
      const out = { story: this.story && { kind: this.story.kind, text: this.story.lines.join(' ') }, stake: STAKE[this.opts.map] || 'THE BATTLEFIELD',
        tribes: this.tribes.map(t => ({ name: t.name, era: t.era, team: t.team, kills: t.kills, wt: t.wt, at: t.at, trait: t.trait, emblem: t.emblem, chief: t.chief ? !t.chief.dead : undefined })),
        forges: this.forges || 0, trades: this.trades || 0, merchant: this.xf.merchant || null, feud: this.feud ? [this.feud.a.name, this.feud.b.name] : null };
      if (lead) {
        const r = hist[lead.name] || { w: 0, l: 0, s: 0 }, wins = r.w + 1, streak = r.s > 0 ? r.s + 1 : 1;
        const f = this.feud, revenge = !!(f && f.last && (f.a === lead || f.b === lead) && f.last !== lead.name && this.story && this.story.kind === 'revenge');
        const N = TIER_NAMES[lead.set];
        out.lead = { name: lead.name, team: lead.team, kills: lead.kills, wins, streak, firstWin: r.w === 0 && r.l > 0, debut: !r.w && !r.l, revenge,
          weapon: lead.wt >= 3 ? `${this.wName ? this.wName(lead, lead.wt) : N.w[3]} ${N.noun}` : null, chiefLost: !!lead.chiefDead, set: lead.set };
        const bits = [], st = this.story;
        if (revenge) bits.push('REVENGE!');
        else if (st && st.kind === 'revenge' && st.foe && st.foe.team === lead.team) bits.push('REVENGE DENIED');
        else if (st && st.kind === 'streak' && st.foe && st.foe.team !== lead.team) bits.push('STREAK ENDED');
        if (out.lead.firstWin) bits.push('FIRST EVER WIN');
        else if (streak >= 3) bits.push(`${streak} WINS IN A ROW`);
        else if (wins >= 2) bits.push(`${ORD(wins)} WIN`);
        else bits.push('FIRST BATTLE, FIRST WIN');
        bits.push(`${lead.kills} KILLS`);
        out.chron = [`${tName(lead.name)} TAKE ${out.stake}`, bits.join(' · ')];
      } else out.chron = [`NOBODY TAKES ${out.stake}`, 'THE FEUD GOES ON'];
      return out;
    },
  };
  // ----- living tribes: drawing -----
  const ARMY_TRIBES_DRAW = {
    // the camps (anvil, fire and the tribe banner), trade carts and the merchant's wagon, on the ground under the troops
    drawCamps(ctx) {
      const t = this.t;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (const tb of this.tribes) {
        const { x, y } = tb.camp, tm = TEAMS[tb.team];
        ctx.beginPath(); ctx.ellipse(x, y + 8, 34, 11, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
        // fire
        const fl = 1 + 0.12 * Math.sin(t * 13 + tb.id), fx = x + 18;
        ctx.beginPath(); ctx.moveTo(fx, y - 14 * fl); ctx.quadraticCurveTo(fx + 9, y - 2, fx + 5, y + 5); ctx.lineTo(fx - 5, y + 5); ctx.quadraticCurveTo(fx - 9, y - 2, fx, y - 14 * fl);
        ctx.fillStyle = '#FF8A1F'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = COL.ink; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(fx, y - 7 * fl); ctx.quadraticCurveTo(fx + 4, y, fx + 2, y + 4); ctx.lineTo(fx - 2, y + 4); ctx.quadraticCurveTo(fx - 4, y, fx, y - 7 * fl); ctx.fillStyle = '#FFD23F'; ctx.fill();
        // anvil
        ctx.beginPath(); ctx.moveTo(x - 20, y - 7); ctx.lineTo(x + 7, y - 7); ctx.lineTo(x + 7, y - 2); ctx.lineTo(x + 1, y); ctx.lineTo(x + 3, y + 6); ctx.lineTo(x - 13, y + 6); ctx.lineTo(x - 11, y); ctx.lineTo(x - 15, y - 2); ctx.closePath();
        ctx.fillStyle = '#3F4650'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = COL.ink; ctx.stroke();
        if (t - tb.forgeT < 0.6) { ctx.beginPath(); ctx.arc(x - 6, y - 7, 6 + 30 * (t - tb.forgeT), 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,176,32,${1 - (t - tb.forgeT) / 0.6})`; ctx.stroke(); }
        // banner pole with the tribe flag
        const px = x - 28, top = y - 34;
        ctx.lineWidth = 4; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(px, y + 4); ctx.lineTo(px, top); ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = '#D9B26F'; ctx.stroke();
        this.tribeFlag(ctx, tb, px, top, 24, 17);
      }
      // carts carrying iron between two camps of the same army
      for (const c of this.carts) {
        const k = clamp((this.fightT - c.t0) / c.dur, 0, 1), a = c.from.camp, b = c.to.camp;
        const x = a.x + (b.x - a.x) * easeOutCubic(k * 0.999), y = a.y + (b.y - a.y) * k + Math.sin(k * 30) * 1.2 + (c.team === 0 ? 16 : -16);
        ctx.globalAlpha = c.done ? clamp(1 - (this.fightT - c.t0 - c.dur) / 0.4, 0, 1) : 1;
        disc(ctx, x - 8, y + 8, 4.5, '#2A2D33', 2); disc(ctx, x + 8, y + 8, 4.5, '#2A2D33', 2);
        roundRect(ctx, x - 13, y - 5, 26, 13, 3); ctx.fillStyle = '#8B5A2B'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = COL.ink; ctx.stroke();
        ctx.fillStyle = '#9AA3AD'; ctx.fillRect(x - 9, y - 10, 8, 5); ctx.fillRect(x - 2, y - 11, 8, 6); ctx.strokeRect(x - 9, y - 10, 8, 5); ctx.strokeRect(x - 2, y - 11, 8, 6);
        disc(ctx, x + 9, y - 8, 3.5, COL.gold, 1.5);
        ctx.globalAlpha = 1;
      }
      // the merchant's covered wagon, pulled by a mule
      const m = this.merch;
      if (m && this.fightT < m.end + 0.8) {
        const k = easeOutCubic((this.fightT - m.t0) / 0.8), out = clamp((this.fightT - m.end) / 0.8, 0, 1), dir = m.left ? 1 : -1;
        const x = m.x - dir * 140 * (1 - k) - dir * 140 * out, y = m.y;
        ctx.globalAlpha = 1 - out;
        ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
        ctx.beginPath(); ctx.ellipse(0, 18, 46, 10, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
        // mule
        ctx.beginPath(); ctx.ellipse(36, 6, 13, 8, 0, 0, TAU); ctx.fillStyle = '#7A6A58'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = COL.ink; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(50, 0, 7, 5, -0.4, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(48, -4); ctx.lineTo(46, -12); ctx.moveTo(52, -4); ctx.lineTo(53, -12); ctx.lineWidth = 3; ctx.stroke();
        // wagon with a canvas cover
        disc(ctx, -16, 14, 7, '#2A2D33', 2.5); disc(ctx, 14, 14, 7, '#2A2D33', 2.5);
        roundRect(ctx, -28, -4, 54, 18, 3); ctx.fillStyle = '#8B5A2B'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = COL.ink; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-26, -4); ctx.bezierCurveTo(-26, -30, 24, -30, 24, -4); ctx.closePath(); ctx.fillStyle = '#EDE6D6'; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-10, -22); ctx.moveTo(8, -4); ctx.lineTo(8, -22); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(4,6,11,0.35)'; ctx.stroke();
        ctx.restore();
        // a coin sign so it reads as a shop
        disc(ctx, x, y - 36, 10, COL.gold, 2.5);
        ctx.font = font(14, 800, false); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = COL.ink; ctx.fillText('$', x, y - 35.5);
        ctx.globalAlpha = 1;
      }
    },
    tribeFlag(ctx, tb, x, y, w, h) {
      const tm = TEAMS[tb.team];
      ctx.save(); ctx.translate(x, y); ctx.transform(1, Math.sin(this.t * 6 + tb.id) * 0.1, 0, 1, 0, 0);
      ctx.fillStyle = tm.c; ctx.fillRect(0, 0, w, h); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.strokeRect(0, 0, w, h);
      drawEmblem(ctx, tb.emblem, w / 2, h / 2, h * 0.38);
      ctx.restore();
    },
    // over the troops: forged weapon glints, armour on the shoulders, hired swords' grey cloaks, chief banners, focus marks and tactic calls
    drawTribeFx(ctx, list) {
      const t = this.t, T = this.fightT;
      const glints = new Map(), arcs = new Map();
      const add = (m, k, v) => { let a = m.get(k); if (!a) m.set(k, a = []); a.push(v); };
      for (const u of list) {
        const tb = u.tribe;
        if (!tb || u.dead || u.fade === 0) continue;
        const U = UNIT[u.type];
        if (U.rank === 0 || U.uncounted) continue;
        if (this.evo) continue; // (the evolved looks are drawn by drawEvolved)
        if (tb.wt > 0) add(glints, tb.wt === 3 ? W_TOP[tb.set] : W_COL[tb.wt], u);
        if (tb.at > 0) add(arcs, A_COL[tb.at], u);
      }
      ctx.lineCap = 'round';
      // armour: a metal arc on the shoulders (the back half of the body)
      for (const [col, us] of arcs) {
        ctx.beginPath();
        for (const u of us) { const a = u.face + Math.PI; ctx.moveTo(u.x + Math.cos(a - 0.85) * (u.r - 1), u.y + Math.sin(a - 0.85) * (u.r - 1)); ctx.arc(u.x, u.y, u.r - 1, a - 0.85, a + 0.85); }
        ctx.lineWidth = 6; ctx.strokeStyle = COL.ink; ctx.stroke(); ctx.lineWidth = 3.2; ctx.strokeStyle = col; ctx.stroke();
      }
      // weapons: a glint at the weapon in the tier's colour; the top tier glows
      for (const [col, us] of glints) {
        const top = col !== W_COL[1] && col !== W_COL[2];
        if (top) {
          ctx.beginPath();
          for (const u of us) { const gx = u.x + Math.cos(u.face) * (u.r + 8), gy = u.y + Math.sin(u.face) * (u.r + 8); ctx.moveTo(gx + 9, gy); ctx.arc(gx, gy, 9, 0, TAU); }
          ctx.globalAlpha = 0.28; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
        }
        ctx.beginPath();
        for (const u of us) {
          const gx = u.x + Math.cos(u.face) * (u.r + 8), gy = u.y + Math.sin(u.face) * (u.r + 8), s = (top ? 5.5 : col === W_COL[2] ? 4.5 : 3.6) * (0.8 + 0.2 * Math.sin(t * 9 + u.gait));
          ctx.moveTo(gx, gy - s); ctx.lineTo(gx + s * 0.45, gy); ctx.lineTo(gx, gy + s); ctx.lineTo(gx - s * 0.45, gy); ctx.closePath();
          ctx.moveTo(gx - s, gy); ctx.lineTo(gx, gy - s * 0.4); ctx.lineTo(gx + s, gy); ctx.lineTo(gx, gy + s * 0.4); ctx.closePath();
        }
        ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke(); ctx.fillStyle = col; ctx.fill();
      }
      // forge flash and hired swords
      for (const tb of this.tribes) {
        const k = this.evo ? -1 : (t - tb.forgeT) / 0.6;
        if (k < 0 || k > 1) continue;
        ctx.beginPath();
        for (const u of list) if (u.tribe === tb && !u.dead) { ctx.moveTo(u.x + u.r + 5, u.y); ctx.arc(u.x, u.y, u.r + 5, 0, TAU); }
        ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,176,32,${0.9 * (1 - k)})`; ctx.stroke();
      }
      ctx.beginPath(); let mercs = 0;
      for (const u of list) if (u.merc && !u.dead) { mercs++; const a = u.face + Math.PI; ctx.moveTo(u.x + Math.cos(a - 1.6) * (u.r + 2), u.y + Math.sin(a - 1.6) * (u.r + 2)); ctx.arc(u.x, u.y, u.r + 2, a - 1.6, a + 1.6); }
      if (mercs) { ctx.lineWidth = 7; ctx.strokeStyle = COL.ink; ctx.stroke(); ctx.lineWidth = 4.5; ctx.strokeStyle = '#8A8F98'; ctx.stroke(); }
      // chiefs carry their tribe's banner
      for (const tb of this.tribes) {
        const u = tb.chief;
        if (!u || u.dead) continue;
        const px = u.x + u.r * 0.55, top = u.y - u.r - 30;
        ctx.lineWidth = 4.5; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(px, u.y); ctx.lineTo(px, top); ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = '#D9B26F'; ctx.stroke();
        this.tribeFlag(ctx, tb, px, top, 28, 20);
      }
      // focus fire: a reticle on the shared target
      for (const tb of this.tribes) {
        const f = tb.focus;
        if (tb.tactic !== 'focus' || !f || f.dead) continue;
        const r = f.r + 10, a0 = t * 2;
        ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = TEAMS[tb.team].l; ctx.globalAlpha = 0.85; ctx.stroke();
        ctx.beginPath();
        for (let k = 0; k < 4; k++) { const a = a0 + k * Math.PI / 2; ctx.moveTo(f.x + Math.cos(a) * (r - 5), f.y + Math.sin(a) * (r - 5)); ctx.lineTo(f.x + Math.cos(a) * (r + 7), f.y + Math.sin(a) * (r + 7)); }
        ctx.lineWidth = 3; ctx.stroke(); ctx.globalAlpha = 1;
      }
      // tactic calls: a tag with the tribe's emblem over the middle of the tribe (stacked so two tags never overlap)
      const placed = [];
      for (const L of this.tacLabels) {
        const k = (t - L.t0) / 1.8;
        if (k < 0 || k > 1) continue;
        const tb = L.tb, al = Math.min(1, k * 6, (1 - k) * 4), text = `${L.text}!`;
        ctx.font = font(21, 800);
        const w = ctx.measureText(text).width + 50, x = clamp(tb.cx, AR.x + w / 2 + 6, AR.x + AR.w - w / 2 - 6);
        let y = clamp(tb.cy - 46 - k * 10, AR.y + 24, AR.y + AR.h - 24);
        for (let tries = 0; tries < 4 && placed.some(p => Math.abs(p.x - x) < (p.w + w) / 2 + 6 && Math.abs(p.y - y) < 40); tries++) y = clamp(y - 42, AR.y + 24, AR.y + AR.h - 24) === y ? y + 42 : clamp(y - 42, AR.y + 24, AR.y + AR.h - 24);
        placed.push({ x, y, w });
        ctx.globalAlpha = al;
        roundRect(ctx, x - w / 2, y - 17, w, 34, 17); ctx.fillStyle = 'rgba(8,11,20,0.88)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = TEAMS[tb.team].c; ctx.stroke();
        disc(ctx, x - w / 2 + 17, y, 13, TEAMS[tb.team].c, 2); drawEmblem(ctx, tb.emblem, x - w / 2 + 17, y, 9.5);
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = COL.gold; ctx.fillText(text, x - w / 2 + 36, y + 1);
        ctx.globalAlpha = 1;
      }
      ctx.textBaseline = 'alphabetic';
    },
    // ----- the war council: the story, then each tribe's gold, iron, forge tiers and tactic, and a ticker of what just happened -----
    // (in the empty space under the battle timer, so it never covers the fight)
    // layout boxes of the overlays drawn this frame (read by check-layout.js to catch overlaps)
    layReset() { if (this.layAt !== this.t || !this.lay) { this.layAt = this.t; this.lay = []; } },
    drawCouncil(ctx) {
      if (!this.tribes) return;
      const t = this.t, top = 1606, x0 = 30, W = VW - 60;
      this.layReset();
      ctx.save();
      const storyEnd = 6.6, inK = clamp((t - storyEnd) / 0.5, 0, 1);
      if (this.phase === 'outro' && this.outroT > 1.2) { this.drawChronicle(ctx, clamp((this.outroT - 1.2) / 0.5, 0, 1)); ctx.restore(); return; }
      if (t < storyEnd + 0.4 && this.story) this.drawStory(ctx, Math.min(clamp((t - 0.3) / 0.3, 0, 1), clamp((storyEnd + 0.4 - t) / 0.4, 0, 1)));
      if (inK > 0) {
        ctx.globalAlpha = inK;
        const cols = this.N === 3 ? 3 : 2, per = this.N === 3 ? 1 : this.tribes.length / 2, cw = (W - (cols - 1) * 16) / cols, rh = this.N === 3 ? 124 : 92;
        for (const tb of this.tribes) {
          const col = this.N === 3 ? tb.team : tb.team, x = x0 + col * (cw + 16), y = top + tb.idx * (rh + 8) + (per === 1 && this.N !== 3 ? 50 : 0);
          this.drawTribeRow(ctx, tb, x, y, cw, rh);
        }
        // the ticker: the latest two things that happened
        const ty = this.N === 3 ? top + rh + 34 : top + 2 * (rh + 8) + 26;
        this.ticker.slice(0, 2).forEach((e, i) => {
          const a = clamp((t - e.t) / 0.25, 0, 1);
          ctx.globalAlpha = inK * a * (i ? 0.55 : 1);
          this.fitText(ctx, e.text, VW / 2, ty + i * 32, W - 20, i ? 19 : 22, 800, false, i ? COL.muted : e.team >= 0 ? TEAMS[e.team].l : COL.gold, 'center', 18);
        });
        ctx.globalAlpha = 1;
        this.drawCoins(ctx);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      ctx.textBaseline = 'alphabetic';
    },
    // text that shrinks to fit its space (never squashed, never under `min` pixels), recorded for the layout check
    fitText(ctx, text, x, y, maxW, size, weight, italic, color, align = 'left', min = 16) {
      let s = size;
      ctx.font = font(s, weight, italic);
      while (s > min && ctx.measureText(text).width > maxW) { s -= 1; ctx.font = font(s, weight, italic); }
      const nat = ctx.measureText(text).width, w = Math.min(nat, maxW);
      ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
      ctx.fillText(text, x, y, maxW);
      const lx = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
      if (this.lay) this.lay.push({ kind: 'text', x: lx, y: y - s * 0.5 + (this.layDY || 0), w, h: s, text, size: s, squash: nat > maxW + 0.5 });
      return s;
    },
    drawTribeRow(ctx, tb, x, y, w, h) {
      const tm = TEAMS[tb.team], t = this.t, dead = !tb.n && this.phase === 'fight' && this.fightT > 1, a0 = ctx.globalAlpha;
      roundRect(ctx, x, y, w, h, 14); ctx.fillStyle = '#0A0E19'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = dead ? 'rgba(255,255,255,0.08)' : rgba(tm.c, 0.55); ctx.stroke();
      ctx.globalAlpha = a0 * (dead ? 0.45 : 1);
      const narrow = w < 400, er = narrow ? 24 : 28, ex = x + 14 + er, ey = narrow ? y + 14 + er : y + h / 2;
      disc(ctx, ex, ey, er, tm.c, 3); drawEmblem(ctx, tb.emblem, ex, ey, er * 0.74);
      this.lay.push({ kind: 'circle', x: ex - er, y: ey - er, w: er * 2, h: er * 2 });
      const tx = ex + er + 12, right = x + w - 12;
      // (panel text is never smaller than 18 px: long tactic names have a short form, and a long tribe name in a narrow row takes two lines)
      let tac = this.fightT > 0.5 && tb.n ? TAC_WORD[tb.tactic] : '';
      ctx.font = font(18, 800, false);
      const tacMax = narrow ? right - tx : 160;
      if (tac && ctx.measureText(tac).width > tacMax) tac = TAC_SHORT[tb.tactic];
      const tacW = tac ? Math.min(ctx.measureText(tac).width, tacMax) : 0;
      let ly;
      if (narrow) {
        // three-way rows: the name (one or two lines) and the tactic beside the emblem, then the resources and tiers across the row
        const name = sName(tb.name);
        ctx.font = font(18, 800);
        if (ctx.measureText(name).width <= right - tx) { this.fitText(ctx, name, tx, y + 26, right - tx, 21, 800, true, tm.l, 'left', 18); }
        else {
          const ws = name.split(' '); let best = 1, bw = Infinity;
          for (let k = 1; k < ws.length; k++) { const m = Math.max(ctx.measureText(ws.slice(0, k).join(' ')).width, ctx.measureText(ws.slice(k).join(' ')).width); if (m < bw) { bw = m; best = k; } }
          this.fitText(ctx, ws.slice(0, best).join(' '), tx, y + 20, right - tx, 18, 800, true, tm.l, 'left', 18);
          this.fitText(ctx, ws.slice(best).join(' '), tx, y + 40, right - tx, 18, 800, true, tm.l, 'left', 18);
        }
        if (tac) this.fitText(ctx, tac, tx, y + 64, tacMax, 18, 800, false, COL.gold, 'left', 18);
        ly = y + h - 24;
      } else {
        this.fitText(ctx, sName(tb.name), tx, y + 27, right - tx - tacW - 14, 24, 800, true, tm.l, 'left', 18);
        if (tac) this.fitText(ctx, tac, right, y + 27, tacMax, 18, 800, false, COL.gold, 'right', 18);
        ly = y + 63;
      }
      // the resources and tiers: gold, iron, weapon pips (a sword) and armour pips (a shield), then the trait if there's room
      const gf = clamp(1 - (t - tb.goldFx) / 0.4, 0, 1), irf = clamp(1 - (t - tb.ironFx) / 0.4, 0, 1);
      const cx0 = narrow ? x + 16 : tx;
      tb.coinAt = { x: cx0 + 9, y: ly };
      disc(ctx, cx0 + 9, ly, 9 + gf * 2, COL.gold, 2);
      ctx.font = font(13, 800, false); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#7A5A00'; ctx.fillText('G', cx0 + 9, ly + 0.5);
      this.fitText(ctx, String(Math.floor(tb.gold)), cx0 + 23, ly, 42, 22, 800, true, gf > 0 ? COL.gold : COL.white, 'left', 18);
      const ix = cx0 + 70;
      ctx.beginPath(); ctx.moveTo(ix - 1, ly + 7); ctx.lineTo(ix + 3, ly - 5); ctx.lineTo(ix + 15, ly - 5); ctx.lineTo(ix + 19, ly + 7); ctx.closePath();
      ctx.fillStyle = irf > 0 ? '#DCE5EE' : '#9AA3AD'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke();
      this.fitText(ctx, String(Math.floor(tb.iron)), ix + 24, ly, 36, 22, 800, true, COL.white, 'left', 18);
      const px = ix + 66;
      const pip = (cx, filled, colr) => { ctx.beginPath(); ctx.arc(cx, ly, 6, 0, TAU); ctx.fillStyle = filled ? colr : 'rgba(255,255,255,0.12)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = COL.ink; ctx.stroke(); };
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px, ly + 8); ctx.lineTo(px + 10, ly - 8); ctx.lineWidth = 4.5; ctx.strokeStyle = COL.ink; ctx.stroke(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#E2E8F0'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px - 1, ly + 1); ctx.lineTo(px + 6, ly + 5); ctx.lineWidth = 2.5; ctx.strokeStyle = '#D9B26F'; ctx.stroke();
      for (let k = 1; k <= 3; k++) pip(px + 6 + k * 15, tb.wt >= k, k === 3 ? W_TOP[tb.set] : k === 2 ? '#E2E8F0' : W_COL[1]);
      const sx = px + 76;
      ctx.beginPath(); ctx.moveTo(sx - 6, ly - 7); ctx.lineTo(sx + 6, ly - 7); ctx.lineTo(sx + 6, ly); ctx.quadraticCurveTo(sx + 5, ly + 6, sx, ly + 8); ctx.quadraticCurveTo(sx - 5, ly + 6, sx - 6, ly); ctx.closePath();
      ctx.fillStyle = '#9AA3AD'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke();
      for (let k = 1; k <= 3; k++) pip(sx + 6 + k * 15, tb.at >= k, A_COL[k]);
      this.lay.push({ kind: 'coin', x: cx0 - 2, y: ly - 11, w: 22, h: 22 }, { kind: 'ingot', x: ix - 2, y: ly - 6, w: 23, h: 14 },
        { kind: 'weapon pips', x: px - 2, y: ly - 9, w: 6 + 3 * 15 + 9, h: 18 }, { kind: 'armour pips', x: sx - 7, y: ly - 8, w: 13 + 3 * 15 + 6, h: 17 });
      const trX = sx + 6 + 3 * 15 + 18;
      // the trait, or that it's gone with the chief
      const trait = tb.chiefDead ? 'NO CHIEF' : TRAIT[tb.trait].name;
      ctx.font = font(18, 700, false);
      if (ctx.measureText(trait).width <= right - trX) this.fitText(ctx, trait, right, ly, right - trX, 18, 700, false, tb.chiefDead ? '#FF8A8A' : COL.muted, 'right', 18);
      ctx.globalAlpha = a0;
    },
    // loot: coins fly in an arc from where a troop fell (through the camera) to its killer tribe's gold on the panel
    drawCoins(ctx) {
      const t = this.t, c = this.cam, zoom = this.camOn();
      const dy = this.opts.ui >= 2 ? UI_DY : 0, scr = (x, y) => (zoom ? [AR.x + (x - c.x) * c.z + AR.w / 2, AR.y + (y - c.y) * c.z + AR.h / 2 + dy] : [x, y + dy]);
      this.coins = this.coins.filter(o => {
        const k = (t - o.t0) / 0.75;
        if (k >= 1) { o.tb.goldFx = t; return false; }
        if (!o.tb.coinAt) return true;
        if (o.sx === undefined) [o.sx, o.sy] = scr(o.x, o.y);
        const e = easeOutCubic(k), x = o.sx + (o.tb.coinAt.x - o.sx) * e, y = o.sy + (o.tb.coinAt.y - o.sy) * k * k - Math.sin(Math.PI * k) * 90;
        disc(ctx, x, y, 6.5, COL.gold, 2);
        return true;
      });
    },
    drawStory(ctx, al) {
      const t = this.t, s = this.story, W = VW - 80, n = Math.max(0, Math.floor((t - 0.4) * 34));
      ctx.globalAlpha = al;
      ctx.font = font(19, 700, false); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = COL.muted;
      spaced(ctx, 6); ctx.fillText('THE STORY', VW / 2, 1636); spaced(ctx, 0);
      this.lay.push({ kind: 'text', x: VW / 2 - 70, y: 1626.5, w: 140, h: 19, text: 'THE STORY', size: 19 });
      let used = 0;
      s.lines.forEach((ln, i) => {
        const shown = ln.slice(0, Math.max(0, n - used)); used += ln.length;
        // size the line for its full text, so it never changes size while it types out
        let size = 30; ctx.font = font(size, 800);
        while (size > 18 && ctx.measureText(ln).width > W) { size--; ctx.font = font(size, 800); }
        const full = ctx.measureText(ln).width, y = 1688 + i * 50;
        ctx.textAlign = 'left'; ctx.fillStyle = i ? COL.gold : COL.white;
        ctx.fillText(shown, VW / 2 - full / 2, y);
        this.lay.push({ kind: 'text', x: VW / 2 - full / 2, y: y - size * 0.5, w: full, h: size, text: ln, size, squash: full > W + 0.5 });
      });
      ctx.globalAlpha = 1;
    },
    drawChronicle(ctx, al) {
      const f = this._tf || (this._tf = this.tribeFacts()), W = VW - 80;
      if (!f) return;
      ctx.globalAlpha = al;
      const lead = this.winner >= 0 ? TEAMS[this.winner] : null;
      const sz1 = this.fitText(ctx, f.chron[0], VW / 2, 1680, W, 34, 800, true, lead ? lead.l : COL.white, 'center', 18);
      this.fitText(ctx, f.chron[1], VW / 2, 1680 + sz1 * 0.6 + 34, W, 28, 800, true, COL.gold, 'center', 18);
      // the winning tribes' forge, in small type
      const ws = this.tribes.filter(tb => tb.team === this.winner);
      if (ws.length) {
        const N = TIER_NAMES[ws[0].set], line = ws.map(tb => `${sName(tb.name)}: ${this.wName(tb, tb.wt)} ${N.noun.toLowerCase()}, ${tb.at ? this.aName(tb, tb.at).toLowerCase() : 'no armour'}`).join('   ·   ');
        this.fitText(ctx, line.toUpperCase(), VW / 2, 1800, W, 19, 700, false, COL.muted, 'center', 18);
      }
      ctx.globalAlpha = 1;
    },
  };
  // ----- UI 2.0 (rules.ui.layout = 2): a phone-safe layout -----
  // YouTube draws its buttons and text over a Short: search and menu icons in the top corners, the title and channel name over
  // the bottom ~360 px, and the like/comment/share column over the right ~140 px from about mid-screen down. So the scoreboard
  // sits at the top (with the battle clock in the centre), the battlefield is drawn 90 px higher, and the tribes' strip sits
  // just under it, above YouTube's title. The simulation itself doesn't move: only where it's drawn.
  const UI_DY = -90;
  // art finish: troops that aren't round bodies (vehicles, beasts, odd shapes) get no rim highlight; plain troops get faces
  const GLOSS_SKIP = new Set(['archer', 'tank', 'mech', 'cannon', 'turret', 'golem', 'decoy', 'thousandman', 'livingblade', 'catapult', 'fortress', 'castle', 'cathedral', 'livingfortress', 'drone', 'wisp', 'hourglass', 'theplayer', 'turtle', 'universe']);
  const FACELESS = new Set(['soldier', 'swordsman', 'spearman', 'crossbowman', 'berserker', 'shieldbearer']);
  const SAFE = { x0: 48, x1: 1032, top: 60, bottom: 1560, btnX: 940, btnY0: 900 };
  const shortTribe = n => n.replace(/^THE /, '').replace(/^(ORDER|HOUSE|CREW) OF THE /, '').replace(/ (CLAN|COMPANY|TRIBE|KIN|CIRCLE|SCHOOL|ORDER)$/, '');
  const ARMY_UI2 = {
    // the scoreboard: logo, hook, both armies' names and live counts, the battle clock in the centre pill, and the strength bar
    drawHUD2(ctx) {
      const t = this.t, L = this.alive[0] + this.reserve[0], R = this.alive[1] + this.reserve[1];
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
      ctx.font = font(this.title.length > 15 ? 58 : 64, 800); spaced(ctx, 2); ctx.fillStyle = COL.white; ctx.fillText(this.title, VW / 2, 126);
      ctx.font = font(28, 700, false); spaced(ctx, 6); ctx.fillStyle = COL.gold; ctx.fillText(this.hook, VW / 2, 170, 760);
      // smooth counts: the shown number eases toward the real one
      this.hudN = this.hudN || [L, R];
      this.hudN = [L, R].map((v, i) => (Math.abs(v - this.hudN[i]) < 0.5 ? v : this.hudN[i] + (v - this.hudN[i]) * 0.35));
      for (let i = 0; i < 2; i++) {
        const tm = TEAMS[i], x = i ? VW - 96 : 96, al = i ? 'right' : 'left';
        ctx.textAlign = al;
        spaced(ctx, 3); ctx.font = font(32, 800); ctx.fillStyle = tm.c; ctx.fillText(tm.name, x, 224, 300);
        spaced(ctx, 0); ctx.font = font(104, 800); ctx.fillStyle = COL.white; ctx.fillText(String(Math.round(this.hudN[i])), x, 324);
        const lab = `${this.skins ? this.skinName(i) : ''}${docLabel(this.doc[i])}`;
        spaced(ctx, 2); ctx.font = font(22, 700, false); ctx.fillStyle = COL.muted; ctx.fillText(lab, x, 358, 300); spaced(ctx, 0);
        if (hasFlag(tm)) drawFlag(ctx, tm.key, i ? VW - 96 - 160 - 84 : 96 + 160, 262, 84, 56, 3);
      }
      // the clock pill
      const px = VW / 2, py = 282, pw = 196, ph = 90, urgent = this.phase === 'fight' && this.cap - this.fightT < 10;
      ctx.font = font(24, 800); spaced(ctx, 4); ctx.textAlign = 'center'; ctx.fillStyle = COL.muted; ctx.fillText('VS', px, 224); spaced(ctx, 0);
      roundRect(ctx, px - pw / 2, py - ph / 2, pw, ph, ph / 2); ctx.fillStyle = '#121A2D'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = urgent ? COL.gold : COL.frame; ctx.stroke();
      const pulse = urgent ? 1 + 0.06 * Math.max(0, Math.cos((t % 1) * Math.PI)) : 1;
      ctx.save(); ctx.translate(px, py + 22); ctx.scale(pulse, pulse);
      ctx.font = font(62, 800); ctx.fillStyle = urgent ? COL.gold : COL.white; ctx.fillText(fmtTime(this.fightT), 0, 0);
      ctx.restore();
      this.drawBar2(ctx, [this.dispRatio, 1 - this.dispRatio]);
    },
    drawBar2(ctx, shares) {
      const bx = 96, by = 374, bw = VW - 192, bh = 16;
      ctx.save(); roundRect(ctx, bx, by, bw, bh, bh / 2); ctx.clip();
      let x = bx;
      shares.forEach((s, i) => { const w = bw * clamp(s, 0, 1); ctx.fillStyle = TEAMS[i].c; ctx.fillRect(x, by, w + 1, bh); x += w; });
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(bx, by, bw, 4);
      ctx.restore();
      roundRect(ctx, bx, by, bw, bh, bh / 2); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(4,6,11,0.8)'; ctx.stroke();
      if (shares.length === 2) { const sx = bx + bw * clamp(shares[0], 0, 1); roundRect(ctx, sx - 3, by - 6, 6, bh + 12, 3); ctx.fillStyle = COL.white; ctx.fill(); }
    },
    drawHUD3v2(ctx) {
      const tot = this.totals(), xs = [210, 540, 870];
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
      ctx.font = font(64, 800); spaced(ctx, 2); ctx.fillStyle = COL.white; ctx.fillText(this.title, VW / 2, 126);
      ctx.font = font(28, 700, false); spaced(ctx, 6); ctx.fillStyle = COL.gold; ctx.fillText(`${this.hook}   ·   ${fmtTime(this.fightT)}`, VW / 2, 170, 820);
      for (let tm = 0; tm < 3; tm++) {
        const x = xs[tm];
        spaced(ctx, 3); ctx.font = font(30, 800); ctx.fillStyle = TEAMS[tm].c; ctx.fillText(TEAMS[tm].name, x, 224, 300);
        spaced(ctx, 0); ctx.font = font(92, 800); ctx.fillStyle = COL.white; ctx.fillText(String(tot[tm]), x, 316);
        spaced(ctx, 1); ctx.font = font(20, 700, false); ctx.fillStyle = COL.muted; ctx.fillText(docLabel(this.doc[tm]), x, 352, 300); spaced(ctx, 0);
      }
      ctx.font = font(26, 800); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillText('VS', 375, 290); ctx.fillText('VS', 705, 290);
      this.drawBar2(ctx, this.shares || [1 / 3, 1 / 3, 1 / 3]);
    },
    // ----- the opening: the story in two beats over the top of the battlefield (arena coordinates) -----
    drawStory2(ctx) {
      const s = this.story, t = this.t;
      if (!s || t > 4.2) return;
      const a = Math.min(clamp((t - 0.1) / 0.3, 0, 1), clamp((4.2 - t) / 0.4, 0, 1));
      if (a <= 0) return;
      const sides = this.N === 2 ? [0, 1] : [0, 1, 2];
      // the rivals: the tribes the story is about (otherwise each army's first tribe)
      const pick = team => (s.hero && s.hero.team === team ? s.hero : s.foe && s.foe.team === team ? s.foe : this.tribes.find(tb => tb.team === team));
      const top = AR.y + 22, h = 250, x0 = AR.x + 18, w = AR.w - 36;
      ctx.save(); ctx.globalAlpha = a;
      roundRect(ctx, x0, top, w, h, 20); ctx.fillStyle = 'rgba(8,11,20,0.9)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = COL.frame; ctx.stroke();
      const cw = w / sides.length, slide = 1 - easeOutCubic(clamp((t - 0.1) / 0.5, 0, 1));
      sides.forEach((team, i) => {
        const tb = pick(team), tm = TEAMS[team], cx = x0 + cw * (i + 0.5) + (i - (sides.length - 1) / 2) * 120 * slide;
        disc(ctx, cx, top + 66, 40, tm.c, 4); drawEmblem(ctx, tb.emblem, cx, top + 66, 30);
        this.fitText(ctx, tName(tb.name).replace(/^THE /, 'THE '), cx, top + 132, cw - 30, 30, 800, true, tm.l, 'center', 18);
      });
      if (sides.length === 2) { ctx.font = font(44, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; strokeText(ctx, 'VS', x0 + w / 2, top + 70, COL.white, COL.ink, 8); }
      // beat 1: what it's about; beat 2: the prize
      const line = t < 2.3 ? s.hook : `FOR ${s.stake}`, k = t < 2.3 ? clamp((t - 0.35) / 0.3, 0, 1) : clamp((t - 2.3) / 0.3, 0, 1);
      ctx.globalAlpha = a * k;
      this.fitText(ctx, line, x0 + w / 2, top + 200 + (1 - k) * 10, w - 40, 46, 800, true, t < 2.3 ? COL.white : COL.gold, 'center', 22);
      ctx.restore(); ctx.textBaseline = 'alphabetic';
    },
    // chapter cards: small cards at the bottom of the battlefield when the story turns (one at a time, queued)
    chapter(text, col = COL.gold) {
      if (!this.ui2) return false;
      const q = this.chapters || (this.chapters = []);
      const last = q.length ? q[q.length - 1] : null, start = last ? Math.max(this.t, last.t0 + 1.9) : this.t;
      q.push({ text, col, t0: start });
      if (q.length > 4) q.shift();
      return true;
    },
    drawChapters(ctx) {
      if (!this.chapters) return;
      for (const c of this.chapters) {
        const k = (this.t - c.t0) / 1.8;
        if (k < 0 || k > 1) continue;
        // (while the roster strip is up at the bottom of the battlefield, the card sits just above it)
        const low = this.N !== 3 && this.cmb && this.cmb.roster && this.t > 4.0 && this.t < 8.6 ? 14 + 92 + 10 : 0;
        const a = Math.min(1, k * 8, (1 - k) * 6), y = AR.y + AR.h - 40 - low + (1 - Math.min(1, k * 8)) * 20;
        ctx.save(); ctx.globalAlpha = a;
        ctx.font = font(28, 800); spaced(ctx, 3);
        const w = Math.min(2 * (SAFE.btnX - VW / 2), ctx.measureText(c.text).width + 80);
        roundRect(ctx, VW / 2 - w / 2, y - 24, w, 48, 24); ctx.fillStyle = 'rgba(8,11,20,0.9)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = c.col; ctx.stroke();
        for (const sx of [-1, 1]) { const dx = VW / 2 + sx * (w / 2 - 22); ctx.beginPath(); ctx.moveTo(dx, y - 7); ctx.lineTo(dx + 7, y); ctx.lineTo(dx, y + 7); ctx.lineTo(dx - 7, y); ctx.closePath(); ctx.fillStyle = c.col; ctx.fill(); }
        spaced(ctx, 0);
        this.fitText(ctx, c.text, VW / 2, y + 1, w - 76, 28, 800, true, COL.white, 'center', 18);
        ctx.restore();
      }
    },
    // ----- the roster, next to each army: its three main troops with what they're good at (arena coordinates) -----
    drawRosterStrips(ctx) {
      if (!this.cmb || !this.cmb.roster) return;
      const t = this.t, t0 = 4.2, t1 = 8.4, a = Math.min(clamp((t - t0) / 0.35, 0, 1), clamp((t1 - t) / 0.4, 0, 1));
      if (a <= 0) return;
      if (!this.rInfo) this.drawRosterInfo();
      const N = this.N, rh = N === 3 ? 76 : 92;
      ctx.save(); ctx.globalAlpha = a;
      for (let i = 0; i < N; i++) {
        const tm = TEAMS[i], x0 = AR.x + 14, low = N !== 3 && i === 1, w = low ? SAFE.btnX - x0 : AR.w - 28;
        const y0 = N === 3 ? AR.y + 14 + i * (rh + 8) : i === 0 ? AR.y + 14 : AR.y + AR.h - 14 - rh;
        const sl = (1 - easeOutCubic(clamp((t - t0) / 0.45, 0, 1))) * (i % 2 ? 1 : -1) * 120;
        ctx.save(); ctx.translate(sl, 0);
        roundRect(ctx, x0, y0, w, rh, 16); ctx.fillStyle = 'rgba(8,11,20,0.92)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = rgba(tm.c, 0.8); ctx.stroke();
        roundRect(ctx, x0, y0, 12, rh, 6); ctx.fillStyle = tm.c; ctx.fill();
        const list = this.rInfo[i], n = Math.min(list.length, 3), cw = (w - 30) / 3, pr = Math.min(rh * 0.36, 32);
        for (let j = 0; j < n; j++) {
          const [type, cnt] = list[j], U = UNIT[type], cx = x0 + 22 + j * cw, px = cx + pr + 2, py = y0 + rh / 2;
          disc(ctx, px, py, pr, 'rgba(255,255,255,0.08)', 0);
          if (!sl) this.lay.push({ kind: 'circle', x: px - pr, y: py - pr + (this.layDY || 0), w: pr * 2, h: pr * 2 });
          const s = clamp(pr * 0.78 / U.r, 0.3, 1.7);
          ctx.save(); ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.clip(); ctx.translate(px, py); ctx.scale(s, s);
          try { this.drawPortrait(ctx, type, i); } catch (e) { disc(ctx, 0, 0, U.r, tm.c, 3); }
          ctx.restore();
          const tx = px + pr + 10, mw = cx + cw - tx - 6, nm = labelOf(type).replace(/^THE /, '');
          this.fitText(ctx, `${nm} ×${cnt}`, tx, py - rh * 0.17, mw, 21, 800, true, COL.white, 'left', 15);
          this.fitText(ctx, type === 'king' && this.mode === 'king' ? 'PROTECT HIM' : specOf(type), tx, py + rh * 0.18, mw, 18, 700, false, COL.gold, 'left', 13);
        }
        ctx.restore();
      }
      ctx.restore(); ctx.textBaseline = 'alphabetic';
    },
    drawRosterInfo() {
      this.rInfo = this.teamIds().map(team => {
        const n = {};
        for (const u of this.units) if (u.team === team && !UNIT[u.type].uncounted) n[u.type] = (n[u.type] || 0) + 1;
        for (const w of this.waves[team]) for (const k of w.list) n[k] = (n[k] || 0) + 1;
        return Object.entries(n).sort((p, q) => (p[0] === 'king' ? -1 : q[0] === 'king' ? 1 : 0) || ((UNIT[q[0]].rank === 0) - (UNIT[p[0]].rank === 0)) || q[1] - p[1]);
      });
    },
    // ----- the war council strip under the battlefield (screen coordinates): one cell per tribe and a ticker -----
    drawCouncil2(ctx) {
      if (!this.tribes) return;
      const t = this.t, x0 = 140, W = VW - 280, top = 1384;
      this.layReset();
      if (this.phase === 'outro' && this.outroT > 1.0) { this.drawChronicle2(ctx, clamp((this.outroT - 1.0) / 0.4, 0, 1)); return; }
      const inK = clamp((t - 4.0) / 0.5, 0, 1);
      if (inK <= 0) return;
      ctx.save(); ctx.globalAlpha = inK;
      // the ticker: the latest thing that happened
      const e = this.ticker[0];
      if (e) {
        const a = clamp((t - e.t) / 0.25, 0, 1);
        ctx.globalAlpha = inK * a;
        this.fitText(ctx, e.text, VW / 2, top, W, 20, 800, false, e.team >= 0 ? TEAMS[e.team].l : COL.gold, 'center', 18);
        ctx.globalAlpha = inK;
      }
      const three = this.N === 3, cols = three ? 3 : 2, gap = 14, cw = (W - gap * (cols - 1)) / cols, ch = three ? 140 : 72;
      for (const tb of this.tribes) {
        const col = tb.team, row = three ? 0 : tb.idx, x = x0 + col * (cw + gap), y = top + 22 + row * (ch + 8);
        this.drawCell2(ctx, tb, x, y, cw, ch, three);
      }
      ctx.restore();
      this.drawCoins(ctx);
      ctx.textBaseline = 'alphabetic';
    },
    drawCell2(ctx, tb, x, y, w, h, tall) {
      const tm = TEAMS[tb.team], t = this.t, dead = !tb.n && this.phase === 'fight' && this.fightT > 1, a0 = ctx.globalAlpha;
      roundRect(ctx, x, y, w, h, 14); ctx.fillStyle = '#0A0E19'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = dead ? 'rgba(255,255,255,0.08)' : rgba(tm.c, 0.6); ctx.stroke();
      ctx.globalAlpha = a0 * (dead ? 0.45 : 1);
      const er = 22, ex = x + 12 + er, ey = y + (tall ? 12 + er : h / 2);
      disc(ctx, ex, ey, er, tm.c, 3); drawEmblem(ctx, tb.emblem, ex, ey, er * 0.74);
      if (tb.chiefDead) { ctx.beginPath(); ctx.moveTo(ex - er * 0.7, ey + er * 0.7); ctx.lineTo(ex + er * 0.7, ey - er * 0.7); ctx.lineWidth = 4; ctx.strokeStyle = '#FF8A8A'; ctx.stroke(); }
      this.lay.push({ kind: 'circle', x: ex - er, y: ey - er, w: er * 2, h: er * 2 });
      const tx = ex + er + 10, right = x + w - 10;
      let tac = this.fightT > 0.5 && tb.n ? TAC_WORD[tb.tactic] : '';
      ctx.font = font(18, 800, false);
      if (tac && ctx.measureText(tac).width > (tall ? right - tx : 130)) tac = TAC_SHORT[tb.tactic];
      const tacW = tac ? Math.min(ctx.measureText(tac).width, tall ? right - tx : 130) : 0;
      let ly;
      if (tall) {
        this.fitText(ctx, shortTribe(tb.name), tx, y + 24, right - tx, 22, 800, true, tm.l, 'left', 18);
        if (tac) this.fitText(ctx, tac, tx, y + 50, right - tx, 18, 800, false, COL.gold, 'left', 18);
        ly = y + h - 46;
      } else {
        this.fitText(ctx, shortTribe(tb.name), tx, y + 22, right - tx - tacW - 10, 22, 800, true, tm.l, 'left', 18);
        if (tac) this.fitText(ctx, tac, right, y + 22, 130, 18, 800, false, COL.gold, 'right', 18);
        ly = y + 52;
      }
      // gold and iron, then weapon and armour tiers (in the tall cells, the tiers get their own line)
      const gf = clamp(1 - (t - tb.goldFx) / 0.4, 0, 1), irf = clamp(1 - (t - tb.ironFx) / 0.4, 0, 1);
      const cx0 = tall ? x + 14 : tx;
      tb.coinAt = { x: cx0 + 8, y: ly };
      disc(ctx, cx0 + 8, ly, 8 + gf * 2, COL.gold, 2);
      this.fitText(ctx, String(Math.floor(tb.gold)), cx0 + 21, ly, 40, 20, 800, true, gf > 0 ? COL.gold : COL.white, 'left', 18);
      const ix = cx0 + 66;
      ctx.beginPath(); ctx.moveTo(ix - 1, ly + 6); ctx.lineTo(ix + 3, ly - 5); ctx.lineTo(ix + 14, ly - 5); ctx.lineTo(ix + 18, ly + 6); ctx.closePath();
      ctx.fillStyle = irf > 0 ? '#DCE5EE' : '#9AA3AD'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke();
      this.fitText(ctx, String(Math.floor(tb.iron)), ix + 22, ly, 34, 20, 800, true, COL.white, 'left', 18);
      const py = tall ? ly + 30 : ly, px = tall ? x + 18 : ix + 62;
      const pip = (cx, filled, colr) => { ctx.beginPath(); ctx.arc(cx, py, 5.5, 0, TAU); ctx.fillStyle = filled ? colr : 'rgba(255,255,255,0.12)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = COL.ink; ctx.stroke(); };
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px, py + 7); ctx.lineTo(px + 9, py - 7); ctx.lineWidth = 4.5; ctx.strokeStyle = COL.ink; ctx.stroke(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#E2E8F0'; ctx.stroke();
      for (let k = 1; k <= 3; k++) pip(px + 5 + k * 13, tb.wt >= k, k === 3 ? W_TOP[tb.set] : k === 2 ? '#E2E8F0' : W_COL[1]);
      const sx = px + 66;
      ctx.beginPath(); ctx.moveTo(sx - 6, py - 6); ctx.lineTo(sx + 6, py - 6); ctx.lineTo(sx + 6, py); ctx.quadraticCurveTo(sx + 5, py + 6, sx, py + 8); ctx.quadraticCurveTo(sx - 5, py + 6, sx - 6, py); ctx.closePath();
      ctx.fillStyle = '#9AA3AD'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke();
      for (let k = 1; k <= 3; k++) pip(sx + 5 + k * 13, tb.at >= k, A_COL[k]);
      this.lay.push({ kind: 'coin', x: cx0 - 2, y: ly - 10, w: 20, h: 20 }, { kind: 'ingot', x: ix - 2, y: ly - 6, w: 22, h: 13 },
        { kind: 'weapon pips', x: px - 2, y: py - 8, w: 5 + 3 * 13 + 9, h: 16 }, { kind: 'armour pips', x: sx - 7, y: py - 7, w: 12 + 3 * 13 + 6, h: 15 });
      ctx.globalAlpha = a0;
    },
    // art finish: one light from the top left for every round troop (a soft rim highlight), and faces for the plain troops that had none
    artFinish(ctx, u, x, y) {
      const U = UNIT[u.type], r = u.r;
      if (GLOSS_SKIP.has(u.type) || U.mount || U.flying || (r > 22 && u.type !== 'giant')) return;
      (this._rim || (this._rim = [])).push(x, y, r);
      if (FACELESS.has(u.type)) {
        ctx.save();
        const f = u.face, fx = Math.cos(f), fy = Math.sin(f), px = -fy, py = fx, ex = x + fx * r * 0.42, ey = y + fy * r * 0.42, sp = r * 0.34, er = Math.max(1.8, r * 0.17);
        for (const sd of [-1, 1]) {
          const cx = ex + px * sp * sd, cy = ey + py * sp * sd;
          ctx.beginPath(); ctx.arc(cx, cy, er, 0, TAU); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = COL.ink; ctx.stroke();
          ctx.beginPath(); ctx.arc(cx + fx * er * 0.35, cy + fy * er * 0.35, er * 0.55, 0, TAU); ctx.fillStyle = COL.ink; ctx.fill();
        }
        ctx.restore();
      }
    },
    // the rim lights and scuffs collected while the troops were drawn, in one batch each
    flushArt(ctx) {
      const R = this._rim, S = this._scr;
      ctx.save(); ctx.lineCap = 'round';
      if (R && R.length) {
        ctx.beginPath();
        for (let i = 0; i < R.length; i += 3) { const x = R[i], y = R[i + 1], r = R[i + 2]; ctx.moveTo(x + Math.cos(Math.PI * 1.08) * r * 0.74, y + Math.sin(Math.PI * 1.08) * r * 0.74); ctx.arc(x, y, r * 0.74, Math.PI * 1.08, Math.PI * 1.46); }
        ctx.lineWidth = 2.3; ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.stroke(); R.length = 0;
      }
      if (S && S.length) {
        ctx.beginPath(); for (let i = 0; i < S.length; i += 4) { ctx.moveTo(S[i], S[i + 1]); ctx.lineTo(S[i + 2], S[i + 3]); }
        ctx.lineWidth = 2.6; ctx.strokeStyle = 'rgba(8,10,18,0.6)'; ctx.stroke();
        ctx.beginPath(); for (let i = 0; i < S.length; i += 4) { ctx.moveTo(S[i] + 1.5, S[i + 1] + 1.5); ctx.lineTo(S[i + 2] + 1.5, S[i + 3] + 1.5); }
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.stroke(); S.length = 0;
      }
      ctx.restore();
    },
    drawChronicle2(ctx, al) {
      const f = this._tf || (this._tf = this.tribeFacts()), W = VW - 280;
      if (!f) return;
      ctx.save(); ctx.globalAlpha = al;
      const lead = this.winner >= 0 ? TEAMS[this.winner] : null;
      this.fitText(ctx, f.chron[0], VW / 2, 1414, W, 34, 800, true, lead ? lead.l : COL.white, 'center', 18);
      this.fitText(ctx, f.chron[1], VW / 2, 1462, W, 28, 800, true, COL.gold, 'center', 18);
      ctx.restore();
    },
  };
  // ----- world events (rules.world): the whole battlefield goes strange for a few seconds -----
  // They roll their own dice (seed ^ 0x3E1D7A), so nothing else in the battle changes when they're off. Every one of them hits
  // both sides alike: the looks change (camera roll, darkness, glitches, grading), and where the battle changes too (curving shots,
  // frozen time, harder hits, two champions growing), it's the same for everyone.
  const WORLD = {
    glitch: { name: 'GLITCH', dur: 6, title: 'SIGNAL LOST', sub: 'GLITCH IN THE SIMULATION', col: '#7CF3FF' },
    flip: { name: 'THE WORLD FLIPS', dur: 6, title: 'THE WORLD FLIPS', sub: 'EVERY SHOT CURVES', col: '#C4B5FD' },
    mirror: { name: 'MIRROR SHIFT', dur: 6, title: 'MIRROR SHIFT', sub: 'LEFT IS RIGHT NOW', col: '#E0E7FF' },
    blackout: { name: 'BLACKOUT', dur: 7, title: 'BLACKOUT', sub: 'ONLY GUNFIRE AND MAGIC LIGHT THE FIELD', col: '#FDE68A' },
    freeze: { name: 'TIME STOPS', dur: 3.2, title: 'TIME STOPS', sub: 'ONLY THREE ON EACH SIDE CAN MOVE', col: '#93C5FD' },
    bloodmoon: { name: 'BLOOD MOON', dur: 8, title: 'BLOOD MOON', sub: 'EVERY HIT 35% HARDER', col: '#FF5A5A' },
    supersize: { name: 'SUPERSIZE', dur: 9, title: 'SUPERSIZE', sub: 'ONE CHAMPION EACH GROWS HUGE', col: '#FFD23F' },
    rave: { name: 'RAVE', dur: 7, title: 'RAVE MODE', sub: 'EVERYONE MOVES AND STRIKES FASTER', col: '#F472B6' },
  };
  const WORLD_KINDS = Object.keys(WORLD);
  // a repeatable 0..1 number for looks (no dice used, so drawing never changes the battle)
  const easeInOut = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  const hash01 = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };
  const ARMY_WORLD = {
    initWorld() {
      const W = this.opts.world, R = this.WR = rng(((this.seed >>> 0) ^ 0x3E1D7A) >>> 0);
      const F = (this.opts.fixedLength || this.target || 60) - (this.opts.outroSecs || 0);
      const list = (W.list || WORLD_KINDS).filter(k => WORLD[k]);
      this.wq = []; this.worldLog = [];
      if (!list.length || !R.chance(W.chance ?? 0.7)) return;
      const pick = () => list[R.int(0, list.length - 1)];
      const first = { kind: pick(), at: F * R.range(0.24, 0.42) };
      if (W.at) first.at = W.at; // (tests only)
      first.dur = WORLD[first.kind].dur;
      this.wq.push(first);
      if (R.chance(W.second ?? 0.3)) {
        let k = pick(); if (k === first.kind) k = list[(list.indexOf(k) + 1) % list.length];
        const at = first.at + first.dur + R.range(8, 14);
        if (at + WORLD[k].dur < F * 0.82) this.wq.push({ kind: k, at, dur: WORLD[k].dur });
      }
      for (const e of this.wq) e.spin = R.chance(0.5) ? 1 : -1;
    },
    worldTick(h) {
      const T = this.fightT;
      this.wNow = null;
      for (const e of this.wq) {
        if (e.done) continue;
        if (!e.on) { if (T >= e.at) this.worldStart(e); else continue; }
        if (T >= e.at + e.dur) { this.worldEnd(e); continue; }
        this.wNow = e;
        this.worldRun(e, h);
      }
    },
    worldPick(team, ok) {
      const c = this.units.filter(u => u.team === team && !u.dead && !u.phased && !UNIT[u.type].uncounted && ok(u));
      return c.length ? c[this.WR.int(0, c.length - 1)] : null;
    },
    worldStart(e) {
      const T = this.fightT, R = this.WR, W = WORLD;
      if (e.kind === 'mirror' && this.obstacles.length) e.kind = 'flip'; // mirroring only on open ground, so nobody lands in a wall
      e.on = true; e.dur = W[e.kind].dur; e.t0 = T;
      const plain = u => UNIT[u.type].rank !== 0 && !UNIT[u.type].boss && !u.boss;
      if (e.kind === 'glitch') {
        e.bugs = this.teamIds().map(t => this.worldPick(t, plain)).filter(Boolean);
        for (const u of e.bugs) u.bugT = T + e.dur;
        this.snd('glitch');
      } else if (e.kind === 'mirror') { this.worldMirror(); this.snd('portal'); }
      else if (e.kind === 'freeze') {
        e.walkers = [];
        for (const t of this.teamIds()) for (let k = 0; k < 3; k++) { const u = this.worldPick(t, u => plain(u) && !(u.walkT > T)); if (u) { u.walkT = T + e.dur; e.walkers.push(u); } }
        this.frozenT = T + e.dur; this.snd('freeze');
      } else if (e.kind === 'supersize') {
        e.big = this.teamIds().map(t => this.worldPick(t, u => plain(u) && !UNIT[u.type].mount && !u.flying && u.r <= 17)).filter(Boolean);
        for (const u of e.big) { u.grow0 = u.r; u.max *= 3; u.hp *= 3; u.dmgK = (u.dmgK || 1) * 1.8; u.bigT = T + e.dur; }
        this.snd('evolve');
      } else this.snd({ flip: 'whoosh', blackout: 'thud', bloodmoon: 'roar', rave: 'drum' }[e.kind] || 'whoosh');
      this.worldLog.push(e.kind);
      if (!this.ui2) this.banner(`${W[e.kind].name}!`, W[e.kind].col, 1.6);
      if (this.camEv) this.camEv.push({ type: 'hitstop' });
    },
    worldRun(e, h) {
      const T = this.fightT, k = clamp((T - e.t0) / 0.6, 0, 1) * clamp((e.t0 + e.dur - T) / 0.6, 0, 1);
      if (e.kind === 'flip' && k > 0.5) {
        // every shot curves while the world is upside down (the same for both sides)
        const w = 1.1 * e.spin * h, c = Math.cos(w), s = Math.sin(w);
        for (const a of this.arrows) { if (LOBS[a.kind]) continue; const vx = a.vx * c - a.vy * s; a.vy = a.vx * s + a.vy * c; a.vx = vx; }
      } else if (e.kind === 'supersize') {
        for (const u of e.big) {
          if (u.dead) continue;
          u.r = u.grow0 * (1 + 1.1 * easeOutCubic(k)); u.m = u.r * u.r;
          if (this.obstacles.length) this.pushOut(u);
        }
      }
    },
    worldEnd(e) {
      e.on = false; e.done = true;
      if (e.kind === 'mirror') this.worldMirror();
      if (e.kind === 'supersize') for (const u of e.big) {
        u.r = u.grow0; u.m = u.r * u.r; u.max /= 3; u.dmgK /= 1.8; u.bigT = 0;
        if (!u.dead) u.hp = Math.max(0.5, u.hp / 3);
        if (this.obstacles.length) this.pushOut(u);
      }
      if (e.kind === 'freeze') this.frozenT = 0;
    },
    // the whole battle mirrors left to right (troops, shots, flags), so left is right
    worldMirror() {
      const cx = AR.x + AR.w / 2;
      for (const o of this.units) { o.x = 2 * cx - o.x; if (o.px !== undefined) o.px = 2 * cx - o.px; o.vx = -o.vx; o.face = Math.PI - o.face; if (o.mface !== undefined) o.mface = Math.PI - o.mface; }
      for (const a of this.arrows) { a.x = 2 * cx - a.x; a.vx = -a.vx; if (a.px !== undefined) a.px = 2 * cx - a.px; if (a.sx !== undefined) { a.sx = 2 * cx - a.sx; a.tx = 2 * cx - a.tx; } }
      this.mirrorFx = this.t;
    },
    worldDmg(u, from) {
      const T = this.fightT; let k = 1;
      if (this.wNow && this.wNow.kind === 'bloodmoon') k *= 1.35;
      if (from && from.bugT > T) k *= 1.6;
      return k;
    },
    worldSpd(u) {
      const T = this.fightT; let k = 1;
      if (this.wNow && this.wNow.kind === 'rave') k *= 1.25;
      if (u.bugT > T) k *= 1.4;
      return k;
    },
    worldCd() { return this.wNow && this.wNow.kind === 'rave' ? 0.85 : 1; },
    // ----- looks -----
    worldK(e) { const T = this.fightT; return clamp((T - e.t0) / 0.6, 0, 1) * clamp((e.t0 + e.dur - T) / 0.6, 0, 1); },
    // before anything is drawn on the battlefield (screen space, inside its frame)
    worldPre(ctx) {
      if (this.phase !== 'fight') this.wNow = null;
      const e = this.wNow; this._wRot = false;
      if (!e || e.kind !== 'flip') return;
      const T = this.fightT, a = Math.PI * easeInOut(clamp((T - e.t0) / 0.7, 0, 1)) * (1 - easeInOut(clamp((T - (e.t0 + e.dur - 0.7)) / 0.7, 0, 1)));
      if (a < 0.001) return;
      ctx.fillStyle = '#04060C'; ctx.fillRect(AR.x, AR.y, AR.w, AR.h);
      const cx = AR.x + AR.w / 2, cy = AR.y + AR.h / 2;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a * e.spin); ctx.translate(-cx, -cy); this._wRot = true;
    },
    // on the battlefield, under the camera (world space): the darkness of a blackout, rings on the special troops
    worldMid(ctx) {
      const e = this.wNow, T = this.fightT;
      if (!e) return;
      if (e.kind === 'blackout' && api.makeCanvas) {
        const k = this.worldK(e), cv = this._wMask || (this._wMask = api.makeCanvas(ctx.canvas.width, ctx.canvas.height)), m = cv.getContext('2d');
        m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, cv.width, cv.height);
        m.setTransform(ctx.getTransform());
        m.globalCompositeOperation = 'source-over'; m.fillStyle = `rgba(2,3,9,${0.94 * k})`; m.fillRect(AR.x - 400, AR.y - 400, AR.w + 800, AR.h + 800);
        m.globalCompositeOperation = 'destination-out';
        const light = (x, y, r, a) => { const g = m.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); m.fillStyle = g; m.beginPath(); m.arc(x, y, r, 0, TAU); m.fill(); };
        for (const u of this.units) if (!u.dead) { light(u.x, u.y, u.r * 1.9, 0.45); if (u.muzzle > 0) light(u.x, u.y, 110, 0.95 * u.muzzle); if (u.flash > 0.3) light(u.x, u.y, 46, 0.6); }
        for (const a of this.arrows) light(a.x, a.y, a.kind === 'fireball' || a.kind === 'rocket' ? 120 : 44, 0.9);
        for (const b of this.booms || []) light(b.x, b.y, b.r * 2.2 + 60, 1);
        for (const f of this.fires || []) if (f.x !== undefined) light(f.x, f.y, (f.r || 30) * 2, 0.85);
        for (const b of this.beams || []) if (b.x1 !== undefined) { light(b.x0, b.y0, 70, 0.8); light(b.x1, b.y1, 90, 0.9); }
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(cv, 0, 0); ctx.restore();
      }
      if (e.kind === 'glitch') for (const u of e.bugs) {
        if (u.dead) continue;
        const j = (hash01(this.frameNo, u.gait) - 0.5) * 10;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255,40,80,0.8)'; ctx.beginPath(); ctx.arc(u.x + j, u.y, u.r + 5, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(40,240,255,0.8)'; ctx.beginPath(); ctx.arc(u.x - j, u.y + 2, u.r + 5, 0, TAU); ctx.stroke();
        ctx.restore();
        ctx.font = font(18, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        strokeText(ctx, hash01(this.frameNo >> 3, u.gait) > 0.5 ? 'ERR#' : '0x0F', u.x + j * 0.5, u.y - u.r - 18, '#7CF3FF', COL.ink, 4);
      }
      if (e.kind === 'supersize') for (const u of e.big) if (!u.dead) {
        ctx.beginPath(); ctx.arc(u.x, u.y, u.r + 7 + 2 * Math.sin(T * 8), 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,210,63,0.75)'; ctx.stroke();
      }
    },
    // after the battlefield is drawn (screen space, inside its frame, never rotated): grading, glitches and the event's title
    worldPost(ctx) {
      if (this._wRot) { ctx.restore(); this._wRot = false; }
      const e = this.wNow, T = this.fightT, zoom = this.camOn(), c = this.cam;
      const scr = (x, y) => (zoom ? [AR.x + (x - c.x) * c.z + AR.w / 2, AR.y + (y - c.y) * c.z + AR.h / 2] : [x, y]);
      if (e) {
        const k = this.worldK(e), W = WORLD[e.kind];
        if (e.kind === 'freeze') {
          // the world goes grey; only the three time-walkers on each side keep their colour ring
          ctx.save(); ctx.globalAlpha = k; ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#808080'; ctx.fillRect(AR.x, AR.y, AR.w, AR.h);
          ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(120,170,255,0.12)'; ctx.fillRect(AR.x, AR.y, AR.w, AR.h); ctx.restore();
          for (const u of e.walkers) if (!u.dead) { const [x, y] = scr(u.x, u.y), z = zoom ? c.z : 1; ctx.beginPath(); ctx.arc(x, y, (u.r + 7) * z, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = TEAMS[u.team].c; ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, (u.r + 12) * z, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke(); }
        } else if (e.kind === 'bloodmoon') {
          ctx.save(); ctx.globalAlpha = k;
          ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#FF8A80'; ctx.fillRect(AR.x, AR.y, AR.w, AR.h);
          ctx.globalCompositeOperation = 'source-over';
          const mx = AR.x + AR.w - 150, my = AR.y + 150, g = ctx.createRadialGradient(mx, my, 20, mx, my, 220);
          g.addColorStop(0, 'rgba(255,80,60,0.45)'); g.addColorStop(1, 'rgba(255,80,60,0)'); ctx.fillStyle = g; ctx.fillRect(mx - 220, my - 220, 440, 440);
          ctx.beginPath(); ctx.arc(mx, my, 62, 0, TAU); ctx.fillStyle = '#E63B2E'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = COL.ink; ctx.stroke();
          for (const [dx, dy, rr] of [[-18, -12, 12], [16, 14, 9], [6, -26, 6]]) { ctx.beginPath(); ctx.arc(mx + dx, my + dy, rr, 0, TAU); ctx.fillStyle = 'rgba(120,10,10,0.45)'; ctx.fill(); }
          ctx.restore();
        } else if (e.kind === 'rave') {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const cx = AR.x + AR.w / 2, cy = AR.y - 40, cols = ['255,60,180', '60,200,255', '255,220,60', '120,255,120'];
          for (let i = 0; i < 4; i++) {
            const a = Math.PI / 2 + Math.sin(T * 1.7 + i * 1.6) * 0.75;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a - 0.12) * 1500, cy + Math.sin(a - 0.12) * 1500); ctx.lineTo(cx + Math.cos(a + 0.12) * 1500, cy + Math.sin(a + 0.12) * 1500); ctx.closePath();
            ctx.fillStyle = `rgba(${cols[i]},${0.16 * k})`; ctx.fill();
          }
          if (((T * 8) | 0) % 2 === 0) { ctx.fillStyle = `rgba(255,255,255,${0.05 * k})`; ctx.fillRect(AR.x, AR.y, AR.w, AR.h); }
          ctx.restore();
          // the disco ball
          ctx.beginPath(); ctx.arc(cx, AR.y + 36, 30, 0, TAU); ctx.fillStyle = '#C7D2FE'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = COL.ink; ctx.stroke();
          for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (i * i + j * j <= 5) { ctx.fillStyle = hash01(i * 7 + j, (T * 10) | 0) > 0.5 ? '#FFFFFF' : '#818CF8'; ctx.fillRect(cx + i * 10 - 4, AR.y + 36 + j * 10 - 4, 8, 8); }
        } else if (e.kind === 'mirror') {
          const s = clamp((this.t - (this.mirrorFx || -9)) / 0.5, 0, 1);
          if (s < 1) { const x = AR.x + AR.w * s; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(x - 3, AR.y, 6, AR.h); ctx.fillStyle = 'rgba(200,220,255,0.25)'; ctx.fillRect(x - 40, AR.y, 80, AR.h); }
          ctx.fillStyle = `rgba(200,220,255,${0.06 * k})`; ctx.fillRect(AR.x, AR.y, AR.w, AR.h);
        } else if (e.kind === 'glitch') this.worldGlitch(ctx, k);
        // the event's title: big for its first 1.4 seconds, with a colour split
        const tt = T - e.t0;
        if (tt < 1.5) {
          const a = Math.min(1, tt / 0.12, (1.5 - tt) / 0.3), s = 1 + 0.25 * (1 - easeOutCubic(Math.min(1, tt / 0.3))), cx = AR.x + AR.w / 2, cy = AR.y + AR.h * 0.42;
          ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.scale(s, s); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.font = font(96, 800); spaced(ctx, 4);
          const tw = Math.min(1, 860 / ctx.measureText(W.title).width); ctx.scale(tw, tw);
          ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,40,90,0.7)'; ctx.fillText(W.title, -5, 0); ctx.fillStyle = 'rgba(40,220,255,0.7)'; ctx.fillText(W.title, 5, 0);
          ctx.globalCompositeOperation = 'source-over'; strokeText(ctx, W.title, 0, 0, '#FFFFFF', COL.ink, 12);
          spaced(ctx, 2); ctx.font = font(34, 800); strokeText(ctx, W.sub, 0, 78, W.col, COL.ink, 8); spaced(ctx, 0);
          ctx.restore(); ctx.textBaseline = 'alphabetic';
        }
      }
    },
    // the glitch: torn rows slid sideways, a red/cyan split, scanlines and SIGNAL LOST flickering (looks only)
    worldGlitch(ctx, k) {
      const n = this.frameNo, src = ctx.canvas;
      if (api.makeCanvas && src && src.width) {
        const m = ctx.getTransform(), X0 = Math.round(m.e + AR.x * m.a), Y0 = Math.round(m.f + AR.y * m.d), Wd = Math.round(AR.w * m.a), Hd = Math.round(AR.h * m.d);
        const off = this._wGl || (this._wGl = api.makeCanvas(Wd, Hd)), o = off.getContext('2d');
        o.clearRect(0, 0, Wd, Hd); o.drawImage(src, X0, Y0, Wd, Hd, 0, 0, Wd, Hd);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        // a colour split
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.22 * k;
        const sh = 6 + 8 * hash01(n, 3);
        ctx.drawImage(off, X0 + sh, Y0); ctx.drawImage(off, X0 - sh, Y0 + 2);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        // torn rows (on about half the frames)
        if (hash01(n >> 1, 9) < 0.55 * k + 0.1) {
          const rows = 2 + ((hash01(n, 11) * 4) | 0);
          for (let i = 0; i < rows; i++) {
            const y = (hash01(n, 20 + i) * (Hd - 60)) | 0, h = 8 + ((hash01(n, 40 + i) * 50) | 0), dx = ((hash01(n, 60 + i) - 0.5) * 120 * k) | 0;
            ctx.drawImage(off, 0, y, Wd, h, X0 + dx, Y0 + y, Wd, h);
            if (hash01(n, 80 + i) > 0.6) { ctx.fillStyle = hash01(n, 90 + i) > 0.5 ? 'rgba(124,243,255,0.25)' : 'rgba(255,60,120,0.25)'; ctx.fillRect(X0, Y0 + y, Wd, h); }
          }
        }
        ctx.restore();
      }
      // scanlines
      ctx.fillStyle = `rgba(0,0,0,${0.18 * k})`;
      for (let y = AR.y; y < AR.y + AR.h; y += 6) ctx.fillRect(AR.x, y, AR.w, 2);
      // SIGNAL LOST, flickering after the title has gone
      const tt = this.fightT - this.wNow.t0;
      if (tt > 1.6 && hash01(n >> 2, 5) > 0.45) {
        ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font(44, 800); spaced(ctx, 6);
        strokeText(ctx, hash01(n >> 4, 6) > 0.3 ? 'SIGNAL LOST' : 'S1GNAL L0ST', AR.x + AR.w / 2 + (hash01(n, 7) - 0.5) * 12, AR.y + AR.h * 0.5, '#7CF3FF', COL.ink, 8);
        spaced(ctx, 0); ctx.restore(); ctx.textBaseline = 'alphabetic';
      }
    },
    // in a glitch, troops blink out for a frame now and then (looks only)
    worldHide(u) { return this.wNow && this.wNow.kind === 'glitch' && hash01(this.frameNo >> 1, u.gait * 100) < 0.08 * this.worldK(this.wNow); },
  };
  // ----- art finish 2 (rules.ui.art 2): weapon slashes and thrusts you can see, damage that shows, cracks under the troops,
  // scorched ground, and fire that spreads across the grass (rules.world.fire) -----
  const NOFIRE = { frozen: 1, snow: 1, moon: 1, neon: 1, mirror: 1, godboard: 1, shattered: 1, beach: 1, dunes: 1, swamp: 1 };
  const FIRE_CELL = 40;
  const FIERY = { fireball: 0.12, meteor: 0.5, hellfire: 0.4, bomb: 0.3, rocket: 0.2, shell: 0.3, cannonball: 0.25, mortar: 0.3 };
  const SLASH_STYLE = { blade: 'blade', agile: 'blade', thrust: 'thrust', cleave: 'cleave', crush: 'crush', shield: 'crush' };
  // a lens-shaped streak (pointed at both ends): the shape of a blade's slice
  function lens(ctx, cx, cy, ang, len, wid) {
    const c = Math.cos(ang), s = Math.sin(ang), px = -s, py = c, hx = c * len / 2, hy = s * len / 2;
    ctx.beginPath(); ctx.moveTo(cx - hx, cy - hy);
    ctx.quadraticCurveTo(cx + px * wid, cy + py * wid, cx + hx, cy + hy);
    ctx.quadraticCurveTo(cx - px * wid * 0.35, cy - py * wid * 0.35, cx - hx, cy - hy); ctx.closePath();
  }
  const ARMY_FX2 = {
    // a hit you can see: a slice across the target, a spear streak through it, an axe arc or a hammer ring (looks only)
    addSlash(u, from) {
      const F = UNIT[from.type];
      if (F.ranged || F.healer || UNIT[u.type].uncounted || this.slashes.length > 36) return;
      const d = Math.hypot(u.x - from.x, u.y - from.y);
      if (d > u.r + from.r + (F.reach || 5) + 26) return;
      const st = F.rank === 0 ? 'crush' : SLASH_STYLE[STYLE[from.type]] || (F.sword ? 'blade' : from.type === 'spearman' || from.type === 'pikeman' || from.type === 'lancer' ? 'thrust' : 'blade');
      const ec = this.evo && from.tribe && from.tribe.wt >= 4 ? ELEM[from.tribe.elem].col : null;
      this.slashes.push({ x: u.x, y: u.y, a: Math.atan2(u.y - from.y, u.x - from.x), st, t0: this.t, r: u.r, k: hash01(this.frameNo, u.gait), col: ec });
    },
    drawSlashes(ctx) {
      const t = this.t;
      this.slashes = this.slashes.filter(s => t - s.t0 < (s.st === 'crush' ? 0.32 : 0.2));
      for (const s of this.slashes) {
        const age = t - s.t0, life = s.st === 'crush' ? 0.32 : 0.2, p = age / life, a = 1 - p, grow = Math.min(1, age / 0.05);
        ctx.save();
        if (s.st === 'blade') {
          // a diagonal slice across the target, drawn in fast and fading
          const ang = s.a + Math.PI / 2 + (s.k - 0.5) * 1.2, len = (s.r * 3.4 + 16) * grow;
          ctx.globalAlpha = a; lens(ctx, s.x, s.y, ang, len, 7); ctx.fillStyle = '#FFFFFF'; ctx.fill();
          ctx.globalAlpha = a * (s.col ? 0.75 : 0.45); lens(ctx, s.x, s.y, ang, len * (s.col ? 1.3 : 1.15), s.col ? 16 : 13); ctx.fillStyle = s.col || '#BFE6FF'; ctx.fill();
        } else if (s.st === 'thrust') {
          // a straight streak through the target, with speed lines behind it
          const len = (s.r * 3 + 22) * grow, c = Math.cos(s.a), sn = Math.sin(s.a);
          ctx.globalAlpha = a; lens(ctx, s.x + c * 6, s.y + sn * 6, s.a, len, 4.5); ctx.fillStyle = '#FFFFFF'; ctx.fill();
          ctx.lineCap = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,255,255,${a * 0.7})`;
          for (const o of [-7, 7]) { const ox = -sn * o, oy = c * o; ctx.beginPath(); ctx.moveTo(s.x - c * (len * 0.9) + ox, s.y - sn * (len * 0.9) + oy); ctx.lineTo(s.x - c * (len * 0.35) + ox, s.y - sn * (len * 0.35) + oy); ctx.stroke(); }
        } else if (s.st === 'cleave') {
          // a wide arc across the front of the target
          const R0 = s.r + 6, R1 = s.r + 18, a0 = s.a + Math.PI - 1.1, a1 = a0 + 2.2 * grow;
          ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(s.x, s.y, R1, a0, a1); ctx.arc(s.x, s.y, R0, a1, a0, true); ctx.closePath();
          ctx.fillStyle = '#FFE2B0'; ctx.fill();
        } else {
          // a heavy blow: a ring of force and a flash
          const rr = s.r + 8 + 34 * easeOutCubic(p);
          ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(s.x, s.y, rr, 0, TAU); ctx.lineWidth = 5 * a + 1; ctx.strokeStyle = '#FFF4D6'; ctx.stroke();
          if (p < 0.3) { ctx.globalAlpha = (0.3 - p) * 3; ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 6, 0, TAU); ctx.fillStyle = '#FFFFFF'; ctx.fill(); }
        }
        ctx.restore();
      }
    },
    // scorched ground and a crater ring where something blew up (on the ground layer, so it fades slowly)
    scorch(x, y, r, big) {
      const g = this.stains.getContext('2d'), cx = x - AR.x, cy = y - AR.y, rr = r * (big ? 0.95 : 0.75);
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
      gr.addColorStop(0, 'rgba(12,8,6,0.55)'); gr.addColorStop(0.6, 'rgba(30,20,12,0.32)'); gr.addColorStop(1, 'rgba(30,20,12,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.fill();
      if (big) { g.beginPath(); g.arc(cx, cy, rr * 0.42, 0, TAU); g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.stroke(); }
    },
    // the ground under the troops: earthquake cracks and burning grass
    drawGround2(ctx) {
      for (const pts of this.cracks || []) this.drawCrack2(ctx, pts, 1, 0);
      for (const ev of this.events || []) if (ev.type === 'earthquake' && ev.started && !ev.done) this.drawCrack2(ctx, ev.pts, clamp((ev.t - 0.25) / 0.9, 0, 1), clamp(1 - (ev.t - 1.5) / 1.5, 0, 1));
      if (this.fireG && this.fireG.size) this.drawFire(ctx);
    },
    // a crack that rips across the field from one side to the other, glowing inside at first, with small side cracks
    drawCrack2(ctx, pts, prog, glow) {
      if (prog <= 0) return;
      const n = pts.length - 1, upto = prog * n, path = [];
      for (let k = 0; k <= Math.floor(upto); k++) path.push(pts[k]);
      const f = upto - Math.floor(upto);
      if (f > 0 && Math.floor(upto) < n) { const [ax, ay] = pts[Math.floor(upto)], [bx, by] = pts[Math.floor(upto) + 1]; path.push([ax + (bx - ax) * f, ay + (by - ay) * f]); }
      const line = (w, col) => { ctx.beginPath(); path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke(); };
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      line(26, 'rgba(60,44,30,0.35)'); // churned earth either side
      line(15, '#0A0705');
      if (glow > 0) { line(7, `rgba(255,120,40,${0.85 * glow})`); line(3, `rgba(255,230,150,${glow})`); } else line(4, '#3A2A1C');
      // side cracks
      ctx.lineWidth = 4; ctx.strokeStyle = '#0A0705';
      for (let k = 1; k < path.length - 1; k++) {
        const [x, y] = path[k], h1 = hash01(k, pts[0][1]), side = h1 > 0.5 ? 1 : -1, len = 18 + 26 * hash01(k, 7);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (hash01(k, 3) - 0.5) * 30, y + side * len * 0.6); ctx.lineTo(x + (hash01(k, 4) - 0.5) * 40, y + side * len); ctx.stroke();
      }
      ctx.restore();
    },
    // the finale: a white flash on the final blow, then FINAL BLOW (or TIME!) and who did it, while the moment plays out slowly
    drawFinale(ctx) {
      if (this.phase !== 'outro' || this.finFlash === undefined) return;
      const a = (this.realT || 0) - this.finFlash;
      if (a < 0.3) { ctx.fillStyle = `rgba(255,255,255,${0.65 * (1 - a / 0.3)})`; ctx.fillRect(AR.x, AR.y, AR.w, AR.h); }
      if (!this.holdOutro) return;
      const kill = this.endHow === 'kill', d = this.lastDeath, k = easeOutBack(clamp((a - 0.1) / 0.3, 0, 1)), out = clamp((1.7 - a) / 0.2, 0, 1);
      const big = kill ? 'FINAL BLOW' : 'TIME!', kt = kill && d && d.byType && d.byTeam >= 0 ? TEAMS[d.byTeam] : TEAMS[this.winner];
      const sub = kill ? (d && d.byType ? `THE ${labelOf(d.byType).replace(/^THE /, '')} ENDS IT` : `THE LAST ${labelOf(d ? d.type : 'soldier').replace(/^THE /, '')} FALLS`) : `${TEAMS[this.winner].name} HOLDS THE FIELD`;
      if (k <= 0) return;
      ctx.save(); ctx.globalAlpha = out; ctx.translate(VW / 2, AR.y + AR.h - 175); ctx.rotate(-0.03); ctx.scale(k, k);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = font(92, 800); spaced(ctx, 6);
      const w1 = ctx.measureText(big).width, sc1 = Math.min(1, 780 / w1);
      ctx.save(); ctx.scale(sc1, sc1);
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,60,60,0.55)'; ctx.fillText(big, -4, 0); ctx.fillStyle = 'rgba(60,200,255,0.55)'; ctx.fillText(big, 4, 0);
      ctx.globalCompositeOperation = 'source-over'; strokeText(ctx, big, 0, 0, '#FFFFFF', COL.ink, 12);
      ctx.restore();
      spaced(ctx, 2); ctx.font = font(36, 800);
      const w2 = ctx.measureText(sub).width, sc2 = Math.min(1, 760 / w2);
      ctx.scale(sc2, sc2); strokeText(ctx, sub, 0, 70, kt ? kt.c : COL.gold, COL.ink, 9);
      spaced(ctx, 0); ctx.restore(); ctx.textBaseline = 'alphabetic';
    },
    // how high a troop is thrown by an earthquake (looks only)
    quakeHop(u) { const k = (this.t - u.qT) / 0.6; return k > 0 && k < 1 ? Math.sin(Math.PI * k) * 36 : 0; },
    // the earthquake, made visible: the ground rips open bit by bit, dust and rocks fly, troops near it are thrown up (looks only)
    quakeFx(ev) {
      const p = clamp((ev.t - 0.25) / 0.9, 0, 1), n = ev.pts.length - 1, i = Math.min(n, Math.floor(p * n));
      if (p > 0 && p < 1 && i !== ev.fxI) {
        ev.fxI = i; const [x, y] = ev.pts[i];
        this.burst(x, y, '#8A7458', 7, 260, 0.8, 9, 240); this.burst(x, y, '#5B4B3A', 4, 340, 0.9, 12, 520); this.burst(x, y, '#C9B79A', 5, 90, 1.4, 16, -40);
        this.shake(14);
      }
      if (ev.hit && !ev.hopped) {
        ev.hopped = true;
        for (const u of this.units) if (!u.dead && !u.flying) {
          let best = Infinity;
          for (let k = 0; k < n; k++) { const [ax, ay] = ev.pts[k], [bx, by] = ev.pts[k + 1], vx = bx - ax, vy = by - ay, f = clamp(((u.x - ax) * vx + (u.y - ay) * vy) / (vx * vx + vy * vy), 0, 1); best = Math.min(best, Math.hypot(u.x - ax - vx * f, u.y - ay - vy * f)); }
          if (best < 110) u.qT = this.t + best / 400;
        }
      }
    },
    // ----- spreading fire (rules.world.fire): explosions and fire attacks set the grass alight; it spreads cell by cell and burns out -----
    initFire() {
      this.FR = rng(((this.seed >>> 0) ^ 0xF17E5) >>> 0);
      this.fireG = new Map(); this.fireBurnt = new Map(); this.fireAt = 0;
      this.fireOn = !NOFIRE[this.opts.map];
    },
    ignite(x, y, chance) {
      if (!this.fireOn || x < AR.x || x > AR.x + AR.w || y < AR.y || y > AR.y + AR.h) return;
      const cx = (x - AR.x) / FIRE_CELL | 0, cy = (y - AR.y) / FIRE_CELL | 0, key = cx * 64 + cy, T = this.fightT;
      if (this.fireG.has(key) || (this.fireBurnt.get(key) || 0) > T || this.fireG.size >= 26 || T < 6 || !this.FR.chance(chance)) return;
      this.fireG.set(key, { cx, cy, t0: T, end: T + this.FR.range(3, 4.5) });
      if (!this.fireSaid && this.fireG.size >= 5) { this.fireSaid = true; if (!this.chapter('THE GRASS IS ON FIRE', '#FF8A3D')) this.banner('THE GRASS IS ON FIRE!', '#FF8A3D', 1.4); this.xf.fire = true; }
    },
    fireTick() {
      const T = this.fightT;
      if (!this.fireG.size || T < this.fireAt) return;
      this.fireAt = T + 0.5;
      const cols = Math.ceil(AR.w / FIRE_CELL), rows = Math.ceil(AR.h / FIRE_CELL), add = [];
      for (const [key, c] of this.fireG) {
        if (T >= c.end) {
          this.fireG.delete(key); this.fireBurnt.set(key, T + 20);
          if (this.stains) { const g = this.stains.getContext('2d'); g.fillStyle = 'rgba(20,14,8,0.35)'; g.beginPath(); g.arc(c.cx * FIRE_CELL + FIRE_CELL / 2, c.cy * FIRE_CELL + FIRE_CELL / 2, FIRE_CELL * 0.62, 0, TAU); g.fill(); }
          continue;
        }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = c.cx + dx, ny = c.cy + dy; if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && this.FR.chance(0.13)) add.push([nx, ny]); }
      }
      for (const [nx, ny] of add) this.ignite(AR.x + nx * FIRE_CELL + 1, AR.y + ny * FIRE_CELL + 1, 1);
      // anyone standing in the flames catches fire (both sides alike)
      for (const u of this.units) {
        if (u.dead || u.flying || UNIT[u.type].fireproof) continue;
        const key = ((u.x - AR.x) / FIRE_CELL | 0) * 64 + ((u.y - AR.y) / FIRE_CELL | 0);
        if (this.fireG.has(key)) this.burn(u, 0.8, 1.5, null);
      }
    },
    drawFire(ctx) {
      const t = this.t;
      ctx.save();
      for (const c of this.fireG.values()) {
        const x = AR.x + c.cx * FIRE_CELL + FIRE_CELL / 2, y = AR.y + c.cy * FIRE_CELL + FIRE_CELL / 2, life = clamp(Math.min((this.fightT - c.t0) / 0.6, (c.end - this.fightT) / 0.8), 0, 1);
        ctx.globalAlpha = 0.35 * life; ctx.fillStyle = '#2A1408'; ctx.beginPath(); ctx.arc(x, y, FIRE_CELL * 0.62, 0, TAU); ctx.fill();
        ctx.globalAlpha = life;
        for (let k = 0; k < 3; k++) {
          const ox = (hash01(c.cx * 7 + k, c.cy) - 0.5) * FIRE_CELL * 0.8, oy = (hash01(c.cy * 5 + k, c.cx) - 0.5) * FIRE_CELL * 0.6;
          const fl = 0.75 + 0.25 * Math.sin(t * 14 + k * 2 + c.cx), h = (14 + 8 * hash01(k, c.cx + c.cy)) * fl;
          ctx.beginPath(); ctx.moveTo(x + ox - 7, y + oy + 4); ctx.quadraticCurveTo(x + ox - 6, y + oy - h * 0.5, x + ox, y + oy - h); ctx.quadraticCurveTo(x + ox + 6, y + oy - h * 0.5, x + ox + 7, y + oy + 4); ctx.closePath();
          ctx.fillStyle = '#FF6B1A'; ctx.fill();
          ctx.beginPath(); ctx.moveTo(x + ox - 3.5, y + oy + 3); ctx.quadraticCurveTo(x + ox - 3, y + oy - h * 0.3, x + ox, y + oy - h * 0.6); ctx.quadraticCurveTo(x + ox + 3, y + oy - h * 0.3, x + ox + 3.5, y + oy + 3); ctx.closePath();
          ctx.fillStyle = '#FFD45A'; ctx.fill();
        }
      }
      ctx.restore();
    },
    // damage you can see: scuffs and cracks on hurt troops, smoke from damaged machines (looks only)
    drawWear(ctx, u, x, y) {
      const U = UNIT[u.type], hurt = 1 - u.hp / u.max, r = u.r;
      if (hurt < 0.35 || U.uncounted) return;
      if (MACHINE[u.type] || U.rank === 0) {
        if (hurt > 0.5) {
          for (let k = 0; k < 3; k++) {
            const p = ((this.t * 0.9 + k / 3 + hash01(k, u.gait)) % 1), sx = x + (hash01(k, u.gait * 3) - 0.5) * r * 0.8 + p * 10, sy = y - p * (r + 40);
            ctx.beginPath(); ctx.arc(sx, sy, 5 + p * 13, 0, TAU); ctx.fillStyle = `rgba(${hurt > 0.75 ? '30,30,34' : '90,92,100'},${0.5 * (1 - p)})`; ctx.fill();
          }
          if (hurt > 0.75 && ((this.t * 10 + u.gait * 10) | 0) % 4 === 0) { ctx.beginPath(); ctx.arc(x + (hash01(3, u.gait) - 0.5) * r, y + (hash01(4, u.gait) - 0.5) * r, 3, 0, TAU); ctx.fillStyle = '#FFD45A'; ctx.fill(); }
        }
        if (MACHINE[u.type]) return;
      }
      if (U.mount || U.flying || r > 24) return;
      const n = hurt > 0.8 ? 3 : hurt > 0.6 ? 2 : 1, S = this._scr || (this._scr = []), seed = u.wearK || (u.wearK = [0, 1, 2].map(k => [hash01(k + 1, u.gait) * TAU, 1.2 + hash01(k, u.gait * 2)]));
      for (let k = 0; k < n; k++) {
        const a = seed[k][0], cx = x + Math.cos(a) * r * 0.35, cy = y + Math.sin(a) * r * 0.35, b = a + seed[k][1], l = r * 0.42, c = Math.cos(b) * l, sn = Math.sin(b) * l;
        S.push(cx - c, cy - sn, cx + c, cy + sn);
      }
    },
  };
  // ----- smarter fighting (rules.combat.smart) -----
  const ARMY_SMART = {
    // how many troops are already going for each enemy (counted five times a second)
    smartPick(u, U) {
      const T = this.fightT;
      if (T >= (this.tgtAt || 0)) {
        this.tgtAt = T + 0.2; const m = this.tgtN = new Map();
        for (const o of this.units) if (!o.dead && o.target && !o.target.dead) m.set(o.target, (m.get(o.target) || 0) + 1);
      }
      return { melee: !U.ranged && !U.healer && U.rank !== 0, fast: !U.ranged && U.speed >= 105 && U.rank !== 0 };
    },
    smartScore(u, o, O, d, sm) {
      const n = Math.min(5, this.tgtN.get(o) || 0) - (u.target === o ? 1 : 0);
      // a big unit can take more attackers before it counts as crowded
      if (sm.melee && n > 0) d *= 1 + 0.45 * n / (O.rank === 0 ? 3 : 1);
      // your own lane: enemies straight ahead count as nearer than ones far to the side
      if (this.N === 2 && sm.melee) d += (o.x - u.x) ** 2 * 0.6;
      // fast fighters hunt shooters and healers round the side
      if (sm.fast && (O.ranged || O.healer) && d < 420000) d *= 0.45;
      return d;
    },
    // how a troop moves: hold a front instead of everyone running to one point, fast fighters swing round the flank,
    // and a badly hurt fighter steps back behind his friends for a moment
    smartMove(u, U, t, dvx, dvy) {
      this.sdx = dvx; this.sdy = dvy;
      if (U.ranged || U.healer || U.rank === 0 || u.duelist || UNIT[u.type].king || u.flying) return;
      const T = this.fightT, dx = t.x - u.x, dy = t.y - u.y, d = Math.hypot(dx, dy) || 1, sp = Math.hypot(dvx, dvy);
      if (u.fallT > T) {
        const k = U.speed * this.speedMul * 0.8;
        this.sdx = -dx / d * k; this.sdy = -dy / d * k + (u.team === 0 ? -1 : u.team === 1 ? 1 : 0) * k * 0.3; return;
      }
      if (u.hp < u.max * 0.22 && T >= (u.fbAt || 0) && T < (this.cap || 99) - 8 && !(u.tribe && u.tribe.chief === u)) {
        u.fbAt = T + 9;
        let friends = 0; for (const o of this.near(u.x, u.y, 80)) if (o.team === u.team && o !== u) friends++;
        if (friends >= 2) { u.fallT = T + 1.2; this.callout(u, 'FALL BACK', '#93C5FD'); return; }
      }
      if (!sp || d - u.r - t.r <= (U.reach || 5) + 4) return;
      const nx = dx / d, ny = dy / d;
      let ax = nx, ay = ny;
      if (U.speed >= 105) {
        // swing round the side on the way in (which side is fixed per troop)
        const side = u.gait > Math.PI ? 1 : -1, w = 0.7 * clamp((d - 70) / 220, 0, 1);
        ax += -ny * side * w; ay += nx * side * w;
      } else if (this.N === 2 && d > 150) {
        // keep the front: walk forward more than inward, so the armies meet along a line, not in one heap
        const fwd = u.team === 0 ? 1 : -1, w = 0.45 * clamp((d - 150) / 250, 0, 1);
        ax = ax * (1 - w); ay = ay * (1 - w) + fwd * w;
      }
      const al = Math.hypot(ax, ay) || 1;
      this.sdx = ax / al * sp; this.sdy = ay / al * sp;
    },
  };
  // ----- the third batch's moves (ARMY_CAST3) and drawings -----
  const SHOT3 = { pie: 1, confetti: 1, bomb: 1, axe: 1 };
  // two little eyes looking the way the troop faces
  function eyes3(ctx, x, y, r, f, look) {
    const fx = Math.cos(f), fy = Math.sin(f), px = -fy, py = fx, ex = x + fx * r * 0.42, ey = y + fy * r * 0.42, sp = r * 0.34, er = Math.max(1.8, r * 0.17);
    for (const sd of [-1, 1]) {
      const cx = ex + px * sp * sd, cy = ey + py * sp * sd;
      ctx.beginPath(); ctx.arc(cx, cy, er, 0, TAU); ctx.fillStyle = look || '#FFFFFF'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = COL.ink; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + fx * er * 0.35, cy + fy * er * 0.35, er * 0.55, 0, TAU); ctx.fillStyle = COL.ink; ctx.fill();
    }
  }
  const ARMY_CAST3 = {
    extUnit3(u, U) {
      this.cast3on = true;
      const C = this.C3 || (this.C3 = rng(((this.seed >>> 0) ^ 0xCA5735) >>> 0));
      u.abT = this.fightT + 2 + C.range(0, 2.5);
      if (U.ambush) u.disguised = true;
      if (U.reload) u.ammo = U.reload;
    },
    enemiesNear(u, x, y, r) { return this.near(x, y, r).filter(o => o.team !== u.team && !o.dead && !o.phased && !UNIT[o.type].uncounted); },
    alliesNear(u, x, y, r) { return this.near(x, y, r).filter(o => o.team === u.team && !o.dead && o !== u && !UNIT[o.type].uncounted); },
    back3(u) { return this.N === 2 ? (u.team === 0 ? -1 : 1) : 0; },
    // returns true when the troop shouldn't do its normal moves this tick
    ability3(u, U, h, t) {
      const T = this.fightT, C = this.C3, pan = (u.x - AR.x) / AR.w * 1.4 - 0.7, ready = T >= u.abT;
      if (U.ambush && u.disguised) {
        u.vx = 0; u.vy = 0;
        if (this.enemiesNear(u, u.x, u.y, 90).length) this.reveal3(u);
        return u.disguised;
      }
      if (U.dive && u.diveT0 !== undefined) {
        const k = (T - u.diveT0) / 0.55;
        if (k < 1) { u.x = u.dsx + (u.dtx - u.dsx) * k; u.y = u.dsy + (u.dty - u.dsy) * k; u.lift = Math.sin(Math.PI * k) * 60; u.face = Math.atan2(u.dty - u.dsy, u.dtx - u.dsx); return true; }
        u.lift = 0; u.diveT0 = undefined;
        this.explode({ team: u.team, kind: 'slam', x: u.x, y: u.y, splash: 62, dmg: 3, from: u }); this.shake(6);
        return false;
      }
      if (u.hooking) {
        const o = u.hooking, k = (T - u.hookT0) / 0.35;
        if (o.dead || k >= 1) { if (!o.dead) { o.stunT = Math.max(o.stunT || 0, T + 0.5); if (this.obstacles.length && !o.flying) this.pushOut(o); } u.hooking = null; }
        else { const d = Math.hypot(u.x - o.hsx, u.y - o.hsy) || 1, tx = u.x + (o.hsx - u.x) / d * (u.r + o.r + 4), ty = u.y + (o.hsy - u.y) / d * (u.r + o.r + 4); o.x = o.hsx + (tx - o.hsx) * easeOutCubic(k); o.y = o.hsy + (ty - o.hsy) * easeOutCubic(k); o.vx = 0; o.vy = 0; }
      }
      if (U.howl && !u.wolf && u.hp < u.max * 0.5) {
        u.wolf = true; u.r = 18; u.m = u.r * u.r; u.max *= 1.5; u.hp = u.max * 0.7; u.dmgK = (u.dmgK || 1) * 1.8; u.spdK = (u.spdK || 1) * 1.3;
        this.callout(u, 'AWOOOO!', '#FDE68A'); this.snd('roar', { pan }); this.burst(u.x, u.y, '#6B7280', 14, 220, 0.6, 7);
        if (this.camEv) this.camEv.push({ type: 'spot', follow: u, prio: 58, dur: 1.8, z: 2 });
      }
      if (U.reload) {
        if (u.cd > (u.lastCd ?? 0) + 0.05) { u.ammo--; if (u.ammo <= 0) { u.ammo = U.reload; u.cd += 2.2; if (T >= (u.relSaid || 0)) { u.relSaid = T + 6; this.callout(u, 'RELOAD', '#E5E7EB'); } } }
        u.lastCd = u.cd;
      }
      if (!ready) return false;
      if (U.build && (u.built || 0) < 2) {
        u.abT = T + U.build; u.built = (u.built || 0) + 1;
        const x = clamp(u.x + C.range(-24, 24), AR.x + 20, AR.x + AR.w - 20), y = clamp(u.y + this.back3(u) * 30, AR.y + 20, AR.y + AR.h - 20);
        this.spawnQ.push({ at: T + 0.5, team: u.team, type: 'watchtower', x, y }); u.lunge = 1;
        this.burst(x, y, '#A8916B', 10, 140, 0.6, 6); this.callout(u, 'BUILDING', '#FCD34D'); this.snd('thud', { pan });
      } else if (U.keg && t && Math.hypot(t.x - u.x, t.y - u.y) < u.r + t.r + 8) {
        this.explode({ team: u.team, kind: 'bomb', x: u.x, y: u.y, splash: U.keg, dmg: U.dmg, from: u }); this.shake(8);
        u.keged = true; this.damage(u, u.hp + 99, null); return true;
      } else if (U.summon) {
        u.abT = T + U.summon;
        let n = 0; for (const o of this.units) if (o.type === 'bonelet' && o.team === u.team && !o.dead) n++;
        if (n < 12) {
          for (let k = 0; k < 3; k++) { const a = C.range(0, TAU); this.spawnQ.push({ at: T + 0.4 + k * 0.1, team: u.team, type: 'bonelet', x: u.x + Math.cos(a) * 30, y: u.y + Math.sin(a) * 30, rise: true }); }
          this.callout(u, 'RISE!', '#7CFFB0'); this.burst(u.x, u.y, '#7CFFB0', 10, 160, 0.5, 6);
        }
      } else if (U.totem && (u.built || 0) < 3) {
        u.abT = T + U.totem; u.built = (u.built || 0) + 1;
        this.spawnQ.push({ at: T + 0.4, team: u.team, type: 'totem', x: clamp(u.x + Math.cos(u.face) * 24, AR.x + 20, AR.x + AR.w - 20), y: clamp(u.y + Math.sin(u.face) * 24, AR.y + 20, AR.y + AR.h - 20) });
        this.callout(u, 'WAR TOTEM', '#F59E0B'); this.snd('drum', { pan });
      } else if (U.pop3d) {
        u.abT = T + U.pop3d; u.d3T = T + 2.5; this.d3T = Math.max(this.d3T || 0, T + 2.5);
        this.callout(u, 'GOES 3D', '#7CF3FF'); this.snd('whoosh', { pan });
        if (this.camEv) this.camEv.push({ type: 'spot', follow: u, prio: 62, dur: 2.2, z: 2, slow: true });
      } else if (U.hook && !u.hooking) {
        const o = this.enemiesNear(u, u.x, u.y, 260).filter(o => (UNIT[o.type].ranged || UNIT[o.type].healer) && UNIT[o.type].rank !== 0 && !o.flying && !UNIT[o.type].immovable).sort((a, b) => Math.hypot(b.x - u.x, b.y - u.y) - Math.hypot(a.x - u.x, a.y - u.y))[0];
        if (o) { u.abT = T + U.hook; u.hooking = o; u.hookT0 = T; o.hsx = o.x; o.hsy = o.y; this.callout(u, 'GET OVER HERE', '#CBD5E1'); this.snd('whoosh', { pan }); } else u.abT = T + 1;
      } else if (U.bees) {
        const o = this.enemiesNear(u, u.x, u.y, 330).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
        if (o) { u.abT = T + U.bees; (this.swarms || (this.swarms = [])).push({ x: u.x, y: u.y, tgt: o, team: u.team, end: T + 4.5, by: u, next: 0 }); this.callout(u, 'BEES!', '#FDE047'); } else u.abT = T + 1;
      } else if (U.feast) {
        const list = this.alliesNear(u, u.x, u.y, 170).filter(o => o.hp < o.max * 0.85).sort((a, b) => a.hp / a.max - b.hp / b.max).slice(0, 4);
        u.abT = T + (list.length ? U.feast : 1.5);
        for (const o of list) { this.heal(o, o.max * 0.3); this.beams.push({ x0: u.x, y0: u.y, x1: o.x, y1: o.y, t0: this.fightT, life: 0.35, col: '#FDE68A', w: 3 }); }
        if (list.length) this.callout(u, 'FEAST!', '#FDE68A');
      } else if (U.jet) {
        if (this.enemiesNear(u, u.x, u.y, 80).length) { u.abT = T + U.jet; this.lobAt(u, u.x + C.range(-10, 10), u.y + C.range(-10, 10), 'grenade', 2.5, 42, 260); } else u.abT = T + 0.5;
      } else if (U.foresee) {
        const o = this.enemiesNear(u, u.x, u.y, 420).sort((a, b) => UNIT[b.type].cost * b.hp / b.max - UNIT[a.type].cost * a.hp / a.max)[0];
        if (o) {
          u.abT = T + U.foresee; o.markT = T + 5;
          for (const a of this.alliesNear(u, o.x, o.y, 320)) if (!UNIT[a.type].healer) { a.target = o; a.retarget = 1.5; }
          this.callout(u, 'I FORESEE IT', '#C4B5FD'); this.beams.push({ x0: u.x, y0: u.y, x1: o.x, y1: o.y, t0: this.fightT, life: 0.4, col: '#C4B5FD', w: 3 });
        } else u.abT = T + 1;
      } else if (U.stomp) {
        if (this.enemiesNear(u, u.x, u.y, 100).length >= 2) {
          u.abT = T + U.stomp;
          this.explode({ team: u.team, kind: 'slam', x: u.x, y: u.y, splash: 100, dmg: 2.5, from: u });
          for (const o of this.enemiesNear(u, u.x, u.y, 115)) { this.knock(o, u.x, u.y, 36); if (UNIT[o.type].rank !== 0) o.stunT = Math.max(o.stunT || 0, T + 0.5); }
          this.callout(u, 'STOMP', '#FCA5A5'); this.shake(7);
        } else u.abT = T + 0.4;
      } else if (U.sleep) {
        const o = this.enemiesNear(u, u.x, u.y, 300)[0];
        if (o) {
          u.abT = T + U.sleep;
          for (const v of this.enemiesNear(u, o.x, o.y, 85)) if (UNIT[v.type].rank !== 0) { v.sleepT = T + 2.5; v.stunT = Math.max(v.stunT || 0, T + 2.5); }
          this.burst(o.x, o.y, '#F5DEB3', 16, 120, 0.9, 7, -30); this.callout(u, 'SLEEP...', '#F5DEB3');
        } else u.abT = T + 1;
      } else if (U.dive && !u.hooking) {
        const o = this.enemiesNear(u, u.x, u.y, 330).filter(o => Math.hypot(o.x - u.x, o.y - u.y) > 110)[0];
        if (o) { u.abT = T + U.dive; u.diveT0 = T; u.dsx = u.x; u.dsy = u.y; u.dtx = o.x; u.dty = o.y; this.callout(u, 'DIVE!', '#FDE68A'); this.snd('whoosh', { pan }); } else u.abT = T + 0.8;
      } else if (U.bubble) {
        const o = this.alliesNear(u, u.x, u.y, 170).filter(o => o.hp < o.max * 0.7).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
        if (o) { u.abT = T + U.bubble; o.shieldT = T + 3; this.callout(o, 'HOLY SHIELD', '#FDE68A'); } else u.abT = T + 1;
      } else if (U.clones && t && Math.hypot(t.x - u.x, t.y - u.y) < 260) {
        u.abT = T + U.clones;
        for (const sd of [-1, 1]) this.makeDecoy(u.team, u.x - Math.sin(u.face) * 26 * sd, u.y + Math.cos(u.face) * 26 * sd, 'illusion', 4, u);
        this.callout(u, 'SHADOW CLONES', '#A78BFA');
      } else if (U.gaze) {
        const o = this.enemiesNear(u, u.x, u.y, 260).filter(o => UNIT[o.type].rank !== 0)[0];
        if (o) { u.abT = T + U.gaze; o.stunT = Math.max(o.stunT || 0, T + 2.5); o.stoneT3 = T + 2.5; this.beams.push({ x0: u.x, y0: u.y, x1: o.x, y1: o.y, t0: this.fightT, life: 0.4, col: '#86EFAC', w: 4 }); this.callout(o, 'TURNED TO STONE', '#D1D5DB'); }
        else u.abT = T + 1;
      } else if (U.chrono && !u.chronoUsed && T > (this.cap || 60) * 0.7) {
        // nobody important fell: he rewinds the wounds of everyone around him instead
        u.chronoUsed = true;
        for (const o of this.alliesNear(u, u.x, u.y, 170).concat([u])) o.hp = o.max;
        (this.rewinds || (this.rewinds = [])).push({ x: u.x, y: u.y, t0: this.t, r: 170 }); this.callout(u, 'REWIND!', '#7DD3FC'); this.snd('whoosh', { pan });
      } else u.abT = T + 1;
      return false;
    },
    reveal3(u) {
      u.disguised = false; u.bite = true; this.callout(u, 'MIMIC!', '#FCA5A5'); this.snd('roar', { pan: 0 }); this.burst(u.x, u.y, '#C08A3E', 10, 160, 0.5, 6);
    },
    // a troop of this batch was hit or hit someone
    hit3(u, from, dmg) {
      const T = this.fightT;
      if (u.sleepT > T) { u.sleepT = 0; u.stunT = 0; }
      if (u.disguised) this.reveal3(u);
      if (from.type === 'goblin' && u.tribe && from.tribe && u.tribe.gold >= 1) { u.tribe.gold -= 1; from.tribe.gold += 1; }
      if (from.d3T > T) this.knock(u, from.x, from.y, 26);
      if (UNIT[from.type].laugh && UNIT[u.type].rank !== 0) { u.stunT = Math.max(u.stunT || 0, T + UNIT[from.type].laugh); if (T >= (this.laughSaid || 0)) { this.laughSaid = T + 2; this.callout(u, 'HA HA HA', '#F472B6'); } }
      if (UNIT[from.type].chain && !this._chain3) {
        this._chain3 = true;
        let last = u;
        for (const o of this.enemiesNear(from, u.x, u.y, 110).filter(o => o !== u).slice(0, 2)) { this.damage(o, UNIT[from.type].dmg * 0.6, from); this.beams.push({ x0: last.x, y0: last.y, x1: o.x, y1: o.y, t0: this.fightT, life: 0.25, col: '#93C5FD', w: 3 }); last = o; }
        this._chain3 = false;
      }
    },
    // how hard a hit lands, for this batch: 3D punches, backstabs, the mimic's first bite, marks, shields, shield walls, the juggernaut
    dmg3(u, from) {
      const T = this.fightT, F = UNIT[from.type], U = UNIT[u.type]; let k = 1;
      if (from.d3T > T) k *= 3;
      if (F.backstab) { let df = Math.atan2(from.y - u.y, from.x - u.x) - u.face; df = Math.abs(Math.atan2(Math.sin(df), Math.cos(df))); if (df > 2.0) k *= F.backstab; }
      if (from.bite) { k *= 3; from.bite = false; }
      if (u.markT > T) k *= 1.4;
      if (u.shieldT > T) k *= 0.35;
      if (U.jugg) k *= 0.55 + 0.45 * clamp(u.hp / u.max, 0, 1);
      if (U.wall) {
        let df = Math.atan2(from.y - u.y, from.x - u.x) - u.face; df = Math.abs(Math.atan2(Math.sin(df), Math.cos(df)));
        if (df < 1.2) { let n = 0; for (const o of this.near(u.x, u.y, 50)) if (o !== u && o.team === u.team && o.type === 'phalanx' && !o.dead) n++; if (n >= 2) k *= 0.5; }
      }
      return k;
    },
    // the Time Traveller: when a king, a chief, a champion or a giant on his side falls, he goes back in time and saves them (once)
    timeSave(u) {
      const U = UNIT[u.type];
      if (!(U.king || u.boss || U.rank === 0 || u.champ || (u.tribe && u.tribe.chief === u))) return false;
      const tt = this.units.find(o => o.type === 'timetraveller' && o.team === u.team && !o.dead && !o.chronoUsed);
      if (!tt) return false;
      tt.chronoUsed = true; u.hp = u.max * 0.6; u.dead = false;
      const a = Math.atan2(tt.y - u.y, tt.x - u.x); tt.x = u.x + Math.cos(a) * (u.r + tt.r + 6); tt.y = u.y + Math.sin(a) * (u.r + tt.r + 6);
      (this.rewinds || (this.rewinds = [])).push({ x: u.x, y: u.y, t0: this.t, r: 90 });
      const who = U.king ? 'KING' : u.tribe && u.tribe.chief === u ? 'CHIEF' : labelOf(u.type).replace(/^THE /, '');
      if (!this.chapter || !this.chapter(`THE TIME TRAVELLER SAVES THE ${who}`, '#7DD3FC')) this.banner(`TIME TRAVELLER SAVES THE ${who}!`, '#7DD3FC', 1.8);
      this.snd('whoosh', { pan: 0 }); if (this.camEv) this.camEv.push({ type: 'spot', x: u.x, y: u.y, prio: 82, dur: 2.2, z: 2.1, slow: true });
      (this.xf || (this.xf = {})).timesave = who;
      return true;
    },
    // bee swarms chase their target and sting everyone near it
    cast3Tick(h) {
      const T = this.fightT;
      if (!this.swarms || !this.swarms.length) return;
      for (const s of this.swarms) {
        if (s.tgt.dead) { const o = this.near(s.x, s.y, 200).find(o => o.team !== s.team && !o.dead && !UNIT[o.type].uncounted); if (o) s.tgt = o; else { s.end = 0; continue; } }
        const dx = s.tgt.x - s.x, dy = s.tgt.y - s.y, d = Math.hypot(dx, dy) || 1, v = Math.min(d, 170 * h);
        s.x += dx / d * v; s.y += dy / d * v;
        if (d < 40 && T >= s.next) { s.next = T + 0.5; for (const o of this.near(s.x, s.y, 38)) if (o.team !== s.team && !o.dead) this.poison(o, 0.9, 1.5, s.by); }
      }
      this.swarms = this.swarms.filter(s => T < s.end);
    },
  };
  Object.assign(SPEC, {
    builder: 'BUILDS WATCHTOWERS', watchtower: 'SHOOTS FROM A TOWER', bomber: 'BLOWS UP ON CONTACT', gravewitch: 'RAISES SKELETONS', bonelet: 'FAST, ONE HIT', shaman: 'PLANTS WAR TOTEMS',
    totem: 'FRIENDS HIT HARDER', goblin: 'BACKSTABS, STEALS GOLD', timetraveller: 'SAVES THE KING IN TIME', mr3d: 'GOES 3D: TRIPLE DAMAGE', juggernaut: 'TOUGHER WHEN HURT',
    hookman: 'HOOKS SHOOTERS IN', bard: 'SONGS SPEED UP FRIENDS', beekeeper: 'RELEASES BEE SWARMS', chef: 'PIES SLOW, FEASTS HEAL', jester: 'MAKES ENEMIES LAUGH',
    mimic: 'A CHEST THAT BITES', jetpack: 'FLIES, DROPS GRENADES', werewolf: 'TURNS INTO A WOLF', oracle: 'MARKS THE BIG THREAT', balloon: 'BOMBS FROM THE SKY',
    sumo: 'STOMPS EVERYONE BACK', sandman: 'PUTS ENEMIES TO SLEEP', valkyrie: 'DIVES FROM THE SKY', paladin: 'SHIELDS THE WOUNDED', pyro: 'SPRAYS FIRE',
    medicdrone: 'FLYING HEALER', yeti: 'THROWS ICE, SLOWS', shadowninja: 'MAKES SHADOW CLONES', gunslinger: 'SIX FAST SHOTS', axethrower: 'THROWS SPINNING AXES',
    gorgon: 'TURNS FOES TO STONE', phalanx: 'SHIELD WALL', tesla: 'LIGHTNING JUMPS' });
  Object.assign(STYLE, { juggernaut: 'crush', sumo: 'crush', mimic: 'crush', phalanx: 'thrust', valkyrie: 'blade', paladin: 'crush', werewolf: 'agile', goblin: 'agile', shadowninja: 'blade', timetraveller: 'blade', mr3d: 'crush', hookman: 'cleave', builder: 'crush', bonelet: 'blade' });
  const ARMY_CAST3_DRAW = {
    // one troop of the third batch (flat cartoon, black outlines, the army's colour on the body)
    drawCast3(ctx, u, x, y, tm) {
      const r = u.r, f = u.face, fx = Math.cos(f), fy = Math.sin(f), px = -fy, py = fx, T = this.fightT, ink = COL.ink;
      const P = (a, b) => [x + fx * a + px * b, y + fy * a + py * b];
      const line = (a0, b0, a1, b1, w, c) => { const [x0, y0] = P(a0, b0), [x1, y1] = P(a1, b1); stick(ctx, x0, y0, x1, y1, w, c); };
      const body = (fill) => disc(ctx, x, y, r, fill || tm.c, 2.5);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      switch (u.type) {
        case 'builder': {
          line(r * 0.2, r * 0.8, r * 1.5, r * 0.95, 3, COL.wood); const [hx, hy] = P(r * 1.55, r * 0.95); ctx.save(); ctx.translate(hx, hy); ctx.rotate(f + 1.2 * (u.lunge || 0)); roundRect(ctx, -6, -4, 12, 8, 2); ctx.fillStyle = COL.steel; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.stroke(); ctx.restore();
          body(); ctx.beginPath(); ctx.arc(x - fx * r * 0.15, y - fy * r * 0.15, r * 0.78, f + Math.PI * 0.5, f + Math.PI * 1.5); ctx.fillStyle = '#FACC15'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.stroke();
          eyes3(ctx, x, y, r, f); break;
        }
        case 'watchtower': {
          roundRect(ctx, x - r, y - r, r * 2, r * 2, 4); ctx.fillStyle = COL.wood; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = ink; ctx.stroke();
          for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.fillStyle = '#5B3A1E'; ctx.fillRect(x + a * r * 0.7 - 3, y + b * r * 0.7 - 3, 6, 6); }
          disc(ctx, x, y, r * 0.55, tm.c, 2); line(0, 0, r * 0.95, 0, 2.5, COL.wood); break;
        }
        case 'bomber': {
          body(); const [bx, by] = P(r * 0.85, 0); disc(ctx, bx, by, r * 0.62, '#7C4A1E', 2.5); ctx.strokeStyle = '#4A2A10'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(bx, by, r * 0.62, f - 1.2, f + 1.2); ctx.stroke();
          const [sx, sy] = P(r * 1.45, 0); const fl = 0.6 + 0.4 * Math.sin(this.t * 30 + u.gait); disc(ctx, sx, sy, 3.5 * fl + 1.5, '#FFD45A', 0); disc(ctx, sx, sy, 1.8, '#FFFFFF', 0);
          ctx.beginPath(); ctx.arc(x, y, r * 0.95, f + 2.2, f + 4.1); ctx.lineWidth = 3; ctx.strokeStyle = '#B91C1C'; ctx.stroke(); eyes3(ctx, x, y, r * 0.9, f); break;
        }
        case 'gravewitch': {
          body('#2E1F3A'); disc(ctx, x, y, r * 0.72, tm.c, 2); ctx.beginPath(); const [ax, ay] = P(r * 0.1, 0); ctx.moveTo(ax + px * r * 0.9, ay + py * r * 0.9); ctx.lineTo(x - fx * r * 1.25, y - fy * r * 1.25); ctx.lineTo(ax - px * r * 0.9, ay - py * r * 0.9); ctx.closePath(); ctx.fillStyle = '#2E1F3A'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.stroke();
          line(-r * 0.2, -r * 0.9, r * 1.4, -r * 0.9, 2.5, '#6B5B4B'); const [kx, ky] = P(r * 1.45, -r * 0.9); disc(ctx, kx, ky, 4.5, '#E7E5E4', 1.5); disc(ctx, kx, ky, 2, '#7CFFB0', 0); eyes3(ctx, x, y, r * 0.8, f, '#B9FFD8'); break;
        }
        case 'bonelet': {
          disc(ctx, x, y, r, '#E7E5E4', 2); ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = tm.c; ctx.stroke();
          const [ex, ey] = P(r * 0.35, 0); for (const sd of [-1, 1]) disc(ctx, ex + px * r * 0.32 * sd, ey + py * r * 0.32 * sd, r * 0.18, ink, 0); line(r * 0.5, r * 0.6, r * 1.4, r * 0.7, 2, '#D6D3D1'); break;
        }
        case 'shaman': {
          body(); ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = f + Math.PI + (k - 2) * 0.32, [qx, qy] = [x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35]; ctx.moveTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7); ctx.lineTo(qx, qy); } ctx.lineWidth = 4; ctx.strokeStyle = ['#EF4444', '#F59E0B'][u.gait > 3 ? 1 : 0]; ctx.stroke();
          disc(ctx, x, y, r * 0.55, '#F5E6C8', 2); line(r * 0.1, r * 0.95, r * 1.5, r * 0.95, 2.5, COL.wood); const [kx, ky] = P(r * 1.55, r * 0.95); disc(ctx, kx, ky, 4, '#F59E0B', 1.5); eyes3(ctx, x, y, r * 0.75, f); break;
        }
        case 'totem': {
          roundRect(ctx, x - r * 0.7, y - r * 1.05, r * 1.4, r * 2.1, 4); ctx.fillStyle = '#8B5A2B'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = ink; ctx.stroke();
          ctx.fillStyle = tm.c; ctx.fillRect(x - r * 0.7, y - r * 0.2, r * 1.4, r * 0.4); ctx.strokeRect(x - r * 0.7, y - r * 0.2, r * 1.4, r * 0.4);
          for (const sd of [-1, 1]) disc(ctx, x + sd * r * 0.3, y - r * 0.6, 2.5, '#FDE047', 1);
          const pul = 0.5 + 0.5 * Math.sin(this.t * 4); ctx.beginPath(); ctx.arc(x, y, r + 5 + pul * 4, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(245,158,11,${0.4 + 0.3 * pul})`; ctx.stroke(); break;
        }
        case 'goblin': {
          for (const sd of [-1, 1]) { ctx.beginPath(); const [ax, ay] = P(-r * 0.1, sd * r * 0.7); ctx.moveTo(ax, ay); ctx.lineTo(...P(-r * 0.3, sd * r * 1.6)); ctx.lineTo(...P(r * 0.3, sd * r * 0.9)); ctx.closePath(); ctx.fillStyle = '#4D7C0F'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.stroke(); }
          disc(ctx, x, y, r, '#4D7C0F', 2.5); ctx.beginPath(); ctx.arc(x, y, r, f + 1.9, f + 4.4); ctx.lineTo(x, y); ctx.closePath(); ctx.fillStyle = tm.d; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.stroke();
          line(r * 0.4, r * 0.8, r * 1.4, r * 0.85, 2.5, COL.steel); eyes3(ctx, x, y, r, f, '#FDE047'); break;
        }
        case 'timetraveller': {
          body(); ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, TAU); ctx.fillStyle = '#F8FAFC'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.stroke();
          const a1 = this.t * 3 + u.gait, a2 = this.t * 0.4; stick(ctx, x, y, x + Math.cos(a1) * r * 0.5, y + Math.sin(a1) * r * 0.5, 1.8, ink); stick(ctx, x, y, x + Math.cos(a2) * r * 0.35, y + Math.sin(a2) * r * 0.35, 2.2, ink);
          line(r * 0.3, r * 0.85, r * 1.6, r * 0.9, 3, '#7DD3FC'); if (!u.chronoUsed) { ctx.beginPath(); ctx.arc(x, y, r + 4, 0, TAU); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(125,211,252,0.6)'; ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]); } break;
        }
        case 'mr3d': {
          const d3 = u.d3T > T;
          if (d3) { ctx.save(); ctx.globalAlpha = 0.6; disc(ctx, x - 5, y, r, '#FF3B5C', 0); disc(ctx, x + 5, y, r, '#2EE6FF', 0); ctx.restore(); }
          body(); const [gx, gy] = P(r * 0.38, 0);
          for (const [sd, c] of [[-1, '#FF3B5C'], [1, '#2EE6FF']]) { ctx.beginPath(); ctx.arc(gx + px * r * 0.34 * sd, gy + py * r * 0.34 * sd, r * 0.28, 0, TAU); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.stroke(); }
          stick(ctx, gx - px * r * 0.08, gy - py * r * 0.08, gx + px * r * 0.08, gy + py * r * 0.08, 2.5, ink);
          for (const sd of [-1, 1]) { const [hx, hy] = P(r * 0.75, sd * r * 0.8); disc(ctx, hx, hy, r * 0.3 * (d3 ? 1.4 : 1), '#F8FAFC', 2); } break;
        }
        case 'juggernaut': {
          body(COL.steel); disc(ctx, x, y, r * 0.78, tm.c, 2.5); disc(ctx, x, y, r * 0.48, '#4B5563', 2);
          for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; disc(ctx, x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, 2, '#D1D5DB', 1); }
          ctx.fillStyle = ink; const [vx, vy] = P(r * 0.3, 0); ctx.fillRect(vx - 2, vy - 2, 4, 4);
          line(r * 0.5, r * 0.9, r * 1.5, r * 1.05, 5, COL.wood); const [mx, my] = P(r * 1.6, r * 1.05); disc(ctx, mx, my, r * 0.4, '#6B7280', 2.5); break;
        }
        case 'hookman': {
          body(); disc(ctx, x - fx * r * 0.1, y - fy * r * 0.1, r * 0.55, '#B45309', 2); eyes3(ctx, x, y, r, f);
          if (!u.hooking) { line(r * 0.4, r * 0.85, r * 1.4, r * 0.95, 2.5, '#9CA3AF'); const [kx, ky] = P(r * 1.5, r * 0.95); ctx.beginPath(); ctx.arc(kx, ky, 5, f - 1.5, f + 1.8); ctx.lineWidth = 3; ctx.strokeStyle = COL.steel; ctx.stroke(); }
          break;
        }
        case 'bard': {
          body(); ell(ctx, ...P(r * 0.7, r * 0.6), r * 0.55, r * 0.4, f, '#C08A3E', 2); line(r * 0.9, r * 0.6, r * 1.7, r * 0.6, 2.5, '#5B3A1E');
          disc(ctx, x - fx * r * 0.15, y - fy * r * 0.15, r * 0.6, '#16A34A', 2); const [qx, qy] = P(-r * 0.2, -r * 0.6); ctx.beginPath(); ctx.moveTo(qx, qy); ctx.quadraticCurveTo(qx - fx * 14, qy - fy * 14, qx - fx * 18 - px * 8, qy - fy * 18 - py * 8); ctx.lineWidth = 2.5; ctx.strokeStyle = '#EF4444'; ctx.stroke(); eyes3(ctx, x, y, r, f); break;
        }
        case 'beekeeper': {
          body('#F5F0E1'); ctx.beginPath(); ctx.arc(x, y, r * 0.95, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = tm.c; ctx.stroke();
          ctx.save(); ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, TAU); ctx.clip(); ctx.strokeStyle = 'rgba(30,30,30,0.6)'; ctx.lineWidth = 1; for (let k = -6; k <= 6; k += 3) { ctx.beginPath(); ctx.moveTo(x + k, y - r); ctx.lineTo(x + k, y + r); ctx.stroke(); } ctx.restore();
          ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, TAU); ctx.lineWidth = 1.5; ctx.strokeStyle = ink; ctx.stroke(); const [jx, jy] = P(r * 0.85, r * 0.7); roundRect(ctx, jx - 5, jy - 5, 10, 10, 3); ctx.fillStyle = '#F59E0B'; ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke(); break;
        }
        case 'chef': {
          body('#F8FAFC'); ctx.beginPath(); ctx.arc(x, y, r * 0.98, f + 0.6, f + 5.7); ctx.lineWidth = 3; ctx.strokeStyle = tm.c; ctx.stroke();
          for (const [a, b] of [[-0.25, 0], [0, -0.35], [0, 0.35], [-0.35, -0.2], [-0.35, 0.2]]) { const [cx, cy] = P(a * r, b * r); disc(ctx, cx, cy, r * 0.32, '#FFFFFF', 1.5); }
          line(r * 0.5, r * 0.85, r * 1.5, r * 0.9, 3, COL.wood); const [sx, sy] = P(r * 1.6, r * 0.9); ell(ctx, sx, sy, 6, 4, f, '#9CA3AF', 1.5); eyes3(ctx, x, y, r, f); break;
        }
        case 'jester': {
          body(); for (const [sd, c] of [[-1, '#A855F7'], [1, '#FACC15']]) { const [hx, hy] = P(-r * 0.1, sd * r * 1.15); ctx.beginPath(); ctx.moveTo(...P(r * 0.2, sd * r * 0.4)); ctx.lineTo(hx, hy); ctx.lineTo(...P(-r * 0.5, sd * r * 0.4)); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.stroke(); disc(ctx, hx, hy, 3, '#FDE047', 1.2); }
          disc(ctx, x + fx * r * 0.1, y + fy * r * 0.1, r * 0.55, '#FFFFFF', 1.5); eyes3(ctx, x, y, r * 0.8, f); ctx.beginPath(); const [mx, my] = P(r * 0.55, 0); ctx.arc(mx, my, r * 0.22, f - 1.3, f + 1.3); ctx.lineWidth = 2; ctx.strokeStyle = '#DC2626'; ctx.stroke(); break;
        }
        case 'mimic': {
          if (u.disguised) {
            ctx.save(); ctx.translate(x, y); ctx.rotate(f + Math.PI / 2);
            roundRect(ctx, -r, -r * 0.75, r * 2, r * 1.5, 4); ctx.fillStyle = '#A16207'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = ink; ctx.stroke();
            ctx.fillStyle = '#FACC15'; ctx.fillRect(-r, -r * 0.12, r * 2, r * 0.24); ctx.strokeRect(-r, -r * 0.12, r * 2, r * 0.24); disc(ctx, 0, 0, 3.5, '#FDE047', 1.5); ctx.restore();
          } else {
            ctx.save(); ctx.translate(x, y); ctx.rotate(f);
            roundRect(ctx, -r * 0.9, -r, r * 1.5, r * 2, 4); ctx.fillStyle = '#A16207'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = ink; ctx.stroke();
            const open = 0.35 + 0.25 * Math.sin(this.t * 10 + u.gait); ctx.beginPath(); ctx.moveTo(r * 0.55, -r * 0.8); ctx.lineTo(r * (0.75 + open), 0); ctx.lineTo(r * 0.55, r * 0.8); ctx.closePath(); ctx.fillStyle = '#7F1D1D'; ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#FFFFFF'; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(r * 0.6, k * r * 0.3 - 3); ctx.lineTo(r * 0.85, k * r * 0.3); ctx.lineTo(r * 0.6, k * r * 0.3 + 3); ctx.fill(); }
            ctx.fillStyle = tm.c; ctx.fillRect(-r * 0.9, -r * 0.15, r * 1.45, r * 0.3); disc(ctx, -r * 0.2, -r * 0.45, 3, '#FDE047', 1); disc(ctx, -r * 0.2, r * 0.45, 3, '#FDE047', 1); ctx.restore();
          }
          break;
        }
        case 'jetpack': {
          for (const sd of [-1, 1]) { const [jx, jy] = P(-r * 0.8, sd * r * 0.45); roundRect(ctx, jx - 4, jy - 4, 8, 8, 2); ctx.fillStyle = '#6B7280'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = ink; ctx.stroke(); const fl = 6 + 4 * Math.sin(this.t * 40 + sd); const [qx, qy] = P(-r * 0.8 - fl, sd * r * 0.45); stick(ctx, jx - fx * 4, jy - fy * 4, qx, qy, 4, '#FB923C'); }
          body(); disc(ctx, x + fx * r * 0.2, y + fy * r * 0.2, r * 0.55, '#93C5FD', 2); line(r * 0.3, r * 0.75, r * 1.45, r * 0.8, 3.5, '#374151'); break;
        }
        case 'werewolf': {
          if (u.wolf) {
            for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(...P(r * 0.2, sd * r * 0.5)); ctx.lineTo(...P(r * 0.05, sd * r * 1.15)); ctx.lineTo(...P(-r * 0.3, sd * r * 0.55)); ctx.closePath(); ctx.fillStyle = '#4B5563'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.stroke(); }
            disc(ctx, x, y, r, '#4B5563', 2.5); ctx.beginPath(); ctx.arc(x, y, r * 0.95, f + 2.4, f + 3.9); ctx.lineWidth = 3; ctx.strokeStyle = tm.c; ctx.stroke();
            ell(ctx, ...P(r * 0.75, 0), r * 0.45, r * 0.3, f, '#6B7280', 2); disc(ctx, ...P(r * 1.15, 0), 3, ink, 0); eyes3(ctx, x, y, r * 0.8, f, '#FDE047');
          } else { body(); disc(ctx, x - fx * r * 0.1, y - fy * r * 0.1, r * 0.6, '#78350F', 2); eyes3(ctx, x, y, r, f); }
          break;
        }
        case 'oracle': {
          body('#E9D5FF'); disc(ctx, x, y, r * 0.8, tm.c, 2); const [ex, ey] = P(r * 0.15, 0); ell(ctx, ex, ey, r * 0.5, r * 0.3, f + Math.PI / 2, '#FFFFFF', 1.8); disc(ctx, ex + fx * 2, ey + fy * 2, r * 0.18, '#7C3AED', 0);
          const [ox, oy] = P(r * 0.9, r * 0.8); disc(ctx, ox, oy, 5, 'rgba(196,181,253,0.9)', 1.5); break;
        }
        case 'balloon': {
          const bob = Math.sin(this.t * 2 + u.gait) * 3;
          for (const sd of [-1, 1]) stick(ctx, x + sd * r * 0.3, y + r * 0.55 + bob, x + sd * r * 0.25, y + r * 1.0, 1.5, ink);
          roundRect(ctx, x - r * 0.35, y + r * 0.95, r * 0.7, r * 0.45, 3); ctx.fillStyle = COL.wood; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.stroke();
          disc(ctx, x, y - r * 0.15 + bob, r, '#F8FAFC', 3);
          ctx.save(); ctx.beginPath(); ctx.arc(x, y - r * 0.15 + bob, r, 0, TAU); ctx.clip(); for (let k = -2; k <= 2; k += 2) { ctx.fillStyle = tm.c; ctx.fillRect(x + k * r * 0.33 - r * 0.15, y - r * 1.3 + bob, r * 0.3, r * 2.4); } ctx.restore();
          ctx.beginPath(); ctx.arc(x, y - r * 0.15 + bob, r, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = ink; ctx.stroke(); break;
        }
        case 'sumo': {
          body('#F2C9A0'); ctx.beginPath(); ctx.arc(x, y, r * 0.98, 0, TAU); ctx.lineWidth = 2.5; ctx.strokeStyle = ink; ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y, r * 0.98, f + 2.3, f + 4.0); ctx.lineWidth = 6; ctx.strokeStyle = tm.c; ctx.stroke();
          disc(ctx, x - fx * r * 0.25, y - fy * r * 0.25, r * 0.28, '#1F2937', 2); for (const sd of [-1, 1]) { const [hx, hy] = P(r * 0.7, sd * r * 0.85); disc(ctx, hx, hy, r * 0.28, '#F2C9A0', 2); } eyes3(ctx, x, y, r * 0.8, f); break;
        }
        case 'sandman': {
          body('#D6C29A'); disc(ctx, x, y, r * 0.75, tm.c, 2); ctx.beginPath(); ctx.arc(x - fx * r * 0.2, y - fy * r * 0.2, r * 0.6, f + Math.PI * 0.6, f + Math.PI * 1.4); ctx.fillStyle = '#1E3A8A'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = ink; ctx.stroke();
          const [bx, by] = P(r * 0.8, r * 0.75); disc(ctx, bx, by, 5.5, '#F5DEB3', 1.5); for (const sd of [-1, 1]) { const [ex, ey] = P(r * 0.35, sd * r * 0.25); stick(ctx, ex - px * 3, ey - py * 3, ex + px * 3, ey + py * 3, 2, ink); } break;
        }
        case 'valkyrie': {
          const flap = Math.sin(this.t * 9 + u.gait) * 0.25;
          for (const sd of [-1, 1]) { ctx.beginPath(); const [wx, wy] = P(-r * 0.2, sd * r * 0.5); ctx.moveTo(wx, wy); ctx.quadraticCurveTo(...P(-r * 0.6, sd * r * (2.0 + flap)), ...P(-r * 1.3, sd * r * (1.5 + flap))); ctx.quadraticCurveTo(...P(-r * 0.9, sd * r * 0.9), wx, wy); ctx.fillStyle = '#F8FAFC'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.stroke(); }
          body(); disc(ctx, x - fx * r * 0.1, y - fy * r * 0.1, r * 0.6, '#FDE047', 2); line(r * 0.4, r * 0.8, r * 1.7, r * 0.85, 2.5, COL.steel); eyes3(ctx, x, y, r * 0.85, f); break;
        }
        case 'paladin': {
          body(COL.steel); disc(ctx, x, y, r * 0.75, tm.c, 2); stick(ctx, ...P(-r * 0.45, 0), ...P(r * 0.45, 0), 3, '#FDE047'); stick(ctx, ...P(0, -r * 0.35), ...P(0, r * 0.35), 3, '#FDE047');
          const [sx, sy] = P(r * 0.75, -r * 0.75); ctx.beginPath(); ctx.arc(sx, sy, r * 0.5, 0, TAU); ctx.fillStyle = '#F8FAFC'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.stroke(); disc(ctx, sx, sy, r * 0.18, '#FDE047', 1.5);
          line(r * 0.5, r * 0.85, r * 1.5, r * 0.95, 3.5, COL.wood); disc(ctx, ...P(r * 1.6, r * 0.95), 5, '#9CA3AF', 2); break;
        }
        case 'pyro': {
          body('#4B5563'); disc(ctx, x, y, r * 0.75, tm.c, 2); for (const sd of [-1, 1]) { const [tx2, ty2] = P(-r * 0.75, sd * r * 0.35); disc(ctx, tx2, ty2, r * 0.3, '#DC2626', 1.5); }
          disc(ctx, x + fx * r * 0.25, y + fy * r * 0.25, r * 0.4, '#1F2937', 1.5); line(r * 0.3, r * 0.6, r * 1.6, r * 0.3, 4, '#374151');
          if (u.cd < 0.12) { const [nx, ny] = P(r * 1.75, r * 0.3); disc(ctx, nx, ny, 5, '#FB923C', 0); disc(ctx, nx, ny, 2.5, '#FDE047', 0); } break;
        }
        case 'medicdrone': {
          const sp = this.t * 30;
          for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const cx = x + a * r * 0.95, cy = y + b * r * 0.95; stick(ctx, x, y, cx, cy, 2.5, '#374151'); ctx.save(); ctx.translate(cx, cy); ctx.rotate(sp); ctx.fillStyle = 'rgba(200,210,220,0.7)'; ctx.fillRect(-7, -1.2, 14, 2.4); ctx.restore(); }
          disc(ctx, x, y, r * 0.7, '#F8FAFC', 2.5); ctx.fillStyle = '#EF4444'; ctx.fillRect(x - 2, y - r * 0.45, 4, r * 0.9); ctx.fillRect(x - r * 0.45, y - 2, r * 0.9, 4);
          ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = tm.c; ctx.stroke(); break;
        }
        case 'yeti': {
          body('#F1F5F9'); for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; disc(ctx, x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85, r * 0.22, '#F1F5F9', 0); }
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.lineWidth = 2.5; ctx.strokeStyle = ink; ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, r * 0.95, f + 2.4, f + 3.9); ctx.lineWidth = 4; ctx.strokeStyle = tm.c; ctx.stroke();
          ell(ctx, ...P(r * 0.35, 0), r * 0.4, r * 0.45, f, '#93C5FD', 2); eyes3(ctx, x, y, r * 0.7, f); const [bx, by] = P(r * 0.8, r * 0.9); disc(ctx, bx, by, 6, '#E0F2FE', 1.5); break;
        }
        case 'shadowninja': {
          ctx.save(); ctx.globalAlpha = 0.35; disc(ctx, x - fx * 6, y - fy * 6, r, '#6D28D9', 0); ctx.restore();
          body('#1F1B2E'); ctx.beginPath(); ctx.arc(x, y, r * 0.95, f - 0.7, f + 0.7); ctx.lineWidth = 3; ctx.strokeStyle = tm.c; ctx.stroke();
          eyes3(ctx, x, y, r, f, '#C4B5FD'); line(-r * 0.2, -r * 0.8, r * 1.4, -r * 0.95, 2.5, '#D1D5DB'); break;
        }
        case 'gunslinger': {
          ell(ctx, x, y, r * 1.2, r * 1.0, f, '#92400E', 2.5); disc(ctx, x, y, r * 0.65, '#B45309', 2); ctx.beginPath(); ctx.arc(x, y, r * 0.65, 0, TAU); ctx.lineWidth = 2.5; ctx.strokeStyle = tm.c; ctx.stroke();
          line(r * 0.5, r * 0.75, r * 1.35, r * 0.75, 3, '#374151'); line(r * 0.5, -r * 0.75, r * 1.35, -r * 0.75, 3, '#374151'); break;
        }
        case 'axethrower': {
          body(); disc(ctx, x - fx * r * 0.15, y - fy * r * 0.15, r * 0.58, '#9CA3AF', 2); for (const sd of [-1, 1]) { const [hx, hy] = P(-r * 0.05, sd * r * 0.62); ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(...P(r * 0.15, sd * r * 1.05)); ctx.lineTo(...P(-r * 0.3, sd * r * 0.75)); ctx.closePath(); ctx.fillStyle = '#F8FAFC'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = ink; ctx.stroke(); }
          if (u.cd > 0.3) { line(r * 0.3, r * 0.85, r * 1.3, r * 0.9, 3, COL.wood); const [ax, ay] = P(r * 1.35, r * 0.9); ell(ctx, ax, ay, 6, 4, f + Math.PI / 2, COL.steel, 1.5); }
          eyes3(ctx, x, y, r * 0.85, f); break;
        }
        case 'gorgon': {
          for (let k = 0; k < 7; k++) { const a = f + Math.PI + (k - 3) * 0.42, w = Math.sin(this.t * 6 + k) * 0.25; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7); ctx.quadraticCurveTo(x + Math.cos(a + w) * r * 1.2, y + Math.sin(a + w) * r * 1.2, x + Math.cos(a - w) * r * 1.5, y + Math.sin(a - w) * r * 1.5); ctx.lineWidth = 4; ctx.strokeStyle = '#16A34A'; ctx.stroke(); }
          body('#86EFAC'); ctx.beginPath(); ctx.arc(x, y, r * 0.95, f + 2.3, f + 4.0); ctx.lineWidth = 4; ctx.strokeStyle = tm.c; ctx.stroke(); eyes3(ctx, x, y, r, f, '#FDE047'); break;
        }
        case 'phalanx': {
          line(-r * 0.6, r * 0.55, r * 1.9, r * 0.55, 3, COL.wood); const [tx2, ty2] = P(r * 1.95, r * 0.55); disc(ctx, tx2, ty2, 3, COL.steel, 1.5);
          body(); const [sx, sy] = P(r * 0.7, -r * 0.1); ctx.save(); ctx.translate(sx, sy); ctx.rotate(f); roundRect(ctx, -r * 0.25, -r * 1.0, r * 0.5, r * 2.0, 4); ctx.fillStyle = tm.d; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = ink; ctx.stroke(); disc(ctx, 0, 0, r * 0.18, '#FDE047', 1.5); ctx.restore();
          disc(ctx, x - fx * r * 0.2, y - fy * r * 0.2, r * 0.5, '#D97706', 2); break;
        }
        case 'tesla': {
          body(); disc(ctx, x - fx * r * 0.2, y - fy * r * 0.2, r * 0.5, '#1E3A8A', 2); line(r * 0.3, r * 0.7, r * 1.4, r * 0.75, 4, '#374151');
          const [cx, cy] = P(r * 1.5, r * 0.75); for (let k = 0; k < 3; k++) { const a = this.t * 20 + k * 2.1; stick(ctx, cx, cy, cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 1.5, '#93C5FD'); } disc(ctx, cx, cy, 3, '#DBEAFE', 1); eyes3(ctx, x, y, r * 0.85, f); break;
        }
        default: body();
      }
    },
    // effects on troops (any troop) and things this batch leaves in the world, drawn over the troops
    drawCast3Fx(ctx) {
      const T = this.fightT, t = this.t;
      for (const u of this.units) {
        if (u.dead) continue;
        if (u.sleepT > T) { ctx.font = font(18, 800); ctx.textAlign = 'center'; const b = (t * 1.5 + u.gait) % 1; strokeText(ctx, 'Z', u.x + 6 + b * 8, u.y - u.r - 8 - b * 14, '#F5DEB3', COL.ink, 4); }
        if (u.stoneT3 > T) { ctx.beginPath(); ctx.arc(u.x, u.y, u.r + 1, 0, TAU); ctx.fillStyle = 'rgba(156,163,175,0.75)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#4B5563'; ctx.stroke(); }
        if (u.markT > T) { const [ex, ey] = [u.x, u.y - u.r - 16]; ell(ctx, ex, ey, 10, 6, 0, '#FFFFFF', 2); disc(ctx, ex, ey, 3.5, '#7C3AED', 0); }
        if (u.shieldT > T) { ctx.beginPath(); ctx.arc(u.x, u.y, u.r + 7, 0, TAU); ctx.fillStyle = 'rgba(253,230,138,0.18)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(253,224,71,0.85)'; ctx.stroke(); }
        if (u.hooking && !u.hooking.dead) { const o = u.hooking; stick(ctx, u.x, u.y, o.x, o.y, 3, '#9CA3AF'); for (let k = 1; k < 6; k++) disc(ctx, u.x + (o.x - u.x) * k / 6, u.y + (o.y - u.y) * k / 6, 2.5, '#D1D5DB', 1); }
        if (u.type === 'bard' && !u.dead) { const k = (t * 0.8 + u.gait) % 1; ctx.font = font(20, 800); ctx.textAlign = 'center'; ctx.globalAlpha = 1 - k; strokeText(ctx, '♪', u.x + Math.sin(k * 6) * 10, u.y - u.r - 6 - k * 26, '#86EFAC', COL.ink, 3); ctx.globalAlpha = 1; }
      }
      for (const s of this.swarms || []) for (let k = 0; k < 8; k++) {
        const a = t * 9 + k * 0.8, bx = s.x + Math.cos(a * 1.3 + k) * 14, by = s.y + Math.sin(a + k * 2) * 12;
        ctx.beginPath(); ctx.ellipse(bx, by, 3.2, 2.4, a, 0, TAU); ctx.fillStyle = '#FACC15'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = COL.ink; ctx.stroke();
      }
      this.rewinds = (this.rewinds || []).filter(w => t - w.t0 < 1.2);
      for (const w of this.rewinds) {
        const p = (t - w.t0) / 1.2, rr = w.r * (1 - p) + 10;
        ctx.beginPath(); ctx.arc(w.x, w.y, rr, 0, TAU); ctx.lineWidth = 4 * (1 - p) + 1; ctx.strokeStyle = `rgba(125,211,252,${1 - p})`; ctx.stroke();
        for (let k = 0; k < 12; k++) { const a = k / 12 * TAU - p * 6; stick(ctx, w.x + Math.cos(a) * rr * 0.85, w.y + Math.sin(a) * rr * 0.85, w.x + Math.cos(a) * rr, w.y + Math.sin(a) * rr, 2, `rgba(224,242,254,${1 - p})`); }
      }
    },
    drawShot3(ctx, a, ux, uy) {
      const k = a.kind;
      if (k === 'pie') { disc(ctx, a.x, a.y, 7, '#F5DEB3', 2); disc(ctx, a.x, a.y, 4, '#DC2626', 0); return; }
      if (k === 'confetti') { for (let i = 0; i < 6; i++) { const q = i * 1.05 + a.t * 12; ctx.fillStyle = ['#F472B6', '#FACC15', '#60A5FA', '#34D399', '#F87171', '#A78BFA'][i]; ctx.fillRect(a.x + Math.cos(q) * 6 - 2, a.y + Math.sin(q) * 6 - 2, 4, 4); } return; }
      if (k === 'bomb') { disc(ctx, a.x, a.y, 7, '#1F2937', 2); stick(ctx, a.x, a.y - 7, a.x + 3, a.y - 11, 2, COL.wood); disc(ctx, a.x + 3, a.y - 12, 2.5, '#FDE047', 0); return; }
      if (k === 'axe') { ctx.save(); ctx.translate(a.x, a.y); ctx.rotate((this.t * 18) % TAU); stick(ctx, -8, 0, 8, 0, 2.5, COL.wood); ctx.beginPath(); ctx.moveTo(6, -1); ctx.lineTo(10, -7); ctx.lineTo(13, 0); ctx.lineTo(10, 7); ctx.closePath(); ctx.fillStyle = COL.steel; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = COL.ink; ctx.stroke(); ctx.restore(); }
    },
    // Mr 3D's moment: the whole battlefield goes red/cyan, like an old 3D film (looks only)
    draw3D(ctx) {
      const src = ctx.canvas; if (!api.makeCanvas || !src) return;
      const m = ctx.getTransform(), X0 = Math.round(m.e + AR.x * m.a), Y0 = Math.round(m.f + AR.y * m.d), Wd = Math.round(AR.w * m.a), Hd = Math.round(AR.h * m.d);
      const off = this._d3c || (this._d3c = api.makeCanvas(Wd, Hd)), o = off.getContext('2d');
      o.clearRect(0, 0, Wd, Hd); o.drawImage(src, X0, Y0, Wd, Hd, 0, 0, Wd, Hd);
      const k = clamp(Math.min((this.d3T - this.fightT) / 0.4, 1), 0, 1);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.5 * k; ctx.fillStyle = '#FF9AA8'; ctx.fillRect(X0, Y0, Wd, Hd);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 * k; ctx.drawImage(off, X0 - 9, Y0); ctx.globalAlpha = 0.3 * k; ctx.drawImage(off, X0 + 9, Y0 + 1);
      ctx.restore();
      ctx.save(); ctx.font = font(30, 800); ctx.textAlign = 'center'; spaced(ctx, 5); strokeText(ctx, '3D MODE', AR.x + AR.w / 2, AR.y + 40, '#7CF3FF', COL.ink, 7); spaced(ctx, 0); ctx.restore();
    },
  };
  // ----- evolution (rules.tribes.evolve): every forge upgrade visibly evolves a tribe's troops, up to elemental weapons -----
  // Weapons go up to tier 5 (tier 4 = the tribe's element, tier 5 = its master form), armour to tier 4. Each tier changes how
  // the tribe's troops look; each weapon upgrade gets an EVOLUTION card, and the big ones a slow-motion close-up.
  // Elements roll their own dice (seed ^ 0xE7017E); with evolve off nothing here runs.
  const ELEM = {
    flame: { col: '#FF6B1A', glow: '#FFB020', hit: 'BURNS ON HIT' },
    frost: { col: '#7DD3FC', glow: '#E0F2FE', hit: 'SLOWS ON HIT' },
    storm: { col: '#A78BFA', glow: '#FDE047', hit: 'LIGHTNING JUMPS' },
    venom: { col: '#84CC16', glow: '#D9F99D', hit: 'POISONS ON HIT' },
    holy: { col: '#FACC15', glow: '#FFFBEB', hit: 'HEALS ON HIT' },
  };
  const ELEM_KEYS = Object.keys(ELEM);
  // tier 4 and tier 5 weapon names, by weapon set and element
  const ELEM_W = {
    blade: { flame: ['FLAME', 'HELLFIRE'], frost: ['FROST', 'GLACIER'], storm: ['STORM', 'THUNDERGOD'], venom: ['VENOM', 'BLACK VENOM'], holy: ['HOLY', 'SUNFORGED'] },
    modern: { flame: ['INCENDIARY', 'DRAGONFIRE'], frost: ['CRYO', 'ABSOLUTE ZERO'], storm: ['SHOCK', 'EMP'], venom: ['TOXIC', 'NERVE-GAS'], holy: ['BLESSED', 'DIVINE'] },
    scifi: { flame: ['PLASMA', 'NOVA'], frost: ['CRYO', 'ZERO-POINT'], storm: ['ION', 'TESLA'], venom: ['ACID', 'BIOHAZARD'], holy: ['PHOTON', 'SOLAR'] },
    horror: { flame: ['HELLFIRE', 'INFERNAL'], frost: ['GRAVE-FROST', 'DEATHCHILL'], storm: ['WITCH-STORM', 'DOOMSTORM'], venom: ['PLAGUE', 'BLACK PLAGUE'], holy: ['BLOOD', 'VAMPIRIC'] },
  };
  const ELEM_A = { flame: 'EMBER-PLATE', frost: 'FROST-PLATE', storm: 'STORM-PLATE', venom: 'THORN-PLATE', holy: 'HALO-PLATE' };
  const ARMY_EVOLVE = {
    initEvolve() {
      const E = this.trb.evolve, R = rng(((this.seed >>> 0) ^ 0xE7017E) >>> 0);
      this.evo = { cards: [], show: null, next: 0 };
      this.wMax = E.weaponMax || 5; this.aMax = E.armourMax || 4;
      for (const team of this.teamIds()) {
        const left = ELEM_KEYS.slice();
        for (const tb of this.tribes.filter(x => x.team === team)) tb.elem = left.splice(R.int(0, left.length - 1), 1)[0];
      }
    },
    wName(tb, k) { return k <= 3 ? TIER_NAMES[tb.set].w[k] : (ELEM_W[tb.set] || ELEM_W.blade)[tb.elem || 'flame'][Math.min(k, 5) - 4]; },
    aName(tb, k) { return k <= 3 ? TIER_NAMES[tb.set].a[k] : ELEM_A[tb.elem || 'flame']; },
    wCol(tb, k) { return k >= 4 ? ELEM[tb.elem].col : k === 3 ? W_TOP[tb.set] : W_COL[k]; },
    // an upgrade has just happened: the card, the transformation on every troop of the tribe, and for the big ones a slow-motion close-up
    evolveFx(tb, which, oldK) {
      const newK = which === 'w' ? tb.wt : tb.at, N = TIER_NAMES[tb.set];
      tb.evoT = this.t; tb.evoW = which;
      const big = which === 'w' ? newK >= 3 : newK >= 4;
      const from = which === 'w' ? `${this.wName(tb, oldK)} ${N.noun}` : oldK ? this.aName(tb, oldK) : 'NO ARMOUR';
      const to = which === 'w' ? `${this.wName(tb, newK)} ${N.noun}` : this.aName(tb, newK);
      const perk = which === 'w' ? (newK >= 4 ? `+${newK * 10}% DAMAGE · ${ELEM[tb.elem].hit}` : `+${newK * 10}% DAMAGE`) : `${newK * 8}% LESS DAMAGE TAKEN`;
      if (which === 'w' || newK >= 4) {
        this.evoAdvance(this.t);
        const q = this.evo.cards;
        q.push({ tb, which, from, to, perk, tier: newK, big, at: this.t });
        // never let the queue fall far behind: drop the smallest waiting upgrades first
        while (q.length > 2) { const i = q.findIndex(c => !c.big); q.splice(i >= 0 ? i : 0, 1); }
      }
      if (big) {
        this.snd('evolve', { team: tb.team });
        const c = tb.chief && !tb.chief.dead ? tb.chief : this.units.find(u => u.tribe === tb && !u.dead && UNIT[u.type].rank !== 0);
        if (c && this.camEv) this.camEv.push({ type: 'spot', follow: c, prio: 66, dur: 2.0, z: 2.0, slow: newK >= 4 });
        (this.xf.evolved || (this.xf.evolved = [])).push({ team: tb.team, name: to, tier: newK, which });
      }
    },
    // tier 4 and 5 weapons: the element's effect on every hit (both sides alike: every tribe has an element)
    evoHit(u, from, dmg) {
      const tb = from.tribe, T = this.fightT;
      if (!tb || tb.wt < 4 || this._evoHit || u.dead) return;
      const p = tb.wt - 3;
      this._evoHit = true;
      if (tb.elem === 'flame') this.burn(u, 0.5 * p, 1.5, from);
      else if (tb.elem === 'frost') this.slowDown(u, 0.75 - 0.1 * p, 1.2);
      else if (tb.elem === 'venom') this.poison(u, 0.5 * p, 2, from);
      else if (tb.elem === 'holy') { if (!from.dead) this.heal(from, dmg * 0.15 * p); }
      else if (tb.elem === 'storm' && (u.zapT || 0) < T) {
        u.zapT = T + 0.6;
        const o = this.near(u.x, u.y, 90).find(o => o.team !== from.team && o !== u && !o.dead && !UNIT[o.type].uncounted);
        if (o) { this.damage(o, dmg * 0.4 * p, from); this.beams.push({ x0: u.x, y0: u.y, x1: o.x, y1: o.y, t0: T, life: 0.2, col: ELEM.storm.glow, w: 2.5 }); }
      }
      this._evoHit = false;
    },
    // over the troops: what every tier looks like, plus the transformation the moment a tribe evolves
    drawEvolved(ctx, list) {
      const t = this.t, glows = new Map(), glints = new Map(), rims = new Map(), auras = new Map(), arm = new Map(), motifs = [];
      const add = (m, k, v) => { let a = m.get(k); if (!a) m.set(k, a = []); a.push(v); };
      for (const u of list) {
        const tb = u.tribe;
        if (!tb || u.dead || u.fade === 0) continue;
        const U = UNIT[u.type];
        if (U.rank === 0 || U.uncounted) continue;
        const w = tb.wt, a = tb.at;
        if (w > 0) {
          const col = this.wCol(tb, w);
          add(glints, col, u);
          if (w >= 2) add(rims, w >= 4 ? ELEM[tb.elem].col : w === 3 ? col : '#E2E8F0', u);
          if (w >= 3) add(glows, col, u);
          if (w >= 4) motifs.push(u);
          if (w >= 5) add(auras, ELEM[tb.elem].col, u);
        }
        if (a > 0) add(arm, a >= 4 ? ELEM[tb.elem].col : A_COL[a], u);
      }
      ctx.save(); ctx.lineCap = 'round';
      // tier 5: an elemental aura round the whole troop
      for (const [col, us] of auras) {
        ctx.beginPath();
        for (const u of us) { const rr = u.r + 5 + 1.5 * Math.sin(t * 6 + u.gait); ctx.moveTo(u.x + rr, u.y); ctx.arc(u.x, u.y, rr, 0, TAU); }
        ctx.globalAlpha = 0.85; ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke(); ctx.globalAlpha = 0.18; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
      }
      // armour: shoulder plates, bigger and brighter each tier
      for (const [col, us] of arm) {
        ctx.beginPath();
        for (const u of us) { const b = u.face + Math.PI, sp = 0.7 + 0.12 * Math.min(u.tribe.at, 4); ctx.moveTo(u.x + Math.cos(b - sp) * (u.r - 1), u.y + Math.sin(b - sp) * (u.r - 1)); ctx.arc(u.x, u.y, u.r - 1, b - sp, b + sp); }
        ctx.lineWidth = 7; ctx.strokeStyle = COL.ink; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.stroke();
      }
      // weapon tier 2+: a rim of the weapon's colour on the front of the troop
      for (const [col, us] of rims) {
        ctx.beginPath();
        for (const u of us) { ctx.moveTo(u.x + Math.cos(u.face - 0.9) * (u.r + 1.5), u.y + Math.sin(u.face - 0.9) * (u.r + 1.5)); ctx.arc(u.x, u.y, u.r + 1.5, u.face - 0.9, u.face + 0.9); }
        ctx.lineWidth = 2.5; ctx.strokeStyle = col; ctx.stroke();
      }
      // weapon tier 3+: the weapon glows
      for (const [col, us] of glows) {
        ctx.beginPath();
        for (const u of us) { const gx = u.x + Math.cos(u.face) * (u.r + 8), gy = u.y + Math.sin(u.face) * (u.r + 8), gr = (u.tribe.wt >= 4 ? 12 : 9) * (0.85 + 0.15 * Math.sin(t * 11 + u.gait)); ctx.moveTo(gx + gr, gy); ctx.arc(gx, gy, gr, 0, TAU); }
        ctx.globalAlpha = 0.32; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
      }
      // the glint on the weapon, bigger each tier
      for (const [col, us] of glints) {
        ctx.beginPath();
        for (const u of us) {
          const gx = u.x + Math.cos(u.face) * (u.r + 8), gy = u.y + Math.sin(u.face) * (u.r + 8), s = (3.2 + 0.7 * u.tribe.wt) * (0.8 + 0.2 * Math.sin(t * 9 + u.gait));
          ctx.moveTo(gx, gy - s); ctx.lineTo(gx + s * 0.45, gy); ctx.lineTo(gx, gy + s); ctx.lineTo(gx - s * 0.45, gy); ctx.closePath();
          ctx.moveTo(gx - s, gy); ctx.lineTo(gx, gy - s * 0.4); ctx.lineTo(gx + s, gy); ctx.lineTo(gx, gy + s * 0.4); ctx.closePath();
        }
        ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke(); ctx.fillStyle = col; ctx.fill();
      }
      // tier 4+: the element itself on the weapon (flames, frost, sparks, drips, rays)
      for (const u of motifs) {
        const e = u.tribe.elem, E = ELEM[e], gx = u.x + Math.cos(u.face) * (u.r + 9), gy = u.y + Math.sin(u.face) * (u.r + 9), ph = t * 8 + u.gait * 3;
        if (e === 'flame') for (let k = 0; k < 2; k++) { const fx = gx + (k ? 4 : -3), h = 9 + 4 * Math.sin(ph + k * 2); ctx.beginPath(); ctx.moveTo(fx - 3.5, gy); ctx.quadraticCurveTo(fx - 3, gy - h * 0.6, fx, gy - h); ctx.quadraticCurveTo(fx + 3, gy - h * 0.6, fx + 3.5, gy); ctx.closePath(); ctx.fillStyle = k ? E.glow : E.col; ctx.fill(); }
        else if (e === 'frost') { ctx.save(); ctx.translate(gx, gy); ctx.rotate(ph * 0.3); ctx.beginPath(); for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); ctx.lineTo(-Math.cos(a) * 6, -Math.sin(a) * 6); } ctx.lineWidth = 2; ctx.strokeStyle = E.glow; ctx.stroke(); ctx.restore(); }
        else if (e === 'storm') { ctx.beginPath(); ctx.moveTo(gx - 5, gy - 6); ctx.lineTo(gx + 1, gy - 1); ctx.lineTo(gx - 2, gy + 1); ctx.lineTo(gx + 5, gy + 7); ctx.lineWidth = 2; ctx.strokeStyle = (ph | 0) % 2 ? E.glow : '#FFFFFF'; ctx.stroke(); }
        else if (e === 'venom') { const dy = ((ph * 0.4) % 1) * 9; ctx.beginPath(); ctx.arc(gx, gy + 3 + dy, 2.6, 0, TAU); ctx.fillStyle = E.col; ctx.fill(); }
        else { ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = ph * 0.2 + k * Math.PI / 2; ctx.moveTo(gx + Math.cos(a) * 4, gy + Math.sin(a) * 4); ctx.lineTo(gx + Math.cos(a) * 9, gy + Math.sin(a) * 9); } ctx.lineWidth = 2; ctx.strokeStyle = E.glow; ctx.stroke(); }
      }
      // the moment of evolving: a ring sweeps through the tribe from its chief outwards, each troop flashing and rising a little
      for (const tb of this.tribes) {
        const age = t - (tb.evoT ?? -9);
        if (age < 0 || age > 1.6) continue;
        const c = tb.chief && !tb.chief.dead ? tb.chief : { x: tb.cx, y: tb.cy }, col = tb.evoW === 'w' ? this.wCol(tb, tb.wt) : tb.at >= 4 ? ELEM[tb.elem].col : A_COL[tb.at];
        for (const u of list) {
          if (u.tribe !== tb || u.dead) continue;
          const k = (age - Math.hypot(u.x - c.x, u.y - c.y) / 700) / 0.55;
          if (k < 0 || k > 1) continue;
          ctx.globalAlpha = 1 - k;
          ctx.beginPath(); ctx.arc(u.x, u.y, u.r + 3 + 14 * k, 0, TAU); ctx.lineWidth = 3.5 * (1 - k) + 1; ctx.strokeStyle = col; ctx.stroke();
          if (k < 0.35) { ctx.beginPath(); ctx.arc(u.x, u.y, u.r + 1, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill(); }
          ctx.beginPath(); ctx.moveTo(u.x - 5, u.y - u.r - 6 - 10 * k); ctx.lineTo(u.x, u.y - u.r - 12 - 10 * k); ctx.lineTo(u.x + 5, u.y - u.r - 6 - 10 * k); ctx.lineWidth = 2.5; ctx.strokeStyle = col; ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      // shots from elemental weapons glow in the element's colour
      ctx.globalCompositeOperation = 'lighter';
      for (const a of this.arrows) {
        const tb = a.from && a.from.tribe;
        if (!tb || tb.wt < 4) continue;
        const sp = Math.hypot(a.vx, a.vy) || 1, ux = a.vx / sp, uy = a.vy / sp;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x - ux * 26, a.y - uy * 26); ctx.lineWidth = 7; ctx.strokeStyle = ELEM[tb.elem].col + '99'; ctx.stroke();
        ctx.beginPath(); ctx.arc(a.x, a.y, 6, 0, TAU); ctx.fillStyle = ELEM[tb.elem].glow + 'AA'; ctx.fill();
      }
      ctx.restore();
    },
    // the EVOLUTION card: who evolved, from what to what, and what it does (one at a time, about 2 seconds each)
    // which card is up at time t: each one gets its slot from the battle clock (not from when frames are drawn), one at a
    // time with a 0.6 s gap, never before 8.8 s (the opening owns the screen until then)
    evoAdvance(t) {
      const E = this.evo;
      for (;;) {
        if (E.show) { const end = E.show.t0 + (E.show.big ? 2.3 : 1.7); if (t <= end) return; E.show = null; E.next = end + 0.6; }
        if (!E.cards.length) return;
        const start = Math.max(E.next, E.cards[0].at || 0, 8.8);
        if (t < start) return;
        E.show = E.cards.shift(); E.show.t0 = start;
      }
    },
    drawEvolveCards(ctx) {
      const E = this.evo, t = this.t;
      if (!E || this.phase !== 'fight') return;
      this.evoAdvance(t);
      const c = E.show; if (!c) return;
      const age = t - c.t0, dur = c.big ? 2.3 : 1.7;
      const tb = c.tb, tm = TEAMS[tb.team], ecol = c.which === 'w' ? this.wCol(tb, c.tier) : c.tier >= 4 ? ELEM[tb.elem].col : A_COL[c.tier];
      const inK = easeOutBack(clamp(age / 0.28, 0, 1)), a = Math.min(1, age / 0.12, (dur - age) / 0.25);
      const W = 800, H = 150, cx = VW / 2, cy = AR.y + 205;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.scale(0.7 + 0.3 * inK, 0.7 + 0.3 * inK);
      roundRect(ctx, -W / 2, -H / 2, W, H, 18); ctx.fillStyle = 'rgba(10,14,24,0.92)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = tm.c; ctx.stroke();
      // the element's colour sweeping across the card
      const sw = clamp(age / 0.5, 0, 1);
      ctx.save(); roundRect(ctx, -W / 2, -H / 2, W, H, 18); ctx.clip();
      const g = ctx.createLinearGradient(-W / 2, 0, -W / 2 + W * sw, 0); g.addColorStop(0, ecol + '00'); g.addColorStop(Math.max(0.01, sw * 0.9), ecol + '33'); g.addColorStop(1, ecol + '00');
      ctx.fillStyle = g; ctx.fillRect(-W / 2, -H / 2, W, H); ctx.restore();
      drawEmblem(ctx, tb.emblem, -W / 2 + 62, 0, 34);
      ctx.restore();
      // the texts (laid out in battlefield space so the layout check sees them, once the card has finished popping in)
      const k = 0.7 + 0.3 * inK, X = x => cx + x * k, Y = y => cy + y * k, lay = this.lay;
      if (age < 0.28) this.lay = null;
      ctx.save(); ctx.globalAlpha = a;
      const head = c.which === 'w' ? (c.tier >= 4 ? `${sName(tb.name)} EVOLVE` : `${sName(tb.name)} UPGRADE`) : `${sName(tb.name)} ARMOUR UP`;
      this.fitText(ctx, head, X(-W / 2 + 120), Y(-42), 560 * k, 24 * k, 800, true, COL.gold, 'left', 16 * k);
      this.fitText(ctx, `FROM ${c.from}`, X(-W / 2 + 120), Y(-6), 600 * k, 26 * k, 700, false, '#9AA4B2', 'left', 16 * k);
      this.fitText(ctx, c.to, X(-W / 2 + 120), Y(32), 610 * k, 44 * k, 800, true, ecol === '#FFFFFF' ? COL.white : ecol, 'left', 22 * k);
      this.fitText(ctx, c.perk, X(-W / 2 + 120), Y(62), 610 * k, 18 * k, 700, false, COL.white, 'left', 13 * k);
      // tier pips
      const max = c.which === 'w' ? (this.wMax || 5) : (this.aMax || 4);
      for (let i = 1; i <= max; i++) { ctx.beginPath(); ctx.arc(X(W / 2 - 30 - (max - i) * 22), Y(-44), 7 * k, 0, TAU); ctx.fillStyle = i <= c.tier ? (i === c.tier ? ecol : '#CBD5E1') : 'rgba(255,255,255,0.15)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke(); }
      ctx.restore();
      this.lay = lay;
    },
  };
  // ----- the thumbnail (rules.thumbnail): one branded picture per video, the same layout every time -----
  // Behind: a blurred, darkened moment of this battle. In front: the ARMY CLASH logo, each army's signature troop big in its
  // colour (two of its other troops behind it), VS, the army names and sizes, and WHO WINS? It never shows who won.
  // Key content stays inside the middle of the picture (y 150-1690), clear of YouTube's view count along the bottom.
  const ARMY_THUMB = {
    // the troop that stands for an army: its biggest (dragons, tanks, giants) and then its most numerous; plus two others
    thumbPicks(list) {
      const ok = list.filter(([t]) => UNIT[t] && !UNIT[t].uncounted && t !== 'king');
      const pool = ok.length ? ok : list.filter(([t]) => UNIT[t]);
      const hero = pool.slice().sort((p, q) => UNIT[q[0]].r - UNIT[p[0]].r || q[1] - p[1])[0];
      const rest = pool.filter(p => p !== hero).sort((p, q) => q[1] - p[1]).slice(0, 2);
      return { hero: hero ? hero[0] : 'soldier', rest: rest.map(p => p[0]) };
    },
    drawThumb(ctx, bg, sides, o = {}) {
      const W = VW, H = VH, N = sides.length, ink = COL.ink;
      ctx.save();
      ctx.fillStyle = COL.bg1; ctx.fillRect(0, 0, W, H);
      // 1) the battle, blurred (drawn small, then stretched back up) and darkened
      if (bg && api.makeCanvas) {
        // only the battlefield (not the scoreboard, which could hint at who is ahead), cut to the picture's shape
        // blurred hard (tiny, then stretched in two steps) so troops become colour and no card or text can be read
        // (halving step by step, since one big shrink skips pixels and leaves text readable)
        const sw = AR.h * W / H;
        let w = Math.round(sw / 2), h = Math.round(AR.h / 2), cur = api.makeCanvas(w, h);
        cur.getContext('2d').drawImage(bg, AR.x + (AR.w - sw) / 2, AR.y, sw, AR.h, 0, 0, w, h);
        while (w > 40) { const nx = api.makeCanvas(Math.round(w / 2), Math.round(h / 2)); nx.getContext('2d').drawImage(cur, 0, 0, Math.round(w / 2), Math.round(h / 2)); cur = nx; w = Math.round(w / 2); h = Math.round(h / 2); }
        while (w < W / 4) { const nx = api.makeCanvas(w * 2, h * 2); nx.getContext('2d').drawImage(cur, 0, 0, w * 2, h * 2); cur = nx; w *= 2; h *= 2; }
        ctx.imageSmoothingEnabled = true; ctx.drawImage(cur, -W * 0.06, -H * 0.06, W * 1.12, H * 1.12);
      }
      ctx.fillStyle = 'rgba(5,7,13,0.5)'; ctx.fillRect(0, 0, W, H);
      // 2) each army's colour on its side, split by a jagged bolt
      const cols = sides.map(s => TEAMS[s.team]);
      if (N === 2) {
        const top = W * 0.6, bot = W * 0.4;
        ctx.save(); ctx.globalAlpha = 0.42;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(top, 0); ctx.lineTo(bot, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fillStyle = cols[0].d; ctx.fill();
        ctx.beginPath(); ctx.moveTo(top, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(bot, H); ctx.closePath(); ctx.fillStyle = cols[1].d; ctx.fill();
        ctx.restore();
        ctx.beginPath();
        for (let k = 0; k <= 12; k++) { const f = k / 12, x = top + (bot - top) * f + (k % 2 ? 26 : -26) * (k && k < 12 ? 1 : 0); k ? ctx.lineTo(x, f * H) : ctx.moveTo(x, 0); }
        ctx.lineJoin = 'miter'; ctx.lineWidth = 16; ctx.strokeStyle = ink; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = COL.gold; ctx.stroke();
      } else {
        const g = ctx.createLinearGradient(0, 0, W, 0);
        cols.forEach((c, i) => { g.addColorStop(i / (N - 1) * 0.9 + 0.05, c.d); });
        ctx.save(); ctx.globalAlpha = 0.42; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
      }
      // vignette so the middle pops
      const v = ctx.createRadialGradient(W / 2, H * 0.47, W * 0.3, W / 2, H * 0.47, H * 0.62);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);

      // text with a thick black outline, shrunk to fit
      const big = (txt, x, y, maxW, size, fill, lw, rot = 0, weight = 800, italic = true) => {
        let s = size; ctx.font = font(s, weight, italic);
        while (s > 20 && ctx.measureText(txt).width > maxW) { s -= 2; ctx.font = font(s, weight, italic); }
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        ctx.lineWidth = lw * s / size; ctx.strokeStyle = ink; ctx.strokeText(txt, 0, 0);
        ctx.fillStyle = fill; ctx.fillText(txt, 0, 0);
        ctx.restore();
        return s;
      };
      // a troop on a glowing badge in its army's colour
      const badge = (type, team, x, y, r, flip, ring) => {
        const tm = TEAMS[team], U = UNIT[type] || UNIT.soldier;
        ctx.save();
        ctx.shadowColor = tm.c; ctx.shadowBlur = r * 0.35;
        disc(ctx, x, y, r + ring, ink, 0);
        ctx.restore();
        const gr = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
        gr.addColorStop(0, tm.l); gr.addColorStop(0.55, tm.c); gr.addColorStop(1, tm.d);
        disc(ctx, x, y, r, gr, 0);
        ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
        disc(ctx, x, y + r * 0.08, r * 0.78, 'rgba(5,7,13,0.28)', 0);
        const s = r * 0.62 / U.r;
        ctx.translate(x, y + r * 0.04); ctx.scale(flip ? -s : s, s);
        try { this.drawPortrait(ctx, type, team); } catch (e) { disc(ctx, 0, 0, U.r, tm.c, 3); }
        ctx.restore();
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.lineWidth = Math.max(6, r * 0.05); ctx.strokeStyle = ink; ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, r - Math.max(6, r * 0.05), 0, TAU); ctx.lineWidth = Math.max(3, r * 0.022); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.stroke();
      };
      const vs = (x, y, r) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(-0.12);
        ctx.beginPath();
        for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, rr = k % 2 ? r * 0.78 : r * 1.08; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fillStyle = COL.gold; ctx.fill(); ctx.lineWidth = r * 0.1; ctx.lineJoin = 'miter'; ctx.strokeStyle = ink; ctx.stroke();
        disc(ctx, 0, 0, r * 0.72, '#B91C1C', r * 0.07);
        ctx.restore();
        big('VS', x, y + r * 0.04, r * 1.2, r * 0.95, COL.white, r * 0.16, -0.12);
      };

      // 3) the logo
      big('ARMY CLASH', W / 2, 238, W - 120, 150, COL.white, 20, -0.035);
      ctx.save(); ctx.translate(W / 2, 330); ctx.rotate(-0.035);
      roundRect(ctx, -300, -9, 600, 18, 9); ctx.fillStyle = COL.gold; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = ink; ctx.stroke();
      ctx.restore();
      // the mode, if there is one (always in the same ribbon)
      if (o.tag) {
        ctx.font = font(52, 800, true); const tw = Math.min(W - 200, ctx.measureText(o.tag).width + 70);
        roundRect(ctx, W / 2 - tw / 2, 382, tw, 78, 16); ctx.fillStyle = '#0A0E19'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = COL.gold; ctx.stroke();
        big(o.tag, W / 2, 423, tw - 50, 52, COL.gold, 8);
      }

      // 4) the armies
      const two = N === 2, cy = two ? 905 : 920, R = two ? 222 : 150, xs = two ? [282, W - 282] : [186, W / 2, W - 186];
      sides.forEach((s, i) => {
        const p = this.thumbPicks(s.list), x = xs[i], flip = two ? i === 1 : x > W / 2 + 1, back = p.rest;
        const br = two ? 98 : 70, off = two ? [[-128, -262], [118, -282]] : [[-72, -190], [72, -200]];
        back.forEach((t, j) => badge(t, s.team, x + (flip ? -off[j][0] : off[j][0]), cy + off[j][1], br, flip, 6));
        badge(p.hero, s.team, x, cy, R, flip, 12);
      });
      if (two) vs(W / 2, cy + 10, 108);
      else { vs((xs[0] + xs[1]) / 2, cy + 175, 62); vs((xs[1] + xs[2]) / 2, cy + 175, 62); }
      // names under each army
      sides.forEach((s, i) => {
        const tm = TEAMS[s.team], x = xs[i], pw = two ? 470 : 320, ph = two ? 168 : 132, py = cy + R + (two ? 110 : 120);
        roundRect(ctx, x - pw / 2, py - ph / 2, pw, ph, 20);
        const gr = ctx.createLinearGradient(0, py - ph / 2, 0, py + ph / 2); gr.addColorStop(0, tm.c); gr.addColorStop(1, tm.d);
        ctx.fillStyle = gr; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = ink; ctx.stroke();
        big(s.name || tm.name, x, py - ph * 0.27, pw - 60, two ? 40 : 32, tm.l, 8);
        big(s.label, x, py + ph * 0.14, pw - 36, two ? 84 : 58, COL.white, 12);
        if (s.count) big(`×${s.count}`, x, py + ph / 2 + 44, pw - 40, two ? 56 : 46, COL.gold, 10);
      });

      // 5) the question (never the answer)
      big('WHO WINS?', W / 2, 1560, W - 110, 210, COL.gold, 24, -0.05);
      ctx.restore();
    },
  };
  Object.assign(Army.prototype, ARMY_EXT, ARMY_DRAW, ARMY_MAPS, ARMY_EXT2, ARMY_DRAW2, ARMY_COMBAT, ARMY_TRIBES, ARMY_TRIBES_DRAW, ARMY_PACE, ARMY_UI2, ARMY_WORLD, ARMY_FX2, ARMY_SMART, ARMY_CAST3, ARMY_CAST3_DRAW, ARMY_EVOLVE, ARMY_THUMB);

  const GAMES = { territory: Territory, duel: Duel, army: Army };
  Object.assign(api, { rng, Match, Territory, Duel, Army, Director, Synth, GAMES, WEAPONS, DOCTRINES, MODERN_DOCTRINES, FANTASY_DOCTRINES, GENRES, UNIT_ERA, ALL_DOCTRINES, MAPS, MAP_THEME, UNIT, eraOf, fmtTime, labelOf, docLabel, MAP_MECH, SKINS, MODE_HOOK, specOf, TRIBE_POOL, TRAIT, STAKE });
  return api;
})();
if (typeof module !== 'undefined') module.exports = RVB;
