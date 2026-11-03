# VIGER MONEY 2.0 — Smart Forecast

## New
- Dedicated forecast screen with a date selector and 7 / 30 / 90 / 180-day presets (up to one year).
- Three forecast scenarios: cautious, realistic, and optimistic.
- Up to 90 days of cash-flow history are analyzed locally.
- Stable weekly, biweekly, and monthly transaction patterns can be detected when at least three matching entries have sufficiently consistent intervals and amounts.
- Transfers between the user's own wallets are excluded from income/expense forecasting.
- Forecast confidence is labeled low, medium, or high according to the amount and span of available history.
- Mobile bottom navigation now puts Forecast one tap away and adds a central quick-add button that focuses the quick-entry field.
- Larger mobile touch targets and phone-friendly input sizing.

## Compatibility and data safety
- IndexedDB database name remains `viger-money-db`.
- IndexedDB schema version remains `1`.
- The app state key remains `main-state`.
- Local storage fallback key remains unchanged.
- Service-worker cache was bumped to `viger-money-v2.0.0` so the updated app shell can replace cached v1 files.

## Forecast limitations
- This is a deterministic statistical estimate, not a promise or bank balance guarantee.
- The baseline is weighted toward the last 30 days (65%) and the preceding observed period (35%).
- Recurring patterns are separated from the baseline and projected as future events; scenarios vary their amounts by 15% and widen according to observed weekly cash-flow variation.
- Sparse or irregular history receives a low-confidence label. Unrecorded transactions and future changes in spending or income are not knowable by the app.
