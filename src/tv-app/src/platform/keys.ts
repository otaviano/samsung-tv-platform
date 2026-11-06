// keyCodes medidos no device (E6, docs/device-baseline.md).
export const Key = {
  Left: 37,
  Up: 38,
  Right: 39,
  Down: 40,
  Enter: 13,
  Back: 10009,
  Red: 403,
  Green: 404,
  Yellow: 405,
  Blue: 406,
  PlayPause: 10252,
} as const;

// Setas, OK e BACK chegam sem registro. As demais exigem tvinputdevice.registerKey.
const REGISTERED = ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'MediaPlayPause'];

export function registerKeys(): string[] {
  const tizen = window.tizen;
  if (!tizen) return [];
  const ok: string[] = [];
  for (const name of REGISTERED) {
    try {
      tizen.tvinputdevice.registerKey(name);
      ok.push(name);
    } catch {
      // tecla ausente neste controle: ignorar
    }
  }
  return ok;
}

export function exitApp(): void {
  window.tizen?.application.getCurrentApplication().exit();
}
