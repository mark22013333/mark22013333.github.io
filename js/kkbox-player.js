document.addEventListener('DOMContentLoaded', function () {
  var aside = document.getElementById('aside-content');
  if (!aside) return;

  // Create KKBOX card widget
  var card = document.createElement('div');
  card.className = 'card-widget card-kkbox';
  card.innerHTML =
    '<div class="item-headline"><i class="fas fa-music"></i><span>Music</span></div>' +
    '<iframe src="https://widget.kkbox.com/v1/?id=0kI_2N-Uzou3DVmdC1&type=playlist&terr=tw&lang=tc" frameborder="0" scrolling="no"></iframe>';

  // Insert after card_announcement (second card)
  var cards = aside.querySelectorAll('.card-widget');
  if (cards.length >= 2) {
    cards[1].insertAdjacentElement('afterend', card);
  } else {
    aside.appendChild(card);
  }
});
