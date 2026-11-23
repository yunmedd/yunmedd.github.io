/* 병원 홈페이지 베이스 — interactions (vanilla, no dependencies) */
(function () {
  'use strict';
  var d = document, w = window, root = d.documentElement;
  root.classList.remove('no-js');
  var reduce = w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = w.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };

  /* ---------- Live clinic status (Asia/Seoul) ---------- */
  // 0=Sun … 6=Sat. Times in minutes.
  // 병원별 진료시간·제목 정리 규칙은 페이지의 #clinicData(JSON, build.py가 clinic.py에서 생성)에서 읽음
  var CLINIC = {}; try { CLINIC = JSON.parse(($('#clinicData') || {}).textContent || '{}'); } catch (e) { }
  var HOURS = CLINIC.hours || {
    1: [[540, 750], [840, 1080]], 2: [[540, 750], [840, 1080]], 4: [[540, 750], [840, 1080]], 5: [[540, 750], [840, 1080]],
    3: [[540, 750]], 6: [[540, 750]], 0: []
  };
  var DAYKEY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  // 공휴일(관공서 기준). 매년 12월에 다음 해 목록을 추가하세요.
  var HOLIDAYS = {
    '2026-12-25': '성탄절',
    '2027-01-01': '신정', '2027-02-06': '설날 연휴', '2027-02-07': '설날', '2027-02-08': '설날 연휴', '2027-02-09': '대체공휴일',
    '2027-03-01': '삼일절', '2027-05-01': '노동절', '2027-05-03': '대체공휴일', '2027-05-05': '어린이날', '2027-05-13': '부처님오신날',
    '2027-06-06': '현충일', '2027-07-17': '제헌절', '2027-07-19': '대체공휴일', '2027-08-15': '광복절', '2027-08-16': '대체공휴일',
    '2027-09-14': '추석 연휴', '2027-09-15': '추석', '2027-09-16': '추석 연휴', '2027-10-03': '개천절', '2027-10-04': '대체공휴일',
    '2027-10-09': '한글날', '2027-10-11': '대체공휴일', '2027-12-25': '성탄절', '2027-12-27': '대체공휴일'
  };
  function ymd(d) { return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
  function seoulDate(offsetDays) { var t = new Date(Date.now() + 9 * 3600e3 + (offsetDays || 0) * 864e5); return ymd(t); }
  function seoulNow() {
    var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    var o = {}; parts.forEach(function (p) { o[p.type] = p.value; });
    var map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { day: map[o.weekday], min: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10) };
  }
  function fmt(m) { var h = Math.floor(m / 60), mm = m % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }
  function nextOpen(day, min) {
    for (var i = 0; i < 14; i++) {
      var dd = (day + i) % 7, slots = HOLIDAYS[seoulDate(i)] ? [] : HOURS[dd];
      for (var j = 0; j < slots.length; j++) {
        if (i > 0 || slots[j][0] > min) {
          var label = i === 0 ? '오늘' : i === 1 ? '내일' : ['일', '월', '화', '수', '목', '금', '토'][dd] + '요일';
          return label + ' ' + fmt(slots[j][0]);
        }
      }
    }
    return '';
  }
  function status() {
    var n = seoulNow(), hol = HOLIDAYS[seoulDate(0)], s = hol ? [] : HOURS[n.day], st = { cls: 'is-closed', text: '', short: '', today: '' };
    if (hol) { st.cls = 'is-closed is-holiday'; st.today = '휴진'; st.text = hol + ' 휴진 · ' + nextOpen(n.day, n.min) + ' 진료'; st.short = '공휴일 휴진'; return st; }
    if (s.length) st.today = fmt(s[0][0]) + ' – ' + fmt(s[s.length - 1][1]); else st.today = '휴진';
    for (var i = 0; i < s.length; i++) {
      if (n.min >= s[i][0] && n.min < s[i][1]) {
        st.cls = 'is-open';
        st.text = '지금 진료 중 · ' + fmt(s[i][1]) + (i === 0 && s.length > 1 ? ' 점심시간' : ' 진료 마감');
        st.short = '진료 중';
        return st;
      }
    }
    if (s.length > 1 && n.min >= s[0][1] && n.min < s[1][0]) {
      st.cls = 'is-break'; st.text = '점심시간 · ' + fmt(s[1][0]) + ' 진료 재개'; st.short = '점심시간'; return st;
    }
    st.text = '진료 시간 외 · ' + nextOpen(n.day, n.min) + ' 진료'; st.short = '진료 시간 외';
    return st;
  }
  function paintStatus() {
    var st = status(), n = seoulNow();
    $$('[data-status]').forEach(function (el) {
      el.classList.remove('is-open', 'is-break', 'is-closed', 'is-holiday'); st.cls.split(' ').forEach(function (c) { el.classList.add(c); });
      var t = $('[data-status-text]', el); if (t) t.textContent = st.text;
    });
    $$('[data-today-hours]').forEach(function (el) { el.textContent = st.today; });
    $$('[data-status-short]').forEach(function (el) { el.textContent = st.short; });
    $$('.hrow[data-days]').forEach(function (r) {
      r.classList.toggle('today', r.getAttribute('data-days').split(',').indexOf(DAYKEY[n.day]) > -1);
    });
  }
  paintStatus(); setInterval(paintStatus, 60000);

  /* ---------- Header hide/show, progress, to-top ---------- */
  var header = $('#hdr'), bar = $('.progress span'), toTop = $('#toTop'), mbar = $('.mbar');
  var ringC = toTop ? $('circle.p', toTop) : null, CIRC = 2 * Math.PI * 25;
  if (ringC) { ringC.style.strokeDasharray = CIRC; ringC.style.strokeDashoffset = CIRC; }
  var lastY = w.scrollY, ticking = false;
  function onScroll() {
    var y = w.scrollY, h = root.scrollHeight - w.innerHeight, p = h > 0 ? y / h : 0;
    if (header) {
      header.classList.toggle('scrolled', y > 10);
      var drawerOpen = root.classList.contains('drawer-open');
      void drawerOpen; // header stays visible (v8)
      root.classList.toggle('hdr-hidden', header.classList.contains('hide'));
    }
    if (mbar) { if (y > lastY + 6 && y > 300) mbar.classList.add('hide'); else if (y < lastY - 6) mbar.classList.remove('hide'); }
    if (bar) bar.style.transform = 'scaleX(' + p + ')';
    if (toTop) { toTop.classList.toggle('show', y > 700); if (ringC) ringC.style.strokeDashoffset = CIRC * (1 - p); }
    parallax(y); statement();
    lastY = y; ticking = false;
  }
  w.addEventListener('scroll', function () { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
  if (toTop) toTop.addEventListener('click', function () { w.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });

  /* ---------- Hero parallax ---------- */
  var doc = $('.stage-doc'), stage = $('.stage'), floats = $$('.stage .float');
  var mx = 0, my = 0;
  function parallax(y) {
    if (reduce || !doc || y > 1200) return;
    doc.style.transform = 'translate3d(calc(-50% + ' + (mx * 10) + 'px),' + (y * 0.06 + my * 6) + 'px,0)';
    floats.forEach(function (f, i) { f.style.translate = (mx * (i % 2 ? -14 : 14)) + 'px ' + (-y * (0.05 + i * 0.02) + my * -8) + 'px'; });
  }
  if (stage && finePointer && !reduce) {
    stage.addEventListener('pointermove', function (e) {
      var r = stage.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5; parallax(w.scrollY);
    });
    stage.addEventListener('pointerleave', function () { mx = 0; my = 0; parallax(w.scrollY); });
  }

  /* ---------- Statement scroll-highlight ---------- */
  var words = $$('.statement .w'), stmt = $('.statement');
  function statement() {
    if (!stmt || !words.length) return;
    var r = stmt.getBoundingClientRect(), vh = w.innerHeight;
    var p = (vh * 0.85 - r.top) / (r.height + vh * 0.35);
    p = Math.max(0, Math.min(1, p));
    var k = Math.round(p * words.length);
    for (var i = 0; i < words.length; i++) words[i].classList.toggle('on', i < k);
  }
  if (reduce) words.forEach(function (x) { x.classList.add('on'); });

  /* ---------- Reveal on scroll ---------- */
  var io = 'IntersectionObserver' in w ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;
  $$('[data-r], .steps, .jsteps, .doc-photo').forEach(function (el) { if (io && !reduce) io.observe(el); else el.classList.add('in'); });
  // auto-stagger children of [data-stagger]
  $$('[data-stagger]').forEach(function (g) { $$('[data-r]', g).forEach(function (c, i) { c.style.setProperty('--d', i % 8); }); });

  /* ---------- Hero intro ---------- */
  requestAnimationFrame(function () { setTimeout(function () { root.classList.add('is-ready'); }, 80); });

  /* ---------- Active nav by section ---------- */
  var navLinks = $$('.nav a[href^="#"]');
  if (navLinks.length && io) {
    var secIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) navLinks.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach(function (a) { var s = $(a.getAttribute('href')); if (s) secIO.observe(s); });
  }

  /* ---------- Drawer ---------- */
  var openBtn = $('#menuBtn'), closeBtn = $('#menuClose'), shade = $('.drawer-shade'), drawer = $('#drawer');
  function setDrawer(open) {
    root.classList.toggle('drawer-open', open);
    if (openBtn) openBtn.setAttribute('aria-expanded', open);
    if (drawer) { drawer.setAttribute('aria-hidden', !open); if (open) drawer.removeAttribute('inert'); else drawer.setAttribute('inert', ''); }
    d.body.style.overflow = open ? 'hidden' : '';
    if (open && closeBtn) setTimeout(function () { closeBtn.focus(); }, 300);
  }
  if (openBtn) openBtn.addEventListener('click', function () { setDrawer(true); });
  if (closeBtn) closeBtn.addEventListener('click', function () { setDrawer(false); openBtn && openBtn.focus(); });
  if (shade) shade.addEventListener('click', function () { setDrawer(false); });
  $$('#drawer nav a').forEach(function (a) { a.addEventListener('click', function () { setDrawer(false); }); });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('drawer-open')) setDrawer(false); });

  /* ---------- Card spotlight + magnetic buttons ---------- */
  if (finePointer && !reduce) {
    $$('.fcard').forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
    $$('[data-magnetic]').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
        b.style.transform = 'translate(' + x * 0.18 + 'px,' + y * 0.28 + 'px)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });
  }

  /* ---------- Field filter chips: matched cards move to the front, first one expands ---------- */
  var chips = $$('.chip[data-f]'), grid = $('#fieldGrid'), cards = $$('.fcard[data-tags]');
  cards.forEach(function (c, i) { c.dataset.order = i; });
  function applyFilter(f, ch) {
    if (!grid) return;
    var first = new Map();
    cards.forEach(function (c) { first.set(c, c.getBoundingClientRect()); });
    var hits = [], rest = [];
    cards.forEach(function (c) {
      var hit = f === 'all' || c.getAttribute('data-tags').split(' ').indexOf(f) > -1;
      (hit ? hits : rest).push(c);
      c.classList.toggle('dim', !hit); c.classList.toggle('match', hit && f !== 'all'); c.classList.remove('feature');
      c.classList.add('in');
    });
    // 칩의 대표 진료분야(data-tags 첫 단어가 칩과 같은 카드)를 맨 앞에 — 예: '피로·갱년기'는 갱년기 카드가 먼저
    var primary = function (c) { return c.getAttribute('data-tags').split(' ')[0] === f ? 0 : 1; };
    hits.sort(function (a, b) { return primary(a) - primary(b) || a.dataset.order - b.dataset.order; });
    var order = f === 'all' ? cards.slice().sort(function (a, b) { return a.dataset.order - b.dataset.order; }) : hits.concat(rest);
    order.forEach(function (c) { grid.appendChild(c); });
    if (f !== 'all' && hits[0]) hits[0].classList.add('feature');
    if (!reduce) {
      cards.forEach(function (c) {
        var a = first.get(c), b = c.getBoundingClientRect();
        var dx = a.left - b.left, dy = a.top - b.top;
        if (!dx && !dy) return;
        c.style.transition = 'none'; c.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        requestAnimationFrame(function () { requestAnimationFrame(function () {
          c.style.transition = 'transform .65s cubic-bezier(.16,1,.3,1), opacity .4s, filter .4s, box-shadow .4s';
          c.style.transform = '';
          setTimeout(function () { c.style.transition = ''; }, 700);
        }); });
      });
    }
    // bring the result into view (mobile: the grid may be off-screen)
    var gr = grid.getBoundingClientRect(), off = (root.classList.contains('hdr-hidden') ? 0 : header ? header.offsetHeight : 0) + (($('.chips-wrap') || {}).offsetHeight || 0) + 24;
    if (f !== 'all' && (gr.top < off - 10 || gr.top > w.innerHeight * 0.55)) {
      w.scrollTo({ top: w.scrollY + gr.top - off, behavior: reduce ? 'auto' : 'smooth' });
    }
    var live = $('#fieldLive'); if (live) live.textContent = f === 'all' ? '전체 진료분야 표시' : (ch ? ch.textContent.trim() : '') + ' 관련 진료분야 ' + hits.length + '개를 앞으로 정렬';
  }
  chips.forEach(function (ch) {
    ch.addEventListener('click', function () {
      var f = ch.getAttribute('data-f');
      chips.forEach(function (c) { c.setAttribute('aria-pressed', c === ch); });
      var strip = ch.parentNode;
      if (strip && strip.scrollWidth > strip.clientWidth) strip.scrollTo({ left: Math.max(0, ch.offsetLeft - (strip.clientWidth - ch.offsetWidth) / 2), behavior: reduce ? 'auto' : 'smooth' });
      applyFilter(f, ch);
    });
  });

  /* ---------- Exam tabs (desktop list + mobile chips share state) ---------- */
  var exTabs = $$('.ex-tab'), exChips = $$('.ex-chip'), exPanels = $$('.ex-panel'), ind = $('.ex-ind');
  function moveInd(t) { if (!ind || !t || !t.offsetHeight) return; ind.style.height = t.offsetHeight + 'px'; ind.style.transform = 'translateY(' + t.offsetTop + 'px)'; }
  function selectEx(i, focus, from) {
    exTabs.forEach(function (t, k) { t.setAttribute('aria-selected', k === i); t.tabIndex = k === i ? 0 : -1; });
    exChips.forEach(function (t, k) { t.setAttribute('aria-selected', k === i); t.tabIndex = k === i ? 0 : -1; });
    exPanels.forEach(function (p, k) {
      if (k === i) { p.hidden = false; p.classList.remove('enter'); void p.offsetWidth; p.classList.add('enter'); } else p.hidden = true;
    });
    moveInd(exTabs[i]);
    var list = from === 'chip' ? exChips : exTabs;
    if (focus && list[i]) list[i].focus();
    var strip = $('.ex-chips');
    if (strip && exChips[i]) {
      var c = exChips[i], target = c.offsetLeft - (strip.clientWidth - c.offsetWidth) / 2;
      strip.scrollTo({ left: Math.max(0, target), behavior: reduce ? 'auto' : 'smooth' });
    }
    var sec = $('#exams'); if (sec && sec.scrollLeft) sec.scrollLeft = 0;
  }
  function keyNav(list, from) {
    list.forEach(function (t, i) {
      t.addEventListener('click', function () { selectEx(i, false, from); });
      t.addEventListener('keydown', function (e) {
        var n = list.length, k = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') k = (i + 1) % n;
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') k = (i - 1 + n) % n;
        else if (e.key === 'Home') k = 0; else if (e.key === 'End') k = n - 1;
        if (k !== null) { e.preventDefault(); selectEx(k, true, from); }
      });
    });
  }
  if (exPanels.length) { keyNav(exTabs, 'tab'); keyNav(exChips, 'chip'); moveInd(exTabs[0]); w.addEventListener('resize', function () { moveInd($('.ex-tab[aria-selected="true"]')); }); w.addEventListener('load', function () { moveInd($('.ex-tab[aria-selected="true"]')); }); }

  /* ---------- Insight tabs ---------- */
  var tabs = $$('.tab'), tind = $('.tabs-ind');
  function moveT(t) { if (tind && t) { tind.style.width = t.offsetWidth + 'px'; tind.style.transform = 'translateX(' + t.offsetLeft + 'px)'; } }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      tabs.forEach(function (x) { var on = x === t; x.setAttribute('aria-selected', on); var p = $('#' + x.getAttribute('aria-controls')); if (p) p.hidden = !on; });
      moveT(t);
      var p = $('#' + t.getAttribute('aria-controls')); if (p) $$('[data-r]', p).forEach(function (c) { c.classList.add('in'); });
    });
  });
  if (tabs.length) { moveT(tabs[0]); w.addEventListener('resize', function () { moveT($('.tab[aria-selected="true"]')); }); w.addEventListener('load', function () { moveT($('.tab[aria-selected="true"]')); }); }

  /* ---------- Accordion (single open) ---------- */
  $$('.acc-q').forEach(function (q) {
    q.addEventListener('click', function () {
      var item = q.closest('.acc-item'), open = !item.classList.contains('open');
      $$('.acc-item.open').forEach(function (o) { o.classList.remove('open'); $('.acc-q', o).setAttribute('aria-expanded', 'false'); });
      item.classList.toggle('open', open); q.setAttribute('aria-expanded', open);
    });
  });

  /* ---------- Blog feed (RSS cache + thumbnails via GitHub Actions) ---------- */
  var feed = $('#feed'), insGrid = $('#curGrid') || $('#p-cur .ins-grid'), data = $('#feedData');
  var THUMB_RE = /^assets\/blog-thumbs\/[\w-]+\.webp$/, URL_RE = /^https:\/\/(m\.)?blog\.naver\.com\//;
  var ARW = '<svg class="ico" aria-hidden="true"><use href="#i-arrow-ur"/></svg>';
  function esc(t) { return String(t || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var STRIP = (CLINIC.strip || []).map(function (p) { try { return new RegExp(p); } catch (e) { return null; } }).filter(Boolean);
  function ctitle(t) { t = String(t || ''); STRIP.forEach(function (re) { t = t.replace(re, ''); }); return t; } // 지역 키워드 머리말·병원명 꼬리는 카드에서만 생략
  function ddot(s) { return String(s || '').replace(/-/g, '.'); }
  function renderFeed(j) {
    if (!j || !j.posts || !j.posts.length) return;
    var posts = j.posts.filter(function (p) { return URL_RE.test(p.url || ''); });
    var withT = posts.filter(function (p) { return THUMB_RE.test(p.thumb || ''); }), top = [];
    if (insGrid && withT.length >= 3) {
      top = withT.slice(0, 3);
      var have = $$('a', insGrid).map(function (a) { return a.getAttribute('href'); }).join('|');
      if (have !== top.map(function (p) { return p.url; }).join('|')) insGrid.innerHTML = top.map(function (p) {
        return '<a class="icard bcard in" href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer"><div class="icard-vis ph"><img src="' + p.thumb + '" alt="" width="480" height="480" loading="lazy" decoding="async"></div><div class="icard-body"><small>' + esc(ddot(p.date)) + (p.cat ? ' · ' + esc(p.cat) : '') + '</small><h3>' + esc(ctitle(p.title)) + '</h3><span class="link-arrow">블로그에서 읽기' + ARW + '</span></div></a>';
      }).join('');
      var t1 = $('#t-cur'); if (t1 && t1.textContent !== '최신 건강칼럼') { t1.textContent = '최신 건강칼럼'; w.dispatchEvent(new Event('resize')); }
    }
    if (!feed) return;
    var rest = posts.filter(function (p) { return top.indexOf(p) < 0; }).slice(0, 6);
    if (!rest.length) return;
    feed.innerHTML = rest.map(function (p) {
      var th = THUMB_RE.test(p.thumb || '') ? '<img class="fth" src="' + p.thumb + '" alt="" width="64" height="64" loading="lazy" decoding="async">' : '';
      return '<a href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer"' + (th ? ' class="th"' : '') + '>' + th + '<span class="ftx"><span class="fd">' + esc(ddot(p.date)) + (p.cat ? '<em>' + esc(p.cat) + '</em>' : '') + '</span><strong>' + esc(ctitle(p.title)) + '</strong></span>' + ARW + '</a>';
    }).join('');
  }
  if (feed || insGrid) {
    try { renderFeed(JSON.parse(data.textContent)); } catch (e) { }
    if (location.protocol.indexOf('http') === 0) {
      fetch('assets/blog-feed.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(renderFeed).catch(function () { });
    }
  }

  /* ---------- Blog notices (진료안내 category / [휴진]·[진료안내] title) ----------
     v1.7 노출 기간: 제목의 '12월'·'12월 25일'로 대상 월을 읽어
     · 대상 월 1일 기준 8일 전(= 전달 말일 7일 전) 0시부터 노출 → 말일 7일 전부터는 당월 + 다음 달 공지가 함께 보임
     · 끝: 날짜가 있으면 그 날, 월만 있으면 그 달 말일 (게시 후 최대 60일)
     · 월이 없는 공지: 게시일부터 14일 */
  function kst(y, mo, d, end) { return new Date(y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2) + (end ? 'T23:59:59+09:00' : 'T00:00:00+09:00')); }
  function noticeWin(n) {
    var pub = n.date ? new Date(n.date + 'T00:00:00+09:00') : new Date(), py = pub.getFullYear(), pm = pub.getMonth() + 1;
    var yr = function (mo) { return mo < pm - 6 ? py + 1 : py; };   // 11월 게시글의 '1월'은 다음 해
    var first = null, end = null, m, re = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/g;
    while ((m = re.exec(n.title))) {
      var mo = +m[1], dd = +m[2]; if (mo < 1 || mo > 12) continue;
      var e = kst(yr(mo), mo, dd, true);
      if (isNaN(e)) continue;
      if (!end || e > end) end = e;
      if (!first || e < first.at) first = { at: e, y: yr(mo), mo: mo };
    }
    if (!first) { // '11월 진료안내'처럼 월만 있으면 그 달 말일까지
      var mm = /(\d{1,2})\s*월(?!\s*\d)/.exec(n.title);
      if (mm && +mm[1] >= 1 && +mm[1] <= 12) {
        var m2 = +mm[1], y2 = yr(m2);
        first = { y: y2, mo: m2 };
        end = kst(y2, m2, new Date(y2, m2, 0).getDate(), true);
      }
    }
    var start = pub, mon = 0;
    if (first) {
      var s0 = new Date(kst(first.y, first.mo, 1).getTime() - 8 * 864e5);   // 전달 말일 7일 전 0시
      if (s0 > start) start = s0;
      mon = first.mo;
    } else end = new Date(pub.getTime() + 14 * 864e5);
    var cap = new Date(pub.getTime() + 60 * 864e5);
    return { start: start, end: end > cap ? cap : end, mon: mon };
  }
  function renderNotices(j) {
    if (!j || !j.notices) return;
    var now = new Date(), live = [];
    j.notices.forEach(function (n) {
      if (!n || !n.title || !n.url) return;
      var w = noticeWin(n);
      if (w.start <= now && now <= w.end) live.push({ n: n, w: w });
    });
    live.sort(function (a, b) { return a.w.start - b.w.start || (b.n.date || '').localeCompare(a.n.date || ''); });   // 당월 → 다음 달
    live = live.slice(0, 3).map(function (x) { x.n.mon = x.w.mon; return x.n; });
    var bar = $('#noticeBar'), card = $('[data-notice-card]');
    var esc = function (t) { var d0 = d.createElement('div'); d0.textContent = t; return d0.innerHTML; };
    var safe = function (u) { return /^https:\/\/(m\.)?blog\.naver\.com\//.test(u) ? u : '#'; };
    if (!live.length) { if (bar) bar.hidden = true; if (card) card.hidden = true; return; }
    var top = live.slice(0, 2), key = top.map(function (n) { return n.url; }).join('|');
    var dismissed = ''; try { dismissed = sessionStorage.getItem('noticeHide') || ''; } catch (e) { }
    if (bar && dismissed !== key) {
      bar.classList.toggle('two', top.length > 1);
      bar.innerHTML = '<b>공지</b>' + top.map(function (n) { return '<a href="' + safe(n.url) + '" target="_blank" rel="noopener noreferrer">' + esc(n.title) + '</a>'; }).join('')
        + (top.length === 1 && top[0].date ? '<time>' + esc(top[0].date.replace(/-/g, '.')) + '</time>' : '')
        + '<button type="button" aria-label="공지 닫기"><svg class="ico" aria-hidden="true"><use href="#i-x"/></svg></button>';
      bar.hidden = false;
      $('button', bar).addEventListener('click', function () { bar.hidden = true; try { sessionStorage.setItem('noticeHide', key); } catch (e) { } });
    }
    if (card) {
      card.innerHTML = '<b>진료 공지</b>' + live.map(function (n) { return '<a href="' + safe(n.url) + '" target="_blank" rel="noopener noreferrer">' + (n.mon && n.title.trim().indexOf(n.mon + '월') !== 0 ? '<em>' + n.mon + '월</em>' : '') + esc(n.title) + (n.date ? '<small>' + esc(n.date.replace(/-/g, '.')) + ' 블로그 공지</small>' : '') + '</a>'; }).join('');
      card.hidden = false;
    }
  }
  (function () {
    var data = $('#feedData'); if (!data) return;
    try { renderNotices(JSON.parse(data.textContent)); } catch (e) { }
    if (location.protocol.indexOf('http') === 0) fetch('assets/blog-feed.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(renderNotices).catch(function () { });
  })();

  /* ---------- Gallery filter + lightbox ---------- */
  var gal = $('#gallery'), gtabs = $$('.gtab'), lb = $('#lightbox');
  if (gal) {
    var tiles = $$('.gtile', gal), vis = tiles.slice(), cur = 0, lastFocus = null;
    gtabs.forEach(function (t) {
      t.addEventListener('click', function () {
        var g = t.getAttribute('data-g');
        gtabs.forEach(function (x) { x.setAttribute('aria-pressed', x === t); });
        vis = [];
        tiles.forEach(function (el) {
          var on = g === 'all' || el.getAttribute('data-g') === g;
          el.classList.toggle('gone', !on); el.classList.remove('lead', 'pop');
          if (on) { vis.push(el); void el.offsetWidth; el.classList.add('pop'); el.style.animationDelay = (vis.length - 1) * 50 + 'ms'; }
        });
        if (vis[0]) vis[0].classList.add('lead');
      });
    });
    var lbImg = lb && $('img', lb), lbT = lb && $('strong', lb), lbD = lb && $('figcaption span', lb), lbN = lb && $('figcaption em', lb);
    function show(i) {
      cur = (i + vis.length) % vis.length; var el = vis[cur];
      lbImg.classList.add('swap');
      var img = new Image(); img.onload = function () { lbImg.src = img.src; lbImg.alt = ((($('.logo img') || {}).alt || '') + ' ' + el.dataset.title).trim(); lbImg.classList.remove('swap'); };
      img.src = el.dataset.full;
      lbT.textContent = el.dataset.title; lbD.textContent = el.dataset.desc; lbN.textContent = (cur + 1) + ' / ' + vis.length;
    }
    function openLb(i) {
      lastFocus = d.activeElement; lb.hidden = false; requestAnimationFrame(function () { lb.classList.add('open'); });
      d.body.style.overflow = 'hidden'; show(i); $('.lb-close', lb).focus();
    }
    function closeLb() { lb.classList.remove('open'); setTimeout(function () { lb.hidden = true; }, 300); d.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); }
    tiles.forEach(function (el) { el.addEventListener('click', function () { openLb(vis.indexOf(el)); }); });
    if (lb) {
      $('.lb-close', lb).addEventListener('click', closeLb);
      $('.lb-prev', lb).addEventListener('click', function () { show(cur - 1); });
      $('.lb-next', lb).addEventListener('click', function () { show(cur + 1); });
      lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
      d.addEventListener('keydown', function (e) {
        if (lb.hidden) return;
        if (e.key === 'Escape') closeLb(); else if (e.key === 'ArrowLeft') show(cur - 1); else if (e.key === 'ArrowRight') show(cur + 1);
        else if (e.key === 'Tab') { var f = $$('button', lb), a = f[0], z = f[f.length - 1]; if (e.shiftKey && d.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && d.activeElement === z) { e.preventDefault(); a.focus(); } }
      });
      var sx = null;
      lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
      lb.addEventListener('touchend', function (e) { if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1)); sx = null; });
    }
  }

  onScroll();
})();
