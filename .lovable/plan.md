# Plano: Azura Capital — Plataforma de Gestão Patrimonial Sincronizada

Vou transformar a app numa plataforma totalmente sincronizada. O núcleo é uma camada de sincronização automática entre Bancos, Investimentos, Finanças e Calendário, com Dashboard e Histórico apenas como consumidores.

## 1. Camada de sincronização (base de tudo)

**Migração de base de dados**
- `bank_accounts`: manter `current_balance`, mas passar a ser calculado (não editável pelo utilizador na criação).
- `custody_accounts`: adicionar coluna `bank_account_id` (FK a `bank_accounts`).
- `transactions`: garantir `bank_account_id` obrigatório em receita/despesa; adicionar `kind` (`receita | despesa | compra | venda | transferencia | calendario`) para o Histórico.
- `asset_transactions`: garantir `type` (compra/venda), `quantity`, `unit_value`, `total_value`, `bank_account_id` (derivado da conta custódia).
- `calendar_events`: `amount` obrigatório, `bank_account_id` obrigatório quando marcado efetuado.
- Função SQL `apply_bank_delta(bank_id, delta)` + triggers em `transactions`, `asset_transactions` e `calendar_events` (quando `status = efetuado`) para atualizar `current_balance` automaticamente.
- Trigger de venda: bloquear se `quantity > quantidade disponível` do ativo.
- Trigger permite saldo negativo (com aviso no frontend), sem bloquear débito.

## 2. Dashboard → "Património"

- Header: título "Património"; toggle claro/escuro sempre visível no canto superior direito (mover para AppShell topbar).
- Cartões renomeados e calculados dinamicamente:
  - **Quantidade de Ativos** = `count(assets)` com quantidade > 0.
  - **Saldo Bancário** = soma `current_balance`.
  - **Carteira de Investimento** = soma `invested_amount` restante.
  - Remover "Passivos".
- Gráfico Receitas vs Despesas → **Pizza** com 2 fatias e legenda clara (valores + %).
- Metas: mostrar 2 metas prioritárias com nome, barra de progressão, valor atual, valor alvo, data alvo.
- "Carteira por tipo" → **Carteira de Investimento**: % por tipo, legenda com valor investido.

## 3. Investimentos

- Subtítulo: "A sua carteira de investimentos."
- Resumo topo: nº de ativos + valor total investido.
- Filtro por categoria (chips com cores simples).
- Campo **Quantidade opcional** (ativos como depósito a prazo).
- **Compra**: qty × valor unitário = investido; debita banco associado à conta custódia.
- **Venda**: valida qty disponível, credita banco associado, atualiza qty/investido restante, gera registo no histórico.
- Nunca permitir venda > disponível (validação frontend + trigger DB).

## 4. Bancos

- Remover campo "Valor" ao criar conta (saldo começa a 0 e é derivado).
- Card por banco: **Saldo Disponível** (destaque vermelho se negativo).
- Topo: **Saldo Total** somado.
- Filtro por banco.
- Aviso toast quando saldo fica negativo após débito.

## 5. Conta Custódia (novo módulo)

- Nova rota `/app/custodia`.
- CRUD associando cada custódia a um banco.
- Usada em Investimentos: seleciona custódia → sistema deduz o banco automaticamente.

## 6. Objetivos

- Manter "Adicionar novo objetivo".
- Permitir "Nova categoria" inline.
- Remover opção "Personalizado".

## 7. Finanças Pessoais

- Renomear "Saldo" → "Saldo Disponível".
- Filtros **Mensal / Anual**.
- Receita/Despesa **obrigatoriamente** ligadas a um banco (credita/debita).

## 8. Calendário Financeiro

- Renomear "Calendário" → "Calendário Financeiro".
- Campo **Valor obrigatório** + **Banco obrigatório**.
- Remover placeholder "Sem movimentos".
- Ao marcar efetuado: credita/debita banco selecionado + entra no Histórico.

## 9. Histórico Financeiro

- Renomear "Histórico" → "Histórico Financeiro".
- Unificar movimentos: receitas, despesas, compras, vendas, transferências, eventos efetuados — todos com descrição legível.
- Ordenação recente → antigo.
- Filtros **Mensal / Anual**.
- Remover "Saldo do mês"; manter Total Receitas + Total Despesas.

## 10. Sidebar / AppShell

- Adicionar "Conta Custódia".
- Renomear labels: Património, Calendário Financeiro, Histórico Financeiro.
- ThemeToggle no topbar (sempre visível, mobile e desktop).
- Todos os módulos invalidam React Query cache dos outros ao mutar (chaves partilhadas `["bank_accounts"]`, `["assets"]`, `["transactions"]`, `["dashboard"]`).

## Detalhes técnicos

- Nova migração SQL com triggers de sincronização (bancos ↔ transações ↔ investimentos ↔ calendário).
- Sem quebrar dados existentes: backfill de `current_balance` a partir do soma de transações + saldo inicial.
- Todas as queries do Dashboard passam a agregar dos módulos (nunca de coluna própria).
- Validações de venda no frontend + trigger `BEFORE INSERT` como rede de segurança.

## Fora do âmbito desta iteração

- Transferências banco↔banco como fluxo dedicado (fica no Histórico se criado manualmente via SQL).
- Notificações push (só toasts de aviso).

Confirma que posso avançar e começo pela migração + camada de sincronização, depois refatoro os módulos por ordem: Bancos → Custódia → Investimentos → Finanças → Calendário → Histórico → Dashboard.
