## Diagnóstico do que está enchendo o banco

| Origem | Tamanho | Causa |
|---|---|---|
| `clubs.wiki` (4 clubes) | ~7,4 MB | Imagens **base64** coladas direto no editor (3,9 MB + 2,1 MB + 880 KB + 400 KB) |
| `net._http_response` | 19 MB | Logs de respostas do `pg_net` sem retenção |
| `supabase_functions.hooks` | 5.019 linhas | Histórico de entregas de webhooks |
| `notifications` | 2.492 lidas | Notificações antigas nunca apagadas |
| `external_proposals` | 880 finalizadas | Propostas concluídas/recusadas mantidas |
| `transferencias` | 719 finalizadas | Mesmas razões |

O principal vilão é a colagem de imagens base64 no editor da wiki — cada imagem colada vira ~1 MB inflado dentro de `clubs.wiki`.

## O que vou fazer

### 1. Limpeza pontual (libera espaço agora)
- Remover qualquer `<img src="data:image…">` do campo `wiki` de todos os clubes (mantém o texto, derruba a imagem inflada). Os 4 clubes afetados perderão essas imagens — eles podem reenviar via botão de upload (que já joga no Storage corretamente).
- Truncar `net._http_response`.
- Apagar entregas de webhook (`supabase_functions.hooks`) com mais de 7 dias.
- Apagar notificações já lidas com mais de 30 dias.
- Apagar `external_proposals` finalizadas (status ≠ pendente) com mais de 60 dias.
- Apagar `transferencias` finalizadas com mais de 180 dias.
- `VACUUM FULL` nas tabelas tratadas para devolver o espaço físico ao Postgres.

### 2. Prevenção no editor (frontend)
- No `RichEditor`, interceptar **paste** e **drop** de imagens: em vez de aceitar base64, fazer upload automático para o bucket `crests/wiki/` e inserir só a URL. Hoje só o botão "Enviar imagem" faz isso direito.
- Bloquear também colagem de HTML que já contenha `data:image` (substitui ou remove antes de inserir).

### 3. Prevenção no banco (defesa em profundidade)
- Trigger em `clubs` que rejeita `INSERT/UPDATE` de `wiki` contendo `data:image` (mensagem clara para o usuário).
- Habilitar `pg_cron` e agendar uma rotina semanal que repete a limpeza do item 1 (notificações lidas, hooks, http_response, propostas/transferências finalizadas antigas).

### Detalhes técnicos

- Limpeza do wiki via SQL com regex: `regexp_replace(wiki::text, '<img[^>]*src="data:image[^"]*"[^>]*>', '', 'g')`.
- `truncate net._http_response` + reset de sequência.
- Migração cria a extensão `pg_cron` e agenda 1 job único `maintenance_weekly` rodando aos domingos 03:00.
- Trigger usa `position('data:image' in NEW.wiki::text) > 0` para vetar.
- No `RichEditor`, adicionar `editorProps.handlePaste` e `handleDrop` que detectam `File` ou string base64, sobem via `supabase.storage.from('crests').upload('wiki/…')` e inserem o nó `resizableImage` com a URL pública.

### O que NÃO vou mexer
- Estrutura de tabelas de domínio (clubes, jogadores, contratos) permanece igual.
- Lógica de negócio (temporadas, finanças, treinos) intocada.
- Imagens já hospedadas no Storage continuam onde estão.
