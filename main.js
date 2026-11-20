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
