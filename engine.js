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
  ];
  // Colour sets a team can use. setTeams('GREEN', 'PURPLE') switches the two teams before a match is made.
  const PALETTES = {
    RED: { c: COL.red, d: COL.redD, l: COL.redL },
    BLUE: { c: COL.blue, d: COL.blueD, l: COL.blueL },
    GREEN: { c: '#2ECC55', d: '#11702B', l: '#B4F2C4' },
    PURPLE: { c: '#A64DFF', d: '#5A1A99', l: '#E0C4FF' },
    ORANGE: { c: '#FF8A1F', d: '#C9600E', l: '#FFD2A6' },
    YELLOW: { c: '#FFD23F', d: '#9A7A0A', l: '#FFF0B3' },
  };
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const FONT = '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif';
  const TAU = Math.PI * 2;

  const api = { VW, VH, AR, COL, TEAMS, PALETTES, FONT, makeCanvas: null };

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

  // Background layer is identical for every match: render once per output size.
  let bgCache = {};
  api.setTeams = (a, b) => {
    [a, b].forEach((name, i) => {
      const pal = PALETTES[name];
      if (!pal) throw new Error(`Unknown team colour ${name}. Use one of: ${Object.keys(PALETTES).join(', ')}`);
      Object.assign(TEAMS[i], { name }, pal);
    });
    bgCache = {};
  };
  // Grass decorations shared by the medieval page background and battlefield.
  const FLOWER_COLS = ['#FF9EC7', '#FFF6E0', '#FFE066', '#C9A2FF'];
  // Five small cartoon flower kinds, all about the same size (r ~ 3-5 px), each with a soft outline.
  function drawFlower(g, x, y, r, kind) {
    const edge = 'rgba(20,30,20,0.45)';
    g.lineWidth = Math.max(0.8, r * 0.22); g.strokeStyle = edge;
    const dot = (cx, cy, rr, col) => { g.fillStyle = col; g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.fill(); g.stroke(); };
    if (kind === 0) {
      // daisy: thin white petals, yellow middle
      g.fillStyle = '#FFFFFF';
      for (let p = 0; p < 8; p++) { const a = p / 8 * TAU; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * 0.55, r * 0.25, a, 0, TAU); g.fill(); g.stroke(); }
      dot(x, y, r * 0.42, '#FFC93C');
    } else if (kind === 1) {
      // tulip: a little cup of three petals on a short stem
      g.strokeStyle = '#2E7A2E'; g.lineWidth = Math.max(1, r * 0.3);
      g.beginPath(); g.moveTo(x, y + r * 0.4); g.lineTo(x, y + r * 1.6); g.stroke();
      g.strokeStyle = edge; g.lineWidth = Math.max(0.8, r * 0.22);
      g.fillStyle = '#FF6F91';
      g.beginPath(); g.moveTo(x - r * 0.9, y - r * 0.7); g.lineTo(x - r * 0.45, y - r * 0.1); g.lineTo(x, y - r * 0.8); g.lineTo(x + r * 0.45, y - r * 0.1); g.lineTo(x + r * 0.9, y - r * 0.7);
      g.quadraticCurveTo(x + r * 0.95, y + r * 0.7, x, y + r * 0.7); g.quadraticCurveTo(x - r * 0.95, y + r * 0.7, x - r * 0.9, y - r * 0.7); g.closePath(); g.fill(); g.stroke();
    } else if (kind === 2) {
      // violet: five round purple petals, pale centre
      for (let p = 0; p < 5; p++) { const a = p / 5 * TAU - Math.PI / 2; dot(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.5, '#B48CFF'); }
      dot(x, y, r * 0.32, '#FFF3C4');
    } else if (kind === 3) {
      // buttercup: glossy yellow petals, orange centre
      for (let p = 0; p < 5; p++) { const a = p / 5 * TAU; dot(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.5, '#FFE45C'); }
      dot(x, y, r * 0.34, '#FF9F1C');
    } else {
      // clover blossom: a fluffy pink puff
      for (const [dx, dy] of [[0, -0.45], [-0.45, 0.2], [0.45, 0.2], [0, 0.1]]) dot(x + dx * r, y + dy * r, r * 0.5, '#FFB3D1');
    }
    // tiny highlight
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.3, r * 0.14, 0, TAU); g.fill();
  }
  function grassDecor(g, W, H, n, R, scale, alpha, y0 = 0, flowers = true) {
    g.save();
    g.globalAlpha = alpha;
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = R.range(0, W), y = y0 + R.range(0, H), k = R.next();
      if (k < 0.5) {
        // grass tuft
        g.strokeStyle = 'rgba(20,60,20,0.55)'; g.lineWidth = 2.2 * scale;
        g.beginPath();
        g.moveTo(x - 5 * scale, y - 7 * scale); g.lineTo(x, y);
        g.lineTo(x + 1 * scale, y - 9 * scale); g.moveTo(x, y); g.lineTo(x + 6 * scale, y - 6 * scale);
        g.stroke();
      } else if (flowers && k < 0.72) {
        drawFlower(g, x, y, R.range(3.2, 4.6) * scale, (k * 997 | 0) % 5);
      } else if (k < 0.82) {
        // fallen leaf with a midrib
        const a = R.range(0, TAU), col = R.next() < 0.5 ? '#7DBA4A' : '#C9B04A';
        g.save(); g.translate(x, y); g.rotate(a);
        g.fillStyle = col; g.strokeStyle = 'rgba(20,30,20,0.4)'; g.lineWidth = 1 * scale;
        g.beginPath(); g.ellipse(0, 0, 5 * scale, 2.6 * scale, 0, 0, TAU); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(40,60,20,0.55)'; g.beginPath(); g.moveTo(-5 * scale, 0); g.lineTo(5 * scale, 0); g.stroke();
        g.restore();
      } else if (k < 0.9) {
        // twig with a small fork
        const a = R.range(0, TAU), L = R.range(9, 13) * scale;
        g.save(); g.translate(x, y); g.rotate(a);
        g.strokeStyle = '#6E4A2A'; g.lineWidth = 2 * scale; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.moveTo(L * 0.05, 0); g.lineTo(L * 0.3, -L * 0.28); g.stroke();
        g.restore();
      } else {
        // small stone
        g.fillStyle = '#9EA39A'; g.beginPath(); g.ellipse(x, y, 6 * scale, 4 * scale, R.range(0, 3), 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(x - 1.5 * scale, y - 1.2 * scale, 2.5 * scale, 1.5 * scale, 0, 0, TAU); g.fill();
      }
    }
    g.restore();
  }
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
    float(x, y, text, color, size = 56, life = 0.9) { this.floats.push({ x, y, text, color, size, life, age: 0 }); }
    banner(text, color, life = 1.6) {
      // Replace a banner that is still on screen rather than stacking them.
      this.banners = this.banners.filter(b => b.age > b.life - 0.25);
      this.banners.push({ text, color, life, age: 0 });
    }
    shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }
    frame(dt) {
      this.t += dt;
      this.frameNo++;
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
        } else {
          const n = Math.max(1, Math.round(dt * this.stepHz));
          const h = dt / n;
          for (let i = 0; i < n && this.phase === 'fight'; i++) this.step(h);
        }
      } else {
        this.outroT += dt;
        if (this.outroStep) this.outroStep(dt);
        if (this.outroT >= this.outroLen) this.finished = true;
      }
      if (this.cosmetic) this.cosmetic(dt);
    }
    end(winner, headline, detail) {
      if (this.phase !== 'fight') return;
      this.phase = 'outro';
      if (this.opts.fixedLength) this.outroLen = Math.max(3, this.opts.fixedLength - this.t);
      this.winner = winner;
      this.headline = headline;
      this.detail = detail;
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
      for (const p of this.parts) {
        const k = 1 - p.age / p.life;
        ctx.globalAlpha = clamp(k * 1.4, 0, 1);
        ctx.fillStyle = p.color;
        if (p.confetti) {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + p.age * 9);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        } else {
          const s = p.size * (0.4 + 0.6 * k);
          ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        }
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const f of this.floats) {
        const k = f.age / f.life;
        ctx.globalAlpha = clamp((1 - k) * 2.5, 0, 1);
        const sc = 0.7 + 0.5 * easeOutBack(Math.min(1, k * 5));
        ctx.save(); ctx.translate(f.x, f.y - 70 * easeOutCubic(k)); ctx.scale(sc, sc);
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
        ctx.translate(VW / 2, AR.y + 82);
        ctx.scale(0.6 + 0.4 * inK, 0.6 + 0.4 * inK);
        ctx.font = font(54, 800); spaced(ctx, 3);
        const w = ctx.measureText(b.text).width + 70;
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 16, -40); ctx.lineTo(w / 2 + 16, -40); ctx.lineTo(w / 2 - 16, 40); ctx.lineTo(-w / 2 - 16, 40); ctx.closePath();
        ctx.fillStyle = b.color; ctx.fill();
        ctx.lineWidth = 5; ctx.strokeStyle = COL.ink; ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = b.color === COL.gold ? COL.ink : COL.white;
        ctx.fillText(b.text, 0, 3);
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
      if (this.phase !== 'outro') return;
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
      if (pop > 0) {
        ctx.save();
        ctx.translate(VW / 2, cy - 18); ctx.rotate(-0.035); ctx.scale(pop, pop);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = font(this.headline.length > 11 ? 132 : 158, 800);
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
    knight: { r: 18, hp: 24, dmg: 2, cd: 0.8, reach: 5, speed: 70, cost: 3.2, rank: 1, armor: 0.4 },
    giant: { r: 36, hp: 110, dmg: 5, cd: 1.25, reach: 6, speed: 46, cost: 22, splash: 48, rank: 0, armor: 0.5 },
  };
  const DOCTRINES = [
    { name: 'SWARM', mix: { soldier: 0.8, archer: 0.12, knight: 0.08 }, budget: 1.04, budget60: 1.08 },
    { name: 'ARCHERS', mix: { soldier: 0.35, archer: 0.55, knight: 0.1 }, budget: 1.03, budget60: 1.03 },
    { name: 'KNIGHTS', mix: { soldier: 0.3, archer: 0.15, knight: 0.55 }, budget: 0.975, budget60: 0.975 },
    { name: 'BALANCED', mix: { soldier: 0.5, archer: 0.3, knight: 0.2 }, budget: 1.02, budget60: 0.99 },
    { name: 'GIANT', mix: { soldier: 0.55, archer: 0.3, knight: 0.15 }, giant: true, budget: 0.89, budget60: 0.92 },
  ];

  class Army extends Match {
    constructor(seed, opts) {
      super(seed, opts);
      const R = this.R;
      this.key = 'army';
      this.audioGain = 3.0;
      this.label = 'Army Clash';
      this.title = 'ARMY CLASH';
      this.hook = R.pick(['WHICH ARMY SURVIVES?', 'WHO WINS THE WAR?', 'PICK YOUR ARMY', `${TEAMS[0].name} OR ${TEAMS[1].name}?`]);
      const d0 = R.pick(DOCTRINES);
      let d1 = R.pick(DOCTRINES);
      if (d1 === d0 && R.chance(0.75)) while (d1 === d0) d1 = R.pick(DOCTRINES);
      this.doc = [d0, d1];
      // opts.doctrines = ['SWARM', 'KNIGHTS'] picks the two army types instead of chance.
      if (this.opts.doctrines) this.doc = this.opts.doctrines.map(n => DOCTRINES.find(d => d.name === n) || d0);
      // fixedLength: the whole video runs exactly this long (fight + outro), with four reinforcement waves.
      this.fixed = this.opts.fixedLength || 0;
      const F = this.fixed;
      const budget = F ? R.range(this.opts.budgetLo || 190, this.opts.budgetHi || 215) : R.range(120, 140);
      this.units = [];
      this.arrows = [];
      this.alive = [0, 0];
      this.reserve = [0, 0];
      this.start = [0, 0];
      this.waves = [[], []];
      this.dmgMul = 1;
      this.pushStage = 0;
      let waveAt, waveOf;
      if (F) {
        this.hpScale = this.opts.hpScale || 1.3;
        waveAt = [0.18, 0.36, 0.53, 0.69].map(f => f * F * R.range(0.97, 1.03));
        waveOf = i => { const m = (i - 1) % 20; return m < 8 ? 0 : 1 + Math.floor((m - 8) / 3); };
        this.cap = F - 3;
        this.pushAt = [0.8 * F, 0.89 * F, 0.93 * F];
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
      for (let team = 0; team < 2; team++) {
        // opts.budgetMul = [top, bottom] scales each army's size (used to balance fixed match-ups).
        const bm = this.opts.budgetMul ? this.opts.budgetMul[team] : 1;
        const list = this.recruit(this.doc[team], team, budget * bm * (F ? this.doc[team].budget60 : this.doc[team].budget) * R.range(0.95, 1.05));
        this.start[team] = list.length;
        const parts = waveAt.map(() => []).concat([[]]), seen = {};
        for (const k of list) { const i = seen[k] = (seen[k] || 0) + 1; parts[k === 'giant' ? 0 : waveOf(i)].push(k); }
        this.deploy(team, parts[0], 'front');
        for (let w = 1; w < parts.length; w++) if (parts[w].length) { this.waves[team].push({ at: waveAt[w - 1], list: parts[w] }); this.reserve[team] += parts[w].length; }
      }
      this.lastTen = [false, false];
      this.grid = new Map();
      this.dispRatio = 0.5;
      this.splats = [];
      this.ground = api.makeCanvas ? api.makeCanvas(AR.w, AR.h) : null;
      this.stains = api.makeCanvas ? api.makeCanvas(AR.w, AR.h) : null;
      this.stainFade = 0;
      if (this.ground) this.paintGround();
    }
    paintGround() {
      if (this.opts.map === 'medieval') return this.paintMedieval();
      const g = this.ground.getContext('2d');
      g.fillStyle = COL.floor; g.fillRect(0, 0, AR.w, AR.h);
      g.strokeStyle = COL.grid; g.lineWidth = 2;
      g.beginPath();
      for (let x = 60; x < AR.w; x += 60) { g.moveTo(x, 0); g.lineTo(x, AR.h); }
      for (let y = 60; y < AR.h; y += 60) { g.moveTo(0, y); g.lineTo(AR.w, y); }
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.setLineDash([18, 14]); g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, AR.h / 2); g.lineTo(AR.w, AR.h / 2); g.stroke();
      g.setLineDash([]);
      const zone = (top, color) => {
        const y0 = top ? 0 : AR.h - 220;
        const lg = g.createLinearGradient(0, top ? 0 : AR.h, 0, top ? 220 : AR.h - 220);
        lg.addColorStop(0, color); lg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = lg; g.fillRect(0, y0, AR.w, 220);
      };
      zone(true, rgba(TEAMS[0].c, 0.12));
      zone(false, rgba(TEAMS[1].c, 0.12));
    }
    // Medieval map: soft checkered grass on the same 60px grid, with flowers, tufts and stones,
    // and tinted team zones. Same size as the classic map; purely visual.
    paintMedieval() {
      const g = this.ground.getContext('2d');
      const T = 60, D = rng(9001);
      for (let i = 0; i * T < AR.w; i++) for (let j = 0; j * T < AR.h; j++) {
        const light = (i + j) % 2 === 0, v = D.range(-5, 5);
        g.fillStyle = light ? `rgb(${70 + v},${138 + v},${60 + v})` : `rgb(${60 + v},${124 + v},${52 + v})`;
        g.fillRect(i * T, j * T, T, T);
        // gentle highlight on the top edge of each light tile
        if (light) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(i * T, j * T, T, 6); }
      }
      g.strokeStyle = 'rgba(10,40,10,0.18)'; g.lineWidth = 2;
      g.beginPath();
      for (let x = T; x < AR.w; x += T) { g.moveTo(x, 0); g.lineTo(x, AR.h); }
      for (let y = T; y < AR.h; y += T) { g.moveTo(0, y); g.lineTo(AR.w, y); }
      g.stroke();
      grassDecor(g, AR.w, AR.h, 150, D, 1.3, 0.95);
      // dashed midline like the classic map
      g.strokeStyle = 'rgba(255,255,255,0.14)'; g.setLineDash([18, 14]); g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, AR.h / 2); g.lineTo(AR.w, AR.h / 2); g.stroke();
      g.setLineDash([]);
      const zone = (top, color) => {
        const y0 = top ? 0 : AR.h - 220;
        const lg = g.createLinearGradient(0, top ? 0 : AR.h, 0, top ? 220 : AR.h - 220);
        lg.addColorStop(0, color); lg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = lg; g.fillRect(0, y0, AR.w, 220);
      };
      zone(true, rgba(TEAMS[0].c, 0.2));
      zone(false, rgba(TEAMS[1].c, 0.2));
      // slight shade so the troops stay easy to see
      g.fillStyle = 'rgba(5,10,6,0.14)'; g.fillRect(0, 0, AR.w, AR.h);
    }
    recruit(doc, team, budget) {
      const swordShare = this.swordShareT ? this.swordShareT[team] : this.swordShare;
      const R = this.R;
      const list = [];
      let left = budget;
      if (doc.giant) { list.push('giant'); left -= UNIT.giant.cost; }
      const keys = Object.keys(doc.mix);
      while (left >= 1) {
        let x = R.next(), k = keys[0];
        for (const key of keys) { x -= doc.mix[key]; if (x <= 0) { k = key; break; } }
        if (swordShare && R.chance(swordShare)) k = 'swordsman';
        else if (this.crossShare && R.chance(this.crossShare)) k = 'crossbowman';
        if (UNIT[k].cost > left) k = 'soldier';
        list.push(k); left -= UNIT[k].cost;
      }
      return list.sort((a, b) => UNIT[a].rank - UNIT[b].rank);
    }
    // 'front': first rows near the midline, stacking back toward the team's edge.
    // 'back': reinforcements enter at the team's own edge, stacking toward the middle.
    deploy(team, list, mode) {
      const R = this.R, mid = AR.y + AR.h / 2;
      const own = team === 0 ? -1 : 1;
      let dir, rowY, order;
      if (mode === 'front') { dir = own; rowY = mid + own * 95; order = list; }
      else { dir = -own; rowY = team === 0 ? AR.y + 6 : AR.y + AR.h - 6; order = list.slice().reverse(); }
      const maxW = 660;
      let i = 0;
      while (i < order.length) {
        const row = [];
        let width = 0, maxR = 0;
        while (i < order.length) {
          const r = UNIT[order[i]].r;
          if (width + r * 2 + 8 > maxW && row.length) break;
          row.push(order[i]); width += r * 2 + 8; maxR = Math.max(maxR, r); i++;
        }
        rowY += dir * maxR;
        let x = AR.x + AR.w / 2 - width / 2;
        for (const k of row) {
          const r = UNIT[k].r;
          x += r + 4;
          this.addUnit(team, k, x + R.range(-3, 3), clamp(rowY + R.range(-3, 3), AR.y + r + 2, AR.y + AR.h - r - 2));
          x += r + 4;
        }
        rowY += dir * (maxR + 8);
      }
    }
    addUnit(team, type, x, y) {
      const U = UNIT[type];
      const R = this.R;
      const hp = U.hp * (this.hpScale || 1);
      const pace = 1 + (R.chance(0.5) ? 1 : -1) * R.range(0.03, 0.07);
      this.units.push({ team, type, x, y, pace, gait: R.range(0, TAU), vx: 0, vy: 0, r: U.r, hp, max: hp, cd: R.range(0, U.cd), retarget: R.range(0, 0.3), target: null, flash: 0, lunge: 0, face: team === 0 ? Math.PI / 2 : -Math.PI / 2, dead: false, m: U.r * U.r });
      this.alive[team]++;
    }
    reinforce(team, wave) {
      wave.done = true;
      this.reserve[team] -= wave.list.length;
      this.deploy(team, wave.list, 'back');
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
    damage(u, dmg, from) {
      u.hp -= dmg; u.flash = 1;
      if (u.hp <= 0 && !u.dead) {
        u.dead = true;
        this.alive[u.team]--;
        this.burst(u.x, u.y, TEAMS[u.team].c, u.type === 'giant' ? 40 : 9, u.type === 'giant' ? 700 : 300, 0.5, u.type === 'giant' ? 12 : 7);
        if (this.stains) this.splats.push(u);
        this.snd('pop', { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7, big: u.type === 'giant' || u.type === 'knight' });
        if (u.type === 'giant') { this.shake(20); this.snd('boom', { gain: 0.6 }); this.banner(`${TEAMS[u.team].name} GIANT FALLS`, TEAMS[1 - u.team].c); }
      }
    }
    step(h) {
      const R = this.R;
      this.fightT += h;
      this.hash();
      for (const u of this.units) {
        if (u.dead) continue;
        const U = UNIT[u.type];
        u.cd -= h; u.retarget -= h;
        if (!u.target || u.target.dead || u.retarget <= 0) { u.target = this.nearest(u); u.retarget = R.range(0.25, 0.4); }
        const t = u.target;
        let dvx = 0, dvy = 0;
        if (t) {
          const dx = t.x - u.x, dy = t.y - u.y, d = Math.hypot(dx, dy) || 1;
          const nx = dx / d, ny = dy / d;
          // turn smoothly toward the target: ease in, and never faster than 9 rad/s, however fast the target moves
          { let df = Math.atan2(dy, dx) - u.face; df = Math.atan2(Math.sin(df), Math.cos(df)); const cap = 9 * h; u.face += clamp(df * Math.min(1, h * 12), -cap, cap); }
          const spd = U.speed * this.speedMul * (u.pace || 1);
          if (U.ranged) {
            if (d > U.range) { dvx = nx * spd; dvy = ny * spd; }
            else if (d < U.range * 0.45 && this.pushStage < 2) { dvx = -nx * spd * 0.6; dvy = -ny * spd * 0.6; }
            if (d <= U.range && u.cd <= 0) {
              u.cd = U.cd * R.range(0.85, 1.15);
              const v = U.bolt || 600, lead = d / v;
              const ax = t.x + t.vx * lead - u.x, ay = t.y + t.vy * lead - u.y, al = Math.hypot(ax, ay) || 1;
              this.arrows.push({ team: u.team, x: u.x + (ax / al) * (u.r + 4), y: u.y + (ay / al) * (u.r + 4), vx: (ax / al) * v, vy: (ay / al) * v, life: (U.range / v) * 1.35, dmg: U.dmg, bolt: !!U.bolt });
              this.snd('volley', { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7 });
            }
          } else {
            const edge = d - u.r - t.r;
            if (edge > U.reach) { dvx = nx * spd; dvy = ny * spd; }
            else if (u.cd <= 0) {
              u.cd = U.cd * R.range(0.85, 1.15);
              u.lunge = 1;
              if (U.splash) {
                for (const o of this.units) if (!o.dead && o.team !== u.team && Math.hypot(o.x - t.x, o.y - t.y) < U.splash + o.r) this.damage(o, U.dmg * this.dmgMul, u);
                this.shake(8); this.snd('stomp', { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7 });
                this.burst(t.x, t.y, COL.muted, 10, 300, 0.4, 7);
              } else {
                this.damage(t, U.dmg * this.dmgMul, u);
                this.snd('clash', { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7 });
              }
              if (u.type === 'swordsman') {
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
        const k = Math.min(1, 7 * h);
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
      for (const u of this.units) {
        if (u.dead) continue;
        u.x = clamp(u.x, AR.x + u.r, AR.x + AR.w - u.r);
        u.y = clamp(u.y, AR.y + u.r, AR.y + AR.h - u.r);
      }
      if (this.arrows.length) {
        const keep = [];
        for (const a of this.arrows) {
          a.x += a.vx * h; a.y += a.vy * h; a.life -= h;
          if (a.life <= 0 || a.x < AR.x || a.x > AR.x + AR.w || a.y < AR.y || a.y > AR.y + AR.h) continue;
          const ci = (a.x - AR.x) / 64 | 0, cj = (a.y - AR.y) / 64 | 0;
          let hitU = null;
          for (let di = -1; di <= 1 && !hitU; di++) for (let dj = -1; dj <= 1 && !hitU; dj++) {
            const b = this.grid.get((ci + di) * 64 + cj + dj);
            if (!b) continue;
            for (const o of b) if (!o.dead && o.team !== a.team && (o.x - a.x) ** 2 + (o.y - a.y) ** 2 < (o.r + 3) ** 2) { hitU = o; break; }
          }
          if (hitU) { const arm = UNIT[hitU.type].armor; this.damage(hitU, (a.dmg || UNIT.archer.dmg) * (a.bolt ? Math.max(arm, 0.75) : arm) * this.dmgMul); this.snd('thunk', { pan: (a.x - AR.x) / AR.w * 1.4 - 0.7, quiet: true }); continue; }
          keep.push(a);
        }
        this.arrows = keep;
      }
      if (this.units.some(u => u.dead)) this.units = this.units.filter(u => !u.dead);
      for (let tm = 0; tm < 2; tm++) {
        const mine = this.alive[tm] + this.reserve[tm], theirs = this.alive[1 - tm] + this.reserve[1 - tm];
        if (!this.lastTen[tm] && mine <= 10 && mine > 0 && theirs > 10) {
          this.lastTen[tm] = true; this.banner(`${TEAMS[tm].name}: LAST ${mine}`, TEAMS[tm].c); this.snd('alarm');
        }
      }
      let arrived = false;
      for (let tm = 0; tm < 2; tm++) {
        for (const wv of this.waves[tm]) {
          if (wv.done) continue;
          if (this.fightT >= wv.at || this.alive[tm] === 0) { this.reinforce(tm, wv); arrived = true; break; }
        }
      }
      if (arrived) { this.banner('REINFORCEMENTS!', COL.gold); this.snd('alarm'); }
      if (this.pushStage < this.pushAt.length && this.fightT >= this.pushAt[this.pushStage]) {
        this.dmgMul = this.pushMul[this.pushStage];
        this.speedMul = this.pushSpeed[this.pushStage];
        this.pushStage++;
        for (const u of this.units) u.retarget = 0;
        this.banner(['FINAL PUSH', 'ALL-OUT ATTACK', 'LAST STAND'][this.pushStage - 1] + ` · DMG ×${this.dmgMul}`, COL.gold, 2.2);
        this.snd('alarm');
      }
      const total = [this.alive[0] + this.reserve[0], this.alive[1] + this.reserve[1]];
      if (total[0] === 0 || total[1] === 0) {
        const w = total[0] > 0 ? 0 : 1;
        this.end(w, `${TEAMS[w].name} WINS`, `${total[w]} SURVIVOR${total[w] === 1 ? '' : 'S'} LEFT`);
      } else if (this.fightT >= this.cap) {
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
    outroStep(dt) {
      this.arrows = [];
      for (const u of this.units) {
        if (this.retreat === u.team) {
          const dir = u.team === 0 ? -1 : 1;
          u.vy += (dir * 320 - u.vy) * Math.min(1, dt * 4); u.vx *= 0.9;
          u.x += u.vx * dt; u.y += u.vy * dt;
          { let df = (dir > 0 ? Math.PI / 2 : -Math.PI / 2) - u.face; df = Math.atan2(Math.sin(df), Math.cos(df)); const cap = 9 * dt; u.face += clamp(df * Math.min(1, dt * 12), -cap, cap); }
          u.fade = clamp(1 - this.outroT / 1.6, 0, 1);
        } else { u.vx *= 0.9; u.vy *= 0.9; }
      }
      if (this.fixed && this.outroLen >= 5.5 && !this.tallySnd && this.outroT >= 2.4) { this.tallySnd = true; this.snd('pickup', { team: this.winner }); }
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
          for (let tm = 0; tm < 2; tm++) {
            const left = this.alive[tm] + this.reserve[tm], lost = this.start[tm] - left;
            strokeText(ctx, `${TEAMS[tm].name}: ${left} LEFT · ${lost} LOST`, VW / 2, cy + 285 + tm * 64 + (1 - a) * 20, TEAMS[tm].c, COL.ink, 10);
          }
          spaced(ctx, 0);
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
      for (const u of this.units) { u.flash = Math.max(0, u.flash - dt * 6); u.lunge = Math.max(0, u.lunge - dt * 6); if (u.swing) u.swing = Math.max(0, u.swing - dt * 2.6); }
      const a0 = this.alive[0] + this.reserve[0], a1 = this.alive[1] + this.reserve[1];
      this.dispRatio += ((a0 + a1 ? a0 / (a0 + a1) : 0.5) - this.dispRatio) * Math.min(1, dt * 8);
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
    draw(ctx) {
      this.drawBG(ctx);
      this.drawHUD(ctx, {
        title: this.title, hook: this.hook,
        lv: String(this.alive[0] + this.reserve[0]), rv: String(this.alive[1] + this.reserve[1]),
        ls: `${this.doc[0].name} · ${this.start[0]} UNITS`, rs: `${this.start[1]} UNITS · ${this.doc[1].name}`,
        ratio: this.dispRatio,
      });
      ctx.save();
      ctx.translate(this.shakeX, this.shakeY);
      roundRect(ctx, AR.x, AR.y, AR.w, AR.h, 18);
      ctx.save(); ctx.clip();
      if (this.ground) ctx.drawImage(this.ground, AR.x, AR.y, AR.w, AR.h);
      else { ctx.fillStyle = COL.floor; ctx.fillRect(AR.x, AR.y, AR.w, AR.h); }
      if (this.stains) ctx.drawImage(this.stains, AR.x, AR.y, AR.w, AR.h);
      // arrows
      ctx.lineCap = 'round';
      for (const a of this.arrows) {
        const l = Math.hypot(a.vx, a.vy) || 1, ux = a.vx / l, uy = a.vy / l;
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
      // units by type for fewer state changes
      const cheer = this.phase === 'outro' ? this.winner : -1;
      const armour = this.opts.map === 'medieval'; // on the medieval map every troop wears knight armour
      for (const u of this.units) {
        const tm = TEAMS[u.team];
        if (u.fade !== undefined) { if (u.fade <= 0) continue; ctx.globalAlpha = u.fade; }
        let lx = Math.cos(u.face) * u.lunge * 6, ly = Math.sin(u.face) * u.lunge * 6;
        if (u.type === 'swordsman' && !(u.swing > 0) && Math.hypot(u.vx, u.vy) > 18) {
          const sway = Math.sin(this.fightT * 11 + u.gait) * 2.2;
          lx = -Math.sin(u.face) * sway; ly = Math.cos(u.face) * sway;
        } else if (u.type === 'swordsman') {
          const p = 1 - (u.swing || 0), on = u.swing > 0;
          const fwd = on ? Math.sin(Math.PI * p) * 7 : 0;
          const side = on ? (p - 0.5) * 5 * -(u.swingFrom || -1) : 0;
          lx = Math.cos(u.face) * fwd - Math.sin(u.face) * side;
          ly = Math.sin(u.face) * fwd + Math.cos(u.face) * side;
        }
        const hop = u.team === cheer ? -Math.abs(Math.sin(this.outroT * 9 + u.x * 0.05)) * 6 : 0;
        const x = u.x + lx, y = u.y + ly + hop;
        if (u.type === 'archer') {
          ctx.save(); ctx.translate(x, y); ctx.rotate(u.face);
          ctx.beginPath(); ctx.moveTo(u.r * 1.5, 0); ctx.lineTo(-u.r, -u.r * 1.05); ctx.lineTo(-u.r, u.r * 1.05); ctx.closePath();
          ctx.fillStyle = tm.c; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = COL.ink; ctx.stroke();
          if (armour) { ctx.beginPath(); ctx.arc(-u.r * 0.1, 0, u.r * 0.5, 0, TAU); ctx.fillStyle = COL.steel; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke();
            ctx.beginPath(); ctx.moveTo(u.r * 0.18, -u.r * 0.28); ctx.lineTo(u.r * 0.18, u.r * 0.28); ctx.lineWidth = 2.5; ctx.stroke(); }
          ctx.restore();
        } else {
          ctx.beginPath(); ctx.arc(x, y, u.r, 0, TAU);
          ctx.fillStyle = u.type === 'soldier' || u.type === 'crossbowman' ? tm.c : tm.d; ctx.fill();
          ctx.lineWidth = u.type === 'giant' ? 5 : 3; ctx.strokeStyle = COL.ink; ctx.stroke();
          if (u.type === 'knight') { ctx.beginPath(); ctx.arc(x, y, u.r - 4.5, 0, TAU); ctx.lineWidth = 3.5; ctx.strokeStyle = tm.l; ctx.stroke(); }
          if (armour && u.type !== 'giant') {
            // cartoon knight armour from above: flat black helm with a T-shaped visor facing the enemy,
            // a simple shine, black shoulder plates and a team-colour plume
            const fx = Math.cos(u.face), fy = Math.sin(u.face), px = -fy, py = fx, hr = u.r * 0.7;
            const HELM = '#262A33', VISOR = '#C9D1DC';
            ctx.lineWidth = 2; ctx.strokeStyle = COL.ink;
            for (const sd of [-1, 1]) {
              const sx = x + px * sd * u.r * 0.72 - fx * u.r * 0.1, sy = y + py * sd * u.r * 0.72 - fy * u.r * 0.1;
              ctx.beginPath(); ctx.ellipse(sx, sy, u.r * 0.34, u.r * 0.24, u.face, 0, TAU);
              ctx.fillStyle = HELM; ctx.fill(); ctx.stroke();
            }
            ctx.beginPath(); ctx.arc(x, y, hr, 0, TAU); ctx.fillStyle = HELM; ctx.fill(); ctx.lineWidth = 2.4; ctx.stroke();
            // shine
            ctx.beginPath(); ctx.arc(x, y, hr * 0.68, u.face + 2.3, u.face + 3.5);
            ctx.lineWidth = Math.max(1.5, hr * 0.18); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.stroke();
            // T visor: a bar across the front and a short slit back toward the middle
            const vx = x + fx * hr * 0.5, vy = y + fy * hr * 0.5, w = hr * 0.55;
            ctx.lineWidth = Math.max(2, hr * 0.2); ctx.strokeStyle = VISOR;
            ctx.beginPath(); ctx.moveTo(vx - px * w, vy - py * w); ctx.lineTo(vx + px * w, vy + py * w);
            ctx.moveTo(vx, vy); ctx.lineTo(x + fx * hr * 0.05, y + fy * hr * 0.05); ctx.stroke();
            ctx.beginPath(); ctx.arc(x - fx * hr * 0.62, y - fy * hr * 0.62, hr * 0.28, 0, TAU); ctx.fillStyle = tm.c; ctx.fill();
            ctx.lineWidth = 1.5; ctx.strokeStyle = COL.ink; ctx.stroke();
          }
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
          if (u.type === 'swordsman') {
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
                ctx.beginPath(); ctx.arc(x, y, u.r + 15, Math.min(a0, a1), Math.max(a0, a1));
                ctx.lineWidth = 3 + 8 * ((k + 1) / steps);
                ctx.strokeStyle = `rgba(255,255,255,${(0.08 + 0.5 * ((k + 1) / steps)) * Math.min(1, u.swing * 1.6)})`;
                ctx.stroke();
              }
            }
            const fx = Math.cos(ang), fy = Math.sin(ang), px = -fy, py = fx;
            const bx0 = x + fx * (u.r - 2), by0 = y + fy * (u.r - 2), tx = x + fx * (u.r + 22), ty = y + fy * (u.r + 22);
            ctx.lineWidth = 7; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(tx, ty); ctx.stroke();
            ctx.lineWidth = 4; ctx.strokeStyle = COL.steel; ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(tx, ty); ctx.stroke();
            ctx.lineWidth = 4; ctx.strokeStyle = COL.gold; ctx.beginPath(); ctx.moveTo(bx0 + px * 7, by0 + py * 7); ctx.lineTo(bx0 - px * 7, by0 - py * 7); ctx.stroke();
          }
          if (u.type === 'giant') {
            ctx.beginPath(); ctx.arc(x, y, u.r - 9, 0, TAU); ctx.fillStyle = tm.c; ctx.fill();
            ctx.fillStyle = COL.gold; ctx.beginPath();
            ctx.moveTo(x - 18, y + 6); ctx.lineTo(x - 18, y - 12); ctx.lineTo(x - 9, y - 3); ctx.lineTo(x, y - 18); ctx.lineTo(x + 9, y - 3); ctx.lineTo(x + 18, y - 12); ctx.lineTo(x + 18, y + 6); ctx.closePath(); ctx.fill();
            ctx.lineWidth = 2.5; ctx.strokeStyle = COL.ink; ctx.stroke();
          }
        }
        if (u.flash > 0) { ctx.beginPath(); ctx.arc(x, y, u.r, 0, TAU); ctx.fillStyle = `rgba(255,255,255,${u.flash * 0.8})`; ctx.fill(); }
        if ((u.type === 'knight' || u.type === 'giant') && u.hp < u.max) {
          const w = u.r * 2;
          ctx.fillStyle = COL.ink; ctx.fillRect(x - w / 2 - 2, y - u.r - 13, w + 4, 8);
          ctx.fillStyle = tm.l; ctx.fillRect(x - w / 2, y - u.r - 11, w * clamp(u.hp / u.max, 0, 1), 4);
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      ctx.restore();
      this.drawArenaFrame(ctx);
      this.drawFX(ctx);
      this.drawBanners(ctx);
      this.drawFooter(ctx, 'BATTLE TIME', fmtTime(this.fightT), false);
      this.drawIntro(ctx, 'CHARGE!');
      this.drawOutro(ctx);
      this.drawTally(ctx);
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
      this.reset(1);
    }
    reset(seed) { this.L.fill(0); this.R.fill(0); this.last = {}; this.ns = (seed >>> 0) || 1; }
    noise() { let x = this.ns; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.ns = x >>> 0; return (this.ns / 4294967296) * 2 - 1; }
    gate(key, gap, t) { const l = this.last[key]; if (l !== undefined && t - l < gap) return false; this.last[key] = t; return true; }
    // Generic voice: sum of decaying partials with optional pitch glide, plus filtered noise.
    voice(t, o) {
      const sr = this.sr, s0 = Math.floor(t * sr);
      const n = Math.min(Math.floor((o.dur || 0.3) * sr), this.len - s0);
      if (n <= 0 || s0 < 0) return;
      const pan = clamp(o.pan || 0, -1, 1);
      const gl = (o.gain || 0.2) * Math.cos(((pan + 1) * Math.PI) / 4), gr = (o.gain || 0.2) * Math.sin(((pan + 1) * Math.PI) / 4);
      const parts = (o.partials || []).map(p => ({ f: p.f, f2: p.f2 === undefined ? p.f : p.f2, a: p.a === undefined ? 1 : p.a, k: Math.exp(-1 / ((p.decay || 0.1) * sr)), env: 1, ph: 0, glide: p.glide || 0.08, inc: (TAU * p.f) / sr, gk: Math.exp(-1 / ((p.glide || 0.08) * sr)), gd: 1 }));
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
    play(ev, t) {
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
        case 'bonk': if (this.gate('bonk', 0.1, t)) this.voice(t, { dur: 0.15, gain: 0.3, pan, partials: [{ f: 280, f2: 170, glide: 0.04, decay: 0.05 }] }); return;
        case 'wall': if (this.gate('wall', 0.12, t)) this.voice(t, { dur: 0.08, gain: 0.12, pan, partials: [{ f: 120, f2: 70, glide: 0.02, decay: 0.025 }], noise: { a: 0.3, decay: 0.01, lp: 0.3 } }); return;
        case 'shoot': if (this.gate('shoot', 0.05, t)) this.voice(t, { dur: 0.18, gain: 0.2, pan, partials: [{ f: 520, f2: 240, glide: 0.04, decay: 0.06 }], noise: { a: 0.5, decay: 0.02, lp: 0.4 } }); return;
        case 'thunk': if (this.gate('thunk', ev.quiet ? 0.06 : 0.04, t)) this.voice(t, { dur: 0.12, gain: ev.quiet ? 0.08 : 0.25, pan, partials: [{ f: 300, f2: 150, glide: 0.03, decay: 0.04 }], noise: { a: 0.5, decay: 0.015, lp: 0.5 } }); return;
        case 'tink': if (this.gate('tink', 0.05, t)) this.voice(t, { dur: 0.15, gain: 0.12, pan, partials: [{ f: 2400, decay: 0.05 }, { f: 3700, a: 0.5, decay: 0.03 }] }); return;
        case 'ko':
          this.voice(t, { dur: 1.2, gain: 0.7, pan, partials: [{ f: 110, f2: 34, glide: 0.25, decay: 0.4 }], noise: { a: 0.9, decay: 0.25, lp: 0.12 } });
          this.voice(t, { dur: 0.8, gain: 0.18, pan, partials: [{ f: 520, decay: 0.35 }, { f: 1206, a: 0.5, decay: 0.22 }, { f: 1981, a: 0.3, decay: 0.14 }] });
          return;
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
        case 'win': {
          const base = 261.63;
          [1, 1.26, 1.5, 2].forEach((m, k) => this.voice(t + 0.25 + k * 0.05, { dur: 1.8, gain: 0.07, pan: (k - 1.5) * 0.3, attack: 0.01, partials: [1, 2, 3, 4, 5].map(h => ({ f: base * m * h, a: 1 / h, decay: 0.9 / h })) }));
          return;
        }
      }
    }
  }

  const GAMES = { territory: Territory, duel: Duel, army: Army };
  Object.assign(api, { rng, Match, Territory, Duel, Army, Synth, GAMES, WEAPONS, DOCTRINES, UNIT, fmtTime });
  return api;
})();
if (typeof module !== 'undefined') module.exports = RVB;
