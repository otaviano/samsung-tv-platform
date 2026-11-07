// Status de rede para a barra superior (E10). webapis.network exige o privilégio
// developer.samsung.com/privilege/network.public e o script $WEBAPIS/webapis/webapis.js.
// Valores de getActiveConnectionType: 0 desconectado, 1 Wi-Fi, 3 cabo — segundo a doc da
// Samsung Product API; só o 1 foi observado no device (Provável para os demais).

export interface NetStatus {
  kind: 'wifi' | 'ethernet' | 'none';
  /** Nome da rede Wi-Fi. Nunca enviar ao report-sink. */
  ssid: string | null;
  /** 0..5 (Wi-Fi). */
  level: number | null;
  /** Chega ao roteador e o navegador se diz online. */
  online: boolean;
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function readNetwork(): NetStatus {
  const net = window.webapis?.network;
  if (!net) return { kind: navigator.onLine ? 'wifi' : 'none', ssid: null, level: null, online: navigator.onLine };
  const type = safe(() => net.getActiveConnectionType(), 0);
  const kind = type === 1 ? 'wifi' : type === 3 ? 'ethernet' : type === 0 ? 'none' : 'wifi';
  const gateway = safe(() => net.isConnectedToGateway(), false);
  return {
    kind,
    ssid: kind === 'wifi' ? safe(() => net.getWiFiSsid() || null, null) : null,
    level: kind === 'wifi' ? safe(() => net.getWiFiSignalStrengthLevel(), null) : null,
    online: kind !== 'none' && gateway && navigator.onLine,
  };
}
