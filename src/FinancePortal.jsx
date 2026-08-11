import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './finance.css';

const FINANCE_KEY = 'gestor_personal_finanzas_v1';
const FINANCE_IMPORT_KEY = 'gestor_personal_imports_v1';
const SNAPSHOT_DATE = '2026-08-11';

const money = (value, decimals = 2) => new Intl.NumberFormat('es-EC', {
  style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals,
}).format(Number(value || 0));

const pct = (value) => `${Math.max(0, Math.min(100, Number(value || 0))).toFixed(0)}%`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const normalizeText = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const sum = (items, selector = (v) => v) => items.reduce((acc, item) => acc + Number(selector(item) || 0), 0);

const INITIAL_FINANCE = {
  version: 1,
  snapshotDate: SNAPSHOT_DATE,
  profile: { name: 'Alfredo', monthlyLifeBudget: 300, minimumOperatingFund: 100 },
  accounts: [
    { id: 'cash', name: 'Efectivo', balance: 2.00, kind: 'cash' },
    { id: 'mego', name: 'Mego', balance: 202.03, kind: 'bank', note: 'Incluye los $170,50 que antes estaban como Reponer.' },
    { id: 'loja', name: 'Loja', balance: 78.17, kind: 'bank' },
    { id: 'loja_savings', name: 'Loja Ahorro', balance: 225.87, kind: 'savings' },
    { id: 'guayaquil', name: 'Guayaquil', balance: 46.53, kind: 'bank' },
  ],
  fixedIncome: [
    { id: 'salary', name: 'Sueldo trabajo fijo', amount: 774.65, frequency: 'mensual', date: 'Último día laborable', active: true },
    { id: 'mom_streaming', name: 'Aporte mamá streaming', amount: 20.00, frequency: 'mensual', date: 'Sin fecha fija', active: true },
  ],
  extraordinaryIncome: [
    { id: 'decimo_aug', name: 'Décimo agosto', amount: 311.50, gross: 482.00, date: '2026-08-15', status: 'pending', note: '$170,50 destinados a reponer Mego.' },
    { id: 'decimo_dec', name: 'Décimo diciembre', amount: 800.00, date: '2026-12-15', status: 'pending' },
    { id: 'profit_2027', name: 'Utilidades 2027', amount: 300.00, date: '2027-04', status: 'projected', estimated: true },
    { id: 'xmas_gift', name: 'Regalo Navidad', amount: 200.00, date: 'Diciembre', status: 'possible', estimated: true },
    { id: 'birthday_gift', name: 'Regalo cumpleaños', amount: 150.00, date: 'Enero', status: 'possible', estimated: true },
  ],
  fixedExpenses: [
    { name: 'Recarga celular', amount: 10.50, category: 'Telefonía', essential: true },
    { name: 'Spotify + IVA', amount: 13.80, category: 'Suscripciones', essential: false },
    { name: 'ChatGPT Plus + IVA', amount: 23.00, category: 'Herramientas', essential: true },
    { name: 'Netflix + IVA', amount: 11.49, category: 'Suscripciones', essential: false },
    { name: 'Streaming + IVA', amount: 12.65, category: 'Suscripciones', essential: false },
    { name: 'Google Drive + IVA', amount: 2.29, category: 'Herramientas', essential: true },
    { name: 'Gimnasio', amount: 35.00, category: 'Salud / deporte', essential: true },
    { name: 'Pádel estimado mensual', amount: 25.00, category: 'Deporte', essential: false, estimated: true },
    { name: 'Cuenta compartida pareja', amount: 50.00, category: 'Pareja', essential: false, estimated: true },
  ],
  debts: [
    {
      id: 'visa_loja', name: 'Visa Banco de Loja', institution: 'Banco de Loja', type: 'Visa rotativa',
      initialBalance: 1326.64, currentBalance: 1326.64, monthlyPayment: 0, priority: 1,
      target: 'Agosto 2026', targetDate: '2026-08-31', status: 'active', estimated: false,
      note: 'Prioridad 1 · activa, no usar.',
    },
    {
      id: 'codesarrollo', name: 'Codesarrollo', institution: 'Codesarrollo', type: 'Crédito',
      initialBalance: 2043.40, currentBalance: 2043.40, monthlyPayment: 123.29, priority: 2,
      target: 'Diciembre 2026', targetDate: '2026-12-31', status: 'active', estimated: true,
      note: 'Saldo estimado; actualizar cuando tengas el saldo oficial.',
    },
    {
      id: 'austro', name: 'Banco del Austro', institution: 'Banco del Austro', type: 'Crédito consumo 300763400',
      initialBalance: 3805.28, currentBalance: 3805.28, monthlyPayment: 95.42, priority: 3,
      target: 'Enero 2027', targetDate: '2027-01-31', status: 'active', estimated: false,
      rate: 'TIV 15,60% · TIR 17,987533%',
    },
    {
      id: 'diners', name: 'Diners', institution: 'Diners', type: 'Reprogramación 36 cuotas',
      initialBalance: 2660.80, currentBalance: 2660.80, monthlyPayment: 83.15, priority: 4,
      target: 'Mayo–junio 2027', targetDate: '2027-06-30', status: 'active', estimated: false,
      rate: 'TEA 16,77% · nominal 15,60%', note: 'Tarjeta cancelada; solo pago de la reprogramación.',
    },
  ],
  liquidatedDebts: [
    { id: 'amex_history', name: 'Amex Banco Guayaquil', amount: 743.07, liquidatedAt: 'Mayo–junio 2026', estimated: true },
    { id: 'credit2_history', name: 'Crédito 2 anterior', amount: 857.58, liquidatedAt: 'Mayo–junio 2026', estimated: true },
  ],
  cards: [
    { name: 'Visa Banco Loja', limit: 2000, used: 1326.64, available: 673.36, status: 'Activa · no usar' },
    { name: 'Diners', limit: 0, used: 2660.80, available: 0, status: 'Cancelada · solo pago' },
    { name: 'Amex Banco Guayaquil', limit: 5500, used: null, available: null, status: 'Deuda liquidada · estado por actualizar' },
  ],
  transactions: [],
  debtPayments: [],
};

