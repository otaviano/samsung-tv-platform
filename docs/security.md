# Security

## Repo público — esquema de placeholders

Este repositório é **público**. Topologia de rede e identificação do device são tratadas
como dados sensíveis: os documentos versionados usam placeholders
(`<TV_IP>`, `<HOST_IP>`, `<GATEWAY_IP>`, `<LAN_SUBNET>`, `<TAILSCALE_IP>`,
`<GATEWAY_VENDOR>`, `<TV_MODEL>`, `<TV_FIRMWARE>`, `<TV_MODEL_GROUP>`, `<TV_CHASSIS>`,
`<TV_FRIENDLY_NAME>`), e os valores reais vivem apenas em arquivos não-versionados:

| Arquivo | Conteúdo | Versionado? |
| --- | --- | --- |
| `device.env` | valores usados pelos scripts | **não** |
| `device.env.example` | gabarito com placeholders | sim |
| `docs/device-identifiers.local.md` | serial, DUID, MACs, mapa dos placeholders | **não** |

Antes de qualquer push, rodar a varredura (ver abaixo). Um placeholder que escapou é um
vazamento permanente: o GitHub indexa e cacheia, e deletar depois não desfaz.

## Dados que nunca entram no git

- Topologia da LAN: sub-rede, IPs de TV/estação/gateway, vendor do roteador, IP Tailscale
- Modelo exato e string de firmware da TV
- Serial number da TV
- DUID / UDN / qualquer UUID estável do device
- MAC addresses completos (OUI isolado é aceitável)
- TVkey
- Tokens de pareamento do canal `:8002` (wss)
- Certificados de distribuição Samsung e suas senhas

Local autorizado: `docs/device-identifiers.local.md` e `secrets/` — ambos gitignored.
`evidence/raw-*.json` e `evidence/raw-*.xml` também são gitignored, porque as respostas
brutas do device contêm serial e DUID.

Antes de qualquer push: rodar a varredura de segredos do repo.

## Superfície de rede do device (observada 2026-11-06)

- `:8001` — REST/WebSocket **em claro, sem autenticação** no `GET /api/v2/`. Expõe modelo,
  IP, estado de developer mode e DUID.
- `:8002` — WebSocket seguro, token auth (`TokenAuthSupport: true`). Preferir este para
  qualquer controle.
- `:9197` — UPnP MediaRenderer. **Expõe o serial sem autenticação.**
- `:26101` — SDB. Fechada hoje (developer mode off).

Consequência: o LAN deve ser tratado como semi-confiável. Qualquer dispositivo nele já
consegue identificar e, com pareamento, controlar a TV.

## Regras de exposição

1. **SDB (26101) e portas de debug nunca** acessíveis fora do LAN. Sem port forward,
   sem UPnP-IGD, sem DMZ.
2. Developer Mode fica ligado **apenas durante** sessões de desenvolvimento, e com
   `developerIP` fixado na estação. Desligar ao terminar.
3. A API do control plane (Hostinger VPC) fala **somente HTTPS**, com autenticação. Ela
   nunca recebe acesso direto ao device.
4. O caminho remoto para a TV, se necessário, é **Tailscale** (já ativo na estação) — não
   exposição pública. Tailnet com ACL restringindo a TV ao device de desenvolvimento.
5. O app da TV trata a API como não-confiável: degrada para cache local, sem travar a UI.
6. O agente de recomendação recebe acesso **explícito e escopado** aos dados de
   preferência; nunca credenciais do device.

## Modelo de ameaça resumido

| Ativo | Ameaça | Mitigação |
| --- | --- | --- |
| TV (bricking) | mudança irreversível de firmware/serviço | nada de service menu, flash ou factory reset; ver rollback-strategy.md |
| Serial/DUID | correlação e identificação | fora do git; LAN tratado como semi-confiável |
| Dados de preferência | exfiltração pelo agente ou pela API | escopo mínimo, HTTPS, auth, dados sob controle do usuário |
| Control plane (VPC) | exposição pública | HTTPS + auth; sem rota de volta para o LAN |
