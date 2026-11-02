/* Creaition site interactions (vanilla JS, no dependencies, no network requests).
   Estimator · monthly selector + extras + mobile total bar · Request More carry-over · forms (front end only) · menu · reveal.
   Started from design/source/js/site.js. */
(function () {
  'use strict';
  var qs = new URLSearchParams(location.search);
  var money0 = function (n) { return '$' + n.toLocaleString('en-US'); };
  var money2 = function (n) { return '$' + n.toFixed(2); };
  var clamp = function (v, lo, hi) { v = parseInt(v, 10); return isNaN(v) ? lo : Math.min(hi, Math.max(lo, v)); };
  var store = {
    get: function (k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  };
  /* Remember where the site root is (used by 404.html, which can be served at any depth). */
  try { var me = document.currentScript; if (me && me.src) localStorage.setItem('cr-site-base', new URL('..', me.src).pathname); } catch (e) {}

  /* ---------- Pricing (from copy; the only prices used) ---------- */
  var BASE = 250, SIMPLE = 25, FEATURE = 50, MAX = 5;
  var estTotal = function (s, f) { return BASE + SIMPLE * s + FEATURE * f; };
  var PLAN = { none: ['No plan', 0], starter: ['Starter', 49.99], creator: ['Creator', 99.99], infinity: ['Infinity', 249.99] };
  var HOST = { none: ['No hosting needed', 0], starter: ['Starter Business', 9.99], small: ['Small Business', 15.99], medium: ['Medium Business', 29.99], large: ['Large Business', 49.99] };
  var EXTRA = 10, EXTRA_MAX = 3, EXTRA_PLANS = ['starter', 'creator'], INCLUDED = { starter: 3, creator: 8 };
  var monthlyTotal = function (p, h, x) { return Math.round(((PLAN[p] || PLAN.none)[1] + (HOST[h] || HOST.none)[1] + x * EXTRA) * 100) / 100; };
  var estHref = function (s, f) { return 'request-more.html?s=' + s + '&f=' + f + '&total=' + estTotal(s, f); };
  window.Creaition = { estTotal: estTotal, monthlyTotal: monthlyTotal };

  /* ---------- Project estimator: Total = 250 + 25 × simple + 50 × feature ($250–$625) ---------- */
  document.querySelectorAll('[data-estimator]').forEach(function (root) {
    var s = root.querySelector('[data-range="simple"]'), f = root.querySelector('[data-range="feature"]');
    var totalEl = root.querySelector('[data-total]'), live = root.querySelector('[data-live]');
    var state = root.querySelector('[data-state]'), reset = root.querySelector('[data-reset]');
    if (qs.has('s')) s.value = clamp(qs.get('s'), 0, MAX);
    if (qs.has('f')) f.value = clamp(qs.get('f'), 0, MAX);
    var last = null, liveTimer;
    function paint(input, unit, word) {
      var n = +input.value;
      input.style.setProperty('--p', (n / MAX) * 100 + '%');
      input.setAttribute('aria-valuetext', n + ' ' + word + ' page' + (n === 1 ? '' : 's') + ', ' + money0(n * unit));
      root.querySelector('[data-out="' + input.dataset.range + '"]').innerHTML = n + ' <span class="eq">×</span> ' + money0(unit) + ' <span class="eq">=</span> ' + money0(n * unit);
      root.querySelectorAll('[data-ticks="' + input.dataset.range + '"] span').forEach(function (t, i) { t.classList.toggle('on', i <= n); });
      return n;
    }
    function update(user) {
      var ns = paint(s, SIMPLE, 'simple'), nf = paint(f, FEATURE, 'feature'), total = estTotal(ns, nf);
      totalEl.textContent = money0(total);
      if (user && last !== total) { totalEl.classList.remove('bump'); void totalEl.offsetWidth; totalEl.classList.add('bump'); }
      last = total;
      if (live) { clearTimeout(liveTimer); liveTimer = setTimeout(function () { live.textContent = 'Total: ' + money0(total); }, user ? 250 : 0); }
      var href = estHref(ns, nf);
      root.querySelectorAll('[data-rm]').forEach(function (a) { a.setAttribute('href', href); });
      document.querySelectorAll('[data-rm-page]').forEach(function (a) { a.setAttribute('href', href); });
      if (user) store.set('cr-estimate', { s: ns, f: nf });
      if (state) {
        var msg = null;
        if (ns === MAX && nf === MAX) msg = 'Big build. Let\'s make sure it\'s sized right. <a href="' + href + '">Request More</a>';
        else if (ns === MAX || nf === MAX) msg = 'That\'s the max here. Need more than 5? <a href="' + href + '">Request More</a> and tell us why. We\'ll size it with you.';
        else if (ns === 0 && nf === 0) msg = 'Just your home page (landing page) for now. Add pages anytime.';
        state.hidden = !msg; if (msg) state.innerHTML = msg;
      }
    }
    s.addEventListener('input', function () { update(true); });
    f.addEventListener('input', function () { update(true); });
    if (reset) reset.addEventListener('click', function () { s.value = 0; f.value = 0; update(true); store.del('cr-estimate'); s.focus(); });
    update(false);
  });

  /* ---------- Monthly selector: plan + host size + extras (Starter/Creator only, 0–3 × $10) ---------- */
  document.querySelectorAll('[data-monthly]').forEach(function (root) {
    var rows = root.querySelector('[data-rows]'), totalEl = root.querySelector('[data-mtotal]');
    var stateEl = root.querySelector('[data-mstate]'), live = root.querySelector('[data-mlive]'), cta = root.querySelector('[data-mcta]');
    var extrasBox = root.querySelector('[data-extras]'); // optional, self-contained component
    var bar = document.querySelector('[data-mbar]'); // lives outside the revealed (transformed) section so position:fixed works
    var extras = 0;
    var pick = function (name, v) { var r = v && root.querySelector('input[name="' + name + '"][value="' + v + '"]'); if (r) r.checked = true; };
    pick('plan', qs.get('plan')); pick('host', qs.get('host'));
    if (qs.has('x')) extras = clamp(qs.get('x'), 0, EXTRA_MAX);
    var val = function (n) { var c = root.querySelector('input[name="' + n + '"]:checked'); return c ? c.value : 'none'; };
    var liveTimer;
    function update() {
      var p = val('plan'), h = val('host');
      var extrasOn = !!extrasBox && EXTRA_PLANS.indexOf(p) > -1;
      if (!extrasOn) extras = 0; // Infinity / No plan: hidden and reset
      if (extrasBox) {
        extrasBox.querySelector('[data-xrow]').hidden = !extrasOn;
        extrasBox.querySelector('[data-xinf]').hidden = p !== 'infinity';
        paintExtras(p, extrasOn);
      }
      var pn = PLAN[p][0], pv = PLAN[p][1], hn = HOST[h][0], hv = HOST[h][1], ev = extras * EXTRA;
      var total = monthlyTotal(p, h, extras);
      var html = '<div class="inv-row' + (pv ? '' : ' zero') + '"><span>' + pn + '</span><span class="amt">' + money2(pv) + '</span></div>';
      html += '<div class="inv-row' + (hv ? '' : ' zero') + '"><span>' + (h === 'none' ? 'No hosting needed' : hn + ' hosting') + '</span><span class="amt">' + money2(hv) + '</span></div>';
      if (extras > 0) html += '<div class="inv-row" data-extras-row><span>Extra revisions (' + extras + ' × $10)</span><span class="amt">' + money2(ev) + '</span></div>';
      rows.innerHTML = html;
      totalEl.innerHTML = money2(total) + '<small>/mo</small>';
      var st;
      if (p === 'none' && h === 'none') st = 'Nothing monthly. Your site, your hosting.';
      else if (p !== 'none' && h === 'none') st = 'No host fee. Your site doesn\'t need hosting or storage.';
      else if (p === 'none') st = 'Hosting only. Add a plan for revisions and ongoing care.';
      else st = pn + ' + ' + hn + ' hosting = ' + money2(total) + '/mo';
      stateEl.textContent = st;
      var mhref = 'request-more.html?plan=' + p + '&host=' + h + '&x=' + extras + '&monthly=' + total.toFixed(2);
      if (cta) cta.setAttribute('href', mhref);
      if (bar) bar.querySelector('[data-mbar-cta]').setAttribute('href', mhref);
      // one polite, debounced announcement: from the bar while it's showing, otherwise from the receipt
      var barOn = bar && !bar.hidden && getComputedStyle(bar).display !== 'none';
      clearTimeout(liveTimer);
      liveTimer = setTimeout(function () {
        var msg = 'Monthly total: ' + money2(total) + ' per month';
        if (barOn) { live.textContent = ''; bar.querySelector('[data-mbar-live]').textContent = msg; }
        else { live.textContent = msg; if (bar) bar.querySelector('[data-mbar-live]').textContent = ''; }
      }, 400);
      if (bar) {
        bar.querySelector('[data-mbar-total]').textContent = money2(total);
        var parts = [];
        if (p !== 'none') parts.push(pn);
        if (h !== 'none') parts.push(hn + ' hosting');
        if (extras > 0) parts.push(extras + ' extra revision' + (extras === 1 ? '' : 's'));
        bar.querySelector('[data-mbar-brk]').textContent = parts.length ? parts.join(' + ') : 'Nothing monthly';
        bar.dataset.total = total.toFixed(2);
        padBar();
      }
      root.dataset.plan = p; root.dataset.host = h; root.dataset.extras = extras; root.dataset.total = total.toFixed(2);
    }
    function paintExtras(p, on) {
      var out = extrasBox.querySelector('[data-xout]');
      out.textContent = extras;
      out.setAttribute('aria-label', extras + ' extra revisions, $' + extras * EXTRA + ' a month');
      extrasBox.querySelector('[data-xminus]').disabled = extras <= 0;
      extrasBox.querySelector('[data-xplus]').disabled = extras >= EXTRA_MAX;
      extrasBox.querySelector('[data-xmax]').hidden = !(on && extras >= EXTRA_MAX);
      var inc = INCLUDED[p];
      extrasBox.querySelector('[data-xval]').textContent = inc ? inc + ' included + ' + extras + ' extra = ' + (inc + extras) + ' a month' : '';
    }
    if (extrasBox) {
      var minus = extrasBox.querySelector('[data-xminus]'), plus = extrasBox.querySelector('[data-xplus]');
      minus.addEventListener('click', function () { extras = Math.max(0, extras - 1); update(); if (minus.disabled) plus.focus(); });
      plus.addEventListener('click', function () { extras = Math.min(EXTRA_MAX, extras + 1); update(); if (plus.disabled) minus.focus(); });
    }
    root.addEventListener('change', function (e) { update(); if (e.target.name === 'plan' && e.target.value !== 'none') showBar(); });

    /* Mobile sticky total bar: < 1024 px only (CSS hides it on desktop). Shows once the picker scrolls
       into view or a plan is chosen; body gets matching bottom padding so nothing is covered. */
    function showBar() {
      if (!bar || !bar.hidden) return;
      bar.hidden = false; document.body.classList.add('has-mbar'); padBar(); update();
    }
    function padBar() { if (bar && !bar.hidden) document.documentElement.style.setProperty('--mbar-h', bar.offsetHeight + 'px'); }
    if (bar) {
      if (val('plan') !== 'none') showBar();
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { showBar(); io.disconnect(); } }); });
        io.observe(root.querySelector('.pickers'));
      } else showBar();
      window.addEventListener('resize', padBar);
    }
    update();
  });

  /* ---------- Request More: estimate + monthly snapshot (recomputed here, never trusted from the URL) ---------- */
  var snap = document.querySelector('[data-snapshot]');
  if (snap) {
    var t = snap.querySelector('[data-snap-text]'), form = snap.closest('form');
    var setH = function (n, v) { var i = form.querySelector('input[name="' + n + '"]'); if (i) i.value = v; };
    var est = null;
    if (qs.has('s') || qs.has('f') || qs.has('total')) est = { s: clamp(qs.get('s'), 0, MAX), f: clamp(qs.get('f'), 0, MAX) };
    else { var saved = store.get('cr-estimate'); if (saved) est = { s: clamp(saved.s, 0, MAX), f: clamp(saved.f, 0, MAX) }; }
    var lines = [];
    if (est) {
      var total = estTotal(est.s, est.f);
      lines.push('<span class="muted">Your estimate</span>Home page (landing page) + ' + est.s + ' Simple Pages + ' + est.f + ' Feature Pages · <strong data-snap-total>Total ' + money0(total) + '</strong>');
      setH('est_s', est.s); setH('est_f', est.f); setH('est_total', total);
      store.set('cr-estimate', est);
      var ch = snap.querySelector('[data-change-est]'); if (ch) ch.setAttribute('href', 'estimator.html?s=' + est.s + '&f=' + est.f);
    }
    var p = qs.get('plan'), h = qs.get('host') || 'none';
    if (!HOST[h]) h = 'none';
    if (p && PLAN[p] && p !== 'none') {
      var x = EXTRA_PLANS.indexOf(p) > -1 ? clamp(qs.get('x'), 0, EXTRA_MAX) : 0, m = monthlyTotal(p, h, x);
      lines.push('<span class="muted">Monthly</span>' + PLAN[p][0] + (h !== 'none' ? ' + ' + HOST[h][0] + ' hosting' : '') + (x ? ' + ' + x + ' extra revision' + (x === 1 ? '' : 's') : '') + ' · <strong>' + money2(m) + '/mo</strong>');
      setH('m_plan', p); setH('m_host', h); setH('m_extras', x); setH('m_monthly', m.toFixed(2));
      var ps = form.querySelector('select[name="plan"]'); if (ps) ps.value = PLAN[p][0];
      var hs = form.querySelector('select[name="host"]'); if (hs && h !== 'none') hs.value = HOST[h][0];
    }
    if (lines.length) t.innerHTML = lines.join('<br><br>');
  }

  /* ---------- Conditional fields + contact topic help ---------- */
  document.querySelectorAll('[data-show-when]').forEach(function (el) {
    var kv = el.dataset.showWhen.split('='), name = kv[0], value = kv[1];
    var sync = function () { var c = document.querySelector('input[name="' + name + '"]:checked, select[name="' + name + '"]'); el.hidden = !(c && c.value === value); };
    document.querySelectorAll('[name="' + name + '"]').forEach(function (i) { i.addEventListener('change', sync); }); sync();
  });
  var topicHelp = document.querySelector('[data-help="topic"]');
  if (topicHelp) document.querySelectorAll('input[name="topic"]').forEach(function (r) {
    r.addEventListener('change', function () { var tp = document.querySelector('template[data-topic-help="' + r.value + '"]'); if (tp) topicHelp.innerHTML = tp.innerHTML; });
  });

  /* ---------- Forms: front end only. Validation + honeypot + placeholder submit. Nothing is sent or stored. ---------- */
  var FORM_HANDLER = null; // the Master Desk endpoint goes here later. Until then: no fetch, no action, no storage.
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, PHONE = /^[0-9 +()\-]{7,}$/, URLRE = /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i;
  document.querySelectorAll('form[data-form]').forEach(function (form) {
    var summary = form.querySelector('[data-err-summary]');
    function visible(el) { return !el.closest('[hidden]'); }
    function setErr(el, msg) {
      var name = el.name, err = form.querySelector('#err-' + name);
      var group = form.querySelector('[data-group="' + name + '"]');
      var targets = group ? form.querySelectorAll('input[name="' + name + '"]') : [el];
      targets.forEach(function (i) {
        if (msg) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
        var d = (i.getAttribute('aria-describedby') || '').split(' ').filter(function (x) { return x && x !== 'err-' + name; });
        if (msg) d.push('err-' + name);
        if (d.length) i.setAttribute('aria-describedby', d.join(' ')); else i.removeAttribute('aria-describedby');
      });
      if (group) group.classList.toggle('is-invalid', !!msg);
      if (err) { err.hidden = !msg; err.innerHTML = msg ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5"/><circle cx="12" cy="16.3" r=".6" fill="currentColor"/></svg><span>' + msg + '</span>' : ''; }
    }
    function check(el) {
      var v = (el.value || '').trim(), d = el.dataset, req = el.required;
      if (el.type === 'radio') {
        if (!req) return '';
        return form.querySelector('input[name="' + el.name + '"]:checked') ? '' : (d.msgRequired || 'Please choose an answer.');
      }
      if (el.type === 'checkbox') return req && !el.checked ? d.msgRequired : '';
      if (req && !v) return d.msgRequired || 'Please fill this in.';
      if (!v) return '';
      if (el.type === 'email' && !EMAIL.test(v)) return d.msgFormat;
      if (el.type === 'tel' && !PHONE.test(v)) return d.msgFormat;
      if (el.type === 'url' && !URLRE.test(v)) return d.msgFormat;
      if (el.type === 'date') { var today = new Date(); today.setHours(0, 0, 0, 0); var dt = new Date(v + 'T00:00:00'); if (dt < today) return d.msgPast; }
      if (el.minLength > 0 && v.length < el.minLength) return d.msgShort || ('Add at least ' + el.minLength + ' characters.');
      if (el.maxLength > 0 && v.length > el.maxLength) return 'Keep this under ' + el.maxLength + ' characters. (' + v.length + '/' + el.maxLength + ')';
      return '';
    }
    function controls() {
      var seen = {}, out = [];
      form.querySelectorAll('input:not([type=hidden]):not([name=hp_field]), select, textarea').forEach(function (el) {
        if (!visible(el)) { setErr(el, ''); return; }
        if (el.type === 'radio') { if (seen[el.name]) return; seen[el.name] = 1; el = form.querySelector('input[name="' + el.name + '"]'); }
        out.push(el);
      });
      return out;
    }
    form.addEventListener('change', function (e) { if (e.target.getAttribute('aria-invalid') === 'true' || form.querySelector('[data-group="' + e.target.name + '"].is-invalid')) setErr(e.target, check(e.target)); });
    // re-check a flagged text field while typing (not on blur, so the layout never shifts under a click)
    form.addEventListener('input', function (e) { var el = e.target; if (el.matches('.input, .textarea') && el.getAttribute('aria-invalid') === 'true' && !check(el)) setErr(el, ''); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var hp = form.querySelector('input[name="hp_field"]');
      var bad = [];
      controls().forEach(function (el) { var m = check(el); setErr(el, m); if (m) bad.push([el, m]); });
      if (hp && hp.value) bad = []; // honeypot filled: show the normal success, send nothing
      if (bad.length) {
        var ul = summary.querySelector('ul'); ul.innerHTML = '';
        bad.forEach(function (b) {
          var id = b[0].id || (b[0].id = 'f-' + b[0].name + '-0');
          var li = document.createElement('li'), a = document.createElement('a');
          a.href = '#' + id; a.textContent = b[1];
          a.addEventListener('click', function (ev) { ev.preventDefault(); b[0].focus(); });
          li.appendChild(a); ul.appendChild(li);
        });
        summary.hidden = false; summary.focus();
        return;
      }
      summary.hidden = true;
      var btn = form.querySelector('[type=submit]'), hint = form.querySelector('[data-sending-hint]');
      btn.disabled = true; btn.textContent = btn.dataset.sending || 'Checking…'; if (hint) hint.hidden = false;
      var first = ((form.querySelector('[name=name]') || {}).value || '').trim().split(/\s+/)[0] || 'there';
      var email = ((form.querySelector('[name=email]') || {}).value || '').trim();
      var estT = (form.querySelector('[name=est_total]') || {}).value;
      // FORM_HANDLER is null: nothing is sent. Placeholder success after a short beat.
      setTimeout(function () {
        var tpl = form.parentNode.querySelector('template[data-success]'), wrap = document.createElement('div');
        wrap.className = 'form-card form-card--done'; wrap.setAttribute('role', 'status');
        wrap.appendChild(document.importNode(tpl.content, true));
        wrap.querySelectorAll('[data-fill="first"]').forEach(function (n) { n.textContent = first; });
        wrap.querySelectorAll('[data-fill="email"]').forEach(function (n) { n.textContent = email; });
        wrap.querySelectorAll('[data-fill="total"]').forEach(function (n) { n.textContent = estT ? money0(+estT) : ''; });
        wrap.querySelectorAll('[data-fill-if="total"]').forEach(function (n) { n.hidden = !estT; });
        form.replaceWith(wrap);
        var done = wrap.querySelector('.form-done'); if (done) done.focus();
      }, 600);
    });
  });

  /* ---------- Mobile menu (focus moves in, Esc closes, Tab stays inside, rest of page inert) ---------- */
  var mb = document.querySelector('.menu-btn'), dr = document.getElementById('drawer');
  if (mb && dr) {
    var outside = [document.querySelector('main'), document.querySelector('.site-footer'), document.querySelector('.skip'), document.querySelector('.site-header .logo-crop')].filter(Boolean);
    var setOpen = function (o, refocus) {
      dr.hidden = !o; dr.classList.toggle('open', o);
      mb.setAttribute('aria-expanded', String(o)); mb.setAttribute('aria-label', o ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('menu-open', o);
      outside.forEach(function (el) { if (o) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
      if (o) dr.querySelector('a').focus(); else if (refocus) mb.focus();
    };
    mb.addEventListener('click', function () { setOpen(dr.hidden, true); });
    document.addEventListener('keydown', function (e) {
      if (dr.hidden) return;
      if (e.key === 'Escape') setOpen(false, true);
      if (e.key === 'Tab') {
        var items = [mb].concat([].slice.call(dr.querySelectorAll('a'))), i = items.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
      }
    });
    dr.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false, false); });
    matchMedia('(min-width: 1024px)').addEventListener('change', function (m) { if (m.matches && !dr.hidden) setOpen(false, false); });
  }

  /* ---------- Scroll reveal ---------- */
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var els = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) els.forEach(function (e) { e.classList.add('in'); });
  else {
    var rio = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); rio.unobserve(en.target); } }); }, { rootMargin: '0px 0px -10% 0px' });
    els.forEach(function (e) { rio.observe(e); });
  }
})();