const loadFinance = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(FINANCE_KEY) || 'null');
    if (!stored) return clone(INITIAL_FINANCE);
    return {
      ...clone(INITIAL_FINANCE),
      ...stored,
      profile: { ...INITIAL_FINANCE.profile, ...(stored.profile || {}) },
      accounts: Array.isArray(stored.accounts) ? stored.accounts : clone(INITIAL_FINANCE.accounts),
      debts: Array.isArray(stored.debts) ? stored.debts : clone(INITIAL_FINANCE.debts),
      liquidatedDebts: Array.isArray(stored.liquidatedDebts) ? stored.liquidatedDebts : clone(INITIAL_FINANCE.liquidatedDebts),
      transactions: Array.isArray(stored.transactions) ? stored.transactions : [],
      debtPayments: Array.isArray(stored.debtPayments) ? stored.debtPayments : [],
    };
  } catch {
    return clone(INITIAL_FINANCE);
  }
};

const saveFinance = (data) => localStorage.setItem(FINANCE_KEY, JSON.stringify(data));
const loadFingerprints = () => {
  try { return new Set(JSON.parse(localStorage.getItem(FINANCE_IMPORT_KEY) || '[]')); }
  catch { return new Set(); }
};
const saveFingerprints = (set) => localStorage.setItem(FINANCE_IMPORT_KEY, JSON.stringify([...set]));

const debtProgress = (debt) => {
  const initial = Math.max(0, Number(debt.initialBalance || 0));
  const current = Math.max(0, Number(debt.currentBalance || 0));
  if (!initial) return current <= 0 ? 100 : 0;
  return Math.max(0, Math.min(100, ((initial - current) / initial) * 100));
};

const daysTo = (date) => {
  if (!date) return null;
  const now = new Date(`${SNAPSHOT_DATE}T12:00:00`);
  const due = new Date(`${date}T12:00:00`);
  return Math.round((due - now) / 86400000);
};

function Ring({ progress, children, size = 'lg' }) {
  return <div className={`pf-ring ${size}`} style={{ '--pf-progress': `${Math.max(0, Math.min(100, progress)) * 3.6}deg` }}><div>{children}</div></div>;
}

