# Instalação pessoal — P2

Código aprovado para aplicação pelo HEAVY: `943a3347b2c623d597fae531a1d24a52d13c6990`, presente em `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer` e `D:\git\opencode-rich-footer`. Integração local por fast-forward; nenhum reset, push, PR, publicação ou patch de host.

## Fork e runtime

Instalação congelada e build foram executados em `D:\git\opencode-rich-footer` pelo Bun 1.3.14. Bun 1.4.2 em `C:\Users\Marquinho\.bun\versions\1.4.2\bun.exe`, SHA256 `15277C59CCD6C6C20F8DC9716C2B59C1776320D606B6A8658F70BE8799519CA4`. O executável global `C:\Users\Marquinho\.bun\bin\bun.exe` não foi substituído.

O manifesto `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\installation-manifest-p2.json` registra 40 fontes/documentos relevantes e 9 artefatos compilados, todos byte a byte iguais entre origem e destino. Inclui scripts, testes, package/lock e README; recibos de evidência ficam fora do conjunto para evitar autorreferência. O HEAVY recalculou os 49 pares independentemente e confirmou igualdade. README foi normalizado para LF conforme o blob Git, sem mudança de conteúdo.

Smoke real do destino: `bun run smoke --target 'D:\git\opencode-rich-footer' --concurrent`. Os dois hosts carregaram `D:\git\opencode-rich-footer\tui.js`; 2 testes por geração passaram, 611 assertions v1 e1081 v2. O grafo compilado com manifesto tem SHA256 `b044b671009c3fe0ba4b3d1daff9ad3a1e3fea3f16a9bc8d0cd2a19744f03c40`. Fonte do log: `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\p2-smoke-destination.txt`.

## Configuração real aplicada

Após o HEAVY fechar os seis findings, todos os hashes protegidos foram revalidados, e a configuração v2 ainda estava ausente. Comando executado em `D:\git\opencode-rich-footer`:

```powershell
bun run configure:local --config-dir 'C:\Users\Marquinho\.config\opencode' --state-dir 'C:\Users\Marquinho\.local\state\opencode' --plugin 'D:\git\opencode-rich-footer' --backup-dir 'C:\Users\Marquinho\.config\opencode\rich-footer-backup-20261001T002712Z' --apply
```

Retorno: `changed: 2`. Manifesto privado: `C:\Users\Marquinho\.config\opencode\rich-footer-backup-20261001T002712Z\manifest.json`. Original do servidor: `C:\Users\Marquinho\.config\opencode\rich-footer-backup-20261001T002712Z\0.before`. A ausência original do arquivo v2 está registrada; não há backup fictício dele. O backup contém configuração privada e fica fora do Git.

Segunda aplicação retornou `changed: 0`; nenhum novo diretório de backup foi criado. A reversão foi exercitada em sandbox, incluindo falhas e retomada; não desfiz a instalação pessoal apenas para testar.

| Arquivo absoluto | Resultado e SHA256 |
| --- | --- |
| `C:\Users\Marquinho\.config\opencode\opencode.json` | Removida somente a declaração local rich-footer. Antes `67ADCD7539BA19762A172DF13FC3B30D58E54CFDB38291C3618258D1EB260EAE`; depois `0FF7EAF87DA795E4FB0D837E512CD19F3B4850EA23DB640B657E29FA1DB2DF57` |
| `C:\Users\Marquinho\.config\opencode\tui.json` | Preservado byte a byte, registro v1 mantido: `41953C11E6D4EFCCE842BE2756B8C22032FDE292ABB0FC54F2C81EF242BCD2FE` |
| `C:\Users\Marquinho\.local\state\opencode\kv.json` | Preservado byte a byte: `15CBF1DBAB4D3C511585CA252D31E60224A014322C071F5F084E4112E7F4CDC3` |
| `C:\Users\Marquinho\.config\opencode\cli.json` | Criado com schema v2, uma declaração habilitada e preferências migradas; `5927E0198E34C8F5530DB2285B46C3B224DE102D90467816AEA647959D0264E4` |

Validação sanitizada independente: igualdade estrutural do servidor com o original removendo exatamente uma string de plugin; bytes fora da matriz de plugins idênticos; demais plugins/opções preservados. Configuração cliente igual ao resultado do migrateV1 real, validada com Schema.Info; preferências das seções diffs/session/animations preservadas. Nenhum valor de credencial/preferência privada foi emitido. Recibo sanitizado em `C:\Users\Marquinho\.codex\worktrees\6f86\opencode-rich-footer\docs\plans\evidence\configuration-p2.json`.

## Preservação e limites

- `D:\git\opencode-rich-footer\package-lock.json`, preexistente untracked, conserva SHA256 `82084C5F47AFC36B6485D8126FF3DBBA7CAEC46DA5D64D681A1E13E62096677F`.
- `D:\git\opencode\.opencode\router-lessons.md`, preexistente untracked, conserva SHA256 `ECA62510B934FB68C4DFCA8F4632EF8902E003D3444CFD70D34E8FBD6549FC4E`.
- Hosts permanecem nos SHAs `1d883fccc393e9b9d3a41cb6cc11caf892a96db4` e `74dbc509d74df46a2523676dd4068225c4f0c9b0`. Não alterei fontes, dependências ou branch dos hosts em P2.
- PIDs51084/44400/55472 observados com mesmos horários de início; PID60584 não observado na coleta posterior, sem comando de encerramento/reinício desta execução. Não alegar que sessões pessoais existentes executam o build novo.
- Testes usaram sandboxes e servidor HTTP local próprio. Nenhuma conversa pessoal foi aberta, alterada ou usada para validação. Node operacional não integra a matriz Bun aprovada.

P2.T3 deve ser repetida após os commits de evidências: integrar no destino, reconstruir e confirmar smoke/hash. Recibos posteriores não mudam o código revisado; registrar os novos HEADs e manter o vínculo ao snapshot de implementação acima.
