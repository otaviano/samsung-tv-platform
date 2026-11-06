# E2 — Habilitar Developer Mode na TV

- **Degrau de reversibilidade:** 2 (configuração suportada, revertida pelo mesmo menu)
- **Risco de recuperação:** baixo. Não altera firmware, não apaga dados, não entra no
  service menu. Reversível pelo mesmo caminho.
- **Requer:** controle remoto na mão, TV ligada e na mesma LAN.

## Hipótese

O firmware `<TV_FIRMWARE>` expõe o Developer Mode pelo painel Apps, e fixar
`developerIP` na estação abre a porta 26101 para SDB.

## Pré-requisito: E1 antes de E2

O Developer Mode **fixa o IP do host autorizado**. A estação está em DHCP
(`<HOST_IP>`, Wi-Fi) — se esse IP mudar, a TV passa a recusar a conexão SDB e é
preciso refazer E2.

Então, no roteador <GATEWAY_VENDOR> (`http://<GATEWAY_IP>`), reserve lease fixo para **os dois**:

| Device | MAC | IP a fixar |
| --- | --- | --- |
| TV | ver `docs/device-identifiers.local.md` | `<TV_IP>` |
| Estação Fedora | MAC de `wlo1` | `<HOST_IP>` |

Confirme o IP da estação imediatamente antes de digitar na TV:

```bash
ip -4 -br addr show wlo1
```

## Passos na TV

Caminho oficial Samsung (ver Fontes):

1. **Home** (botão casa no controle) → abrir o **Smart Hub**.
2. Ir ao painel **Apps**.
3. Navegar até **App Settings** (ícone de engrenagem, canto superior).
4. Com a tela de App Settings aberta, **digitar `12345`** no controle numérico.
   - Sem teclado numérico no controle: use o **teclado on-screen**.
   - Em alguns modelos 2020 a sequência é aceita já no painel Apps, sem entrar em
     App Settings. Se o popup não aparecer em App Settings, tente direto no Apps.
5. Aparece o popup **Developer mode**. Alterne para **On**.
6. Em **Host PC IP**, digite o IP da **estação Fedora**: `<HOST_IP>`.

   > ⚠️ **O campo mais fácil de errar do procedimento.** Ele pede o IP do *computador*,
   > não o da TV. Em 2026-11-06 essa etapa saiu como `<TV_IP>` — o IP da própria TV —
   > e o SDB foi recusado mesmo com a porta 26101 aberta. Se a TV vier com algum IP
   > pré-preenchido, **apague e digite `<HOST_IP>`**.
7. **OK**.

8. **PARE. Verifique antes de reiniciar.** Rebootar com o IP errado é tempo perdido —
   rode agora, da estação:

   ```bash
   source device.env
   curl -s "http://$TV_IP:8001/api/v2/" | grep -oE '"developer(IP|Mode)":"[^"]*"'
   ```

   Se `developerIP` **não** for o `HOST_IP`, o campo não gravou: volte ao passo 4 e repita.
   Só siga quando o valor estiver correto.

9. **Reiniciar a TV.** Desligue pelo controle e ligue novamente. Se não quiser depender do
   standby, tire da tomada por ~15 s.

Depois do reboot, o painel Apps deve mostrar **"Develop Mode"** no topo.

## Validação (objetiva, sem achismo)

Não confie na tela. Pergunte ao device:

```bash
cd ~/source/repos/samsung-tv-platform
./scripts/discover-tv.sh <TV_IP> | tail -15
```

Critério de aceite — os três ao mesmo tempo:

| Campo | Antes (E0) | Esperado depois |
| --- | --- | --- |
| `developerMode` | `"0"` | `"1"` |
| `developerIP` | `"0.0.0.0"` | `"<HOST_IP>"` |
| porta `26101` | fechada/filtrada | **aberta** |

### Diagnóstico

| Sintoma | Causa provável | Ação |
| --- | --- | --- |
| `developerMode` segue `"0"` | popup não foi confirmado, ou TV não rebootou | repetir passos 4–8 |
| `developerMode` `"1"`, 26101 fechada | TV não rebootou de fato | reboot pela tomada, ~15 s |
| `developerMode` `"1"`, **26101 aberta, mas `sdb connect` falha** | **`developerIP` não é o IP da estação** | conferir `developerIP` no resumo; se não for `<HOST_IP>`, refazer o passo 6 |

O terceiro caso aconteceu de verdade (2026-11-06, duas vezes): `developerIP` ficou
`<TV_IP>` — o IP da *própria TV* — a porta 26101 abriu, e `sdb connect` retornou
`failed to connect`.

Teste de socket cru mostrou o mecanismo: a TV **aceita** o TCP e **fecha em ~0,01 s sem
enviar nada**. Não é firewall (o handshake completa) nem serviço ausente — é o daemon
rejeitando por IP de origem. Ou seja:

> **"Porta 26101 aberta" não é critério de sucesso.** O critério é `developerIP` igual ao
> IP da estação.

Para distinguir rejeição por IP de outros problemas de conexão:

```bash
source device.env
python3 -c "
import socket,time
s=socket.create_connection(('$TV_IP',26101),timeout=5); print('origem:',s.getsockname())
s.settimeout(4); t=time.time()
try:
    d=s.recv(64); print('fechou' if d==b'' else f'dados: {d[:40]!r}', f'em {time.time()-t:.2f}s')
except socket.timeout: print('mantida aberta >4s — handshake SDB esperado')
"
```

Fechamento imediato = IP não autorizado. Conexão mantida = outro problema.

## Conexão SDB (só depois de E3)

```bash
./scripts/tizen.sh sdb connect <TV_IP>:26101
./scripts/tizen.sh sdb devices          # deve listar a TV
./scripts/tizen.sh sdb capability       # perfil, versão da plataforma, arquitetura
```

`sdb capability` é o comando que finalmente responde a **incógnita 1** — a versão real do
Tizen, lida do device em vez de inferida pelo ano do modelo.

Primeiros comandos somente-leitura sugeridos (E4):

```bash
./scripts/tizen.sh sdb shell cat /etc/info.ini      # build/versão de plataforma
./scripts/tizen.sh sdb shell "ls /usr/apps"         # inventário de apps instalados
```

## Rollback

1. Mesmo caminho: Smart Hub → Apps → App Settings → `12345`.
2. **Developer mode → Off.**
3. Reiniciar a TV.
4. Validar que voltou ao baseline:

```bash
./scripts/discover-tv.sh <TV_IP> | tail -15
# esperado: developerMode "0", developerIP "0.0.0.0", porta 26101 fechada
```

Desligue o Developer Mode ao fim de cada sessão de desenvolvimento — ele mantém a 26101
aberta no LAN sem autenticação forte. Ver `docs/security.md`.

## Registrar

Após executar, lançar entrada em [../change-log.md](../change-log.md) com resultado
observado, inclusive se falhar.

## Fontes

- [Samsung — TV Device (enabling Developer Mode)](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html)
- [Samsung — Command Line Interface](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html)
