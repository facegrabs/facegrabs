document.querySelectorAll(".video").forEach(function(v){
  var b=v.querySelector("button");
  if(!b)return;
  b.addEventListener("click",function(){
    var f=document.createElement("iframe");
    f.src="https://www.youtube-nocookie.com/embed/"+v.dataset.id+"?autoplay=1&rel=0";
    f.title="Watch face video";
    f.allow="autoplay; encrypted-media; picture-in-picture";
    f.allowFullscreen=true;
    v.replaceChildren(f);
  });
});
(function(){
  var els=document.querySelectorAll(".card,.sec,.band,.kit");
  if(!("IntersectionObserver" in window)||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  document.documentElement.classList.add("js");
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}})},{rootMargin:"0px 0px -8% 0px"});
  els.forEach(function(el){el.classList.add("rv");io.observe(el)});
})();
