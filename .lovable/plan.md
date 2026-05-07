
# Plano: Mercado Estrangeiro, Passes Livres e Clubes Externos

Sem alterar nada existente — apenas novas tabelas, novas abas e nova lógica.

## 1. Banco de dados (migration)

### Novas tabelas

**`foreign_market_players`**
- `name`, `position`, `age`, `nationality`, `overall` (int), `market_value` (numeric), `salary_demand` (numeric), `club_origin`, `league_origin`, `temporada` (int)
- RLS: leitura pública; INSERT/UPDATE/DELETE só admin

**`free_agents`**
- `name`, `position`, `age`, `nationality`, `overall`, `salary_demand`, `last_club`, `temporada`
- RLS igual ao acima
- Migration roda script único: copia `players` com `club_id IS NULL` para `free_agents` (mantém os players originais para não quebrar referências, mas marcamos com flag `attributes->>'migrated_to_free_agents' = true` para evitar duplicação em reruns)

**`external_clubs`**
- `name`, `country`, `league`, `region` (enum: europeu/brasileiro/arabe), `budget_tier` (enum: baixo/medio/alto/elite), `prestige` (int 1–10), `active` (bool default true), `crest`, `created_at`
- RLS: leitura pública; admin gerencia

**`external_proposals`** (propostas dos clubes externos ao usuário)
- `external_club_id`, `player_id`, `valor_ofertado`, `salario_ofertado`, `luvas`, `status` (pendente/aceita/recusada/contraproposta/expirada), `temporada_validade` (int), `parent_id` (para contrapropostas), `created_at`
- RLS: leitura — dono do clube do jogador + admin; UPDATE — dono do clube + admin (para responder); INSERT — apenas via função SECURITY DEFINER

### Novas funções RPC

- `gerar_propostas_externas()` — admin only. Para cada `external_clubs.active`:
  - Seleciona jogadores elegíveis: `overall >= 81` (ou `< 81` somente se `prestige <= 3`) **OU** `a_venda = true`
  - Pula jogadores que já têm proposta pendente desse clube
  - Cria proposta com fórmula simples: `valor = valor_base_calculado × (0.8 + prestige × 0.05) × tier_mult`, `salario = salario_atual × (1.1 + prestige × 0.03)`
  - Respeita fair play estendido: limite de 500% para clubes externos (validação no INSERT, sem alterar trigger existente)
  - Cria notificação na caixa de entrada do dono com nome+escudo do clube externo
- `responder_proposta_externa(_id, _acao, _novo_valor?, _novo_salario?)` — dono pode aceitar/recusar/contra-propor. Contraproposta cria nova linha com `parent_id` e dispara edge function `external-ai-respond` para resposta da IA (Lovable AI Gateway). Aceitar transfere o jogador (similar a `accept_transfer`, sem entrada em caixa do "vendedor externo"... na verdade COM entrada — o usuário recebe o dinheiro).
- `expirar_propostas_externas()` — chamada dentro de `process_season_turnover`: marca todas as `external_proposals` pendentes como `expirada`. Também aumenta contador `attributes->>'propostas_recusadas'` no jogador para uso futuro em renovação.

### Edge function nova: `external-ai-respond`
- Recebe contraproposta do usuário, monta prompt com contexto (jogador, clube externo, valores), chama Lovable AI Gateway (`google/gemini-3-flash-preview`)
- Retorna decisão estruturada (aceita / recusa / contraproposta com novos valores)
- Cria nova linha em `external_proposals` ou atualiza status
- Requer `LOVABLE_API_KEY` (já provisionado pelo AI Gateway)

## 2. Frontend

### `Market.tsx` — duas novas abas (público pode ver)
- **Mercado Estrangeiro**: lista `foreign_market_players` com filtros temporada/posição/nacionalidade. Mostra overall, valor, salário pedido, clube/liga de origem.
- **Passes Livres**: UNION de `free_agents` + leitura ao vivo de `players` ainda sem clube. Filtros básicos.
- Sem ações de compra nessas abas por enquanto (apenas listagem).

### `Admin.tsx` — três novas seções
- `ForeignPlayersManager.tsx`: CRUD + importação JSON (formato novo dedicado: array com `[{name, position, age, nationality, overall, market_value, salary_demand, club_origin, league_origin, temporada}]`). Prévia em tabela antes de confirmar (padrão do `CampanhasManager`).
- `FreeAgentsManager.tsx`: CRUD + importação JSON (mesmo padrão).
- `ExternalClubsManager.tsx`: CRUD + toggle `active` rápido (Switch). Botão "Gerar propostas da janela" que chama `gerar_propostas_externas()`.

### Inbox / Caixa de entrada
- Novo componente `ExternalProposalsInbox.tsx` exibido em `MyClub` (ou em uma nova rota). Lista propostas pendentes recebidas dos clubes externos com escudo+nome do clube. Ações: Aceitar / Recusar / Contra-propor (modal).

### Notificações existentes
- `gerar_propostas_externas` insere registros em `notifications` com `tipo='proposta_externa'` para o owner do clube.

## 3. Detalhes de IA (híbrido)

- **Geração inicial das propostas**: fórmula determinística no SQL (sem custo de IA).
- **Resposta a contrapropostas do usuário**: edge function `external-ai-respond` chama Gemini Flash via AI Gateway. Prompt curto retornando JSON `{action: "accept"|"reject"|"counter", valor?, salario?, mensagem?}`.

## 4. Disparo das propostas

- **Manual**: botão no `ExternalClubsManager`.
- **Automático**: novo bloco no início de `process_season_turnover` (antes do loop atual) chama `expirar_propostas_externas()` e depois `gerar_propostas_externas()` para a nova janela.

## 5. Fair Play estendido

- Trigger atual `validate_fair_play` opera só em `transferencias` — não mexer.
- Para `external_proposals`, criar trigger separado `validate_fair_play_external` com limite de 500% (e mínimo 50%). Mantém regras existentes intactas.

## 6. Riscos / pontos de atenção

- Migração de `players` sem clube para `free_agents` é one-shot e idempotente via flag em `attributes`.
- Aceitar proposta externa transfere o jogador para `club_id = NULL` (some do elenco) e credita o caixa do clube vendedor com `valor + luvas` — registra em `transactions` categoria `transferencia_externa`.
- Contador de "propostas recusadas" salvo em `players.attributes` para futura lógica de renovação (não implementada nesse plano).

## Resumo de entregáveis

- 1 migration (4 tabelas + 3 funções + 1 trigger + script de migração de dados)
- 1 edge function (`external-ai-respond`)
- 2 novas abas em `Market.tsx`
- 3 novos managers em `Admin.tsx`
- 1 componente de inbox
- Atualização de `process_season_turnover` para incluir expiração + geração automática
