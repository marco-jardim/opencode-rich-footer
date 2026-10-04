# Plano executável — rich footer nos forks pessoais OpenCode v1 e v2

Data: 30/09/2026. Estado: planejamento; implementação não iniciada.

Documento canônico: `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\2026-09-30-opencode-v1-v2-compatibility.md`.

## 1. Objetivo e limites

Entregar uma solução definitiva para o plugin funcionar nos forks pessoais locais OpenCode v1 e v2, preservando o rodapé v1 e fornecendo no v2 métricas corretas, navegação, reatividade, limpeza de recursos e instalação local reproduzível. Um agente LLM de alta capacidade responde pela execução inteira e coordena especialistas conforme o model-router.

O uso é exclusivamente pessoal. Não criar PR, issue ou contribuição upstream; não publicar npm, release pública, pacote remoto ou realizar push. São permitidas, durante a futura execução autorizada, as customizações necessárias nos forks locais. Preferir as extensões já existentes; modificar o host apenas quando uma limitação real impedir o objetivo.

O pedido atual é editar e revisar este plano. As fases abaixo continuam pendentes. Os pre-flights, testes e reviews de implementação devem ser efetivamente realizados quando o plano for executado, não declarados concluídos por existir uma checklist.

| Alvo | Escopo obrigatório |
| --- | --- |
| Fork pessoal v1 | Preservar `session_footer`, métricas, aparência e comandos; fallback sem contador quando `children()` não existe |
| Fork pessoal v2 | Usar `session.composer.top`, APIs v2 e instalação TUI local; funcionar com o runtime efetivamente adotado pelo usuário |
| Node/Bun v2 | Gerar ESM precompilado; testar os dois caminhos locais se ambos estiverem disponíveis e incluí-los na matriz somente com evidência |
| OpenCode oficial sem customizações | Não é alvo de suporte ou de validação pública neste plano |

Não anunciar suporte a todas as versões. Fixar os SHAs/releases dos forks realmente usados; o mínimo v1.15 citado na documentação anterior só é preservado como afirmação se testado. A compatibilidade local v1 e v2 é obrigatória, sem substituí-la por sucesso em apenas uma geração.

## 2. Evidência existente e decisões técnicas

O plugin no commit `162fee8d1966f462ad6764b9980237c5c5d7d1d5` é incompatível com o v2 examinado. A análise anterior foi estática: não executou o plugin na TUI nem instalou dependências.

| Evidência | Origem / conclusão |
| --- | --- |
| Plugin atual | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\index.tsx`: `default {id,tui}`, slot `session_footer`, API `state` |
| Dependências e comandos | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\package.json`: sem scripts de build/teste/typecheck; SDKs legados e OpenTUI de desenvolvimento `^0.1.97` |
| Tipos | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tsconfig.json`: strict, JSX preservado; os testes não são cobertos pela configuração atual |
| Host v1 lido | Repositório `D:\git\opencode`, ref local `dev`, SHA `166bb006a7fba0a01e2398b044d09a2c4db2b0d2`, pacote `1.18.29`; binário no PATH informou `1.18.32`, sem prova de execução do plugin |
| Host v2 lido | Repositório `D:\git\opencode`, ref `v2`, SHA `74dbc509d74df46a2523676dd4068225c4f0c9b0`, pacotes `2.0.20`; esse SHA coincidiu com o remoto do fork na consulta anterior |
| Runtimes de UI dos hosts | Nos SHAs acima, `D:\git\opencode\package.json` declara OpenTUI `0.4.5` / Solid `1.9.10` no v1 e OpenTUI `0.5.12` / Solid `1.9.15` no v2; ambas as gerações aplicam patch ao Solid. Não confundir isso com a dependência de desenvolvimento antiga do plugin |

Revalidar somente os contratos que mudarem em relação a esses baselines. O sufixo `@opencode-ai/sdk/v2` é do SDK legado; não prova compatibilidade com o aplicativo v2.

Decisões que a implementação deve preservar:

1. **Um pacote local, dois adaptadores.** Entrada legada `default {id,tui}` e entrada TUI dual `default {id,tui,setup}`. Ambos os validadores examinados toleram a propriedade adicional da outra geração. Imports de tipos e carregamento tardio impedem que o SDK inativo bloqueie a geração ativa. Manter ID e export nomeado `tui`.
2. **Build e resolução real do runtime.** Transformar JSX em ESM, com saídas separadas por geração e Solid/OpenTUI externos. O Node v2 observado carrega plugins precompilados; `tsc` com JSX preservado não basta. Externalização não garante identidade: no ref v2, `D:\git\opencode\packages\plugin\src\source.node.ts` usa `nextResolve` para imports de pacotes a partir do plugin. Resolver explicitamente `solid-js`, `@opentui/core`, `@opentui/solid` e os subpaths efetivamente importados para as instâncias canônicas e patched do respectivo host. No Bun, usar a integração existente; no Node, usar um hook público adequado ou implementar o mapeamento mínimo no fork local. Esse mapa deve ficar restrito ao grafo TUI do plugin, preservar resolução dos demais plugins/servidor, manter a URL canônica do runtime sem sufixo de reload e liberar recursos do hook ao descarregar. Provar igualdade de referências e renderização reativa, não apenas versões iguais. Se esse mecanismo for tecnicamente inviável, heavy deve definir instalações e grafos de dependências isolados por host que preservem a mesma identidade; nunca alternar uma junction compartilhada enquanto outra geração estiver rodando.
3. **Resolução local correta.** O v2 resolve diretórios locais por entrada convencional `tui`; os exports de pacote são outro caminho. Criar fachada JavaScript na raiz. Não usar um arquivo TSX avulso como instalação local v2.
4. **Somente TUI no v2.** Instalar na configuração do cliente; não registrar acidentalmente o plugin no servidor. A raiz híbrida aceitaria um contexto de servidor incorreto; a raiz legada também não passa na validação server v2. Documentar a retirada de entrada server duplicada durante migração. Não adicionar servidor sem operações sem necessidade demonstrada.
5. **Estado e dados.** Normalizar `state` v1 versus `data` v2, status objeto versus string, `role` versus `type`, tokens/custo/título opcionais e modelo aninhado. V2 usa catálogo da localização da sessão, inclusive em conexão remota.
6. **Sem métricas falsas.** Totais v2 vêm da sessão, não da janela paginada de mensagens. Contexto vem da última resposta válida após compactação. Dado ausente não significa zero. O uso da última resposta não deve ser rotulado como agregado completo do turno.
7. **TPS honesto.** No v2 observado tokens chegam ao encerrar o passo; não transformar esse lote em velocidade instantânea. Exibir média aproximada após resposta, preferindo duração `created→streamed`; usar `completed` com semântica explícita ou omitir quando faltarem dados. Preservar TPS v1 se houver deltas reais.
8. **Irmãos e comandos.** Família inteira não é lista de irmãos. Filtrar mesmo pai, ordenar v2 por criação e ID, usar a mesma lista para contador e ciclo. `session.child.previous/next` constam da configuração v2, mas não foram encontrados handlers equivalentes; verificar disponibilidade real e, se necessário, implementar comandos do plugin e navegação pública. Não capturar setas do editor indiscriminadamente.
9. **Ciclo de vida.** Sincronizar o necessário por sessão/localização, sem polling de rede por segundo nem varrer todo o histórico. Cancelar timers, assinaturas, slots e comandos; evitar resultados assíncronos tardios de uma sessão contaminarem outra.

## 3. Ambiente, caminhos e artefatos

Plataforma: Windows / win32. Shell: pwsh. Diretório de execução atual: `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer`. Checkout pessoal original do plugin: `D:\git\opencode-rich-footer`. Repositório pessoal do host: `D:\git\opencode`.

Todos os caminhos de filesystem neste plano são absolutos. Na futura execução, se o checkout autorizado for outro, resolver os caminhos reais e atualizar este documento e a matriz de ownership antes de despachar trabalho; não misturar silenciosamente dois checkouts. Subpaths lógicos de pacote, como `.` e `./tui`, são identificadores de export, não caminhos de filesystem.

Arquivos previstos, a criar ou modificar apenas durante implementação:

| Responsável exclusivo | Arquivos / diretórios absolutos |
| --- | --- |
| CORE | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\contracts.ts`; `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\metrics.ts`; `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\timing.ts` |
| V1 | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\adapters\v1.tsx` |
| V2 | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\adapters\v2.tsx`; `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\navigation.ts` |
| UI | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\footer.tsx` |
| INTEGRADOR | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\index.tsx`; `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\tui.ts`; `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tui.js`; `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\package.json`; `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tsconfig.json`; `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tsconfig.v1.json`; `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tsconfig.v2.json`; `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\.gitignore`; `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\bun.lock`; `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\scripts\build.ts` |
| TESTES | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tests`; dividir esse diretório em arquivos de ownership único antes de paralelizar |
| BUILD, um processo por vez | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\dist\tui.js`; `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\dist\v1`; `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\dist\v2`; `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\node_modules` |
| DOCS | `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\README.md` |
| ORQUESTRADOR | Este documento; registros em `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence`; integração Git e qualquer mudança de configuração pessoal |

