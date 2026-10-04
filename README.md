# opencode-rich-footer

Footer pessoal para os meus forks locais do OpenCode. Mostra as métricas disponíveis tanto na sessão principal quanto em sessões de subagentes. A navegação para pai e irmãos aparece apenas em sessões de subagentes, identificadas por `parentID`; na sessão principal, não há controles nem comandos de paleta de navegação do plugin.

O plugin usa os tokens de tema do host, adapta o layout à largura do terminal e encurta ou oculta campos quando falta espaço. `Parent`, `Prev` e `Next` permanecem acessíveis por mouse; os controles não tomam o foco do editor.

## Ambiente validado

| Geração | Checkout do host | Commit | Bun | OpenTUI | Solid |
| --- | --- | --- | --- | --- | --- |
| v1 | `D:\git\opencode` | `1d883fccc393e9b9d3a41cb6cc11caf892a96db4` | `1.3.14` | `0.4.5` | `1.9.10`, com patch do host |
| v2 | `D:\git\opencode-rich-footer-host-v2` | `74dbc509d74df46a2523676dd4068225c4f0c9b0` | `1.4.2` | `0.5.12` | `1.9.15`, com patch do host |

A instalação pessoal fica em `D:\git\opencode-rich-footer`. O Bun de v1 está em `C:\Users\Marquinho\.bun\bin\bun.exe`; o Bun de v2 está em `C:\Users\Marquinho\.bun\versions\1.4.2\bun.exe`.

A compatibilidade se refere a esses checkouts e commits. Não há promessa de compatibilidade com outras versões, upstream ou instalação por npm. O runtime operacional é Bun. Importar pelo Node mantém a fachada sem carregar a UI; tentar ativar o plugin pelo Node produz um erro explícito.

## Dependências, build e validação

No PowerShell, a partir da instalação pessoal:

```powershell
Set-Location 'D:\git\opencode-rich-footer'
bun install --frozen-lockfile
bun run build
bun run typecheck
bun run test
bun run test:coverage
bun run smoke --target 'D:\git\opencode-rich-footer'
```

O build é obrigatório. O host carrega a entrada ESM compilada em `D:\git\opencode-rich-footer\dist`; não carrega os arquivos TSX diretamente. Execute o build depois de alterar a fonte e antes de abrir um novo processo do host.

Os caminhos e executáveis usados pela validação estão em [hosts.ts](D:/git/opencode-rich-footer/scripts/hosts.ts). Os testes isolam HOME, XDG e variáveis OPENCODE antes de importar os hosts, usando diretórios temporários; veja [sandbox.ts](D:/git/opencode-rich-footer/scripts/sandbox.ts).

A validação inclui métricas e relógio, renderização OpenTUI em 40/80/120 colunas, tema, navegação, foco, limpeza de timers e listeners, loaders reais e reload. Em v2, cobre o Keymap real com textarea, inclusive bindings nativos alterados em arquivo isolado e validados pelo schema/resolvedor do host, e a integração HTTP com o cliente real contra um servidor de fixtures em loopback. Esse teste HTTP verifica paginação, catálogo por localização, falhas e recuperação; não é um teste E2E do aplicativo completo.

## Configuração pessoal

As duas gerações usam arquivos e chaves diferentes. Preserve as preferências e demais plugins existentes: os fragmentos abaixo mostram somente a entrada que deve ser mesclada, não arquivos para sobrescrever.

Em v1, a entrada pertence a [tui.json](C:/Users/Marquinho/.config/opencode/tui.json), em `C:\Users\Marquinho\.config\opencode\tui.json`:

```json
{
  "plugin": ["D:/git/opencode-rich-footer"]
}
```

