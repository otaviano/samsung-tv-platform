// Injetados pelo build.mjs (esbuild `define`).
declare const __REPORT_URL__: string | null;
declare const __DEV__: boolean;

// Subconjunto mínimo das APIs Tizen usadas pelo app. Presença confirmada no device (E6).
interface TizenInputDevice {
  registerKey(name: string): void;
}
interface TizenApplication {
  exit(): void;
}
interface Tizen {
  tvinputdevice: TizenInputDevice;
  application: { getCurrentApplication(): TizenApplication };
}
interface Window {
  tizen?: Tizen;
}

// Imports de CSS são resolvidos pelo esbuild (gera dist/app.css).
declare module '*.css';
