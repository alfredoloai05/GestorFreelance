import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './services/supabaseClient';
import './finance.css';

const SNAPSHOT_DATE = '2026-08-11';
const money = (value, decimals = 2) => new Intl.NumberFormat('es-EC', {
  style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals,
}).format(Number(value || 0));
const pct = (value) => `${Math.max(0, Math.min(100, Number(value || 0))).toFixed(0)}%`;
const normalizeText = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const sum = (items, selector = (v) => v) => items.reduce((acc, item) => acc + Number(selector(item) || 0), 0);
const accountAlias = (name) => normalizeText(name) === 'reponer' ? 'Mego' : String(name || '').trim();
const isAfterSnapshot = (date) => !!date && date > SNAPSHOT_DATE;

const currentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('Sesión no disponible');
  return user;
};

const loadFinanceData = async () => {
  const user = await currentUser();
  const ownerId = user.id;
  const [profileRes, accountsRes, recurringRes, debtsRes, transactionsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('owner_id', ownerId).maybeSingle(),
    supabase.from('accounts').select('*').eq('owner_id', ownerId).eq('active', true).order('created_at'),
    supabase.from('recurring_items').select('*').eq('owner_id', ownerId).eq('active', true).order('created_at'),
    supabase.from('debts').select('*').eq('owner_id', ownerId).order('priority', { ascending: true, nullsFirst: false }),
    supabase.from('transactions').select('*,account:accounts!transactions_account_id_fkey(name),transfer_account:accounts!transactions_transfer_account_id_fkey(name)').eq('owner_id', ownerId).order('occurred_at', { ascending: false }),
  ]);
  for (const result of [profileRes, accountsRes, recurringRes, debtsRes, transactionsRes]) if (result.error) throw result.error;

  const debts = debtsRes.data || [];
  return {
    profile: profileRes.data || { display_name: 'Alfredo', monthly_life_budget: 300, minimum_operating_fund: 100 },
    accounts: accountsRes.data || [],
    fixedIncome: (recurringRes.data || []).filter((item) => item.kind === 'income'),
    fixedExpenses: (recurringRes.data || []).filter((item) => item.kind === 'expense'),
    debts: debts.filter((debt) => debt.status === 'active' || debt.status === 'paused'),
    liquidatedDebts: debts.filter((debt) => debt.status === 'paid' || debt.status === 'closed'),
    transactions: (transactionsRes.data || []).map((tx) => ({
      id: tx.id,
      type: tx.type,
      date: String(tx.occurred_at || '').slice(0, 10),
      category: tx.category || '',
      amount: Number(tx.amount || 0),
      account: tx.account?.name || '',
      transferAccount: tx.transfer_account?.name || '',
      comment: tx.description || '',
      tags: tx.tags || '',
      fingerprint: tx.external_fingerprint || '',
    })),
  };
};

const debtProgress = (debt) => {
  const initial = Math.max(0, Number(debt.plan_start_balance ?? debt.original_balance ?? 0));
  const current = Math.max(0, Number(debt.current_balance || 0));
  if (!initial) return current <= 0 ? 100 : 0;
  return Math.max(0, Math.min(100, ((initial - current) / initial) * 100));
};
const daysTo = (date) => {
  if (!date) return null;
  const now = new Date(); now.setHours(12,0,0,0);
  const due = new Date(`${date}T12:00:00`);
  return Math.round((due - now) / 86400000);
};

