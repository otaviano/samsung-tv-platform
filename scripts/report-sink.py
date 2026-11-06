#!/usr/bin/env python3
"""Receptor HTTP mínimo para relatórios enviados por apps de teste na TV (E6+).

Escuta em HOST:PORT, aceita POST com corpo texto/JSON e grava cada um como uma linha
em evidence/raw-tv-report-<data>.log (gitignored). Também imprime no stdout.
Aceita apenas requisições vindas de TV_IP (device.env). Uso:

    scripts/report-sink.py            # porta 8765
"""
import datetime
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
env = {}
for line in (ROOT / "device.env").read_text().splitlines():
    line = line.split("#", 1)[0].strip()
    if "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
LOG = ROOT / "evidence" / f"raw-tv-report-{datetime.date.today():%Y%m%d}.log"


class Handler(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if self.client_address[0] != env["TV_IP"]:
            self.send_response(403)
            self.end_headers()
            return
        n = min(int(self.headers.get("Content-Length", 0)), 64 * 1024)
        body = self.rfile.read(n).decode("utf-8", "replace")
        stamp = datetime.datetime.now().isoformat(timespec="seconds")
        with LOG.open("a") as f:
            f.write(f"{stamp} {self.path} {body}\n")
        print(f"{stamp} {self.path} {body}", flush=True)
        self.send_response(204)
        self._cors()
        self.end_headers()

    def log_message(self, *args):
        pass


print(f"report-sink em {env['HOST_IP']}:{PORT} -> {LOG.relative_to(ROOT)}", flush=True)
http.server.HTTPServer((env["HOST_IP"], PORT), Handler).serve_forever()
