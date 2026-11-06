# Device baseline

Última verificação: 2026-11-06. Identificadores sensíveis redigidos — valores reais em
`docs/device-identifiers.local.md` (gitignored).

## Confirmado (lido do próprio device)

| Campo | Valor | Fonte |
| --- | --- | --- |
| `modelName` | `<TV_MODEL>` | `:8001/api/v2/`, UPnP `:9197/dmr` |
| Nome amigável | `<TV_FRIENDLY_NAME>` | idem |
| Model group interno | `<TV_MODEL_GROUP>` | `:8001/api/v2/` → `device.model` |
| SoC/plataforma | <TV_CHASSIS> (inferido da string acima) | idem |
| OS | `Tizen` | `device.OS` + UPnP `sec:ProductCap` |
| Ano de plataforma | `Y2020` | UPnP `sec:ProductCap` |
| Resolução | `3840x2160` (UHD) | `device.resolution`, `UHD_SCREEN` |
| Versão exibida no menu da TV | `<TV_FIRMWARE>` | foto fornecida pelo usuário |
| IP atual (LAN) | `<TV_IP>` (DHCP, wireless) | `device.ip` |
| OUI do MAC Wi-Fi | resolve para Samsung Electronics Co.,Ltd | `/usr/share/hwdata/oui.txt` |
| Developer Mode | **desligado** (`developerMode: "0"`) | `:8001/api/v2/` |
| Host de dev autorizado | nenhum (`developerIP: 0.0.0.0`) | idem |
| `TokenAuthSupport` | `true` | idem |
| Multitasking | suportado no grupo deste modelo | docs Samsung (ver discovery-report) |
| Capabilities declaradas | `WebURIPlayable`, `NavigateInPause`, `OCF=1`, Screen Mirroring P2P | UPnP `sec:ProductCap` |
| DRM | PlayReady `false`, Widevine `false` no payload `isSupport` | `:8001/api/v2/` |
| Serial | **REDIGIDO** (exposto sem auth via UPnP — ver security.md) | UPnP `serialNumber` |
| DUID / UDN | **REDIGIDO** (UUIDs estáveis, identificam o device) | `:8001/api/v2/`, UPnP |

## Não confirmado pelo device

- **Versão exata do Tizen.** `<TV_FIRMWARE>` é a string de firmware da Samsung e
  **não** carrega a versão do Tizen. O device expõe apenas `Y2020`. A versão precisa ser
  lida de dentro de um app (`tizen.systeminfo` / user agent) ou do SDB, nenhum dos dois
  disponível hoje.
- `firmwareVersion` retorna literalmente `Unknown` no endpoint REST.
- `version: "2.0.25"` em `/api/v2/` é a versão da **API de controle remoto**, não do Tizen.
  Não confundir.

## Decodificação da string de firmware (hipótese, confiança média)

`<TV_FIRMWARE>`

- `T-` — prefixo de TV
- `<TV_CHASSIS>` — família de chassi <TV_CHASSIS>, consistente com `<TV_MODEL_GROUP>`
- `UABC` — variante de região/lineup
- `2743.0` — número de build incremental

Não há documentação oficial Samsung desse esquema. Tratar como hipótese; serve para
detectar *se* o firmware mudou, não para derivar capacidades.
