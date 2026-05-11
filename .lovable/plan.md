## 1. Custos operacionais + manutenção do estádio

**`settings.economia_params`** ganha 2 chaves:
- `custos_operacionais_pct` (default `0.25`) — % aplicado sobre `(receita_base + bilheteria + patrocínios)`.
- `manutencao_estadio_por_nivel` (default `200000`) — multiplicado por `nivel_estadio × (stadium_capacity / 10000)`.

**Funções `preview_season_turnover` e `process_season_turnover`** (migration):
- `manutencao_estadio = nivel_estadio * manut_est_por_nivel * (stadium_capacity / 10000)`
- `custos_operacionais = (rb + bilheteria + contratos) * pct`
- `delta = rb + bilheteria + contratos + premiacao − manutencao_base − manutencao_estadio − custos_operacionais − folha`
- Adicionar 2 INSERTS em `transactions` (`saida` / `manutencao_estadio` e `saida` / `operacional`).

**UI:**
- `EconomyParams.tsx`: 2 novos inputs.
- `SeasonPreview.tsx`: 2 novas colunas (Manut. estádio, Operacional).
- `ClubDetail.tsx` (aba Finanças → Despesas anuais): adicionar linhas "Manutenção do estádio" e "Custos operacionais" (calculados client-side com mesma fórmula).

## 2. Insatisfação por excesso de propostas recusadas

Trigger AFTER UPDATE em `transferencias` quando `status` muda para `recusada`:
- Conta total de propostas `recusada` para `(jogador_id)` cujo comprador era um clube real (ou estrangeiro). Usar o jogador como chave.
- Quando atinge 5, dispara 1 vez:
  - notificação ao dono do clube atual (`tipo='player_unhappy'`) avisando que o jogador quer ser vendido OU não vai renovar (sorteio 50/50).
  - marca `players.attributes.unhappy = true` e `players.a_venda = true` (se "quer sair") OU `interesse_renovacao=false` (se "não renova").
- Para evitar disparo repetido: gravar `attributes.unhappy_triggered_at` e só avaliar se ainda não foi disparado nesta temporada.

## 3. Janela de transferências + transferban

**Settings:** chave `transfer_window` = `{ open: true }` (admin global).
**Coluna nova:** `clubs.transfer_ban boolean default false`.

**Trigger BEFORE INSERT em `transferencias`:** se `transfer_window.open=false` → erro; se comprador OU vendedor está com `transfer_ban=true` → erro. Mesmo trigger em `external_proposals` (apenas o lado do clube real é o vendedor).

**Admin UI (`Admin.tsx`):**
- Card "Janela de transferências" com toggle global.
- Na tabela de clubes (existente), nova coluna "Transfers" (count) e botão "Transferban" por linha.

## 4. Contadores de transferências

**View/RPC:** `get_transfer_stats(_club_id)` retornando `{ total_compras, total_vendas, total_estrangeiros }` baseado em `transactions` (categoria `transferencia` / `transferencia_externa`).

**UI:**
- `ClubDetail.tsx` (aba Finanças, topo do bloco "Transferências e investimentos"): 3 mini-cards com contadores.
- `Market.tsx` (header próximo aos badges de inbox): 3 mini-badges.

## 5. Fix: confusão venda × compra nas Finanças

Bug: o componente `ClubDetail` de fato lista corretamente apenas as transações daquele clube (filtra por `club_id`), mas a coluna "Categoria" mostra "Transferência" para os 2 lados igualmente. Correção:
- Renderizar como **"Compra"** quando `tipo='saida'` e `categoria='transferencia'`, **"Venda"** quando `tipo='entrada'` e `categoria='transferencia'`, e **"Venda (estrangeiro)"** quando `categoria='transferencia_externa'`.
- Garantir que duplicidade não vem do banco: revisar `confirmar_contratacao` — só insere entrada para `clube_vendedor_id` se `IS NOT NULL`. (Já está OK.) Adicionar `UNIQUE` lógico não é necessário.

## Arquivos tocados

- **migration SQL**: alter `clubs`, atualiza `economia_params`, recria `preview_season_turnover` + `process_season_turnover`, cria trigger `tg_check_transfer_window`, trigger `tg_player_unhappy_after_reject`, função `get_transfer_stats`, seta `transfer_window`.
- `src/components/admin/EconomyParams.tsx` (novos campos)
- `src/components/admin/SeasonPreview.tsx` (novas colunas)
- `src/components/admin/TransferWindowCard.tsx` (NOVO)
- `src/pages/Admin.tsx` (lista de clubes: count + transferban + monta TransferWindowCard)
- `src/pages/ClubDetail.tsx` (despesas + contadores + label compra/venda)
- `src/pages/Market.tsx` (badges contadores)
- `src/services/transfers.ts` (helpers `getTransferStats`, `setTransferWindow`, `setClubTransferBan`)
- `src/types/index.ts` (tipos derivados regerados após migration)
