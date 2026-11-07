// E8: serviço web com on-boot="true". Ao iniciar, abre a UI marcando from=service.
// Runtime de serviço não tem window/XMLHttpRequest: relatório via módulo http.
var REPORT_URL = null;
try { REPORT_URL = require('../report-target.js'); } catch (e) { /* sem relatório */ }

function report(path, data) {
  if (!REPORT_URL) { return; }
  try {
    var u = require('url').parse(REPORT_URL + path);
    var req = require('http').request({ hostname: u.hostname, port: u.port, path: u.path, method: 'POST' });
    req.on('error', function () {});
    data.t = Date.now();
    req.end(JSON.stringify(data));
  } catch (e) { /* best-effort */ }
}

function openUi(attempt) {
  report('/e8/svc', {
    ev: 'openUi',
    attempt: attempt,
    hasTizen: typeof tizen !== 'undefined',
    hasAppControl: typeof tizen !== 'undefined' && typeof tizen.ApplicationControl,
  });
  // Variante A: launch simples. Variante B: launchAppControl com from=service.
  try {
    tizen.application.launch('E8BgTest01.ui',
      function () { report('/e8/svc', { ev: 'A-ok', attempt: attempt }); },
      function (e) { report('/e8/svc', { ev: 'A-err', attempt: attempt, error: e.name + ': ' + e.message }); });
    report('/e8/svc', { ev: 'A-called', attempt: attempt });
  } catch (e) {
    report('/e8/svc', { ev: 'A-exception', attempt: attempt, error: String(e) });
  }
  try {
    var ctrl = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null,
      [new tizen.ApplicationControlData('from', ['service'])]);
    tizen.application.launchAppControl(ctrl, 'E8BgTest01.ui',
      function () { report('/e8/svc', { ev: 'B-ok', attempt: attempt }); },
      function (e) { report('/e8/svc', { ev: 'B-err', attempt: attempt, error: e.name + ': ' + e.message }); });
    report('/e8/svc', { ev: 'B-called', attempt: attempt });
  } catch (e) {
    report('/e8/svc', { ev: 'B-exception', attempt: attempt, error: String(e) });
  }
}

module.exports.onStart = function () {
  report('/e8/svc', { ev: 'onStart' });
  openUi(1);
  // Segunda tentativa atrasada: no boot real a UI pode ainda não estar pronta.
  setTimeout(function () { openUi(2); }, 15000);
};
module.exports.onRequest = function () { report('/e8/svc', { ev: 'onRequest' }); };
module.exports.onExit = function () { report('/e8/svc', { ev: 'onExit' }); };
