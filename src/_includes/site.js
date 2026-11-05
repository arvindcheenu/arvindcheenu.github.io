(() => {
  "use strict";
  const d = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const MODES = ["research", "industry"];
  const DEFAULT_MODE = d.dataset.defaultMode || "research";

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
  };
  const play = (name, force) => {
    if (!force && d.dataset.sound === "off") return;
    try { sfx[name] && sfx[name](); } catch (e) {}
  };

  // Every tactile control clicks on press; keyboard presses click on activation.
  const tactile = (el) => el && el.closest(".tac");
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

  /* ── CV mode ────────────────────────────────────────────────────────────── */
  function setMode(m, fromUser) {
    if (!MODES.includes(m)) return;
    d.dataset.mode = m;
    $$("[data-set-mode]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.setMode === m)));
    if (!fromUser) return;
    store.set("cv-mode", m);
    try {
      const u = new URL(location.href);
      if (m === DEFAULT_MODE) u.searchParams.delete("cv"); else u.searchParams.set("cv", m);
      history.replaceState(null, "", u);
    } catch (e) {}
    play("mode");
    const label = $(`[data-set-mode="${m}"] span`);
    toast(`${label ? label.textContent : m} view`);
  }
  setMode(d.dataset.mode, false);

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
  function syncSound() {
    if (soundBtn) soundBtn.setAttribute("aria-pressed", String(d.dataset.sound !== "off"));
  }
  syncSound();

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

  document.addEventListener("click", async (e) => {
    const modeBtn = e.target.closest("[data-set-mode]");
    if (modeBtn) { if (modeBtn.dataset.setMode !== d.dataset.mode) setMode(modeBtn.dataset.setMode, true); return; }
    const a = e.target.closest("[data-action]");
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
    } else if (act === "copy") {
      const ok = await copy(a.dataset.copy || "");
      if (ok) { play("copy"); toast(a.dataset.toast || "Copied"); } else toast("Copy failed");
    } else if (act === "fold") {
      const sec = a.closest(".body"); const open = !sec.classList.contains("folded-open");
      sec.classList.toggle("folded-open", open); a.setAttribute("aria-expanded", String(open));
      const span = $("span", a); if (span) span.textContent = open ? "Show fewer" : span.dataset.label;
    }
  });
  $$('[data-action="fold"] span').forEach((s) => { s.dataset.label = s.textContent; });

  // Printing titles the PDF after the mode on screen.
  const baseTitle = document.title;
  window.addEventListener("beforeprint", () => {
    const label = $(`[data-set-mode="${d.dataset.mode}"] span`);
    document.title = `Arvind Srinivasan — CV${label ? ` (${label.textContent})` : ""}`;
  });
  window.addEventListener("afterprint", () => { document.title = baseTitle; });

  /* ── Top bar border once the page scrolls ───────────────────────────────── */
  const bar = $("#topbar");
  const onScroll = () => bar && bar.classList.toggle("scrolled", window.scrollY > 120);
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ── Local time ─────────────────────────────────────────────────────────── */
  const clock = $("[data-clock]");
  if (clock) {
    const tz = d.dataset.tz || "Europe/Copenhagen";
    let fmt;
    try { fmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", timeZoneName: "short" }); } catch (e) {}
    const tickClock = () => { if (fmt) clock.textContent = `${fmt.format(new Date())} local time`; };
    tickClock(); setInterval(tickClock, 30000);
  }

  /* ── QR code on link hover (mouse only, loaded on first use) ────────────── */
  const pop = $(".qr-pop");
  const canHover = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (pop && canHover) {
    const code = $(".qr-code", pop), cap = $(".qr-cap", pop);
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
      if (!a || a.closest(".topbar,.skip,.no-qr")) return null;
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
      cap.textContent = label;
      const r = a.getBoundingClientRect(), w = pop.offsetWidth || 148, hgt = pop.offsetHeight || 170;
      let left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
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

  /* ── Icon fallback: if the icon font never loads, show text labels ──────── */
  window.addEventListener("load", () => setTimeout(() => {
    const i = $("i.fa-solid, i.fa-duotone");
    if (!i) return;
    const st = getComputedStyle(i, "::before").content;
    if (!st || st === "none" || st === "normal" || st === '""') d.classList.add("no-fa");
  }, 2500));
})();
