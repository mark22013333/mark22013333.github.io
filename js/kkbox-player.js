document.addEventListener('DOMContentLoaded', function () {
  // Create player bar
  var playerBar = document.createElement('div');
  playerBar.id = 'kkbox-player-bar';
  playerBar.innerHTML = '<iframe src="https://widget.kkbox.com/v1/?id=0kI_2N-Uzou3DVmdC1&type=playlist&terr=tw&lang=tc" frameborder="0" scrolling="no"></iframe>';

  // Create toggle button
  var toggleBtn = document.createElement('button');
  toggleBtn.id = 'kkbox-toggle-btn';
  toggleBtn.innerHTML = '&#9660;';
  toggleBtn.title = '隱藏/顯示播放器';

  document.body.appendChild(playerBar);
  document.body.appendChild(toggleBtn);

  // Toggle player visibility
  toggleBtn.addEventListener('click', function () {
    playerBar.classList.toggle('hidden');
    toggleBtn.classList.toggle('player-hidden');
    toggleBtn.innerHTML = playerBar.classList.contains('hidden') ? '&#9650;' : '&#9660;';
    document.body.style.paddingBottom = playerBar.classList.contains('hidden') ? '0' : '80px';
  });
});
