# P2 — testes operacionais

Snapshot de código: `943a3347b2c623d597fae531a1d24a52d13c6990`. Origem `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer`; destino `D:\git\opencode-rich-footer`. Plataforma win32, pwsh. P2.TEST corrigiu seis findings do HEAVY antes da aplicação pessoal; parecer de fechamento ainda pendente neste registro.

## Comandos e resultados

- Na origem, Bun 1.3.14 executou `bun run typecheck`: v1 e v2 PASS, incluindo scripts e todos os testes.
- Na origem, `bun run test:coverage`: v1 **37 pass, 0 fail, 972 assertions**; v2 **64 pass, 0 fail, 1873 assertions**. Logs em `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\p2-test-output.txt` e `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\p2-typecheck-output.txt`.
- Em `D:\git\opencode-rich-footer`, `bun install --frozen-lockfile` e `bun run build`: PASS. O formato 1 do lock Bun é legível pelos dois runtimes; instalação congelada também foi conferida com Bun 1.4.2, sem alteração do lock. Nenhuma dependência existente mudou ao adicionar jsonc-parser 3.3.1.
- Em `D:\git\opencode-rich-footer`, `bun run smoke --target 'D:\git\opencode-rich-footer' --concurrent`: **2 pass por geração**, 611 assertions v1 e 1081 v2; ambos os subprocessos sobrepostos, runtimes fixos, nenhum build/junction compartilhado em edição. O runner registra target, SHA Git e hash do grafo compilado.

## Cenários novos de encerramento

1. Migração usa schemas e migrateV1 reais do host; allowlist KV, precedência de preferências, configuração v2 já existente, outras declarações e opções de plugins preservadas. Config.Service real lê o resultado em sandbox com todos os campos Global isolados.
2. CLI real executado em subprocessos: dry-run, apply, restore, Bun incorreto, executável inexistente e limite de relançamento. Nenhuma condição inválida escreve configuração. Aplicação idempotente, restauração byte a byte e retorno à ausência original comprovados.
3. Falhas injetadas no filesystem: segunda publicação durante restore, compensação também falhando, limpeza após link já publicado, backup corrompido e drift alheio. Diagnóstico contém o manifesto; retomada aceita somente o estado original exato ou estado instalado conhecido.
4. Instalação limpa em diretório com espaços/Unicode: compilador ausente falha explicitamente; instalação pelo lock congelado recupera o build sem alterar o lock.
5. Smoke principal carrega diretamente `D:\git\opencode-rich-footer\tui.js` pelo loader real de cada geração, sem copiar o artefato. São 20 ciclos de mount/unmount, mudança de sessão, custo, mouse, texto/foco e contagem de recursos por geração.
6. Fixture adversarial separada copia o pacote compilado completo, sem node_modules nem imports que escapem ao pacote (exceto IDs canônicos do runtime). Artefato ausente falha. Processo novo renderiza o pacote recuperado; outro processo observa `Next` virar `Move` após editar o artefato real da cópia. Cada processo percorre mais 20 ciclos; a instalação pessoal nunca é alterada por essa fixture.
7. Arquivo de configuração isolado passa por schema e resolve reais; bindings nativos de seleção mudam para Ctrl+Shift+setas. Keymap e textarea reais preservam seleção, cursor, texto e foco; paleta e mouse do footer continuam funcionando, sem bindings próprios.
8. Cliente v2 real consulta servidor loopback próprio com porta efêmera. Paginação inclui irmãos em diretórios distintos e catálogo por localização com mesmo ID local/remoto. O renderer mostra o limite remoto. Erros HTTP 500/503, diagnóstico, recuperação e descarte são verificados.

## Cobertura sem diluição

Instrumentação Istanbul após transformação JSX e remapeamento de sourcemaps; inicialização inclui arquivos não carregados. Subprocessos CLI exportam seus contadores no evento exit. Metas aplicadas separadamente ao plugin e ao instalador; testes/orquestração de testes não contam como produção.

| Conjunto / arquivo | Linhas | Branches |
| --- | --- | --- |
| Plugin completo, incluindo UI/adaptadores | 99,26% | 94,00% |
| Instalador, conjunto separado | 100% | 91,94% |
| `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\scripts\configure-local.ts` | 100% | 93,93% |
| `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\scripts\local-config.ts` | 100% | 91,37% |

Relatório por arquivo em `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\coverage-p2.json`. Todos os arquivos executáveis medidos satisfazem >=90% linhas e >=85% branches.

## Fronteiras da evidência

Loaders, renderer, slots, Keymap, schemas/migrador e cliente HTTP são reais. Serviços de sessão/rota e a ponte de cache de catálogo são fixtures; a ponte busca modelos pelo cliente HTTP real. Isto demonstra integração do plugin, não E2E completo do aplicativo nem execução numa conversa pessoal. Node operacional continua fora da matriz; o guard Node segue testado. Processos pessoais não foram reiniciados. Configuração pessoal será registrada separadamente após aplicação aprovada.