function Ring({ progress, children, size = 'lg' }) {
  return <div className={`pf-ring ${size}`} style={{ '--pf-progress': `${Math.max(0, Math.min(100, progress)) * 3.6}deg` }}><div>{children}</div></div>;
}
function DebtGoal({ debt, onEdit }) {
  const progress = debtProgress(debt);
  const remaining = Math.max(0, Number(debt.current_balance || 0));
  const initial = Number(debt.plan_start_balance ?? debt.original_balance ?? 0);
  const eliminated = Math.max(0, initial - remaining);
  const days = daysTo(debt.target_date);
  const urgency = remaining <= 0 ? 'done' : debt.priority === 1 ? 'focus' : days !== null && days < 90 ? 'soon' : 'normal';
  return <article className={`pf-debt-card ${urgency}`}>
    <div className="pf-debt-top"><div className="pf-priority">#{debt.priority}</div><div className="pf-debt-title"><span>{debt.debt_type}</span><h3>{debt.name}</h3></div><Ring progress={progress} size="sm"><b>{pct(progress)}</b></Ring></div>
    <div className="pf-debt-balance"><span>Saldo pendiente{debt.estimated_balance ? ' · estimado' : ''}</span><strong>{money(remaining)}</strong></div>
    <div className="pf-progress-line"><i style={{ width: `${progress}%` }} /></div>
    <div className="pf-debt-meta"><div><span>Eliminado</span><b>{money(eliminated)}</b></div><div><span>Cuota</span><b>{Number(debt.monthly_payment) ? money(debt.monthly_payment) : 'Variable'}</b></div><div><span>Meta</span><b>{debt.target_date ? new Intl.DateTimeFormat('es-EC',{month:'short',year:'numeric'}).format(new Date(`${debt.target_date}T12:00:00`)) : 'Sin fecha'}</b></div></div>
    {debt.notes && <p className="pf-debt-note">{debt.notes}</p>}
    <button className="pf-link-btn" onClick={() => onEdit(debt)}>Actualizar saldo <span>→</span></button>
  </article>;
}
function BalanceEditor({ debt, onClose, onSave }) {
  const [value, setValue] = useState(String(debt.current_balance ?? ''));
  const [note, setNote] = useState('');
  const submit = (e) => { e.preventDefault(); const next=Number(String(value).replace(',','.')); if(Number.isFinite(next)&&next>=0) onSave(next,note); };
  return <div className="pf-modal-backdrop" onMouseDown={(e)=>e.target===e.currentTarget&&onClose()}><form className="pf-modal" onSubmit={submit}><div className="pf-modal-head"><div><span>ACTUALIZAR DEUDA</span><h3>{debt.name}</h3></div><button type="button" onClick={onClose}>×</button></div><label>Saldo actual<input autoFocus value={value} onChange={(e)=>setValue(e.target.value)} inputMode="decimal"/></label><label>Nota opcional<textarea value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Ej. saldo oficial del estado de cuenta"/></label><div className="pf-modal-actions"><button type="button" className="pf-secondary" onClick={onClose}>Cancelar</button><button className="pf-primary">Guardar saldo</button></div></form></div>;
}

const loadXlsx = () => new Promise((resolve, reject) => {
  if (window.XLSX) return resolve(window.XLSX);
  const existing = document.querySelector('script[data-pf-xlsx]');
  if (existing) { existing.addEventListener('load',()=>resolve(window.XLSX),{once:true}); existing.addEventListener('error',reject,{once:true}); return; }
  const script=document.createElement('script'); script.dataset.pfXlsx='1'; script.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; script.onload=()=>resolve(window.XLSX); script.onerror=reject; document.head.appendChild(script);
});
const excelDateToISO = (value, XLSX) => {
  if (value === '' || value == null) return '';
  if (typeof value === 'number') { const parsed=XLSX.SSF.parse_date_code(value); if(parsed)return `${parsed.y}-${String(parsed.m).padStart(2,'0')}-${String(parsed.d).padStart(2,'0')}`; }
  const parsed=new Date(value); if(!Number.isNaN(parsed.getTime()))return `${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,'0')}-${String(parsed.getDate()).padStart(2,'0')}`;
  return String(value);
};
const makeFingerprintRows = (rows, type, XLSX) => {
  const occurrence=new Map();
  return rows.slice(2).filter((row)=>row?.some((cell)=>cell!==''&&cell!=null)).map((row)=>{
    let item;
    if(type==='transfer') item={type,date:excelDateToISO(row[0],XLSX),from:String(row[1]||'').trim(),to:String(row[2]||'').trim(),amount:Number(row[3]||0),amountIn:Number(row[5]||row[3]||0),comment:String(row[7]||'').trim()};
    else item={type,date:excelDateToISO(row[0],XLSX),category:String(row[1]||'').trim(),account:String(row[2]||'').trim(),amount:Number(row[3]||0),tags:String(row[9]||'').trim(),comment:String(row[10]||'').trim()};
    const base=type==='transfer'?[type,item.date,item.from,item.to,item.amount,item.amountIn,item.comment].map(normalizeText).join('|'):[type,item.date,item.category,item.account,item.amount,item.tags,item.comment].map(normalizeText).join('|');
    const count=(occurrence.get(base)||0)+1; occurrence.set(base,count); return {...item,fingerprint:`${base}|#${count}`};
  });
};

