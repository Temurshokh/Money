# V Money 2.1.1 — Forecast correction patch

## Forecast changes
- Fixed the inflated projection that treated lifetime net cash flow as a daily earning rate.
- Forecast baseline now uses the last seven completed calendar days; today's incomplete activity is excluded.
- For a shorter 3–6 day history, the observed average daily flow is normalized to a week. With fewer than three completed days, the app avoids multiplying the tiny sample into a fictitious weekly rate.
- A large older deposit no longer creates an artificial daily income in the future.
- Income/expense transactions can be marked as **Разовая**. They remain in actual balance and history but are excluded from trend and recurring detection.
- Recognized recurring events and user-planned future income/expenses are projected separately. Planned events never alter the actual wallet balance.
- Cautious and optimistic scenarios use bounded ±15% income/expense sensitivity rather than unstable standard deviation from a tiny sample.
- Forecast explanation now identifies the basis and available history.

## Compatibility
- Existing IndexedDB database remains `viger-money-db`, schema version `1`, key `main-state`; this legacy identifier is intentionally retained to preserve existing records.
- Legacy localStorage fallback key remains unchanged. Existing transactions without `forecastMode` remain normal operations.
- Existing Supabase projects must run the updated `supabase-schema.sql` once to add `forecast_mode` and `planned_events`.
- Service-worker cache bumped to `v-money-v2.1.1`.
