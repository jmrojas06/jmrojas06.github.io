/* Escenas pintadas con el motor de óleo: formas sueltas (con transparencia), emblemas, reglas,
   un campo de planos de tierra y la banda del CV. Todo es código. */
(function (g) {
  'use strict';
  var C = OilUtil.hex;
  var P = {
    bone: C('#E3DECF'),
    red: ['#C9381D', '#B22C17', '#D9502E', '#9C2414', '#E0643F'].map(C),
    ink: ['#14110E', '#1B1713', '#100E0B'].map(C),
    blue: ['#26409C', '#1B2F7E', '#3552B8', '#142463', '#17324F', '#112841'].map(C),
    ochre: ['#D19A27', '#C28A1B', '#E0B04A', '#B07A12', '#E9C468'].map(C),
    steel: ['#CBD2D8', '#B9C2CA', '#DDE2E6', '#A5B0BA', '#EEF1F3'].map(C),
    slate: ['#3D4C60', '#303E50', '#4B5C73', '#26323F'].map(C),
    hi: ['#F5F2E9', '#ECE8DB', '#FBF9F3', '#E3DFD0'].map(C)
  };
  var BASE = { red: C('#C9381D'), ink: C('#14110E'), blue: C('#1E3A66'), ochre: C('#D19A27'), steel: C('#C6CED5'), slate: C('#36465A'), hi: C('#F1EEE3') };
  var OPT = {
    red: { len: 320, width: 54, cover: 2.6, jitter: 0.22, bend: 26, pickup: 0.035 },
    ink: { len: 560, width: 40, cover: 2.2, jitter: 0.05, bend: 5, pickup: 0.02, var: 0.025, thick: 0.9 },
    blue: { len: 260, width: 40, cover: 2.4, jitter: 0.07, bend: 8, pickup: 0.035 },
    ochre: { len: 130, width: 30, cover: 2.6, jitter: 0.3, bend: 10, pickup: 0.035 },
    steel: { len: 220, width: 30, cover: 2.8, jitter: 0.2, bend: 10, pickup: 0.035, thick: 1.25 },
    slate: { len: 260, width: 26, cover: 2.6, jitter: 0.08, bend: 6, pickup: 0.03, thick: 1.1 },
    hi: { len: 160, width: 18, cover: 2.8, jitter: 0.15, bend: 8, pickup: 0.03, thick: 1.4 }
  };
  /* versión nocturna para el panel oscuro: tonos de tierra profundos */
  var NIGHT = {
    ground: C('#1A120D'),
    sets: {
      siena: ['#6B2C16', '#7A3518', '#5A2412', '#8A4120'].map(C),
      red: ['#7F1A12', '#962016', '#6A150F'].map(C),
      prussian: ['#112841', '#17324F', '#0C1D31'].map(C),
      umber: ['#3A2619', '#4A3322', '#2B1C12'].map(C),
      ochre: ['#8A6414', '#A27418', '#7A5610'].map(C),
      ink: ['#14100C', '#1B1510', '#0E0B08'].map(C)
    }
  };

  function paint(O, mask, bb, colors, base, o0, angle) {
    var w = bb[2] - bb[0], h = bb[3] - bb[1], o = {}, k;
    for (k in o0) o[k] = o0[k];
    o.len = Math.max(30, Math.min(o.len, Math.max(w, h) * 1.1));
    o.width = Math.max(6, Math.min(o.width, Math.min(w, h) * 0.3));
    o.colors = colors; o.angle = angle; o.load = 0.96; o.alpha = 0.95; o.thick = o.thick || 1.0;
    O.flat(mask, base, 0.5);
    O.fill(mask, bb, o);
  }
  function pk(O, mask, bb, key, angle) { paint(O, mask, bb, P[key], BASE[key], OPT[key], angle); }
  function circ(O, cx, cy, r, key) {
    pk(O, O.circleMask(cx, cy, r, Math.max(1, r * 0.01 + 0.6)), [cx - r, cy - r, cx + r, cy + r], key, -0.12);
  }
  function rect(O, x, y, w, h, key) {
    var m = O.polyMask([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], Math.max(0.8, Math.min(w, h) * 0.008 + 0.7));
    pk(O, m, [x, y, x + w, y + h], key, w >= h ? -0.01 : 1.5708);
  }
  function poly(O, pts, key, angle) {
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var bb = [Math.min.apply(0, xs), Math.min.apply(0, ys), Math.max.apply(0, xs), Math.max.apply(0, ys)];
    pk(O, O.polyMask(pts, Math.max(0.8, (bb[2] - bb[0]) * 0.006 + 0.6)), bb, key, angle);
  }
  function hole(O, cx, cy, r) { O.flat(O.circleMask(cx, cy, r, Math.max(0.8, r * 0.008)), P.bone, 0, true); }

  function size(cv, cap) {
    var r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!r.width || !r.height) return null;
    var W = Math.round(Math.min(r.width * dpr, cap || 1600)), H = Math.max(8, Math.round(W * r.height / r.width));
    return { W: W, H: H, cw: r.width, ch: r.height };
  }
  var num = function (cv, a, d) { var v = parseInt(cv.getAttribute(a), 10); return isNaN(v) ? d : v; };

  /* forma suelta: círculo o rectángulo que llena su lienzo, con fondo transparente */
  function shape(cv) {
    var s = size(cv, num(cv, 'data-cap', 900)); if (!s) return;
    var kind = cv.getAttribute('data-shape') || 'circle', key = cv.getAttribute('data-key') || 'red';
    var O = new Oil(s.W, s.H, 7 + num(cv, 'data-seed', 1) * 13), m = Math.max(3, Math.min(s.W, s.H) * 0.014);
    O.ground(P.bone, 0);
    if (kind === 'circle') circ(O, s.W / 2, s.H / 2, Math.min(s.W, s.H) / 2 - m, key);
    else rect(O, m, m, s.W - 2 * m, s.H - 2 * m, key);
    O.render(cv, { relief: 5, spec: 0.28, vignette: 0, alpha: true });
  }

  /* banda horizontal: cabecera del CV */
  function band(cv) {
    var s = size(cv, 1560); if (!s) return;
    var W = s.W, H = s.H, O = new Oil(W, H, 29);
    O.ground(P.bone, 0);
    circ(O, 0.80 * W, 0.45 * H, 0.4 * H, 'red');
    rect(O, 0.52 * W, 0.86 * H, 0.48 * W + 10, 0.14 * H + 6, 'ink');
    rect(O, 0.665 * W, 0.34 * H, 0.05 * W, 0.52 * H, 'blue');
    circ(O, 0.64 * W, 0.2 * H, 0.09 * H, 'ochre');
    O.render(cv, { relief: 5, spec: 0.28, vignette: 0 });
  }

  /* regla pintada: la barra negra que abre cada sección y la cinta */
  function rule(cv) {
    var s = size(cv, 1600); if (!s) return;
    var O = new Oil(s.W, s.H, 3 + num(cv, 'data-seed', 0));
    O.ground(P.bone, 0);
    var m = O.polyMask([[0, s.H * 0.14], [s.W + 8, s.H * 0.1], [s.W + 8, s.H * 0.9], [0, s.H * 0.86]], 1.5);
    pk(O, m, [0, 0, s.W, s.H], 'ink', -0.005);
    O.render(cv, { relief: 5, spec: 0.28, vignette: 0, alpha: true });
  }

  /* campo oscuro de planos de tierra y espátula (póster C), estirado al tamaño del panel */
  function shards(cv) {
    var s = size(cv, 900); if (!s) return;
    var W = s.W, H = s.H, O = new Oil(W, H, 37), sx = W / 840, sy = H / 1176, N = NIGHT.sets;
    O.ground(NIGHT.ground, 0.1);
    var S = [
      { p: [[0, 0], [528, 0], [318, 628], [0, 488]], c: N.siena },
      { p: [[552, 0], [840, 0], [840, 538], [624, 458]], c: N.ochre },
      { p: [[546, 16], [608, 450], [344, 634]], c: N.red },
      { p: [[0, 510], [316, 654], [288, 902], [0, 1176]], c: N.prussian },
      { p: [[342, 660], [614, 480], [690, 790], [304, 898]], c: N.umber },
      { p: [[636, 476], [840, 556], [840, 1176], [706, 1176], [704, 812]], c: N.red },
      { p: [[298, 922], [686, 818], [690, 1176], [150, 1176]], c: N.siena }
    ];
    var knife = { cover: 2.2, thick: 1.0, jitter: 0.06, bend: 6, knife: true, pickup: 0.04, var: 0.05 };
    S.forEach(function (sh) {
      var pts = sh.p.map(function (q) { return [q[0] * sx, q[1] * sy]; }), a = 0, L = 0, k;
      for (k = 0; k < pts.length; k++) { var q = pts[k], n = pts[(k + 1) % pts.length], d = Math.hypot(n[0] - q[0], n[1] - q[1]); if (d > L) { L = d; a = Math.atan2(n[1] - q[1], n[0] - q[0]); } }
      var xs = pts.map(function (q) { return q[0]; }), ys = pts.map(function (q) { return q[1]; });
      var bb = [Math.min.apply(0, xs), Math.min.apply(0, ys), Math.max.apply(0, xs), Math.max.apply(0, ys)];
      var o = { len: 380 * sx, width: 56 * sx, cover: knife.cover, thick: 1, jitter: 0.06, bend: 6, knife: true, pickup: 0.04, var: 0.05 };
      paint(O, O.polyMask(pts, 2.6), bb, sh.c, sh.c[0], o, a);
    });
    var sc = C('#8A7F6C');
    [[70, 120, 430, 60, 3.2], [60, 190, 470, 150, 3.6], [40, 400, 290, 540, 3.4], [590, 70, 790, 300, 3.0], [380, 700, 630, 650, 2.4], [748, 650, 800, 950, 3.0]].forEach(function (l, i) {
      O.scratch(l[0] * sx, l[1] * sy, l[2] * sx, l[3] * sy, 2.2 + (i % 3) * 0.5, 0.5, i % 2 ? null : sc, l[4]);
    });
    O.render(cv, { relief: 6, spec: 0.3, vignette: 0.2 });
  }

  /* emblemas: geometría suiza en miniatura (coordenadas 0..1), con fondo transparente */
  var K = {
    contract: [['r', 0.16, 0.1, 0.58, 0.8, 'blue'], ['r', 0.16, 0.1, 0.58, 0.1, 'ink'], ['c', 0.74, 0.74, 0.14, 'ochre']],
    target: [['c', 0.5, 0.5, 0.42, 'ink'], ['h', 0.5, 0.5, 0.27], ['c', 0.5, 0.5, 0.15, 'red']],
    duo: [['c', 0.38, 0.42, 0.29, 'red'], ['r', 0.42, 0.46, 0.5, 0.44, 'blue']],
    quarter: [['p', [[0.12, 0.88], [0.12, 0.12], [0.2, 0.125], [0.3, 0.145], [0.4, 0.18], [0.5, 0.23], [0.6, 0.3], [0.7, 0.4], [0.78, 0.5], [0.84, 0.62], [0.88, 0.76], [0.88, 0.88]], 'blue']],
    lanes: [['r', 0.14, 0.12, 0.2, 0.76, 'blue'], ['r', 0.4, 0.12, 0.2, 0.76, 'ochre'], ['r', 0.66, 0.12, 0.2, 0.76, 'red']],
    blocked: [['c', 0.5, 0.5, 0.38, 'red'], ['r', 0.03, 0.43, 0.94, 0.14, 'ink']],
    triangle: [['p', [[0.5, 0.1], [0.9, 0.78], [0.1, 0.78]], 'ochre'], ['r', 0.1, 0.84, 0.8, 0.08, 'ink']],
    stairs: [['r', 0.1, 0.62, 0.22, 0.28, 'ink'], ['r', 0.39, 0.4, 0.22, 0.5, 'blue'], ['r', 0.68, 0.16, 0.22, 0.74, 'red']],
    verified: [['c', 0.4, 0.5, 0.3, 'ochre'], ['r', 0.68, 0.6, 0.22, 0.22, 'ink']],
    frames: [['r', 0.08, 0.28, 0.26, 0.44, 'ink'], ['r', 0.37, 0.28, 0.26, 0.44, 'red'], ['r', 0.66, 0.28, 0.26, 0.44, 'ink']],
    layers: [['r', 0.1, 0.14, 0.34, 0.2, 'ochre'], ['r', 0.1, 0.4, 0.6, 0.2, 'blue'], ['r', 0.1, 0.66, 0.8, 0.2, 'ink']],
    diag: [['p', [[0.08, 0.9], [0.5, 0.1], [0.74, 0.1], [0.32, 0.9]], 'blue'], ['c', 0.78, 0.72, 0.15, 'red']],
    escalate: [['c', 0.2, 0.5, 0.1, 'red'], ['c', 0.45, 0.5, 0.15, 'red'], ['c', 0.76, 0.5, 0.21, 'ochre']]
  };
  function emblem(cv) {
    var kind = cv.getAttribute('data-kind'), def = K[kind]; if (!def) return;
    var s = size(cv, 260); if (!s) return;
    var S = s.W, Hh = s.H, O = new Oil(S, Hh, 5 + num(cv, 'data-seed', 1) * 7);
    O.ground(P.bone, 0);
    def.forEach(function (d) {
      var t = d[0];
      if (t === 'c') circ(O, d[1] * S, d[2] * Hh, d[3] * S, d[4]);
      else if (t === 'h') hole(O, d[1] * S, d[2] * Hh, d[3] * S);
      else if (t === 'r') rect(O, d[1] * S, d[2] * Hh, d[3] * S, d[4] * Hh, d[5]);
      else if (t === 'p') poly(O, d[1].map(function (p) { return [p[0] * S, p[1] * Hh]; }), d[2], -0.5);
    });
    O.render(cv, { relief: 5, spec: 0.28, vignette: 0, alpha: true });
  }


  /* llanta todoterreno con rin cromado, todo pintado al óleo con el mismo empaste del póster:
     tacos escalonados, letras en relieve, y un rin de acero con franja de reflejo, brillo y ocho cavidades */
  function arcText(ctx, txt, cx, cy, r, mid, px, top) {
    ctx.font = '800 ' + px + 'px Archivo, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var sp = px * 0.1, ws = [], total = 0, i;
    for (i = 0; i < txt.length; i++) { var w = ctx.measureText(txt.charAt(i)).width + sp; ws.push(w); total += w; }
    var a = top ? mid - total / r / 2 : mid + total / r / 2;
    for (i = 0; i < txt.length; i++) {
      var st = ws[i] / r, c = top ? a + st / 2 : a - st / 2;
      ctx.save();
      ctx.translate(cx + Math.cos(c) * r, cy + Math.sin(c) * r);
      ctx.rotate(top ? c + Math.PI / 2 : c - Math.PI / 2);
      ctx.fillText(txt.charAt(i), 0, 0);
      ctx.restore();
      a = top ? a + st : a - st;
    }
  }
  function wheel(cv) {
    var s = size(cv, num(cv, 'data-cap', 640)); if (!s) return;
    var W = s.W, H = s.H, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 3, TAU = Math.PI * 2, i, k;
    var top = (cv.getAttribute('data-top') || '').toUpperCase(), bottom = (cv.getAttribute('data-bottom') || '').toUpperCase();
    var O = new Oil(W, H, 71);
    O.ground(P.bone, 0);
    var pol = function (r, a) { return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
    var circle = function (r, n) { var o = []; for (var j = 0; j < n; j++) o.push(pol(r, j / n * TAU)); return O.rough(o, R * 0.004, R * 0.05); };
    var trace = function (ctx, pts) { ctx.beginPath(); pts.forEach(function (p, j) { j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.closePath(); };
    var full = [0, 0, W, H], INK = C('#14110E'), BONE = C('#E9E3D3');
    var discMask = function (r) { var pts = circle(r, 80); return O.maskFrom(function (ctx) { trace(ctx, pts); ctx.fill(); }); };
    var ringMask = function (ro, ri) {
      var a = circle(ro, 84), b = circle(ri, 76).reverse();
      return O.maskFrom(function (ctx) { ctx.beginPath(); a.forEach(function (p, j) { j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.closePath(); b.forEach(function (p, j) { j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill(); });
    };

    /* llanta: disco y 32 tacos escalonados */
    var disc = circle(R * 0.9, 90), blocks = [], N = 32;
    for (i = 0; i < N; i++) {
      var a0 = i / N * TAU, aw = TAU / N * 0.7, ro = R * (i % 2 ? 0.95 : 1), ri = R * 0.855;
      blocks.push(O.rough([pol(ri, a0 - 0.006), pol(ro, a0 - 0.012), pol(ro, a0 + aw + 0.012), pol(ri, a0 + aw + 0.006)], R * 0.004, R * 0.05));
    }
    var tire = O.maskFrom(function (ctx) { trace(ctx, disc); ctx.fill(); blocks.forEach(function (b) { trace(ctx, b); ctx.fill(); }); });
    pk(O, tire, full, 'ink', -0.05);

    /* letras del costado, en relieve */
    var fit = function (txt, cap) { return Math.min(R * cap, R * 1.55 / Math.max(1, txt.length) / 0.78); };
    var lm = O.maskFrom(function (ctx) {
      if (top) arcText(ctx, top, cx, cy, R * 0.775, -Math.PI / 2, fit(top, 0.14), true);
      if (bottom) arcText(ctx, bottom, cx, cy, R * 0.775, Math.PI / 2, fit(bottom, 0.1), false);
    });
    O.flat(lm, BONE, 0.9);
    O.raise(lm, 0.6, 1);

    /* rin cromado, pintado: acero claro, franja oscura de reflejo y media luna blanca de brillo */
    var RL = R * 0.625, RD = R * 0.552;
    pk(O, discMask(RL), full, 'steel', 0.3);
    pk(O, ringMask(RL, RD), full, 'hi', 0.2);
    var band = O.maskFrom(function (ctx) {
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, RL - 2, 0, TAU); ctx.clip();
      ctx.translate(cx, cy); ctx.rotate(-0.14); ctx.fillRect(-R, R * 0.05, R * 2, R * 0.17); ctx.restore();
    });
    pk(O, band, full, 'slate', -0.14);
    var glint = O.maskFrom(function (ctx) {
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, RD - 3, 0, TAU); ctx.clip();
      ctx.beginPath(); ctx.arc(cx - R * 0.07, cy - R * 0.09, R * 0.55, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(cx + R * 0.04, cy + R * 0.05, R * 0.55, 0, TAU); ctx.fill(); ctx.restore();
    });
    pk(O, glint, full, 'hi', 0.7);
    O.flat(ringMask(RD + R * 0.008, RD - R * 0.008), INK, 0.4);

    /* ocho cavidades redondas alrededor del cubo */
    var pr = R * 0.1, ringR = R * 0.335, mid = [cx - R * 0.45, cy - R * 0.45, cx + R * 0.45, cy + R * 0.45];
    var pc = function (j) { var a = j / 8 * TAU + TAU / 16; return pol(ringR, a); };
    O.flat(O.maskFrom(function (ctx) { for (k = 0; k < 8; k++) { var p = pc(k); ctx.beginPath(); ctx.arc(p[0], p[1], pr * 1.13, 0, TAU); ctx.fill(); } }), INK, 0.5);
    var pd = O.maskFrom(function (ctx) { for (k = 0; k < 8; k++) { var p = pc(k); ctx.beginPath(); ctx.arc(p[0], p[1], pr, 0, TAU); ctx.fill(); } });
    pk(O, pd, mid, 'steel', 0.5);
    var pdot = O.maskFrom(function (ctx) { for (k = 0; k < 8; k++) { var p = pc(k); ctx.beginPath(); ctx.arc(p[0] - pr * 0.3, p[1] - pr * 0.32, pr * 0.36, 0, TAU); ctx.fill(); } });
    O.flat(pdot, BONE, 0.8);
    O.raise(pdot, 0.4, 1);

    /* cubo con seis tuercas y tapa central */
    O.flat(discMask(R * 0.222), INK, 0.5);
    pk(O, discMask(R * 0.205), [cx - R * 0.21, cy - R * 0.21, cx + R * 0.21, cy + R * 0.21], 'steel', -0.3);
    O.flat(O.maskFrom(function (ctx) { for (k = 0; k < 6; k++) { var p = pol(R * 0.145, k / 6 * TAU); ctx.beginPath(); ctx.arc(p[0], p[1], R * 0.03, 0, TAU); ctx.fill(); } }), INK, 0.2);
    O.flat(discMask(R * 0.1), INK, 0.5);
    pk(O, discMask(R * 0.088), [cx - R * 0.09, cy - R * 0.09, cx + R * 0.09, cy + R * 0.09], 'hi', -0.2);

    O.render(cv, { relief: 5, spec: 0.28, vignette: 0, alpha: true });
  }

  g.SCENES = { shape: shape, band: band, rule: rule, shards: shards, emblem: emblem, wheel: wheel };
})(window);
