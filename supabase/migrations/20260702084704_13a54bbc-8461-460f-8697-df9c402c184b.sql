
-- 1. Custody accounts linked to bank
ALTER TABLE public.custody_accounts
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

-- 2. Asset transactions get unit_value and bank
ALTER TABLE public.asset_transactions
  ADD COLUMN IF NOT EXISTS unit_value NUMERIC,
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

-- 3. Calendar events get bank
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

-- 4. Helper: apply delta to bank balance
CREATE OR REPLACE FUNCTION public.apply_bank_delta(_bank_id UUID, _delta NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _bank_id IS NULL OR _delta = 0 THEN RETURN; END IF;
  UPDATE public.bank_accounts
    SET current_balance = COALESCE(current_balance, 0) + _delta,
        updated_at = now()
    WHERE id = _bank_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.apply_bank_delta(UUID, NUMERIC) FROM PUBLIC, anon, authenticated;

-- 5. Trigger for transactions (receita/despesa)
CREATE OR REPLACE FUNCTION public.sync_transaction_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_delta NUMERIC := 0;
  new_delta NUMERIC := 0;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.bank_account_id IS NOT NULL THEN
    old_delta := CASE WHEN OLD.type = 'receita' THEN OLD.amount ELSE -OLD.amount END;
    PERFORM public.apply_bank_delta(OLD.bank_account_id, -old_delta);
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.bank_account_id IS NOT NULL THEN
    new_delta := CASE WHEN NEW.type = 'receita' THEN NEW.amount ELSE -NEW.amount END;
    PERFORM public.apply_bank_delta(NEW.bank_account_id, new_delta);
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

REVOKE EXECUTE ON FUNCTION public.sync_transaction_balance() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_transaction_balance ON public.transactions;
CREATE TRIGGER trg_sync_transaction_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_transaction_balance();

-- 6. Trigger for asset_transactions (compra/venda)
CREATE OR REPLACE FUNCTION public.sync_asset_transaction_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_delta NUMERIC := 0;
  new_delta NUMERIC := 0;
  avail NUMERIC;
BEGIN
  -- Validate sale doesn't exceed available quantity (only on INSERT)
  IF TG_OP = 'INSERT' AND NEW.type = 'venda' AND NEW.quantity IS NOT NULL THEN
    SELECT COALESCE(quantity, 0) INTO avail FROM public.assets WHERE id = NEW.asset_id;
    IF avail < NEW.quantity THEN
      RAISE EXCEPTION 'Quantidade a vender (%) superior à disponível (%)', NEW.quantity, avail;
    END IF;
  END IF;

  IF TG_OP IN ('UPDATE','DELETE') AND OLD.bank_account_id IS NOT NULL THEN
    -- compra debitou (-), venda creditou (+); reverter
    old_delta := CASE WHEN OLD.type = 'compra' THEN -OLD.amount ELSE OLD.amount END;
    PERFORM public.apply_bank_delta(OLD.bank_account_id, -old_delta);
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.bank_account_id IS NOT NULL THEN
    new_delta := CASE WHEN NEW.type = 'compra' THEN -NEW.amount ELSE NEW.amount END;
    PERFORM public.apply_bank_delta(NEW.bank_account_id, new_delta);
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

REVOKE EXECUTE ON FUNCTION public.sync_asset_transaction_balance() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_asset_transaction_balance ON public.asset_transactions;
CREATE TRIGGER trg_sync_asset_transaction_balance
AFTER INSERT OR UPDATE OR DELETE ON public.asset_transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_asset_transaction_balance();

-- 7. Trigger for calendar_events (only when efetuado)
CREATE OR REPLACE FUNCTION public.sync_calendar_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_delta NUMERIC := 0;
  new_delta NUMERIC := 0;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE')
     AND OLD.status = 'efetuado'
     AND OLD.bank_account_id IS NOT NULL
     AND OLD.amount IS NOT NULL THEN
    old_delta := CASE WHEN OLD.direction = 'receita' THEN OLD.amount ELSE -OLD.amount END;
    PERFORM public.apply_bank_delta(OLD.bank_account_id, -old_delta);
  END IF;
  IF TG_OP IN ('INSERT','UPDATE')
     AND NEW.status = 'efetuado'
     AND NEW.bank_account_id IS NOT NULL
     AND NEW.amount IS NOT NULL THEN
    new_delta := CASE WHEN NEW.direction = 'receita' THEN NEW.amount ELSE -NEW.amount END;
    PERFORM public.apply_bank_delta(NEW.bank_account_id, new_delta);
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

REVOKE EXECUTE ON FUNCTION public.sync_calendar_balance() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_calendar_balance ON public.calendar_events;
CREATE TRIGGER trg_sync_calendar_balance
AFTER INSERT OR UPDATE OR DELETE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.sync_calendar_balance();