Não instalar dependências nem gerar arquivos dentro de `D:\git\opencode` enquanto outro trabalho estiver usando o checkout. Se uma alteração no host for necessária, criar/reutilizar worktree isolado apropriado, por exemplo `D:\git\opencode-rich-footer-host-v1` ou `D:\git\opencode-rich-footer-host-v2`, depois de verificar que não pertencem a outro trabalho. Registrar os arquivos exatos e seus owners antes da edição. Não mudar a branch do checkout original para executar testes.

## 4. Model-router e responsabilidade de QA

Anotações seguem o template `/annotate-plan` verificado em `D:\git\opencode-model-router\src\index.ts`, documentação em `D:\git\opencode-model-router\README.md` e tiers em `D:\git\opencode-model-router\tiers.json`. As tags são metadados de roteamento; esta revisão não alega ter executado o comando do plugin na sessão atual.

| Tag | Responsabilidade |
| --- | --- |
| `[tier:fast]` | Coleta somente leitura de arquivos, refs, logs e inventário |
| `[tier:medium]` | Implementação, correções mecânicas, codificação dos testes especificados e execução dos comandos |
| `[tier:heavy]` | Arquitetura, diagnóstico complexo, análise de cobertura/edge cases, todos os pre-flights avaliativos e toda avaliação/revisão QA |

**QA IS ALWAYS HEAVY. Sem exceções.** Toda senior QA engineer review, revisão adversarial, avaliação de teste, classificação de finding, aprovação de fase e aprovação global é heavy. Um runner medium apenas executa comandos e coleta resultados; não aprova QA. Escrever um teste especificado pelo QA é implementação; decidir sua suficiência é heavy.

O orquestrador de alta capacidade não abdica do objetivo global ao delegar. Cada dispatch contém TASK, EXPECTED OUTCOME, TOOLS, MUST DO, MUST NOT DO, CONTEXT e ENVIRONMENT, incluindo paths absolutos, ownership, snapshot autorizado e proibição de trailers de modelos. Usar o mapeamento ativo de tiers, sem fixar fornecedores inexistentes. Se heavy não estiver disponível, isso bloqueia o gate; não rebaixar a revisão para medium.

Separar trabalho pesado: fast reúne o contexto; heavy projeta/analisa; medium implementa/roda comandos; heavy revisa evidência. Fornecer a heavy um pacote congelado com diff, contratos, resultados, cobertura e questões abertas. Ampliar CAP quando necessário com `CAP:none` e `reason:` explícito, sem usar falta de orçamento como justificativa para aprovar QA incompleto.

Blocos `[acceptance]` acompanham tarefas não triviais. `testsPass` significa testes afetados, não cobertura suficiente nem aprovação global. Os critérios narrativos e os gates de fase continuam obrigatórios. Usar apenas `criteria` quando a tarefa for analítica, sem falsificar um teste executado.

