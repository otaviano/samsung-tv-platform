// Telas de sistema que abrem por cima da home sem passar pelo Smart Hub (E10, 2026-11-07).
// `org.tizen.tv-viewer` NÃO: cai no Smart Hub.
export const SYSTEM_APPS = {
  sources: 'com.samsung.tv.coba.source',
  settings: 'com.samsung.tv.coba.setting',
} as const;
