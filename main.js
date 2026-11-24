/* FaceGrabs: play looping watch clips only while they are on screen; respect reduced motion. */
(function () {
  var clips = [].slice.call(document.querySelectorAll("video[autoplay]"));
  if (!clips.length) return;
  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  clips.forEach(function (v) {
    if (still) { v.removeAttribute("autoplay"); v.pause(); return; }
    if (!("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else { v.pause(); }
      });
    }, { threshold: 0.25 }).observe(v);
  });
})();

/* FaceGrabs: widget screens fade one to the next. Static row when reduced motion is set or JS is off. */
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  [].slice.call(document.querySelectorAll(".shots")).forEach(function (box) {
    var shots = [].slice.call(box.querySelectorAll(".shot"));
    var nav = box.querySelector(".shots-nav");
    var btns = nav ? [].slice.call(nav.querySelectorAll("button")) : [];
    var cap = box.querySelector(".shots-cap");
    if (shots.length < 2 || btns.length !== shots.length || !cap) return;
    var i = 0, timer = null, hover = false, focus = false, stopped = false;
    function show(n) {
      i = (n + shots.length) % shots.length;
      shots.forEach(function (s, k) {
        s.classList.toggle("is-on", k === i);
        if (k === i) s.removeAttribute("aria-hidden"); else s.setAttribute("aria-hidden", "true");
      });
      btns.forEach(function (b, k) { b.setAttribute("aria-current", k === i ? "true" : "false"); });
      cap.textContent = shots[i].querySelector("figcaption").textContent;
    }
    function tick() {
      clearTimeout(timer); timer = null;
      if (stopped || hover || focus || document.hidden) return;
      timer = setTimeout(function () { show(i + 1); tick(); }, 3500);
    }
    btns.forEach(function (b, k) {
      b.addEventListener("click", function () { stopped = true; cap.setAttribute("aria-live", "polite"); show(k); tick(); });
    });
    box.addEventListener("mouseenter", function () { hover = true; tick(); });
    box.addEventListener("mouseleave", function () { hover = false; tick(); });
    box.addEventListener("focusin", function () { focus = true; tick(); });
    box.addEventListener("focusout", function (e) { if (!box.contains(e.relatedTarget)) { focus = false; tick(); } });
    document.addEventListener("visibilitychange", tick);
    box.classList.add("is-live"); nav.hidden = false; show(0); tick();
  });
})();

/* click to enlarge pictures marked with data-zoom; pictures sharing data-group can be flipped through */
(function () {
  var all = Array.prototype.slice.call(document.querySelectorAll("img[data-zoom]"));
  if (!all.length || typeof HTMLDialogElement === "undefined") return;
  var dlg = document.createElement("dialog"); dlg.className = "lightbox"; dlg.setAttribute("aria-label", "Enlarged picture");
  function btn(cls, label, d) { var b = document.createElement("button"); b.type = "button"; b.className = "lb-btn " + cls; b.setAttribute("aria-label", label); b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'; return b; }
  var x = btn("lb-close", "Close", "M6 6l12 12M18 6L6 18");
  var prev = btn("lb-prev", "Previous picture", "M15 5l-7 7 7 7");
  var next = btn("lb-next", "Next picture", "M9 5l7 7-7 7");
  var fig = document.createElement("figure"); fig.className = "lb-fig";
  var big = document.createElement("img"); big.alt = "";
  var cap = document.createElement("figcaption"); cap.className = "lb-cap";
  fig.appendChild(big); fig.appendChild(cap);
  [x, prev, next, fig].forEach(function (n) { dlg.appendChild(n); });
  document.body.appendChild(dlg);
  var last = null, set = [], idx = 0;
  function clean(t) { return (t || "").replace(/\s*Click to enlarge\.?$/, ""); }
  function show(i) {
    idx = (i + set.length) % set.length; var img = set[idx]; last = img;
    big.classList.remove("in"); big.src = img.getAttribute("data-zoom"); big.alt = clean(img.alt);
    var h = img.parentNode && img.parentNode.querySelector("h3");
    cap.textContent = (h ? h.textContent + ". " : "") + (set.length > 1 ? (idx + 1) + " of " + set.length : "");
    void big.offsetWidth; big.classList.add("in");
  }
  function open(img) {
    var g = img.getAttribute("data-group");
    set = g ? all.filter(function (n) { return n.getAttribute("data-group") === g; }) : [img];
    prev.hidden = next.hidden = set.length < 2;
    show(set.indexOf(img)); dlg.showModal(); x.focus();
  }
  all.forEach(function (img) {
    img.setAttribute("tabindex", "0"); img.setAttribute("role", "button");
    img.addEventListener("click", function () { open(img); });
    img.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(img); } });
  });
  x.addEventListener("click", function () { dlg.close(); });
  prev.addEventListener("click", function () { show(idx - 1); });
  next.addEventListener("click", function () { show(idx + 1); });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener("keydown", function (e) { if (set.length < 2) return; if (e.key === "ArrowLeft") { e.preventDefault(); show(idx - 1); } else if (e.key === "ArrowRight") { e.preventDefault(); show(idx + 1); } });
  var sx = null;
  dlg.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
  dlg.addEventListener("touchend", function (e) { if (sx === null || set.length < 2) return; var dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1)); }, { passive: true });
  dlg.addEventListener("close", function () { if (last) last.focus(); });
})();

