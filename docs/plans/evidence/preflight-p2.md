# Pre-flight P2 — instalação pessoal

Estado: **GO HEAVY**; pre-flight concluído. Origem: `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer`, commit `73aab5331f68918da6a51dfc438f35d97ccb1838`. P1 recebeu PASS independente do HEAVY; 31 testes v1, 51 v2, typecheck dual, 99,26% linhas / 94% branches.

## Drift e preservação

| Alvo | Estado observado antes de P2 |
| --- | --- |
| `D:\git\opencode-rich-footer` | master `162fee8d1966f462ad6764b9980237c5c5d7d1d5`; somente `D:\git\opencode-rich-footer\package-lock.json` preexistente untracked |
| `D:\git\opencode` | log-session-retention `1d883fccc393e9b9d3a41cb6cc11caf892a96db4`; somente `D:\git\opencode\.opencode\router-lessons.md` preexistente untracked |
| `D:\git\opencode-rich-footer-host-v2` | detached `74dbc509d74df46a2523676dd4068225c4f0c9b0`, limpo |
| Origem | Apenas recibos de aprovação P1 em edição; fontes P1 congeladas |

SHA256 dos arquivos preexistentes: package-lock `82084C5F47AFC36B6485D8126FF3DBBA7CAEC46DA5D64D681A1E13E62096677F`; router-lessons `ECA62510B934FB68C4DFCA8F4632EF8902E003D3444CFD70D34E8FBD6549FC4E`.

Existem processos Bun pessoais (PIDs 51084, 44400, 55472, 60584) usando o Bun global. Não interromper processos nem manipular sessões para testar. Não alterar branch, dependências ou fontes de `D:\git\opencode`. Testes operacionais usam serviços/dados e diretórios de configuração isolados.

## Configurações reais identificadas

| Arquivo absoluto | Contrato / SHA256 antes |
| --- | --- |
| `C:\Users\Marquinho\.config\opencode\opencode.json` | JSON; registro server legado `plugin` inclui rich-footer local. SHA256 `67ADCD7539BA19762A172DF13FC3B30D58E54CFDB38291C3618258D1EB260EAE` |
| `C:\Users\Marquinho\.config\opencode\tui.json` | TUI v1; apenas schema e `plugin`, rich-footer local. SHA256 `41953C11E6D4EFCCE842BE2756B8C22032FDE292ABB0FC54F2C81EF242BCD2FE` |
| `C:\Users\Marquinho\.config\opencode\cli.json` | Ausente; cliente v2 lê este arquivo com `plugins` plural |

Não despejar valores de outras configurações ou credenciais. OPENCODE_CONFIG_DIR, XDG_CONFIG_HOME e OPENCODE_CLI_CONFIG_CONTENT ausentes no ambiente de execução examinado.

Contratos reais: `D:\git\opencode-rich-footer-host-v2\packages\cli\src\config\config.ts` escolhe cli.json; `D:\git\opencode-rich-footer-host-v2\packages\cli\src\config\schema.ts` usa schema https://opencode.ai/v2/cli.json; `D:\git\opencode-rich-footer-host-v2\packages\cli\src\config\migrate.ts` migra TUI/KV somente quando o arquivo novo não existe. A decisão de criação deve preservar as preferências que essa migração transportaria.

## Runtime e integração proposta

Matriz P1 mantida: Bun 1.3.14 / OpenTUI 0.4.5 / Solid 1.9.10 patched (v1); Bun 1.4.2 / OpenTUI 0.5.12 / Solid 1.9.15 patched (v2). Node não integra a matriz operacional aprovada.

Promover por cópia verificada o Bun v2 de `C:\Users\Marquinho\AppData\Local\Temp\rich-footer-bun-1.4.2\package\bin\bun.exe` para `C:\Users\Marquinho\.bun\versions\1.4.2\bun.exe`. SHA256 original `15277C59CCD6C6C20F8DC9716C2B59C1776320D606B6A8658F70BE8799519CA4`. Não substituir Bun global. Integrar commits via fast-forward, preservar o lock npm preexistente, instalar com lock Bun congelado e gerar artefatos no destino. Testar o caminho instalado diretamente antes da configuração pessoal.

Backups e rollback devem ser demonstrados em sandbox antes das alterações pessoais. Remover somente o registro rich-footer do servidor, manter TUI v1 e registrar TUI v2 conforme o contrato nativo. Nova coleta de hashes imediatamente antes de escrever; abortar a escrita se houver drift. Operações de Git, dependências, runtime e configuração são exclusivas do orquestrador.

## Ownership durante o pre-flight

- Orquestrador: WRITE somente nos registros em `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence`.
- HEAVY e coletor operacional: READ compartilhado no snapshot P1, scripts, testes, plano, README e hosts. Não leem os registros sob edição.
- Nenhuma implementação P2 antes do parecer HEAVY. Após aprovação, registrar write-sets disjuntos e só rodar build/typecheck/testes após handoff dos writers.

## Parecer HEAVY e execução autorizada

Pre-flight independente por gpt-6-astra/max: GO. Usar migrateV1 puro e allowlist KV com schemas reais; não criar configuração contendo apenas plugins. Verificados sem emitir valores: preferências thinking_mode, thinking_visibility, diff_wrap_mode, sidebar, scrollbar_visible e animations_enabled; validação de TUI e configuração migrada PASS. State real em `C:\Users\Marquinho\.local\state\opencode\kv.json`, SHA256 `15CBF1DBAB4D3C511585CA252D31E60224A014322C071F5F084E4112E7F4CDC3` no pre-flight. A nova configuração será criada sem sobrescrever arquivo que apareça concorrentemente. Reversão só opera se hashes ainda corresponderem à instalação.

PIDs v1 confirmados sem flags --watch/--hot/--config. Starts: 51084 2026-09-30T19:59:34.940123-03:00; 44400 20:01:07.557567; 55472 20:31:00.344032; 60584 20:44:07.710273. Ambiente interno remoto desses processos não inspecionado. Nenhum reinício autorizado ou necessário.

HEAVY exige smoke direto do destino, nova integração HTTP por cliente real com servidor loopback próprio, compilador ausente/recuperação, configs/migração/rollback/drift, ciclos e simultaneidade. Fixtures Global devem preencher todos os diretórios e subprocessos devem isolar HOME/XDG/OPENCODE antes de imports. Isso será checado na revisão P2; GO não constitui PASS operacional.

Bun durável instalado e executado: 1.4.2, SHA256 idêntico ao original. Bun global permanece 1.3.14. Nenhuma fonte/dependência dos hosts foi alterada em P2.