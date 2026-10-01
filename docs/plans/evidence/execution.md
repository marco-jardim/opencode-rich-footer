# Execução — compatibilidade pessoal v1/v2

Início: 30/09/2026. Autorização: usuário solicitou iniciar a implementação do plano completo, incluindo commits locais frequentes. Sem push/PR/publicação.

Workspace: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer. Plataforma win32, shell pwsh. Branch codex/rich-footer-v1-v2, baseline 162fee8d1966f462ad6764b9980237c5c5d7d1d5.

## Estado

| Unidade | Estado |
| --- | --- |
| P1.PF coleta | completed |
| P1.PF avaliação heavy | completed (PASS Bun v1/v2) |
| P1.T1 núcleo | completed |
| P1.T2 adaptadores/UI | completed |
| P1.T3 build/carregamento | completed |
| P1.TEST / P1.QA | completed — heavy PASS 73aab53 |
| P2 pre-flight | completed — HEAVY GO |
| P2 implementação | in_progress — código e documentação escritos; testes integrados em execução |
| P2 QA | pending |
| Global | pending |

## Preservação

- D:\git\opencode-rich-footer: master no baseline; package-lock.json preexistente untracked, não tocar.
- D:\git\opencode: log-session-retention, HEAD 1d883fccc393e9b9d3a41cb6cc11caf892a96db4; .opencode/router-lessons.md preexistente untracked, não tocar.
- Plano anterior é o único conteúdo novo desta conversa antes da execução.

## Registro de locks

- root: WRITE exclusivo em docs/plans/evidence e metadados Git deste workspace.
- v1_preflight, v2_preflight: leituras concluídas; locks liberados.
- Contrato C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\contracts.ts congelado para leitura compartilhada.
- root: WRITE exclusivo em núcleo, entradas, build/configuração e testes correspondentes; integração Git/dependências exclusiva.
- owner V1: WRITE exclusivo em C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\adapters\v1.tsx e C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tests\v1.test.tsx.
- owner V2: WRITE exclusivo em C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\adapters\v2.tsx, C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\navigation.ts e C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tests\v2.test.tsx.
- owner UI: WRITE exclusivo em C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\footer.tsx e C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tests\footer.test.tsx.
- Nenhum agente pode ler um arquivo sob WRITE de outro. Testes integrados/build somente após handoff de todos os owners envolvidos.

## Evidência inicial

- bun 1.3.14; Node v24.21.0.
- Git status inspecionado nos três checkouts antes de editar.
- Nenhum gate de implementação aprovado ainda.

## Implementação P1 — checkpoint

- Núcleo, adaptadores e UI implementados. Build ESM usa IDs virtuais canônicos OpenTUI, aprovados pelo heavy após bare imports falharem em JavaScript compilado no Bun v1. Transformação AST após JSX, imports tardios por geração e guard Node antes de UI.
- Runtime real confirmado: v1 OpenTUI 0.4.5 + Solid 1.9.10 patched; v2 OpenTUI 0.5.12 + Solid 1.9.15 patched (corrige anotação inicial de versão v2).
- Typecheck de produção, scripts e testes unitários passou nas duas matrizes.
- Tests unitários + renderer real: v1 26 pass / 154 expects; v2 36 pass / 169 expects; zero fail/skip.
- Cobertura inicial remapeada por sourcemaps: 93.62% linhas, 87.53% branches. Loaders e testes adversariais de fim de fase ainda pendentes; isto não é aprovação P1.
- Smoke loader inicial expôs erros na fixture (cópia Windows de junction e assinatura de setup); corrigidos pelo owner e em nova execução. Não houve alteração de host.

## Ownership P2

- Pre-flight HEAVY GO recebido; todos os READs de coleta liberados antes de editar.
- Orquestrador escreveu exclusivamente `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\scripts\sandbox.ts`, `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\scripts\hosts.ts`, `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\scripts\test.ts`, `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\scripts\local-config.ts`, `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\scripts\configure-local.ts`, testes de configuração/build, manifestos e lockfile. Configuração pessoal e integração Git continuam exclusivas do root.
- Owner v2_implementation concluiu e liberou `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\scripts\installed-smoke.ts`, `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tests\v1-installed.test.tsx` e `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tests\v2-installed.test.tsx`.
- Owner ui_implementation concluiu e liberou `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\README.md` e `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tests\v2-remote.test.tsx`.
- Todos os writers foram encerrados antes de typecheck dual (PASS). Código/scripts/testes estão congelados sob READ do runner e HEAVY P2.TEST; root escreve somente evidências. Nenhuma configuração pessoal aplicada ainda.