function FinanceDashboard({ onClose }) {
  const [data,setData]=useState(null); const [loadError,setLoadError]=useState(''); const [editingDebt,setEditingDebt]=useState(null); const [importState,setImportState]=useState(null); const uploadRef=useRef(null);
  const refresh=async()=>{try{setData(await loadFinanceData());setLoadError('');}catch(error){console.error(error);setLoadError('No pude cargar tus finanzas desde Supabase.');}};
  useEffect(()=>{refresh();},[]);

  const metrics=useMemo(()=>{if(!data)return null;const activeInitial=sum(data.debts,(d)=>d.plan_start_balance??d.original_balance);const activeCurrent=sum(data.debts,(d)=>d.current_balance);const historic=sum(data.liquidatedDebts,(d)=>d.plan_start_balance??d.original_balance);const journeyTotal=activeInitial+historic;const eliminated=historic+Math.max(0,activeInitial-activeCurrent);return{activeCurrent,historic,journeyTotal,eliminated,progress:journeyTotal?(eliminated/journeyTotal)*100:100,liquid:sum(data.accounts,(a)=>a.balance),fixedIncome:sum(data.fixedIncome,(i)=>i.amount),fixedExpenses:sum(data.fixedExpenses,(i)=>i.amount),monthlyDebt:sum(data.debts,(d)=>d.monthly_payment)};},[data]);
  const monthTransactions=useMemo(()=>data?data.transactions.filter((t)=>t.date?.startsWith(SNAPSHOT_DATE.slice(0,7))):[],[data]);
  const monthExpense=sum(monthTransactions.filter((t)=>t.type==='expense'),(t)=>t.amount); const monthIncome=sum(monthTransactions.filter((t)=>t.type==='income'),(t)=>t.amount);

  const saveDebtBalance=async(balance,note)=>{try{const user=await currentUser();const status=balance<=0?'paid':'active';const {error}=await supabase.from('debts').update({current_balance:balance,estimated_balance:false,status,updated_at:new Date().toISOString()}).eq('id',editingDebt.id).eq('owner_id',user.id);if(error)throw error;const history=await supabase.from('debt_balance_history').insert({owner_id:user.id,debt_id:editingDebt.id,balance,source:'manual',note:note||null});if(history.error)throw history.error;setEditingDebt(null);await refresh();}catch(error){console.error(error);window.alert('No pude guardar el saldo en Supabase.');}};

  const importExcel=async(file)=>{
    if(!file)return;setImportState({kind:'loading',text:'Leyendo movimientos…'});
    try{
      const user=await currentUser();const XLSX=await loadXlsx();const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});const movements=[];
      [['Gastos','expense'],['Ingresos','income'],['Transferencias','transfer']].forEach(([sheetName,type])=>{const sheet=workbook.Sheets[sheetName];if(!sheet)return;const rows=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:''});movements.push(...makeFingerprintRows(rows,type,XLSX));});
      const {data:existing,error:existingError}=await supabase.from('transactions').select('external_fingerprint').eq('owner_id',user.id).not('external_fingerprint','is',null);if(existingError)throw existingError;const known=new Set((existing||[]).map((r)=>r.external_fingerprint));const fresh=movements.filter((m)=>!known.has(m.fingerprint));
      const {data:accounts,error:accountError}=await supabase.from('accounts').select('*').eq('owner_id',user.id).eq('active',true);if(accountError)throw accountError;const accountMap=new Map((accounts||[]).map((a)=>[normalizeText(a.name),a]));const resolveAccount=(name)=>accountMap.get(normalizeText(accountAlias(name)));
      const rows=fresh.map((m)=>{const from=m.type==='transfer'?resolveAccount(m.from):resolveAccount(m.account);const to=m.type==='transfer'?resolveAccount(m.to):null;return{owner_id:user.id,account_id:from?.id||null,transfer_account_id:to?.id||null,type:m.type,category:m.category||null,amount:Number(m.amount||0),occurred_at:m.date?`${m.date}T12:00:00`:new Date().toISOString(),source:'excel',external_fingerprint:m.fingerprint,description:m.comment||null,tags:m.tags||null,metadata:m.type==='transfer'?{amount_in:Number(m.amountIn||m.amount||0),from:m.from,to:m.to}:{account:m.account}};});
      if(rows.length){const inserted=await supabase.from('transactions').insert(rows);if(inserted.error)throw inserted.error;}
      const delta=new Map();const add=(id,value)=>{if(id)delta.set(id,(delta.get(id)||0)+Number(value||0));};
      fresh.filter((m)=>isAfterSnapshot(m.date)).forEach((m)=>{if(m.type==='income'){add(resolveAccount(m.account)?.id,m.amount);}else if(m.type==='expense'){add(resolveAccount(m.account)?.id,-m.amount);}else{const from=resolveAccount(m.from);const to=resolveAccount(m.to);if(from?.id!==to?.id){add(from?.id,-m.amount);add(to?.id,m.amountIn||m.amount);}}});
      for(const [id,change] of delta){const account=(accounts||[]).find((a)=>a.id===id);const result=await supabase.from('accounts').update({balance:Number(account.balance||0)+change,updated_at:new Date().toISOString()}).eq('id',id).eq('owner_id',user.id);if(result.error)throw result.error;}
      const historic=fresh.filter((m)=>!isAfterSnapshot(m.date)).length;const live=fresh.length-historic;
      const batch=await supabase.from('import_batches').insert({owner_id:user.id,file_name:file.name,total_rows:movements.length,inserted_rows:fresh.length,duplicate_rows:movements.length-fresh.length,metadata:{historic_rows:historic,live_rows:live}});if(batch.error)throw batch.error;
      setImportState({kind:'success',text:fresh.length?`${fresh.length} nuevos · ${movements.length-fresh.length} ya estaban registrados${historic?` · ${historic} históricos sin alterar saldos`:''}${live?` · ${live} afectaron saldos`:''}`:`Sin novedades · ${movements.length} movimientos ya estaban registrados`});
      await refresh();
    }catch(error){console.error(error);setImportState({kind:'error',text:'No pude importar ese archivo en Supabase. Revisa que sea el Excel exportado por tu app.'});}
    finally{if(uploadRef.current)uploadRef.current.value='';}
  };

  if(loadError)return <div className="pf-page"><header className="pf-header"><div><span className="pf-eyebrow">MIS FINANZAS · ALFREDO</span><h1>No pude cargar <em>Supabase.</em></h1><p>{loadError}</p></div><button className="pf-close" onClick={onClose}>×</button></header><button className="pf-primary" onClick={refresh}>Reintentar</button></div>;
  if(!data||!metrics)return <div className="pf-page"><header className="pf-header"><div><span className="pf-eyebrow">MIS FINANZAS · ALFREDO</span><h1>Cargando <em>tus números…</em></h1><p>Consultando tu base de datos.</p></div><button className="pf-close" onClick={onClose}>×</button></header></div>;
  const nextDebt=[...data.debts].sort((a,b)=>(a.priority||99)-(b.priority||99))[0];

  return <div className="pf-page">
    <header className="pf-header"><div><span className="pf-eyebrow">MIS FINANZAS · ALFREDO</span><h1>De deuda a <em>libertad.</em></h1><p>Un solo lugar para ver tu dinero real, tus compromisos y cuánto has avanzado.</p></div><div className="pf-header-actions"><input ref={uploadRef} hidden type="file" accept=".xlsx,.xls" onChange={(e)=>importExcel(e.target.files?.[0])}/><button className="pf-import" onClick={()=>uploadRef.current?.click()}><span>↑</span> Importar movimientos</button><button className="pf-close" onClick={onClose} aria-label="Cerrar finanzas">×</button></div></header>
    {importState&&<div className={`pf-import-state ${importState.kind}`}><span>{importState.kind==='success'?'✓':importState.kind==='error'?'!':'…'}</span>{importState.text}</div>}
    <section className="pf-hero-grid"><article className="pf-main-goal"><div className="pf-goal-copy"><span className="pf-eyebrow light">META GENERAL</span><h2>Deuda cero</h2><p>Tu recorrido incluye también las deudas que ya lograste liquidar.</p><div className="pf-big-number">{money(metrics.activeCurrent)}</div><span className="pf-caption">deuda activa restante · Codesarrollo sigue marcado como estimado</span></div><Ring progress={metrics.progress}><strong>{pct(metrics.progress)}</strong><small>del camino<br/>completado</small></Ring><div className="pf-goal-bottom"><div><span>Ya eliminaste</span><b>{money(metrics.eliminated)}</b></div><div><span>Recorrido total</span><b>{money(metrics.journeyTotal)}</b></div><div><span>Deudas cerradas</span><b>{data.liquidatedDebts.length}</b></div></div></article>
      <article className="pf-cash-card"><div className="pf-card-head"><div><span className="pf-eyebrow">HOY</span><h3>Dinero disponible</h3></div><span className="pf-soft-icon">$</span></div><strong className="pf-cash-total">{money(metrics.liquid)}</strong><p>Saldos sincronizados desde tus cuentas personales.</p><div className="pf-account-list">{data.accounts.map((account)=><div key={account.id}><span><i className={`pf-account-dot ${account.kind}`}/>{account.name}</span><b>{money(account.balance)}</b></div>)}</div></article></section>
    <section className="pf-section"><div className="pf-section-head"><div><span className="pf-eyebrow">PLAN DE LIQUIDACIÓN</span><h2>Una victoria a la vez.</h2><p>Actualiza el saldo oficial y el avance general e individual se recalcula desde Supabase.</p></div><div className="pf-order-badge">Visa → Codesarrollo → Austro → Diners</div></div><div className="pf-debt-grid">{[...data.debts].sort((a,b)=>(a.priority||99)-(b.priority||99)).map((debt)=><DebtGoal key={debt.id} debt={debt} onEdit={setEditingDebt}/>)}</div></section>
    <section className="pf-insight-grid"><article className="pf-flow-card"><div className="pf-card-head"><div><span className="pf-eyebrow">FLUJO BASE</span><h3>Tu mes antes de extras</h3></div><span className="pf-soft-icon">↕</span></div><div className="pf-flow-row positive"><span>Ingresos fijos</span><b>+{money(metrics.fixedIncome)}</b></div><div className="pf-flow-row"><span>Gastos fijos estimados</span><b>-{money(metrics.fixedExpenses)}</b></div><div className="pf-flow-row debt"><span>Cuotas de deuda conocidas</span><b>-{money(metrics.monthlyDebt)}</b></div><div className="pf-flow-separator"/><div className="pf-flow-row total"><span>Margen base antes de transporte / variables</span><b>{money(metrics.fixedIncome-metrics.fixedExpenses-metrics.monthlyDebt)}</b></div><small>Visa es variable y no está incluida como cuota fija.</small></article>
      <article className="pf-month-card"><div className="pf-card-head"><div><span className="pf-eyebrow">AGOSTO · SUPABASE</span><h3>Movimientos personales</h3></div><span className="pf-soft-icon">⌁</span></div><div className="pf-month-numbers"><div><span>Ingresos</span><b className="green">+{money(monthIncome)}</b></div><div><span>Gastos</span><b>-{money(monthExpense)}</b></div><div><span>Movimientos</span><b>{monthTransactions.length}</b></div></div><p>Puedes volver a subir el Excel. Los fingerprints guardados en la base evitan duplicados.</p><div className="pf-mini-note"><span>◎</span> Las transferencias entre tus cuentas no cuentan como ingreso ni gasto.</div></article>
      <article className="pf-next-card"><span className="pf-eyebrow">SIGUIENTE OBJETIVO</span><div className="pf-target-number">01</div><h3>{nextDebt?.name||'Sin deuda activa'}</h3><strong>{money(nextDebt?.current_balance||0)}</strong><p>{nextDebt?'Es la siguiente deuda del plan. Al llegar a cero se convierte en una victoria y la prioridad pasa automáticamente a la siguiente.':'No tienes deudas activas.'}</p></article></section>
    <section className="pf-history"><div><span className="pf-eyebrow">YA LO HAS HECHO ANTES</span><h2>Deudas liquidadas</h2></div><div className="pf-history-list">{data.liquidatedDebts.map((debt)=><div key={debt.id}><span className="pf-check">✓</span><div><b>{debt.name}</b><small>Liquidada</small></div><strong>{money(debt.plan_start_balance??debt.original_balance)}{debt.estimated_balance?' aprox.':''}</strong></div>)}</div></section>
    <footer className="pf-footer-note">Finanzas sincronizadas con Supabase · Snapshot inicial: 11 de agosto de 2026 · Los cobros de Vencodex podrán vincularse a la cuenta personal donde realmente recibas el dinero.</footer>
    {editingDebt&&<BalanceEditor debt={editingDebt} onClose={()=>setEditingDebt(null)} onSave={saveDebtBalance}/>} 
  </div>;
}

