// KKBOX Fixed Player - injected once, persists across pjax navigation
(function () {
  if (document.getElementById('kkbox-fixed-player')) return;

  var player = document.createElement('div');
  player.id = 'kkbox-fixed-player';
  player.innerHTML = '<iframe src="https://widget.kkbox.com/v1/?id=0kI_2N-Uzou3DVmdC1&type=playlist&terr=tw&lang=tc" frameborder="0" scrolling="no"></iframe>';

  var btn = document.createElement('button');
  btn.id = 'kkbox-toggle';
  btn.innerHTML = '&#9835;';
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