## 5. Execução contínua, commits e coordenação segura

### Autonomia e gates

Quando o usuário autorizar a execução deste plano, executar W1 → W2 → gate global **sem interrupções para pedir aprovação entre waves ou fases**. Não parar em protótipo, scaffolding, adaptador vazio, flag desligada por padrão, placeholder ou entrega parcial. W1 resolve toda a funcionalidade dual; W2 resolve a instalação e validação no uso pessoal real. Commits intermediários são checkpoints, não entregas finais.

Cada fase obedece: pre-flight → implementação completa do subobjetivo → novos testes de encerramento → build/typecheck/testes → senior QA heavy adversarial → correções de todos os achados → novos testes de regressão → reexecução afetada → nova revisão heavy → DoD → próximo pre-flight. Nunca avançar com findings pendentes.

Só interromper a execução para: ambiguidade material que exige decisão humana; problema crítico; bloqueio externo real; ou a recuperação após três falhas no mesmo problema prescrita pelas instruções do repositório. Bugs comuns encontrados em QA devem ser corrigidos autonomamente. Relatar evidência, tentativas e pergunta específica ao escalar. Não confundir dificuldade com bloqueio.

### Commit often

Durante a execução autorizada, fazer commits locais frequentes após cada unidade coerente que entregue comportamento definitivo e passe os checks direcionados; fazer checkpoint adicional após fechamento QA de cada fase e do gate global. Essa diretiva autoriza os commits de implementação, sem nova pergunta a cada commit; não autoriza push, PR ou publicação.

Somente o orquestrador usa o índice Git. Revisar o diff e adicionar caminhos explícitos; não usar stage indiscriminado nem incluir alterações do usuário. Não commitar código quebrado, logs sensíveis, caches ou dependências. Não usar `Co-Authored-By` de modelos nem “Generated with Codex”. Correções de QA entram em commits próprios; não reescrever histórico alheio. Se a execução começar em detached HEAD, criar branch local `codex/` após verificar o estado.

### Paralelismo com locks de leitura e escrita

1. O orquestrador mantém registro único de locks com path absoluto canônico, owner, modo READ/WRITE, dependências, snapshot/hash e estado. Normalizar caixa, junctions e aliases do Windows para que dois nomes do mesmo arquivo não escapem do lock.
2. Vários READ simultâneos são permitidos somente no mesmo snapshot imutável. WRITE é exclusivo: nenhum segundo writer e **nenhum reader** no arquivo/diretório enquanto estiver em edição. Um reader libera seu lock antes de qualquer writer começar. Isso inclui o orquestrador, busca `rg`, formatter, language service, gerador, build, teste e QA.
3. Cada dispatch declara read-set e write-set completos. Não executar busca global sobre áreas em edição; receber o trecho congelado no prompt ou aguardar. Um snapshot de leitura deve ser cópia feita depois da liberação do writer, ou conteúdo de commit estável; nunca copiar arquivos em plena edição.
4. Um contrato compartilhado é escrito por CORE, validado e congelado antes dos consumidores. V1, V2 e UI podem então trabalhar em paralelo em arquivos distintos lendo esse contrato. Mudança de contrato exige parar consumidores, liberar READ, editar sob WRITE, versionar e redistribuir o snapshot.
5. Respeitar a tabela de ownership. Ninguém corrige imports ou formata o arquivo de outro agente: envia patch sugerido, e o owner aplica. Para transferir ownership, receber confirmação de encerramento e liberação dos locks. Não presumir liberação por timeout; interromper o agente e confirmar estado antes de transferir.
6. Instalação de dependências, atualização do lockfile, build e integração são serializados. O build recebe WRITE nos artefatos e READ em toda sua árvore de fontes; nenhuma dessas fontes pode mudar durante a execução. Testes e QA usam snapshot congelado de toda a dependência transitiva que leem, com resultados em diretórios exclusivos por execução.
7. Testes paralelos têm configuração, HOME/XDG de sandbox, cache, portas e sessões isolados. Nunca repor variáveis de sistema no processo global; configurar apenas o subprocesso do teste. Reservar e registrar os paths temporários absolutos antes do dispatch. Não conectar testes a conversas/dados reais do usuário.
8. Gate de integração: recolher todos os resultados, encerrar writers, validar hashes, integrar pelo owner, rodar checks e criar snapshot. Só então delegar QA. Durante revisão heavy, zero writers nos arquivos sob review. Findings vão ao orquestrador, que encerra o snapshot de review antes das correções.
9. Se um hash mudar sem handoff, descartar evidência afetada e investigar; não aprovar snapshot misto. Git, alterações de configuração pessoal e integração entre worktrees são exclusivos do orquestrador.

Maximizar concorrência dentro dessas regras: coleta dos dois hosts em paralelo; V1/V2/UI após contrato congelado; grupos de testes independentes em sandboxes diferentes; documentação sobre contratos congelados. Respeitar os slots realmente disponíveis e nunca criar concorrência fictícia sobre os mesmos arquivos.

## 6. Waves e dependências

| Wave / fase | Subobjetivo definitivo | Paralelismo permitido | Saída exigida |
| --- | --- | --- | --- |
| W1 / P1 | Implementar o rodapé completo nos dois forks, com build, métricas, navegação, lifecycle e testes | CORE congela contrato; V1/V2/UI paralelos; integração/build exclusivos | Mesma solução completa funciona em hosts locais isolados v1 e v2; QA P1 fechado |
| W2 / P2 | Integrar e customizar a instalação pessoal local, com matriz de regressão e documentação reproduzível | Inventários e sandboxes isolados paralelos; configuração e Git exclusivos | Instalações pessoais verificadas, sem mudança upstream; QA P2 fechado |
| Gate global | Aprovar a solução inteira no snapshot final | Coleta mecânica paralela em snapshots; julgamento heavy independente | DoD global, findings zerados e commits locais rastreáveis |

