// AI Music Floating Player - replaces KKBOX, persists across pjax navigation
(function () {
  if (document.getElementById('music-fixed-player')) return;

  var MUSIC_URL = 'https://interesting-echo-verse-live.base44.app/w/ai-music';

  // --- Container ---
  var player = document.createElement('div');
  player.id = 'music-fixed-player';

  var iframe = document.createElement('iframe');
  iframe.id = 'music-iframe';
  iframe.src = MUSIC_URL;
  iframe.frameBorder = '0';
  iframe.scrolling = 'auto';
  iframe.allow = 'autoplay; encrypted-media';
  iframe.setAttribute('allowfullscreen', '');
  player.appendChild(iframe);

  // --- Shuffle / Next button (inside player panel) ---
  var shuffleBtn = document.createElement('button');
  shuffleBtn.id = 'music-shuffle';
  shuffleBtn.innerHTML = '&#x1F500;';  // 🔀
  shuffleBtn.title = '隨機換一首';
  shuffleBtn.addEventListener('click', function () {
    // Reload iframe with cache-busting param to get fresh random state
    iframe.src = MUSIC_URL + '?t=' + Date.now();
    shuffleBtn.classList.add('spin');
    setTimeout(function () { shuffleBtn.classList.remove('spin'); }, 600);
  });
  player.appendChild(shuffleBtn);

  // --- Toggle button (always visible on edge) ---
  var btn = document.createElement('button');
  btn.id = 'music-toggle';
  btn.innerHTML = '&#9835;';  // ♫
  btn.title = '播放音樂';

  btn.addEventListener('click', function () {
    var isOpen = player.classList.toggle('open');
    btn.classList.toggle('open', isOpen);
    btn.innerHTML = isOpen ? '&#10005;' : '&#9835;';
    btn.title = isOpen ? '關閉播放器' : '播放音樂';
  });

  document.body.appendChild(player);
  document.body.appendChild(btn);
})();
