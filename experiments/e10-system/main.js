// ES5. E10: leituras de rede/fontes e launch de apps de sistema voltados ao usuário.
(function () {
  'use strict';
  var URL = window.REPORT_URL || null;
  var out = document.getElementById('out');

  function send(path, data) {
    if (!URL) { return; }
    try { var x = new XMLHttpRequest(); x.open('POST', URL + path, true); x.send(JSON.stringify(data)); } catch (e) { /* */ }
  }
  function show(k, v) {
    out.textContent += k + ': ' + (typeof v === 'string' ? v : JSON.stringify(v)) + '\n';
    var d = {}; d[k] = v; send('/e10/read', d);
  }
  function tryCall(k, fn) {
    try { show(k, fn()); } catch (e) { show(k, 'ERRO ' + (e.name || '') + ': ' + e.message); }
  }
  // Só campos não identificadores (sem MAC/IP).
  function pick(o, keys) { var r = {}; keys.forEach(function (k) { r[k] = o[k]; }); return r; }
  function sysinfo(prop, keys) {
    try {
      tizen.systeminfo.getPropertyValue(prop, function (v) { show('systeminfo.' + prop, keys ? pick(v, keys) : v); },
        function (e) { show('systeminfo.' + prop, 'ERRO ' + e.name + ': ' + e.message); });
    } catch (e) { show('systeminfo.' + prop, 'EXC ' + (e.name || '') + ': ' + e.message); }
  }

  show('webapis', typeof window.webapis);
  show('webapis.network', typeof (window.webapis && webapis.network));
  show('tizen.tvwindow', typeof (window.tizen && tizen.tvwindow));
  show('tizen.systeminfo', typeof (window.tizen && tizen.systeminfo));

  // Rede: Tizen systeminfo e Samsung webapis.network.
  sysinfo('NETWORK', ['networkType']);
  sysinfo('WIFI_NETWORK', ['status', 'ssid', 'signalStrength']);
  sysinfo('ETHERNET_NETWORK', ['cable', 'status']);
  tryCall('webapis.network.getActiveConnectionType', function () { return webapis.network.getActiveConnectionType(); });
  tryCall('webapis.network.isConnectedToGateway', function () { return webapis.network.isConnectedToGateway(); });
  tryCall('webapis.network.getWiFiSsid', function () { return webapis.network.getWiFiSsid(); });
  tryCall('webapis.network.getWiFiSignalStrengthLevel', function () { return webapis.network.getWiFiSignalStrengthLevel(); });
  tryCall('navigator.onLine', function () { return navigator.onLine; });

  // Fontes.
  sysinfo('VIDEOSOURCE', null);
  tryCall('tvwindow.getSource', function () { return tizen.tvwindow.getSource(); });
  try {
    tizen.tvwindow.getAvailableWindows(function (w) { show('tvwindow.getAvailableWindows', w); },
      function (e) { show('tvwindow.getAvailableWindows', 'ERRO ' + e.message); });
  } catch (e) { show('tvwindow.getAvailableWindows', 'EXC ' + e.message); }

  // Candidatos (applist, evidence/raw-applist-*): só apps de usuário.
  var targets = [
    ['Configurações (coba.setting)', 'com.samsung.tv.coba.setting'],
    ['Fontes (coba.source)', 'com.samsung.tv.coba.source'],
    ['TV / última fonte (tv-viewer)', 'org.tizen.tv-viewer'],
    ['Menu (org.tizen.menu)', 'org.tizen.menu'],
    ['Quick panel', 'com.samsung.tv.quickpanel'],
    ['SMSourceAPP', 'org.tizen.SMSourceAPP'],
    ['Rede (NetworkSetting)', 'org.tizen.NetworkSetting-Tizen']
  ];
  var ul = document.getElementById('targets');
  var idx = 0;
  targets.forEach(function (t) { var li = document.createElement('li'); li.textContent = t[0] + '  —  ' + t[1]; ul.appendChild(li); });
  function paint() { for (var i = 0; i < ul.children.length; i++) { ul.children[i].className = i === idx ? 'focus' : ''; } }
  paint();

  function mark(i, ok, msg) {
    var li = ul.children[i];
    li.textContent = targets[i][0] + '  —  ' + targets[i][1] + '  →  ' + msg;
    li.style.color = ok ? '#6c6' : '#e66';
  }

  document.addEventListener('keydown', function (e) {
    if (e.keyCode === 38) { idx = (idx + targets.length - 1) % targets.length; paint(); }
    else if (e.keyCode === 40) { idx = (idx + 1) % targets.length; paint(); }
    else if (e.keyCode === 13) {
      var i = idx, id = targets[i][1];
      send('/e10/launch', { id: id, step: 'request' });
      try {
        tizen.application.launch(id, function () { mark(i, true, 'ok'); send('/e10/launch', { id: id, ok: true }); },
          function (er) { mark(i, false, er.name + ': ' + er.message); send('/e10/launch', { id: id, ok: false, error: er.name + ': ' + er.message }); });
      } catch (ex) { mark(i, false, 'EXC ' + ex.message); send('/e10/launch', { id: id, ok: false, error: String(ex) }); }
    } else if (e.keyCode === 10009) {
      tizen.application.getCurrentApplication().exit();
    }
  });
  document.addEventListener('visibilitychange', function () { send('/e10/visibility', { hidden: document.hidden }); });
}());
