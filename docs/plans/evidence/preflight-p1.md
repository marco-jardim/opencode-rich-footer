# P1 pre-flight

Data: 30/09/2026. Coleta concluída; avaliação heavy aprovada para Bun v1/v2.

## Baselines e preservação

- Plugin: C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer, branch codex/rich-footer-v1-v2; código base 162fee8d1966f462ad6764b9980237c5c5d7d1d5.
- Destino pessoal: D:\git\opencode-rich-footer, master no mesmo código; package-lock.json untracked preexistente, preservado.
- Host v1 fonte: D:\git\opencode, HEAD 1d883fccc393e9b9d3a41cb6cc11caf892a96db4, branch log-session-retention, manifest1.18.29. Não mudar branch nem arquivos preexistentes. OpenTUI0.4.5 e Solid1.9.10 patched instalados.
- Binário pessoal v1: C:\Users\Marquinho\scoop\shims\opencode.exe, versão observada anteriormente1.18.32.
- Host v2 isolado: D:\git\opencode-rich-footer-host-v2, detached SHA74dbc509d74df46a2523676dd4068225c4f0c9b0, manifest2.0.20. Criado nesta execução sem alterar o checkout principal. OpenTUI0.5.12/Solid1.9.15 patched.
- Configs que referem o plugin pessoal: C:\Users\Marquinho\.config\opencode\opencode.json e C:\Users\Marquinho\.config\opencode\tui.json. Nenhum conteúdo sensível exportado e nenhuma alteração realizada.

## Toolchain e prova de viabilidade

- Bun global1.3.14 e Node24.21.0 preservados.
- Bun1.4.2 requerido pelo v2 obtido do pacote oficial @oven/bun-windows-x64 versão1.4.2, integridade SHA512 conferida contra metadata do npm, instalado isoladamente em C:\Users\Marquinho\AppData\Local\Temp\rich-footer-bun-1.4.2\package\bin\bun.exe.
- No checkout v2: install --frozen-lockfile --ignore-scripts filtrando @opencode/tui, @opencode/cli e @opencode/plugin; exit0,757packages. Git status clean após instalação.
- No diretório D:\git\opencode-rich-footer-host-v2\packages\tui: Bun1.4.2 test test/plugin-model.test.tsx --timeout30000 --only-failures. Resultado real:2pass,0fail,12expects. Usa renderer/contextos reais da TUI sem sessões pessoais. Valida ambiente, não o rich-footer ainda.
- Host Nodev2 não instalado. Build do fork usa Node26.4.0 SEA e empacota Solid; Node24.21.0 sozinho não constitui host v2 operacional. Bind por URL de node_modules não resolve a identidade com runtime empacotado.

## Decisão heavy

PASS arquitetural P1.PF.c: matriz pessoal Bun v1/v2, sem patch preventivo de host. O Bun fornece a ponte de módulos canônicos para plugins externos. A fachada JavaScript detectará Node antes de importar UI e explicará que este runtime não é suportado/validado na matriz pessoal atual. Se um host Node entrar no uso pessoal, será necessária ponte do runtime empacotado, não basta resolver URLs. Isso segue o plano que condiciona Node à disponibilidade efetiva do host; ambas as gerações obrigatórias continuam cobertas.

## Contratos e preservação

- V1: slot session_footer, state/session, children na ordem nativa, theme.current, keymap.dispatchCommand.
- V2: setup, slot session.composer.top, sessionID, data/session/message.list, status idle/running, tokens/custo/título opcionais nas mensagens, totals de sessão e catálogo por localização.
- Bun: runtime-plugin-support mapeia imports ESM do plugin para módulos virtuais do host, inclusive Solid/store e OpenTUI/core/testing.
- AGENTS do host requer branch de no máximo três palavras sem barra se houver patch.

## Locks

Leitores de coleta encerrados. Root único writer em registros e integração. Dependências v2 instaladas e liberadas para READ. Nenhum arquivo de implementação alterado antes do PASS arquitetural.
