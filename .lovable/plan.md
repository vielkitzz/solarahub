# Plano de execução

## 1. Bugs de banco de dados

### 1a. Renovação de contrato duplica contratos
- Investigar `renovar_contrato_jogador` no Supabase.
- Ajustar para que, ao renovar, qualquer contrato/registro anterior do jogador no clube seja substituído pelo novo (atualizar in-place em vez de inserir nova linha) — remover duplicações.

### 1b. Passes livres contam como entrada e saída
- Mesmo padrão do bug do mercado estrangeiro.
- Investigar a função RPC usada pelo `FreeAgentsTab` (provavelmente `contratar_jogador_direto` ou função específica de free agents) e remover o registro de `entrada` indevido. Manter apenas a `saida` (custo da contratação).

### 1c. Contratos de empréstimo não executam
- Investigar a função/rotina que processa empréstimos (`loans` table) ao avançar temporada — verificar se o cron/trigger de cobrança das parcelas existe e se está sendo chamado.
- Garantir que cada `installments_paid` é incrementado, gera transação `saida` e marca `status = 'paid'` ao final.

## 2. Layout da wiki do clube

- Em `ClubDetail.tsx` (aba wiki), o infobox hoje fica ao lado e o texto não envolve.
- Trocar layout de grid para `float: right` no infobox (ou usar shape-outside) para que o texto quebre e flua por baixo do infobox quando ultrapassar sua altura, ocupando toda a largura disponível.

## 3. Feature: Histórico de Camisas

### 3a. Banco
- Tabela `club_kits`:
  - `club_id` (uuid)
  - `ano` (int)
  - `tipo` (enum: `titular | alternativo | terceiro | goleiro | especial`)
  - `fabricante` (text)
  - `descricao` (text, opcional)
  - `image_url` (text)
  - `created_at`, `updated_at`
- RLS:
  - SELECT público
  - INSERT/UPDATE/DELETE: dono do clube ou admin
- Bucket de Storage `club-kits` público com policies (upload restrito a autenticados; donos do clube enviam para pasta `<club_id>/`).

### 3b. Página global `/camisas`
- Item no `AppSidebar` em "Conhecimento": "Histórico de Camisas".
- Lista de clubes (cada um como cartão clicável que leva à página do clube → aba camisas).
- Visual estilo Football Kit Archive: fundo neutro, imagens grandes, badges por tipo.

### 3c. Aba "Camisas" no `ClubDetail.tsx`
- Galeria agrupada por ano (mais recente → mais antigo).
- Cada kit: imagem grande, badge colorido por tipo, fabricante, descrição.
- Para o dono: botões de adicionar / editar / remover (dialog com upload de imagem, ano, tipo, fabricante, descrição).

### 3d. Componentes novos
- `src/components/KitsManager.tsx` — gerenciamento (dialog CRUD).
- `src/components/KitsGallery.tsx` — visualização agrupada por ano.
- `src/pages/HistoricoCamisas.tsx` — página global.

## Detalhes técnicos

- Paleta dos badges por tipo:
  - titular → primary
  - alternativo → secondary
  - terceiro → accent
  - goleiro → green
  - especial → gold
- Reaproveitar `ImageUpload` existente para envio.
- React Query para cache (`['club-kits', clubId]`).
- Rotas: adicionar `/camisas` em `App.tsx` (lazy).

## Ordem de execução

1. Migration: tabela `club_kits` + bucket + RLS + correções nas funções RPC dos bugs 1a, 1b, 1c.
2. Frontend: ajuste do layout da wiki.
3. Frontend: componentes de Kits + página global + aba no ClubDetail + item no sidebar.
