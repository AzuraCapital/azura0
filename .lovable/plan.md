## 1. Corrigir falha visual (divisão a meio da página)

Causa: o modal usa `items-start sm:items-center` + `min-h-screen`/contentor com `overflow-y-auto` no overlay, criando uma "barra" visível entre o `max-h-[calc(100vh-2rem)]` do modal e o fundo. Vou simplificar para um overlay `fixed inset-0` realmente full-screen com o modal centrado e scroll interno, removendo qualquer ilusão de divisão.

## 2. Calendário: novos tipos + tipos personalizados + status pago

- Acrescentar tipos pré-definidos: `renda_casa`, `propina_escolar`, `seguro`, `energia_agua`, `internet`, `divida_a_pagar`, `divida_a_receber` (além dos já existentes).
- Permitir **tipo personalizado**: campo livre quando escolhe "Outro / Personalizado".
- Adicionar coluna `status` ('pendente' | 'efetuado') + `amount` (Kz, opcional) + `direction` ('despesa' | 'receita' | 'neutro') em `calendar_events`.
- Toggle "Marcar como efetuado / não efetuado" em cada evento.
- Ao marcar como efetuado um evento com `amount` e `direction`, inserir uma `transactions` (income/expense) com referência ao evento (`source_event_id`), evitando duplicação.

## 3. Bancos: adicionar banco personalizado

A lista pré-definida ganha opção "Outro…" que abre input livre para o nome do banco.

## 4. Investimentos: adicionar categoria/ativo personalizado

Permitir criar nova `asset_categories` e nova `custody_accounts` direto do modal (botão "+ Novo" ao lado do select).

## 5. Finanças Pessoais: categorias personalizadas

Permitir criar nova `income_categories` / `expense_categories` direto do modal (botão "+ Nova").

## 6. Remover Património

- Apagar `src/routes/_authenticated/app.patrimonio.tsx` e link no `AppShell`.
- Manter a tabela `liabilities` na base (não dropar agora — dados ficam preservados). Acessos passam pelo Calendário.

## 7. Histórico unificado

Nova rota `app.historico.tsx` no menu lateral:
- Lista cronológica unificada de `transactions` + eventos efetuados (com origem visível).
- Filtros: tipo (receita/despesa), período (mês/ano), categoria.
- Totais do período.

## Alterações na base de dados (1 migração)

```sql
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS direction text,
  ADD COLUMN IF NOT EXISTS custom_type text,
  ADD COLUMN IF NOT EXISTS recurrence text;  -- 'mensal' | null

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS source_event_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tx_event ON public.transactions(source_event_id);
```

RLS e GRANTs já existentes cobrem as novas colunas.

## Ficheiros tocados

- `src/components/ui-kit.tsx` — Modal sem divisão visual.
- `src/components/AppShell.tsx` — remover "Património", adicionar "Histórico".
- `src/routes/_authenticated/app.calendario.tsx` — novos tipos, custom, status, amount, integração transactions.
- `src/routes/_authenticated/app.bancos.tsx` — banco custom.
- `src/routes/_authenticated/app.investimentos.tsx` — categoria/custódia custom.
- `src/routes/_authenticated/app.financas.tsx` — categoria custom.
- `src/routes/_authenticated/app.historico.tsx` — novo.
- `src/routes/_authenticated/app.patrimonio.tsx` — remover.
- Migração SQL acima.

Confirma para eu avançar?