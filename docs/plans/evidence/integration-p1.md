# P1 — loaders e runtime

Matriz executada no Windows com fontes pessoais imutáveis:

- V1: D:\git\opencode, commit 1d883fccc393e9b9d3a41cb6cc11caf892a96db4, Bun 1.3.14, OpenTUI 0.4.5, Solid 1.9.10 patched.
- V2: D:\git\opencode-rich-footer-host-v2, commit 74dbc509d74df46a2523676dd4068225c4f0c9b0, Bun 1.4.2, OpenTUI 0.5.12, Solid 1.9.15 patched.
- Produto: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer. Entrada convencional C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tui.js; entrada legada C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\dist\index.js.

## Carregamento e identidade

O build transforma JSX universal e depois usa AST para mapear exclusivamente os imports runtime conhecidos aos IDs virtuais publicados pelos hosts. Decisão revisada por heavy após os imports bare em JavaScript compilado falharem no Bun v1. Não há cópia runtime embutida nem patch de host.

As fixtures copiam o produto para diretórios temporários Windows com espaços, acentos e japonês, com módulos Solid/OpenTUI conflitantes reais da outra geração. Comparam referências exportadas de Solid, store, OpenTUI, RGBA e JSX, montam a interface e verificam atualizações, foco, navegação e descarte. O adaptador inativo é substituído por um módulo que lança erro ao importar.

- C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tests\v1-loader.test.tsx usa PluginLoader.resolve/load, readV1Plugin, registry e Slot reais. V1 não expõe invalidação de grafo; 20 caminhos novos de instalação forçam avaliação completa do grafo pelo loader real. Não se apresenta isso como hot reload nativo v1.
- C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tests\v2-loader.test.tsx usa Host.resolve/load, createPluginSources.read, createPluginContext.ui.slot e resolveSlots reais. Alterações do módulo probe provocam 20 reloads reais do grafo; cada export setup precisa ter nova identidade enquanto Solid/OpenTUI conservam identidade do host.
- Ambas montam sessões running, alternam sessões e desmontam; todos os timers próprios devem constar nos clearInterval, listeners de teclado retornam ao baseline e os registros somem. V2 verifica também zero listeners de dados e layers após cleanup.

Os serviços de dados/rotas são sintéticos e tipados. Os testes não inicializam a aplicação inteira, servidor pessoal ou sessões existentes. O renderer e loaders são reais; a conformidade com o editor v2 é verificada separadamente com Keymap.Provider e textarea reais em C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\tests\v2-keymap.test.tsx.

## Limitação Node

Não existe host Node v2 operacional instalado nesta matriz. O build dele exige Node 26.4 e incorpora o runtime; Node 24 local não é equivalente. Um processo Node real verifica que ambos os hooks rejeitam ativação antes de importar UI. Suporte operacional declarado somente Bun v1/v2.

## Resultados de verificação dos reloads

- V1 após reforço: 30 testes, 0 falhas, 926 expects, incluindo 20 avaliações completas.
- V2 smoke isolado após reforço: 1 teste, 0 falhas, 1443 expects, 20 recargas reais.
- Resultado consolidado final e cobertura serão registrados em C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\tests-p1.md após o gate de teclado.
