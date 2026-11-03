# V Money 2.1.1 — Personal Finance Web App

A responsive, local-first personal money ledger for desktop and mobile. The app is plain HTML/CSS/JavaScript and has no build step or runtime framework dependency.

## Included

- Instant entries (`+50000`, `-10000 школа`) and basic Russian natural-language parsing (`потратил 10к на дорогу`, `получил 50 тысяч`).
- Optional voice entry in browsers that support the Web Speech API.
- Income, expenses, transfers between wallets, timestamps, categories and descriptions.
- Local persistence in IndexedDB with a localStorage fallback.
- Balance calculation from opening wallet balances and the transaction journal.
- Multiple wallets, editable opening balances and wallet archive/restore.
- Search, filters, edit, soft-delete, audit records and `Ctrl+Z` undo for transaction changes.
- Dashboard, current-month metrics, category summaries, cash-flow visualization and savings goals.
- Money Forecast Engine: 7/30/90/180-day forecasts, cautious/realistic/optimistic scenarios, recent cash-flow analysis, and conservative recurring-pattern detection.
- Mobile-first bottom navigation with a central quick-add action; forecast is directly accessible on phones.
- JSON backup/restore, CSV export, dark/light/system theme and keyboard shortcuts.
- PWA manifest and service worker for installation/offline app shell on a suitable origin.
- Optional Supabase Auth/REST sync, with the SQL schema and row-level security policies included.

## Run locally

The easiest test route is to use a local HTTP server. In this folder run:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000> in your browser. `localhost` is treated as a secure context for PWA service workers. When hosted publicly, deploy the entire folder to a static host with HTTPS (for example, a static site on Vercel, Netlify, or GitHub Pages).

The app can often render when opening `index.html` directly, but service workers/PWA install behavior require HTTP(S); local file behavior for browser storage differs by browser. For proper testing use the local server.

Forecast regression tests (Node.js): `node tests/forecast-model.test.cjs`.

## Set your starting balance

Open **Кошельки** → edit a wallet → enter its **Начальный баланс**. This amount represents the money you already had before recording transactions; it is not counted as income. Alternatively, create a wallet with its initial balance. Start with a fresh backup after setting up your real accounts.

## Cloud sync (optional)

Cloud sync is not active until you configure your own Supabase project. The app itself does not include or share a hosted backend, and a blank cloud configuration means data stays in this browser.

1. Create a Supabase project and open **SQL Editor**.
2. Execute `supabase-schema.sql` in full. It creates the required tables and row-level security (RLS) rules.
3. In Supabase project API settings, copy the **Project URL** and the client-side **publishable key** (or legacy `anon` key).
4. In V Money → Settings → Synchronization, paste the URL and key, enter an email and password, and select **Войти / создать аккаунт**.
5. If Supabase email confirmation is enabled, confirm the account from the email before signing in. The app uses password auth and the authenticated user's session; it does not require a service key.
6. Use **Синхронизировать** to manually start a sync. Signed-in sessions are also synced after local edits when online.

**Never paste a Supabase `service_role` key into this app.** It bypasses Row Level Security and must remain private on a server. The SQL schema applies per-user RLS policies, but no cloud configuration has been tested against your own project until you connect it. Keep JSON backups before syncing between devices.

### Sync behavior / known boundaries

- Local data remains on the device and is written before cloud sync starts.
- Local records and cloud records are merged by record ID and `updated_at` timestamps; the more recently updated version wins. For concurrent edits on two devices, this is a last-write-wins strategy, not a conflict-resolution UI.
- The first sync can merge the three starter wallets by their names/types to avoid duplicate default wallets. Review wallet names before connecting two pre-existing datasets.
- Sync requires connectivity and a Supabase schema compatible with `supabase-schema.sql`. Offline changes remain local until a later sync succeeds.
- Backups are still important: browser storage can be cleared, and a backup is not an encrypted vault. Don't use a shared/untrusted browser for private financial records.

## Keyboard shortcuts

