(() => {
  'use strict';

  const DB_NAME = 'viger-money-db';
  const DB_VERSION = 1;
  const STATE_KEY = 'main-state';
  const CLOUD_SESSION_KEY = 'viger-money-cloud-session';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const nowISO = () => new Date().toISOString();
  const localDateTimeValue = date => {
    const d = date ? new Date(date) : new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const money = amount => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(Number(amount) || 0))} сум`;
  const signedMoney = (type, amount) => `${type === 'income' ? '+' : type === 'expense' ? '−' : '⇄ '}${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(Number(amount) || 0))} сум`;
  const shortMoney = amount => {
    const n = Math.round(Number(amount) || 0);
    if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млрд`;
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн`;
    if (Math.abs(n) >= 100_000) return `${Math.round(n / 1000)} тыс.`;
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n);
  };
  const dateLabel = value => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'Без даты';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const d0 = new Date(d); d0.setHours(0, 0, 0, 0);
    if (+d0 === +today) return 'Сегодня';
    if (+d0 === +yesterday) return 'Вчера';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
  };
  const timeLabel = value => new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const monthKey = value => { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const monthTitle = value => new Date(`${value}-01T12:00:00`).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const categoryMeta = {
    'Еда': { icon: '☕', color: '#e7c28d' }, 'Транспорт': { icon: '↗', color: '#95c7ef' }, 'Школа': { icon: '▤', color: '#c8b0ef' },
    'Покупки': { icon: '⌑', color: '#edb39a' }, 'Здоровье': { icon: '✚', color: '#f2a1a1' }, 'Развлечения': { icon: '♫', color: '#d0a7e8' },
    'Техника': { icon: '⌘', color: '#83c8dd' }, 'Подарки': { icon: '◇', color: '#e9a7c4' }, 'Доход': { icon: '↙', color: '#83e0a5' },
    'Карманные деньги': { icon: '◉', color: '#83e0a5' }, 'Прочее': { icon: '•', color: '#a5b1a7' }, 'Перевод': { icon: '⇄', color: '#95c7ef' }
  };
  const walletMeta = {
    cash: { icon: '◉', accent: '#83e0a5', type: 'Наличные' }, card: { icon: '▰', accent: '#95c7ef', type: 'Банковская карта' }, savings: { icon: '▣', accent: '#d0a7e8', type: 'Накопления' }, other: { icon: '▤', accent: '#e7c28d', type: 'Другое' }
  };
  const defaultState = () => {
    const stamp = nowISO();
    return {
      version: 1,
      settings: { theme: 'dark', currency: 'UZS', cloudUrl: '', cloudKey: '', cloudEmail: '' },
      wallets: [
        { id: uid(), name: 'Наличные', kind: 'cash', icon: '◉', accent: '#83e0a5', initialBalance: 0, createdAt: stamp, updatedAt: stamp, archivedAt: null },
        { id: uid(), name: 'Карта', kind: 'card', icon: '▰', accent: '#95c7ef', initialBalance: 0, createdAt: stamp, updatedAt: stamp, archivedAt: null },
        { id: uid(), name: 'Накопления', kind: 'savings', icon: '▣', accent: '#d0a7e8', initialBalance: 0, createdAt: stamp, updatedAt: stamp, archivedAt: null }
      ],
      transactions: [], goals: [], audit: [], undoStack: [], createdAt: stamp, updatedAt: stamp
    };
  };

  let dbPromise = null;
  let dbFailed = false;
  let memoryFallback = null;
  function openDB() {
    if (dbFailed || !('indexedDB' in window)) return Promise.reject(new Error('IndexedDB недоступен'));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv'); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Не удалось открыть базу'));
      request.onblocked = () => reject(new Error('База данных заблокирована другой вкладкой'));
    }).catch(err => { dbFailed = true; dbPromise = null; throw err; });
    return dbPromise;
  }
  async function storageGet() {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readonly'); const req = tx.objectStore('kv').get(STATE_KEY);
        req.onsuccess = () => resolve(req.result || null); req.onerror = () => reject(req.error);
      });
    } catch (e) {
      try { const text = localStorage.getItem(`viger-money:${STATE_KEY}`); return text ? JSON.parse(text) : clone(memoryFallback); } catch { return clone(memoryFallback); }
    }
  }
  async function storageSet(value) {
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(value, STATE_KEY);
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Сохранение отменено'));
      });
      try { localStorage.setItem(`viger-money:${STATE_KEY}`, JSON.stringify(value)); } catch {}
      return 'indexeddb';
    } catch (e) {
      try { localStorage.setItem(`viger-money:${STATE_KEY}`, JSON.stringify(value)); return 'localstorage'; }
      catch { memoryFallback = clone(value); return 'memory'; }
    }
  }

  let state = null;
  let currentPage = 'dashboard';
  let pendingQuickType = null;
  let selectedWalletAccent = '#83e0a5';
  let modalReturnFocus = null;
  let cloudSyncTimer = null;
  let saveProvider = 'indexeddb';
  let cloudBusy = false;
  let session = null;

  const activeTransactions = () => state.transactions.filter(tx => !tx.deletedAt);
  const activeWallets = () => state.wallets.filter(wallet => !wallet.archivedAt);
  const findWallet = id => state.wallets.find(wallet => wallet.id === id);
  const walletName = id => findWallet(id)?.name || 'Удалённый кошелёк';
  const txTitle = tx => tx.description?.trim() || (tx.type === 'income' ? 'Поступление' : tx.type === 'expense' ? 'Расход' : 'Перевод');
  const txIcon = tx => tx.type === 'income' ? (categoryMeta[tx.category]?.icon || '↙') : tx.type === 'expense' ? (categoryMeta[tx.category]?.icon || '↗') : '⇄';
  const sortedTransactions = () => activeTransactions().slice().sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt) || new Date(b.createdAt) - new Date(a.createdAt));
  const totalBalance = () => state.wallets.reduce((sum, wallet) => sum + walletBalance(wallet.id), 0);
  function walletBalance(walletId, at = Infinity) {
    const wallet = findWallet(walletId); if (!wallet) return 0;
    let result = Number(wallet.initialBalance) || 0;
    const end = typeof at === 'number' ? at : new Date(at).getTime();
    for (const tx of state.transactions) {
      if (tx.deletedAt || new Date(tx.occurredAt).getTime() > end) continue;
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'income' && tx.walletId === walletId) result += amt;
      if (tx.type === 'expense' && tx.walletId === walletId) result -= amt;
      if (tx.type === 'transfer') { if (tx.walletId === walletId) result -= amt; if (tx.toWalletId === walletId) result += amt; }
    }
    return result;
  }
  function walletBalanceAfterTx(tx) {
    if (!tx || tx.type === 'transfer') return null;
    const wallet = findWallet(tx.walletId); if (!wallet) return 0;
    let balance = Number(wallet.initialBalance) || 0;
    const ordered = state.transactions.filter(item => !item.deletedAt && item.walletId === tx.walletId || !item.deletedAt && item.type === 'transfer' && item.toWalletId === tx.walletId)
      .filter(item => new Date(item.occurredAt).getTime() < new Date(tx.occurredAt).getTime() || (new Date(item.occurredAt).getTime() === new Date(tx.occurredAt).getTime() && new Date(item.createdAt).getTime() <= new Date(tx.createdAt).getTime()))
      .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt) || new Date(a.createdAt) - new Date(b.createdAt));
    for (const item of ordered) { const amount = Number(item.amount) || 0; if (item.type === 'income' && item.walletId === tx.walletId) balance += amount; if (item.type === 'expense' && item.walletId === tx.walletId) balance -= amount; if (item.type === 'transfer') { if (item.walletId === tx.walletId) balance -= amount; if (item.toWalletId === tx.walletId) balance += amount; } }
    return balance;
  }
  const monthTransactions = (month = monthKey(new Date())) => activeTransactions().filter(tx => monthKey(tx.occurredAt) === month);
  const monthIncome = (list = monthTransactions()) => list.filter(tx => tx.type === 'income').reduce((s, tx) => s + Number(tx.amount), 0);
  const monthExpense = (list = monthTransactions()) => list.filter(tx => tx.type === 'expense').reduce((s, tx) => s + Number(tx.amount), 0);
  const countLabel = count => `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'операция' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'операции' : 'операций'}`;

  async function persist({ render = true, cloud = true } = {}) {
    state.updatedAt = nowISO();
    try { saveProvider = await storageSet(state); $('#saveStatus').textContent = saveProvider === 'memory' ? 'Внимание: сохранение только до закрытия вкладки' : 'Сохранено автоматически · ' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); if (saveProvider === 'memory' && !window.__vigerMemoryWarning) { window.__vigerMemoryWarning = true; toast('Постоянное хранилище недоступно. Сейчас данные останутся только в этой вкладке — экспортируй резервную копию.', 'error'); } }
    catch (error) { toast(error.message, 'error'); }
    if (render) renderAll();
    if (cloud && session?.access_token) queueCloudSync();
  }
  function audit(action, entityType, entityId, before, after) {
    const stamp = nowISO();
    state.audit.unshift({ id: uid(), action, entityType, entityId, before: clone(before), after: clone(after), createdAt: stamp });
    if (state.audit.length > 2000) state.audit.length = 2000;
  }
  function recordUndo(entityType, entityId, before, after) {
    state.undoStack.push({ id: uid(), entityType, entityId, before: clone(before), after: clone(after), createdAt: nowISO() });
    if (state.undoStack.length > 30) state.undoStack.shift();
  }
  function undoLast() {
    const record = state.undoStack.pop();
    if (!record) { toast('Пока нечего отменять', 'error'); return; }
    if (record.entityType === 'transaction') {
      const idx = state.transactions.findIndex(tx => tx.id === record.entityId);
      const current = idx >= 0 ? clone(state.transactions[idx]) : null;
      if (record.before == null) {
        if (idx >= 0) { state.transactions[idx].deletedAt = nowISO(); state.transactions[idx].updatedAt = nowISO(); }
      } else if (idx >= 0) state.transactions[idx] = { ...clone(record.before), updatedAt: nowISO() };
      else state.transactions.push({ ...clone(record.before), updatedAt: nowISO() });
      audit('undo', 'transaction', record.entityId, current, idx >= 0 ? state.transactions[idx] : null);
      persist(); toast('Последнее действие отменено');
    } else { toast('Отмена доступна для последних операций', 'error'); }
  }

  function toast(message, type = 'success') {
    const node = document.createElement('div'); node.className = `toast ${type}`;
    node.innerHTML = `<span class="toast-mark">${type === 'error' ? '!' : '✓'}</span><span>${esc(message)}</span>`;
    $('#toastRegion').appendChild(node);
    window.setTimeout(() => { node.style.opacity = '0'; node.style.transform = 'translateY(4px)'; window.setTimeout(() => node.remove(), 220); }, 3600);
    $('#liveAnnouncement').textContent = message;
  }

  function applyTheme() {
    const mode = state?.settings?.theme || 'dark';
    const isLight = mode === 'light' || (mode === 'system' && window.matchMedia?.('(prefers-color-scheme: light)').matches);
    document.body.classList.toggle('light', !!isLight);
    $$('.theme-option').forEach(btn => btn.classList.toggle('active', btn.dataset.theme === mode));
    const meta = $('meta[name="theme-color"]'); if (meta) meta.content = isLight ? '#f4f6f3' : '#101310';
  }
  function navigate(page) {
    if (!$(`#page-${page}`)) page = 'dashboard';
    currentPage = page;
    $$('.page').forEach(node => node.classList.toggle('active', node.id === `page-${page}`));
    $$('.nav-link[data-page], .mobile-nav-link[data-page]').forEach(btn => btn.classList.toggle('active', btn.dataset.page === page));
    const labels = { dashboard: 'Главная', transactions: 'История', wallets: 'Кошельки', insights: 'Статистика', goals: 'Цели', settings: 'Настройки' };
    $('#pageTitle').textContent = labels[page] || 'Главная';
    $('#sidebar').classList.remove('open');
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (page === 'transactions') $('#historySearch').focus({ preventScroll: true });
    renderAll();
  }

  function renderAll() {
    if (!state) return;
    applyTheme();
    renderDashboard(); renderHistory(); renderWallets(); renderInsights(); renderGoals(); renderSettings();
  }
  function renderDashboard() {
    $('#todayLabel').textContent = `ТВОИ ДЕНЬГИ · ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }).toUpperCase()}`;
    $('#totalBalance').innerHTML = `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(totalBalance())} <small>сум</small>`;
    $('#balanceNote').textContent = 'По всем кошелькам · UZS';
    const inc = monthIncome(), exp = monthExpense();
    $('#monthIncome').textContent = `+${money(inc)}`; $('#monthExpense').textContent = `−${money(exp)}`;
    $('#statIncome').textContent = money(inc); $('#statExpense').textContent = money(exp);
    const mt = monthTransactions(), iCount = mt.filter(tx => tx.type === 'income').length, eCount = mt.filter(tx => tx.type === 'expense').length;
    $('#incomeCount').textContent = countLabel(iCount); $('#expenseCount').textContent = countLabel(eCount);
    const max = Math.max(inc, exp, 1); $('#incomeTrack').style.width = `${inc / max * 100}%`; $('#expenseTrack').style.width = `${exp / max * 100}%`;
    $('#incomeTrend').textContent = inc > exp ? 'приходы выше' : inc === exp ? 'наравне' : 'меньше расходов';
    $('#expenseTrend').textContent = exp > inc ? 'расходы выше' : exp === inc ? 'наравне' : 'расходы ниже';
    const txs = sortedTransactions().slice(0, 5);
    $('#recentTransactions').innerHTML = txs.length ? txs.map(renderTransactionRow).join('') : `<div class="empty-inline"><strong>Первая запись — начало порядка</strong>Получил или потратил? Запиши это в поле быстрой операции выше.</div>`;
    const wallets = activeWallets();
    const quickWallet = $('#quickWallet'); if (quickWallet) { const prior = quickWallet.value; quickWallet.innerHTML = wallets.map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join(''); if (wallets.some(w => w.id === prior)) quickWallet.value = prior; }
    $('#walletPreview').innerHTML = wallets.length ? wallets.slice(0, 4).map(wallet => `<div class="wallet-preview-item"><span class="wallet-icon" style="color:${esc(wallet.accent || '#83e0a5')}">${esc(wallet.icon || '▣')}</span><span class="wallet-prev-info"><strong>${esc(wallet.name)}</strong><small>${esc(walletMeta[wallet.kind]?.type || 'Кошелёк')}</small></span><strong class="wallet-prev-balance">${money(walletBalance(wallet.id))}</strong></div>`).join('') : `<div class="empty-inline">Добавь кошелёк, чтобы начать.</div>`;
    $('#categoryPreview').innerHTML = renderCategoryBars(mt.filter(tx => tx.type === 'expense'), 5);
    const firstRun = activeTransactions().length === 0 && state.wallets.every(wallet => Number(wallet.initialBalance) === 0);
    $('#openingBalanceNotice').classList.toggle('hidden', !firstRun);
    const goal = state.goals.find(g => !g.deletedAt);
    if (!goal) $('#goalPreview').innerHTML = `<div class="empty-inline"><strong>Накопи на то, что хочется</strong>Создай цель — приложение поможет видеть прогресс.</div>`;
    else {
      const current = goalCurrent(goal), pct = Math.min(100, goal.targetAmount > 0 ? current / goal.targetAmount * 100 : 0);
      $('#goalPreview').innerHTML = `<div class="goal-preview-heading"><strong>${esc(goal.icon || '◎')} ${esc(goal.name)}</strong><span>${Math.round(pct)}%</span></div><div class="goal-progress"><span style="width:${pct}%"></span></div><div class="goal-bottom"><span>${money(current)} из ${money(goal.targetAmount)}</span><strong>Осталось ${money(Math.max(0, goal.targetAmount - current))}</strong></div>`;
    }
  }
  function renderTransactionRow(tx) {
    const iconClass = tx.type;
    const transferMeta = tx.type === 'transfer' ? `${walletName(tx.walletId)} → ${walletName(tx.toWalletId)}` : `${walletName(tx.walletId)}${tx.category ? ` · ${tx.category}` : ''}`;
    const amountText = signedMoney(tx.type, tx.amount);
    return `<div class="transaction-row"><span class="tx-icon ${iconClass}">${esc(txIcon(tx))}</span><span class="tx-details"><strong class="tx-title">${esc(txTitle(tx))}</strong><span class="tx-meta">${esc(dateLabel(tx.occurredAt))}, ${timeLabel(tx.occurredAt)} · ${esc(transferMeta)}</span></span><span class="tx-right"><strong class="tx-amount ${iconClass}">${esc(amountText)}</strong>${tx.type !== 'transfer' ? `<small class="tx-balance">Баланс: ${money(walletBalanceAfterTx(tx))}</small>` : ''}</span></div>`;
  }
  function renderCategoryBars(txs, limit = 8) {
    const totals = new Map(); txs.forEach(tx => { const cat = tx.category || 'Прочее'; totals.set(cat, (totals.get(cat) || 0) + Number(tx.amount)); });
    const items = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit); const max = Math.max(...items.map(x => x[1]), 1);
    if (!items.length) return `<div class="empty-inline">Пока нет расходов. Здесь появится разбивка по категориям.</div>`;
    return items.map(([cat, amount]) => `<div class="category-row"><span class="category-name">${esc(cat)}</span><span class="category-bar"><span style="width:${amount / max * 100}%;background:${esc(categoryMeta[cat]?.color || '#83e0a5')}"></span></span><strong class="category-amount">${money(amount)}</strong></div>`).join('');
  }

  function renderHistory() {
    const search = ($('#historySearch')?.value || '').trim().toLowerCase();
    const type = $('#historyType')?.value || 'all'; const wallet = $('#historyWallet')?.value || 'all'; const period = $('#historyPeriod')?.value || 'all';
    const now = new Date(); let filtered = sortedTransactions().filter(tx => {
      if (type !== 'all' && tx.type !== type) return false;
      if (wallet !== 'all' && tx.walletId !== wallet && tx.toWalletId !== wallet) return false;
      const d = new Date(tx.occurredAt);
      if (period === 'month' && monthKey(d) !== monthKey(now)) return false;
      if (['7', '30'].includes(period) && (now.getTime() - d.getTime() > Number(period) * 86400000 || d.getTime() > now.getTime())) return false;
      const haystack = `${tx.description || ''} ${tx.category || ''} ${tx.amount} ${walletName(tx.walletId)} ${walletName(tx.toWalletId || '')} ${tx.type}`.toLowerCase();
      return !search || haystack.includes(search);
    });
    const walletSelect = $('#historyWallet');
    if (walletSelect) {
      const desired = walletSelect.value;
      const options = `<option value="all">Все кошельки</option>` + activeWallets().map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join('');
      if (walletSelect.innerHTML !== options) { walletSelect.innerHTML = options; if (activeWallets().some(w => w.id === desired)) walletSelect.value = desired; else walletSelect.value = 'all'; }
      const chosenWallet = walletSelect.value;
      if (chosenWallet !== wallet) return renderHistory();
    }
    const income = filtered.filter(tx => tx.type === 'income').reduce((s, tx) => s + Number(tx.amount), 0);
    const expense = filtered.filter(tx => tx.type === 'expense').reduce((s, tx) => s + Number(tx.amount), 0);
    $('#historySummary').innerHTML = `<span>Операций: <strong>${filtered.length}</strong></span><span>Приходы: <strong style="color:var(--green)">+${money(income)}</strong></span><span>Расходы: <strong style="color:var(--red)">−${money(expense)}</strong></span><span>Баланс всех кошельков: <strong>${money(totalBalance())}</strong></span>`;
    const list = $('#historyList'); const empty = $('#historyEmpty');
    if (!filtered.length) { list.innerHTML = ''; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden'); let previousDate = '';
    list.innerHTML = filtered.map(tx => {
      const groupingKey = new Date(tx.occurredAt).toDateString(); let heading = '';
      if (groupingKey !== previousDate) { heading = `<div class="history-day-label">${esc(dateLabel(tx.occurredAt))}</div>`; previousDate = groupingKey; }
      const meta = tx.type === 'transfer' ? `Перевод · ${walletName(tx.walletId)} → ${walletName(tx.toWalletId)}` : `${tx.category || 'Прочее'} · ${walletName(tx.walletId)} · ${timeLabel(tx.occurredAt)}`;
      return `${heading}<div class="history-row"><div class="history-row-main"><span class="tx-icon ${tx.type}">${esc(txIcon(tx))}</span><span class="tx-details"><strong class="tx-title">${esc(txTitle(tx))}</strong><span class="tx-meta">${esc(meta)}</span></span></div><div class="history-row-side"><span class="history-side-amount"><strong class="tx-amount ${tx.type}">${esc(signedMoney(tx.type, tx.amount))}</strong>${tx.type !== 'transfer' ? `<small class="tx-balance">Баланс: ${money(walletBalanceAfterTx(tx))}</small>` : ''}</span><span class="history-actions"><button type="button" data-edit-tx="${tx.id}" title="Редактировать" aria-label="Редактировать операцию">✎</button><button type="button" class="delete-tx" data-delete-tx="${tx.id}" title="Удалить" aria-label="Удалить операцию">×</button></span></div></div>`;
    }).join('');
  }

  function renderWallets() {
    const wallets = activeWallets(); const total = totalBalance();
    $('#walletSummary').innerHTML = `<div class="wallet-summary-card"><small>Общий баланс</small><strong>${money(total)}</strong></div><div class="wallet-summary-card"><small>Активных кошельков</small><strong>${wallets.length}</strong></div><div class="wallet-summary-card"><small>Денежный поток за месяц</small><strong style="color:${monthIncome() - monthExpense() >= 0 ? 'var(--green)' : 'var(--red)'}">${monthIncome() - monthExpense() >= 0 ? '+' : '−'}${money(Math.abs(monthIncome() - monthExpense()))}</strong></div>`;
    const archivedWallets = state.wallets.filter(wallet => wallet.archivedAt);
    const walletCards = wallets.map(w => {
      const bal = walletBalance(w.id); const txCount = activeTransactions().filter(tx => tx.walletId === w.id || tx.toWalletId === w.id).length;
      return `<article class="wallet-card" style="--wallet-accent:${esc(w.accent || '#83e0a5')}"><div class="wallet-card-top"><span class="wallet-icon">${esc(w.icon || '▣')}</span><span class="wallet-card-actions"><button data-edit-wallet="${w.id}" aria-label="Редактировать кошелёк" title="Редактировать">✎</button><button data-archive-wallet="${w.id}" aria-label="Архивировать кошелёк" title="Архивировать">⋯</button></span></div><h3>${esc(w.name)}</h3><p class="wallet-type">${esc(walletMeta[w.kind]?.type || 'Пользовательский кошелёк')}</p><div class="wallet-balance">${money(bal)} <small>UZS</small></div><div class="wallet-card-footer"><span>Начальный баланс</span><strong>${money(w.initialBalance)}</strong></div><div class="wallet-card-footer" style="margin-top:0;padding-top:9px;border-top:0"><span>${countLabel(txCount)}</span><strong>${bal < 0 ? 'Минусовой баланс' : bal === 0 ? 'Баланс 0' : 'В плюсе'}</strong></div></article>`;
    });
    archivedWallets.forEach(w => { const bal = walletBalance(w.id); walletCards.push(`<article class="wallet-card wallet-archived" style="--wallet-accent:${esc(w.accent || '#83e0a5')}"><div class="wallet-card-top"><span class="wallet-icon">${esc(w.icon || '▣')}</span><span class="wallet-archive-label">В архиве</span></div><h3>${esc(w.name)}</h3><p class="wallet-type">Архивный кошелёк · история сохранена</p><div class="wallet-balance">${money(bal)} <small>UZS</small></div><div class="wallet-card-footer"><span>Баланс включён в общий</span><strong>${money(bal)}</strong></div><div class="wallet-card-footer" style="margin-top:0;padding-top:9px;border-top:0"><span>Не используется для новых операций</span><button class="secondary-btn" style="padding:5px 8px;font-size:10px" data-restore-wallet="${w.id}">Восстановить</button></div></article>`); });
    $('#walletGrid').innerHTML = walletCards.length ? walletCards.join('') : `<div class="panel empty-inline">Активных кошельков нет. Создай новый кошелёк.</div>`;
    const options = wallets.map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join('');
    const from = $('#transferFrom'), to = $('#transferTo');
    const prevFrom = from.value, prevTo = to.value;
    from.innerHTML = options; to.innerHTML = options;
    if (wallets.some(w => w.id === prevFrom)) from.value = prevFrom;
    if (wallets.some(w => w.id === prevTo)) to.value = prevTo;
    if (wallets.length > 1 && from.value === to.value) to.selectedIndex = 1;
    $('#transferForm button[type="submit"]').disabled = wallets.length < 2;
    $('#transferForm button[type="submit"]').style.opacity = wallets.length < 2 ? '.5' : '1';
  }

  function renderInsights() {
    const period = $('#insightPeriod')?.value || 'month'; const now = new Date(); let list = sortedTransactions();
    if (period === 'month') list = list.filter(tx => monthKey(tx.occurredAt) === monthKey(now));
    if (period === '30' || period === '90') list = list.filter(tx => now.getTime() - new Date(tx.occurredAt).getTime() <= Number(period) * 86400000);
    const inc = monthIncome(list), exp = monthExpense(list), net = inc - exp;
    $('#insightSummary').innerHTML = `<div class="insight-stat"><span>Поступления</span><strong style="color:var(--green)">+${money(inc)}</strong><small>${countLabel(list.filter(tx => tx.type === 'income').length)}</small></div><div class="insight-stat"><span>Расходы</span><strong style="color:var(--red)">−${money(exp)}</strong><small>${countLabel(list.filter(tx => tx.type === 'expense').length)}</small></div><div class="insight-stat"><span>Разница</span><strong style="color:${net >= 0 ? 'var(--green)' : 'var(--red)'}">${net >= 0 ? '+' : '−'}${money(Math.abs(net))}</strong><small>Приходы минус расходы</small></div>`;
    const chartTx = period === 'month' ? list : list.filter(tx => new Date(tx.occurredAt).getTime() >= now.getTime() - 13 * 86400000);
    const byDay = new Map();
    chartTx.forEach(tx => { const key = new Date(tx.occurredAt).toLocaleDateString('sv-SE'); if (!byDay.has(key)) byDay.set(key, { income: 0, expense: 0 }); if (tx.type === 'income') byDay.get(key).income += Number(tx.amount); if (tx.type === 'expense') byDay.get(key).expense += Number(tx.amount); });
    let days = [];
    if (period === 'month') { const count = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); days = Array.from({ length: count }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth(), i + 1); return { key: d.toLocaleDateString('sv-SE'), label: `${i + 1}`, ...(byDay.get(d.toLocaleDateString('sv-SE')) || { income: 0, expense: 0 }) }; }); if (count > 20) days = days.filter((_, i) => i % 2 === 0 || i === count - 1); }
    else { days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); const key = d.toLocaleDateString('sv-SE'); return { key, label: i % 2 === 0 ? d.getDate().toString() : '', ...(byDay.get(key) || { income: 0, expense: 0 }) }; }); }
    const max = Math.max(...days.flatMap(d => [d.income, d.expense]), 1);
    $('#cashflowChart').innerHTML = days.map(d => `<div class="chart-day" title="${esc(d.key)}: +${money(d.income)} / −${money(d.expense)}"><div class="chart-bars"><span class="chart-bar income-bar" style="height:${Math.max(d.income ? 2 : 0, d.income / max * 100)}%"></span><span class="chart-bar expense-bar" style="height:${Math.max(d.expense ? 2 : 0, d.expense / max * 100)}%"></span></div><label>${esc(d.label)}</label></div>`).join('');
    const expenses = list.filter(tx => tx.type === 'expense'); const totals = new Map(); expenses.forEach(tx => totals.set(tx.category || 'Прочее', (totals.get(tx.category || 'Прочее') || 0) + Number(tx.amount)));
    const cats = [...totals.entries()].sort((a, b) => b[1] - a[1]); const maxCat = Math.max(...cats.map(c => c[1]), 1);
    $('#categoryChart').innerHTML = cats.length ? cats.slice(0, 8).map(([cat, amount]) => `<div class="category-chart-row"><span class="category-chart-icon">${esc(categoryMeta[cat]?.icon || '•')}</span><div class="category-chart-detail"><strong>${esc(cat)}</strong><span class="category-bar"><span style="width:${amount / maxCat * 100}%;background:${esc(categoryMeta[cat]?.color || '#83e0a5')}"></span></span></div><span class="category-chart-amount">${money(amount)}</span></div>`).join('') : `<div class="empty-inline">Добавь расходы, чтобы увидеть разбивку.</div>`;
    const byMonth = new Map(); activeTransactions().forEach(tx => { const key = monthKey(tx.occurredAt); if (!byMonth.has(key)) byMonth.set(key, { income: 0, expense: 0, count: 0 }); if (tx.type === 'income') byMonth.get(key).income += Number(tx.amount); if (tx.type === 'expense') byMonth.get(key).expense += Number(tx.amount); byMonth.get(key).count++; });
    $('#monthlyTable').innerHTML = byMonth.size ? `<table><thead><tr><th>МЕСЯЦ</th><th>ПРИХОДЫ</th><th>РАСХОДЫ</th><th>РАЗНИЦА</th><th>ОПЕРАЦИЙ</th></tr></thead><tbody>${[...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).map(([key, vals]) => `<tr><td>${esc(monthTitle(key))}</td><td style="color:var(--green)">+${money(vals.income)}</td><td style="color:var(--red)">−${money(vals.expense)}</td><td style="color:${vals.income - vals.expense >= 0 ? 'var(--green)' : 'var(--red)'}">${vals.income - vals.expense >= 0 ? '+' : '−'}${money(Math.abs(vals.income - vals.expense))}</td><td>${vals.count}</td></tr>`).join('')}</tbody></table>` : `<div class="empty-inline">Сводка появится после первых операций.</div>`;
  }

  function goalCurrent(goal) {
    if (goal.walletId) return Math.max(0, walletBalance(goal.walletId));
    return Math.max(0, Number(goal.currentAmount) || 0);
  }
  function renderGoals() {
    const goals = state.goals.filter(goal => !goal.deletedAt); const totalTarget = goals.reduce((sum, goal) => sum + Number(goal.targetAmount || 0), 0); const totalSaved = goals.reduce((sum, goal) => sum + Math.min(Number(goal.targetAmount || 0), goalCurrent(goal)), 0);
    $('#goalsOverview').innerHTML = `<div class="goals-overview-card"><small>Активных целей</small><strong>${goals.length}</strong></div><div class="goals-overview-card"><small>Общая сумма целей</small><strong>${money(totalTarget)}</strong></div><div class="goals-overview-card"><small>Твой прогресс</small><strong style="color:var(--green)">${Math.round(totalTarget ? totalSaved / totalTarget * 100 : 0)}%</strong></div>`;
    $('#goalsGrid').innerHTML = goals.length ? goals.map(goal => {
      const current = goalCurrent(goal), target = Number(goal.targetAmount) || 0, pct = Math.min(100, target > 0 ? current / target * 100 : 0), linked = !!goal.walletId;
      return `<article class="goal-card"><div class="goal-card-top"><span class="goal-emoji">${esc(goal.icon || '◎')}</span><span class="goal-card-actions"><button data-edit-goal="${goal.id}" title="Редактировать цель" aria-label="Редактировать цель">✎</button><button data-delete-goal="${goal.id}" title="Удалить цель" aria-label="Удалить цель">×</button></span></div><h3>${esc(goal.name)}</h3><p>${esc(goal.note || (linked ? `Баланс кошелька «${walletName(goal.walletId)}» учитывается автоматически` : 'Ручной учёт прогресса'))}</p><div class="goal-progress"><span style="width:${pct}%"></span></div><div class="goal-card-stats"><div><strong>${money(current)}</strong><br/><small>из ${money(target)}</small></div><div style="text-align:right"><strong style="color:var(--green)">${Math.round(pct)}%</strong><br/><small>Осталось ${money(Math.max(0, target - current))}</small></div></div><div class="goal-actions-bottom"><button data-goal-add="${goal.id}">＋ Добавить прогресс</button><button data-goal-sub="${goal.id}">− Уменьшить</button></div></article>`;
    }).join('') : `<div class="panel empty-state" style="grid-column:1/-1"><div class="empty-illustration">◎</div><h3>С чего начнётся следующая цель?</h3><p>Видеокарта, телефон, компьютер или просто финансовая подушка.</p><button class="primary-btn" data-action="add-goal">＋ Создать цель</button></div>`;
  }

  function renderSettings() {
    $('#supabaseUrl').value = state.settings.cloudUrl || ''; $('#supabaseKey').value = state.settings.cloudKey || ''; $('#cloudEmail').value = state.settings.cloudEmail || '';
    $('#cloudStatusTitle').textContent = session?.access_token ? `Подключено${session.user?.email ? ` · ${session.user.email}` : ''}` : 'Облако не подключено';
    $('#cloudStatusText').textContent = session?.access_token ? 'Аккаунт активен. Синхронизация отправляет операции, кошельки и цели в твой проект Supabase.' : 'Пока данные хранятся на этом устройстве. Для синхронизации нужен собственный проект Supabase.';
    $('#cloudSignIn').textContent = session?.access_token ? 'Аккаунт подключён' : 'Войти / создать аккаунт';
    $('#cloudSignIn').disabled = !!session?.access_token || cloudBusy;
    $('#cloudSync').disabled = !session?.access_token || cloudBusy;
    $('#cloudSignOut').classList.toggle('hidden', !session?.access_token);
  }

  function parseExpression(raw) {
    const source = raw.replace(/\s+/g, '').replace(/,/g, '.');
    if (!source || !/[+*/-]/.test(source) || !/^[\d.+\-*/()]+$/.test(source)) return null;
    const tokens = source.match(/\d+(?:\.\d+)?|[()+\-*/]/g);
    if (!tokens || tokens.join('') !== source) return null;
    let i = 0;
    function primary() {
      let sign = 1;
      while (tokens[i] === '+' || tokens[i] === '-') { if (tokens[i] === '-') sign *= -1; i++; }
      let value;
      if (tokens[i] === '(') { i++; value = expr(); if (tokens[i] !== ')') throw new Error('Скобки'); i++; }
      else { const token = tokens[i++]; if (!token || !/^\d/.test(token)) throw new Error('Число'); value = Number(token); }
      return sign * value;
    }
    function term() { let value = primary(); while (tokens[i] === '*' || tokens[i] === '/') { const op = tokens[i++], b = primary(); if (op === '/' && b === 0) throw new Error('Деление на ноль'); value = op === '*' ? value * b : value / b; } return value; }
    function expr() { let value = term(); while (tokens[i] === '+' || tokens[i] === '-') { const op = tokens[i++], b = term(); value = op === '+' ? value + b : value - b; } return value; }
    try { const result = expr(); if (i !== tokens.length || !Number.isFinite(result)) return null; return Math.round(result); } catch { return null; }
  }
  function parseAmount(text) {
    const match = text.match(/(\d[\d\s]*(?:[.,]\d+)?)\s*(тысяч(?:а|и)?|тыс\.?|к|k|сум(?:ов|а)?|uzs)?/i);
    if (!match) return null;
    let numberText = match[1].trim().replace(/[\s\u00a0]/g, '');
    let amount;
    if (/^\d{1,3}(?:[.,]\d{3})+$/.test(numberText)) amount = Number(numberText.replace(/[.,]/g, ''));
    else amount = Number(numberText.replace(',', '.'));
    if (!Number.isFinite(amount)) return null;
    const unit = (match[2] || '').toLowerCase();
    if (['тысяч', 'тысяча', 'тысячи', 'тыс.', 'тыс', 'к', 'k'].includes(unit)) amount *= 1000;
    return { amount: Math.round(amount), match: match[0], index: match.index, rawNumber: numberText };
  }
  function inferCategory(text, type) {
    const s = text.toLowerCase();
    if (/(школ|урок|тетрад|учеб|класс|экзамен)/.test(s)) return 'Школа';
    if (/(дорог|такси|автобус|метро|маршрутк|транспорт|проезд|бензин)/.test(s)) return 'Транспорт';
    if (/(еда|обед|завтрак|ужин|магазин еды|сладост|вода|напит|булоч|перекус|кофе)/.test(s)) return 'Еда';
    if (/(компьютер|видеокарт|телефон|мыш|клавиатур|монитор|техник|гаджет)/.test(s)) return 'Техника';
    if (/(игр|кино|развлеч|подписк|музык|аниме)/.test(s)) return 'Развлечения';
    if (/(подар|день рождения)/.test(s)) return 'Подарки';
    if (/(врач|аптек|лекар|здоров)/.test(s)) return 'Здоровье';
    if (/(купил|покуп|вещ|одежд)/.test(s)) return 'Покупки';
    if (type === 'income') return /карман|родител|мама|папа|дали/.test(s) ? 'Карманные деньги' : 'Доход';
    return 'Прочее';
  }
  function parseQuick(raw, forcedType = null) {
    const text = raw.trim(); if (!text) return { error: 'Введи сумму или опиши операцию.' };
    const signed = text.match(/^([+\-−])\s*(\d[\d\s\u00a0]*(?:[.,]\d+)?)\s*(тысяч(?:а|и)?|тыс\.?|к|k|сум(?:ов|а)?|uzs)?\s*(.*)$/i);
    if (signed) {
      const n = parseAmount(`${signed[2]} ${signed[3] || ''}`); const amount = n?.amount;
      if (!Number.isFinite(amount) || amount <= 0) return { error: 'Сумма должна быть больше нуля.' };
      const type = signed[1] === '+' ? 'income' : 'expense';
      const desc = (signed[4] || '').trim().replace(/^[,.:;–—-]+\s*/, '');
      return { type: forcedType && forcedType !== 'transfer' && !signed[1] ? forcedType : type, amount, description: desc, category: inferCategory(`${desc} ${text}`, type), raw: text };
    }
    const lower = text.toLowerCase();
    const naturalType = /(потрат|отдал|отдала|оплат|купил|купила|заплат|расход|школ|дорог|такси|проезд)/.test(lower) ? 'expense' : /(получ|заработ|пришл|дали|доход|поступ|вернул|вернули|подарили)/.test(lower) ? 'income' : /(перев[её]л|перевести|перевод|переложил|снял налич|перенёс)/.test(lower) ? 'transfer' : null;
    const parsed = parseAmount(text);
    if (parsed && parsed.amount > 0 && /(тысяч|тыс\.?|\bк\b|\bk\b|сум|потрат|получ|заработ|школ|дорог|оплат|купил|отдал|пришл|дали|доход|такси|проезд)/i.test(text)) {
      const type = forcedType || naturalType || 'expense';
      let desc = text.replace(parsed.match, ' ');
      desc = desc.replace(/\b(я|себе|сегодня|вчера|потратил[аи]?|получил[аи]?|заработал[аи]?|мне|дали|пришли|пришло|на|в|за|для|сум|сумов|сумов|тысяч|тысячи|тысяча|тыс\.?|к|k)\b/ig, ' ').replace(/\s+/g, ' ').replace(/^[,.:;–—-]+|[,.:;–—-]+$/g, '').trim();
      const category = inferCategory(`${text} ${desc}`, type);
      return { type, amount: parsed.amount, description: desc, category: type === 'transfer' ? 'Перевод' : category, raw: text };
    }
    const expression = parseExpression(text);
    if (expression !== null && expression > 0) return { openForm: true, amount: expression, type: forcedType || 'expense', description: '', category: 'Прочее' };
    if (parsed && parsed.amount > 0 && text.replace(parsed.match, '').trim() === '') return { openForm: true, amount: parsed.amount, type: forcedType || 'expense', description: '', category: 'Прочее' };
    return { error: 'Не смог понять запись. Пример: +50000, −10000 школа или «потратил 10к на дорогу».' };
  }
  function quickSubmit(event) {
    event?.preventDefault();
    const raw = $('#quickInput').value; const result = parseQuick(raw, pendingQuickType);
    if (result.error) { toast(result.error, 'error'); $('#quickInput').focus(); return; }
    if (result.openForm || result.type === 'transfer') { openTransactionModal({ type: result.type, amount: result.amount, description: result.description, category: result.category }); return; }
    const wallet = findWallet($('#quickWallet').value) || activeWallets()[0];
    if (!wallet) { toast('Сначала создай кошелёк', 'error'); navigate('wallets'); return; }
    if (result.type === 'expense' && walletBalance(wallet.id) < result.amount) {
      openTransactionModal({ type: 'expense', amount: result.amount, description: result.description, category: result.category, walletId: wallet.id, warning: 'В выбранном кошельке не хватает денег. Можно всё равно сохранить операцию, если баланс ещё не внесён.' }); return;
    }
    createTransaction({ type: result.type, amount: result.amount, description: result.description, category: result.category, walletId: wallet.id, occurredAt: nowISO() });
    $('#quickInput').value = ''; pendingQuickType = null; updateQuickUi(); $('#quickInput').focus();
  }
  function updateQuickUi() {
    $('#quickPrefix').textContent = pendingQuickType === 'income' ? '+' : pendingQuickType === 'expense' ? '−' : pendingQuickType === 'transfer' ? '⇄' : '±';
    $$('.type-chip[data-quick-type]').forEach(btn => btn.classList.toggle('selected', btn.dataset.quickType === pendingQuickType));
  }

  function openModal(title, eyebrow, bodyHtml) {
    modalReturnFocus = document.activeElement;
    $('#modalTitle').textContent = title; $('#modalEyebrow').textContent = eyebrow;
    $('#modalBody').innerHTML = bodyHtml; $('#modalBackdrop').classList.remove('hidden');
    document.body.style.overflow = 'hidden'; window.setTimeout(() => $('#modalBody input, #modalBody select, #modalBody textarea, #modalBody button')?.focus({ preventScroll: true }), 40);
  }
  function closeModal() { $('#modalBackdrop').classList.add('hidden'); document.body.style.overflow = ''; $('#modalBody').innerHTML = ''; if (modalReturnFocus?.focus) modalReturnFocus.focus({ preventScroll: true }); }
  function openTransactionModal(values = {}) {
    const editId = values.id || null, isEdit = !!editId;
    const type = values.type || 'expense'; const wallets = activeWallets();
    const current = values.occurredAt || nowISO();
    const walletOptions = wallets.map(w => `<option value="${w.id}" ${w.id === values.walletId ? 'selected' : ''}>${esc(w.name)} · ${money(walletBalance(w.id))}</option>`).join('');
    const toOptions = wallets.filter(w => w.id !== (values.walletId || wallets[0]?.id)).map(w => `<option value="${w.id}" ${w.id === values.toWalletId ? 'selected' : ''}>${esc(w.name)}</option>`).join('');
    const cats = ['Прочее', 'Еда', 'Транспорт', 'Школа', 'Покупки', 'Здоровье', 'Развлечения', 'Техника', 'Подарки', 'Карманные деньги', 'Доход'];
    openModal(isEdit ? 'Редактировать операцию' : 'Новая операция', isEdit ? 'ИЗМЕНИТЬ ЗАПИСЬ' : 'БЫСТРАЯ ЗАПИСЬ', `
      <form class="modal-form" id="transactionForm">
        <div class="modal-type-select"><button type="button" class="modal-type-option ${type === 'income' ? 'active' : ''}" data-modal-type="income">＋ Приход</button><button type="button" class="modal-type-option ${type === 'expense' ? 'active' : ''}" data-modal-type="expense">− Расход</button><button type="button" class="modal-type-option ${type === 'transfer' ? 'active' : ''}" data-modal-type="transfer">⇄ Перевод</button></div>
        <input type="hidden" id="txType" value="${esc(type)}"/><input type="hidden" id="txEditId" value="${esc(editId || '')}"/>
        <div class="field"><label for="txAmount">Сумма</label><div class="modal-amount-input"><input id="txAmount" type="number" min="1" step="1" required placeholder="0" value="${values.amount != null ? esc(values.amount) : ''}"/><span>сум</span></div></div>
        <div class="field"><label for="txDescription">Описание</label><input id="txDescription" maxlength="120" placeholder="Например, карманные деньги" value="${esc(values.description || '')}"/></div>
        <div class="modal-form-grid"><div class="field" id="txWalletField"><label for="txWallet">${type === 'income' ? 'Куда поступили' : 'Из какого кошелька'}</label><select id="txWallet" required>${walletOptions}</select></div><div class="field ${type === 'transfer' ? '' : 'hidden'}" id="txToWalletField"><label for="txToWallet">Куда перевести</label><select id="txToWallet" ${type === 'transfer' ? 'required' : ''}>${toOptions}</select></div><div class="field ${type === 'transfer' ? 'hidden' : ''}" id="txCategoryField"><label for="txCategory">Категория</label><select id="txCategory">${cats.map(c => `<option ${c === (values.category || (type === 'income' ? 'Доход' : 'Прочее')) ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div></div>
        <div class="field"><label for="txDate">Дата и время</label><input id="txDate" type="datetime-local" required value="${localDateTimeValue(current)}"/></div>
        ${values.warning ? `<div class="confirm-card">ⓘ ${esc(values.warning)}</div>` : ''}
        <div class="modal-actions"><button type="button" class="secondary-btn" id="cancelTransaction">Отмена</button><button type="submit" class="primary-btn">${isEdit ? 'Сохранить изменения' : 'Сохранить операцию'} ↗</button></div>
        <p class="modal-footnote">Операция сохраняется локально. Баланс и статистика пересчитаются автоматически.</p>
      </form>`);
    $('#transactionForm').dataset.initialType = type;
    function switchType(nextType) {
      $('#txType').value = nextType;
      $$('.modal-type-option').forEach(btn => btn.classList.toggle('active', btn.dataset.modalType === nextType));
      $('#txToWalletField').classList.toggle('hidden', nextType !== 'transfer'); $('#txCategoryField').classList.toggle('hidden', nextType === 'transfer');
      $('#txWalletField label').textContent = nextType === 'income' ? 'Куда поступили' : nextType === 'transfer' ? 'Откуда' : 'Из какого кошелька';
      $('#txToWallet').required = nextType === 'transfer'; $('#txCategory').disabled = nextType === 'transfer';
    }
    $$('.modal-type-option').forEach(btn => btn.addEventListener('click', () => switchType(btn.dataset.modalType)));
    $('#txWallet').addEventListener('change', () => { const from = $('#txWallet').value; const selected = $('#txToWallet').value; $('#txToWallet').innerHTML = wallets.filter(w => w.id !== from).map(w => `<option value="${w.id}" ${w.id === selected ? 'selected' : ''}>${esc(w.name)}</option>`).join(''); if (!wallets.some(w => w.id === selected && w.id !== from)) $('#txToWallet').selectedIndex = 0; });
    $('#cancelTransaction').addEventListener('click', closeModal);
    $('#transactionForm').addEventListener('submit', event => {
      event.preventDefault();
      const amount = Number($('#txAmount').value), txType = $('#txType').value, walletId = $('#txWallet').value, toWalletId = $('#txToWallet').value;
      if (!Number.isSafeInteger(amount) || amount <= 0) { toast('Введи корректную сумму в целых сумах', 'error'); return; }
      if (!walletId || !findWallet(walletId)) { toast('Выбери существующий кошелёк', 'error'); return; }
      if (txType === 'transfer' && (!toWalletId || toWalletId === walletId)) { toast('Для перевода выбери два разных кошелька', 'error'); return; }
      const occurredAt = new Date($('#txDate').value).toISOString();
      const data = { type: txType, amount, walletId, toWalletId: txType === 'transfer' ? toWalletId : null, description: $('#txDescription').value.trim(), category: txType === 'transfer' ? 'Перевод' : $('#txCategory').value, occurredAt };
      if (editId) updateTransaction(editId, data); else createTransaction(data);
      closeModal(); $('#quickInput').value = ''; pendingQuickType = null; updateQuickUi();
    });
    switchType(type);
  }

  function createTransaction(data) {
    const amount = Math.round(Number(data.amount));
    if (!Number.isSafeInteger(amount) || amount <= 0) { toast('Сумма должна быть положительным целым числом', 'error'); return; }
    if (data.type === 'transfer' && data.walletId === data.toWalletId) { toast('Нельзя перевести деньги в тот же кошелёк', 'error'); return; }
    const stamp = nowISO(); const tx = { id: uid(), type: data.type, amount, walletId: data.walletId, toWalletId: data.type === 'transfer' ? data.toWalletId : null, description: (data.description || '').trim(), category: data.type === 'transfer' ? 'Перевод' : data.category || 'Прочее', occurredAt: data.occurredAt || stamp, createdAt: stamp, updatedAt: stamp, deletedAt: null };
    state.transactions.push(tx); audit('create', 'transaction', tx.id, null, tx); recordUndo('transaction', tx.id, null, tx); persist();
    toast(`${tx.type === 'income' ? 'Получено' : tx.type === 'expense' ? 'Расход записан' : 'Перевод записан'} · ${money(tx.amount)}`);
  }
  function updateTransaction(id, data) {
    const idx = state.transactions.findIndex(tx => tx.id === id && !tx.deletedAt); if (idx < 0) { toast('Операция не найдена', 'error'); return; }
    const before = clone(state.transactions[idx]);
    state.transactions[idx] = { ...state.transactions[idx], ...data, updatedAt: nowISO(), deletedAt: null };
    const after = clone(state.transactions[idx]); audit('update', 'transaction', id, before, after); recordUndo('transaction', id, before, after); persist(); toast('Операция обновлена');
  }
  function deleteTransaction(id) {
    const idx = state.transactions.findIndex(tx => tx.id === id && !tx.deletedAt); if (idx < 0) return;
    const before = clone(state.transactions[idx]); state.transactions[idx].deletedAt = nowISO(); state.transactions[idx].updatedAt = nowISO(); const after = clone(state.transactions[idx]);
    audit('delete', 'transaction', id, before, after); recordUndo('transaction', id, before, after); persist(); toast('Операция удалена. Ctrl+Z — отменить');
  }

  function openWalletModal(wallet = null) {
    const edit = !!wallet; selectedWalletAccent = wallet?.accent || '#83e0a5';
    const colors = ['#83e0a5', '#95c7ef', '#d0a7e8', '#e7c28d', '#f2a1a1', '#edb39a', '#83c8dd'];
    openModal(edit ? 'Редактировать кошелёк' : 'Новый кошелёк', edit ? 'НАСТРОЙКИ КОШЕЛЬКА' : 'ДОБАВИТЬ КОШЕЛЁК', `<form id="walletForm" class="modal-form"><input type="hidden" id="walletEditId" value="${wallet?.id || ''}"/><div class="field"><label for="walletName">Название</label><input id="walletName" required maxlength="45" placeholder="Например, наличные" value="${esc(wallet?.name || '')}"/></div><div class="modal-form-grid"><div class="field"><label for="walletKind">Тип</label><select id="walletKind"><option value="cash" ${wallet?.kind === 'cash' ? 'selected' : ''}>Наличные</option><option value="card" ${wallet?.kind === 'card' ? 'selected' : ''}>Карта</option><option value="savings" ${wallet?.kind === 'savings' ? 'selected' : ''}>Накопления</option><option value="other" ${wallet?.kind === 'other' ? 'selected' : ''}>Другое</option></select></div><div class="field"><label for="walletIcon">Значок</label><select id="walletIcon"><option>◉</option><option>▰</option><option>▣</option><option>▤</option><option>◇</option><option>⌘</option><option>♧</option><option>★</option></select></div></div><div class="field"><label>Цвет</label><div class="color-options">${colors.map(color => `<button type="button" class="color-option ${color === selectedWalletAccent ? 'active' : ''}" data-wallet-color="${color}" style="background:${color}" aria-label="Цвет ${color}"></button>`).join('')}</div></div><div class="field"><label for="walletInitial">Начальный баланс, сум</label><input id="walletInitial" type="number" step="1" placeholder="0" value="${esc(wallet?.initialBalance ?? 0)}" required/><small class="modal-footnote">Укажи, сколько денег было в этом кошельке до первой записи. Это не считается доходом.</small></div><div class="modal-actions"><button type="button" class="secondary-btn" id="cancelWallet">Отмена</button><button type="submit" class="primary-btn">${edit ? 'Сохранить кошелёк' : 'Создать кошелёк'} ↗</button></div></form>`);
    $('#walletIcon').value = wallet?.icon || walletMeta[wallet?.kind || 'cash']?.icon || '◉';
    $$('[data-wallet-color]').forEach(btn => btn.addEventListener('click', () => { selectedWalletAccent = btn.dataset.walletColor; $$('[data-wallet-color]').forEach(b => b.classList.toggle('active', b === btn)); }));
    $('#cancelWallet').addEventListener('click', closeModal);
    $('#walletForm').addEventListener('submit', event => {
      event.preventDefault(); const name = $('#walletName').value.trim(); const initialBalance = Number($('#walletInitial').value); const kind = $('#walletKind').value; const icon = $('#walletIcon').value;
      if (!name) return; if (!Number.isSafeInteger(initialBalance)) { toast('Начальный баланс должен быть целым числом', 'error'); return; }
      if (state.wallets.some(w => w.name.toLowerCase() === name.toLowerCase() && w.id !== wallet?.id && !w.archivedAt)) { toast('Кошелёк с таким названием уже есть', 'error'); return; }
      if (wallet) { const before = clone(wallet); Object.assign(wallet, { name, initialBalance, kind, icon, accent: selectedWalletAccent, updatedAt: nowISO() }); audit('update', 'wallet', wallet.id, before, wallet); toast('Кошелёк обновлён'); }
      else { const created = { id: uid(), name, initialBalance, kind, icon, accent: selectedWalletAccent, createdAt: nowISO(), updatedAt: nowISO(), archivedAt: null }; state.wallets.push(created); audit('create', 'wallet', created.id, null, created); toast('Кошелёк создан'); }
      persist(); closeModal();
    });
  }
  function archiveWallet(id) {
    const wallet = findWallet(id); if (!wallet || wallet.archivedAt) return;
    const related = activeTransactions().some(tx => tx.walletId === id || tx.toWalletId === id);
    if (related) { confirmAction('В кошельке есть история', `В «${wallet.name}» есть операции. Архивирование скроет его из активных кошельков, но сохранит всю историю. Продолжить?`, () => { const before = clone(wallet); wallet.archivedAt = nowISO(); wallet.updatedAt = nowISO(); audit('archive', 'wallet', id, before, wallet); persist(); toast('Кошелёк архивирован'); }); }
    else { confirmAction('Архивировать кошелёк?', `Кошелёк «${wallet.name}» исчезнет из активного списка. Его можно восстановить из резервной копии.`, () => { wallet.archivedAt = nowISO(); wallet.updatedAt = nowISO(); audit('archive', 'wallet', id, null, wallet); persist(); toast('Кошелёк архивирован'); }); }
  }

  function openGoalModal(goal = null) {
    const edit = !!goal; const wallets = activeWallets();
    openModal(edit ? 'Редактировать цель' : 'Новая цель накоплений', edit ? 'ИЗМЕНИТЬ ЦЕЛЬ' : 'ПОСТАВИТЬ ЦЕЛЬ', `<form id="goalForm" class="modal-form"><input type="hidden" id="goalEditId" value="${goal?.id || ''}"/><div class="field"><label for="goalName">На что копишь?</label><input id="goalName" required maxlength="70" placeholder="Например, новая видеокарта" value="${esc(goal?.name || '')}"/></div><div class="modal-form-grid"><div class="field"><label for="goalIcon">Значок</label><select id="goalIcon"><option>◎</option><option>🎮</option><option>💻</option><option>📱</option><option>🚲</option><option>🎧</option><option>✈</option><option>◇</option><option>★</option></select></div><div class="field"><label for="goalTarget">Цель, сум</label><input id="goalTarget" type="number" required min="1" step="1" placeholder="3500000" value="${goal?.targetAmount ?? ''}"/></div></div><div class="field"><label for="goalWallet">Откуда учитывать накопления</label><select id="goalWallet"><option value="">Вести прогресс вручную</option>${wallets.map(w => `<option value="${w.id}" ${goal?.walletId === w.id ? 'selected' : ''}>${esc(w.name)} · ${money(walletBalance(w.id))}</option>`).join('')}</select><small class="modal-footnote">Если выбрать кошелёк, цель будет показывать его фактический баланс.</small></div><div class="field ${goal?.walletId ? 'hidden' : ''}" id="goalCurrentField"><label for="goalCurrent">Уже накоплено, сум</label><input id="goalCurrent" type="number" min="0" step="1" value="${goal?.currentAmount ?? 0}"/></div><div class="field"><label for="goalNote">Заметка (необязательно)</label><textarea id="goalNote" maxlength="180" placeholder="Почему эта цель важна?">${esc(goal?.note || '')}</textarea></div><div class="modal-actions"><button type="button" class="secondary-btn" id="cancelGoal">Отмена</button><button type="submit" class="primary-btn">${edit ? 'Сохранить цель' : 'Создать цель'} ↗</button></div></form>`);
    $('#goalIcon').value = goal?.icon || '◎';
    $('#goalWallet').addEventListener('change', () => $('#goalCurrentField').classList.toggle('hidden', !!$('#goalWallet').value));
    $('#cancelGoal').addEventListener('click', closeModal);
    $('#goalForm').addEventListener('submit', event => {
      event.preventDefault(); const name = $('#goalName').value.trim(), targetAmount = Number($('#goalTarget').value), walletId = $('#goalWallet').value || null, currentAmount = Number($('#goalCurrent').value || 0);
      if (!name || !Number.isSafeInteger(targetAmount) || targetAmount <= 0 || (!walletId && (!Number.isSafeInteger(currentAmount) || currentAmount < 0))) { toast('Проверь название и суммы цели', 'error'); return; }
      const data = { name, targetAmount, walletId, currentAmount, icon: $('#goalIcon').value, note: $('#goalNote').value.trim(), updatedAt: nowISO(), deletedAt: null };
      if (goal) { const before = clone(goal); Object.assign(goal, data); audit('update', 'goal', goal.id, before, goal); toast('Цель обновлена'); }
      else { const created = { id: uid(), ...data, createdAt: nowISO() }; state.goals.push(created); audit('create', 'goal', created.id, null, created); toast('Цель создана'); }
      persist(); closeModal();
    });
  }
  function changeGoalProgress(id, sign) {
    const goal = state.goals.find(g => g.id === id && !g.deletedAt); if (!goal) return;
    if (goal.walletId) { toast(`Прогресс берётся из кошелька «${walletName(goal.walletId)}». ${sign > 0 ? 'Пополняй этот кошелёк' : 'Скорректируй соответствующие операции'}.`, 'error'); return; }
    openModal(sign > 0 ? 'Добавить прогресс' : 'Уменьшить прогресс', goal.name.toUpperCase(), `<form id="goalProgressForm" class="modal-form"><div class="confirm-card">Сейчас накоплено: <strong>${money(goal.currentAmount)}</strong><br/>Цель: <strong>${money(goal.targetAmount)}</strong></div><div class="field"><label for="goalProgressAmount">${sign > 0 ? 'Сколько добавляем, сум' : 'Сколько вычитаем, сум'}</label><input id="goalProgressAmount" type="number" min="1" step="1" required placeholder="50000"/></div><div class="modal-actions"><button type="button" class="secondary-btn" id="cancelProgress">Отмена</button><button type="submit" class="primary-btn">${sign > 0 ? 'Добавить' : 'Уменьшить'}</button></div></form>`);
    $('#cancelProgress').addEventListener('click', closeModal); $('#goalProgressForm').addEventListener('submit', event => { event.preventDefault(); const amount = Number($('#goalProgressAmount').value); if (!Number.isSafeInteger(amount) || amount <= 0) return toast('Укажи корректную сумму', 'error'); const before = clone(goal); goal.currentAmount = Math.max(0, Number(goal.currentAmount) + sign * amount); goal.updatedAt = nowISO(); audit('update-progress', 'goal', id, before, goal); persist(); closeModal(); toast('Прогресс обновлён'); });
  }

  function confirmAction(title, message, action, confirmLabel = 'Подтвердить') {
    openModal(title, 'ПОДТВЕРЖДЕНИЕ', `<div class="modal-form"><div class="confirm-card">${esc(message)}</div><div class="modal-actions"><button type="button" class="secondary-btn" id="confirmCancel">Отмена</button><button type="button" class="primary-btn" id="confirmOk">${esc(confirmLabel)}</button></div></div>`);
    $('#confirmCancel').addEventListener('click', closeModal); $('#confirmOk').addEventListener('click', () => { closeModal(); action(); });
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }
  function exportBackup() {
    const payload = { app: 'VIGER MONEY', version: 1, exportedAt: nowISO(), state };
    downloadFile(`viger-money-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8'); toast('Резервная копия подготовлена');
  }
  function csvCell(value) { const s = String(value ?? ''); return `"${s.replace(/"/g, '""')}"`; }
  function exportCSV() {
    const lines = [['ID', 'Дата и время', 'Тип', 'Сумма (UZS)', 'Кошелёк', 'Кошелёк назначения', 'Категория', 'Описание', 'Статус']];
    sortedTransactions().forEach(tx => lines.push([tx.id, new Date(tx.occurredAt).toLocaleString('ru-RU'), tx.type === 'income' ? 'Приход' : tx.type === 'expense' ? 'Расход' : 'Перевод', tx.amount, walletName(tx.walletId), tx.toWalletId ? walletName(tx.toWalletId) : '', tx.category, tx.description, 'Активна']));
    const deleted = state.transactions.filter(tx => tx.deletedAt).sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
    deleted.forEach(tx => lines.push([tx.id, new Date(tx.occurredAt).toLocaleString('ru-RU'), tx.type === 'income' ? 'Приход' : tx.type === 'expense' ? 'Расход' : 'Перевод', tx.amount, walletName(tx.walletId), tx.toWalletId ? walletName(tx.toWalletId) : '', tx.category, tx.description, `Удалена ${new Date(tx.deletedAt).toLocaleString('ru-RU')}`]));
    const csv = '\ufeff' + lines.map(row => row.map(csvCell).join(';')).join('\r\n'); downloadFile(`viger-money-transactions-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8'); toast('CSV-файл подготовлен');
  }
  function importBackup(file) {
    const reader = new FileReader(); reader.onerror = () => toast('Не удалось прочитать файл', 'error');
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result); const imported = data?.state || data;
        if (!imported || !Array.isArray(imported.wallets) || !Array.isArray(imported.transactions) || !Array.isArray(imported.goals)) throw new Error('Структура файла не похожа на резервную копию VIGER MONEY.');
        const hasConflictingLocal = state.transactions.length || state.goals.length || state.wallets.some(w => Number(w.initialBalance) !== 0);
        confirmAction('Восстановить резервную копию?', `Будут заменены текущие данные на содержимое файла. ${hasConflictingLocal ? 'Перед продолжением лучше скачать копию текущих данных.' : ''} Импортированный баланс будет вычислен из кошельков и операций.`, async () => {
          const incoming = clone(imported); incoming.settings = { ...defaultState().settings, ...(incoming.settings || {}) }; incoming.audit = Array.isArray(incoming.audit) ? incoming.audit : []; incoming.undoStack = [];
          if (!Array.isArray(incoming.transactions) || !Array.isArray(incoming.wallets) || !Array.isArray(incoming.goals)) return toast('Файл повреждён', 'error');
          state = incoming; await persist({ cloud: false }); renderAll(); toast('Данные восстановлены из резервной копии');
        }, 'Восстановить');
      } catch (error) { toast(error.message || 'Неверный JSON-файл', 'error'); }
      $('#importFile').value = '';
    }; reader.readAsText(file);
  }

  function setCloudConfig() {
    const url = $('#supabaseUrl').value.trim().replace(/\/$/, ''); const key = $('#supabaseKey').value.trim(); const email = $('#cloudEmail').value.trim();
    if (url && !/^https:\/\/[\w.-]+\.supabase\.co$/i.test(url)) { toast('Введи корректный Supabase Project URL', 'error'); return false; }
    if ((url && !key) || (!url && key)) { toast('Нужны и Project URL, и anon/publishable key', 'error'); return false; }
    state.settings.cloudUrl = url; state.settings.cloudKey = key; state.settings.cloudEmail = email; persist({ render: false, cloud: false }); return true;
  }
  function readSession() { try { const raw = localStorage.getItem(CLOUD_SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }
  function saveSession(next) { session = next; try { if (next) localStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(next)); else localStorage.removeItem(CLOUD_SESSION_KEY); } catch {} renderSettings(); }
  async function cloudFetch(path, options = {}, useAuth = true) {
    const base = (state.settings.cloudUrl || '').replace(/\/$/, ''); const key = state.settings.cloudKey || '';
    if (!base || !key) throw new Error('Сначала укажи Project URL и anon/publishable key.');
    const headers = { apikey: key, 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (useAuth && session?.access_token) headers.Authorization = `Bearer ${session.access_token}`; else headers.Authorization = `Bearer ${key}`;
    const response = await fetch(`${base}${path}`, { ...options, headers });
    const text = await response.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    if (!response.ok) { const msg = json?.msg || json?.message || json?.error_description || json?.hint || json?.details || json?.error || `Ошибка запроса (${response.status})`; throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)); }
    return json;
  }
  async function cloudSignIn() {
    if (session?.access_token) return;
    if (!setCloudConfig()) return;
    const email = $('#cloudEmail').value.trim(), password = $('#cloudPassword').value;
    if (!email || !password) { toast('Введи email и пароль для облачного аккаунта', 'error'); return; }
    cloudBusy = true; renderSettings(); $('#cloudSignIn').textContent = 'Подключаем…';
    try {
      const loginUrl = `${state.settings.cloudUrl}/auth/v1/token?grant_type=password`;
      const headers = { apikey: state.settings.cloudKey, 'Content-Type': 'application/json' };
      let response = await fetch(loginUrl, { method: 'POST', headers, body: JSON.stringify({ email, password }) }); let result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const loginError = result.msg || result.message || result.error_description || result.error || '';
        if (/invalid login credentials|invalid_credentials|user not found|email not confirmed/i.test(loginError)) {
          const signup = await fetch(`${state.settings.cloudUrl}/auth/v1/signup`, { method: 'POST', headers, body: JSON.stringify({ email, password }) });
          const signResult = await signup.json().catch(() => ({}));
          if (!signup.ok) throw new Error(signResult.msg || signResult.message || signResult.error_description || 'Не удалось войти или создать аккаунт. Проверь email, пароль и настройки Supabase.');
          result = signResult;
          if (!result.access_token) throw new Error('Аккаунт создан. Подтверди email по письму от Supabase, затем войди. Если подтверждение отключено, попробуй войти снова.');
        } else throw new Error(loginError || 'Не удалось войти. Проверь email, пароль и настройки проекта.');
      }
      if (!result.access_token) throw new Error('Supabase не выдал сессию. Возможно, требуется подтверждение email.');
      saveSession({ access_token: result.access_token, refresh_token: result.refresh_token, expires_at: Math.floor(Date.now() / 1000) + Number(result.expires_in || 3600), user: result.user || null });
      state.settings.cloudEmail = email; await persist({ render: false, cloud: false }); renderAll(); toast('Облачный аккаунт подключён'); await syncCloud();
    } catch (error) { toast(error.message || 'Ошибка облачного подключения', 'error'); }
    finally { cloudBusy = false; renderSettings(); }
  }
  async function ensureFreshSession() {
    if (!session?.access_token) throw new Error('Сначала войди в облачный аккаунт.');
    if (session.expires_at && session.expires_at > Math.floor(Date.now() / 1000) + 45) return;
    if (!session.refresh_token) throw new Error('Сессия истекла. Войди в аккаунт снова.');
    const response = await fetch(`${state.settings.cloudUrl}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: state.settings.cloudKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refresh_token }) });
    const next = await response.json().catch(() => ({})); if (!response.ok || !next.access_token) { saveSession(null); throw new Error('Сессия истекла. Войди в аккаунт снова.'); }
    saveSession({ access_token: next.access_token, refresh_token: next.refresh_token, expires_at: Math.floor(Date.now() / 1000) + Number(next.expires_in || 3600), user: next.user || session.user });
  }
  function toRemoteWallet(w, userId) { return { id: w.id, user_id: userId, name: w.name, kind: w.kind, icon: w.icon, accent: w.accent, initial_balance: w.initialBalance, created_at: w.createdAt, updated_at: w.updatedAt, archived_at: w.archivedAt || null }; }
  function fromRemoteWallet(w) { return { id: w.id, name: w.name, kind: w.kind, icon: w.icon, accent: w.accent, initialBalance: Number(w.initial_balance) || 0, createdAt: w.created_at, updatedAt: w.updated_at, archivedAt: w.archived_at || null }; }
  function toRemoteTx(tx, userId) { return { id: tx.id, user_id: userId, type: tx.type, amount: tx.amount, wallet_id: tx.walletId, to_wallet_id: tx.toWalletId || null, description: tx.description || '', category: tx.category || 'Прочее', occurred_at: tx.occurredAt, created_at: tx.createdAt, updated_at: tx.updatedAt, deleted_at: tx.deletedAt || null }; }
  function fromRemoteTx(tx) { return { id: tx.id, type: tx.type, amount: Number(tx.amount) || 0, walletId: tx.wallet_id, toWalletId: tx.to_wallet_id || null, description: tx.description || '', category: tx.category || 'Прочее', occurredAt: tx.occurred_at, createdAt: tx.created_at, updatedAt: tx.updated_at, deletedAt: tx.deleted_at || null }; }
  function toRemoteGoal(goal, userId) { return { id: goal.id, user_id: userId, name: goal.name, target_amount: goal.targetAmount, wallet_id: goal.walletId || null, current_amount: goal.currentAmount || 0, icon: goal.icon || '◎', note: goal.note || '', created_at: goal.createdAt, updated_at: goal.updatedAt, deleted_at: goal.deletedAt || null }; }
  function fromRemoteGoal(g) { return { id: g.id, name: g.name, targetAmount: Number(g.target_amount) || 0, walletId: g.wallet_id || null, currentAmount: Number(g.current_amount) || 0, icon: g.icon || '◎', note: g.note || '', createdAt: g.created_at, updatedAt: g.updated_at, deletedAt: g.deleted_at || null }; }
  const remoteSpecs = [
    { local: 'wallets', table: 'wallets', toRemote: toRemoteWallet, fromRemote: fromRemoteWallet },
    { local: 'transactions', table: 'transactions', toRemote: toRemoteTx, fromRemote: fromRemoteTx },
    { local: 'goals', table: 'goals', toRemote: toRemoteGoal, fromRemote: fromRemoteGoal },
    { local: 'audit', table: 'audit_log', toRemote: (row, userId) => ({ id: row.id, user_id: userId, action: row.action, entity_type: row.entityType, entity_id: row.entityId, before_data: row.before ?? null, after_data: row.after ?? null, created_at: row.createdAt }), fromRemote: row => ({ id: row.id, action: row.action, entityType: row.entity_type, entityId: row.entity_id, before: row.before_data, after: row.after_data, createdAt: row.created_at, updatedAt: row.created_at }) }
  ];
  async function syncCloud() {
    if (cloudBusy) { toast('Синхронизация уже выполняется'); return; }
    cloudBusy = true; renderSettings();
    try {
      await ensureFreshSession();
      const userId = session.user?.id; if (!userId) throw new Error('Не удалось определить пользователя Supabase. Выйди и войди снова.');
      const pendingUpserts = [];
      for (const spec of remoteSpecs) {
        const remoteRaw = await cloudFetch(`/rest/v1/${spec.table}?select=*`, { method: 'GET' });
        const remoteRows = Array.isArray(remoteRaw) ? remoteRaw : [];
        const localRows = state[spec.local];
        if (spec.local === 'wallets' && remoteRows.length) {
          const remoteIdsBeforeRemap = new Set(remoteRows.map(row => row.id));
          for (const localWallet of localRows) {
            if (remoteIdsBeforeRemap.has(localWallet.id) || localWallet.archivedAt) continue;
            const match = remoteRows.find(row => !row.archived_at && String(row.name).toLowerCase() === String(localWallet.name).toLowerCase() && row.kind === localWallet.kind);
            if (match) {
              const oldId = localWallet.id; localWallet.id = match.id;
              state.transactions.forEach(tx => { if (tx.walletId === oldId) tx.walletId = match.id; if (tx.toWalletId === oldId) tx.toWalletId = match.id; });
              state.goals.forEach(goal => { if (goal.walletId === oldId) goal.walletId = match.id; });
            }
          }
        }
        const localById = new Map(localRows.map(row => [row.id, row]));
        const remoteById = new Map(remoteRows.map(row => [row.id, spec.fromRemote(row)]));
        const remoteIds = new Set(remoteRows.map(row => row.id));
        for (const local of localRows) {
          const remote = remoteById.get(local.id);
          if (!remote) { pendingUpserts.push({ spec, row: local, userId }); continue; }
          const localStamp = new Date(local.updatedAt || local.createdAt || 0).getTime(); const remoteStamp = new Date(remote.updatedAt || remote.createdAt || 0).getTime();
          if (localStamp > remoteStamp) pendingUpserts.push({ spec, row: local, userId });
          else if (remoteStamp > localStamp) Object.assign(localById.get(remote.id), remote);
        }
        for (const remote of remoteRows) if (!localById.has(remote.id)) localRows.push(spec.fromRemote(remote));
      }
      // Restore default wallets only for a truly empty first-time local installation; never overwrite synchronized data.
      if (!state.wallets.length) state.wallets = defaultState().wallets;
      await persist({ render: false, cloud: false });
      for (const item of pendingUpserts) {
        const payload = item.spec.toRemote(item.row, item.userId);
        await cloudFetch(`/rest/v1/${item.spec.table}?on_conflict=id`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(payload) });
      }
      saveSession({ ...session, lastSyncAt: nowISO() });
      renderAll(); toast('Синхронизация завершена');
    } catch (error) { toast(`Синхронизация не выполнена: ${error.message}`, 'error'); }
    finally { cloudBusy = false; renderSettings(); }
  }
  function queueCloudSync() {
    if (!session?.access_token || cloudSyncTimer) return;
    cloudSyncTimer = window.setTimeout(async () => { cloudSyncTimer = null; if (!cloudBusy) await syncCloud(); }, 1800);
  }
  function cloudSignOut() { saveSession(null); toast('Выход выполнен. Локальные данные сохранены.'); }

  function showAuditLog() {
    const actionNames = { create: 'Создано', update: 'Изменено', delete: 'Удалено', undo: 'Отменено', 'update-progress': 'Изменён прогресс', archive: 'Архивировано', restore: 'Восстановлено' };
    const entityNames = { transaction: 'Операция', wallet: 'Кошелёк', goal: 'Цель' };
    const formatEntity = row => {
      if (!row) return '—';
      if (row.type && row.amount != null) return `${row.type === 'income' ? 'Приход' : row.type === 'expense' ? 'Расход' : 'Перевод'} · ${row.description || row.category || 'Без описания'} · ${money(row.amount)}`;
      if (row.name) return row.name;
      return 'Запись';
    };
    const records = state.audit.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100);
    openModal('Журнал исправлений', 'ИСТОРИЯ ИЗМЕНЕНИЙ', records.length ? `<div class="audit-entries">${records.map(entry => {
      const beforeText = formatEntity(entry.before), afterText = formatEntity(entry.after);
      const detail = entry.action === 'update' || entry.action === 'undo' ? `${beforeText} → ${afterText}` : formatEntity(entry.after || entry.before);
      return `<div class="audit-entry"><span class="audit-entry-icon">${entry.action === 'delete' ? '×' : entry.action === 'create' ? '+' : '↻'}</span><div class="audit-entry-main"><strong>${esc(actionNames[entry.action] || entry.action)} · ${esc(entityNames[entry.entityType] || entry.entityType)}</strong><small class="audit-detail">${esc(detail)}</small><small>${esc(new Date(entry.createdAt).toLocaleString('ru-RU'))}</small></div></div>`;
    }).join('')}</div><div class="modal-actions"><button type="button" class="secondary-btn" id="closeAuditLog">Закрыть</button><button type="button" class="primary-btn" id="exportAuditLog">Экспорт JSON ↗</button></div>` : `<div class="empty-state"><div class="empty-illustration">↻</div><h3>Изменений пока нет</h3><p>Когда ты создашь, изменишь или удалишь операцию, запись появится здесь.</p><button type="button" class="secondary-btn" id="closeAuditLog">Закрыть</button></div>`);
    $('#closeAuditLog').addEventListener('click', closeModal);
    $('#exportAuditLog')?.addEventListener('click', () => { downloadFile(`viger-money-audit-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ exportedAt: nowISO(), audit: state.audit }, null, 2), 'application/json;charset=utf-8'); toast('Журнал исправлений экспортирован'); });
  }

  function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { toast('Голосовой ввод не поддерживается этим браузером. Используй диктовку клавиатуры телефона.', 'error'); return; }
    const button = $('#voiceQuick'); const original = button.textContent; button.textContent = '…'; button.disabled = true;
    const recognition = new SpeechRecognition(); recognition.lang = 'ru-RU'; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onresult = event => { const spoken = event.results?.[0]?.[0]?.transcript || ''; if (spoken) { $('#quickInput').value = spoken; const lower = spoken.toLowerCase(); if (/(потрат|отдал|оплат|купил|заплат|расход)/.test(lower)) pendingQuickType = 'expense'; else if (/(получ|заработ|пришл|дали|доход)/.test(lower)) pendingQuickType = 'income'; updateQuickUi(); $('#quickInput').focus(); toast(`Распознано: «${spoken}»`); } };
    recognition.onerror = event => toast(event.error === 'not-allowed' ? 'Разреши доступ к микрофону в браузере.' : 'Не удалось распознать речь. Попробуй ещё раз.', 'error');
    recognition.onend = () => { button.textContent = original; button.disabled = false; };
    try { recognition.start(); toast('Слушаю… Скажи сумму и назначение операции.'); } catch { button.textContent = original; button.disabled = false; toast('Не удалось запустить микрофон.', 'error'); }
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const nav = event.target.closest('[data-page]'); if (nav) { navigate(nav.dataset.page); return; }
      const goto = event.target.closest('[data-goto]'); if (goto) { navigate(goto.dataset.goto); return; }
      const action = event.target.closest('[data-action]'); if (action) { if (action.dataset.action === 'add') openTransactionModal(); if (action.dataset.action === 'add-goal') openGoalModal(); return; }
      const quickType = event.target.closest('[data-quick-type]'); if (quickType) { const type = quickType.dataset.quickType; if (type === 'transfer') { openTransactionModal({ type: 'transfer' }); return; } pendingQuickType = pendingQuickType === type ? null : type; updateQuickUi(); $('#quickInput').focus(); return; }
      const editTx = event.target.closest('[data-edit-tx]'); if (editTx) { const tx = state.transactions.find(item => item.id === editTx.dataset.editTx); if (tx) openTransactionModal(tx); return; }
      const deleteTx = event.target.closest('[data-delete-tx]'); if (deleteTx) { const tx = state.transactions.find(item => item.id === deleteTx.dataset.deleteTx); if (tx) confirmAction('Удалить операцию?', `«${txTitle(tx)}» на ${money(tx.amount)} будет исключена из баланса. Запись останется в журнале изменений.`, () => deleteTransaction(tx.id), 'Удалить'); return; }
      const editWallet = event.target.closest('[data-edit-wallet]'); if (editWallet) { const w = findWallet(editWallet.dataset.editWallet); if (w) openWalletModal(w); return; }
      const archive = event.target.closest('[data-archive-wallet]'); if (archive) { archiveWallet(archive.dataset.archiveWallet); return; }
      const restoreWallet = event.target.closest('[data-restore-wallet]'); if (restoreWallet) { const w = findWallet(restoreWallet.dataset.restoreWallet); if (w) { w.archivedAt = null; w.updatedAt = nowISO(); audit('restore', 'wallet', w.id, null, w); persist(); toast('Кошелёк восстановлен'); } return; }
      const editGoal = event.target.closest('[data-edit-goal]'); if (editGoal) { const g = state.goals.find(item => item.id === editGoal.dataset.editGoal); if (g) openGoalModal(g); return; }
      const deleteGoal = event.target.closest('[data-delete-goal]'); if (deleteGoal) { const g = state.goals.find(item => item.id === deleteGoal.dataset.deleteGoal); if (g) confirmAction('Удалить цель?', `Цель «${g.name}» будет удалена. Операции и кошельки не изменятся.`, () => { const before = clone(g); g.deletedAt = nowISO(); g.updatedAt = nowISO(); audit('delete', 'goal', g.id, before, g); persist(); toast('Цель удалена'); }, 'Удалить'); return; }
      const goalAdd = event.target.closest('[data-goal-add]'); if (goalAdd) { changeGoalProgress(goalAdd.dataset.goalAdd, 1); return; }
      const goalSub = event.target.closest('[data-goal-sub]'); if (goalSub) { changeGoalProgress(goalSub.dataset.goalSub, -1); return; }
      const theme = event.target.closest('[data-theme]'); if (theme) { state.settings.theme = theme.dataset.theme; persist({ cloud: false }); return; }
      if (event.target.closest('#topAddBtn, #dashboardAddBtn, #historyAddBtn')) { openTransactionModal(); return; }
      if (event.target.closest('#newWalletBtn, #addWalletQuick')) { openWalletModal(); return; }
      if (event.target.closest('#newGoalBtn')) { openGoalModal(); return; }
    });
    $('#quickForm').addEventListener('submit', quickSubmit);
    $('#quickInput').addEventListener('input', () => { const val = $('#quickInput').value.trim(); if (val.startsWith('+')) $('#quickPrefix').textContent = '+'; else if (val.startsWith('-') || val.startsWith('−')) $('#quickPrefix').textContent = '−'; else if (/получ|доход|заработ/i.test(val)) $('#quickPrefix').textContent = '+'; else if (/потрат|расход|отдал|оплат|купил/i.test(val)) $('#quickPrefix').textContent = '−'; else updateQuickUi(); });
    $('#clearQuick').addEventListener('click', () => { $('#quickInput').value = ''; pendingQuickType = null; updateQuickUi(); $('#quickInput').focus(); });
    $('#voiceQuick').addEventListener('click', startVoiceInput);
    $('#openDetailed').addEventListener('click', () => { const parsed = parseQuick($('#quickInput').value, pendingQuickType); openTransactionModal({ type: pendingQuickType || parsed.type || 'expense', amount: parsed.amount ?? parseAmount($('#quickInput').value)?.amount, description: parsed.description || '', category: parsed.category || 'Прочее' }); });
    $('#setOpeningBalance').addEventListener('click', () => { const first = activeWallets()[0]; if (first) openWalletModal(first); else openWalletModal(); });
    $('#historySearch').addEventListener('input', renderHistory); ['historyType', 'historyWallet', 'historyPeriod'].forEach(id => $(`#${id}`).addEventListener('change', renderHistory));
    $('#insightPeriod').addEventListener('change', renderInsights);
    $('#transferForm').addEventListener('submit', event => { event.preventDefault(); const from = $('#transferFrom').value, to = $('#transferTo').value, amount = Number($('#transferAmount').value); if (!from || !to || from === to) return toast('Выбери разные кошельки', 'error'); if (!Number.isSafeInteger(amount) || amount <= 0) return toast('Укажи корректную сумму', 'error'); createTransaction({ type: 'transfer', amount, walletId: from, toWalletId: to, description: $('#transferNote').value.trim(), category: 'Перевод', occurredAt: nowISO() }); $('#transferAmount').value = ''; $('#transferNote').value = ''; });
    $('#modalClose').addEventListener('click', closeModal); $('#modalBackdrop').addEventListener('click', event => { if (event.target === $('#modalBackdrop')) closeModal(); });
    $('#menuToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
    $('#themeToggle').addEventListener('click', () => { state.settings.theme = state.settings.theme === 'dark' ? 'light' : state.settings.theme === 'light' ? 'system' : 'dark'; persist({ cloud: false }); });
    $('#topSearchBtn').addEventListener('click', () => { navigate('transactions'); $('#historySearch').focus(); });
    $('#exportJson').addEventListener('click', exportBackup); $('#exportCsv').addEventListener('click', exportCSV); $('#importJson').addEventListener('click', () => $('#importFile').click()); $('#showAuditLog').addEventListener('click', showAuditLog); $('#importFile').addEventListener('change', event => { if (event.target.files?.[0]) importBackup(event.target.files[0]); });
    $('#resetApp').addEventListener('click', () => confirmAction('Полностью сбросить данные?', 'Все кошельки, операции и цели, сохранённые на этом устройстве, будут удалены. Синхронизированные данные в облаке не удаляются. Сначала экспортируй резервную копию, если она нужна.', async () => { const keepSettings = { ...state.settings }; state = defaultState(); state.settings = { ...state.settings, theme: keepSettings.theme, cloudUrl: keepSettings.cloudUrl, cloudKey: keepSettings.cloudKey, cloudEmail: keepSettings.cloudEmail }; await persist({ cloud: false }); navigate('dashboard'); toast('Локальные данные сброшены'); }, 'Сбросить всё'));
    $('#supabaseUrl').addEventListener('change', () => { state.settings.cloudUrl = $('#supabaseUrl').value.trim().replace(/\/$/, ''); persist({ render: false, cloud: false }); });
    $('#supabaseKey').addEventListener('change', () => { state.settings.cloudKey = $('#supabaseKey').value.trim(); persist({ render: false, cloud: false }); });
    $('#cloudEmail').addEventListener('change', () => { state.settings.cloudEmail = $('#cloudEmail').value.trim(); persist({ render: false, cloud: false }); });
    $('#cloudSignIn').addEventListener('click', cloudSignIn); $('#cloudSync').addEventListener('click', syncCloud); $('#cloudSignOut').addEventListener('click', cloudSignOut);
    window.addEventListener('keydown', event => {
      const modalOpen = !$('#modalBackdrop').classList.contains('hidden');
      if (event.key === 'Escape') { if (modalOpen) closeModal(); else $('#sidebar').classList.remove('open'); return; }
      const inputTarget = event.target.matches('input, textarea, select, [contenteditable="true"]');
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !modalOpen && (!inputTarget || (event.target.id === 'quickInput' && !event.target.value))) { event.preventDefault(); undoLast(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'e' && !inputTarget) { event.preventDefault(); exportCSV(); return; }
      if (modalOpen || event.ctrlKey || event.metaKey || event.altKey || inputTarget) return;
      const key = event.key.toLowerCase();
      if (key === 'n') { event.preventDefault(); openTransactionModal(); }
      if (key === '/') { event.preventDefault(); navigate('transactions'); $('#historySearch').focus(); }
      if (key === '+') { pendingQuickType = 'income'; updateQuickUi(); navigate('dashboard'); $('#quickInput').focus(); }
      if (key === '-') { pendingQuickType = 'expense'; updateQuickUi(); navigate('dashboard'); $('#quickInput').focus(); }
      if (/^[1-5]$/.test(key)) { const map = { '1': 'dashboard', '2': 'transactions', '3': 'wallets', '4': 'insights', '5': 'goals' }; navigate(map[key]); }
    });
    window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (state.settings.theme === 'system') applyTheme(); });
  }

  async function init() {
    const loaded = await storageGet();
    if (loaded && Array.isArray(loaded.wallets) && Array.isArray(loaded.transactions)) {
      state = loaded; state.settings = { ...defaultState().settings, ...(state.settings || {}) }; state.goals = Array.isArray(state.goals) ? state.goals : []; state.audit = Array.isArray(state.audit) ? state.audit : []; state.undoStack = Array.isArray(state.undoStack) ? state.undoStack : [];
    } else { state = defaultState(); await storageSet(state); }
    session = readSession();
    bindEvents(); renderAll(); updateQuickUi();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('./sw.js').catch(() => {});
    if (session?.access_token && state.settings.cloudUrl && state.settings.cloudKey) { $('#cloudStatusTitle').textContent = 'Проверяем подключение…'; }
  }
  init().catch(error => { console.error(error); toast('Не удалось загрузить приложение: ' + error.message, 'error'); });
})();
