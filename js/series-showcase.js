/* series-showcase.js — 系列頁面互動 */
(function () {
  'use strict';

  // ========== 展開/收合按鈕：事件委派，不依賴初始化時機 ==========
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.series-toggle-btn');
    if (!btn) return;

    var key = btn.getAttribute('data-series');
    var section = document.getElementById(key);
    if (!section) return;

    var hidden = section.querySelector('.series-article-hidden');
    if (!hidden) return;

    var isVisible = hidden.style.display !== 'none';
    hidden.style.display = isVisible ? 'none' : 'block';
    btn.textContent = isVisible
      ? btn.textContent.replace('收合', '展開').replace('↑', '↓')
      : btn.textContent.replace('展開', '收合').replace('↓', '↑');
  });

  // ========== 首頁精選卡片滑動 ==========
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
      leftBtn.style.display = track.scrollLeft <= 0 ? 'none' : 'flex';
      rightBtn.style.display =
        track.scrollLeft + track.clientWidth >= track.scrollWidth - 1 ? 'none' : 'flex';
    }

    track.addEventListener('scroll', updateButtons, { passive: true });
    window.addEventListener('resize', updateButtons, { passive: true });
    updateButtons();
  }

  // ========== 圖片載入失敗隱藏 ==========
  function initImageFallback() {
    document.querySelectorAll('.series-card-cover img').forEach(function (img) {
      if (img._seriesFallback) return;
      img._seriesFallback = true;
      img.addEventListener('error', function () { this.style.display = 'none'; });
    });
  }

  // ========== 初始化（首頁卡片滑動 + 圖片 fallback） ==========
  function initShowcase() {
    initScrollButtons();
    initImageFallback();
  }

  // 首次載入
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShowcase);
  } else {
    initShowcase();
  }

  // Butterfly PJAX 回調（btf.addGlobalFn 可能尚未定義，安全取用）
  if (typeof btf !== 'undefined' && btf.addGlobalFn) {
    btf.addGlobalFn('pjaxComplete', initShowcase, 'seriesShowcase');
  }

  // 標準 PJAX 事件（備援）
  document.addEventListener('pjax:complete', initShowcase);
})();
