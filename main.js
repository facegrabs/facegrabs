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
