(() => {
  "use strict";
  const d = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const reduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  // Entries start hidden only once this script runs, so a failed script never hides the page.
  if (!reduced && "IntersectionObserver" in window) d.classList.add("rv-on");
  // Switching a view fades the old content out, swaps it, then fades the new content in.
  let swapTimer = 0;
  const swap = (els, fn) => {
    els = els.filter(Boolean);
    if (reduced || !els.length) return fn();
    clearTimeout(swapTimer);
    els.forEach((el) => el.classList.add("swap", "out"));
    swapTimer = setTimeout(() => {
      fn();
      requestAnimationFrame(() => requestAnimationFrame(() => els.forEach((el) => el.classList.remove("out"))));
    }, 170);
  };
  const CHECK = ($("#ic-check") || {}).innerHTML || "";
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  // Places a popover under its anchor, or above it when there is no room below.
  const placePop = (pop, anchor, minW) => {
    const r = anchor.getBoundingClientRect();
    if (minW) pop.style.width = `${Math.max(minW, r.width)}px`;
    const w = pop.offsetWidth, h = pop.offsetHeight;
    if (r.bottom < 0 || r.top > innerHeight) return false;
    const left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
    let top = r.bottom + 8;
    if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 8);
    pop.style.left = `${Math.round(left)}px`; pop.style.top = `${Math.round(top)}px`;
    return true;
  };

  /* ── Sound: tiny synthesized clicks, no audio files ─────────────────────── */
  let ctx = null;
  const audio = () => {
    if (!ctx) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return null;
      ctx = new A();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };
  function tone(freq, dur, { type = "sine", gain = 0.05, delay = 0, to } = {}) {
    const c = audio(); if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.03);
  }
  function tick(dur = 0.012, gain = 0.08, freq = 3600, delay = 0) {
    const c = audio(); if (!c) return;
    const n = Math.max(1, Math.floor(c.sampleRate * dur)), b = c.createBuffer(1, n, c.sampleRate), a = b.getChannelData(0);
    for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = b; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 1.1; g.gain.value = gain;
    src.connect(f).connect(g).connect(c.destination); src.start(c.currentTime + delay);
  }
  const sfx = {
    press: () => { tick(0.01, 0.09, 4200); tone(1250, 0.03, { gain: 0.03, to: 640 }); },
    release: () => tick(0.008, 0.035, 2400),
    mode: () => { tick(0.012, 0.07, 3000); tone(520, 0.06, { type: "triangle", gain: 0.045 }); tone(780, 0.09, { type: "triangle", gain: 0.04, delay: 0.06 }); },
    on: () => { tone(660, 0.05, { gain: 0.05 }); tone(990, 0.08, { gain: 0.05, delay: 0.06 }); },
    off: () => { tone(990, 0.05, { gain: 0.045 }); tone(620, 0.08, { gain: 0.045, delay: 0.06 }); },
    copy: () => { tone(880, 0.05, { gain: 0.045 }); tone(1320, 0.1, { gain: 0.045, delay: 0.06 }); },
    open: () => { tick(0.01, 0.05, 2600); tone(700, 0.07, { type: "triangle", gain: 0.035, to: 940 }); },
    cookie: () => { [0, 0.05, 0.11, 0.16].forEach((t, i) => tick(0.018, 0.07 - i * 0.012, 1800 + i * 500, t)); },
    // Section icons, one sound each, played on hover.
    ic: (k) => {
      const at = (f, d, o = {}) => tone(f, d, o);
      const S = {
        news: () => { at(392, 0.09, { type: "square", gain: 0.018, to: 466 }); at(523, 0.12, { type: "square", gain: 0.016, delay: 0.08 }); },
        biography: () => { tick(0.05, 0.05, 1800); tick(0.012, 0.04, 4200, 0.05); },
        education: () => { at(659, 0.08, { type: "triangle", gain: 0.035 }); at(988, 0.16, { type: "triangle", gain: 0.035, delay: 0.08 }); },
        experience: () => { tick(0.008, 0.09, 2400); tick(0.01, 0.07, 1500, 0.06); },
        publications: () => { [0, 0.03, 0.06].forEach((t, i) => tick(0.03, 0.05 - i * 0.012, 2600 - i * 600, t)); },
        projects: () => at(420, 0.14, { gain: 0.04, to: 840 }),
        skills: () => { [0, 0.045, 0.09].forEach((t) => tick(0.006, 0.08, 5200, t)); at(1900, 0.05, { type: "triangle", gain: 0.012, delay: 0.09 }); },
        certifications: () => { at(150, 0.1, { gain: 0.07, to: 90 }); tick(0.015, 0.06, 900); },
        // Two coins touching: inharmonic partials with fast decay, the second a touch lower.
        grants: () => { [[0, 1], [0.075, 0.94]].forEach(([t, m]) => [2630, 3950, 5270].forEach((f, i) => at(f * m, 0.16 - i * 0.04, { gain: 0.016 - i * 0.003, delay: t }))); },
        awards: () => { at(1319, 0.18, { type: "triangle", gain: 0.03 }); at(1760, 0.26, { type: "triangle", gain: 0.026, delay: 0.07 }); at(2637, 0.3, { gain: 0.01, delay: 0.12 }); },
        talks: () => sfx.fly(0.45),
        teaching: () => { tick(0.012, 0.06, 5600); tick(0.02, 0.04, 4800, 0.07); },
        service: () => { tick(0.02, 0.07, 700); tick(0.02, 0.06, 760, 0.11); },
        contact: () => { tick(0.06, 0.035, 2200); at(1175, 0.14, { type: "triangle", gain: 0.03, delay: 0.06 }); },
      };
      (S[k] || (() => tick(0.01, 0.05, 3000)))();
    },
    // Map: a soft detent while scrubbing, an airy pass while flying, a two-note chime on landing.
    detent: () => tick(0.006, 0.035, 3200),
    land: () => { tone(988, 0.12, { type: "triangle", gain: 0.03 }); tone(740, 0.22, { type: "triangle", gain: 0.03, delay: 0.1 }); },
    fly: (dur = 1) => {
      const c = audio(); if (!c) return;
      const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), a = b.getChannelData(0);
      for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t0 = c.currentTime;
      src.buffer = b; f.type = "bandpass"; f.Q.value = 0.8;
      f.frequency.setValueAtTime(380, t0); f.frequency.exponentialRampToValueAtTime(1500, t0 + dur * 0.5); f.frequency.exponentialRampToValueAtTime(520, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.03, t0 + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f).connect(g).connect(c.destination); src.start(t0); src.stop(t0 + dur + 0.02);
    },
  };
  const play = (name, force, arg) => {
    if (!force && d.dataset.sound === "off") return;
    try { sfx[name] && sfx[name](arg); } catch (e) {}
  };
  const sound = play; // the map has its own play(); it uses this name for sounds

  // Section icons: a sound and a small shake on hover (mouse only, at most once a second).
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType && e.pointerType !== "mouse") return;
    const ic = e.target.closest && e.target.closest(".sec-ic[data-ic]");
    if (!ic || (e.relatedTarget && ic.contains(e.relatedTarget))) return;
    const now = performance.now();
    if (now - (+ic.dataset.at || 0) < 1000) return;
    ic.dataset.at = String(now);
    play("ic", false, ic.dataset.ic);
    ic.classList.remove("jig"); void ic.offsetWidth; ic.classList.add("jig");
  });
  document.addEventListener("animationend", (e) => { const ic = e.target.closest && e.target.closest(".sec-ic.jig"); if (ic) ic.classList.remove("jig"); });

  // Every tactile control clicks on press; keyboard presses click on activation.
  const tactile = (el) => el && el.closest && el.closest(".tac");
  document.addEventListener("pointerdown", (e) => {
    const el = tactile(e.target); if (!el || e.button > 0) return;
    el.classList.add("down");
    if (!el.dataset.sfx) play("press");
  });
  const lift = (e) => {
    $$(".tac.down").forEach((el) => el.classList.remove("down"));
    if (tactile(e.target) && !tactile(e.target).dataset.sfx) play("release");
  };
  document.addEventListener("pointerup", lift);
  document.addEventListener("pointercancel", lift);
  document.addEventListener("click", (e) => {
    const el = tactile(e.target);
    if (el && e.detail === 0 && !el.dataset.sfx) play("press");
  });

  /* ── Toast ──────────────────────────────────────────────────────────────── */
  const toastEl = $(".toast"); let toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add("on");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove("on"), 1800);
  }

  /* ── Blur-in: entries ease in as they reach the screen ──────────────────── */
  // Entries that arrive together are staggered top to bottom.
  let io = null;
  const reveal = (el, i = 0) => {
    el.style.setProperty("--d", `${Math.min(i, 6) * 70}ms`);
    el.classList.add("in");
    setTimeout(() => el.style.removeProperty("--d"), 1600);
  };
  if (d.classList.contains("rv-on")) {
    io = new IntersectionObserver((entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .map((e) => e.target)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
        .forEach((el, i) => { reveal(el, i); io.unobserve(el); });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.01 });
    $$(".rv").forEach((el) => io.observe(el));
  } else $$(".rv").forEach((el) => el.classList.add("in"));
  // After a rearrangement, whatever is already on screen shows at once.
  const revealOnScreen = () => {
    $$(".rv:not(.in)").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height && r.top < innerHeight && r.bottom > 0) { el.classList.add("in"); if (io) io.unobserve(el); }
    });
  };

  /* ── Theme: system → light → dark ───────────────────────────────────────── */
  const THEMES = ["system", "light", "dark"];
  const themeBtn = $('[data-action="theme"]');
  function setTheme(t, fromUser) {
    if (t === "system") delete d.dataset.theme; else d.dataset.theme = t;
    if (themeBtn) themeBtn.setAttribute("aria-label", `Colour theme: ${t}`);
    if (fromUser) { store.set("theme", t); toast(`${t[0].toUpperCase()}${t.slice(1)} theme`); }
  }
  setTheme(d.dataset.theme || "system", false);

  /* ── Sound toggle ───────────────────────────────────────────────────────── */
  const soundBtn = $('[data-action="sound"]');
  const syncSound = () => { if (soundBtn) soundBtn.setAttribute("aria-pressed", String(d.dataset.sound !== "off")); };
  syncSound();

  /* ── Biography: length and voice ────────────────────────────────────────── */
  const bioSec = $("#biography");
  const bio = { len: store.get("bio-len") || "short", person: store.get("bio-person") || "third" };
  function syncBio() {
    if (!bioSec) return;
    const key = `${d.dataset.tailor}-${bio.len}-${bio.person}`;
    $$(".bv", bioSec).forEach((el) => {
      const on = el.dataset.v === key;
      el.hidden = !on;
      if (on && el.getBoundingClientRect().top < innerHeight) { el.classList.add("in"); if (io) io.unobserve(el); }
    });
    $$("[data-bio]", bioSec).forEach((b) => b.setAttribute("aria-checked", String(bio[b.dataset.bio] === b.dataset.val)));
  }

  /* ── Tailoring: research or industry order, wording and CV ──────────────── */
  const views = $$("[data-set-tailor]").map((b) => b.dataset.setTailor);
  const main = $("#main"), contactSec = $("#contact");
  const secs = $$("#main > .sec").filter((s) => s.hasAttribute(`data-o-${views[0]}`));
  // Sections in the view's order; with `extra`, the ones it leaves out follow,
  // marked as outside the view. `print` uses the view's print order if it has one.
  let extra = false;
  function arrange(v, print) {
    const key = print && secs.some((s) => s.hasAttribute(`data-p-${v}`)) ? "p" : "o";
    secs
      .map((s, i) => {
        const shown = +s.getAttribute(`data-o-${v}`) || 0;
        const o = shown ? (+s.getAttribute(`data-${key}-${v}`) || 900 + shown) : (extra ? 1000 + i : 0);
        return { s, o, out: !shown };
      })
      .sort((a, b) => a.o - b.o)
      .forEach(({ s, o, out }) => {
        s.hidden = !o;
        s.classList.toggle("outside", out && !!o);
        if (o) main.insertBefore(s, contactSec || null);
      });
    // A link to an entry this view leaves out reads as plain text until it is shown.
    $$("#main a[href^='#'], #main a[data-href]").forEach((a) => {
      const h = a.getAttribute("href") || a.dataset.href;
      const t = h.length > 1 && document.getElementById(h.slice(1));
      const sec = t && t.closest("#main > .sec");
      if (sec && sec.hidden) { a.dataset.href = h; a.removeAttribute("href"); }
      else if (!a.hasAttribute("href") && a.dataset.href) a.setAttribute("href", a.dataset.href);
    });
  }
  function setExtra(on) {
    extra = on;
    $$('[data-action="extra"]').forEach((b) => {
      b.setAttribute("aria-pressed", String(on));
      const l = $(".ar-l", b);
      if (l) { if (!l.dataset.off) l.dataset.off = l.textContent; l.textContent = on ? l.dataset.on : l.dataset.off; }
    });
  }
  const viewLabel = (v) => { const b = $(`[data-set-tailor="${v}"] .seg-l`); return b ? b.textContent : v; };
  function setTailor(v, fromUser) {
    if (!views.includes(v)) v = d.dataset.defaultTailor || views[0];
    const apply = () => {
      d.dataset.tailor = v;
      setExtra(false);
      arrange(v);
      syncBio();
      $$("[data-set-tailor]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.setTailor === v)));
      revealOnScreen();
    };
    if (!fromUser) return apply();
    $$("[data-set-tailor]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.setTailor === v)));
    swap([main], apply);
    store.set("tailor", v);
    try {
      const u = new URL(location.href);
      if (v === (d.dataset.defaultTailor || views[0])) u.searchParams.delete("for"); else u.searchParams.set("for", v);
      history.replaceState(null, "", u);
    } catch (e) {}
    play("mode"); toast(`Tailored for ${viewLabel(v).toLowerCase()}`);
  }
  if (views.length) setTailor(d.dataset.tailor, false); else syncBio();

  /* ── Updates: Work or Life ─────────────────────────────────────────────── */
  const newsList = $("#news .list");
  let setNewsTag = () => {};
  if (newsList && $("[data-newstag]")) {
    const items = $$(".news-item", newsList), N = +newsList.dataset.visible || 6;
    const btn = $(".fold-btn", newsList), row = btn && btn.closest(".fold-row");
    const apply = (tag) => {
      newsList.dataset.show = tag;
      let i = 0;
      items.forEach((el) => {
        const on = el.dataset.tag === tag;
        el.hidden = !on;
        if (on) { i++; el.classList.toggle("fold", i > N); }
      });
      const more = Math.max(0, i - N);
      if (row) {
        row.hidden = !more;
        const sp = $("span", btn);
        sp.dataset.label = `Show ${more} more ${more === 1 ? "update" : "updates"}`;
        if (!newsList.classList.contains("folded-open")) sp.textContent = sp.dataset.label;
      }
      $$("[data-newstag]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.newstag === tag)));
      revealOnScreen();
    };
    setNewsTag = (tag, fromUser) => {
      if (!fromUser) return apply(tag);
      $$("[data-newstag]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.newstag === tag)));
      swap([newsList], () => apply(tag));
    };
    apply("work");
  }

  /* ── Publications: by year or by type ───────────────────────────────────── */
  const pubList = $("#publications .list");
  let sortPubs = () => {};
  if (pubList) {
    const note = $(".foot-note", pubList);
    const byYear = Array.from(pubList.children).filter((n) => n !== note);
    const items = $$(".pub", pubList);
    const heads = new Map();
    sortPubs = (mode, fromUser) => {
      const frag = document.createDocumentFragment();
      if (mode === "type") {
        const groups = new Map();
        items.forEach((it) => { const g = +it.dataset.gi; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(it); });
        [...groups.keys()].sort((a, b) => a - b).forEach((g) => {
          let h = heads.get(g);
          if (!h) {
            h = document.createElement("h3"); h.className = "subhead rv in"; h.dataset.sub = "";
            h.textContent = $(".pn", groups.get(g)[0]).getAttribute("title"); heads.set(g, h);
          }
          frag.append(h, ...groups.get(g));
        });
      } else byYear.forEach((n) => frag.append(n));
      if (note) frag.append(note);
      const apply = () => {
        pubList.replaceChildren(frag); pubList.dataset.sort = mode;
        $$("[data-pubsort]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.pubsort === mode)));
        revealOnScreen();
      };
      if (fromUser) {
        $$("[data-pubsort]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.pubsort === mode)));
        swap([pubList], apply); store.set("pubsort", mode);
      } else apply();
    };
    if (store.get("pubsort") === "type") sortPubs("type", false);
  }

  /* ── Grants: live currency conversion ───────────────────────────────────── */
  const fxEl = $("#fx-data"), fxMenu = $(".fx-menu");
  let fx = { rates: { EUR: 1 }, date: "", list: ["EUR"], def: "EUR" };
  try { fx = { ...fx, ...JSON.parse(fxEl ? fxEl.textContent : "{}") }; } catch (e) {}
  let fxLive = false, curC = d.dataset.currency || fx.def, menuFor = null;
  const money = (v, c) => {
    try { return new Intl.NumberFormat("en-GB", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(v); }
    catch (e) { return `${Math.round(v).toLocaleString("en-GB")} ${c}`; }
  };
  const conv = (v, from, to) => {
    const a = from === "EUR" ? 1 : fx.rates[from], b = to === "EUR" ? 1 : fx.rates[to];
    return a && b ? (v / a) * b : null;
  };
  const fxDate = () => {
    try { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${fx.date}T12:00:00Z`)); }
    catch (e) { return fx.date; }
  };
  function renderFx() {
    $$("[data-fx]").forEach((b) => {
      const v = +b.dataset.v, c = b.dataset.c;
      const x = c === curC ? null : conv(v, c, curC);
      b.hidden = x === null;
      if (x !== null) $(".fx-v", b).textContent = money(x, curC);
      b.setAttribute("aria-label", `${money(v, c)}, about ${x === null ? "" : money(x, curC)}. Show in another currency`);
    });
    if (menuFor) fillMenu(menuFor);
  }
  function fillMenu(btn) {
    const v = +btn.dataset.v, c = btn.dataset.c;
    $(".fx-head", fxMenu).textContent = `${money(v, c)} in`;
    $(".fx-list", fxMenu).innerHTML = fx.list
      .filter((code) => code === c || conv(v, c, code) !== null)
      .map((code) => `<button type="button" class="fx-row" role="menuitemradio" aria-checked="${code === curC}" data-code="${code}"><span class="code">${code}</span><span class="val">${money(code === c ? v : conv(v, c, code), code)}</span>${CHECK}</button>`)
      .join("");
    $(".fx-note", fxMenu).textContent = `European Central Bank reference rates, ${fxDate()}${fxLive ? "" : ", last saved"}. Via frankfurter.dev.`;
  }
  // The menu follows its button while the page scrolls, and closes once the button leaves the screen.
  function placeMenu() {
    if (menuFor && !placePop(fxMenu, menuFor)) closeMenu();
  }
  function openMenu(btn) {
    closeMenu();
    menuFor = btn; fillMenu(btn); fxMenu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    placeMenu();
    const first = $('.fx-row[aria-checked="true"]', fxMenu) || $(".fx-row", fxMenu);
    if (first) first.focus({ preventScroll: true });
    play("open");
  }
  function closeMenu(refocus) {
    if (!menuFor) return;
    menuFor.setAttribute("aria-expanded", "false");
    if (refocus) menuFor.focus({ preventScroll: true });
    menuFor = null; fxMenu.hidden = true;
  }
  if (fxMenu && $("[data-fx]")) {
    renderFx();
    const KEY = "fx-rates";
    const cached = (() => { try { const j = JSON.parse(sessionStorage.getItem(KEY)); return j && Date.now() - j.t < 6 * 36e5 ? j : null; } catch (e) { return null; } })();
    const useRates = (j) => { fx.rates = { EUR: 1, ...j.rates }; fx.date = j.date; fxLive = true; renderFx(); };
    if (cached) useRates(cached);
    else {
      const go = () => fetch("https://api.frankfurter.dev/v1/latest?base=EUR", { mode: "cors" })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((j) => { if (!j || !j.rates) return; useRates(j); try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), date: j.date, rates: j.rates })); } catch (e) {} })
        .catch(() => {});
      (window.requestIdleCallback || ((f) => setTimeout(f, 600)))(go);
    }
    fxMenu.addEventListener("click", (e) => {
      const row = e.target.closest(".fx-row"); if (!row) return;
      curC = row.dataset.code; d.dataset.currency = curC; store.set("currency", curC);
      const back = menuFor; closeMenu(); renderFx(); if (back && !back.hidden) back.focus({ preventScroll: true });
      play("mode"); toast(`Amounts in ${curC}`);
    });
    fxMenu.addEventListener("keydown", (e) => {
      const rows = $$(".fx-row", fxMenu), i = rows.indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); rows[(i + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length].focus(); }
      else if (e.key === "Escape" || e.key === "Tab") closeMenu(e.key === "Escape");
    });
    document.addEventListener("pointerdown", (e) => { if (menuFor && !fxMenu.contains(e.target) && !menuFor.contains(e.target)) closeMenu(); });
    window.addEventListener("resize", () => closeMenu());
  }

  /* ── Actions ────────────────────────────────────────────────────────────── */
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch (err) {}
      ta.remove(); return ok;
    }
  }
  const cvName = () => { const s = $(`.cv-l [data-only="${d.dataset.tailor}"]`) || $(".cv-l span"); return s ? s.textContent : "CV"; };

  document.addEventListener("click", async (e) => {
    const t = e.target;
    const tailorBtn = t.closest("[data-set-tailor]");
    if (tailorBtn) {
      const other = $$("[data-set-tailor]").find((b) => b !== tailorBtn);
      if (tailorBtn.getAttribute("aria-checked") !== "true") setTailor(tailorBtn.dataset.setTailor, true);
      else if (other && !other.offsetParent) setTailor(other.dataset.setTailor, true);
      return;
    }
    const bioBtn = t.closest("[data-bio]");
    if (bioBtn) {
      if (bio[bioBtn.dataset.bio] !== bioBtn.dataset.val) {
        bio[bioBtn.dataset.bio] = bioBtn.dataset.val; store.set(`bio-${bioBtn.dataset.bio}`, bioBtn.dataset.val);
        $$(`[data-bio="${bioBtn.dataset.bio}"]`, bioSec).forEach((b) => b.setAttribute("aria-checked", String(b === bioBtn)));
        swap([$(".list", bioSec)], syncBio);
      }
      return;
    }
    const goBtn = t.closest("[data-go-tailor]");
    if (goBtn) { setTailor(goBtn.dataset.goTailor, true); return; }
    const newsBtn = t.closest("[data-newstag]");
    if (newsBtn) { if (newsBtn.getAttribute("aria-checked") !== "true") setNewsTag(newsBtn.dataset.newstag, true); return; }
    const sortBtn = t.closest("[data-pubsort]");
    if (sortBtn) { if (sortBtn.getAttribute("aria-checked") !== "true") sortPubs(sortBtn.dataset.pubsort, true); return; }
    const fxBtn = t.closest("[data-fx]");
    if (fxBtn) { if (menuFor === fxBtn) closeMenu(); else openMenu(fxBtn); return; }

    const a = t.closest("[data-action]");
    if (!a) return;
    const act = a.dataset.action;
    if (act === "theme") {
      const cur = d.dataset.theme || "system";
      setTheme(THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length], true);
    } else if (act === "sound") {
      const on = d.dataset.sound === "off";
      d.dataset.sound = on ? "on" : "off"; store.set("sound", d.dataset.sound); syncSound();
      play(on ? "on" : "off", true); toast(on ? "Sound on" : "Sound off");
    } else if (act === "print") {
      window.print();
    } else if (act === "extra") {
      const on = !extra;
      swap([main], () => { setExtra(on); arrange(d.dataset.tailor); revealOnScreen(); });
      play(on ? "open" : "mode");
      if (on) {
        const first = $("#main > .sec.outside");
        if (first) setTimeout(() => first.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }), 380);
      }
    } else if (act === "copy" || act === "copy-to") {
      const text = act === "copy-to" ? ($("#cf-to") || {}).value : a.dataset.copy;
      const ok = await copy(text || "");
      if (ok) { play("copy"); toast(act === "copy-to" ? `${text} copied` : (a.dataset.toast || "Copied")); } else toast("Copy failed");
    } else if (act === "authors") {
      const box = a.parentElement; const open = a.getAttribute("aria-expanded") !== "true";
      $(".au-s", box).hidden = open; $(".au-f", box).hidden = !open;
      a.setAttribute("aria-expanded", String(open)); a.textContent = open ? "(show fewer)" : `(show all ${a.dataset.n})`;
    } else if (act === "fold") {
      const list = a.closest(".list"); const open = !list.classList.contains("folded-open");
      list.classList.toggle("folded-open", open); a.setAttribute("aria-expanded", String(open));
      const span = $("span", a); if (span) span.textContent = open ? "Show fewer" : span.dataset.label;
      if (open) requestAnimationFrame(revealOnScreen);
    }
  });
  $$('[data-action="fold"] span').forEach((s) => { s.dataset.label = s.textContent; });

  // The saved PDF is titled after the view on screen.
  const baseTitle = document.title;
  // The saved PDF follows the view's print order (the usual CV order), then the
  // page goes back to its screen order.
  window.addEventListener("beforeprint", () => { document.title = `Arvind Srinivasan — ${cvName()}`; closeMenu(); arrange(d.dataset.tailor, true); $$("img[loading=lazy]").forEach((i) => { i.loading = "eager"; }); });
  window.addEventListener("afterprint", () => { document.title = baseTitle; arrange(d.dataset.tailor); });

  /* ── Recipient dropdown: the native select stays in the form, hidden ────── */
  const sel = $("#cf-to"), ddBtn = $(".dd-btn"), dd = $(".dd-menu");
  let ddOpen = false, placeDd = () => {};
  if (sel && ddBtn && dd) {
    const chip = sel.closest(".to-chip"), face = $("img", chip);
    const opts = Array.from(sel.options);
    d.classList.add("dd-on"); ddBtn.hidden = false; ddBtn.id = "cf-to-btn"; sel.tabIndex = -1;
    const lab = $("#cf-to-label"); if (lab) lab.htmlFor = "cf-to-btn";
    const syncDd = () => {
      const o = sel.selectedOptions[0] || opts[0];
      $(".dd-val", ddBtn).innerHTML = `${esc(o.value)}<span> · ${esc(o.dataset.label || "")}</span>`;
      $$(".dd-opt", dd).forEach((b) => b.setAttribute("aria-selected", String(+b.dataset.i === sel.selectedIndex)));
    };
    dd.innerHTML = opts.map((o, i) => `<button type="button" class="dd-opt" role="option" data-i="${i}" aria-selected="false">${face ? `<img src="${face.getAttribute("src")}" alt="">` : ""}<span class="dd-txt"><b>${esc(o.value)}</b><span>${esc(o.dataset.label || "")}</span></span>${CHECK}</button>`).join("");
    syncDd();
    placeDd = () => { if (ddOpen && !placePop(dd, chip, 256)) closeDd(); };
    const openDd = () => {
      ddOpen = true; dd.hidden = false; ddBtn.setAttribute("aria-expanded", "true"); placeDd();
      const cur = $('.dd-opt[aria-selected="true"]', dd) || $(".dd-opt", dd); if (cur) cur.focus({ preventScroll: true });
      play("open");
    };
    function closeDd(refocus) {
      if (!ddOpen) return;
      ddOpen = false; dd.hidden = true; ddBtn.setAttribute("aria-expanded", "false");
      if (refocus) ddBtn.focus({ preventScroll: true });
    }
    ddBtn.addEventListener("click", () => (ddOpen ? closeDd() : openDd()));
    ddBtn.addEventListener("keydown", (e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); openDd(); } });
    dd.addEventListener("click", (e) => {
      const b = e.target.closest(".dd-opt"); if (!b) return;
      if (sel.selectedIndex !== +b.dataset.i) { sel.selectedIndex = +b.dataset.i; sel.dispatchEvent(new Event("change", { bubbles: true })); }
      syncDd(); closeDd(true);
    });
    dd.addEventListener("keydown", (e) => {
      const rows = $$(".dd-opt", dd), i = rows.indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); rows[(i + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length].focus(); }
      else if (e.key === "Escape" || e.key === "Tab") closeDd(e.key === "Escape");
    });
    document.addEventListener("pointerdown", (e) => { if (ddOpen && !dd.contains(e.target) && !chip.contains(e.target)) closeDd(); });
    sel.addEventListener("change", syncDd);
    window.addEventListener("resize", () => closeDd());
  }

  /* ── Contact: a compose window ──────────────────────────────────────────── */
  const form = $("#contact-form");
  if (form) {
    const status = $(".form-status", form), submit = $('button[type="submit"]', form), to = $("#cf-to", form);
    const say = (msg, kind) => { status.textContent = msg; status.className = `form-status${kind ? " " + kind : ""}`; };
    const box = (el) => el.closest(".mail-row") || el;
    form.addEventListener("input", (e) => { box(e.target).classList.remove("invalid"); e.target.removeAttribute("aria-invalid"); });
    if (to) to.addEventListener("change", () => { play("mode"); say(""); });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fields = $$("input[required], textarea[required]", form);
      const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
      const bad = fields.filter((el) => !el.value.trim() || (el.type === "email" && !looksLikeEmail(el.value)));
      const badBoxes = new Set(bad.map(box));
      fields.forEach((el) => { if (bad.includes(el)) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid"); });
      new Set(fields.map(box)).forEach((b) => b.classList.toggle("invalid", badBoxes.has(b)));
      if (bad.length) {
        const el = bad[0];
        say(el.name === "email" ? (el.value ? "Check your email address." : "Add your email address.") : el.name === "name" ? "Add your name." : "Write a message.", "err");
        el.focus(); return;
      }
      const data = Object.fromEntries(new FormData(form));
      const opt = to ? to.selectedOptions[0] : null;
      const dest = opt ? opt.value : "", key = opt ? opt.dataset.key : "", label = opt ? opt.dataset.label : "";
      const subject = (data.subject || "").trim() || form.dataset.subject || "Message from arvindchee.nu";
      if (data.botcheck) { form.reset(); say("Sent.", "ok"); return; }
      if (form.dataset.preview) { say(`This preview doesn't send. On the site, it goes to ${dest}.`); return; }
      const endpoint = form.dataset.endpoint || "";
      const canPost = key ? !!endpoint : !!endpoint && !/web3forms/.test(endpoint);
      if (!canPost) {
        const body = `${data.message}\n\n${data.name} <${data.email}>`;
        location.href = `mailto:${dest}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        say(`Your mail app should open, addressed to ${dest}.`);
        return;
      }
      submit.disabled = true; say("Sending…");
      try {
        const payload = { name: data.name, email: data.email, subject, message: data.message, from_name: "arvindchee.nu", recipient: label };
        if (key) payload.access_key = key;
        const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) throw new Error(json.message || res.status);
        form.reset(); play("copy"); say(`Sent to ${dest}. I'll reply to ${data.email}.`, "ok");
      } catch (err) {
        say(`It didn't send. Write to ${dest} instead.`, "err");
      } finally { submit.disabled = false; }
    });
  }

  /* ── Headroom: the bar hides on the way down and returns on the way up ──── */
  // The floating email and back-to-top buttons show on the way up, past the
  // introduction, and step aside once the contact form or the footer is on screen.
  const bar = $("#topbar"), floats = $(".floats");
  // The portrait and name appear in the bar once the large name has scrolled away.
  const bigName = $(".hero .name");
  const nameIO = bar && bigName && "IntersectionObserver" in window
    ? new IntersectionObserver(([e]) => bar.classList.toggle("scrolled", !e.isIntersecting), { rootMargin: "-64px 0px 0px 0px" })
    : null;
  if (nameIO) nameIO.observe(bigName);
  // The bar shows the full name when it fits, the first name when it doesn't, and none when even that won't fit.
  const bn = $(".brand-name");
  const fitName = () => {
    if (!bn) return;
    bn.classList.remove("first", "none");
    if (bn.scrollWidth > bn.clientWidth + 1) bn.classList.add("first");
    if (bn.scrollWidth > bn.clientWidth + 1) { bn.classList.remove("first"); bn.classList.add("none"); }
  };
  fitName();
  if (bn && "ResizeObserver" in window) new ResizeObserver(fitName).observe(bar);
  let lastY = window.scrollY, travel = 0, pinned = true, nearEnd = false, ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = window.scrollY, end = d.scrollHeight - innerHeight, dy = y - lastY;
    lastY = y;
    if (dy && Math.sign(dy) !== Math.sign(travel)) travel = 0;
    travel += dy;
    if (y < 96) pinned = true;
    else if (travel > 14) pinned = false;
    else if (travel < -10) pinned = true;
    d.classList.toggle("at-top", y < 4);
    d.classList.toggle("at-end", y >= end - 4);
    d.classList.toggle("unpinned", !pinned);
    if (bar && !nameIO) bar.classList.toggle("scrolled", y > 140);
    const show = pinned && y > innerHeight * 0.75 && !nearEnd;
    d.classList.toggle("show-floats", show);
    if (floats) floats.inert = !show;
  };
  const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } };
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue, { passive: true });
  if ("IntersectionObserver" in window) {
    const seen = new Set();
    const endIO = new IntersectionObserver((es) => {
      es.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)));
      nearEnd = seen.size > 0; queue();
    }, { rootMargin: "0px 0px -10% 0px" });
    [$("#contact-form"), $("#footer")].forEach((el) => el && endIO.observe(el));
  }
  onScroll();
  $$('a[href="#contact"]').forEach((a) => a.addEventListener("click", () => setTimeout(() => { const f = $("#cf-name"); if (f) f.focus({ preventScroll: true }); }, 600)));

  /* ── Local time ─────────────────────────────────────────────────────────── */
  const clocks = $$("[data-clock]");
  if (clocks.length) {
    const tz = d.dataset.tz || "Europe/Copenhagen";
    let fmt;
    try { fmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", timeZoneName: "short" }); } catch (e) {}
    const tickClock = () => { if (fmt) { const s = `${fmt.format(new Date())} local time`; clocks.forEach((c) => { c.textContent = s; }); } };
    tickClock(); setInterval(tickClock, 30000);
  }

  /* ── Links inside the page: go to the entry, light it up, offer a way back ─ */
  const backChip = $(".back-chip");
  let backFrom = null;
  const secName = (el) => {
    const sec = el && el.closest(".sec, .hero");
    if (!sec) return "";
    if (sec.classList.contains("hero")) return "introduction";
    const l = $(".sec-label span:last-child", sec);
    return l ? l.textContent.trim() : "";
  };
  const flash = (el) => { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 2300); };
  function goTo(target, from) {
    try { history.replaceState({ ...(history.state || {}), y: window.scrollY }, ""); history.pushState({ to: target.id }, "", `#${target.id}`); } catch (e) {}
    backFrom = { y: window.scrollY, el: from, name: secName(from) };
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    flash(target);
    if (backChip) { $("span", backChip).textContent = backFrom.name ? `Back to ${backFrom.name}` : "Back"; backChip.hidden = false; }
  }
  const hideBack = () => { if (backChip) backChip.hidden = true; backFrom = null; };
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = decodeURIComponent(a.getAttribute("href").slice(1));
    if (!id || id === "top" || id === "main" || id === "contact" || a.closest(".topbar, .floats, .skip")) return;
    const target = document.getElementById(id);
    if (!target || target.closest("[hidden]")) return;
    e.preventDefault();
    goTo(target, a);
  });
  window.addEventListener("popstate", (e) => {
    const st = e.state || {};
    if (typeof st.y === "number") {
      window.scrollTo({ top: st.y, behavior: reduced ? "auto" : "smooth" });
      if (backFrom && backFrom.el) { backFrom.el.focus({ preventScroll: true }); flash(backFrom.el.closest(".item, p, li") || backFrom.el); }
      hideBack();
    } else if (st.to && document.getElementById(st.to)) {
      const t = document.getElementById(st.to); t.scrollIntoView({ block: "center" }); flash(t);
    }
  });
  if (backChip) backChip.addEventListener("click", () => {
    if (history.state && history.state.to) history.back();
    else if (backFrom) { window.scrollTo({ top: backFrom.y, behavior: reduced ? "auto" : "smooth" }); hideBack(); }
  });
  // Arriving with #id in the address lights that entry up.
  if (location.hash.length > 1) {
    const t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (t && t.classList.contains("item")) setTimeout(() => { t.scrollIntoView({ block: "center" }); flash(t); }, 300);
  }

  /* ── Keyboard: hold ⌘ or Ctrl to show codes on everything you can use ───── */
  // Type a code to click it, Shift and the code to focus it, a number to jump to
  // a section, the arrow keys (or J and K) to move between sections, Esc to close.
  const kb = $(".kb"), kbLayer = kb && $(".kb-layer", kb);
  const ALPHA = "asdfghlqweruiopzxcvbnmty";
  let kbOn = false, kbTyped = "", kbTargets = [], holdKey = null, holdTimer = 0, kbRedraw = 0;
  const typing = () => { const a = document.activeElement; return a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) && !a.readOnly; };
  const visibleSecs = () => $$("#main > .sec:not([hidden])");
  const usable = (el) => {
    if (el.closest("[hidden], [inert], .kb") || el.disabled || el.tabIndex < 0) return false;
    const r = el.getBoundingClientRect();
    // Entries tucked under the top bar are out of sight; the bar's own controls are not.
    const inBar = !!el.closest(".topbar"), barB = !inBar && bar && !d.classList.contains("unpinned") ? bar.getBoundingClientRect().bottom : 0;
    if (!r.width || !r.height || r.bottom < barB + 4 || r.top > innerHeight - 8 || r.right < 0 || r.left > innerWidth) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && +cs.opacity > 0.05;
  };
  const codesFor = (n) => {
    if (n <= ALPHA.length) return ALPHA.slice(0, n).split("");
    const out = [];
    for (const a of ALPHA) for (const b of ALPHA) { out.push(a + b); if (out.length === n) return out; }
    return out;
  };
  function drawKb() {
    if (!kbOn) return;
    kbTyped = "";
    const els = $$('a[href], button, input:not(.hp):not([type="hidden"]), textarea, [tabindex="0"]').filter(usable);
    const codes = codesFor(els.length);
    kbTargets = els.map((el, i) => ({ el, code: codes[i] }));
    const frag = document.createDocumentFragment();
    kbTargets.forEach((t) => {
      const r = t.el.getBoundingClientRect(), h = document.createElement("span");
      h.className = "kb-hint"; h.textContent = t.code; h.style.left = `${Math.max(4, r.left)}px`; h.style.top = `${Math.max(4, r.top)}px`;
      t.hint = h; frag.append(h);
    });
    visibleSecs().forEach((sec, i) => {
      if (i > 9) return;
      const head = $(".sec-label", sec); if (!head) return;
      const r = head.getBoundingClientRect(); if (r.bottom < 56 || r.top > innerHeight) return;
      const h = document.createElement("span");
      h.className = "kb-hint kb-sec"; h.dataset.c = sec.dataset.c || ""; h.textContent = String((i + 1) % 10);
      h.style.left = `${Math.max(28, r.left)}px`; h.style.top = `${r.top}px`; frag.append(h);
    });
    kbLayer.replaceChildren(frag);
  }
  function openKb() { if (!kb || kbOn) return; kbOn = true; kb.hidden = false; drawKb(); play("open"); }
  function closeKb() { if (!kbOn) return; kbOn = false; kb.hidden = true; kbLayer.replaceChildren(); kbTargets = []; kbTyped = ""; }
  const jumpTo = (sec) => {
    if (!sec) return;
    const head = $(".sec-head", sec) || sec;
    head.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    const label = $(".sec-label", sec); if (label) { label.tabIndex = -1; label.focus({ preventScroll: true }); }
  };
  const currentSec = () => { const secs = visibleSecs(); let cur = -1; secs.forEach((s, i) => { if (s.getBoundingClientRect().top < innerHeight * 0.35) cur = i; }); return cur; };
  if (kb) {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Control" || e.key === "Meta") {
        if (!e.repeat && !kbOn && !typing()) { holdKey = e.key; clearTimeout(holdTimer); holdTimer = setTimeout(() => { if (holdKey) openKb(); }, 320); }
        return;
      }
      if (holdKey) { clearTimeout(holdTimer); holdKey = null; }
      if (!kbOn) return;
      if (e.metaKey || e.ctrlKey || e.altKey) { closeKb(); return; } // a browser shortcut, not a code
      const k = e.key;
      if (k === "Escape") { e.preventDefault(); closeKb(); return; }
      const secs = visibleSecs();
      if (/^[0-9]$/.test(k)) { e.preventDefault(); jumpTo(secs[(+k + 9) % 10]); return; }
      if (k === "ArrowDown" || k === "j" || k === "J") { e.preventDefault(); jumpTo(secs[Math.min(secs.length - 1, currentSec() + 1)]); return; }
      if (k === "ArrowUp" || k === "k" || k === "K") { e.preventDefault(); jumpTo(secs[Math.max(0, currentSec() - (currentSec() >= 0 && secs[currentSec()].getBoundingClientRect().top > -40 ? 1 : 0))]); return; }
      if (k === "Backspace") { e.preventDefault(); kbTyped = kbTyped.slice(0, -1); }
      else if (/^[a-z]$/i.test(k)) { e.preventDefault(); kbTyped += k.toLowerCase(); }
      else return;
      const hit = kbTargets.filter((t) => t.code.startsWith(kbTyped));
      if (!hit.length) { kbTyped = ""; }
      kbTargets.forEach((t) => {
        const on = !kbTyped || t.code.startsWith(kbTyped);
        t.hint.classList.toggle("off", !on);
        t.hint.innerHTML = on && kbTyped ? `<b>${kbTyped}</b>${t.code.slice(kbTyped.length)}` : t.code;
      });
      const exact = kbTargets.find((t) => t.code === kbTyped);
      if (exact) {
        const el = exact.el; closeKb();
        el.focus({ preventScroll: true });
        if (!e.shiftKey && !/^(INPUT|TEXTAREA)$/.test(el.tagName)) el.click();
      }
    }, true);
    document.addEventListener("keyup", (e) => { if (e.key === holdKey) { clearTimeout(holdTimer); holdKey = null; } });
    window.addEventListener("blur", () => { clearTimeout(holdTimer); holdKey = null; });
    document.addEventListener("pointerdown", () => closeKb());
    const redraw = () => { if (!kbOn) return; kbLayer.replaceChildren(); clearTimeout(kbRedraw); kbRedraw = setTimeout(drawKb, 160); };
    window.addEventListener("scroll", redraw, { passive: true });
    window.addEventListener("resize", redraw, { passive: true });
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && backChip && !backChip.hidden && !kbOn) hideBack(); });

  /* ── Analytics: Google Tag Manager, only after a yes ─────────────────────── */
  // Nothing loads from Google and no cookie is set until someone agrees. The answer
  // is remembered in this browser; "Cookie settings" in the footer asks again.
  // Only the live site sends anything; previews and local copies never do.
  (function () {
    const GTM = d.dataset.gtm, HOST = d.dataset.gtmHost, box = $(".consent");
    if (!GTM || !box) return;
    const KEY = "analytics";
    const choice = () => store.get(KEY);
    let started = false;
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    function start() {
      if (started) { gtag("consent", "update", { analytics_storage: "granted" }); return; }
      started = true;
      gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      gtag("js", new Date());
      window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      if (location.hostname !== HOST && location.hostname !== `www.${HOST}`) return;
      const tag = document.createElement("script");
      tag.async = true; tag.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM)}`;
      document.head.appendChild(tag);
    }
    function stop() {
      if (started) gtag("consent", "update", { analytics_storage: "denied" });
      document.cookie.split(";").forEach((c) => {
        const name = c.split("=")[0].trim();
        if (!/^_g(a|id|at)/.test(name)) return;
        document.cookie = `${name}=; Max-Age=0; path=/; domain=${location.hostname}`;
        document.cookie = `${name}=; Max-Age=0; path=/; domain=.${location.hostname.replace(/^www\./, "")}`;
        document.cookie = `${name}=; Max-Age=0; path=/`;
      });
    }
    // A handful of crumbs from the button that said yes.
    function crumbs(from) {
      if (reduced || !from) return;
      const r = from.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (let i = 0; i < 12; i++) {
        const c = document.createElement("i"); c.className = "crumb";
        c.style.left = `${cx}px`; c.style.top = `${cy}px`; document.body.appendChild(c);
        const a = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 50;
        c.animate([{ transform: "translate(-50%,-50%) rotate(0)", opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist + 24}px)) rotate(${Math.random() * 360}deg)`, opacity: 0 }], { duration: 600 + Math.random() * 300, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => c.remove();
      }
    }
    let returnTo = null;
    function ask(from) {
      returnTo = from || null;
      box.hidden = false; d.classList.add("consent-open");
      if (from) $("[data-consent=yes]", box).focus();
    }
    function done(v, btn) {
      store.set(KEY, v);
      if (v === "yes") { play("cookie"); crumbs(btn); }
      box.hidden = true; d.classList.remove("consent-open");
      if (v === "yes") start(); else stop();
      toast(v === "yes" ? "Thanks. Analytics on" : "No cookies. Analytics off");
      if (returnTo && returnTo.isConnected) returnTo.focus({ preventScroll: true });
    }
    box.addEventListener("click", (e) => { const b = e.target.closest("[data-consent]"); if (b) done(b.dataset.consent, b); });
    $$("[data-cookie-settings]").forEach((b) => b.addEventListener("click", () => ask(b)));
    if (choice() === "yes") start();
    else if (choice() === null) setTimeout(() => ask(), 900);
  })();

  /* ── Updates: the sparkle leaves after two months, even before a rebuild ── */
  $$("[data-new]").forEach((b) => {
    const m = String(b.dataset.new).match(/^(\d{4})-(\d{1,2})/); if (!m) return;
    const now = new Date(), age = (now.getFullYear() - +m[1]) * 12 + (now.getMonth() + 1 - +m[2]);
    if (age >= 2) b.remove();
  });

  /* ── Talks & travel: a map that moves through time ────────────────────── */
  // The slider runs from the first place to the last. Between two places the
  // camera glides, pulling back for long trips, and the route draws as it goes.
  const mapEl = $("[data-map]");
  if (mapEl) {
    const svg = $(".map-svg", mapEl), view = $(".map-view", mapEl), range = $(".map-range", mapEl), playBtn = $(".map-play", mapEl);
    const pins = $$(".pin", mapEl), cards = $$(".map-card", mapEl);
    const routes = new Map($$(".map-route", mapEl).map((r) => [+r.dataset.i, r]));
    const plane = $(".map-plane", mapEl), planeIcon = plane && $("svg", plane);
    // Track colours: the stretch leading up to each place is that place's colour.
    {
      const tc = $$(".tick", mapEl).map((tk) => `var(--c-${tk.dataset.c || "fuchsia"})`);
      // Ticks are inset by the thumb's radius (as the thumb's centre is), so the stops are too.
      // Each boundary sits at the right edge of a dot (centre + .25rem), so a dot never shows two colours.
      const pc = (k) => `calc(.8125rem + (100% - 1.125rem) * ${(k / Math.max(1, tc.length - 1)).toFixed(5)})`;
      const stops = tc.slice(1).map((c, k) => `${c} ${k ? pc(k) : "0%"} ${k === tc.length - 2 ? "100%" : pc(k + 1)}`);
      if (stops.length) range.style.setProperty("--segs", `linear-gradient(90deg,${stops.join(",")})`);
    }
    // Route lengths, measured on first use (the map may not be rendered at load).
    const lens = new Map();
    const lenOf = (i, r) => { if (!lens.get(i)) { try { lens.set(i, r.getTotalLength()); } catch (e) { lens.set(i, 0); } } return lens.get(i); };
    const num = (v) => (v === "" || v === undefined ? null : +v);
    const ev = pins.map((p) => ({ x: +p.dataset.x, y: +p.dataset.y, ox: num(p.dataset.ox), oy: num(p.dataset.oy), el: p }));
    const N = ev.length;
    const MIN_W = 70;
    const frames = ev.map((e) => {
      const xs = [e.x], ys = [e.y];
      if (e.ox !== null) { xs.push(e.ox); ys.push(e.oy); }
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: Math.max(MIN_W, (x1 - x0) * 1.6), h: Math.max(MIN_W * 0.6, (y1 - y0) * 2.2) };
    });
    let t = N - 1, raf = 0, playing = false, tween = null, lastCur = null, scrubbing = false;
    const smooth = (f) => f * f * (3 - 2 * f);
    function camera(tt) {
      const i = Math.max(0, Math.min(N - 1, Math.floor(tt))), f = Math.min(1, tt - i);
      const a = frames[i], b = frames[Math.min(N - 1, i + 1)], e = smooth(f);
      const cx = a.cx + (b.cx - a.cx) * e, cy = a.cy + (b.cy - a.cy) * e;
      const far = Math.hypot(b.cx - a.cx, b.cy - a.cy) / Math.max(a.w, b.w);
      const bump = 1 + Math.sin(Math.PI * f) * Math.min(1.4, far * 0.9);
      let w = (a.w + (b.w - a.w) * e) * bump, h = (a.h + (b.h - a.h) * e) * bump;
      const ar = (view.clientWidth || 16) / (view.clientHeight || 10);
      if (w / h < ar) w = h * ar; else h = w / ar;
      // The place card sits top left, so the places being shown sit a little right of and below centre.
      return { x: cx - w / 2 - w * 0.06, y: cy - h / 2 - h * 0.05, w, h };
    }
    function render() {
      const vb = camera(t), W = view.clientWidth, H = view.clientHeight;
      svg.setAttribute("viewBox", `${vb.x.toFixed(2)} ${vb.y.toFixed(2)} ${vb.w.toFixed(2)} ${vb.h.toFixed(2)}`);
      svg.style.setProperty("--k", (vb.w / (W || 1)).toFixed(4));
      const cur = Math.min(N - 1, Math.round(t));
      ev.forEach((e, i) => {
        // `translate` composes before `scale`, so the highlighted pin grows in place.
        e.el.style.translate = `${((e.x - vb.x) / vb.w) * W}px ${((e.y - vb.y) / vb.h) * H}px`;
        const shown = t >= i - 0.3;
        e.el.classList.toggle("on", shown); e.el.classList.toggle("now", i === cur);
        e.el.tabIndex = shown ? 0 : -1;
        const r = routes.get(i);
        if (r) {
          const pr = Math.max(0, Math.min(1, t - (i - 1)));
          r.style.strokeDashoffset = String(1 - pr); r.style.opacity = pr > 0 ? "" : "0";
          r.classList.toggle("past", i < cur);
        }
      });
      // The plane flies the route being drawn, if any.
      if (plane) {
        const i = Math.ceil(t - 1e-6), r = routes.get(i), pr = t - (i - 1);
        const flying = !!r && pr > 0.02 && pr < 0.97 && lenOf(i, r) > 0;
        if (flying) {
          const L = lens.get(i), p = r.getPointAtLength(pr * L), q = r.getPointAtLength(Math.min(L, pr * L + L * 0.02));
          plane.style.translate = `${((p.x - vb.x) / vb.w) * W}px ${((p.y - vb.y) / vb.h) * H}px`;
          planeIcon.style.rotate = `${Math.atan2(q.y - p.y, q.x - p.x)}rad`;
          if (plane.dataset.c !== r.dataset.c) plane.dataset.c = r.dataset.c;
        }
        plane.classList.toggle("on", flying);
      }
      if (cur !== lastCur) { if (lastCur !== null && scrubbing) sound("detent"); lastCur = cur; }
      cards.forEach((c, i) => { c.hidden = i !== cur; });
      range.value = String(t);
      range.style.setProperty("--p", `calc(.5625rem + (100% - 1.125rem) * ${(t / (N - 1)).toFixed(5)})`);
      const pc = pins[cur];
      range.setAttribute("aria-valuetext", pc ? pc.getAttribute("aria-label") : "");
    }
    const queueRender = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); };
    function stop() { playing = false; tween = null; mapEl.classList.remove("playing"); playBtn.setAttribute("aria-label", "Replay the timeline"); }
    // Glide to an event; `then` runs on arrival.
    function glide(to, ms, then) {
      const from = t, start = performance.now(), dur = reduced ? 0 : ms * Math.max(1, Math.abs(to - from)) ** 0.6;
      if (Math.abs(to - from) > 0.25) { if (dur > 200) sound("fly", false, Math.min(3, dur / 1000)); }
      tween = (now) => {
        const f = dur ? Math.min(1, (now - start) / dur) : 1;
        t = from + (to - from) * f;
        render();
        if (f < 1) return requestAnimationFrame((n) => tween && tween(n));
        tween = null;
        if (Math.abs(to - from) > 0.25) sound("land");
        if (then) then();
      };
      requestAnimationFrame((n) => tween && tween(n));
    }
    function play() {
      if (t >= N - 1 - 1e-3) t = 0;
      playing = true; mapEl.classList.add("playing"); playBtn.setAttribute("aria-label", "Pause");
      const next = () => {
        if (!playing) return;
        const k = Math.floor(t + 1e-6) + 1;
        if (k > N - 1) { stop(); return; }
        glide(k, 1300, () => setTimeout(() => { if (playing) next(); }, reduced ? 900 : 650));
      };
      render(); setTimeout(next, 350);
    }
    playBtn.addEventListener("click", () => { if (playing) stop(); else { play(); } });
    range.addEventListener("input", () => { stop(); scrubbing = true; t = +range.value; queueRender(); });
    range.addEventListener("change", () => { scrubbing = false; });
    range.addEventListener("pointerup", () => { scrubbing = false; });
    range.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
      e.preventDefault(); stop();
      const k = e.key === "Home" ? 0 : e.key === "End" ? N - 1 : Math.max(0, Math.min(N - 1, Math.round(t) + (e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 1)));
      glide(k, 700);
    });
    pins.forEach((p, i) => p.addEventListener("click", () => { stop(); glide(i, 800); }));
    $$(".tick", mapEl).forEach((tk, i) => tk.addEventListener("click", () => { stop(); glide(i, 800); }));
    if ("ResizeObserver" in window) new ResizeObserver(queueRender).observe(view);
    render();

    // Year labels under the slider never overlap: left to right, a label that
    // would touch the last one shown is hidden; the latest year always shows.
    const labels = $$(".tick b", mapEl);
    const fitTicks = () => {
      labels.forEach((l) => { l.style.visibility = ""; });
      const shown = [];
      labels.forEach((l) => {
        const r = l.getBoundingClientRect(), prev = shown[shown.length - 1];
        if (prev && r.left < prev.r.right + 3) l.style.visibility = "hidden"; else shown.push({ l, r });
      });
      const last = labels[labels.length - 1];
      if (last && last.style.visibility === "hidden" && shown.length > 1) {
        const lr = last.getBoundingClientRect();
        while (shown.length > 1 && shown[shown.length - 1].r.right + 3 > lr.left) shown.pop().l.style.visibility = "hidden";
        last.style.visibility = "";
      }
    };
    if (labels.length) {
      fitTicks();
      if ("ResizeObserver" in window) new ResizeObserver(fitTicks).observe($(".map-track", mapEl));
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTicks);
    }
  }

  /* ── Scroll progress in the colour of the section in view ───────────────
     The current section is the last one whose top has passed a third of the
     way down the window; before the first, the bar keeps the link colour. */
  const pbar = $(".progress i");
  if (pbar) {
    let pq = false;
    const paint = () => {
      pq = false;
      const line = innerHeight / 3;
      let c = "";
      $$("#main .sec, .sec.contact").forEach((s) => {
        if (!s.hidden && s.offsetParent && s.getBoundingClientRect().top <= line) c = s.dataset.c || "";
      });
      if (pbar.dataset.c !== c) { if (c) pbar.dataset.c = c; else delete pbar.dataset.c; }
    };
    const qPaint = () => { if (!pq) { pq = true; requestAnimationFrame(paint); } };
    addEventListener("scroll", qPaint, { passive: true });
    addEventListener("resize", qPaint);
    paint();
  }

  /* ── Scroll progress for browsers without scroll-driven animations ──────── */
  if (!(window.CSS && CSS.supports && CSS.supports("animation-timeline: scroll()"))) {
    const bar = pbar;
    let queued = false;
    const paint = () => {
      queued = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      if (bar) bar.style.setProperty("--sp", max > 0 ? Math.min(1, scrollY / max).toFixed(4) : "0");
    };
    addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(paint); } }, { passive: true });
    addEventListener("resize", paint);
    paint();
  }

  /* ── Image strips: edge blur while there is more to scroll, arrow buttons ── */
  $$("[data-gal]").forEach((w) => {
    const s = $(".gallery", w);
    const upd = () => {
      const max = s.scrollWidth - s.clientWidth;
      w.classList.toggle("can-l", s.scrollLeft > 2);
      w.classList.toggle("can-r", s.scrollLeft < max - 2);
    };
    s.addEventListener("scroll", upd, { passive: true });
    if ("ResizeObserver" in window) new ResizeObserver(upd).observe(s);
    $$("img", s).forEach((im) => im.complete || im.addEventListener("load", upd, { once: true }));
    $$(".g-nav", w).forEach((b) => b.addEventListener("click", () => {
      const step = Math.max(s.clientWidth * 0.75, 160) * Number(b.dataset.dir);
      s.scrollBy({ left: step, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }));
    upd();
  });

  /* ── Image viewer for entries with several pictures ─────────────────────── */
  const lb = $(".lightbox");
  if (lb && typeof lb.showModal === "function") {
    const img = $("img", lb), cap = $(".lb-cap", lb), num = $(".lb-n", lb), fig = $("figure", lb);
    let set = [], idx = 0, x0 = null;
    const show = (i) => {
      idx = (i + set.length) % set.length;
      const b = set[idx];
      img.src = b.dataset.src; img.alt = (b.getAttribute("aria-label") || "").replace(/^View image \d+ of \d+:?\s*/, "");
      cap.textContent = b.dataset.cap || ""; num.textContent = `${idx + 1} / ${set.length}`;
      $(".lb-prev", lb).hidden = $(".lb-next", lb).hidden = set.length < 2;
      fig.style.animation = "none"; void fig.offsetWidth; fig.style.animation = "";
    };
    document.addEventListener("click", (e) => {
      const g = e.target.closest(".g-item"); if (!g) return;
      set = $$(".g-item", g.parentElement); show(set.indexOf(g)); lb.showModal(); play("open");
    });
    $(".lb-prev", lb).addEventListener("click", () => show(idx - 1));
    $(".lb-next", lb).addEventListener("click", () => show(idx + 1));
    $(".lb-close", lb).addEventListener("click", () => lb.close());
    lb.addEventListener("click", (e) => { if (e.target === lb || e.target === fig) lb.close(); });
    lb.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") show(idx - 1); else if (e.key === "ArrowRight") show(idx + 1); });
    lb.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
    lb.addEventListener("pointerup", (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 50 && set.length > 1) show(idx + (e.clientX < x0 ? 1 : -1)); x0 = null; });
  }

  /* ── QR code on link hover (mouse only, loaded on first use) ────────────── */
  const pop = $(".qr-pop");
  const canHover = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (pop && canHover) {
    const code = $(".qr-code", pop), qcap = $(".qr-cap", pop);
    const base = d.dataset.base || location.origin;
    let lib = null, timer = 0, current = null;
    const load = () => lib || (lib = new Promise((res, rej) => {
      if (window.qrcode) return res(window.qrcode);
      const sc = document.createElement("script");
      sc.src = "assets/vendor/qrcode.min.js"; sc.async = true;
      sc.onload = () => res(window.qrcode); sc.onerror = rej;
      document.head.appendChild(sc);
    }));
    const target = (el) => {
      const a = el && el.closest && el.closest("a[href]");
      if (!a || a.closest(".topbar,.skip,.floats,.no-qr")) return null;
      const h = a.getAttribute("href");
      if (!h || h.startsWith("#") || h.startsWith("javascript:")) return null;
      return a;
    };
    const hide = () => { clearTimeout(timer); current = null; pop.classList.remove("on"); };
    async function show(a) {
      let text, label;
      const h = a.getAttribute("href");
      if (h.startsWith("mailto:")) { text = h; label = h.slice(7); }
      else {
        try { const u = new URL(h, base); text = u.href; label = (u.host + u.pathname).replace(/^www\./, "").replace(/\/$/, ""); }
        catch (e) { return; }
      }
      let q;
      try { q = await load(); } catch (e) { return; }
      if (current !== a || !q) return;
      const qr = q(0, "M"); qr.addData(text); qr.make();
      code.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
      qcap.textContent = label;
      const r = a.getBoundingClientRect(), w = pop.offsetWidth || 148, hgt = pop.offsetHeight || 170;
      const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
      let top = r.top - hgt - 10;
      if (top < 64) top = r.bottom + 10;
      pop.style.left = `${Math.round(left)}px`; pop.style.top = `${Math.round(top)}px`;
      pop.classList.add("on");
    }
    document.addEventListener("pointerover", (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      const a = target(e.target); if (!a || a === current) return;
      hide(); current = a;
      timer = setTimeout(() => show(a), 420);
    });
    document.addEventListener("pointerout", (e) => {
      const a = target(e.target); if (!a) return;
      if (e.relatedTarget && a.contains(e.relatedTarget)) return;
      hide();
    });
    window.addEventListener("scroll", hide, { passive: true });
    document.addEventListener("pointerdown", hide);
  }
  window.addEventListener("scroll", () => { if (menuFor) placeMenu(); placeDd(); }, { passive: true });

})();
