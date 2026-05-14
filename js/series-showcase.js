function initSeriesShowcase() {
  initScrollButtons();
  initImageFallback();
  initSeriesToggle();
}

document.addEventListener('DOMContentLoaded', initSeriesShowcase);
document.addEventListener('pjax:complete', initSeriesShowcase);

function initScrollButtons() {
  var track = document.querySelector('.series-showcase-track');
  if (!track) return;

  var leftBtn = document.querySelector('.series-scroll-left');
  var rightBtn = document.querySelector('.series-scroll-right');
  if (!leftBtn || !rightBtn) return;

  function getScrollAmount() {
    var card = track.querySelector('.series-card');
    if (!card) return 296;
    var style = window.getComputedStyle(track);
    var gap = parseFloat(style.gap) || 16;
    return card.offsetWidth + gap;
  }

  leftBtn.addEventListener('click', function () {
    track.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' });
  });
  rightBtn.addEventListener('click', function () {
    track.scrollBy({ left: getScrollAmount(), behavior: 'smooth' });
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
