# Validação global — execução no fork instalado

Snapshot de produto, testes e documentação operacional: `59b29fc4260a1824d7cec5b90c24f366b5eb45b4`. Origem: `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer`. Destino e cwd de todos os comandos abaixo: `D:\git\opencode-rich-footer`. Data UTC: 01/10/2026. Pre-flight global: HEAVY GO após PASS P2 em `6830d454a9378930f2764932dad566eabade854f`.

## Comandos e resultados

Todos usaram o launcher `C:\Users\Marquinho\.bun\bin\bun.exe` (1.3.14); scripts selecionam o Bun e runtime canônicos por geração. Build sequencial; typecheck e suite executados em paralelo com write-sets disjuntos; smoke somente depois do build da suite terminar. Todos os exit codes foram 0.

| Comando PowerShell executado no destino | Resultado | Log absoluto |
| --- | --- | --- |
| `& 'C:\Users\Marquinho\.bun\bin\bun.exe' run build` | ESM build completo | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\global-build-output.txt` |
| `& 'C:\Users\Marquinho\.bun\bin\bun.exe' run typecheck` | v1 e v2 passaram, incluindo testes/scripts | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\global-typecheck-output.txt` |
| `& 'C:\Users\Marquinho\.bun\bin\bun.exe' run test:coverage` | v1: 37 pass, 0 fail, 972 assertions. v2: 64 pass, 0 fail, 1873 assertions | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\global-test-output.txt` |
| `& 'C:\Users\Marquinho\.bun\bin\bun.exe' run smoke --target 'D:\git\opencode-rich-footer' --concurrent` | 2 pass por geração, 0 fail; 611 assertions v1 e 1081 v2 | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\global-smoke-output.txt` |

Não há script de lint separado. Build e typecheck cobrem sintaxe/tipos; não se declara lint executado. Os logs preservam stdout/stderr, removendo somente espaços no fim de linha para higiene do Git.

## Matriz realmente exercitada

| Host | SHA | Runtime |
| --- | --- | --- |
| `D:\git\opencode` | `1d883fccc393e9b9d3a41cb6cc11caf892a96db4` | `C:\Users\Marquinho\.bun\bin\bun.exe`, 1.3.14; OpenTUI 0.4.5/Solid 1.9.10 patched |
| `D:\git\opencode-rich-footer-host-v2` | `74dbc509d74df46a2523676dd4068225c4f0c9b0` | `C:\Users\Marquinho\.bun\versions\1.4.2\bun.exe`, 1.4.2; OpenTUI 0.5.12/Solid 1.9.15 patched |

Node não é runtime operacional suportado, conforme decisão HEAVY de P1. A fachada importa sem UI e rejeita ativação Node explicitamente; esse guard foi testado. Não houve alteração nos hosts.

## Cobertura e cenários

Coverage remapeada aos caminhos do destino: `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\coverage-global.json`. Plugin: **99,26% linhas/94% branches**. Instalador operacional, incluindo subprocessos CLI: **100% linhas/91,94% branches**. Todos os nove arquivos executáveis instrumentados passaram individualmente ≥90% linhas/≥85% branches; tipos puros e reexports não são executáveis relevantes.

Regressões incluem ausência versus zero, compactação, cache/reasoning, relógio e semântica TPS; parentesco/paginação/tombstones, respostas atrasadas e cleanup; renderer real em 40/80/120 colunas, temas, mouse e foco; Keymap/textarea com binding alterado em arquivo real isolado; cliente HTTP v2 real contra loopback com catálogo remoto/falhas/recuperação; identidade do runtime e loaders reais; configurações JSONC, migração, idempotência, drift, rollback com compensação e retomada; relançamento CLI limitado; instalação limpa em caminho Unicode/espaços e dependência/artefato ausentes.

Smoke principal resolve diretamente o diretório e file URL instalados, sem copiar o produto. Cada geração renderiza 20 ciclos principais. Cenário adversarial separado cria pacote compilado independente sem peers, recupera artefatos ausentes e modifica `Next` para `Move`; subprocessos novos renderizam a recuperação e a atualização com mais 20 ciclos cada. Contagens dos subprocessos não são somadas às assertions do runner pai.

O servidor HTTP usa o cliente real e uma ponte controlada de cache do contexto; não constitui E2E do aplicativo completo. Nenhuma conversa ou sessão pessoal foi usada como fixture. Processos pessoais não foram reiniciados; um novo processo do host carrega o novo build.

## Instalação, integridade e fechamento

49 pares de fontes/documentação/artefatos foram iguais no snapshot testado. SHA256 agregado do pacote/entrada/artefatos JS: `b044b671009c3fe0ba4b3d1daff9ad3a1e3fea3f16a9bc8d0cd2a19744f03c40`. Manifesto: `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\installation-manifest-global.json`.

Configuração pessoal aplicada e validada em P2: `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\configuration-p2.json`. Backup privado preservado fora do Git. Coleta global de hashes e processos: `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\preservation-global.json`.

Somente recibos de evidência e estado do plano mudam após a suite global. Esses commits também serão integrados no destino, com build/hashes/smoke renovados antes da revisão final. A suite só precisa ser repetida se uma correção alterar produto, testes, dependências ou mecanismo de validação. G.QA permanece pendente até parecer independente.
