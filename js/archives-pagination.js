/**
 * Archives Per-Page Selector
 * Allows readers to choose 10, 20, or 50 items per page on the archives page.
 * Pure frontend solution - fetches all archive pages and handles pagination client-side.
 */
;(function () {
  'use strict'

  // Only run on archives pages
  var archiveEl = document.getElementById('archive')
  if (!archiveEl) return

  var PER_PAGE_OPTIONS = [10, 20, 50]
  var DEFAULT_PER_PAGE = 10
  var allItems = []        // { html, year, isYear }
  var currentPerPage = DEFAULT_PER_PAGE
  var currentPage = 1
  var totalPages = 1
  var fetched = false

  // ── Build UI ──────────────────────────────────────────────
  function buildSelector () {
    var wrapper = document.createElement('div')
    wrapper.className = 'archive-page-size'
    wrapper.innerHTML =
      '<span class="archive-page-size-label">' +
        '<i class="fas fa-layer-group"></i> 每頁顯示' +
      '</span>' +
      '<div class="archive-page-size-btns">' +
        PER_PAGE_OPTIONS.map(function (n) {
          return '<button class="archive-page-size-btn' +
            (n === DEFAULT_PER_PAGE ? ' active' : '') +
            '" data-size="' + n + '">' + n + ' 篇</button>'
        }).join('') +
      '</div>'

    // Insert before article-sort-title
    var titleEl = archiveEl.querySelector('.article-sort-title')
    if (titleEl) {
      archiveEl.insertBefore(wrapper, titleEl.nextSibling)
    } else {
      archiveEl.prepend(wrapper)
    }

    // Bind click
    wrapper.querySelectorAll('.archive-page-size-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var size = parseInt(this.getAttribute('data-size'), 10)
        if (size === currentPerPage) return
        wrapper.querySelectorAll('.archive-page-size-btn').forEach(function (b) {
          b.classList.remove('active')
        })
        this.classList.add('active')
        currentPerPage = size
        currentPage = 1
        render()
      })
    })

    return wrapper
  }

  // ── Fetch all archive pages ───────────────────────────────
  function collectCurrentPageItems () {
    var items = []
    var sortEl = archiveEl.querySelector('.article-sort')
    if (!sortEl) return items
    var children = sortEl.children
    for (var i = 0; i < children.length; i++) {
      var el = children[i]
      var isYear = el.classList.contains('year')
      items.push({
        html: el.outerHTML,
        year: isYear ? el.textContent.trim() : null,
        isYear: isYear
      })
    }
    return items
  }

  function fetchAllPages (callback) {
    // Determine total page count from existing pagination
    var paginationLinks = document.querySelectorAll('nav#pagination .pagination a.page-number')
    var maxPage = 1
    paginationLinks.forEach(function (link) {
      var num = parseInt(link.textContent, 10)
      if (!isNaN(num) && num > maxPage) maxPage = num
    })

    // Collect current page items first
    allItems = collectCurrentPageItems()

    if (maxPage <= 1) {
      fetched = true
      callback()
      return
    }

    // Determine current page number
    var currentArchivePage = 1
    var path = window.location.pathname
    var pageMatch = path.match(/\/page\/(\d+)/)
    if (pageMatch) currentArchivePage = parseInt(pageMatch[1], 10)

    // Fetch remaining pages
    var basePath = path.replace(/\/page\/\d+\/?/, '/').replace(/\/$/, '')
    var pending = 0
    var pageData = {}
    pageData[currentArchivePage] = allItems

    for (var p = 1; p <= maxPage; p++) {
      if (p === currentArchivePage) continue
      pending++
      ;(function (pageNum) {
        var url = pageNum === 1
          ? basePath + '/'
          : basePath + '/page/' + pageNum + '/'
        fetch(url)
          .then(function (r) { return r.text() })
          .then(function (html) {
            var parser = new DOMParser()
            var doc = parser.parseFromString(html, 'text/html')
            var sort = doc.querySelector('.article-sort')
            if (sort) {
              var items = []
              var children = sort.children
              for (var i = 0; i < children.length; i++) {
                var el = children[i]
                var isYear = el.classList.contains('year')
                items.push({
                  html: el.outerHTML,
                  year: isYear ? el.textContent.trim() : null,
                  isYear: isYear
                })
              }
              pageData[pageNum] = items
            }
          })
          .catch(function () {})
          .finally(function () {
            pending--
            if (pending === 0) {
              // Combine in order
              allItems = []
              for (var k = 1; k <= maxPage; k++) {
                if (pageData[k]) {
                  allItems = allItems.concat(pageData[k])
                }
              }
              // Deduplicate year headers
              deduplicateYears()
              fetched = true
              callback()
            }
          })
      })(p)
    }
  }

  function deduplicateYears () {
    var seenYears = {}
    allItems = allItems.filter(function (item) {
      if (item.isYear) {
        if (seenYears[item.year]) return false
        seenYears[item.year] = true
      }
      return true
    })
  }

  // ── Render ────────────────────────────────────────────────
  function getArticleItems () {
    return allItems.filter(function (item) { return !item.isYear })
  }

  function render () {
    var articles = getArticleItems()
    var total = articles.length
    totalPages = Math.ceil(total / currentPerPage)
    if (currentPage > totalPages) currentPage = totalPages
    if (currentPage < 1) currentPage = 1

    var start = (currentPage - 1) * currentPerPage
    var end = start + currentPerPage
    var pageArticles = articles.slice(start, end)

    // Determine which year headers we need
    var neededYears = {}
    pageArticles.forEach(function (a, idx) {
      // Find this article's index in allItems to determine its year
      var globalIdx = allItems.indexOf(a)
      // Walk backwards to find the year header
      for (var i = globalIdx - 1; i >= 0; i--) {
        if (allItems[i].isYear) {
          if (!neededYears[allItems[i].year]) {
            neededYears[allItems[i].year] = { beforeIdx: idx }
          }
          break
        }
      }
    })

    // Build HTML
    var htmlParts = []
    var insertedYears = {}
    pageArticles.forEach(function (a, idx) {
      // Check if we need to insert a year header before this article
      Object.keys(neededYears).forEach(function (year) {
        if (neededYears[year].beforeIdx === idx && !insertedYears[year]) {
          var yearItem = allItems.find(function (item) {
            return item.isYear && item.year === year
          })
          if (yearItem) htmlParts.push(yearItem.html)
          insertedYears[year] = true
        }
      })
      htmlParts.push(a.html)
    })

    // Update DOM
    var sortEl = archiveEl.querySelector('.article-sort')
    if (sortEl) {
      sortEl.innerHTML = htmlParts.join('')
    }

    // Update count in title
    var titleEl = archiveEl.querySelector('.article-sort-title')
    if (titleEl) {
      titleEl.textContent = 'Articles - ' + total
    }

    // Render pagination
    renderPagination()
  }

  function renderPagination () {
    var nav = document.querySelector('nav#pagination')
    if (!nav) {
      nav = document.createElement('nav')
      nav.id = 'pagination'
      archiveEl.appendChild(nav)
    }

    if (totalPages <= 1) {
      nav.innerHTML = ''
      return
    }

    var html = '<div class="pagination">'
    // Prev
    if (currentPage > 1) {
      html += '<a class="extend prev" href="javascript:;" data-page="' +
        (currentPage - 1) + '"><i class="fas fa-chevron-left fa-fw"></i></a>'
    }

    // Page numbers
    var range = buildPageRange(currentPage, totalPages)
    range.forEach(function (p) {
      if (p === '...') {
        html += '<span class="space">&hellip;</span>'
      } else if (p === currentPage) {
        html += '<span class="page-number current">' + p + '</span>'
      } else {
        html += '<a class="page-number" href="javascript:;" data-page="' + p + '">' + p + '</a>'
      }
    })

    // Next
    if (currentPage < totalPages) {
      html += '<a class="extend next" href="javascript:;" data-page="' +
        (currentPage + 1) + '"><i class="fas fa-chevron-right fa-fw"></i></a>'
    }
    html += '</div>'
    nav.innerHTML = html

    // Bind pagination clicks
    nav.querySelectorAll('[data-page]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault()
        currentPage = parseInt(this.getAttribute('data-page'), 10)
        render()
        // Scroll to top of archive
        archiveEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }

  function buildPageRange (current, total) {
    if (total <= 7) {
      var arr = []
      for (var i = 1; i <= total; i++) arr.push(i)
      return arr
    }
    var pages = [1]
    if (current > 3) pages.push('...')
    for (var j = Math.max(2, current - 1); j <= Math.min(total - 1, current + 1); j++) {
      pages.push(j)
    }
    if (current < total - 2) pages.push('...')
    pages.push(total)
    return pages
  }

  // ── Inject CSS ────────────────────────────────────────────
  function injectStyles () {
    var style = document.createElement('style')
    style.textContent =
      '.archive-page-size {' +
        'display: flex;' +
        'align-items: center;' +
        'justify-content: flex-end;' +
        'gap: 10px;' +
        'margin: -8px 0 16px 30px;' +
        'padding: 0;' +
      '}' +
      '.archive-page-size-label {' +
        'font-size: 0.88em;' +
        'color: var(--card-meta, #858585);' +
        'white-space: nowrap;' +
      '}' +
      '.archive-page-size-label i {' +
        'margin-right: 4px;' +
      '}' +
      '.archive-page-size-btns {' +
        'display: flex;' +
        'border-radius: 8px;' +
        'overflow: hidden;' +
        'border: 1px solid var(--btn-bg, #49b1f5);' +
      '}' +
      '.archive-page-size-btn {' +
        'padding: 4px 14px;' +
        'font-size: 0.84em;' +
        'border: none;' +
        'background: transparent;' +
        'color: var(--btn-bg, #49b1f5);' +
        'cursor: pointer;' +
        'transition: all 0.25s ease;' +
        'font-family: inherit;' +
        'line-height: 1.6;' +
        'border-right: 1px solid var(--btn-bg, #49b1f5);' +
      '}' +
      '.archive-page-size-btn:last-child {' +
        'border-right: none;' +
      '}' +
      '.archive-page-size-btn:hover {' +
        'background: var(--btn-bg, #49b1f5);' +
        'color: #fff;' +
        'opacity: 0.85;' +
      '}' +
      '.archive-page-size-btn.active {' +
        'background: var(--btn-bg, #49b1f5);' +
        'color: #fff;' +
        'font-weight: 600;' +
      '}' +
      '.archive-page-size-btn.loading {' +
        'pointer-events: none;' +
        'opacity: 0.6;' +
      '}' +
      '@media screen and (max-width: 768px) {' +
        '.archive-page-size {' +
          'margin-left: 10px;' +
          'gap: 6px;' +
        '}' +
        '.archive-page-size-btn {' +
          'padding: 3px 10px;' +
          'font-size: 0.8em;' +
        '}' +
      '}'
    document.head.appendChild(style)
  }

  // ── Init ──────────────────────────────────────────────────
  function init () {
    injectStyles()
    var selectorEl = buildSelector()

    // Show loading state on non-default buttons
    selectorEl.querySelectorAll('.archive-page-size-btn:not(.active)').forEach(function (btn) {
      btn.classList.add('loading')
    })

    // Fetch all pages in the background
    fetchAllPages(function () {
      // Remove loading state
      selectorEl.querySelectorAll('.archive-page-size-btn').forEach(function (btn) {
        btn.classList.remove('loading')
      })
    })
  }

  // Handle Pjax (Butterfly theme uses pjax)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  // Re-init on pjax
  document.addEventListener('pjax:complete', function () {
    allItems = []
    fetched = false
    currentPage = 1
    currentPerPage = DEFAULT_PER_PAGE
    var archiveCheck = document.getElementById('archive')
    if (archiveCheck) {
      archiveEl = archiveCheck
      init()
    }
  })
})()
