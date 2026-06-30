
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS direction text,
  ADD COLUMN IF NOT EXISTS custom_type text,
  ADD COLUMN IF NOT EXISTS recurrence text;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS source_event_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tx_event ON public.transactions(source_event_id);