Não há wave de “apenas fundação” ou fase que entregue metade do rodapé. Tasks podem produzir incrementos internos, mas uma fase só termina com seu subobjetivo resolvido integralmente.

## 7. W1 / P1 — implementação dual completa

### [tier:heavy] P1.PF — pre-flight obrigatório, antes de qualquer edição da fase

[acceptance]
criteria: Pacote de evidências atual, dependências disponíveis, ownership sem conflito e plano técnico fechado; nenhuma ambiguidade ou bloqueio crítico oculto.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\preflight-p1.md
[/acceptance]

- [tier:fast] P1.PF.a — coletar cwd real, Git status/diff/HEAD, branch, alterações preexistentes, runtimes, SHAs v1/v2 e contratos alterados desde a análise; preservar trabalho do usuário.

[acceptance]
criteria: Inventário identifica baseline de cada fork, alterações alheias e drift desde a análise; não há inferência de compatibilidade baseada apenas na versão do executável.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\preflight-p1.md
[/acceptance]

- [tier:fast] P1.PF.b — inventariar caminhos reais de configuração e execução dos forks sem expor segredos; verificar toolchain, transformação JSX, OpenTUI/Solid e viabilidade de carregar host real em sandbox.

[acceptance]
criteria: Paths, runtimes, versões e patches de UI, resolvedores e comandos disponíveis estão documentados; sandboxes têm caminho de execução real e não dependem de dados pessoais.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\preflight-p1.md
[/acceptance]

- [tier:heavy] P1.PF.c — revisar matriz, contrato normalizado mínimo, riscos de instalação server, plano de isolamento, cobertura e locks. Definir explicitamente a resolução canônica/patched de Solid/OpenTUI e todos os subpaths importados para cada host, incluindo a eventual alteração mínima no hook Node do fork; aprovar ou documentar bloqueio antes de iniciar P1.T1.

[acceptance]
criteria: Parecer heavy fecha o mecanismo de identidade do runtime, versão/patch e testes por referência mais render real; subtasks P1.PF.a–c têm evidência e os testes não confundem mock com host.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\preflight-p1.md
[/acceptance]

### [tier:medium] P1.T1 — núcleo definitivo de dados, métricas e temporização

[acceptance]
check: testsPass
criteria: Contratos mínimos tipados, métricas com semântica explícita e timing corretos, independentes de SDK/runtime de host; sem placeholders ou supressões de tipos.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\contracts.ts; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\metrics.ts; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\timing.ts
[/acceptance]

- [tier:medium] P1.T1.a — implementar contrato e normalização: ausência versus zero, última resposta versus sessão/turno, identidade de agente/modelo/localização, status e ações. Congelar a interface para liberar V1/V2/UI em paralelo.

[acceptance]
check: testsPass
criteria: Consumidores recebem um snapshot estável e exemplos v1/v2 tipados; dados opcionais não provocam exceção nem números fictícios.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\contracts.ts
[/acceptance]

- [tier:medium] P1.T1.b — implementar cálculos e lifecycle de tempo: cache com denominador válido, contexto após compactação, custo cumulativo v2, TPS disponível/estimado/ausente, reset entre mensagens e sessões, limpeza e proteção contra updates tardios.

[acceptance]
check: testsPass
criteria: Sem NaN, Infinity, delta negativo artificial, dupla contagem ou contaminação entre sessões; mesma entrada gera mesmo resultado.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\metrics.ts; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\timing.ts
[/acceptance]

### [tier:medium] P1.T2 — adaptadores e interface final para os dois hosts

[acceptance]
check: testsPass
criteria: Rodapé completo com todas as funções nas duas gerações; ausência em sessão principal; nenhuma dependência de APIs da geração errada.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\adapters\v1.tsx; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\adapters\v2.tsx; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\navigation.ts; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\footer.tsx
[/acceptance]

- [tier:medium] P1.T2.a — owner V1 implementa o slot e estado antigos, preserva os comandos e a ordem de irmãos do host, a aparência e a degradação sem `children()`; não alterar a semântica v1 silenciosamente.

[acceptance]
check: testsPass
criteria: Regressão v1 passa com e sem children; nenhum import v2 ativo no caminho v1.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\adapters\v1.tsx
[/acceptance]

- [tier:medium] P1.T2.b — owner V2 implementa slot, estado, modelo por localização, totais cumulativos, comandos e irmãos diretos; router público para fallback, ordenação estável, contador consistente, sync limitado e cleanup completo.

[acceptance]
check: testsPass
criteria: Não depende de handlers inexistentes nem calcula totais pelo histórico parcial; navegação não sai do conjunto de irmãos corretos.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\adapters\v2.tsx; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\navigation.ts
[/acceptance]

- [tier:medium] P1.T2.c — owner UI implementa a apresentação compartilhada e responsiva usando os tokens fornecidos pelo contrato; valida mouse/teclado, contraste conforme tema do host, foco e coexistência com composer/subagent picker; sem redesign alheio à compatibilidade.

[acceptance]
check: testsPass
criteria: Rodapé legível sem invadir prompt; tema muda reativamente; atalhos exibidos correspondem a comandos existentes; dados ausentes ficam explicitamente ausentes.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\footer.tsx
[/acceptance]

### [tier:medium] P1.T3 — entradas, build e carregamento definitivos

[acceptance]
check: testsPass
criteria: Build ESM dual sem JSX cru no caminho Node; loaders reais aceitam entradas; geração inativa não exige dependência runtime; instalação local não executa TUI no servidor.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\index.tsx; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\src\tui.ts; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tui.js; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\scripts\build.ts; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\package.json
[/acceptance]

- [tier:medium] P1.T3.a — integrador implementa entradas legada/dual/convencional, imports tardios, toolchains por geração, peers e scripts; inclui tipos de testes; fixa versões/lockfile reproduzíveis e implementa o mecanismo de resolução canônica aprovado em P1.PF.c, com patch local do host sob owner exclusivo quando necessário. Os scripts planejados devem existir e funcionar antes de serem usados como gates. Instalação e scripts mínimos podem começar logo após o pre-flight para viabilizar checks direcionados de P1.T1/T2; isso não constitui uma entrega ou fase separada.

