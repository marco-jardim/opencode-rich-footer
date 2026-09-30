# P1 — testes finais

Executados independentemente pelo orquestrador, após as correções P1-QA-01–04 e os novos casos solicitados pelo reviewer heavy.

Workspace: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer. Scripts: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\scripts\test.ts e C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\scripts\typecheck.ts.

- `bun run typecheck`: PASS v1 e v2, produção/scripts/testes incluídos.
- `bun run test:coverage`: PASS, zero falhas/skip. V1: 31 testes e 933 expects. V2: 51 testes e 1712 expects.
- Build ESM regular e instrumentado passaram. Cobertura Istanbul remapeada para fontes originais via sourcemaps; inicializa também arquivos não carregados, sem excluir UI/adaptadores.

| Fonte sob C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer | Linhas | Branches |
| --- | --- | --- |
| C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\metrics.ts | 100% | 100% |
| C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\timing.ts | 100% | 100% |
| C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\navigation.ts | 100% | 86.36% |
| C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\footer.tsx | 99.17% | 89.74% |
| C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\tui.ts | 100% | 100% |
| C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\adapters\v1.tsx | 100% | 90.90% |
| C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\adapters\v2.tsx | 98.40% | 93.20% |
| Total | **99.26%** | **94.00%** |

Relatório regenerável: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\coverage\index.html. Resumo versionado em C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\coverage-p1.json.

## Casos adversariais de fechamento

- Keymap.Provider e textarea reais preservam seleção/bounds/cursor, texto e foco; comandos próprios seguem executáveis via paleta/dispatch, sem bindings; descarte invalida callbacks antigos e restaura baseline anterior ao footer.
- O Provider do host mantém listeners até destruição do renderer. Um controle sem plugin demonstra o mesmo comportamento; não se atribui esse lifecycle ao footer nem se altera o host fora do escopo.
- Irmãos de diretórios diferentes, exclusão de irmão desconhecido durante primeira página, coalescing de eventos created/moved, mudanças de localização, respostas e rejeições tardias, wrap e deduplicação.
- 20 avaliações completas pelo loader v1 e 20 reloads reais pelo source loader v2, sessões running, geração inativa armada para falhar caso importada; contagens de timers/listeners/slots/comandos retornam ao baseline.
- Processo Node real verifica diagnóstico antes de importar UI. Testes não afirmam suporte Node operacional.
- Cache sem input novo: 30 reads + 70 writes produz 30%; apenas reads produz 100%. Renderer muda de tema escuro para claro, inclusive hover, preservando tokens semânticos.
- Smokes concorrentes em processos Bun separados, sem rebuild ou troca de junction: v1 iniciou 23:45:30.188Z e terminou 23:45:54.629Z; v2 iniciou 23:45:32.200Z e terminou 23:45:39.681Z em 30/09/2026. Ambos PASS, 763/1443 expects; intervalo sobreposto comprovado.

Saídas preservadas: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\p1-test-output.txt e C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\p1-typecheck-output.txt. Logs concorrentes em C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\p1-concurrent-v1.txt e C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\p1-concurrent-v2.txt.

Serviços de dados e rotas dos smokes são fixtures; loaders, renderer, registry/slots e Keymap/editor usados nas verificações relevantes são os reais. Não foram usados dados ou sessões pessoais.
