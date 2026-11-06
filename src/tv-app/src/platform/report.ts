// Telemetria de DESENVOLVIMENTO para scripts/report-sink.py na estação.
// Em build de produção __REPORT_URL__ é null e isto vira no-op.
export function report(path: string, data: unknown): void {
  if (!__REPORT_URL__) return;
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', __REPORT_URL__ + path, true);
    xhr.setRequestHeader('Content-Type', 'text/plain');
    xhr.send(JSON.stringify(data));
  } catch {
    // best-effort
  }
}
