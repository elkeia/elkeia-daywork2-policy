(function () {
  var bar = document.getElementById('readbar');
  var backtop = document.getElementById('backtop');

  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    var top = h.scrollTop || document.body.scrollTop;
    if (bar) bar.style.width = (max > 0 ? (top / max) * 100 : 0).toFixed(2) + '%';
    if (backtop) backtop.classList.toggle('on', top > 600);
  }

  document.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  if (backtop) {
    backtop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();