Em v2, pertence a [cli.json](C:/Users/Marquinho/.config/opencode/cli.json), em `C:\Users\Marquinho\.config\opencode\cli.json`:

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": ["D:/git/opencode-rich-footer"]
}
```

O schema v2 é [cli.json](https://opencode.ai/v2/cli.json). A criação da [configuração CLI pessoal](C:/Users/Marquinho/.config/opencode/cli.json) deve passar pelo migrador das preferências legadas, preservando a configuração existente. O instalador local faz essa migração e mantém backups privados para recuperação. Não substitua o arquivo inteiro pelo exemplo.

`C:\Users\Marquinho\.config\opencode\opencode.json` configura o servidor. A entrada deste footer pertence à configuração TUI/CLI acima; não deve ficar na lista de plugins do servidor.

### Validar, aplicar e restaurar

Primeiro faça a validação sem escrita. O comando abaixo confere a configuração e valida a migração para a instalação pessoal:

```powershell
Set-Location 'D:\git\opencode-rich-footer'
bun run configure:local --config-dir 'C:\Users\Marquinho\.config\opencode' --state-dir 'C:\Users\Marquinho\.local\state\opencode' --plugin 'D:\git\opencode-rich-footer'
```

Depois de validar a migração, aplique com backup. `C:\Users\Marquinho\.config\opencode\rich-footer-backup-manual` é um exemplo concreto de diretório privado novo: ele não deve existir antes desta execução. Se já existir, escolha outro caminho absoluto novo; preserve o backup anterior.

```powershell
Set-Location 'D:\git\opencode-rich-footer'
bun run configure:local --config-dir 'C:\Users\Marquinho\.config\opencode' --state-dir 'C:\Users\Marquinho\.local\state\opencode' --plugin 'D:\git\opencode-rich-footer' --backup-dir 'C:\Users\Marquinho\.config\opencode\rich-footer-backup-manual' --apply
```

O instalador valida a configuração com o Bun v2 fixado em `C:\Users\Marquinho\.bun\versions\1.4.2\bun.exe`, mescla a entrada do plugin e migra as preferências legadas. Guarde os arquivos privados e o manifesto em `C:\Users\Marquinho\.config\opencode\rich-footer-backup-manual\manifest.json` fora do repositório.

Para recuperar o estado registrado nesse backup:

```powershell
Set-Location 'D:\git\opencode-rich-footer'
bun run configure:local --restore 'C:\Users\Marquinho\.config\opencode\rich-footer-backup-manual\manifest.json'
```

Se a validação ou restauração recusar a operação por divergência de estado (drift), os arquivos mudaram desde o estado esperado. Revise essas mudanças e preserve o backup; não sobrescreva a configuração atual com uma cópia antiga. Para retomar a instalação, corrija a divergência e execute novamente a validação sem escrita antes de aplicar com um diretório de backup novo.

Se uma restauração for interrompida por falha de acesso ao disco, resolva a falha e repita o mesmo comando de restauração. O manifesto reconhece arquivos que já voltaram exatamente ao estado original, sem aceitar alterações de terceiros.

Após build e aplicação, abra um novo processo do host para carregar a versão compilada. Os processos pessoais já abertos podem continuar com a versão anterior carregada.

## O que os números representam

| Campo | Origem e limite |
| --- | --- |
| Nome e posição | Agente da sessão, ou nome reconhecido no título; posição entre irmãos diretos do mesmo pai. |
| `response ↑… ↓…` | Última resposta com uso válido após a última compactação concluída. Não agrega várias respostas de um turno. `↑` soma input, cache-read e cache-write; `↓` soma output e reasoning. |
| `ctx …/… …%` | Uso dessa resposta e limite do modelo correspondente por provider/model ID. Após compactação concluída, o contexto anterior é descartado até chegar uso válido novo. Sem limite conhecido, o denominador e percentual são omitidos. |
| `loaded $…` em v1 | Custo das mensagens carregadas pelo host; paginação pode deixar parte da sessão fora desse total. |
| `session $…` em v2 | Total autoritativo da sessão fornecido pelo host, independente das mensagens carregadas. |
| `cache …%` | Cache-read dividido por `input + cache-read + cache-write`, no mesmo escopo dos totais: mensagens carregadas em v1, sessão em v2. |
| Tempo | Execução observada enquanto está rodando ou em retry. O relógio é atualizado uma vez por segundo e conserva o resultado ao sair de execução; troca de sessão reinicia o estado. |
| `~…t/s` | Média aproximada, usando `output + reasoning` e o intervalo entre `created` e `streamed`, quando o host fornece esses dados. Não representa deltas instantâneos de streaming. |

Os dois adaptadores usam `liveTokenDeltas = false`. Em v2, os tokens normalmente aparecem quando a resposta publica seu uso. Em v1, o host não fornece `streamedAt`, então TPS é omitido; nenhum timestamp é inventado.

Dados ausentes, negativos ou não finitos são omitidos. Zero válido é preservado, inclusive `$0.00`. Um campo também pode desaparecer por falta de espaço no terminal. Em v2, o catálogo de modelos é sincronizado na localização da sessão remota: um modelo com o mesmo ID no cliente local não fornece o limite de uma sessão em outro diretório.

## Navegação e teclado

Em v1, os controles despacham os comandos nativos `session.parent`, `session.child.previous` e `session.child.next`. Os atalhos exibidos vêm dos bindings atuais do host. Se `children()` não estiver disponível, a posição é omitida e a navegação continua usando os comandos nativos.

Em v2, apenas em sessões com `parentID`, o plugin registra `opencode-rich-footer.parent`, `opencode-rich-footer.previous` e `opencode-rich-footer.next` na paleta, com `bind: false`: não há teclas padrão próprias. Use a paleta ou os controles por mouse. O schema do host não aceita chaves arbitrárias de plugins na configuração de atalhos; não adicione esses IDs ao JSON por conta própria. `Alt+Shift+Left/Right` continua pertencendo à seleção de palavras do editor.

Irmãos v2 são obtidos com paginação pelo mesmo pai, sem filtrar pelo diretório: filhos em outros diretórios também participam da posição e navegação. Descendentes de irmãos e sessões de outros pais ficam fora. Uma lista incompleta ou com falha não habilita navegação para um alvo presumido. Os handlers verificam o alvo atual no momento da ação e deixam de funcionar ao descartar o componente.

## Diagnóstico e recuperação

- Footer ausente: abra uma sessão principal ou de subagente e confirme o checkout validado, o arquivo de configuração da geração e o build compilado. Em v1, a integração usa `session_footer`; em v2, `session.composer.top`. A ausência de `Parent`, `Prev` e `Next` é esperada na sessão principal; as métricas disponíveis continuam visíveis.
- Posição ausente em v1: confirme a disponibilidade de `children()`. O restante do footer pode funcionar sem esse accessor.
- Métrica ausente: confirme que há uso válido após a compactação e espaço suficiente. TPS não é fornecido pelo adaptador v1; custo desconhecido não é convertido em zero.
- Falha HTTP em v2: mensagens com prefixo `[opencode-rich-footer]` identificam erros de sincronização de sessão, mensagens, irmãos ou catálogo. Corrija a conexão/servidor e faça uma nova sincronização ou remonte a sessão. Eventos relevantes de criação, mudança ou remoção de filhos também atualizam os irmãos; não há promessa de retry contínuo do catálogo pelo footer.
- Configuração incorreta: recupere pelos backups privados do instalador, preservando os outros valores e plugins. A migração do legado para a [configuração CLI pessoal](C:/Users/Marquinho/.config/opencode/cli.json) faz parte desse fluxo.
- Build novo sem efeito aparente: processos pessoais já abertos podem manter a versão carregada. Eles não são reiniciados pela instalação; um novo processo usa o build atual.

O plugin não altera os bindings do editor e limpa seus próprios timers, efeitos, comandos e listeners ao desmontar. Serviços pertencentes ao host seguem o ciclo de vida do próprio host.

## Licença

[MIT](D:/git/opencode-rich-footer/LICENSE.md) — Marco Jardim.