[acceptance]
check: testsPass
criteria: Comandos de build/typecheck/teste existem; artefatos e dependências são reproduzíveis; referências de Solid/OpenTUI e subpaths resolvidos no plugin são as mesmas do host patched; reload não duplica essas instâncias.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\package.json; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\scripts\build.ts; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\bun.lock
[/acceptance]

- [tier:medium] P1.T3.b — integrar o produto completo e carregá-lo nos hosts pessoais isolados v1/v2, incluindo Node quando disponível; confirmar entrypoints, montagem, dados, navegação e unload. Se um patch local de host for indispensável, heavy resolve o desenho, o owner implementa com regressão no host isolado e entrega a solução completa nesta fase.

[acceptance]
check: testsPass
criteria: V1 e v2 executam o rodapé completo em loader/TUI reais; patch de host, se houver, tem causa comprovada, ownership, testes e commit local, sem edição concorrente do checkout original.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\integration-p1.md
[/acceptance]

### [tier:heavy] P1.TEST — novos testes ao final da fase e avaliação de cobertura

[acceptance]
check: testsPass
criteria: Casos abaixo viraram testes significativos; relatório distingue unidade, integração e TUI real; cobertura por arquivo/branch verificada e limitações explícitas.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tests; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\tests-p1.md
[/acceptance]

Heavy desenha novos cenários a partir do diff final, além dos testes escritos durante implementação. Medium codifica/roda esses testes sob ownership exclusivo; heavy julga os resultados. Não criar testes que apenas espelham a implementação.

| Área | Cobertura e edge cases P1 obrigatórios |
| --- | --- |
| Métricas | tokens/custo/título ausentes; zero e reasoning sem output; cache sem input novo; denominador zero; modelo desconhecido; mesma ID de modelo em providers/localizações diferentes; compactação; histórico incompleto; total invariável à paginação; distinguir custo zero de desconhecido |
| Tempo | fake clock; resposta e turno novos; múltiplos passos; busy/retry/idle; abrir sessão já em curso; switch durante promise pendente; resultado fora de ordem; `streamed`/`completed` ausentes ou iguais; nenhuma velocidade inventada a partir do lote final |
| Hierarquia | raiz, filho, neto, pais diferentes; zero/um/muitos irmãos; empates de criação; remoção do atual/alvo; cache incompleto; mudança de ordem global por atualização; contador usa o mesmo ciclo |
| UI e input | themes claro/escuro e troca em execução; terminal 40/80/120 colunas; mouse; comando sem binding; bindings alterados; editor focado; conflito com composer; sessão sem parentID não renderiza |
| Lifecycle | load/unload/reload repetidos; listener/timer/slot/comando volta à contagem inicial; sync rejeita com diagnóstico; geração inativa não é importada; sem side effects em sessão principal |
| Entradas | diretório com espaços/Unicode no Windows; URL file; entrada convencional; loader real aceita cada caminho; v2 Node não recebe TSX; configuração server indevida não é apresentada como instalação válida |
| Identidade do runtime | plugin com dependência própria conflitante; igualdade de referências host/plugin para Solid/OpenTUI e subpaths; owner/contexto reativo preservado; cleanup patched; reload mantém instâncias compartilhadas; hooks não alteram outro plugin nem o servidor; v1 e v2 simultâneos sem trocar junction |

Meta obrigatória: >=90% de linhas e >=85% de branches do código de produção novo/alterado, com relatório por arquivo. Nos cálculos, timing, guards de dados e navegação, cobrir 100% dos casos semânticos da tabela, mesmo quando a métrica de instrumentação não distingue um cenário. Excluir apenas artefatos gerados e declarações sem execução; não excluir adaptadores ou UI para alcançar a meta. Se a instrumentação JSX exigir pipeline específico, implementá-lo; não reduzir a meta silenciosamente. Coverage não substitui observação de TUI real.

### [tier:heavy] P1.QA — senior QA engineer review adversarial

[acceptance]
criteria: Revisor heavy independente recebeu snapshot congelado e tentou invalidar comportamento, dados, instalação e cobertura; todos os findings fechados com prova e nova revisão heavy.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\qa-p1.md
[/acceptance]

O revisor não pode ser o autor das alterações que aprova. Questionar falsos positivos dos testes, promises tardias, ordens de eventos, isolamento de dependências, vazamento de listeners, família versus irmãos, fallback de modelo, regressão v1 e diferença entre mocks e runtime real. Cada finding contém ID, severidade, path absoluto/linha, reprodução, impacto, correção esperada e evidência de fechamento. Aplicar o loop de correções da seção 10, inclusive a findings de baixa severidade.

### Critérios de aceitação P1

- Mesma solução local entrega todas as funções requeridas em v1 e v2; nenhuma métrica/nav adiada para P2.
- Build e typecheck de ambas as gerações, testes afetados e novos testes P1 passam; cobertura atinge as metas.
- Carga real v1/v2, isolamento de dependências, cleanup, foco, tema e contador comprovados.
- Zero findings QA pendentes; nenhum erro suprimido, teste removido/pulado ou API inventada.

### Definition of Done P1

Todos os critérios acima, pre-flight aprovado, ownership liberado, resultados vinculados ao hash exato revisado, commits locais coerentes realizados, evidências P1 completas e relatório heavy com PASS. O orquestrador confirma resultados independentemente. Só então marcar P1 completa e iniciar o pre-flight P2 automaticamente.

## 8. W2 / P2 — instalação pessoal definitiva e regressão operacional

### [tier:heavy] P2.PF — pre-flight obrigatório antes desta fase

[acceptance]
criteria: DoD P1 comprovado no mesmo snapshot; inventário local atualizado; planos de integração/configuração e reversão preservam alterações e dados pessoais.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\preflight-p2.md
[/acceptance]

