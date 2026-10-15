/* The Bookshelf — 3D rotating cover carousel (vanilla JS, no framework).
   Coverflow geometry: the centered cover faces the visitor; neighbours are
   angled away with rotateY + translateZ. Only a window of covers around the
   current position exists in the DOM / is ever requested (pool of 17 nodes
   recycled as the shelf moves), so a catalog of ~1,000 books costs ~17
   thumbnail downloads at a time, never hundreds of full-size covers. */
(function () {
  "use strict";
  var DATA = window.BOOKSHELF_DATA;
  if (!DATA) return;
  var PAGE_BASE = DATA.pageBase || "";
  var POOL_R = 8;                 // covers rendered on each side of centre
  var POOL_N = POOL_R * 2 + 1;

  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage"), azBar = $("azBar"), catSel = $("catSel"),
      searchBox = $("searchBox"), searchResults = $("searchResults"),
      capTitle = $("capTitle"), capMeta = $("capMeta"),
      prevBtn = $("prevBtn"), nextBtn = $("nextBtn"),
      viewToggle = $("viewToggle"), motionToggle = $("motionToggle"),
      carouselWrap = $("carouselWrap"), simpleView = $("simpleView"),
      simpleGrid = $("simpleGrid"), moreBtn = $("moreBtn"), hud = $("hud");

  /* ---------- helpers ---------- */
  function sortKey(t) {
    var s = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    var arts = ["the ", "a ", "an "];
    for (var i = 0; i < arts.length; i++)
      if (s.indexOf(arts[i]) === 0) { s = s.slice(arts[i].length); break; }
    return s;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  /* ---------- state ---------- */
  var state = {
    coll: "all",
    fullList: [],        // every slug in the collection (simple view)
    list: [],            // slugs with covers (the carousel shelf)
    position: 0,         // float index into list
    reduced: false,
    view: "carousel",
    simpleShown: 0
  };
  var slugColl = {};     // slug -> first collection id containing it
  DATA.collections.forEach(function (c) {
    (DATA.order[c.id] || []).forEach(function (s) {
      if (!(s in slugColl)) slugColl[s] = c.id;
    });
  });
  var totalCovers = Object.keys(DATA.books).filter(function (s) { return DATA.books[s].img; }).length;

  /* ---------- pool of cover nodes ---------- */
  var pool = [];
  for (var i = 0; i < POOL_N; i++) {
    var d = document.createElement("div");
    d.className = "bk"; d._idx = -1;
    var im = document.createElement("img");
    im.alt = ""; im.draggable = false;
    d.appendChild(im);
    stage.appendChild(d);
    pool.push(d);
  }
  var loadedSrcs = new Set();
  pool.forEach(function (node) {
    node.firstChild.addEventListener("load", function () {
      var src = node.firstChild.getAttribute("src");
      if (src && !loadedSrcs.has(src)) { loadedSrcs.add(src); updateHud(); }
    });
  });

  function metrics() {
    var w = stage.clientWidth || window.innerWidth;
    var coverW = clamp(w * 0.56, 150, 300);
    return { coverW: coverW, spacing: coverW * 0.54, depth: coverW * 0.45, angle: 46 };
  }

  var lastCenter = -1;
  function render() {
    var m = metrics();
    stage.style.setProperty("--cover-w", m.coverW + "px");
    var n = state.list.length;
    var center = Math.round(state.position);
    for (var i = 0; i < POOL_N; i++) {
      var node = pool[i], idx = center + i - POOL_R;
      if (idx < 0 || idx >= n) { node.style.display = "none"; node._idx = -1; continue; }
      var off = idx - state.position;
      if (node._idx !== idx) {
        var slug = state.list[idx], b = DATA.books[slug];
        node._idx = idx; node.dataset.slug = slug;
        var img = node.firstChild;
        if (img.getAttribute("src") !== b.img) img.setAttribute("src", b.img);
        img.alt = b.t + " — book cover";
      }
      var ao = Math.abs(off);
      var rot = clamp(off * m.angle, -68, 68);
      node.style.display = "block";
      node.style.transform =
        "translate(-50%,-52%) translateX(" + (off * m.spacing).toFixed(1) + "px)" +
        " translateZ(" + (-ao * m.depth).toFixed(1) + "px) rotateY(" + rot.toFixed(1) + "deg)";
      node.style.zIndex = String(200 - Math.round(ao * 10));
      node.style.opacity = ao > 6.2 ? String(clamp(1 - (ao - 6.2) / 1.3, 0, 1)) : "1";
      if (idx === center) node.classList.add("is-center"); else node.classList.remove("is-center");
    }
    prevBtn.disabled = center <= 0;
    nextBtn.disabled = center >= n - 1;
    if (center !== lastCenter && n > 0) {
      lastCenter = center;
      var cb = DATA.books[state.list[center]];
      capTitle.textContent = cb.t;
      capTitle.setAttribute("href", PAGE_BASE + cb.u);
      var coll = DATA.collections.filter(function (c) { return c.id === state.coll; })[0];
      capMeta.textContent = "Book " + (center + 1) + " of " + n + " · " + (coll ? coll.label : "");
      markLetter();
    }
  }

  /* ---------- animation ---------- */
  var anim = null, rafId = null;
  function step(now) {
    rafId = null;
    if (!anim) return;
    var t = (now - anim.start) / anim.dur;
    if (t >= 1) { state.position = anim.to; anim = null; render(); return; }
    var e = anim.ease(t);
    state.position = anim.from + (anim.to - anim.from) * e;
    render();
    rafId = requestAnimationFrame(step);
  }
  function tweenTo(target, opts) {
    opts = opts || {};
    target = clamp(target, 0, state.list.length - 1);
    if (state.reduced) { anim = null; state.position = target; render(); return; }
    var dist = Math.abs(target - state.position);
    if (dist < 0.001) { state.position = target; render(); return; }
    var dur = opts.dur || clamp(240 + dist * 55, 240, 780);
    anim = { from: state.position, to: target, start: performance.now(), dur: dur,
             ease: opts.ease || easeOut };
    if (!rafId) rafId = requestAnimationFrame(step);
  }
  function jumpTo(target) {  // long-distance move (A-Z, search)
    var dist = Math.abs(target - state.position);
    if (dist > 30 && !state.reduced) {
      /* Fade-teleport: a rotating sweep across hundreds of titles would make
         the browser fetch every cover the window passes over. Past 30 titles
         the shelf fades, repositions, and fades back — only the destination
         window's covers are ever requested. */
      stage.style.transition = "opacity 140ms ease";
      stage.style.opacity = "0.12";
      window.setTimeout(function () {
        state.position = target; render();
        stage.style.opacity = "1";
        window.setTimeout(function () { stage.style.transition = ""; }, 180);
      }, 150);
      return;
    }
    tweenTo(target, { dur: clamp(280 + dist * 20, 280, 1150), ease: easeInOut });
  }

  /* ---------- pointer: drag / swipe / tap ---------- */
  var drag = null;
  stage.addEventListener("pointerdown", function (e) {
    if (e.button !== undefined && e.button > 0) return;
    anim = null; if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    var node = e.target.closest ? e.target.closest(".bk") : null;
    drag = { x0: e.clientX, t0: performance.now(), startPos: state.position,
             samples: [{ x: e.clientX, t: performance.now() }],
             nodeIdx: node ? node._idx : -1, moved: 0 };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var m = metrics();
    var dx = e.clientX - drag.x0;
    drag.moved = Math.max(drag.moved, Math.abs(dx));
    drag.samples.push({ x: e.clientX, t: performance.now() });
    if (drag.samples.length > 8) drag.samples.shift();
    var pos = drag.startPos - dx / m.spacing;
    if (pos < 0) pos *= 0.35;                                  // rubber-band
    if (pos > state.list.length - 1) pos = state.list.length - 1 + (pos - (state.list.length - 1)) * 0.35;
    state.position = pos;
    render();
  });
  function endDrag(e) {
    if (!drag) return;
    var d = drag; drag = null;
    var dt = performance.now() - d.t0;
    if (d.moved < 9 && dt < 500) {                              // tap
      if (d.nodeIdx >= 0) {
        if (d.nodeIdx === Math.round(state.position)) {
          var slug = state.list[d.nodeIdx];
          window.location.href = PAGE_BASE + DATA.books[slug].u;
        } else tweenTo(d.nodeIdx);
      }
      return;
    }
    var m = metrics(), v = 0;                                   // px per ms
    if (d.samples.length > 1) {
      var a = d.samples[0], b = d.samples[d.samples.length - 1];
      if (b.t > a.t) v = (b.x - a.x) / (b.t - a.t);
    }
    var vIdx = -(v / m.spacing) * 1000;                         // covers per second
    var target = Math.round(state.position + vIdx * 0.22);
    tweenTo(target);
  }
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", function () { drag = null; tweenTo(Math.round(state.position)); });

  /* ---------- buttons & keyboard ---------- */
  prevBtn.addEventListener("click", function () { tweenTo(Math.round(state.position) - 1); });
  nextBtn.addEventListener("click", function () { tweenTo(Math.round(state.position) + 1); });
  stage.addEventListener("keydown", function (e) {
    var c = Math.round(state.position), handled = true;
    if (e.key === "ArrowLeft") tweenTo(c - 1);
    else if (e.key === "ArrowRight") tweenTo(c + 1);
    else if (e.key === "PageDown") tweenTo(c + 5);
    else if (e.key === "PageUp") tweenTo(c - 5);
    else if (e.key === "Home") jumpTo(0);
    else if (e.key === "End") jumpTo(state.list.length - 1);
    else if (e.key === "Enter" && state.list.length) {
      var slug = state.list[c];
      window.location.href = PAGE_BASE + DATA.books[slug].u;
    } else handled = false;
    if (handled) e.preventDefault();
  });

  /* ---------- A-Z bar ---------- */
  var letterFirstIdx = {};
  function buildAz() {
    azBar.textContent = ""; letterFirstIdx = {};
    state.list.forEach(function (slug, i) {
      var L = (sortKey(DATA.books[slug].t).charAt(0) || "#").toUpperCase();
      if (!(L in letterFirstIdx)) letterFirstIdx[L] = i;
    });
    Object.keys(letterFirstIdx).sort().forEach(function (L) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = L; b.dataset.letter = L;
      b.setAttribute("aria-label", "Jump to titles starting with " + L);
      b.addEventListener("click", function () { jumpTo(letterFirstIdx[L]); });
      azBar.appendChild(b);
    });
  }
  function markLetter() {
    var c = Math.round(state.position);
    if (!state.list.length) return;
    var L = (sortKey(DATA.books[state.list[c]].t).charAt(0) || "#").toUpperCase();
    azBar.querySelectorAll("button").forEach(function (b) {
      if (b.dataset.letter === L) b.classList.add("cur"); else b.classList.remove("cur");
    });
  }

  /* ---------- collections ---------- */
  function setCollection(id, startIdx) {
    state.coll = id;
    state.fullList = DATA.order[id] || [];
    state.list = state.fullList.filter(function (s) { return DATA.books[s].img; });
    state.position = clamp(startIdx || 0, 0, Math.max(0, state.list.length - 1));
    lastCenter = -1;
    buildAz(); render(); updateHud();
    if (state.view === "simple") renderSimple(false);
  }
  DATA.collections.forEach(function (c) {
    var o = document.createElement("option");
    o.value = c.id; o.textContent = c.label + " (" + c.count + ")";
    catSel.appendChild(o);
  });
  catSel.addEventListener("change", function () { setCollection(catSel.value, 0); });

  /* ---------- search (across the whole catalog) ---------- */
  var allSlugs = Object.keys(DATA.books);
  function closeResults() { searchResults.hidden = true; searchBox.setAttribute("aria-expanded", "false"); }
  searchBox.addEventListener("input", function () {
    var q = sortKey(searchBox.value);
    if (!q) { closeResults(); return; }
    var hits = [];
    for (var i = 0; i < allSlugs.length && hits.length < 40; i++) {
      var s = allSlugs[i];
      if (sortKey(DATA.books[s].t).indexOf(q) !== -1) hits.push(s);
    }
    hits.sort(function (a, b) { return sortKey(DATA.books[a].t) < sortKey(DATA.books[b].t) ? -1 : 1; });
    hits = hits.slice(0, 8);
    searchResults.textContent = "";
    if (!hits.length) {
      var none = document.createElement("div");
      none.className = "r-none"; none.textContent = "No titles match — try another word.";
      searchResults.appendChild(none);
    }
    hits.forEach(function (s) {
      var b = DATA.books[s];
      var btn = document.createElement("button");
      btn.type = "button"; btn.setAttribute("role", "option");
      var left = document.createElement("span"); left.textContent = b.t + (b.img ? "" : " (no cover yet)");
      var right = document.createElement("span"); right.className = "r-coll";
      var coll = DATA.collections.filter(function (c) { return c.id === slugColl[s]; })[0];
      right.textContent = coll ? coll.label : "";
      btn.appendChild(left); btn.appendChild(right);
      btn.addEventListener("click", function () { chooseSearch(s); });
      searchResults.appendChild(btn);
    });
    searchResults.hidden = false;
    searchBox.setAttribute("aria-expanded", "true");
  });
  searchBox.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeResults();
    if (e.key === "Enter") {
      var first = searchResults.querySelector("button");
      if (first && !searchResults.hidden) { e.preventDefault(); first.click(); }
    }
  });
  document.addEventListener("click", function (e) {
    if (!searchResults.contains(e.target) && e.target !== searchBox) closeResults();
  });
  function chooseSearch(slug) {
    closeResults(); searchBox.value = "";
    var b = DATA.books[slug];
    if (!b.img) { window.location.href = PAGE_BASE + b.u; return; }  // no cover: go straight to its page
    if (state.view === "simple") setView("carousel");
    if (state.list.indexOf(slug) === -1) {
      var targetColl = (DATA.order.all || []).indexOf(slug) !== -1 ? "all" : slugColl[slug];
      catSel.value = targetColl;
      setCollection(targetColl, 0);
    }
    jumpTo(state.list.indexOf(slug));
    stage.focus();
  }

  /* ---------- simple view ---------- */
  var SIMPLE_CHUNK = 48;
  function renderSimple(append) {
    if (!append) { simpleGrid.textContent = ""; state.simpleShown = 0; }
    var end = Math.min(state.simpleShown + SIMPLE_CHUNK, state.fullList.length);
    for (var i = state.simpleShown; i < end; i++) {
      var slug = state.fullList[i], b = DATA.books[slug];
      var a = document.createElement("a");
      a.className = "bs-cell"; a.href = PAGE_BASE + b.u;
      if (b.img) {
        var img = document.createElement("img");
        img.src = b.img; img.alt = b.t + " — book cover"; img.loading = "lazy";
        a.appendChild(img);
      } else {
        var tx = document.createElement("span");
        tx.className = "bs-cell-text"; tx.textContent = b.t;
        a.appendChild(tx);
      }
      var cap = document.createElement("span");
      cap.className = "c-title"; cap.textContent = b.t;
      a.appendChild(cap);
      simpleGrid.appendChild(a);
    }
    state.simpleShown = end;
    moreBtn.hidden = state.simpleShown >= state.fullList.length;
  }
  moreBtn.addEventListener("click", function () { renderSimple(true); });
  function setView(v) {
    state.view = v;
    var simple = v === "simple";
    viewToggle.setAttribute("aria-pressed", String(simple));
    viewToggle.textContent = simple ? "Carousel view" : "Simple view";
    carouselWrap.hidden = simple;
    azBar.style.display = simple ? "none" : "";
    simpleView.hidden = !simple;
    if (simple) renderSimple(false); else render();
  }
  viewToggle.addEventListener("click", function () {
    setView(state.view === "simple" ? "carousel" : "simple");
  });

  /* ---------- motion preference ---------- */
  function applyMotion() {
    state.reduced = motionToggle.checked;
    document.body.classList.toggle("reduced-motion", state.reduced);
    if (state.reduced && anim) { state.position = anim.to; anim = null; render(); }
  }
  motionToggle.checked = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  motionToggle.addEventListener("change", applyMotion);

  /* ---------- HUD (preview instrumentation) ---------- */
  function updateHud() {
    var coll = DATA.collections.filter(function (c) { return c.id === state.coll; })[0];
    hud.textContent = "Preview stats · catalog: " + totalCovers + " covers · shelf window: " +
      Math.min(POOL_N, state.list.length) + " of " + state.list.length +
      " in " + (coll ? coll.label : "") + " · cover images loaded so far: " + loadedSrcs.size;
  }

  /* ---------- init ---------- */
  var params = new URLSearchParams(window.location.search);
  var initColl = params.get("cat");
  if (!DATA.order[initColl]) initColl = "all";
  catSel.value = initColl;
  applyMotion();
  var initPos = parseFloat(params.get("pos") || "0");
  setCollection(initColl, isNaN(initPos) ? 0 : initPos);
  if (params.get("view") === "simple") setView("simple");
  window.addEventListener("resize", function () { render(); });
  window.__bookshelf = { state: state, jumpTo: jumpTo, tweenTo: tweenTo, setCollection: setCollection };
})();
