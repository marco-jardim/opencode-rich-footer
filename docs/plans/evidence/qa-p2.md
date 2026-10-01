# P2 — avaliação HEAVY e fechamento

Estado: findings P2.TEST em correção/validação; instalação pessoal ainda não aplicada. Reviewer independente gpt-6-astra/max. O pre-flight teve GO; isso não é aprovação P2.

## Achados preliminares do reviewer

| ID | Arquivo absoluto | Comportamento / correção exigida | Estado |
| --- | --- | --- | --- |
| P2-QA-01 | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\scripts\local-config.ts` | Restore sequencial poderia deixar estado parcial e impedir retomada após falha de IO. Implementar compensação e retomada idempotente sem aceitar drift de terceiros; injetar falha de filesystem em regressão. | Aberto |
| P2-QA-02 | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\scripts\configure-local.ts` | Override de Bun com versão diferente poderia relançar sem limite. Validar runtime antes de executar e limitar relançamento. | Aberto |
| P2-QA-03 | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\scripts\build.ts`; `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\scripts\test.ts` | Cobertura medida somente do plugin não demonstra cobertura do instalador que altera configuração pessoal. Instrumentar os dois scripts operacionais e subprocessos CLI, aplicar metas sem diluição pela cobertura de P1. | Aberto |

Nada será aplicado à configuração pessoal antes de corrigir esses achados. Fontes de P1 permanecem inalteradas. O parecer final e possíveis achados adicionais serão registrados após encerramento da revisão e novamente após instalação/sincronização do destino.

## Parecer completo P2.TEST

HEAVY bloqueou o snapshot anterior para aplicação pessoal e liberou READs antes das correções. P2-QA-01/P2-QA-02 são severidade alta; P2-QA-03 média. Achados adicionais:

| ID | Arquivo absoluto | Critério de fechamento | Estado |
| --- | --- | --- | --- |
| P2-QA-04 (média) | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tests\v1-installed.test.tsx`; `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tests\v2-installed.test.tsx` | Fixture independente do pacote compilado, sem peers; modificar artefato funcional e observar render novo. Manter smoke direto separado. | Implementado; runner pendente |
| P2-QA-05 (média) | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tests\v2-keymap.test.tsx` | Arquivo de config isolado + schema/resolve reais + binding nativo alterado no Keymap real; preservar texto, seleção, foco e paleta. | Implementado; runner pendente |
| P2-QA-06 (baixa) | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\README.md` | Comandos completos dry-run/apply/restore com paths absolutos, exercitados em sandbox. | Implementado; CLI tests passaram em execução direcionada |

P2-QA-01 recebeu compensação, retomada pelo hash original e rastreio de publicação mesmo com falha ao limpar temporário. P2-QA-02 recebeu probe de versão e limite de relançamento. Nove testes de configuração/CLI passaram com 81 assertions no runner direcionado. A instrumentação operacional e novos cenários estão na coleta integrada; fechamento permanece dependente do HEAVY, sem waiver.