let root=null;let host=null;let open=false;
const ensureHost=()=>{if(host)return host;host=document.createElement('div');host.id='personalFinancePortal';host.className='pf-host';document.body.appendChild(host);root=createRoot(host);return host;};
const closeFinance=()=>{if(!open)return;open=false;document.body.classList.remove('pf-open');if(host)host.classList.remove('visible');document.querySelector('.pf-nav-button')?.classList.remove('active');};
const openFinance=()=>{ensureHost();open=true;document.body.classList.add('pf-open');host.classList.add('visible');document.querySelector('.pf-nav-button')?.classList.add('active');root.render(<FinanceDashboard onClose={closeFinance}/>);};
const injectNav=()=>{const nav=document.querySelector('.main-nav');if(!nav||nav.querySelector('.pf-nav-button'))return;const button=document.createElement('button');button.className='pf-nav-button';button.innerHTML='<span class="pf-nav-icon">$</span><span>Mis finanzas</span>';button.addEventListener('click',openFinance);nav.appendChild(button);nav.querySelectorAll('button:not(.pf-nav-button)').forEach((item)=>item.addEventListener('click',closeFinance));document.querySelectorAll('.project-nav button').forEach((item)=>item.addEventListener('click',closeFinance));};
const observer=new MutationObserver(()=>{injectNav();if(open&&host&&!host.classList.contains('visible'))host.classList.add('visible');});
const start=()=>{injectNav();observer.observe(document.body,{childList:true,subtree:true});};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
