# VIGER MONEY — Personal Finance Web App

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

## Set your starting balance

Open **Кошельки** → edit a wallet → enter its **Начальный баланс**. This amount represents the money you already had before recording transactions; it is not counted as income. Alternatively, create a wallet with its initial balance. Start with a fresh backup after setting up your real accounts.

## Cloud sync (optional)

Cloud sync is not active until you configure your own Supabase project. The app itself does not include or share a hosted backend, and a blank cloud configuration means data stays in this browser.

1. Create a Supabase project and open **SQL Editor**.
2. Execute `supabase-schema.sql` in full. It creates the required tables and row-level security (RLS) rules.
3. In Supabase project API settings, copy the **Project URL** and the client-side **publishable key** (or legacy `anon` key).
4. In VIGER MONEY → Settings → Synchronization, paste the URL and key, enter an email and password, and select **Войти / создать аккаунт**.
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
- `1`–`5`: dashboard, history, wallets, statistics, goals

Shortcuts that could interfere with typing are disabled while a form field is focused.

## Data and privacy notes

- Amounts are stored as integer Uzbek soʻm; decimal amounts are intentionally not used.
- Wallet opening balances are not income/expense events.
- Transfers change the source and destination wallets without inflating the income/expense totals.
- Deleted transactions are soft-deleted locally; they stop affecting balances but remain in the audit/export history.
- A local browser database is not a substitute for a password manager, encrypted backup or bank system.
