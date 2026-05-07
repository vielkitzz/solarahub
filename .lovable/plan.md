# Plano: Limites de elenco, propostas e notificações

## 1. Limites de elenco

### Banco
- Trigger `enforce_squad_limits` em `players` (BEFORE INSERT/UPDATE de `club_id`):
  - Conta jogadores por `club_id` em `players` (elenco principal) — máximo **35**.
  - Conta `academy_players` por `club_id` — máximo **20**.
  - Para elenco principal: conta jogadores cujo `nationality <> 'Solara'` (ou equivalente; usar `attributes->>'is_solara'` se existir, senão por `nationality`) — máximo **10** estrangeiros.
  - Base **não** entra na regra de estrangeiros.
- Erro com mensagem clara em PT-BR para a UI exibir via toast.

### Frontend
- `Admin.tsx` (criação manual / squad generator) e `Market.tsx` / fluxo de aceitar transferência: tratar erro do trigger com toast amigável.
- Em `ClubDetail.tsx` (aba elenco/base): mostrar contador `27/35`, `12/20`, `7/10 estrangeiros`.

## 2. Ordenação padrão da base por posição

- `ClubDetail.tsx` aba "Base": ordenar `academy_players` por ordem canônica de posição (GOL, ZAG, LAT, VOL, MEI, ATA) por padrão. Mantém opção do usuário re-ordenar.

## 3. Propostas: remover, contraproposta infinita, confirmação

### Banco
- Adicionar status `confirmacao_pendente` ao enum `transfer_status` (ou usar coluna nova `aguardando_confirmacao boolean`). Optar por **nova coluna** `requer_confirmacao boolean default false` + status `aceita` mantido — quando vendedor aceita, marca `requer_confirmacao=true`; comprador chama RPC `confirmar_contratacao` que finaliza a transferência (move jogador, debita caixa, etc).
- Refatorar fluxo `accept_transfer`:
  - Atualmente faz tudo no aceite. Dividir em duas etapas:
    1. `aceitar_proposta(_id)` — vendedor: marca `requer_confirmacao=true`, status continua `aceita`, notifica comprador.
    2. `confirmar_contratacao(_id)` — comprador: executa transferência real (mover jogador, transações, fair play check).
    3. `cancelar_contratacao(_id)` — comprador: rejeita após aceite, volta a `recusada`, notifica vendedor.
- Nova RPC `remover_proposta(_id)` — permite criador (comprador OU vendedor que enviou) deletar/cancelar proposta pendente; status vira `cancelada` (novo valor de enum).
- Remover qualquer limite de rodadas de contraproposta (verificar trigger/lógica atual). Contraproposta segue criando linhas com `proposta_pai_id` indefinidamente até alguém aceitar/rejeitar/cancelar.
- Mesmo fluxo aplicado a `external_proposals`: aceitar requer confirmação do dono, mas como a contraparte é IA, podemos manter aceite imediato OU adicionar confirmação. **Decisão**: aplicar confirmação só em `transferencias` (entre clubes humanos). Manter externas como estão.

### Frontend
- `Market.tsx` / componente de propostas: 
  - Botão "Remover proposta" (visível ao criador) chamando `remover_proposta`.
  - Quando `requer_confirmacao=true` e `auth.user` é o comprador: mostrar banner "Aceita pelo vendedor — confirme contratação" com botões Confirmar / Cancelar.
  - Contraproposta sem limite (remover qualquer check de "máximo X rodadas" se houver).

## 4. Caixa de entrada: notificações de temporada

Inserir notificações em pontos-chave (via SQL trigger ou dentro das RPCs):

- **Jogador vendido / contratado**: trigger AFTER UPDATE em `players` quando `club_id` muda (ou no fim do `confirmar_contratacao`):
  - Notifica owner do clube vendedor (`tipo='player_sold'`) e comprador (`tipo='player_signed'`).
- **Empréstimo**: dentro do fluxo de empréstimo (`LoanManager` / RPC se houver) — notifica ambos os clubes (`tipo='player_loaned'`).
- **Multa rescisória paga**: já há `MultaRescisoriaDialog` — adicionar inserção de notificação para clube que recebeu (`tipo='multa_paga'`).
- **Aposentadoria**: dentro de `process_season_turnover`:
  - Para cada jogador com `age >= idade_aposentadoria` (ex: 38) que será aposentado nessa virada → notifica owner (`tipo='player_retired'`).
  - Para jogadores que terão `age+1 == idade_aposentadoria` na próxima temporada → notifica owner com aviso antecipado (`tipo='player_retiring_soon'`).

Cada notificação grava `payload` com `player_id`, nome, valores relevantes; `mensagem` em PT-BR pronta para exibir.

## 5. Arquivos afetados

- 1 migration: trigger limites + colunas/enum proposta + RPCs (`remover_proposta`, `confirmar_contratacao`, `cancelar_contratacao`) + refator `aceitar_proposta` + triggers de notificação + atualização `process_season_turnover`.
- `src/pages/ClubDetail.tsx`: ordenação base + contadores de limite.
- `src/pages/Market.tsx` (ou componentes de propostas): botão remover, banner confirmação, fluxo confirmar/cancelar.
- `src/components/LoanManager.tsx` / `MultaRescisoriaDialog.tsx`: emitir notificações onde faltar (se já não vier do DB).

## 6. Riscos

- Refatoração do aceite quebra qualquer fluxo existente que assuma aceite atômico — precisa migrar transferências em estado `aceita` antigas (deixar como estão; mudança vale para novas).
- Trigger de limite pode bloquear migrations futuras / squad generator — squad generator deve respeitar 35/20/10 ou usar bypass via role admin (admin pula validação).