- [tier:fast] P2.PF.a — conferir commits P1, QA fechado, drift nos forks/runtimes/configurações e quais processos os utilizam; identificar os caminhos reais e absolutos de configuração, sem despejar credenciais.

[acceptance]
criteria: Inventário registra SHAs de origem/destino, drift, processos e configurações reais; não considera que a instalação continua correta apenas porque P1 passou.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\preflight-p2.md
[/acceptance]

- [tier:heavy] P2.PF.b — validar matriz pessoal v1/v2, locks, integração no checkout de uso, backups/reversão e criação de sandboxes; aprovar mudanças mínimas de configuração e eventuais patches de host já testados.

[acceptance]
criteria: Snapshot P1 não divergiu; nenhum checkout sujo ou processo ativo será sobrescrito/interrompido inadvertidamente; divergências foram resolvidas ou viraram bloqueio específico.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\preflight-p2.md
[/acceptance]

### [tier:medium] P2.T1 — integrar e configurar somente os forks locais

[acceptance]
check: testsPass
criteria: Checkout pessoal e instalações v1/v2 usam a solução testada, com configurações separadas e caminho TUI correto; nenhuma alteração/push/publicação upstream.
deliverable: D:\git\opencode-rich-footer; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\installation-p2.md
[/acceptance]

- [tier:medium] P2.T1.a — orquestrador integra commits locais do plugin em `D:\git\opencode-rich-footer` preservando divergências; integra patches do host somente se necessários e validados. Registra HEADs finais e usa config sandbox para verificar o diretório de uso antes da mudança pessoal.

[acceptance]
check: testsPass
criteria: Histórico do usuário preservado, integração sem reset/force, build local regenerado e conteúdo final corresponde ao snapshot aprovado.
deliverable: D:\git\opencode-rich-footer; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\installation-p2.md
[/acceptance]

- [tier:medium] P2.T1.b — orquestrador faz backup e ajuste mínimo nas configurações pessoais identificadas no pre-flight: conserva registro v1, usa registro TUI local v2, remove duplicidade server apenas desse plugin e verifica carregamento; não alterar outros plugins, credenciais ou preferências. Testar rollback da alteração em sandbox e preservar o backup real.

[acceptance]
check: testsPass
criteria: Ambos os forks carregam o plugin do diretório esperado sem conflito; paths absolutos das configs e backups registrados, sem conteúdo sensível; nenhuma sessão ativa do usuário foi manipulada para testar.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\installation-p2.md
[/acceptance]

### [tier:medium] P2.T2 — documentação operacional pessoal verificável

[acceptance]
check: testsPass
criteria: Instruções reproduzem setup local testado, registram baselines, comandos existentes, caminho de config cliente, build e limitações; não prometem suporte público nem exigem publicação.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\README.md
[/acceptance]

- [tier:medium] P2.T2.a — documentar instalação/desenvolvimento em paths absolutos reais dos forks, comandos de build/teste, runtime, fallback sem children, TPS v2, ausência de métricas e configuração server indevida; incluir recuperação de instalação local.

[acceptance]
check: testsPass
criteria: Cada comando documentado foi executado em sandbox correspondente; exemplos de configuração preservam o registro próprio de cada geração.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\README.md
[/acceptance]

### [tier:medium] P2.T3 — sincronização final e recorrente do destino instalado

[acceptance]
check: testsPass
criteria: Todos os commits de implementação, correções, documentação e testes estão integrados no destino de uso; build regenerado nesse destino, HEADs e hashes registrados e smoke do destino aprovado antes de congelar evidência para QA.
deliverable: D:\git\opencode-rich-footer; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\installation-p2.md
[/acceptance]

Esta é uma rotina reentrante obrigatória, executada depois dos checks no worktree e **antes de toda coleta de evidência de instalação P2/global**, inclusive depois de escrever os novos testes P2 e depois de qualquer correção de QA. O orquestrador integra os commits preservando divergências, regenera o build no checkout de uso e, se houver patch de host, reconstrói e registra o host correspondente. Compara conteúdo de fontes/configurações/artefatos entre origem aprovada e destino, registra HEADs e hashes e executa smoke apontando explicitamente para o destino instalado. Não exige SHA igual se a integração preservar commits próprios do destino; exige equivalência dos arquivos e comportamento relevantes demonstrada pelo manifesto. Só então congela o snapshot para review heavy. Commits finais de documentação e testes também precisam chegar ao destino. Uma mudança posterior torna stale a evidência afetada e exige repetir esta rotina.

### [tier:heavy] P2.TEST — novos testes finais de instalação e operação

[acceptance]
check: testsPass
criteria: Casos operacionais adicionais cobrem instalação limpa, atualização, persistência da configuração e isolamento; suíte P1 permanece verde e novas branches mantêm a meta de coverage.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tests; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\tests-p2.md
[/acceptance]

Heavy desenha cenários novos após o diff P2; medium implementa, executa P2.T3 para sincronizar os commits novos e só então roda/coleta a evidência final; heavy avalia. Testar os dois forks pessoais com diretório local limpo, espaço/Unicode no path, dependência ausente, artefato de build ausente, instalação atualizada, restart/reload, config server duplicada, sessões antigas/novas, conexão v2 remota com catálogo de outra localização e configuração que muda bindings. Testar servidor remoto com ambiente controlado local, sem serviço do usuário.

Exercitar pelo menos 20 ciclos determinísticos de load/unload e troca de sessão, observando timers/listeners/slots; adicionar regressão para qualquer finding. Aplicar as metas de coverage P1 ao conjunto final e às alterações P2; não diluir cobertura nova com código antigo. Revalidar o output ESM no Node v2 se esse runtime integrar a matriz pessoal. Não exigir publicação npm nem instalação pública para validar uso por diretório.

### [tier:heavy] P2.QA — senior QA engineer review adversarial

[acceptance]
criteria: Heavy independente revisa diff, configurações redigidas, snapshots dos forks, resultados reais e documentação; todos os achados corrigidos e reavaliados.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\qa-p2.md
[/acceptance]

