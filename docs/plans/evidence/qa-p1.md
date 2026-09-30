# P1 — senior QA adversarial

Reviewer: agente independente gpt-6-astra, max, tier heavy. Estado: correções em verificação; PASS final pendente.

## Review de código e desenho de testes finais

Snapshot de origem: commits 214d8e1 e e4db71b em C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer. Heavy inspecionou código congelado e contratos reais dos hosts, sem executar suites nem escrever implementação.

| ID | Severidade | Reprodução e impacto | Correção exigida | Estado |
| --- | --- | --- | --- | --- |
| P1-QA-01 | P1 | C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\adapters\v2.tsx registrava Alt+Shift+setas que já selecionavam palavras no editor/navegavam tabs. Camada posterior podia capturar edição. | Comandos sem binding padrão, disponíveis na paleta e mouse; teste Keymap.Provider + textarea reais, execução e descarte. | Corrigido; teste integrado pendente |
| P1-QA-02 | P2 | No mesmo adaptador, listagem restringia parentID e directory; irmão movido a outro diretório desaparecia do contador/ciclo. | Listar pelo pai, catálogo ainda por localização; fixture com duas localizações e filtro real. | Corrigido; regressão em execução |
| P1-QA-03 | P2 | Exclusão de irmão desconhecido durante página pendente era ignorada; snapshot atrasado ressuscitava alvo apagado. | Registrar tombstones antes de classificar relevância, filtrar respostas tardias, não recarregar por exclusões alheias. | Corrigido; regressão em execução |
| P1-QA-04 | P2 | C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\navigation.ts parava nas extremidades, diferindo do ciclo v1. | Wrap usando lista do contador, não navegar para si com zero/um irmão; deduplicar IDs. | Corrigido; regressão em execução |

## Testes finais adicionais solicitados

- Eventos created/moved concorrentes com paginação: coalescer em um refresh adicional; sem publicar respostas antigas após troca de localização/descarte.
- Catálogo de mesmo provider/model ID em localizações diferentes retorna limite correto após mover sessão.
- Geração inativa substituída por módulo que lança na importação nas duas fixtures; host ativo deve continuar carregando.
- Reload efetivo pelo mecanismo de fontes v2; v1 não tem invalidação de grafo, portanto testar avaliações completas pelo loader real em caminhos de instalação novos. Distinguir isso de ativar/desativar a mesma instância.
- Sessão running nos ciclos para provar descarte de timers, além de slots/listeners/comandos.
- Processo Node real confirma diagnóstico antes de importar qualquer UI; entrada legada não oferece setup de servidor.

## Evidência anterior às correções

Orquestrador verificou independentemente: typecheck das duas matrizes PASS; v1 27 testes/397 expects e v2 37 testes/552 expects; 20 ativações por matriz com identidade de runtime e renderer reais. Cobertura agregada remapeada 97.79% linhas/90.02% branches. Esses resultados são baseline, não aprovação das correções acima.
