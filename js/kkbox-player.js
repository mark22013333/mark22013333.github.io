// AI Music Floating Player - replaces KKBOX, persists across pjax navigation
(function () {
  if (document.getElementById('music-fixed-player')) return;

  var TABS = [
    { id: 'ai-music', label: 'AI 歌曲', url: 'https://interesting-echo-verse-live.base44.app/w/ai-music' },
    { id: 'qq', label: '純音樂', url: 'https://interesting-echo-verse-live.base44.app/w/qq' },
    { id: 'hymn-piano', label: '詩歌鋼琴', url: '/music/hymn-player.html' }
  ];
  var activeTab = TABS[0];

  // --- Container ---
  var player = document.createElement('div');
  player.id = 'music-fixed-player';

  var iframe = document.createElement('iframe');
  iframe.id = 'music-iframe';
  iframe.src = activeTab.url;
  iframe.frameBorder = '0';
  iframe.scrolling = 'auto';
  iframe.allow = 'autoplay; encrypted-media';
  iframe.setAttribute('allowfullscreen', '');

  // --- Tab bar ---
  var tabBar = document.createElement('div');
  tabBar.id = 'music-tab-bar';

  TABS.forEach(function (tab) {
    var tabBtn = document.createElement('button');
    tabBtn.textContent = tab.label;
    tabBtn.dataset.tabId = tab.id;
    if (tab === activeTab) tabBtn.classList.add('active');
    tabBtn.addEventListener('click', function () {
      if (activeTab.id === tab.id) return;
      activeTab = tab;
      iframe.src = tab.url;
      tabBar.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('active', b.dataset.tabId === tab.id);
      });
    });
    tabBar.appendChild(tabBtn);
  });

  player.appendChild(tabBar);
  player.appendChild(iframe);

  // --- Shuffle / Next button (inside player panel) ---
  var shuffleBtn = document.createElement('button');
  shuffleBtn.id = 'music-shuffle';
  shuffleBtn.innerHTML = '&#x1F500;';  // 🔀
  shuffleBtn.title = '隨機換一首';
  shuffleBtn.addEventListener('click', function () {
    iframe.src = activeTab.url + '?t=' + Date.now();
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
