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
interface TizenAppInfo {
  id: string;
  name: string;
  iconPath: string;
  version: string;
  show: boolean;
  categories: string[];
  packageId: string;
}
interface TizenWebAPIError {
  name: string;
  message: string;
}
interface Tizen {
  tvinputdevice: TizenInputDevice;
  application: {
    getCurrentApplication(): TizenApplication;
    getAppsInfo(ok: (apps: TizenAppInfo[]) => void, err?: (e: TizenWebAPIError) => void): void;
    launch(id: string, ok?: () => void, err?: (e: TizenWebAPIError) => void): void;
  };
}
interface Window {
  tizen?: Tizen;
}

// Imports de CSS são resolvidos pelo esbuild (gera dist/app.css).
declare module '*.css';
