document.addEventListener('DOMContentLoaded', function () {
  // Create player panel (right side)
  var panel = document.createElement('div');
  panel.id = 'kkbox-player-panel';
  panel.classList.add('hidden');
  panel.innerHTML = '<iframe src="https://widget.kkbox.com/v1/?id=0kI_2N-Uzou3DVmdC1&type=playlist&terr=tw&lang=tc" frameborder="0" scrolling="no"></iframe>';

  // Create toggle button
  var toggleBtn = document.createElement('button');
  toggleBtn.id = 'kkbox-toggle-btn';
  toggleBtn.innerHTML = '&#9835;';
  toggleBtn.title = '播放音樂';

  document.body.appendChild(panel);
  document.body.appendChild(toggleBtn);

  // Toggle player visibility (default hidden)
  toggleBtn.addEventListener('click', function () {
    var isHidden = panel.classList.toggle('hidden');
    toggleBtn.classList.toggle('player-visible', !isHidden);
    toggleBtn.innerHTML = isHidden ? '&#9835;' : '&#10005;';
    toggleBtn.title = isHidden ? '播放音樂' : '關閉播放器';
  });
});