Atacar o risco de validar um checkout mas instalar outro, artefato stale, ambiente compartilhado, dupla instalação cliente/servidor, regressão de outros plugins, perda de config, paths inválidos no Windows e afirmações de suporte sem execução. Revisar também reversão e preservação do trabalho pessoal. Aplicar integralmente o loop de correção; sem waivers de conveniência.

### Critérios de aceitação P2

- Checkout de uso e configurações pessoais apontam para a solução correta em ambos os forks.
- Nenhuma publicação, PR, push ou alteração upstream; outros plugins e dados pessoais preservados.
- Novos testes P2, regressões P1, builds/typechecks e documentação executada passam; coverage mantida.
- P2 heavy PASS, zero findings abertos e instalação/reversão local rastreável.

### Definition of Done P2

Critérios acima satisfeitos, pre-flight e evidências vinculados aos HEADs reais dos forks, commits locais realizados, backups preservados, locks liberados, nenhum processo de teste remanescente e documentação coerente com o que está instalado. Prosseguir imediatamente ao gate global, sem declarar conclusão ainda.

## 9. Gate global, critérios de aceitação e Definition of Done

### [tier:medium] G.TEST — validação integral do snapshot final

[acceptance]
check: testsPass
criteria: Build completo, typecheck das duas gerações incluindo testes, suíte completa, smoke da TUI dos dois forks e coverage final executados no mesmo conjunto de commits; sem mudanças após coleta.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\tests-global.md
[/acceptance]

Antes da coleta global, executar P2.T3 incluindo todos os commits finais. Runner coleta comandos exatos, diretório de origem e destino, runtime/versão, HEADs, hashes de fontes/artefatos, exit codes e trechos relevantes; o smoke deve demonstrar o diretório efetivamente instalado, não apenas o worktree de desenvolvimento. QA decide a validade. Não alegar build/lint inexistente: o build é criado em P1; aplicar lint apenas se configurado, e checks sintáticos/tipos sempre. Suites completas uma vez no fechamento, repetidas somente se correções invalidarem a evidência.

### [tier:heavy] G.QA — senior QA engineer review global adversarial

[acceptance]
criteria: Heavy independente verifica o objetivo de ponta a ponta e a rastreabilidade dos gates P1/P2 no snapshot final; tenta encontrar falhas entre fases e valida correção de todos os findings, sem exceção de severidade.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\qa-global.md
[/acceptance]

Revisar arquitetura dual, seleção de entrada, ABI OpenTUI/Solid, semântica das métricas e do tempo, ordem de eventos, navegação, custo de sincronização, recursos vazando, configuração pessoal, Git e instalação real. Confrontar resultados com requisitos; não aprovar apenas porque o conjunto de testes está verde. Gerar cenários adversariais adicionais quando lacunas surgirem e aplicar o loop da seção 10.

### Critérios de aceitação globais

1. Rodapé funciona simultaneamente nos forks pessoais v1 e v2 suportados, com aparência/funcionalidade v1 preservadas e dados v2 corretos.
2. Slots, métricas, parentesco, comandos, mouse/teclado, temas, terminal estreito, conexão remota controlada e lifecycle demonstrados por evidência apropriada.
3. Nenhuma regressão omitida, TODO funcional, stub, solução temporária ou etapa central adiada.
4. Todos os testes novos P1/P2 e regressões passam; metas de coverage atingidas; build e tipos de ambas as gerações passam.
5. Instalação pessoal usa os commits/artefatos efetivamente validados; sem SDK inativo obrigatório ou runtime duplicado; sem TUI executada como plugin server.
6. Todos os findings de cada review foram corrigidos ou demonstrados falsos por evidência e encerrados pelo heavy; zero aberto/adiado/aceito como dívida.
7. Exclusividade de escrita/leitura respeitada, dados/configurações pessoais preservados e nenhuma ação upstream/remota realizada.

### Definition of Done global

Todos os critérios globais e os DoDs P1/P2 cumpridos; G.QA heavy PASS independente; evidências apontam para os commits finais, comando/ambiente e configurações redigidas corretos; commits frequentes auditáveis, working trees sem alterações não registradas desta execução, arquivos preexistentes do usuário preservados, processos/locks de teste encerrados e backups disponíveis. O orquestrador verifica pessoalmente a evidência essencial e entrega paths dos artefatos locais e limitações reais, sem confundir esta aprovação documental com execução.

## 10. Loop obrigatório de fechamento de findings

1. [tier:heavy] Registrar findings P0–P3 com reprodução, impacto, caminho absoluto, snapshot e teste necessário; não esconder observações sob “melhoria opcional”.

[acceptance]
criteria: Cada finding identifica comportamento reproduzível, evidência, impacto e condição objetiva de fechamento; parecer assinado por heavy independente.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\qa-p1.md; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\qa-p2.md; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\qa-global.md
[/acceptance]

2. [tier:medium] Orquestrador atribui cada correção ao owner, encerra READ do reviewer e concede WRITE; implementar a correção definitiva e teste de regressão. Se exigir arquitetura ou segurança, obter análise heavy antes de editar.

[acceptance]
check: testsPass
criteria: Owner exclusivo implementou a solução e teste que reproduz o finding, sem supressão, exclusão de teste ou alteração alheia.
deliverable: Arquivos com paths absolutos especificados no finding e teste de regressão correspondente, vinculados ao registro de execução.
[/acceptance]

3. [tier:medium] Congelar novo snapshot, rodar checks afetados e ampliar regressões quando contratos compartilhados mudarem; reportar logs reais, não apenas “passou”.

[acceptance]
check: testsPass
criteria: Evidência corresponde ao snapshot corrigido, cobre a regressão e efeitos sobre contratos; falhas e exit codes estão visíveis.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\tests-p1.md; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\tests-p2.md; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\tests-global.md
[/acceptance]

4. [tier:medium] Orquestrador faz commit da correção validada. Em P2 ou no gate global, executar P2.T3: integrar no destino, reconstruir, registrar hashes e repetir smoke/checks afetados no destino. Em P1, atualizar os sandboxes da fase com o snapshot corrigido. Congelar origem e destinos antes de devolvê-los ao heavy.

