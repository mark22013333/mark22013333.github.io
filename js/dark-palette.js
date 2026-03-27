/* Dark Palette - 深色主題切換器 */
(function () {
  'use strict'

  const THEMES = [
    { id: 'midnight', label: '純黑 Midnight', icon: '🌑' },
    { id: 'charcoal', label: '深灰 Charcoal', icon: '🌫' },
    { id: 'ocean',    label: '深藍 Ocean',    icon: '🌊' },
    { id: 'forest',   label: '深綠 Forest',   icon: '🌲' }
  ]
  const STORAGE_KEY = 'dark-palette-style'
  const DEFAULT_STYLE = 'charcoal'

  function getSavedStyle () {
    try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_STYLE }
    catch { return DEFAULT_STYLE }
  }

  function saveStyle (style) {
    try { localStorage.setItem(STORAGE_KEY, style) } catch {}
  }

  function applyStyle (style) {
    document.documentElement.setAttribute('data-dark-style', style)
    saveStyle(style)
  }

  /* 進入深色模式時自動套用上次選擇 */
  function onThemeChange () {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    if (isDark) {
      applyStyle(getSavedStyle())
    } else {
      document.documentElement.removeAttribute('data-dark-style')
    }
  }

  /* 建立 DOM */
  function createPalette () {
    // 如果已存在就跳過
    if (document.getElementById('dark-palette-btn')) return

    // 浮動按鈕
    var btn = document.createElement('button')
    btn.id = 'dark-palette-btn'
    btn.title = '切換深色風格'
    btn.setAttribute('aria-label', '切換深色風格')
    btn.innerHTML = '🎨'

    // 面板
    var panel = document.createElement('div')
    panel.id = 'dark-palette-panel'

    var title = document.createElement('div')
    title.className = 'palette-title'
    title.textContent = '深色風格'

    var options = document.createElement('div')
    options.className = 'palette-options'

    THEMES.forEach(function (t) {
      var opt = document.createElement('button')
      opt.className = 'palette-option'
      opt.setAttribute('data-style', t.id)

      var swatch = document.createElement('span')
      swatch.className = 'palette-swatch swatch-' + t.id

      var label = document.createElement('span')
      label.className = 'palette-label'
      label.textContent = t.icon + ' ' + t.label

      opt.appendChild(swatch)
      opt.appendChild(label)
      options.appendChild(opt)

      opt.addEventListener('click', function () {
        applyStyle(t.id)
        updateActive(t.id)
        // 關閉面板
        setTimeout(function () { panel.classList.remove('show') }, 200)
      })
    })

    panel.appendChild(title)
    panel.appendChild(options)
    document.body.appendChild(panel)
    document.body.appendChild(btn)

    // 切換面板顯示
    btn.addEventListener('click', function (e) {
      e.stopPropagation()
      panel.classList.toggle('show')
    })

    // 點擊其他地方關閉面板
    document.addEventListener('click', function (e) {
      if (!panel.contains(e.target) && e.target !== btn) {
        panel.classList.remove('show')
      }
    })

    // 初始化 active 狀態
    updateActive(getSavedStyle())
  }

  function updateActive (activeId) {
    var panel = document.getElementById('dark-palette-panel')
    if (!panel) return
    var opts = panel.querySelectorAll('.palette-option')
    opts.forEach(function (opt) {
      if (opt.getAttribute('data-style') === activeId) {
        opt.classList.add('active')
      } else {
        opt.classList.remove('active')
      }
    })
  }

  /* 監聽 data-theme 變化（Butterfly 切換深淺色時觸發） */
  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      if (m.attributeName === 'data-theme') {
        onThemeChange()
      }
    })
  })

  function init () {
    createPalette()
    onThemeChange()
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  }

  // 支援 Butterfly pjax
  if (typeof window.addEventListener === 'function') {
    // 初次載入
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init)
    } else {
      init()
    }
    // pjax 完成後重新初始化
    document.addEventListener('pjax:complete', init)
  }
})()