function DebtGoal({ debt, onEdit }) {
  const progress = debtProgress(debt);
  const remaining = Math.max(0, Number(debt.currentBalance || 0));
  const eliminated = Math.max(0, Number(debt.initialBalance || 0) - remaining);
  const days = daysTo(debt.targetDate);
  const urgency = remaining <= 0 ? 'done' : debt.priority === 1 ? 'focus' : days !== null && days < 90 ? 'soon' : 'normal';
  return <article className={`pf-debt-card ${urgency}`}>
    <div className="pf-debt-top">
      <div className="pf-priority">#{debt.priority}</div>
      <div className="pf-debt-title"><span>{debt.type}</span><h3>{debt.name}</h3></div>
      <Ring progress={progress} size="sm"><b>{pct(progress)}</b></Ring>
    </div>
    <div className="pf-debt-balance"><span>Saldo pendiente{debt.estimated ? ' · estimado' : ''}</span><strong>{money(remaining)}</strong></div>
    <div className="pf-progress-line"><i style={{ width: `${progress}%` }} /></div>
    <div className="pf-debt-meta">
      <div><span>Eliminado</span><b>{money(eliminated)}</b></div>
      <div><span>Cuota</span><b>{debt.monthlyPayment ? money(debt.monthlyPayment) : 'Variable'}</b></div>
      <div><span>Meta</span><b>{debt.target}</b></div>
    </div>
    {debt.note && <p className="pf-debt-note">{debt.note}</p>}
    <button className="pf-link-btn" onClick={() => onEdit(debt)}>Actualizar saldo <span>→</span></button>
  </article>;
}

function BalanceEditor({ debt, onClose, onSave }) {
  const [value, setValue] = useState(String(debt.currentBalance ?? ''));
  const [note, setNote] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const next = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(next) || next < 0) return;
    onSave(next, note);
  };
  return <div className="pf-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <form className="pf-modal" onSubmit={submit}>
      <div className="pf-modal-head"><div><span>ACTUALIZAR DEUDA</span><h3>{debt.name}</h3></div><button type="button" onClick={onClose}>×</button></div>
      <label>Saldo actual<input autoFocus value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" /></label>
      <label>Nota opcional<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. saldo oficial del estado de cuenta" /></label>
      <div className="pf-modal-actions"><button type="button" className="pf-secondary" onClick={onClose}>Cancelar</button><button className="pf-primary">Guardar saldo</button></div>
    </form>
  </div>;
}

const loadXlsx = () => new Promise((resolve, reject) => {
  if (window.XLSX) return resolve(window.XLSX);
  const existing = document.querySelector('script[data-pf-xlsx]');
  if (existing) {
    existing.addEventListener('load', () => resolve(window.XLSX), { once: true });
    existing.addEventListener('error', reject, { once: true });
    return;
  }
  const script = document.createElement('script');
  script.dataset.pfXlsx = '1';
  script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  script.onload = () => resolve(window.XLSX);
  script.onerror = reject;
  document.head.appendChild(script);
});

const excelDateToISO = (value, XLSX) => {
  if (value === '' || value == null) return '';
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  return String(value);
};

const isAfterSnapshot = (date) => !!date && date > SNAPSHOT_DATE;
const accountAlias = (name) => normalizeText(name) === 'reponer' ? 'Mego' : String(name || '').trim();

const makeFingerprintRows = (rows, type, XLSX) => {
  const occurrence = new Map();
  return rows.slice(2).filter((row) => row?.some((cell) => cell !== '' && cell != null)).map((row) => {
    let item;
    if (type === 'transfer') {
      item = {
        type,
        date: excelDateToISO(row[0], XLSX),
        from: String(row[1] || '').trim(),
        to: String(row[2] || '').trim(),
        amount: Number(row[3] || 0),
        amountIn: Number(row[5] || row[3] || 0),
        comment: String(row[7] || '').trim(),
      };
    } else {
      item = {
        type,
        date: excelDateToISO(row[0], XLSX),
        category: String(row[1] || '').trim(),
        account: String(row[2] || '').trim(),
        amount: Number(row[3] || 0),
        tags: String(row[9] || '').trim(),
        comment: String(row[10] || '').trim(),
      };
    }
    const base = type === 'transfer'
      ? [type, item.date, item.from, item.to, item.amount, item.amountIn, item.comment].map(normalizeText).join('|')
      : [type, item.date, item.category, item.account, item.amount, item.tags, item.comment].map(normalizeText).join('|');
    const count = (occurrence.get(base) || 0) + 1;
    occurrence.set(base, count);
    return { ...item, fingerprint: `${base}|#${count}` };
  });
};

