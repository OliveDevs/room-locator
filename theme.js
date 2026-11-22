// Light or dark: follows the device until someone presses the button in the header, then remembers it on this browser.
(function () {
  var root = document.documentElement, saved = null;
  try { saved = localStorage.getItem('rl-theme'); } catch (e) {}
  if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
  var isDark = function () { var t = root.getAttribute('data-theme'); return t ? t === 'dark' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); };
  var MOON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M6.2 1.3a6.8 6.8 0 1 0 8.5 8.5A5.6 5.6 0 0 1 6.2 1.3z"/></svg>';
  var SUN = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.2" fill="currentColor"/><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 .9v1.8M8 13.3v1.8M.9 8h1.8M13.3 8h1.8M3 3l1.3 1.3M11.7 11.7 13 13M3 13l1.3-1.3M11.7 4.3 13 3"/></g></svg>';
  function draw(b) { var d = isDark(); b.innerHTML = (d ? SUN : MOON) + '<span>' + (d ? 'Light' : 'Dark') + '</span>'; b.setAttribute('aria-label', d ? 'Switch to light mode' : 'Switch to dark mode'); }
  document.addEventListener('DOMContentLoaded', function () {
    var nav = document.querySelector('.header-nav'); if (!nav) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'theme-toggle'; draw(b);
    b.addEventListener('click', function () { var next = isDark() ? 'light' : 'dark'; root.setAttribute('data-theme', next); try { localStorage.setItem('rl-theme', next); } catch (e) {} draw(b); });
    if (window.matchMedia) { var m = matchMedia('(prefers-color-scheme: dark)'); var f = function () { draw(b); }; if (m.addEventListener) m.addEventListener('change', f); }
    nav.appendChild(b);
  });
})();
