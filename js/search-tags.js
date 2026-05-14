document.addEventListener('DOMContentLoaded', function () {
  var searchDialog = document.querySelector('#local-search .search-dialog');
  if (!searchDialog) return;
  var input = searchDialog.querySelector('.local-search-input input');
  if (!input) return;

  // 注入 tab bar HTML（在 .local-search-input 之前）
  var inputWrapper = searchDialog.querySelector('.local-search-input');
  var tabBar = document.createElement('div');
  tabBar.className = 'search-tab-bar';
  tabBar.innerHTML =
    '<button class="search-tab active" data-tab="articles">' +
    '<i class="fas fa-search"></i> 搜尋文章</button>' +
    '<button class="search-tab" data-tab="tags">' +
    '<i class="fas fa-tags"></i> 搜尋標籤</button>';
  inputWrapper.parentNode.insertBefore(tabBar, inputWrapper);

  // 建立標籤結果容器（隱藏）
  var tagResults = document.createElement('div');
  tagResults.id = 'tag-search-results';
  tagResults.style.display = 'none';
  var localResults = document.getElementById('local-search-results');
  localResults.parentNode.insertBefore(tagResults, localResults.nextSibling);

  var activeTab = 'articles';
  var localPagination = document.getElementById('local-search-pagination');
  var localStats = document.getElementById('local-search-stats');

  // Tab 切換邏輯
  tabBar.addEventListener('click', function (e) {
    var btn = e.target.closest('.search-tab');
    if (!btn || btn.dataset.tab === activeTab) return;

    activeTab = btn.dataset.tab;
    tabBar.querySelectorAll('.search-tab').forEach(function (t) {
      t.classList.remove('active');
    });
    btn.classList.add('active');

    if (activeTab === 'articles') {
      localResults.style.display = '';
      tagResults.style.display = 'none';
      if (localPagination) localPagination.style.display = '';
      if (localStats) localStats.style.display = '';
      input.placeholder = '搜尋文章...';
    } else {
      localResults.style.display = 'none';
      tagResults.style.display = '';
      if (localPagination) localPagination.style.display = 'none';
      if (localStats) localStats.style.display = 'none';
      input.placeholder = '搜尋標籤...';
      renderTags(input.value);
    }
  });

  // 標籤搜尋邏輯
  input.addEventListener('input', function () {
    if (activeTab === 'tags') {
      renderTags(this.value);
    }
  });

  function renderTags(query) {
    var tags = window.__BLOG_TAGS__ || [];
    var q = (query || '').trim().toLowerCase();

    var filtered = q
      ? tags.filter(function (t) { return t.name.toLowerCase().includes(q); })
      : tags;

    if (filtered.length === 0) {
      tagResults.innerHTML = '<div class="search-result-stats">找不到符合的標籤</div>';
      return;
    }

    var html = '<div class="tag-search-list">';
    filtered.forEach(function (tag) {
      var highlighted = q
        ? tag.name.replace(
            new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'),
            '<mark>$1</mark>'
          )
        : tag.name;
      html += '<a href="/' + tag.path + '" class="tag-search-item">' +
        '<span class="tag-search-name">' + highlighted + '</span>' +
        '<span class="tag-search-count">' + tag.count + ' 篇</span>' +
        '</a>';
    });
    html += '</div>';
    html += '<div class="search-result-stats">共 ' + filtered.length + ' 個標籤</div>';
    tagResults.innerHTML = html;
  }
});
