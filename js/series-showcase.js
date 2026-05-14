document.addEventListener('DOMContentLoaded', function () {
  initScrollButtons();
  initImageFallback();
  initSeriesToggle();
});

function initScrollButtons() {
  var track = document.querySelector('.series-showcase-track');
  if (!track) return;

  var leftBtn = document.querySelector('.series-scroll-left');
  var rightBtn = document.querySelector('.series-scroll-right');
  if (!leftBtn || !rightBtn) return;

  var scrollAmount = 296; // card width (280) + gap (16)

  leftBtn.addEventListener('click', function () {
    track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  });
  rightBtn.addEventListener('click', function () {
    track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  });

  function updateButtons() {
    var scrollLeft = track.scrollLeft;
    var scrollWidth = track.scrollWidth;
    var clientWidth = track.clientWidth;
    leftBtn.style.display = scrollLeft <= 0 ? 'none' : 'flex';
    rightBtn.style.display = scrollLeft + clientWidth >= scrollWidth - 1 ? 'none' : 'flex';
  }

  track.addEventListener('scroll', updateButtons, { passive: true });
  updateButtons();
  window.addEventListener('resize', updateButtons, { passive: true });
}

function initImageFallback() {
  document.querySelectorAll('.series-card-cover img').forEach(function (img) {
    img.addEventListener('error', function () {
      this.style.display = 'none';
    });
  });
}

function initSeriesToggle() {
  document.querySelectorAll('.series-toggle-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = this.getAttribute('data-series');
      var section = document.getElementById(key);
      if (!section) return;

      var hidden = section.querySelector('.series-article-hidden');
      if (!hidden) return;

      var isVisible = hidden.style.display !== 'none';
      hidden.style.display = isVisible ? 'none' : 'block';
      this.textContent = isVisible
        ? this.textContent.replace('收合', '展開').replace('↑', '↓')
        : this.textContent.replace('展開', '收合').replace('↓', '↑');
    });
  });
}