- `N`: new transaction
- `/`: open history search
- `+` / `-`: focus quick entry with income/expense selected
- `Enter`: submit the quick-entry form or modal form
- `Esc`: close modal/menu
- `Ctrl+Z` / `Cmd+Z`: undo the latest transaction create/edit/delete
- `Ctrl+E` / `Cmd+E`: export transaction CSV
- `1`–`6`: dashboard, history, wallets, statistics, goals, forecast
- `F`: open forecast

Shortcuts that could interfere with typing are disabled while a form field is focused.

## Data and privacy notes

- Amounts are stored as integer Uzbek soʻm; decimal amounts are intentionally not used.
- Wallet opening balances are not income/expense events.
- Transfers change the source and destination wallets without inflating the income/expense totals.
- Deleted transactions are soft-deleted locally; they stop affecting balances but remain in the audit/export history.
- A local browser database is not a substitute for a password manager, encrypted backup or bank system.


## Money Forecast Engine

Open **Прогноз** and choose a target date or a 7/30/90/180-day preset (the date picker allows up to one year). The forecast uses recent completed calendar days, excludes transfers and wallet opening balances, and keeps one-time transactions in the actual balance while excluding them from the trend. Recognized recurring patterns and manually planned future events are projected separately.

The calculation runs locally in the browser; transaction history is not sent to an AI service. Forecasts are estimates, not guarantees. Unrecorded purchases, irregular income and changes in habits affect the result. Keep recording transactions and retain backups.

### Updating an existing install

1. Export a JSON backup from the old version before replacing files.
2. Extract this release and deploy the full folder to the **same website address/origin** as the previous version. Do not switch from `www` to non-`www`, or to a different hosting URL, unless you have exported and restored the backup.
3. Reload the page. The database name and IndexedDB schema version are unchanged, so existing local records remain in place. The service worker cache version is bumped to load the new UI.
4. On a phone, close and reopen the installed PWA or reload the site after it has updated.

Do not clear site data or browser storage during the update. The app does not have access to a user's live phone database from this ZIP; it updates the application code while preserving the existing same-origin storage.


## Forecast 2.1.1

The core forecast baseline is the **last seven completed calendar days**. It no longer divides the lifetime net balance by the number of days since the first transaction. The current partial day is excluded. If the app has 3–6 available completed days, their average daily flow is normalized to a week. With fewer than three days, the short observed net amount is not multiplied by 7 / observed-days; confidence stays low, and a very short sample is not presented as a reliable daily income rate.

Transactions have a forecast setting: **Обычная** (included in the recent cash-flow trend) or **Разовая** (still included in the real balance and history, but excluded from trend and recurring-pattern detection). Existing transactions without this field remain **Обычными** by default. Transfers and opening wallet balances are not income or expense.

Recognized recurring operations are separated from the recent baseline and projected on their expected dates, preventing their historical occurrences from being counted twice. Scenario sensitivity is bounded: cautious uses income −15% and expenses +15%; optimistic uses income +15% and expenses −15%. With very little history, confidence stays low and the forecast avoids inventing a daily income.

Known future income or expenses can be added under **Прогноз → Планируемые поступления и расходы**. These planned events affect forecast values only; they do not change the actual wallet balance or transaction history.

### Updating an existing install

1. Export a JSON backup from the old version first.
2. Deploy the full release folder to the **same HTTPS origin/domain** as before. Do not change between `www` and non-`www` or move to a different hosting URL unless you export and restore the backup.
3. Keep the existing browser data. The IndexedDB database remains `viger-money-db`, schema version `1`, key `main-state`; these legacy storage identifiers are intentionally preserved to protect existing V Money data.
4. The service-worker cache is bumped to `v-money-v2.1.1`. Reload the site; on the phone, close and reopen the installed PWA if the new shell does not appear.

Do not clear site data or delete IndexedDB during the update. The ZIP changes the application files; it does not directly replace your published website.

### Supabase schema update

If cloud sync is configured, run the updated `supabase-schema.sql` once in the project's SQL Editor. It adds the `forecast_mode` column to transactions and creates the `planned_events` table with per-user RLS policies. Local-only installations do not need this step.