const applyImportedMovement = (data, movement) => {
  const next = clone(data);
  if (!isAfterSnapshot(movement.date)) return next;
  const accountIndex = (name) => next.accounts.findIndex((account) => normalizeText(account.name) === normalizeText(accountAlias(name)));
  if (movement.type === 'expense' || movement.type === 'income') {
    const idx = accountIndex(movement.account);
    if (idx >= 0) next.accounts[idx].balance = Number(next.accounts[idx].balance || 0) + (movement.type === 'income' ? movement.amount : -movement.amount);
  } else if (movement.type === 'transfer') {
    const from = accountIndex(movement.from);
    const to = accountIndex(movement.to);
    if (from >= 0 && normalizeText(accountAlias(movement.from)) !== normalizeText(accountAlias(movement.to))) next.accounts[from].balance = Number(next.accounts[from].balance || 0) - movement.amount;
    if (to >= 0 && normalizeText(accountAlias(movement.from)) !== normalizeText(accountAlias(movement.to))) next.accounts[to].balance = Number(next.accounts[to].balance || 0) + movement.amountIn;
  }
  return next;
};

function FinanceDashboard({ onClose }) {
  const [data, setData] = useState(loadFinance);
  const [editingDebt, setEditingDebt] = useState(null);
  const [importState, setImportState] = useState(null);
  const uploadRef = useRef(null);

  useEffect(() => saveFinance(data), [data]);

  const metrics = useMemo(() => {
    const activeInitial = sum(data.debts, (debt) => debt.initialBalance);
    const activeCurrent = sum(data.debts, (debt) => debt.currentBalance);
    const historic = sum(data.liquidatedDebts, (debt) => debt.amount);
    const journeyTotal = activeInitial + historic;
    const eliminated = historic + Math.max(0, activeInitial - activeCurrent);
    return {
      activeCurrent,
      historic,
      journeyTotal,
      eliminated,
      progress: journeyTotal ? (eliminated / journeyTotal) * 100 : 100,
      liquid: sum(data.accounts, (account) => account.balance),
      fixedIncome: sum(data.fixedIncome.filter((item) => item.active), (item) => item.amount),
      fixedExpenses: sum(data.fixedExpenses, (item) => item.amount),
      monthlyDebt: sum(data.debts, (debt) => debt.monthlyPayment),
    };
  }, [data]);

  const monthTransactions = useMemo(() => data.transactions.filter((t) => t.date?.startsWith('2026-08')), [data.transactions]);
  const monthExpense = sum(monthTransactions.filter((t) => t.type === 'expense'), (t) => t.amount);
  const monthIncome = sum(monthTransactions.filter((t) => t.type === 'income'), (t) => t.amount);

  const saveDebtBalance = (balance, note) => {
    setData((prev) => ({
      ...prev,
      debts: prev.debts.map((debt) => debt.id === editingDebt.id ? {
        ...debt,
        currentBalance: balance,
        estimated: false,
        lastBalanceUpdate: new Date().toISOString(),
        lastBalanceNote: note || debt.lastBalanceNote || '',
        status: balance <= 0 ? 'paid' : 'active',
      } : debt),
    }));
    setEditingDebt(null);
  };

  const importExcel = async (file) => {
    if (!file) return;
    setImportState({ kind: 'loading', text: 'Leyendo movimientos…' });
    try {
      const XLSX = await loadXlsx();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
      const movements = [];
      const defs = [['Gastos', 'expense'], ['Ingresos', 'income'], ['Transferencias', 'transfer']];
      defs.forEach(([sheetName, type]) => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return;
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
        movements.push(...makeFingerprintRows(rows, type, XLSX));
      });
      const fingerprints = loadFingerprints();
      const fresh = movements.filter((movement) => !fingerprints.has(movement.fingerprint));
      fresh.forEach((movement) => fingerprints.add(movement.fingerprint));
      saveFingerprints(fingerprints);

      let next = clone(data);
      fresh.forEach((movement) => {
        next.transactions.push(movement);
        if (movement.type === 'expense' && normalizeText(movement.category) === 'deudas') {
          next.debtPayments.push({
            id: movement.fingerprint,
            date: movement.date,
            amount: movement.amount,
            account: movement.account,
            debtName: movement.comment || 'Deuda',
          });
        }
        next = applyImportedMovement(next, movement);
      });
      setData(next);
      const historic = fresh.filter((m) => !isAfterSnapshot(m.date)).length;
      const live = fresh.length - historic;
      setImportState({
        kind: 'success',
        text: fresh.length
          ? `${fresh.length} nuevos · ${movements.length - fresh.length} ya estaban registrados${historic ? ` · ${historic} históricos sin alterar saldos` : ''}${live ? ` · ${live} afectaron saldos` : ''}`
          : `Sin novedades · ${movements.length} movimientos ya estaban registrados`,
      });
    } catch (error) {
      console.error(error);
      setImportState({ kind: 'error', text: 'No pude leer ese archivo. Usa el Excel exportado por tu app de finanzas.' });
    } finally {
      if (uploadRef.current) uploadRef.current.value = '';
    }
  };

  return <div className="pf-page">
    <header className="pf-header">
      <div><span className="pf-eyebrow">MIS FINANZAS · ALFREDO</span><h1>De deuda a <em>libertad.</em></h1><p>Un solo lugar para ver tu dinero real, tus compromisos y cuánto has avanzado.</p></div>
      <div className="pf-header-actions">
        <input ref={uploadRef} hidden type="file" accept=".xlsx,.xls" onChange={(e) => importExcel(e.target.files?.[0])} />
        <button className="pf-import" onClick={() => uploadRef.current?.click()}><span>↑</span> Importar movimientos</button>
        <button className="pf-close" onClick={onClose} aria-label="Cerrar finanzas">×</button>
      </div>
    </header>

    {importState && <div className={`pf-import-state ${importState.kind}`}><span>{importState.kind === 'success' ? '✓' : importState.kind === 'error' ? '!' : '…'}</span>{importState.text}</div>}

    <section className="pf-hero-grid">
      <article className="pf-main-goal">
        <div className="pf-goal-copy"><span className="pf-eyebrow light">META GENERAL</span><h2>Deuda cero</h2><p>Tu recorrido completo incluye también las dos deudas que ya lograste liquidar.</p><div className="pf-big-number">{money(metrics.activeCurrent)}</div><span className="pf-caption">deuda activa restante · saldo aproximado mientras Codesarrollo siga estimado</span></div>
        <Ring progress={metrics.progress}><strong>{pct(metrics.progress)}</strong><small>del camino<br/>completado</small></Ring>
        <div className="pf-goal-bottom"><div><span>Ya eliminaste</span><b>{money(metrics.eliminated)}</b></div><div><span>Recorrido total</span><b>{money(metrics.journeyTotal)}</b></div><div><span>Deudas cerradas</span><b>{data.liquidatedDebts.length}</b></div></div>
      </article>

      <article className="pf-cash-card">
        <div className="pf-card-head"><div><span className="pf-eyebrow">HOY</span><h3>Dinero disponible</h3></div><span className="pf-soft-icon">$</span></div>
        <strong className="pf-cash-total">{money(metrics.liquid)}</strong>
        <p>Saldo de tus cuentas personales. “Reponer” ya está consolidado dentro de Mego.</p>
        <div className="pf-account-list">{data.accounts.map((account) => <div key={account.id}><span><i className={`pf-account-dot ${account.kind}`} />{account.name}</span><b>{money(account.balance)}</b></div>)}</div>
      </article>
    </section>

    <section className="pf-section">
      <div className="pf-section-head"><div><span className="pf-eyebrow">PLAN DE LIQUIDACIÓN</span><h2>Una victoria a la vez.</h2><p>Actualiza el saldo oficial de cada deuda cuando lo tengas y el avance se recalcula solo.</p></div><div className="pf-order-badge">Visa → Codesarrollo → Austro → Diners</div></div>
      <div className="pf-debt-grid">{[...data.debts].sort((a,b) => a.priority - b.priority).map((debt) => <DebtGoal key={debt.id} debt={debt} onEdit={setEditingDebt} />)}</div>
    </section>

    <section className="pf-insight-grid">
      <article className="pf-flow-card">
        <div className="pf-card-head"><div><span className="pf-eyebrow">FLUJO BASE</span><h3>Tu mes antes de extras</h3></div><span className="pf-soft-icon">↕</span></div>
        <div className="pf-flow-row positive"><span>Ingresos fijos</span><b>+{money(metrics.fixedIncome)}</b></div>
        <div className="pf-flow-row"><span>Gastos fijos estimados</span><b>-{money(metrics.fixedExpenses)}</b></div>
        <div className="pf-flow-row debt"><span>Cuotas de deuda conocidas</span><b>-{money(metrics.monthlyDebt)}</b></div>
        <div className="pf-flow-separator" />
        <div className="pf-flow-row total"><span>Margen base antes de transporte / variables</span><b>{money(metrics.fixedIncome - metrics.fixedExpenses - metrics.monthlyDebt)}</b></div>
        <small>Visa es variable y no está incluida como cuota fija.</small>
      </article>

      <article className="pf-month-card">
        <div className="pf-card-head"><div><span className="pf-eyebrow">AGOSTO · IMPORTADO</span><h3>Movimientos personales</h3></div><span className="pf-soft-icon">⌁</span></div>
        <div className="pf-month-numbers"><div><span>Ingresos</span><b className="green">+{money(monthIncome)}</b></div><div><span>Gastos</span><b>-{money(monthExpense)}</b></div><div><span>Movimientos</span><b>{monthTransactions.length}</b></div></div>
        <p>Vuelve a subir el Excel cuando quieras. El importador reconoce lo que ya existe y agrega solo movimientos nuevos.</p>
        <div className="pf-mini-note"><span>◎</span> Las transferencias entre tus cuentas no cuentan como ingreso ni gasto.</div>
      </article>

      <article className="pf-next-card">
        <span className="pf-eyebrow">SIGUIENTE OBJETIVO</span><div className="pf-target-number">01</div><h3>Visa Banco de Loja</h3><strong>{money(data.debts.find((d) => d.id === 'visa_loja')?.currentBalance || 0)}</strong><p>Es la primera deuda del plan. Cuando llegue a cero, esta tarjeta cambia a “Liquidada” y el dashboard marca la primera gran victoria del plan actual.</p>
      </article>
    </section>

    <section className="pf-history">
      <div><span className="pf-eyebrow">YA LO HAS HECHO ANTES</span><h2>Deudas liquidadas</h2></div>
      <div className="pf-history-list">{data.liquidatedDebts.map((debt) => <div key={debt.id}><span className="pf-check">✓</span><div><b>{debt.name}</b><small>{debt.liquidatedAt}</small></div><strong>{money(debt.amount)}{debt.estimated ? ' aprox.' : ''}</strong></div>)}</div>
    </section>

    <footer className="pf-footer-note">Snapshot financiero inicial: 11 de agosto de 2026 · Tus proyectos Vencodex seguirán separados del dinero personal, pero los cobros podrán vincularse a la cuenta donde realmente recibiste el dinero cuando conectemos Supabase.</footer>

    {editingDebt && <BalanceEditor debt={editingDebt} onClose={() => setEditingDebt(null)} onSave={saveDebtBalance} />}
  </div>;
}

