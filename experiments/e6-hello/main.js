// ES5 de propósito: nada aqui pode depender do que estamos medindo.
(function () {
  'use strict';

  var REPORT_URL = window.REPORT_URL || null; // definido em report-target.js (gerado)

  function send(path, data) {
    if (!REPORT_URL) { return; }
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', REPORT_URL + path, true);
      xhr.setRequestHeader('Content-Type', 'text/plain');
      xhr.send(JSON.stringify(data));
    } catch (e) { /* relatório é best-effort */ }
  }

  function syntax(src) {
    try { new Function(src); return true; } catch (e) { return false; }
  }

  // CSS.supports('gap') responde pelo gap de GRID (Chrome 66) e dá falso positivo para
  // flex gap (Chrome 84). Só medindo o layout se sabe.
  function flexGap() {
    var d = document.createElement('div');
    d.style.cssText = 'display:flex;flex-direction:column;row-gap:1px;position:absolute;';
    d.appendChild(document.createElement('div'));
    d.appendChild(document.createElement('div'));
    document.body.appendChild(d);
    var ok = d.scrollHeight === 1;
    document.body.removeChild(d);
    return ok;
  }

  var checks = [
    ['userAgent', navigator.userAgent],
    ['screen', screen.width + 'x' + screen.height + ' dpr=' + window.devicePixelRatio],
    ['viewport', window.innerWidth + 'x' + window.innerHeight],
    ['tizen API', typeof window.tizen !== 'undefined'],
    ['webapis API', typeof window.webapis !== 'undefined'],
    ['async/await', syntax('async function f(){ await 1; }')],
    ['object spread', syntax('var a = {...{}};')],
    ['optional chaining', syntax('var a = null; a?.b;')],
    ['nullish coalescing', syntax('var a = null ?? 1;')],
    ['Promise.prototype.finally', typeof Promise.prototype.finally === 'function'],
    ['fetch', typeof window.fetch === 'function'],
    ['IntersectionObserver', typeof window.IntersectionObserver === 'function'],
    ['ResizeObserver', typeof window.ResizeObserver === 'function'],
    ['CSS grid', CSS.supports('display', 'grid')],
    ['CSS gap (flex, medido)', flexGap()],
    ['CSS custom properties', CSS.supports('--x', '0')],
    ['CSS :focus-visible', (function () { try { document.querySelector(':focus-visible'); return true; } catch (e) { return false; } })()],
    ['localStorage', (function () { try { localStorage.setItem('k', '1'); return true; } catch (e) { return false; } })()],
    ['indexedDB', typeof window.indexedDB !== 'undefined']
  ];

  var supportedKeys = [];
  var registered = [];
  if (window.tizen && tizen.tvinputdevice) {
    try {
      var ks = tizen.tvinputdevice.getSupportedKeys();
      for (var k = 0; k < ks.length; k++) { supportedKeys.push(ks[k].name + '=' + ks[k].code); }
      var want = ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
                  'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop',
                  'MediaRewind', 'MediaFastForward', 'ChannelUp', 'ChannelDown', 'Info'];
      for (var w = 0; w < want.length; w++) {
        try { tizen.tvinputdevice.registerKey(want[w]); registered.push(want[w]); } catch (e) { /* tecla ausente */ }
      }
    } catch (e) { supportedKeys.push('erro: ' + e.message); }
  }
  checks.push(['teclas suportadas', supportedKeys.length]);
  checks.push(['teclas registradas', registered.join(', ')]);

  var table = document.getElementById('report');
  var report = {};
  for (var i = 0; i < checks.length; i++) {
    var v = checks[i][1];
    var tr = document.createElement('tr');
    var cls = v === true ? 'ok' : v === false ? 'no' : '';
    tr.innerHTML = '<td>' + checks[i][0] + '</td><td class="' + cls + '"></td>';
    tr.lastChild.textContent = String(v);
    table.appendChild(tr);
    report[checks[i][0]] = v;
  }
  report.supportedKeys = supportedKeys;
  send('/report', report);

  var keysEl = document.getElementById('keys');
  keysEl.textContent += REPORT_URL ? ' (enviando para a estação)' : ' (sem REPORT_URL)';
  document.addEventListener('keydown', function (e) {
    keysEl.textContent = 'keydown: keyCode=' + e.keyCode + ' key=' + e.key;
    send('/key', { keyCode: e.keyCode, key: e.key, code: e.code });
    if (e.keyCode === 10009 && window.tizen) { // BACK
      setTimeout(function () { tizen.application.getCurrentApplication().exit(); }, 300);
    }
  });
}());
