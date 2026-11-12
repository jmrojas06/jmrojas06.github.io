(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var eager = !!window.PAINT_EAGER, HAS_IO = 'IntersectionObserver' in window;

  function paintEl(el) {
    var t = el.getAttribute('data-scene');
    if (window.SCENES && window.SCENES[t]) { try { window.SCENES[t](el); } catch (e) { console.error(t, e); } }
    var r = el.getBoundingClientRect();
    el.setAttribute('data-painted', Math.round(r.width) + 'x' + Math.round(r.height));
  }

  /* un lienzo por turno, para que la página siga respondiendo y la portada se pinte en secuencia */
  var queue = [], busy = false;
  function drain() {
    if (busy) return; busy = true;
    (function next() {
      var el = queue.shift();
      if (!el) { busy = false; return; }
      paintEl(el);
      setTimeout(next, 0);
    })();
  }
  function enqueue(el, force) {
    if (!force && el.hasAttribute('data-painted')) return;
    if (queue.indexOf(el) === -1) queue.push(el);
    drain();
  }

  function scenes() {
    var cs = d.querySelectorAll('canvas[data-scene]');
    if (eager || !HAS_IO) { Array.prototype.forEach.call(cs, paintEl); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); enqueue(e.target); } });
    }, { rootMargin: '700px 0px' });
    Array.prototype.forEach.call(cs, function (c) { io.observe(c); });
    /* lo que aún no se pintó se va pintando en los ratos libres, para que todo esté listo antes de llegar */
    var ric = window.requestIdleCallback || function (fn) { return setTimeout(fn, 80); };
    setTimeout(function () {
      var rest = Array.prototype.filter.call(cs, function (c) { return !c.hasAttribute('data-painted'); });
      (function step() {
        var c = rest.shift();
        if (!c) return;
        if (!c.hasAttribute('data-painted')) paintEl(c);
        ric(step, { timeout: 400 });
      })();
    }, 2200);
  }

  window.__paintAll = function () {
    Array.prototype.forEach.call(d.querySelectorAll('canvas[data-scene]:not([data-painted])'), paintEl);
  };

  function reveals() {
    var els = d.querySelectorAll('.reveal');
    if (reduce || !HAS_IO) { Array.prototype.forEach.call(els, function (e) { e.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
    Array.prototype.forEach.call(els, function (e) { io.observe(e); });
    setTimeout(function () {
      Array.prototype.forEach.call(els, function (e) {
        var r = e.getBoundingClientRect();
        if (r.width > 0 && r.top < window.innerHeight && r.bottom > 0) e.classList.add('is-in');
      });
    }, 1200);
  }

  /* paralaje de las formas con el puntero: solo con ratón y sin movimiento reducido */
  function parallax() {
    var hosts = d.querySelectorAll('[data-parallax]');
    if (reduce || !hosts.length || !window.matchMedia('(pointer: fine)').matches) return;
    Array.prototype.forEach.call(hosts, function (host) {
      var raf = 0, nx = 0, ny = 0;
      function apply() { raf = 0; host.style.setProperty('--mx', nx.toFixed(3)); host.style.setProperty('--my', ny.toFixed(3)); }
      host.addEventListener('pointermove', function (e) {
        var r = host.getBoundingClientRect();
        nx = ((e.clientX - r.left) / r.width - 0.5) * 2; ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
        if (!raf) raf = requestAnimationFrame(apply);
      }, { passive: true });
      host.addEventListener('pointerleave', function () { nx = 0; ny = 0; if (!raf) raf = requestAnimationFrame(apply); }, { passive: true });
    });
  }

  /* grano de lienzo: un mosaico de ruido diminuto sobre toda la página */
  function grain() {
    try {
      var c = d.createElement('canvas'), n = 140; c.width = n; c.height = n;
      var x = c.getContext('2d'), img = x.createImageData(n, n), r = window.OilUtil ? window.OilUtil.rng(5) : Math.random;
      for (var i = 0; i < n * n; i++) { var v = 90 + ((r() * 150) | 0); img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
      x.putImageData(img, 0, 0);
      c.toBlob(function (b) { if (b) root.style.setProperty('--grain', 'url("' + URL.createObjectURL(b) + '")'); });
    } catch (e) { /* el grano es solo un detalle */ }
  }

  var lastW = window.innerWidth, lastH = window.innerHeight, timer;
  function onResize() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var w = window.innerWidth, h = window.innerHeight;
      if (Math.abs(w - lastW) > 24 || Math.abs(h - lastH) > 120) {
        lastW = w; lastH = h;
        Array.prototype.forEach.call(d.querySelectorAll('canvas[data-painted]'), function (c) { enqueue(c, true); });
      }
    }, 220);
  }

  function start() {
    scenes();
    reveals();
    parallax();
    if (!eager) grain();
    window.addEventListener('resize', onResize);
    root.setAttribute('data-ready', '1');
  }
  var ran = false;
  function go() { if (ran) return; ran = true; requestAnimationFrame(start); }
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(go); else window.addEventListener('load', go);
  setTimeout(go, 2500);
})();