let root = null;
let host = null;
let open = false;

const ensureHost = () => {
  if (host) return host;
  host = document.createElement('div');
  host.id = 'personalFinancePortal';
  host.className = 'pf-host';
  document.body.appendChild(host);
  root = createRoot(host);
  return host;
};

const closeFinance = () => {
  if (!open) return;
  open = false;
  document.body.classList.remove('pf-open');
  if (host) host.classList.remove('visible');
  document.querySelector('.pf-nav-button')?.classList.remove('active');
};

const openFinance = () => {
  ensureHost();
  open = true;
  document.body.classList.add('pf-open');
  host.classList.add('visible');
  document.querySelector('.pf-nav-button')?.classList.add('active');
  root.render(<FinanceDashboard onClose={closeFinance} />);
};

const injectNav = () => {
  const nav = document.querySelector('.main-nav');
  if (!nav || nav.querySelector('.pf-nav-button')) return;
  const button = document.createElement('button');
  button.className = 'pf-nav-button';
  button.innerHTML = '<span class="pf-nav-icon">$</span><span>Mis finanzas</span>';
  button.addEventListener('click', openFinance);
  nav.appendChild(button);

  nav.querySelectorAll('button:not(.pf-nav-button)').forEach((item) => item.addEventListener('click', closeFinance));
  document.querySelectorAll('.project-nav button').forEach((item) => item.addEventListener('click', closeFinance));
};

const observer = new MutationObserver(() => {
  injectNav();
  if (open && host && !host.classList.contains('visible')) host.classList.add('visible');
});

const start = () => {
  injectNav();
  observer.observe(document.body, { childList: true, subtree: true });
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
