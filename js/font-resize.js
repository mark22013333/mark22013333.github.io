// Font Size Adjuster - fixed button on left bottom
(function () {
  if (document.getElementById('font-resize-btn')) return;

  var sizes = [
    { cls: '', label: 'A', name: '預設' },
    { cls: 'font-size-medium', label: 'A+', name: '中' },
    { cls: 'font-size-large', label: 'A++', name: '大' }
  ];
  var current = 0;

  var btn = document.createElement('button');
  btn.id = 'font-resize-btn';
  btn.type = 'button';
  btn.title = '調整字體大小';
  btn.innerHTML = 'A';

  btn.addEventListener('click', function () {
    // Remove current class
    if (sizes[current].cls) {
      document.body.classList.remove(sizes[current].cls);
    }

    // Advance to next size
    current = (current + 1) % sizes.length;

    // Apply new class
    if (sizes[current].cls) {
      document.body.classList.add(sizes[current].cls);
    }

    btn.innerHTML = sizes[current].label;
    btn.title = '字體大小：' + sizes[current].name;
  });

  document.body.appendChild(btn);
})();
