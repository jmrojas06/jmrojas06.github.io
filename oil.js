/* Motor de óleo v2. Simula pinceles de cerdas que cargan, arrastran y mezclan pigmento sobre un lienzo,
   guarda el espesor en un mapa de relieve y lo ilumina como una pintura real (difuso + brillo especular). */
(function (g) {
  'use strict';
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }

  function Oil(W, H, seed) {
    this.W = W; this.H = H; this.rnd = rng(seed || 1);
    var n = W * H;
    this.R = new Float32Array(n); this.G = new Float32Array(n); this.B = new Float32Array(n);
    this.Hh = new Float32Array(n);
    this.Al = new Uint8Array(n);
    var r = this.rnd, gs = 48; this.gs = gs;
    this.grid = new Float32Array((gs + 1) * (gs + 1));
    for (var i = 0; i < this.grid.length; i++) this.grid[i] = r();
  }
  var P = Oil.prototype;

  P.noise = function (x, y) {
    var gs = this.gs, fx = x * gs, fy = y * gs, ix = Math.floor(fx), iy = Math.floor(fy);
    var tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    ix = ix % gs; iy = iy % gs;
    var s = gs + 1, G = this.grid;
    var a = G[iy * s + ix], b = G[iy * s + ix + 1], c = G[(iy + 1) * s + ix], d = G[(iy + 1) * s + ix + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  P.fbm = function (x, y) {
    return this.noise(x, y) * 0.55 + this.noise(x * 2.3 + 0.37, y * 2.3 + 0.11) * 0.3 + this.noise(x * 5.1 + 0.71, y * 5.1 + 0.53) * 0.15;
  };
  P.weave = function (x, y) {
    return (Math.sin(x * 1.75) * Math.sin(y * 1.75) * 0.5 + 0.5) * 0.7 + this.noise(x / 700, y / 700) * 0.3;
  };

  P.ground = function (color, variation) {
    var W = this.W, H = this.H, c = color, v = variation == null ? 0.12 : variation;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var i = y * W + x, k = 1 + (this.fbm(x / W * 0.9, y / H * 0.9) - 0.5) * v * 2;
      this.R[i] = c[0] * k; this.G[i] = c[1] * k; this.B[i] = c[2] * k; this.Hh[i] = 0;
    }
  };

  P.maskFrom = function (draw) {
    var W = this.W, H = this.H, c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; draw(x);
    var d = x.getImageData(0, 0, W, H).data, m = new Uint8Array(W * H);
    for (var i = 0; i < m.length; i++) m[i] = d[i * 4 + 3];
    return m;
  };
  /* contorno con irregularidad de pincel */
  P.rough = function (pts, amp, sub) {
    var r = this.rnd, out = [], n = pts.length;
    for (var i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(L / (sub || 14)));
      for (var j = 0; j < k; j++) {
        var t = j / k, nx = -(b[1] - a[1]) / (L || 1), ny = (b[0] - a[0]) / (L || 1), o = (r() - 0.5) * 2 * amp;
        out.push([a[0] + (b[0] - a[0]) * t + nx * o, a[1] + (b[1] - a[1]) * t + ny * o]);
      }
    }
    return out;
  };
  P.polyMask = function (pts, amp) {
    var rp = this.rough(pts, amp == null ? 2.2 : amp, 12);
    return this.maskFrom(function (x) { x.beginPath(); rp.forEach(function (p, i) { i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]); }); x.closePath(); x.fill(); });
  };
  P.circleMask = function (cx, cy, r, amp) {
    var pts = [], n = 90, rr = this.rnd, ph = rr() * 6;
    for (var i = 0; i < n; i++) { var a = i / n * 6.2832; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    var rp = this.rough(pts, amp == null ? 2 : amp, 16);
    return this.maskFrom(function (x) { x.beginPath(); rp.forEach(function (p, i) { i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]); }); x.closePath(); x.fill(); });
  };

  P.stroke = function (o) {
    var W = this.W, H = this.H, R = this.R, G = this.G, B = this.B, Hh = this.Hh, rnd = this.rnd;
    var a = o.angle, dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
    var len = o.len, wd = o.width, nb = Math.max(4, Math.round(wd / 0.8)), col = o.color, mask = o.mask || null;
    var vr = (o.var == null ? 0.05 : o.var) * 255, knife = !!o.knife;
    var br = [], clump = o.clump || 5, nc = Math.ceil(nb / clump) + 1, cr = [], cc = [];
    for (var q = 0; q < nc; q++) { cr.push(rnd()); cc.push([(rnd() - 0.5) * vr, (rnd() - 0.5) * vr, (rnd() - 0.5) * vr]); }
    for (var i = 0; i < nb; i++) {
      var u = i / (nb - 1), edge = (i === 0 || i === nb - 1), ci = (i / clump) | 0;
      br.push({
        off: (u - 0.5) * wd, len: len * (1 - (o.dry || 0) * rnd() * 0.6), ph: rnd() * 6.28,
        load: (o.load == null ? 0.95 : o.load) * (0.88 + 0.12 * rnd()),
        rid: (knife ? 0.55 + 0.1 * cr[ci] : 0.55 + 0.35 * cr[ci] + 0.1 * rnd()) * (edge ? (knife ? 1.5 : 1.25) : 1),
        c: [col[0] + cc[ci][0] + (rnd() - 0.5) * vr * 0.3, col[1] + cc[ci][1] + (rnd() - 0.5) * vr * 0.3, col[2] + cc[ci][2] + (rnd() - 0.5) * vr * 0.3]
      });
    }
    var step = 0.7, ns = Math.ceil(len / step), th = o.thick == null ? 1 : o.thick, pick = o.pickup == null ? 0.03 : o.pickup;
    var alpha = o.alpha == null ? 0.92 : o.alpha, taper = o.taper == null ? 0.35 : o.taper, curve = o.curve || 0;
    for (var s = 0; s <= ns; s++) {
      var t = s / ns, tl = t * len;
      var env = Math.min(1, t / 0.05) * (1 - taper * Math.max(0, (t - 0.72) / 0.28));
      var bow = curve * Math.sin(Math.PI * t), cx = o.x + dx * tl + px * bow, cy = o.y + dy * tl + py * bow;
      for (var k = 0; k < nb; k++) {
        var b = br[k]; if (tl > b.len) continue;
        var w = Math.sin(tl * 0.05 + b.ph) * 0.55, bx = cx + px * (b.off + w), by = cy + py * (b.off + w);
        if (bx < 1 || by < 1 || bx >= W - 1 || by >= H - 1) continue;
        var ix = bx | 0, iy = by | 0, idx = iy * W + ix, m = mask ? mask[idx] * 0.00392157 : 1;
        if (m <= 0.02) continue;
        var ld = b.load * (1 - 0.22 * t), dep = ld * env * alpha * m;
        if (ld < 0.4) dep *= clamp((ld / 0.4) * 0.6 + this.weave(ix, iy) * 0.7, 0, 1);
        if (dep <= 0.005) continue;
        var r0 = R[idx], g0 = G[idx], b0 = B[idx];
        R[idx] = r0 + (b.c[0] - r0) * dep; G[idx] = g0 + (b.c[1] - g0) * dep; B[idx] = b0 + (b.c[2] - b0) * dep;
        b.c[0] += (r0 - b.c[0]) * pick; b.c[1] += (g0 - b.c[1]) * pick; b.c[2] += (b0 - b.c[2]) * pick;
        var tgt = th * b.rid * (0.55 + 0.45 * ld) * env;
        Hh[idx] += (tgt - Hh[idx]) * dep;
      }
    }
  };

  /* imprimacion plana: cubre la zona antes de las pinceladas */
  P.flat = function (mask, color, thick, erase) {
    var n = this.W * this.H, R = this.R, G = this.G, B = this.B, Hh = this.Hh, Al = this.Al, th = thick == null ? 0.25 : thick;
    for (var i = 0; i < n; i++) {
      var m = mask[i] * 0.00392157; if (m <= 0) continue;
      R[i] += (color[0] - R[i]) * m; G[i] += (color[1] - G[i]) * m; B[i] += (color[2] - B[i]) * m; Hh[i] += (th - Hh[i]) * m;
      if (erase) Al[i] = Math.max(0, Al[i] - mask[i]); else if (mask[i] > Al[i]) Al[i] = mask[i];
    }
  };

  /* rellena una zona con muchas pinceladas direccionales */
  P.fill = function (mask, bbox, o) {
    var r = this.rnd, w = bbox[2] - bbox[0], h = bbox[3] - bbox[1], cover = o.cover || 2.4;
    var n = Math.max(1, Math.round(cover * w * h / (o.len * o.width)));
    for (var i = 0; i < n; i++) {
      var cx = bbox[0] + r() * w, cy = bbox[1] + r() * h, a = o.angle + (r() - 0.5) * (o.jitter == null ? 0.12 : o.jitter);
      var len = o.len * (0.65 + 0.7 * r()), wd = o.width * (0.6 + 0.8 * r()), c = o.colors[(r() * o.colors.length) | 0];
      this.stroke({ x: cx - Math.cos(a) * len / 2, y: cy - Math.sin(a) * len / 2, angle: a, len: len, width: wd, color: c, mask: mask,
        thick: o.thick, load: o.load, alpha: o.alpha, pickup: o.pickup, knife: o.knife, dry: o.dry, taper: o.taper, curve: (r() - 0.5) * (o.bend || 8), var: o.var });
    }
  };

  /* sgraffito: surco fino que deja ver lo de abajo */
  P.scratch = function (x0, y0, x1, y1, w, depth, tone, wob) {
    var W = this.W, H = this.H, L = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(L / 0.6), r = this.rnd;
    var amp = wob == null ? 4 : wob, ph1 = r() * 6.28, ph2 = r() * 6.28, fr = 3 + r() * 4;
    for (var i = 0; i <= n; i++) {
      var t = i / n, nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      var off = amp * (Math.sin(t * fr + ph1) * 0.7 + Math.sin(t * fr * 2.7 + ph2) * 0.3);
      var x = x0 + (x1 - x0) * t + nx * off, y = y0 + (y1 - y0) * t + ny * off;
      var ww = w * (0.55 + 0.45 * Math.sin(t * 9 + ph2) * Math.sin(t * 3.1 + ph1) + 0.25), env = Math.min(1, t * 14, (1 - t) * 8);
      for (var k = -ww; k <= ww; k += 0.6) {
        var ix = (x + nx * k + (r() - 0.5) * 0.4) | 0, iy = (y + ny * k) | 0; if (ix < 1 || iy < 1 || ix >= W - 1 || iy >= H - 1) continue;
        var idx = iy * W + ix, f = (1 - Math.abs(k) / (ww + 0.01)) * env, d = depth * f;
        this.Hh[idx] = Math.max(0, this.Hh[idx] - d);
        if (tone) { var m = 0.55 * f; this.R[idx] += (tone[0] - this.R[idx]) * m; this.G[idx] += (tone[1] - this.G[idx]) * m; this.B[idx] += (tone[2] - this.B[idx]) * m; }
      }
    }
  };

  /* realza una máscara como empaste (las letras quedan en relieve) */
  P.raise = function (mask, amount, soft) {
    var W = this.W, H = this.H, Hh = this.Hh, s = soft || 2, tmp = new Float32Array(W * H);
    for (var y = s; y < H - s; y++) for (var x = s; x < W - s; x++) {
      var i = y * W + x, v = 0;
      v += mask[i] + mask[i - s] + mask[i + s] + mask[i - s * W] + mask[i + s * W];
      tmp[i] = v / 5 / 255;
    }
    for (var j = 0; j < Hh.length; j++) Hh[j] += tmp[j] * amount;
  };

  P.render = function (canvas, o) {
    o = o || {};
    var W = this.W, H = this.H, R = this.R, G = this.G, B = this.B, Hh = this.Hh;
    canvas.width = W; canvas.height = H;
    var passes = o.soften == null ? 2 : o.soften, tmp = new Float32Array(W * H);
    for (var ps = 0; ps < passes; ps++) {
      for (var y0 = 0; y0 < H; y0++) for (var x0 = 1; x0 < W - 1; x0++) { var j0 = y0 * W + x0; tmp[j0] = (Hh[j0 - 1] + Hh[j0] * 2 + Hh[j0 + 1]) * 0.25; }
      for (var y1 = 1; y1 < H - 1; y1++) for (var x1 = 0; x1 < W; x1++) { var j1 = y1 * W + x1; Hh[j1] = (tmp[j1 - W] + tmp[j1] * 2 + tmp[j1 + W]) * 0.25; }
    }
    var ctx = canvas.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
    var k = o.relief == null ? 5 : o.relief, spec = o.spec == null ? 0.3 : o.spec, shine = o.shine == null ? 55 : o.shine;
    var lx = -0.55, ly = -0.62, lz = 0.56, ln = Math.hypot(lx, ly, lz); lx /= ln; ly /= ln; lz /= ln;
    var hx = lx, hy = ly, hz = lz + 1, hn = Math.hypot(hx, hy, hz); hx /= hn; hy /= hn; hz /= hn;
    var cxm = W / 2, cym = H / 2, vig = o.vignette == null ? 0.16 : o.vignette;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var i = y * W + x, o4 = i * 4, nx = 0, ny = 0;
      if (x > 0 && y > 0 && x < W - 1 && y < H - 1) { nx = (Hh[i - 1] - Hh[i + 1]) * k; ny = (Hh[i - W] - Hh[i + W]) * k; }
      var inv = 1 / Math.sqrt(nx * nx + ny * ny + 1), df = (nx * lx + ny * ly + lz) * inv;
      var shade = clamp(1 + 0.85 * (df - lz), 0.4, 1.55);
      var sp = 0, dh = (nx * hx + ny * hy + hz) * inv;
      if (dh > 0.85) sp = Math.pow(dh, shine) * spec * clamp(Hh[i] * 1.1, 0, 1);
      var ex = (x - cxm) / cxm, ey = (y - cym) / cym, v = 1 - vig * (ex * ex + ey * ey) * 0.5;
      d[o4] = clamp(R[i] * shade * v + sp * 245, 0, 255);
      d[o4 + 1] = clamp(G[i] * shade * v + sp * 238, 0, 255);
      d[o4 + 2] = clamp(B[i] * shade * v + sp * 225, 0, 255);
      d[o4 + 3] = o.alpha ? this.Al[i] : 255;
    }
    ctx.putImageData(img, 0, 0);
  };

  g.Oil = Oil; g.OilUtil = { hex: hex, rng: rng };
})(window);
