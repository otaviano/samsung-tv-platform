// Build do tv-app (ADR-0003): esbuild -> dist/ pronto para scripts/tv-app.sh.
//   node build.mjs         produção
//   node build.mjs --dev   injeta REPORT_URL (lido de device.env) para o report-sink
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, 'dist');
const dev = process.argv.includes('--dev');

function reportUrl() {
  if (!dev) return null;
  const env = readFileSync(join(here, '..', '..', 'device.env'), 'utf8');
  const host = /^HOST_IP=(\S+)/m.exec(env)?.[1];
  if (!host) throw new Error('HOST_IP ausente em device.env');
  return `http://${host}:8765`;
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(here, 'static'), dist, { recursive: true });

await esbuild.build({
  entryPoints: { app: join(here, 'src', 'main.tsx') },
  outdir: dist,
  bundle: true,
  format: 'iife',
  target: ['chrome69'],
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  jsx: 'automatic',
  jsxImportSource: 'preact',
  define: { __REPORT_URL__: JSON.stringify(reportUrl()), __DEV__: String(dev) },
  logLevel: 'info',
});
