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
    BELGIUM: { c: '#FFD21F', d: '#8F7200', l: '#FFF0A8', a: '#E8222F' },
    SWEDEN: { c: '#1E7FD0', d: '#0D4677', l: '#B4D8F5', a: '#FECC00' },
    NORWAY: { c: '#D9233A', d: '#850E1E', l: '#FFB6BF', a: '#FFFFFF' },
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
      delete TEAMS[i].a;
      Object.assign(TEAMS[i], { name }, pal);
    });
    bgCache = {};
  };
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
        this.outroT += dt;
        if (this.outroStep) this.outroStep(dt);
        if (this.outroT >= this.outroLen) this.finished = true;
      }
      if (this.cosmetic) this.cosmetic(dt);
    }
    end(winner, headline, detail) {
      if (this.phase !== 'fight') return;
      this.phase = 'outro';
      // with a director, slow motion makes the game clock lag the video clock; the outro uses the video clock so the video still ends on time
      if (this.opts.fixedLength) this.outroLen = Math.max(3, this.opts.fixedLength - (this.realT !== undefined ? this.realT : this.t));
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
        } else if (p.smoke) {
          ctx.globalAlpha = clamp(k * 0.8, 0, 0.6);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.4 - 0.6 * k), 0, TAU); ctx.fill();
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
  // round troops with their own extra details (see drawNewLook)
  const NEW_LOOK = { trooper: 1, pirate: 1, musketeer: 1, zombie: 1, ninja: 1, samurai: 1 };
  const LIGHT_FILL = { soldier: 1, crossbowman: 1, spearman: 1, berserker: 1, healer: 1, rifleman: 1, sniper: 1, grenadier: 1, orc: 1, elf: 1, wizard: 1, trooper: 1, pirate: 1, musketeer: 1, samurai: 1 };
  const DOCTRINES = [
    { name: 'SWARM', mix: { soldier: 0.8, archer: 0.12, knight: 0.08 }, budget: 1.04, budget60: 1.08 },
    { name: 'ARCHERS', mix: { soldier: 0.35, archer: 0.55, knight: 0.1 }, budget: 1.03, budget60: 1.03 },
    { name: 'KNIGHTS', mix: { soldier: 0.3, archer: 0.15, knight: 0.55 }, budget: 0.975, budget60: 0.975 },
    { name: 'BALANCED', mix: { soldier: 0.5, archer: 0.3, knight: 0.2 }, budget: 1.02, budget60: 0.99 },
    { name: 'GIANT', mix: { soldier: 0.55, archer: 0.3, knight: 0.15 }, giant: true, budget: 0.89, budget60: 0.92 },
  ];

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
  ];
  const SAMURAI_DOCTRINES = [
    { name: 'SAMURAI', base: 'ninja', mix: { samurai: 0.55, ninja: 0.25, archer: 0.2 }, budget: 1, budget60: 1 },
    { name: 'NINJAS', base: 'ninja', mix: { ninja: 0.8, samurai: 0.2 }, budget: 1, budget60: 1 },
  ];
  const GENRES = { medieval: DOCTRINES, modern: MODERN_DOCTRINES, fantasy: FANTASY_DOCTRINES, scifi: SCIFI_DOCTRINES, pirate: PIRATE_DOCTRINES, horror: HORROR_DOCTRINES, samurai: SAMURAI_DOCTRINES };
  const ALL_DOCTRINES = () => [].concat(...Object.values(GENRES));
  // the genre each troop comes from
  const UNIT_ERA = {};
  for (const k of ['soldier', 'archer', 'crossbowman', 'swordsman', 'spearman', 'shieldbearer', 'berserker', 'healer', 'knight', 'giant']) UNIT_ERA[k] = 'medieval';
  for (const k of ['rifleman', 'gunner', 'sniper', 'grenadier', 'tank']) UNIT_ERA[k] = 'modern';
  for (const k of ['wizard', 'dragon', 'orc', 'skeleton', 'elf']) UNIT_ERA[k] = 'fantasy';
  for (const k of ['trooper', 'robot', 'mech']) UNIT_ERA[k] = 'scifi';
  for (const k of ['pirate', 'musketeer', 'cannon']) UNIT_ERA[k] = 'pirate';
  UNIT_ERA.zombie = 'horror'; UNIT_ERA.ninja = 'samurai'; UNIT_ERA.samurai = 'samurai';
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
  const MAPS = {
    open: [],
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
      this.hook = R.pick(era === 'scifi' ? ['WHO WINS THE FUTURE?', 'LASERS OR STEEL?', 'PICK YOUR FLEET', `${TEAMS[0].name} OR ${TEAMS[1].name}?`]
        : era === 'pirate' ? ['WHO RULES THE SEAS?', 'PICK YOUR CREW', 'CUTLASS OR CANNON?', `${TEAMS[0].name} OR ${TEAMS[1].name}?`]
        : era === 'horror' ? ['CAN THEY SURVIVE?', 'DON\'T GET BITTEN', 'THE DEAD RISE', `${TEAMS[0].name} OR ${TEAMS[1].name}?`]
        : era === 'samurai' ? ['WHO HAS HONOR?', 'BLADE VS BLADE', 'PICK YOUR CLAN', `${TEAMS[0].name} OR ${TEAMS[1].name}?`]
        : era === 'wild' ? ['DREAM TEAM BATTLE', 'WHO WINS THIS?', 'ANYTHING GOES', `${TEAMS[0].name} OR ${TEAMS[1].name}?`]
        : this.opts.era === 'fantasy'
        ? ['WHO RULES THE REALM?', 'PICK YOUR FACTION', 'MAGIC OR MIGHT?', `${TEAMS[0].name} OR ${TEAMS[1].name}?`]
        : this.opts.era === 'mixed'
        ? ['OLD VS NEW?', 'SWORDS OR GUNS?', 'CAN THE PAST WIN?', `${TEAMS[0].name} OR ${TEAMS[1].name}?`]
        : this.opts.era === 'modern'
        ? ['WHO WINS THE FIREFIGHT?', 'WHO HOLDS THE LINE?', 'PICK YOUR SQUAD', `${TEAMS[0].name} OR ${TEAMS[1].name}?`]
        : ['WHICH ARMY SURVIVES?', 'WHO WINS THE WAR?', 'PICK YOUR ARMY', `${TEAMS[0].name} OR ${TEAMS[1].name}?`]);
      this.booms = [];
      // opts.map picks the battlefield (see MAPS); obstacles block movement, bullets and arrows
      const cx0 = AR.x + AR.w / 2, cy0 = AR.y + AR.h / 2;
      this.obstacles = []; this.decor = [];
      for (const o of MAPS[this.opts.map] || []) {
        if (o.c) this.obstacles.push({ kind: o.kind, circle: true, x: cx0 + o.c[0], y: cy0 + o.c[1], r: o.c[2] });
        else if (o.b) this.obstacles.push({ kind: o.kind, x0: cx0 + o.b[0], y0: cy0 + o.b[1], x1: cx0 + o.b[0] + o.b[2], y1: cy0 + o.b[1] + o.b[3] });
        else if (o.d) this.decor.push({ kind: o.kind, x: cx0 + o.d[0], y: cy0 + o.d[1], r: o.d[2] });
      }
      const d0 = R.pick(DOCTRINES);
      let d1 = R.pick(DOCTRINES);
      if (d1 === d0 && R.chance(0.75)) while (d1 === d0) d1 = R.pick(DOCTRINES);
      this.doc = [d0, d1];
      // opts.doctrines = ['SWARM', 'KNIGHTS'] picks the two army types instead of chance.
      if (this.opts.doctrines) this.doc = this.opts.doctrines.map(n => (n && typeof n === 'object' ? customDoc(n) : ALL_DOCTRINES().find(d => d.name === n) || d0));
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
      // opts.extras: other optional troops, e.g. [{ type: 'spearman', share: 0.15 }]
      this.extras = (this.opts.extras || []).filter(e => UNIT[e.type] && e.share > 0);
      // opts.extrasByTeam = [[...top extras], [...bottom extras]] gives each side its own extra troops
      this.extrasT = this.opts.extrasByTeam ? this.opts.extrasByTeam.map(l => (l || []).filter(e => UNIT[e.type] && e.share > 0)) : null;
      for (let team = 0; team < 2; team++) {
        // opts.budgetMul = [top, bottom] scales each army's size (used to balance fixed match-ups).
        const bm = this.opts.budgetMul ? this.opts.budgetMul[team] : 1;
        const list = this.recruit(this.doc[team], team, budget * bm * (F ? this.doc[team].budget60 : this.doc[team].budget) * R.range(0.95, 1.05));
        this.start[team] = list.length;
        const parts = waveAt.map(() => []).concat([[]]), seen = {};
        for (const k of list) { const i = seen[k] = (seen[k] || 0) + 1; parts[UNIT[k].rank === 0 ? 0 : waveOf(i)].push(k); }
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
      if (this.ground) this.paintGround(this.ground, 1);
      // fantasy land: twinkling sparkles scattered over the ground (fixed spots, the same in every video on this map)
      if (this.opts.map === 'enchanted') {
        const S = rng(0x5A11C);
        this.sparkles = [];
        for (let i = 0; i < 26; i++) this.sparkles.push({ x: AR.x + S.range(20, AR.w - 20), y: AR.y + S.range(20, AR.h - 20), r: S.range(4, 8), sp: S.range(1.5, 3.5), ph: S.range(0, TAU), c: S.chance(0.5) ? '#E9D5FF' : '#A5F3FC' });
      }
      this.liveDecor = this.decor.some(d => d.kind === 'fire') || !!this.sparkles;
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
        g.save();
        idx++;
        if (o.circle) {
          const x = o.x - ox, y = o.y - oy;
          g.beginPath(); g.ellipse(x + 5, y + 7, o.r, o.r * 0.9, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,0.38)'; g.fill();
          if (o.kind === 'pillar') {
            g.beginPath(); g.arc(x, y, o.r, 0, TAU); g.fillStyle = '#4A5368'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
            g.beginPath(); g.arc(x, y, o.r * 0.68, 0, TAU); g.fillStyle = '#5E6880'; g.fill(); g.lineWidth = 2; g.stroke();
            g.beginPath(); g.arc(x - o.r * 0.2, y - o.r * 0.25, o.r * 0.22, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fill();
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
          } else if (o.kind === 'crate') {
            roundRect(g, x, y, w, h, 3); g.fillStyle = '#6B5233'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
            g.beginPath(); g.moveTo(x + 4, y + 4); g.lineTo(x + w - 4, y + h - 4); g.moveTo(x + w - 4, y + 4); g.lineTo(x + 4, y + h - 4); g.lineWidth = 2.5; g.strokeStyle = '#4A3822'; g.stroke();
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
      zone(true, rgba(TEAMS[0].c, 0.12));
      zone(false, rgba(TEAMS[1].c, 0.12));
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
    deploy(team, list, mode) {
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
      this.units.push({ team, type, x, y, flying: !!U.flying, pace, gait: R.range(0, TAU), vx: 0, vy: 0, r: U.r, hp, max: hp, cd: R.range(0, U.cd), retarget: R.range(0, 0.3), target: null, flash: 0, lunge: 0, face: team === 0 ? Math.PI / 2 : -Math.PI / 2, dead: false, m: U.r * U.r });
      this.alive[team]++;
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
        if (o.circle ? (x - o.x) ** 2 + (y - o.y) ** 2 < o.r * o.r : x > o.x0 && x < o.x1 && y > o.y0 && y < o.y1) return o;
      }
      return null;
    }
    // move a unit (anything with x, y, r) out of any obstacle it overlaps
    pushOut(u) {
      for (const o of this.obstacles) {
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
      const allow = this.opts.events === true ? ['airdrop', 'airstrike', 'meteors'] : this.opts.events;
      const skies = ['modern', 'scifi', 'mixed'].includes(era) || (era === 'wild' && E.chance(0.5));
      this.events = [];
      if (allow.includes('airdrop')) this.events.push({ type: 'airdrop', at: E.range(0.24, 0.4) * F, plane: skies || era === 'horror', t: 0 });
      if (E.chance(0.75)) {
        if (skies && allow.includes('airstrike')) this.events.push({ type: 'airstrike', from: E.range(0.45, 0.58) * F, last: 0.68 * F, orbital: era === 'scifi', t: 0 });
        else if (!skies && allow.includes('meteors')) this.events.push({ type: 'meteors', at: E.range(0.48, 0.64) * F, style: era === 'pirate' ? 'cannonballs' : era === 'horror' ? 'lightning' : 'meteors', t: 0 });
      }
    }
    ev_airdrop(ev, h) {
      if (!ev.started) {
        if (this.fightT < ev.at) return;
        // drop point: somewhere on the middle line, clear of obstacles, so both sides have a fair run at it
        const E = this.ER, p = { x: E.range(AR.x + 170, AR.x + AR.w - 170), y: AR.y + AR.h / 2 + E.range(-30, 30), r: 22 };
        for (let k = 0; k < 4; k++) this.pushOut(p);
        Object.assign(ev, { started: true, x: p.x, y: p.y, r: 14, dir: E.chance(0.5) ? 1 : -1, release: ev.plane ? 1 : 0, T: 2.2 });
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
      for (const u of this.units) if (!u.dead && Math.hypot(u.x - ev.x, u.y - ev.y) < u.r + 18) { this.grabDrop(ev, u.team); break; }
    }
    grabDrop(ev, team) {
      ev.done = true; this.drop = null;
      // inside: a squad of that army's best troop (worth about 14 recruits)
      const doc = this.doc[team], keys = Object.keys(doc.mix).filter(k => UNIT[k] && !UNIT[k].healer && UNIT[k].rank !== 0);
      const elite = keys.length ? keys.reduce((a, b) => (UNIT[b].cost > UNIT[a].cost ? b : a)) : doc.base || 'soldier';
      const n = clamp(Math.round(14 / UNIT[elite].cost), 3, 8);
      for (let k = 0; k < n; k++) { const a = k / n * TAU; this.addUnit(team, elite, ev.x + Math.cos(a) * 26, ev.y + Math.sin(a) * 26); }
      this.gained = this.gained || [0, 0]; this.gained[team] += n;
      this.banner(`${TEAMS[team].name} GRABS THE DROP · +${n}`, TEAMS[team].c, 2);
      this.burst(ev.x, ev.y, COL.gold, 18, 380, 0.6, 8); this.burst(ev.x, ev.y, TEAMS[team].c, 12, 300, 0.6, 7);
      this.snd('pickup', { team }); this.shake(5);
      if (this.camEv) this.camEv.push({ type: 'grab', x: ev.x, y: ev.y, team });
    }
    ev_airstrike(ev, h) {
      if (!ev.called) {
        if (this.fightT < ev.from) return;
        const tot = [this.alive[0] + this.reserve[0], this.alive[1] + this.reserve[1]];
        let behind = tot[0] < tot[1] * 0.8 ? 0 : tot[1] < tot[0] * 0.8 ? 1 : -1;
        if (behind < 0 && this.fightT >= ev.last) behind = tot[0] !== tot[1] ? (tot[0] < tot[1] ? 0 : 1) : (this.ER.chance(0.5) ? 0 : 1);
        if (behind < 0 || !tot[0] || !tot[1]) return;
        // the side that's behind calls it in on the thickest group of enemies
        const foe = 1 - behind, N = 6, cs = AR.w / N, cnt = new Float32Array(N * N);
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
      for (const ev of this.events) {
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
            for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x, cy); ctx.arc(x, cy, cw, Math.PI + k * Math.PI / 4, Math.PI + (k + 1) * Math.PI / 4); ctx.closePath(); ctx.fillStyle = k % 2 ? '#F4F6FB' : '#E5484D'; ctx.fill(); }
            ctx.beginPath(); ctx.arc(x, cy, cw, Math.PI, TAU); ctx.closePath(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
          } else {
            const pulse = 0.5 + 0.5 * Math.sin(this.t * 6);
            ctx.beginPath(); ctx.arc(ev.x, ev.y, 26 + pulse * 10, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,210,63,${0.35 + 0.4 * pulse})`; ctx.stroke();
          }
          const b = 13 * sc;
          roundRect(ctx, x - b, y - b, b * 2, b * 2, 3); ctx.fillStyle = '#B07A3E'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
          ctx.lineWidth = 2; ctx.strokeStyle = '#6E4A22'; ctx.beginPath(); ctx.moveTo(x - b, y - b * 0.33); ctx.lineTo(x + b, y - b * 0.33); ctx.moveTo(x - b, y + b * 0.33); ctx.lineTo(x + b, y + b * 0.33); ctx.stroke();
          ctx.fillStyle = COL.gold; ctx.fillRect(x - b * 0.25, y - b, b * 0.5, b * 2); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.strokeRect(x - b * 0.25, y - b, b * 0.5, b * 2);
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
      const big = a.kind === 'shell' || a.kind === 'cannonball' || a.kind === 'bomb' || a.kind === 'meteor' || a.kind === 'lightning';
      for (const o of this.units) {
        if (o.dead || o.team === a.team) continue;
        const d = Math.hypot(o.x - a.x, o.y - a.y), reach = a.splash + o.r;
        if (d < reach) this.damage(o, a.dmg * (1 - 0.5 * d / reach) * Math.max(UNIT[o.type].armor, 0.5) * this.dmgMul, a.from);
      }
      if (this.camEv) this.camEv.push({ type: 'blast', x: a.x, y: a.y, kind: a.kind });
      this.booms.push({ x: a.x, y: a.y, r: a.splash, t: 0, magic: a.kind === 'fireball', zap: a.kind === 'lightning' });
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
    damage(u, dmg, from) {
      u.hp -= dmg; u.flash = 1;
      if (u.hp <= 0 && !u.dead) {
        u.dead = true;
        this.alive[u.team]--;
        if (this.camEv) { if (from) from.kills = (from.kills || 0) + 1; this.camEv.push({ type: 'death', x: u.x, y: u.y, unit: u, big: UNIT[u.type].rank === 0, by: from }); }
        const huge = UNIT[u.type].rank === 0;
        // bitten by a zombie: gets back up as a zombie on the zombies' side
        if (from && UNIT[from.type].infect && LIVING[u.type] && from.team !== u.team) { (this.rising || (this.rising = [])).push({ x: u.x, y: u.y, team: from.team, t: 0.7 }); }
        this.burst(u.x, u.y, TEAMS[u.team].c, huge ? 40 : 9, huge ? 700 : 300, 0.5, huge ? 12 : 7);
        if (this.stains) this.splats.push(u);
        this.snd('pop', { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7, big: u.type === 'giant' || u.type === 'knight' });
        if (u.type === 'dragon') { this.shake(20); this.snd('boom', { gain: 0.6 }); this.banner(`${TEAMS[u.team].name} DRAGON SLAIN`, TEAMS[1 - u.team].c); }
        if (u.type === 'tank') { this.shake(20); this.booms.push({ x: u.x, y: u.y, r: 70, t: 0 }); this.snd('boom', { gain: 0.6 }); this.banner(`${TEAMS[u.team].name} TANK DESTROYED`, TEAMS[1 - u.team].c); }
        if (u.type === 'giant') { this.shake(20); this.snd('boom', { gain: 0.6 }); this.banner(`${TEAMS[u.team].name} GIANT FALLS`, TEAMS[1 - u.team].c); }
        if (u.type === 'mech') { this.shake(20); this.booms.push({ x: u.x, y: u.y, r: 70, t: 0 }); this.snd('boom', { gain: 0.6 }); this.banner(`${TEAMS[u.team].name} MECH DOWN`, TEAMS[1 - u.team].c); }
        if (u.type === 'cannon') { this.shake(14); this.booms.push({ x: u.x, y: u.y, r: 60, t: 0 }); this.snd('boom', { gain: 0.5 }); this.banner(`${TEAMS[u.team].name} CANNON DESTROYED`, TEAMS[1 - u.team].c); }
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
          if (U.healer) {
            // keep a safe distance behind the fighting, following the army
            if (d < U.range * 0.85) { dvx = -nx * spd * 0.7; dvy = -ny * spd * 0.7; }
            else if (d > U.range * 1.5) { this.navDir(u, t, nx, ny); dvx = this.ndx * spd * 0.8; dvy = this.ndy * spd * 0.8; }
            if (u.cd <= 0) {
              let best = null, worst = 0.999;
              for (const o of this.units) {
                if (o.dead || o.team !== u.team || o === u) continue;
                const fr = o.hp / o.max;
                if (fr < worst && (o.x - u.x) ** 2 + (o.y - u.y) ** 2 < U.healRange * U.healRange) { worst = fr; best = o; }
              }
              if (best) {
                best.hp = Math.min(best.max, best.hp + U.heal); best.healFlash = 1; u.healFx = 1; u.healTo = best;
                u.cd = U.cd * R.range(0.9, 1.1);
                this.burst(best.x, best.y, '#7CFFB0', 5, 120, 0.5, 5, -60);
                this.snd('heal', { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7 });
              } else u.cd = 0.3;
            }
          } else if (U.ranged) {
            const tactical = this.obstacles.length && !u.flying && U.rank !== 0;
            if (d > U.range) { if (tactical) { u.cover = null; this.navDir(u, t, nx, ny); dvx = this.ndx * spd; dvy = this.ndy * spd; } else { dvx = nx * spd; dvy = ny * spd; } }
            else if (d < U.range * 0.45 && this.pushStage < 2) { dvx = -nx * spd * 0.6; dvy = -ny * spd * 0.6; }
            else if (tactical) {
              // in range: take cover nearby if there is any, then hold there and shoot
              if (u.coverFor !== t || this.fightT >= (u.coverAt || 0)) { u.cover = this.findCover(u, t, U); u.coverFor = t; u.coverAt = this.fightT + 1.5; }
              if (u.cover) { const cx = u.cover[0] - u.x, cy = u.cover[1] - u.y, cl = Math.hypot(cx, cy); if (cl > 5) { const k = spd * Math.min(1, cl / 30) / cl; dvx = cx * k; dvy = cy * k; } }
            }
            // no clear shot (grenades, shells and fireballs fly over walls, so they never need one): go around and find an angle
            // (checked a few times a second, and the troop keeps moving between checks)
            if (!U.lob && d <= U.range && this.obstacles.length) {
              if (u.cd <= 0 || this.fightT >= (u.losAt || 0)) { u.noShot = !this.clearShot(u.x, u.y, t.x, t.y); u.losAt = this.fightT + 0.15; }
            } else if (u.noShot) u.noShot = false;
            const blocked = u.noShot;
            if (blocked) { u.cover = null; u.coverAt = this.fightT + 1; this.navDir(u, t, nx, ny); dvx = this.ndx * spd; dvy = this.ndy * spd; if (u.cd <= 0) u.cd = 0.15; }
            if (!blocked && d <= U.range && u.cd <= 0) {
              u.cd = U.cd * R.range(0.85, 1.15);
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
                const shotDmg = U.dmg + (u.bank || 0); u.bank = 0;
                // machine guns show a tracer on every third round, like real tracer ammo, so bursts stay readable
                u.shots = (u.shots || 0) + 1;
                const tracer = u.type !== 'gunner' || u.shots % 3 === 0;
                this.arrows.push({ tracer, team: u.team, x: u.x + (ax / al) * (u.r + 4), y: u.y + (ay / al) * (u.r + 4), vx: (ax / al) * v, vy: (ay / al) * v, life: (U.range / v) * 1.35, dmg: shotDmg, bolt: !!U.bolt, kind: U.laser ? 'laser' : U.bullet ? (U.pierce ? 'sniper' : 'bullet') : undefined, pierce: U.pierce || 0, from: u });
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
              u.cd = U.cd * R.range(0.85, 1.15);
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
                this.damage(t, U.dmg * this.dmgMul * (UNIT[t.type].block || 1), u);
                this.snd(UNIT[t.type].block ? 'thunk' : 'clash', { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7 });
                if (u.type === 'ninja' || u.type === 'pirate') this.snd('swish', { pan: (u.x - AR.x) / AR.w * 1.4 - 0.7 });
              }
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
        if (this.drop && !U.healer) {
          const dr = this.drop, cx = dr.x - u.x, cy = dr.y - u.y, cd = Math.hypot(cx, cy) || 1;
          if (cd < 320 && (!t || cd + 60 < Math.hypot(t.x - u.x, t.y - u.y))) {
            const sp = U.speed * this.speedMul * (u.pace || 1);
            this.navDir(u, dr, cx / cd, cy / cd); dvx = this.ndx * sp; dvy = this.ndy * sp;
          }
        }
        if (this.obstacles.length && !u.flying && (dvx || dvy)) { this.steer(u, dvx, dvy); dvx = this.stx; dvy = this.sty; }
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
            if (u.flying !== o.flying) continue; // a dragon flies over the troops below it
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
      if (this.arrows.length) {
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
              for (const o of b) if (!o.dead && o.team !== a.team && o !== a.skip && (o.x - a.x) ** 2 + (o.y - a.y) ** 2 < (o.r + 3) ** 2) { hitU = o; break; }
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
            this.damage(hitU, (a.dmg || UNIT.archer.dmg) * Math.max(arm, floor) * this.dmgMul, a.from);
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
          this.gained = this.gained || [0, 0]; this.gained[z.team]++;
          this.burst(z.x, z.y, '#8FD16A', 8, 160, 0.5, 6, -40);
          this.snd('groan', { pan: (z.x - AR.x) / AR.w * 1.4 - 0.7 });
        }
        this.rising = this.rising.filter(z => z.t > 0);
      }
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
      if (arrived) { this.banner('REINFORCEMENTS!', COL.gold); this.snd('alarm'); if (this.camEv) this.camEv.push({ type: 'reinforce' }); }
      if (this.events) for (const ev of this.events) if (!ev.done) this['ev_' + ev.type](ev, h);
      if (this.pushStage < this.pushAt.length && this.fightT >= this.pushAt[this.pushStage]) {
        this.dmgMul = this.pushMul[this.pushStage];
        this.speedMul = this.pushSpeed[this.pushStage];
        this.pushStage++;
        for (const u of this.units) u.retarget = 0;
        this.banner(['FINAL PUSH', 'ALL-OUT ATTACK', 'LAST STAND'][this.pushStage - 1] + ` · DMG ×${this.dmgMul}`, COL.gold, 2.2);
        if (this.camEv) this.camEv.push({ type: 'push', stage: this.pushStage });
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
    // director mode: remember where everything was before a tick, so slow-motion frames can draw in between ticks
    prestep() {
      for (const u of this.units) { u.px = u.x; u.py = u.y; }
      for (const a of this.arrows) { a.px = a.x; a.py = a.y; }
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
        const b = clamp(c.bars, 0, 1), h = 74 * (b * b * (3 - 2 * b));
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
          for (let tm = 0; tm < 2; tm++) {
            const left = this.alive[tm] + this.reserve[tm], lost = Math.max(0, this.start[tm] + (this.gained ? this.gained[tm] : 0) - left);
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
      for (const u of this.units) { u.flash = Math.max(0, u.flash - dt * 6); u.lunge = Math.max(0, u.lunge - dt * 6); if (u.swing) u.swing = Math.max(0, u.swing - dt * 2.6); if (u.healFx) u.healFx = Math.max(0, u.healFx - dt * 2.5); if (u.healFlash) u.healFlash = Math.max(0, u.healFlash - dt * 3); if (u.muzzle) u.muzzle = Math.max(0, u.muzzle - dt * 12); if (u.dodgeFx) u.dodgeFx = Math.max(0, u.dodgeFx - dt * 4); }
      if (this.booms && this.booms.length) this.booms = this.booms.filter(b => (b.t += dt) < 0.45);
      if (this.drop && this.FX.chance(dt * 9)) { const F = this.FX; this.parts.push({ x: this.drop.x + F.range(-5, 5), y: this.drop.y - 10, vx: F.range(-10, 10), vy: F.range(-60, -40), life: F.range(0.9, 1.4), age: 0, size: F.range(7, 11), color: '#F2C14E', grav: 0, smoke: true }); }
      for (const a of this.arrows) if (a.kind === 'rocket' && this.FX.chance(dt * 30)) this.parts.push({ x: a.x, y: a.y, vx: 0, vy: 0, life: 0.5, age: 0, size: 5, color: '#9AA0AA', grav: 0, smoke: true });
      if (this.liveDecor) for (const d of this.decor) if (d.kind === 'fire' && this.FX.chance(dt * 7)) {
        const F = this.FX;
        this.parts.push({ x: d.x + F.range(-8, 8), y: d.y - 18, vx: F.range(-12, 12), vy: F.range(-70, -45), life: F.range(1.1, 1.7), age: 0, size: F.range(9, 15), color: '#4A4E58', grav: 0, smoke: true });
      }
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
      this.drawHUD(ctx, {
        title: this.title, hook: this.hook,
        lv: String(this.alive[0] + this.reserve[0]), rv: String(this.alive[1] + this.reserve[1]),
        ls: `${this.doc[0].name} · ${this.start[0]} UNITS`, rs: `${this.start[1]} UNITS · ${this.doc[1].name}`,
        ratio: this.dispRatio,
      });
      const zoom = this.camOn(), hi = zoom && this.cam.z > 1.12 && !!api.makeCanvas;
      // director mode: draw in between simulation ticks, so slow motion stays smooth
      const al = this.fixedTicks && this.phase === 'fight' ? clamp(this.tickAcc, 0, 1) : 1, between = al < 0.999;
      if (between) {
        for (const u of this.units) if (u.px !== undefined) { u._x = u.x; u._y = u.y; u.x = u.px + (u.x - u.px) * al; u.y = u.py + (u.y - u.py) * al; }
        for (const a of this.arrows) if (a.px !== undefined) { a._x = a.x; a._y = a.y; a.x = a.px + (a.x - a.px) * al; a.y = a.py + (a.y - a.py) * al; }
      }
      ctx.save();
      ctx.translate(this.shakeX, this.shakeY);
      roundRect(ctx, AR.x, AR.y, AR.w, AR.h, 18);
      ctx.save(); ctx.clip();
      if (zoom) { ctx.save(); this.applyCam(ctx); }
      if (this.ground) ctx.drawImage(hi ? this.hiLayer('ground') : this.ground, AR.x, AR.y, AR.w, AR.h);
      else { ctx.fillStyle = (MAP_THEME[this.opts.map] || MAP_THEME.default).floor; ctx.fillRect(AR.x, AR.y, AR.w, AR.h); }
      if (this.stains) ctx.drawImage(this.stains, AR.x, AR.y, AR.w, AR.h);
      if ((this.obstacles.length || this.decor.length) && api.makeCanvas) {
        if (!this.mapLayer) { this.mapLayer = api.makeCanvas(AR.w, AR.h); this.paintMap(this.mapLayer, 1); }
        ctx.drawImage(hi ? this.hiLayer('map') : this.mapLayer, AR.x, AR.y, AR.w, AR.h);
      }
      if (this.liveDecor) this.drawLiveDecor(ctx);
      // arrows
      ctx.lineCap = 'round';
      const tracers = [], snipes = [], lasers = [[], []];
      for (const a of this.arrows) {
        const l = Math.hypot(a.vx, a.vy) || 1, ux = a.vx / l, uy = a.vy / l;
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
        if (a.kind === 'laser') { lasers[a.team].push(a.x, a.y, ux, uy); continue; }
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
      for (let tm = 0; tm < 2; tm++) {
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
      // units by type for fewer state changes
      const cheer = this.phase === 'outro' ? this.winner : -1;
      const drawOrder = this.units.some(u => u.flying) ? this.units.filter(u => !u.flying).concat(this.units.filter(u => u.flying)) : this.units;
      for (const u of drawOrder) {
        const tm = TEAMS[u.team];
        if (u.fade !== undefined) { if (u.fade <= 0) continue; ctx.globalAlpha = u.fade; }
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
        const x = u.x + lx, y = u.y + ly + hop;
        if (u.type === 'dragon') {
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
          // boxy robot from above: armoured square body, a glowing visor, an antenna, and fists that punch
          const r = u.r;
          ctx.save(); ctx.translate(x, y); ctx.rotate(u.face);
          ctx.lineJoin = 'round';
          const punch = (u.lunge || 0) * 9;
          for (const sd of [-1, 1]) { roundRect(ctx, r * 0.45 + (sd > 0 ? punch : 0), sd * r * 0.62 - r * 0.24, r * 0.5, r * 0.48, 3); ctx.fillStyle = '#5B6472'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = COL.ink; ctx.stroke(); }
          roundRect(ctx, -r * 0.85, -r * 0.85, r * 1.7, r * 1.7, 5); ctx.fillStyle = tm.d; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = COL.ink; ctx.stroke();
          roundRect(ctx, -r * 0.5, -r * 0.5, r * 1.0, r * 1.0, 3); ctx.fillStyle = tm.c; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
          ctx.lineCap = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(r * 0.68, -r * 0.42); ctx.lineTo(r * 0.68, r * 0.42); ctx.stroke();
          ctx.lineWidth = 3; ctx.strokeStyle = '#7CF3FF'; ctx.stroke();
          ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(-r * 0.3, 0); ctx.lineTo(-r * 0.95, -r * 0.3); ctx.stroke();
          ctx.beginPath(); ctx.arc(-r * 0.95, -r * 0.3, 3, 0, TAU); ctx.fillStyle = '#FF5A5A'; ctx.fill(); ctx.stroke();
          ctx.restore();
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
            const reach = u.r + 26 + (u.lunge || 0) * 12;
            const bx0 = x - fx * (u.r * 0.6), by0 = y - fy * (u.r * 0.6), tx = x + fx * reach, ty = y + fy * reach;
            ctx.lineCap = 'round';
            ctx.lineWidth = 6; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(tx, ty); ctx.stroke();
            ctx.lineWidth = 3; ctx.strokeStyle = COL.wood; ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(tx, ty); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(tx + fx * 11, ty + fy * 11); ctx.lineTo(tx + px * 5, ty + py * 5); ctx.lineTo(tx - px * 5, ty - py * 5); ctx.closePath();
            ctx.fillStyle = COL.steel; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke();
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
        if (u.healFlash > 0) { ctx.beginPath(); ctx.arc(x, y, u.r + 2, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(124,255,176,${u.healFlash * 0.9})`; ctx.stroke(); }
        if (u.flash > 0) { ctx.beginPath(); ctx.arc(x, y, u.r, 0, TAU); ctx.fillStyle = `rgba(255,255,255,${u.flash * 0.8})`; ctx.fill(); }
        if (HPBAR[u.type] && u.hp < u.max) {
          const w = u.r * 2;
          ctx.fillStyle = COL.ink; ctx.fillRect(x - w / 2 - 2, y - u.r - 13, w + 4, 8);
          ctx.fillStyle = tm.l; ctx.fillRect(x - w / 2, y - u.r - 11, w * clamp(u.hp / u.max, 0, 1), 4);
        }
        ctx.globalAlpha = 1;
      }
      if (this.events) this.drawEvents(ctx);
      if (this.tag && this.tag.u && !this.tag.u.dead && this.tag.a > 0.01) {
        // the director's hero tag: a team-coloured marker and a kill count above one troop
        const u = this.tag.u, tx = u.x, ty = u.y - u.r - 20 - 4 * Math.sin(this.t * 6);
        ctx.globalAlpha = this.tag.a;
        ctx.beginPath(); ctx.moveTo(tx - 9, ty - 8); ctx.lineTo(tx + 9, ty - 8); ctx.lineTo(tx, ty + 4); ctx.closePath();
        ctx.fillStyle = TEAMS[u.team].c; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = COL.ink; ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font(26, 800);
        strokeText(ctx, this.tag.text, tx, ty - 26, COL.gold, COL.ink, 6);
        ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
      }
      if (zoom) ctx.restore();
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
    }
    get debt() { return this.t - this.g.t; }
    // the busiest fighting: the 160 px cell where both teams are most mixed, averaged with its neighbours
    hotspot() {
      const g = this.g, N = 6, cs = AR.w / N, c = [new Float32Array(N * N), new Float32Array(N * N)];
      for (const u of g.units) { const i = clamp((u.x - AR.x) / cs | 0, 0, N - 1), j = clamp((u.y - AR.y) / cs | 0, 0, N - 1); c[u.team][j * N + i]++; }
      let best = -1, bk = 0;
      for (let k = 0; k < N * N; k++) { const sc = Math.min(c[0][k], c[1][k]) * 2 + (c[0][k] + c[1][k]) * 0.15; if (sc > best) { best = sc; bk = k; } }
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
        if (!sh || sh.kind !== 'outro') this.start('outro', { prio: 100, dur: 99, z: 1.14, spd: 1.2, zspd: 0.8, team: g.winner });
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
      const tot = [g.alive[0] + g.reserve[0], g.alive[1] + g.reserve[1]];
      for (let tm = 0; tm < 2; tm++) {
        if (tot[tm] !== 1 || tot[1 - tm] < 2 || (sh && sh.kind === 'last')) continue;
        const u = g.units.find(v => v.team === tm && !v.dead);
        if (u && g.cap - g.fightT > 1.5) want(90, () => this.start('last', { prio: 90, dur: 6, follow: u, z: 2.05, ts: this.debt < 3 ? 0.35 : 0.7, slowFor: 2, bars: 1, vig: 0.45, spd: 5, zspd: 4, sfx: 'whoosh' }));
      }
      // battle events: follow the supply crate down, punch in when it's grabbed, slow motion as the airstrike lands, pull back for meteors
      for (const e of ev) {
        if (e.type === 'airdrop') want(55, () => this.start('airdrop', { prio: 55, dur: e.ev.release + e.ev.T + 0.9, drop: e.ev, z: 1.55, spd: 2.5, zspd: 2 }));
        if (e.type === 'grab') want(56, () => this.start('grab', { prio: 56, dur: 1.6, x: e.x, y: e.y, z: 1.9, spd: 6, zspd: 6 }));
        if (e.type === 'airstrike') want(75, () => this.start('airstrike', { prio: 75, dur: 3.2, x: e.ev.cx, y: e.ev.cy, z: 1.45, spd: 3, zspd: 2.5, ts: this.canSlow(0.6) ? 0.4 : 1, slowFrom: 1.5, slowFor: 2.4, bars: 1, vig: 0.3, sfx: 'whoosh' }));
        if (e.type === 'meteors') want(45, () => this.start('meteors', { prio: 45, dur: 4.6, x: this.cx, y: this.cy, z: 1.06, spd: 2, zspd: 2, vig: 0.25 }));
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
          const c = this.centroid(sh.team); tx = c.x; ty = c.y; tz = sh.z; spd = sh.spd; zspd = sh.zspd; tsRate = 30;
        } else {
          const f = sh.follow && !sh.follow.dead ? sh.follow : null;
          if (f) { tx = f.x; ty = f.y; } else if (sh.drop) { tx = sh.drop.x; ty = sh.drop.y - (sh.drop.landed ? 0 : 70); } else if (sh.track && age > 0.2) { const h = this.hotspot(); sh.x += (h.x - sh.x) * Math.min(1, dt * 0.8); sh.y += (h.y - sh.y) * Math.min(1, dt * 0.8); tx = sh.x; ty = sh.y; } else { tx = sh.x; ty = sh.y; }
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
      }
      if (g.phase !== 'fight') tts = 1;
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

  const GAMES = { territory: Territory, duel: Duel, army: Army };
  Object.assign(api, { rng, Match, Territory, Duel, Army, Director, Synth, GAMES, WEAPONS, DOCTRINES, MODERN_DOCTRINES, FANTASY_DOCTRINES, GENRES, UNIT_ERA, ALL_DOCTRINES, MAPS, MAP_THEME, UNIT, eraOf, fmtTime });
  return api;
})();
if (typeof module !== 'undefined') module.exports = RVB;
