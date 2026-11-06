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
  };
  const play = (name, force) => {
    if (!force && d.dataset.sound === "off") return;
    try { sfx[name] && sfx[name](); } catch (e) {}
  };

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
  function arrange(v) {
    secs
      .map((s) => ({ s, o: +s.getAttribute(`data-o-${v}`) || 0 }))
      .sort((a, b) => a.o - b.o)
      .forEach(({ s, o }) => {
        s.hidden = !o;
        if (o) main.insertBefore(s, contactSec || null);
      });
  }
  const viewLabel = (v) => { const b = $(`[data-set-tailor="${v}"] .seg-l`); return b ? b.textContent : v; };
  function setTailor(v, fromUser) {
    if (!views.includes(v)) v = d.dataset.defaultTailor || views[0];
    const apply = () => {
      d.dataset.tailor = v;
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
      .map((code) => `<button type="button" class="fx-row" role="menuitemradio" aria-checked="${code === curC}" data-code="${code}"><span class="code">${code}</span><span class="val">${money(code === c ? v : conv(v, c, code), code)}</span><i class="fa-solid fa-check chk" aria-hidden="true"></i></button>`)
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
    if (tailorBtn) { if (tailorBtn.getAttribute("aria-checked") !== "true") setTailor(tailorBtn.dataset.setTailor, true); return; }
    const bioBtn = t.closest("[data-bio]");
    if (bioBtn) {
      if (bio[bioBtn.dataset.bio] !== bioBtn.dataset.val) {
        bio[bioBtn.dataset.bio] = bioBtn.dataset.val; store.set(`bio-${bioBtn.dataset.bio}`, bioBtn.dataset.val);
        $$(`[data-bio="${bioBtn.dataset.bio}"]`, bioSec).forEach((b) => b.setAttribute("aria-checked", String(b === bioBtn)));
        swap([$(".list", bioSec)], syncBio);
      }
      return;
    }
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
    } else if (act === "copy" || act === "copy-to") {
      const text = act === "copy-to" ? ($("#cf-to") || {}).value : a.dataset.copy;
      const ok = await copy(text || "");
      if (ok) { play("copy"); toast(act === "copy-to" ? `${text} copied` : (a.dataset.toast || "Copied")); } else toast("Copy failed");
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
  window.addEventListener("beforeprint", () => { document.title = `Arvind Srinivasan — ${cvName()}`; closeMenu(); });
  window.addEventListener("afterprint", () => { document.title = baseTitle; });

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
    dd.innerHTML = opts.map((o, i) => `<button type="button" class="dd-opt" role="option" data-i="${i}" aria-selected="false">${face ? `<img src="${face.getAttribute("src")}" alt="">` : ""}<span class="dd-txt"><b>${esc(o.value)}</b><span>${esc(o.dataset.label || "")}</span></span><i class="fa-solid fa-check chk" aria-hidden="true"></i></button>`).join("");
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
    if (bar) bar.classList.toggle("scrolled", y > 140);
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

  /* ── Icon fallback: if the icon font never loads, show text labels ──────── */
  window.addEventListener("load", () => setTimeout(() => {
    const i = $("i.fa-solid, i.fa-duotone");
    if (!i) return;
    const st = getComputedStyle(i, "::before").content;
    if (!st || st === "none" || st === "normal" || st === '""') d.classList.add("no-fa");
  }, 2500));
})();
