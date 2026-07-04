
-- Fix mutable search_path
CREATE OR REPLACE FUNCTION public.init_calendar_remaining_amount()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
begin
  if NEW.remaining_amount is null then
    NEW.remaining_amount := NEW.amount;
  end if;
  return NEW;
end;
$function$;

-- Revoke execute from PUBLIC/anon/authenticated for SECURITY DEFINER functions
-- These are only invoked internally by triggers, so no app role needs EXECUTE.
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.apply_bank_delta(uuid, numeric)',
    'public.sync_transaction_balance()',
    'public.sync_asset_transaction_balance()',
    'public.sync_calendar_balance()',
    'public.recalc_goal_current_amount()',
    'public.handle_new_user()',
    'public.apply_calendar_payment()',
    'public.revert_calendar_payment()',
    'public.cleanup_calendar_event_payments_on_delete()',
    'public.apply_balance_adjustment()',
    'public.revert_balance_adjustment()',
    'public.init_calendar_remaining_amount()',
    'public.set_updated_at()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
  END LOOP;
END $$;
