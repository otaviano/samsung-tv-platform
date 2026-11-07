// ES5. E8: o app mantém listeners com background-support="enable" e tenta reagir a teclas
// registradas mesmo escondido. Tudo vai para o report-sink com o estado de visibilidade.
(function () {
  'use strict';
  var URL = window.REPORT_URL || null;
  var SELF = 'E8BgTest01.ui';
  var statusEl = document.getElementById('status');

  function send(path, data) {
    data.hidden = document.hidden;
    data.t = Date.now();
    if (!URL) { return; }
    try {
      var x = new XMLHttpRequest();
      x.open('POST', URL + path, true);
      x.send(JSON.stringify(data));
    } catch (e) { /* best-effort */ }
  }

  // Quem nos abriu? (serviço de boot passa from=service)
  var from = 'user';
  try {
    var req = tizen.application.getCurrentApplication().getRequestedAppControl();
    var d = req && req.appControl && req.appControl.data;
    for (var i = 0; d && i < d.length; i++) { if (d[i].key === 'from') { from = d[i].value[0]; } }
  } catch (e) { from = 'erro: ' + e.message; }

  var registered = [];
  ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'MediaPlayPause', 'Exit', 'Info'].forEach(function (k) {
    try { tizen.tvinputdevice.registerKey(k); registered.push(k); } catch (e) { /* ausente */ }
  });
  send('/e8/boot', { from: from, registered: registered });
  statusEl.textContent = 'aberto por: ' + from + ' | teclas registradas: ' + registered.join(', ');

  function bringToFront(reason) {
    send('/e8/front', { reason: reason });
    try {
      tizen.application.launch(SELF, function () { send('/e8/front', { ok: true }); },
        function (e) { send('/e8/front', { ok: false, error: e.message }); });
    } catch (e) { send('/e8/front', { ok: false, error: String(e) }); }
  }

  // E8b: em vez de capturar tecla (impossível em background — E8a), observar o app que
  // abrimos. Quando ele fecha ou perde o primeiro plano, nos trazemos de volta.
  var launchedId = null;
  var returning = false;

  function runningIds() {
    return new Promise(function (resolve) {
      try {
        tizen.application.getAppsContext(function (ctxs) {
          resolve(ctxs.map(function (c) { return c.appId; }));
        }, function (e) { resolve(['erro: ' + e.message]); });
      } catch (e) { resolve(['exc: ' + String(e)]); }
    });
  }

  function comeBack(reason) {
    if (returning || !document.hidden) { return; }
    returning = true;
    bringToFront(reason);
    setTimeout(function () { returning = false; }, 5000);
  }

  var listenerId = null;
  try {
    listenerId = tizen.application.addAppStatusChangeListener(function (appId, isActive) {
      send('/e8/status', { appId: appId, isActive: isActive });
      if (launchedId && appId === launchedId && !isActive) { comeBack('listener: ' + appId + ' inativo'); }
    });
    send('/e8/status', { listener: 'ok', id: listenerId });
  } catch (e) {
    send('/e8/status', { listener: 'indisponível', error: String(e) });
  }

  // E9: ligar a TV deve trazer ESTE app para a frente, qualquer que seja o último app.
  // tizen.power não existe no perfil TV (medido). Sinais candidatos:
  //  (a) salto de relógio: processo congelado no standby -> 1º tique após ligar vê um gap;
  //  (b) eventos online/offline (Wi-Fi pode cair no standby);
  //  (c) systeminfo DISPLAY (se existir).
  function wake(reason) {
    send('/e9/wake', { reason: reason });
    setTimeout(function () {
      returning = false;
      if (document.hidden) { bringToFront('power-on: ' + reason); }
      else { send('/e9/wake', { note: 'já estávamos na frente' }); }
    }, 1500);
  }
  var lastTick = Date.now();
  setInterval(function () {
    var now = Date.now();
    var gap = now - lastTick;
    lastTick = now;
    if (gap > 10000) { wake('gap de ' + Math.round(gap / 1000) + ' s'); }
  }, 1000);
  window.addEventListener('online', function () { send('/e9/net', { online: true }); });
  window.addEventListener('offline', function () { send('/e9/net', { online: false }); });
  try {
    tizen.systeminfo.addPropertyValueChangeListener('DISPLAY', function (d) {
      send('/e9/display', { brightness: d.brightness });
    });
    send('/e9/display', { listener: 'ok' });
  } catch (e) {
    send('/e9/display', { listener: 'erro', error: String(e) });
  }

  document.addEventListener('keydown', function (e) {
    send('/e8/key', { keyCode: e.keyCode, key: e.key });
    var target = e.keyCode === 13 ? '5b8c3eb16b.BeamCTVDev' : e.keyCode === 403 ? 'org.tizen.netflix-app' : null;
    if (target && !document.hidden) {
      launchedId = target;
      try {
        var lid = tizen.application.addAppStatusChangeListener(function (appId, isActive) {
          send('/e8/status', { scoped: true, appId: appId, isActive: isActive });
          if (!isActive) { comeBack('listener por app: ' + appId + ' inativo'); }
        }, target);
        send('/e8/status', { scopedListener: 'ok', target: target, id: lid });
      } catch (err) {
        send('/e8/status', { scopedListener: 'erro', target: target, error: String(err) });
      }
      tizen.application.launch(launchedId, function () { send('/e8/launched', { ok: true }); },
        function (err) { send('/e8/launched', { ok: false, error: err.message }); });
    } else if (e.keyCode === 10009 && !document.hidden) {
      tizen.application.getCurrentApplication().exit();
    }
  });

  document.addEventListener('visibilitychange', function () { send('/e8/visibility', {}); });
  window.addEventListener('focus', function () { send('/e8/winfocus', { focus: true }); });
  window.addEventListener('blur', function () { send('/e8/winfocus', { focus: false }); });

  // Batimento: o processo segue vivo (e com JS rodando) em background?
  // Batimento + polling do contexto (fallback se o listener não existir/não disparar).
  // E8c: lista COMPLETA, reportada como diff (o que entrou/saiu), para achar um sinal de
  // "Smart Hub abriu". E teste de permissão: 15 s escondido -> tenta voltar sozinho, uma vez.
  var prev = null;
  var hiddenSince = null;
  var selfTestDone = false;
  document.addEventListener('visibilitychange', function () { hiddenSince = document.hidden ? Date.now() : null; });
  setInterval(function () {
    runningIds().then(function (ids) {
      var alive = launchedId ? ids.indexOf(launchedId) !== -1 : null;
      if (prev === null) {
        send('/e8/ctx', { full: ids });
      } else {
        var added = ids.filter(function (i) { return prev.indexOf(i) === -1; });
        var removed = prev.filter(function (i) { return ids.indexOf(i) === -1; });
        if (added.length || removed.length) { send('/e8/ctx', { added: added, removed: removed }); }
      }
      prev = ids;
      send('/e8/heartbeat', { running: ids.length, launchedAlive: alive });
      if (launchedId && alive === false) { comeBack('polling: ' + launchedId + ' saiu do contexto'); }
    });
  }, 3000);
}());