[acceptance]
check: testsPass
criteria: Nenhuma revisão usa uma correção presente só no worktree; snapshot, artefatos e instalação testada correspondem aos commits corrigidos, sem sobrescrever divergências pessoais.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\installation-p2.md; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\integration-p1.md
[/acceptance]

5. [tier:heavy] O mesmo revisor confirma o fechamento e examina efeitos colaterais no snapshot sincronizado; repetir até zero findings. Se um finding era falso, encerrá-lo somente com prova explícita aceita pelo heavy, sem mudanças artificiais.

[acceptance]
criteria: Heavy verificou causa, teste, correção, evidência e destino aplicável; finding fechado ou devolvido com motivo concreto, nunca aceito por falta de tempo.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\qa-p1.md; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\qa-p2.md; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\qa-global.md
[/acceptance]

6. [tier:medium] Orquestrador registra vínculo finding→commit→teste→destino→evidência→re-review. Integra também os commits finais de documentação/testes. Qualquer edição posterior invalida a aprovação do escopo afetado e exige os checks, sincronização e nova revisão heavy correspondentes.

[acceptance]
criteria: Rastreabilidade completa e metadados de origem/destino corretos; encerramento não deixa commits de produto, documentação ou testes fora do checkout de uso.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\execution.md
[/acceptance]

[acceptance]
criteria: Nenhum finding sem resolução verificável; nenhuma fase avançou por timeout, falta de tokens ou mera promessa de correção.
deliverable: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\qa-p1.md; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\qa-p2.md; C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\qa-global.md
[/acceptance]

Depois de três falhas consecutivas no mesmo problema, parar a edição e recuperar somente as próprias mudanças do checkpoint estável, preservando o teste que demonstra a falha e todo trabalho alheio; registrar tentativas e consultar heavy. Se não resolver, tratar como bloqueio e pedir esclarecimento humano específico. Nunca deletar/pular teste falho, usar catch vazio ou suprimir erro de tipo.

## 11. Rastreabilidade e registro de execução

O orquestrador mantém `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\execution.md` com status de wave/phase/task/subtask, owners, locks, snapshots, SHAs, commits, resultados, coverage e findings. Marcar `in_progress` antes de cada unidade e `completed` imediatamente após seu acceptance, sem preencher conclusões em lote. A edição desse registro também é exclusiva; leitores recebem snapshot.

| Unidade | Estado inicial | Gate necessário |
| --- | --- | --- |
| W1 / P1 | pending | P1.PF → P1.T1/T2/T3 → P1.TEST → P1.QA → DoD P1 |
| W2 / P2 | pending | P2.PF → P2.T1/T2 → testes novos P2 → P2.T3 → execução P2.TEST → P2.QA → DoD P2 |
| Global | pending | P2.T3 → G.TEST → G.QA → DoD global |

Custos desconhecidos, dados ausentes ou runtime indisponível devem constar como tais; nunca registrar “passou” sem output. A ausência de um runtime opcional não autoriza marcar teste como passado; a ausência de v1 ou v2 obrigatório é bloqueio real. Qualquer redução de objetivo exige decisão humana, não ajuste silencioso de critérios.

## 12. Referências primárias

- [Migração oficial v1 → v2](https://opencode.ai/v2/docs/migrate-v1), [contratos CLI v2](https://opencode.ai/v2/docs/build/plugins/cli/) e [configuração CLI v2](https://opencode.ai/v2/docs/cli/plugins) são referências técnicas, sem obrigação de contribuição upstream.
- [Loader v1 do fork](https://github.com/marco-jardim/opencode/blob/166bb006a7fba0a01e2398b044d09a2c4db2b0d2/packages/opencode/src/plugin/shared.ts) e [contrato TUI v1](https://github.com/marco-jardim/opencode/blob/166bb006a7fba0a01e2398b044d09a2c4db2b0d2/packages/plugin/src/tui.ts).
- [Loader TUI v2](https://github.com/marco-jardim/opencode/blob/74dbc509d74df46a2523676dd4068225c4f0c9b0/packages/tui/src/plugin/context.tsx), [resolvedor v2](https://github.com/marco-jardim/opencode/blob/74dbc509d74df46a2523676dd4068225c4f0c9b0/packages/plugin/src/host.ts) e [runtime Node v2](https://github.com/marco-jardim/opencode/blob/74dbc509d74df46a2523676dd4068225c4f0c9b0/packages/tui/src/plugin/runtime-plugin-support.node.ts).
- [Dados reativos v2](https://github.com/marco-jardim/opencode/blob/74dbc509d74df46a2523676dd4068225c4f0c9b0/packages/client/src/solid/data.ts), [mensagens v2](https://github.com/marco-jardim/opencode/blob/74dbc509d74df46a2523676dd4068225c4f0c9b0/packages/schema/src/session-message.ts) e [validador server v2](https://github.com/marco-jardim/opencode/blob/74dbc509d74df46a2523676dd4068225c4f0c9b0/packages/core/src/plugin/module.ts).

## 13. Revisão deste documento

Pre-flight documental realizado: diretório e estado Git conferidos, documento anterior lido, protocolo local do model-router verificado e escopo pessoal incorporado. Nenhum arquivo de implementação foi alterado. A primeira revisão adversarial heavy encontrou QA-01 (identidade do runtime), QA-02 (resincronização da instalação) e QA-03 (acceptance por subtask). Os três pontos foram corrigidos e receberam PASS no re-review independente do mesmo senior QA heavy. Parecer global documental: PASS, sem novos achados relevantes, sobre o snapshot SHA256 `233BB6B44FAEF34D44376A3F05511151DE0BBE823F82F111D2D224B46D28B582`; somente este recibo factual foi atualizado depois. Esta aprovação é do plano: implementação, testes e validação operacional continuam pendentes; nenhum gate de implementação foi aprovado antecipadamente.
