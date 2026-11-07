# E10 — Sonda de sistema: rede, fontes e apps de sistema

**Objetivo:** saber o que a home pode mostrar (status/nome da rede, fontes) e quais telas
de sistema ela consegue abrir sem passar pelo Smart Hub.
**Degrau:** 3. App `E10SysProb` (`experiments/e10-system`). Rollback:
`scripts/tv-app.sh uninstall experiments/e10-system`.
**Escopo de segurança:** só leitura e `launch` de apps voltados ao usuário. Excluídos de
propósito os apps de debug, hotel e service menu presentes no applist.

## Resultados (2026-11-07)

| Pergunta | Resposta | Confiança |
| --- | --- | --- |
| SSID | `tizen.systeminfo` `WIFI_NETWORK.ssid` e `webapis.network.getWiFiSsid()` | Confirmado |
| Sinal Wi-Fi | `webapis.network.getWiFiSignalStrengthLevel()` → 5. `WIFI_NETWORK.signalStrength` → `null` | Confirmado |
| Conexão | `getActiveConnectionType()` = 1 (Wi-Fi), `isConnectedToGateway()` = true, `NETWORK.networkType` = `WIFI` | Confirmado |
| Fontes | `systeminfo VIDEOSOURCE`: TV 1 conectada; HDMI 1 e 2 "disconnected" | Confirmado |
| `tizen.tvwindow` | Existe; `getSource()` = TV 1; janelas: `MAIN` | Confirmado |
| Abrir Configurações | `com.samsung.tv.coba.setting` abre por cima do app (sem esconder o nosso) | Confirmado |
| Abrir Fontes | `com.samsung.tv.coba.source` abre por cima do app | Confirmado |
| Abrir TV | `org.tizen.tv-viewer` → **cai no Smart Hub**. Não usar | Confirmado |

Privilégios usados: `application.launch`, `tv.window`,
`http://developer.samsung.com/privilege/network.public` (webapis.network). `webapis.js`
via `$WEBAPIS/webapis/webapis.js`.

## Não testado

- `org.tizen.menu`, `com.samsung.tv.quickpanel`, `org.tizen.SMSourceAPP`,
  `org.tizen.NetworkSetting-Tizen`.
- Trocar de fonte direto para HDMI N (sem o seletor). `tvwindow.setSource` troca a
  fonte da janela de vídeo **do app**, não da TV inteira (Provável, pela doc da API).
- O que "HDMI disconnected" significa com um aparelho plugado e desligado.
