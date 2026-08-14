import React, { useEffect, useMemo, useRef, useState } from 'react';
import { dataService } from './services/dataService';
import CompanyDashboard from './CompanyDashboard';
import CommandPalette from './CommandPalette';
import SyncStatus from './SyncStatus';
import ProjectModalPro from './ProjectModalPro';
import { supabase } from './services/supabaseClient';

const statusMeta = {
  pending: { label: 'Pendiente', tone: 'neutral' },
  progress: { label: 'En desarrollo', tone: 'blue' },
  review: { label: 'Revisión', tone: 'amber' },
  done: { label: 'Terminada', tone: 'green' },
};

const priorityMeta = {
  high: { label: 'Alta', tone: 'amber', score: 3 },
  medium: { label: 'Media', tone: 'blue', score: 2 },
  low: { label: 'Baja', tone: 'neutral', score: 1 },
};

const money = (value) => new Intl.NumberFormat('es-EC', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(Number(value || 0));
const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const clone = (value) => structuredClone(value);
const localDayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dueDiff = (dueDate) => {
  if (!dueDate) return null;
  const today = new Date(`${localDayKey()}T12:00:00`);
  const due = new Date(`${dueDate}T12:00:00`);
  return Math.round((due - today) / 86400000);
};
const dueLabel = (dueDate) => {
  const diff = dueDiff(dueDate);
  if (diff === null) return '';
  if (diff < 0) return `Vencida hace ${Math.abs(diff)} d`;
  if (diff === 0) return 'Vence hoy';
  if (diff === 1) return 'Vence mañana';
  if (diff <= 7) return `Vence en ${diff} d`;
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${dueDate}T12:00:00`));
};
const attentionScore = (task) => {
  let score = Number(task.effort || 1);
  const diff = dueDiff(task.dueDate);
  if (diff !== null && diff < 0) score += 1200;
  else if (diff === 0) score += 1000;
  else if (diff !== null && diff <= 3) score += 750;
  if ((task.priority || 'medium') === 'high') score += 420;
  else if ((task.priority || 'medium') === 'medium') score += 180;
  if (task.status === 'review') score += 320;
  else if (task.status === 'progress') score += 260;
  return score;
};
const remainingEffort = (task) => Number(task.effort || 1) * (1 - Math.min(100, Math.max(0, Number(task.progress || 0))) / 100);
const effectiveDeadline = (taskDate, projectDate) => {
  if (!projectDate) return { date: taskDate || '', capped: false };
  if (!taskDate) return { date: projectDate, capped: false };
  if (taskDate > projectDate) return { date: projectDate, capped: true };
  return { date: taskDate, capped: false };
};
const taskRisk = (task, projectDate = '') => {
  if (task.status === 'done' || Number(task.progress || 0) >= 100) return { level: 'green', label: 'Completada', detail: 'Trabajo terminado' };
  const deadline = effectiveDeadline(task.dueDate || '', projectDate || '');
  if (!deadline.date) return { level: 'neutral', label: 'Sin fecha', detail: 'Sin fecha objetivo' };
  const days = dueDiff(deadline.date);
  const rem = Math.max(.15, remainingEffort(task));
  const pressure = rem / Math.max(.65, Number(days) + 1);
  if (days < 0) return { level: 'red', label: 'Atrasada', detail: `Venció hace ${Math.abs(days)} d` };
  if (deadline.capped) return { level: 'red', label: 'Fuera de entrega', detail: 'Supera la entrega del proyecto' };
  if (days === 0 && Number(task.progress || 0) < 90) return { level: 'red', label: 'Crítica', detail: 'Entrega hoy' };
  if (pressure >= 1.8 || (days <= 2 && rem >= 4)) return { level: 'red', label: 'En riesgo', detail: `${days} d · ${rem.toFixed(1)} pts` };
  if (pressure >= .9 || days <= 2) return { level: 'amber', label: 'Atención', detail: `${days} d · ${rem.toFixed(1)} pts` };
  return { level: 'green', label: 'En ritmo', detail: `${days} d disponibles` };
};
const projectRisk = (project) => {
  const metrics = getProjectMetrics(project);
  const open = (project.tasks || []).filter((task) => task.status !== 'done' && Number(task.progress || 0) < 100);
  if (!open.length) return { level: 'green', label: 'Completado', detail: 'Sin tareas abiertas' };
  if (!project.dueDate) return { level: 'neutral', label: 'Sin fecha', detail: 'Define fecha de entrega' };
  const days = dueDiff(project.dueDate);
  const remaining = open.reduce((sum, task) => sum + remainingEffort(task), 0);
  const pressure = remaining / Math.max(1, Number(days) + 1);
  if (days < 0 || pressure >= 3.2) return { level: 'red', label: 'En riesgo', detail: days < 0 ? `Vencido hace ${Math.abs(days)} d` : `${days} d · ${remaining.toFixed(1)} pts` };
  if (pressure >= 1.7 || days <= 5) return { level: 'amber', label: 'Atención', detail: `${days} d para entregar` };
  return { level: 'green', label: metrics.progress > 0 ? 'En ritmo' : 'Planificado', detail: `${days} d para entregar` };
};

function Icon({ name, size = 18 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    folder: <path d="M3 7.5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    wallet: <><path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6"/><path d="M16 13h2"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    arrow: <path d="M5 12h14M13 6l6 6-6 6"/>,
    dots: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    logout: <path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-6"/>,
    upload: <path d="M12 15V3m0 0 4 4m-4-4-4 4M5 21h14"/>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
    x: <path d="M6 6l12 12M18 6 6 18"/>,
    spark: <><path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></>,
  };
  return <svg className="icon" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.grid}</svg>;
}

function getProjectMetrics(project) {
  const tasks = project?.tasks || [];
  const effortTotal = tasks.reduce((sum, task) => sum + Number(task.effort || 1), 0);
  const effortDone = tasks.reduce((sum, task) => sum + Number(task.effort || 1) * Number(task.progress || 0), 0);
  const progress = effortTotal ? Math.round(effortDone / effortTotal) : 0;
  const received = (project?.payments || []).filter((p) => p.type === 'income').reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const paid = (project?.payments || []).filter((p) => p.type === 'expense').reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const taskCost = tasks.reduce((sum, task) => sum + Number(task.cost || 0), 0);
  const done = tasks.filter((task) => task.status === 'done' || Number(task.progress) === 100).length;
  return { progress, received, paid, taskCost, due: Math.max(0, Number(project?.total || 0) - received), payable: Math.max(0, taskCost - paid), done, totalTasks: tasks.length };
}

function ProgressBar({ value, compact = false }) {
  return <div className={`progress-track ${compact ? 'compact' : ''}`}><span style={{ width: `${Math.min(100, Math.max(0, Number(value || 0)))}%` }} /></div>;
}
function StatusPill({ status }) {
  const meta = statusMeta[status] || statusMeta.pending;
  return <span className={`status-pill ${meta.tone}`}><i />{meta.label}</span>;
}
function PriorityPill({ priority }) {
  const meta = priorityMeta[priority || 'medium'] || priorityMeta.medium;
  return <span className={`status-pill ${meta.tone}`}><i />{meta.label}</span>;
}
function RiskPill({ risk, compact = false }) {
  return <span className={`project-risk-badge risk-${risk.level} ${compact ? 'compact-risk' : ''}`} title={risk.detail}><span>☢</span>{risk.label}</span>;
}

function Sidebar({ data, selectedProjectId, section, onDashboard, onProject, onTeam, onNewProject, onLogout, mobileOpen, closeMobile }) {
  return <>{mobileOpen && <button className="mobile-overlay" onClick={closeMobile} aria-label="Cerrar menú"/>}<aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
    <div className="sidebar-top"><button className="brand-button" onClick={() => { onDashboard(); closeMobile(); }}><span className="brand-mark">VX</span><span><strong>Vencodex</strong><small>Tu workspace</small></span></button><button className="mobile-close" onClick={closeMobile}><Icon name="x"/></button></div>
    <nav className="main-nav"><button className={section === 'dashboard' ? 'active' : ''} onClick={() => { onDashboard(); closeMobile(); }}><Icon name="grid"/><span>Resumen</span></button><button className={section === 'team' ? 'active' : ''} onClick={() => { onTeam(); closeMobile(); }}><Icon name="users"/><span>Equipo</span></button></nav>
    <div className="sidebar-section-head"><span>PROYECTOS</span><button title="Nuevo proyecto" onClick={onNewProject}><Icon name="plus" size={16}/></button></div>
    <div className="project-nav">{data.projects.map((project) => { const metrics = getProjectMetrics(project); return <button key={project.id} className={selectedProjectId === project.id && section === 'project' ? 'active' : ''} onClick={() => { onProject(project.id); closeMobile(); }}><span className="project-dot">{project.name.slice(0,1).toUpperCase()}</span><span className="project-nav-copy"><b>{project.name}</b><small>{metrics.progress}% · {metrics.totalTasks} tareas</small></span><Icon name="chevron" size={15}/></button>; })}</div>
    <div className="sidebar-spacer"/>
    <SyncStatus/>
    <div className="sidebar-tools single"><button onClick={onLogout}><Icon name="logout" size={16}/> Cerrar sesión</button></div>
  </aside></>;
}

function Header({ title, subtitle, onMenu, onNewProject, onSearch }) {
  return <header className="app-header"><div className="header-title"><button className="menu-button" onClick={onMenu}><Icon name="menu"/></button><div><span>{subtitle}</span><h1>{title}</h1></div></div><div className="header-actions"><button className="header-search" type="button" onClick={onSearch}><Icon name="search" size={16}/><span>Buscar</span><kbd>⌘ K</kbd></button><button className="btn btn-primary" onClick={onNewProject}><Icon name="plus" size={16}/> Proyecto</button><div className="avatar">AL</div></div></header>;
}
function MetricCard({ label, value, detail, icon, tone = 'default' }) {
  return <article className={`metric-card ${tone}`}><div className="metric-icon"><Icon name={icon}/></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

function Dashboard({ data, onProject, onNewProject }) {
  const summary = useMemo(() => {
    const metrics = data.projects.map(getProjectMetrics);
    return {
      totalValue: data.projects.reduce((sum, p) => sum + Number(p.total || 0), 0),
      receivable: metrics.reduce((sum, m) => sum + m.due, 0),
      payable: metrics.reduce((sum, m) => sum + m.payable, 0),
      weighted: metrics.length ? Math.round(metrics.reduce((sum, m) => sum + m.progress, 0) / metrics.length) : 0,
    };
  }, [data]);
  const openTasks = useMemo(() => data.projects.flatMap((project) => (project.tasks || []).filter((task) => task.status !== 'done').map((task) => ({ ...task, projectName: project.name, projectId: project.id }))), [data]);
  const focusTasks = useMemo(() => [...openTasks].sort((a,b) => attentionScore(b) - attentionScore(a)).slice(0,6), [openTasks]);
  const urgentCount = useMemo(() => openTasks.filter((task) => { const diff = dueDiff(task.dueDate); return (diff !== null && diff <= 1) || (task.priority || 'medium') === 'high'; }).length, [openTasks]);
  return <div className="page dashboard-page">
    <section className="welcome-card"><div><span className="mini-label"><Icon name="spark" size={15}/> PANEL DE CONTROL</span><h2>Buenas, Alfredo.<br/><span>Esto es lo que está pasando.</span></h2><p>Tienes {data.projects.length} proyectos activos y {openTasks.length} tareas abiertas. {urgentCount ? `${urgentCount} necesitan atención prioritaria.` : 'No tienes urgencias marcadas.'}</p></div><div className="welcome-progress"><div className="ring" style={{ '--progress': `${summary.weighted * 3.6}deg` }}><span><b>{summary.weighted}%</b><small>avance global</small></span></div></div></section>
    <section className="metrics-grid"><MetricCard label="Valor en proyectos" value={money(summary.totalValue)} detail={`${data.projects.length} proyectos`} icon="folder"/><MetricCard label="Por cobrar" value={money(summary.receivable)} detail="Pendiente de clientes" icon="wallet" tone="accent"/><MetricCard label="Por pagar" value={money(summary.payable)} detail="Tareas y colaboradores" icon="users"/><MetricCard label="Avance promedio" value={`${summary.weighted}%`} detail="Ponderado por esfuerzo" icon="check"/></section>
    <section className="content-grid dashboard-grid"><div className="panel project-panel"><div className="panel-head"><div><span className="section-kicker">PORTAFOLIO</span><h3>Proyectos activos</h3></div><button className="text-action" onClick={onNewProject}>Nuevo proyecto <Icon name="plus" size={15}/></button></div><div className="project-cards">{data.projects.map((project,index) => { const m = getProjectMetrics(project); const risk = projectRisk(project); return <button key={project.id} className="project-card project-card-pro" onClick={() => onProject(project.id)}><div className="project-card-top"><span className={`project-index p${index % 4}`}>{String(index+1).padStart(2,'0')}</span><RiskPill risk={risk} compact/><Icon name="arrow"/></div><div className="project-card-copy"><span>{project.client || 'Proyecto interno'}</span><h4>{project.name}</h4><p>{project.notes || 'Sin notas todavía.'}</p></div><div className="project-card-meta"><div><span>Entrega</span><b>{project.dueDate ? dueLabel(project.dueDate) : 'Sin definir'}</b></div><div><span>Por cobrar</span><b>{money(m.due)}</b></div><div><span>Tareas</span><b>{m.done}/{m.totalTasks}</b></div></div><div className="project-card-progress"><div><span>Avance ponderado</span><strong>{m.progress}%</strong></div><ProgressBar value={m.progress} compact/></div></button>; })}</div></div>
      <aside className="panel focus-panel"><div className="panel-head"><div><span className="section-kicker">PRIORIDAD</span><h3>Lo próximo</h3></div><span className="muted-count">{focusTasks.length}</span></div><div className="focus-list">{focusTasks.map((task) => <button key={`${task.projectId}-${task.id}`} onClick={() => onProject(task.projectId)}><span className="focus-check"/><span className="focus-copy"><b>{task.title}</b><small>{task.projectName} · {priorityMeta[task.priority || 'medium'].label}{task.dueDate ? ` · ${dueLabel(task.dueDate)}` : ` · ${task.area}`}</small></span><span className="effort-badge">{task.effort}</span></button>)}</div></aside>
    </section>
  </div>;
}

function ProjectOverview({ project }) {
  const metrics = getProjectMetrics(project);
  const areas = useMemo(() => { const grouped = {}; project.tasks.forEach((task) => { const name = task.area || 'General'; if (!grouped[name]) grouped[name] = { name, tasks:0, effort:0, weighted:0, done:0 }; grouped[name].tasks++; grouped[name].effort += Number(task.effort || 1); grouped[name].weighted += Number(task.effort || 1) * Number(task.progress || 0); if (task.status === 'done') grouped[name].done++; }); return Object.values(grouped).map((a) => ({ ...a, progress:a.effort ? Math.round(a.weighted/a.effort) : 0 })).sort((a,b) => b.tasks-a.tasks); }, [project]);
  return <div className="project-overview"><section className="metrics-grid project-metrics"><MetricCard label="Valor del proyecto" value={money(project.total)} detail={project.client || 'Sin cliente definido'} icon="folder"/><MetricCard label="Recibido" value={money(metrics.received)} detail={`${money(metrics.due)} pendiente`} icon="wallet" tone="accent"/><MetricCard label="Costo asignado" value={money(metrics.taskCost)} detail={`${money(metrics.payable)} por pagar`} icon="users"/><MetricCard label="Tareas completas" value={`${metrics.done}/${metrics.totalTasks}`} detail={`${metrics.progress}% ponderado`} icon="check"/></section><section className="panel areas-panel"><div className="panel-head"><div><span className="section-kicker">DESGLOSE</span><h3>Avance por área</h3></div><span className="muted-count">{areas.length} áreas</span></div><div className="areas-grid">{areas.map((area) => <article key={area.name} className="area-card"><div className="area-head"><span>{area.name}</span><strong>{area.progress}%</strong></div><ProgressBar value={area.progress} compact/><div className="area-foot"><span>{area.done}/{area.tasks} listas</span><span>{area.effort} pts</span></div></article>)}</div></section></div>;
}

function TasksView({ project, onEditTask, onNewTask, onImport }) {
  const [query,setQuery] = useState(''); const [status,setStatus] = useState('all'); const [area,setArea] = useState('all'); const [priority,setPriority] = useState('all'); const fileRef = useRef(null);
  const areas = useMemo(() => [...new Set(project.tasks.map((task) => task.area || 'General'))].sort(), [project.tasks]);
  const filtered = useMemo(() => project.tasks.filter((task) => (!query || `${task.title} ${task.description} ${task.assignee}`.toLowerCase().includes(query.toLowerCase())) && (status === 'all' || task.status === status) && (area === 'all' || (task.area || 'General') === area) && (priority === 'all' || (task.priority || 'medium') === priority)), [project.tasks,query,status,area,priority]);
  const counts = useMemo(() => ({ all:project.tasks.length, pending:project.tasks.filter(t=>t.status==='pending').length, progress:project.tasks.filter(t=>t.status==='progress').length, review:project.tasks.filter(t=>t.status==='review').length, done:project.tasks.filter(t=>t.status==='done').length }), [project.tasks]);
  return <section className="panel task-panel"><div className="task-toolbar"><div className="status-tabs">{[['all','Todas'],['pending','Pendientes'],['progress','En desarrollo'],['review','Revisión'],['done','Terminadas']].map(([key,label]) => <button key={key} className={status===key?'active':''} onClick={() => setStatus(key)}>{label}<span>{counts[key]}</span></button>)}</div><div className="toolbar-actions"><button className="btn btn-ghost" onClick={() => fileRef.current?.click()}><Icon name="upload" size={15}/> Importar TXT</button><input ref={fileRef} hidden type="file" accept=".txt" onChange={(e) => onImport(e.target.files?.[0])}/><button className="btn btn-primary" onClick={onNewTask}><Icon name="plus" size={15}/> Tarea</button></div></div><div className="task-filters"><label className="search-box"><Icon name="search" size={16}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar tarea, descripción o responsable..."/></label><select value={area} onChange={(e)=>setArea(e.target.value)}><option value="all">Todas las áreas</option>{areas.map(a=><option key={a}>{a}</option>)}</select><select value={priority} onChange={(e)=>setPriority(e.target.value)}><option value="all">Todas las prioridades</option><option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option></select><span className="filter-result">{filtered.length} resultados</span></div><div className="task-table-wrap"><table className="task-table"><thead><tr><th>Tarea</th><th>Área</th><th>Prioridad</th><th>Responsable</th><th>Estado</th><th>Esfuerzo</th><th>Avance</th><th>Costo</th><th></th></tr></thead><tbody>{filtered.map((task)=>{const risk=taskRisk(task,project.dueDate);return <tr key={task.id} onClick={()=>onEditTask(task)}><td><div className="task-name"><span className={`task-state-dot ${task.status}`}/><span><b>{task.title}</b><small>{task.description || 'Sin descripción'}{task.dueDate ? ` · ${dueLabel(task.dueDate)}` : ''}</small></span><span className={`task-risk-dot risk-${risk.level}`} title={`${risk.label}: ${risk.detail}`}>☢</span></div></td><td><span className="area-tag">{task.area || 'General'}</span></td><td><PriorityPill priority={task.priority}/></td><td>{task.assignee ? <span className="assignee"><i>{task.assignee.slice(0,2).toUpperCase()}</i>{task.assignee}</span> : <span className="empty-value">Sin asignar</span>}</td><td><StatusPill status={task.status}/></td><td><span className="effort-badge">{task.effort || 1}</span></td><td><div className="table-progress"><ProgressBar value={task.progress} compact/><span>{task.progress || 0}%</span></div></td><td>{money(task.cost)}</td><td><button className="icon-button" onClick={(e)=>{e.stopPropagation();onEditTask(task);}}><Icon name="dots"/></button></td></tr>;})}</tbody></table>{!filtered.length && <div className="empty-state"><span><Icon name="search"/></span><h4>No encontramos tareas</h4><p>Prueba cambiando los filtros o crea una nueva tarea.</p></div>}</div></section>;
}

function PaymentsView({ project, onNewPayment, onEditPayment }) {
  const payments = [...(project.payments || [])].sort((a,b)=>String(b.date).localeCompare(String(a.date))); const metrics = getProjectMetrics(project);
  return <div className="payments-view"><section className="metrics-grid project-metrics"><MetricCard label="Ingresos registrados" value={money(metrics.received)} detail={`${money(metrics.due)} por cobrar`} icon="wallet" tone="accent"/><MetricCard label="Egresos registrados" value={money(metrics.paid)} detail={`${money(metrics.payable)} por pagar`} icon="users"/><MetricCard label="Balance actual" value={money(metrics.received-metrics.paid)} detail="Ingresos menos egresos" icon="grid"/><MetricCard label="Valor contratado" value={money(project.total)} detail={project.client || 'Proyecto'} icon="folder"/></section><section className="panel payment-panel"><div className="panel-head"><div><span className="section-kicker">MOVIMIENTOS</span><h3>Historial de pagos</h3></div><button className="btn btn-primary" onClick={onNewPayment}><Icon name="plus" size={15}/> Registrar pago</button></div>{payments.length ? <div className="payment-list">{payments.map((payment)=><div key={payment.id} className="payment-row" onClick={()=>onEditPayment(payment)} title="Editar movimiento"><span className={`payment-type ${payment.type}`}>{payment.type==='income'?'↙':'↗'}</span><div><b>{payment.party || (payment.type==='income'?'Ingreso':'Egreso')}</b><small>{[payment.date,payment.note].filter(Boolean).join(' · ') || 'Sin detalle'}</small></div><span className={`payment-amount ${payment.type==='income'?'positive':'negative'}`}>{payment.type==='income'?'+':'-'}{money(payment.amount)}</span><button className="icon-button payment-edit-button" onClick={(e)=>{e.stopPropagation();onEditPayment(payment);}} aria-label="Editar pago"><Icon name="dots"/></button></div>)}</div> : <div className="empty-state compact-empty"><span><Icon name="wallet"/></span><h4>Todavía no hay movimientos</h4><p>Registra cobros de clientes o pagos a colaboradores.</p><button className="btn btn-ghost" onClick={onNewPayment}>Registrar el primero</button></div>}</section></div>;
}

function ProjectWorkspace({ project, tab, setTab, onEditProject, onNewTask, onEditTask, onImport, onNewPayment, onEditPayment }) {
  const metrics = getProjectMetrics(project); const risk=projectRisk(project);
  return <div className="page project-page"><section className="project-hero"><div className="project-hero-main"><span className="project-breadcrumb">Proyectos <Icon name="chevron" size={13}/> {project.name}</span><div className="project-title-row"><div><span className="project-client">{project.client || 'Proyecto Vencodex'}</span><h2>{project.name}</h2><p>{project.notes || 'Sin descripción todavía.'}</p><div className="project-hero-meta"><span><b>Entrega oficial</b>{project.dueDate ? dueLabel(project.dueDate) : 'Sin definir'}</span><RiskPill risk={risk}/></div></div><button className="btn btn-ghost" onClick={onEditProject}>Editar proyecto</button></div></div><div className="project-score"><span>Avance total</span><strong>{metrics.progress}%</strong><ProgressBar value={metrics.progress}/><small>{metrics.done} de {metrics.totalTasks} tareas completadas</small></div></section><nav className="project-tabs">{[['overview','Resumen'],['tasks','Tareas'],['payments','Pagos']].map(([key,label])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}>{label}{key==='tasks'&&<span>{metrics.totalTasks}</span>}</button>)}</nav>{tab==='overview'&&<ProjectOverview project={project}/>} {tab==='tasks'&&<TasksView project={project} onEditTask={onEditTask} onNewTask={onNewTask} onImport={onImport}/>} {tab==='payments'&&<PaymentsView project={project} onNewPayment={onNewPayment} onEditPayment={onEditPayment}/>}</div>;
}

function TeamView({ data, onAdd, onRemove }) {
  return <div className="page team-page"><section className="panel team-hero"><div><span className="section-kicker">EQUIPO</span><h2>Tu equipo de trabajo.</h2><p>Aquí tienes a las personas que trabajan contigo. Asígnalas a las tareas cuando las necesites.</p></div><button className="btn btn-primary" onClick={onAdd}><Icon name="plus" size={15}/> Colaborador</button></section><section className="team-grid">{data.collaborators.map((person,index)=>{const tasks=data.projects.flatMap(p=>p.tasks).filter(t=>t.assignee===person);const open=tasks.filter(t=>t.status!=='done').length;return <article key={person} className="team-card"><div className={`team-avatar a${index%4}`}>{person.split(' ').map(v=>v[0]).slice(0,2).join('').toUpperCase()}</div><div className="team-card-copy"><h3>{person}</h3><p>{index===0?'Administrador · Vencodex':'Colaborador'}</p></div><div className="team-stats"><span><b>{tasks.length}</b> tareas</span><span><b>{open}</b> abiertas</span></div>{index!==0&&<button className="remove-link" onClick={()=>onRemove(person)}>Quitar</button>}</article>;})}</section></div>;
}

function Modal({ title, eyebrow, children, onClose, wide=false }) { return <div className="modal-backdrop" onMouseDown={(e)=>e.target===e.currentTarget&&onClose()}><div className={`modal-card ${wide?'wide':''}`}><div className="modal-head"><div><span className="section-kicker">{eyebrow}</span><h3>{title}</h3></div><button className="icon-button" onClick={onClose}><Icon name="x"/></button></div>{children}</div></div>; }
function ProjectModal({ project,onSave,onDelete,onClose }) { const [form,setForm]=useState(project?clone(project):{name:'',client:'',total:0,notes:'',status:'active',dueDate:''});const set=(k,v)=>setForm(p=>({...p,[k]:v}));return <Modal title={project?'Editar proyecto':'Nuevo proyecto'} eyebrow="PROYECTO" onClose={onClose}><form className="form-stack" onSubmit={(e)=>{e.preventDefault();onSave(form);}}><label>Nombre del proyecto<input required value={form.name} onChange={(e)=>set('name',e.target.value)} placeholder="Ej. RIOSAC"/></label><div className="form-grid"><label>Cliente<input value={form.client||''} onChange={(e)=>set('client',e.target.value)} placeholder="Nombre del cliente"/></label><label>Valor total<input type="number" min="0" step="0.01" value={form.total||0} onChange={(e)=>set('total',Number(e.target.value))}/></label></div><label>Fecha oficial de entrega<input type="date" value={form.dueDate||''} onChange={(e)=>set('dueDate',e.target.value)}/><small className="field-help">Esta fecha manda el radar y funciona como tope para las fechas internas de tareas.</small></label><label>Descripción<textarea rows="4" value={form.notes||''} onChange={(e)=>set('notes',e.target.value)} placeholder="Contexto breve del proyecto"/></label><div className={`modal-actions ${project?'split':''}`}>{project?<button type="button" className="danger-link" onClick={onDelete}>Eliminar proyecto</button>:<span/>}<div><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary">Guardar proyecto</button></div></div></form></Modal>; }
function TaskModal({ task,collaborators,onSave,onDelete,onClose }) { const [form,setForm]=useState(task?{...clone(task),priority:task.priority||'medium'}:{title:'',description:'',area:'General',status:'pending',progress:0,effort:3,priority:'medium',assignee:'',dueDate:'',cost:0,notes:''});const set=(k,v)=>setForm(p=>({...p,[k]:v}));const changeStatus=(value)=>setForm(p=>({...p,status:value,progress:value==='done'?100:p.status==='done'&&p.progress===100?0:p.progress}));return <Modal title={task?'Editar tarea':'Nueva tarea'} eyebrow="TAREA" onClose={onClose} wide><form className="form-stack" onSubmit={(e)=>{e.preventDefault();onSave(form);}}><label>Título<input required value={form.title} onChange={(e)=>set('title',e.target.value)} placeholder="¿Qué hay que hacer?"/></label><label>Descripción<textarea rows="3" value={form.description||''} onChange={(e)=>set('description',e.target.value)} placeholder="Resultado esperado o contexto"/></label><div className="form-grid three"><label>Área<input value={form.area||''} onChange={(e)=>set('area',e.target.value)} placeholder="Backend"/></label><label>Responsable<select value={form.assignee||''} onChange={(e)=>set('assignee',e.target.value)}><option value="">Sin asignar</option>{collaborators.map(p=><option key={p}>{p}</option>)}</select></label><label>Prioridad<select value={form.priority||'medium'} onChange={(e)=>set('priority',e.target.value)}><option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option></select></label></div><div className="form-grid three"><label>Estado<select value={form.status} onChange={(e)=>changeStatus(e.target.value)}>{Object.entries(statusMeta).map(([key,meta])=><option key={key} value={key}>{meta.label}</option>)}</select></label><label>Avance<select value={form.progress||0} onChange={(e)=>set('progress',Number(e.target.value))}>{[0,25,50,75,100].map(v=><option key={v} value={v}>{v}%</option>)}</select></label><label>Esfuerzo<select value={form.effort||3} onChange={(e)=>set('effort',Number(e.target.value))}>{[1,2,3,5,8].map(v=><option key={v} value={v}>{v} puntos</option>)}</select></label></div><div className="form-grid"><label>Fecha objetivo de actividad<input type="date" value={form.dueDate||''} onChange={(e)=>set('dueDate',e.target.value)}/></label><label>Costo acordado<input type="number" min="0" step="0.01" value={form.cost||0} onChange={(e)=>set('cost',Number(e.target.value))}/></label></div><label>Notas internas<textarea rows="2" value={form.notes||''} onChange={(e)=>set('notes',e.target.value)} placeholder="Bloqueos, detalles o algo que no quieras olvidar"/></label><div className="modal-actions split">{task?<button type="button" className="danger-link" onClick={onDelete}>Eliminar tarea</button>:<span/>}<div><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary">Guardar cambios</button></div></div></form></Modal>; }
function PaymentModal({ project,payment,onSave,onDelete,onClose }) { const [form,setForm]=useState(payment?clone(payment):{type:'income',amount:'',date:localDayKey(),party:'',taskId:'',note:''});const set=(k,v)=>setForm(p=>({...p,[k]:v}));return <Modal title={payment?'Editar movimiento':'Registrar movimiento'} eyebrow="FINANZAS" onClose={onClose}><form className="form-stack" onSubmit={(e)=>{e.preventDefault();onSave({...form,amount:Number(form.amount)});}}><div className="form-grid"><label>Tipo<select value={form.type} onChange={(e)=>set('type',e.target.value)}><option value="income">Me pagaron</option><option value="expense">Yo pagué</option></select></label><label>Monto<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e)=>set('amount',e.target.value)} placeholder="0.00"/></label></div><div className="form-grid"><label>Fecha<input type="date" value={form.date} onChange={(e)=>set('date',e.target.value)}/></label><label>Persona / concepto<input value={form.party} onChange={(e)=>set('party',e.target.value)} placeholder="Cliente, developer, hosting..."/></label></div>{form.type==='expense'&&<label>Relacionar con tarea<select value={form.taskId||''} onChange={(e)=>set('taskId',e.target.value)}><option value="">Sin tarea específica</option>{project.tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>}<label>Nota<textarea rows="3" value={form.note||''} onChange={(e)=>set('note',e.target.value)} placeholder="Detalle opcional"/></label><div className={`modal-actions ${payment?'split':''}`}>{payment?<button type="button" className="danger-link" onClick={onDelete}>Eliminar movimiento</button>:<span/>}<div className="payment-modal-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary">{payment?'Guardar cambios':'Registrar movimiento'}</button></div></div></form></Modal>; }
function CollaboratorModal({ onSave,onClose }) { const [name,setName]=useState('');return <Modal title="Nuevo colaborador" eyebrow="EQUIPO" onClose={onClose}><form className="form-stack" onSubmit={(e)=>{e.preventDefault();onSave(name.trim());}}><label>Nombre completo<input autoFocus required value={name} onChange={(e)=>setName(e.target.value)} placeholder="Ej. Juan Pérez"/></label><div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary">Agregar</button></div></form></Modal>; }

export default function App() {
  const [data,setData]=useState(null); const [loadError,setLoadError]=useState(''); const [section,setSection]=useState('dashboard'); const [selectedProjectId,setSelectedProjectId]=useState(null); const [projectTab,setProjectTab]=useState('overview'); const [modal,setModal]=useState(null); const [mobileOpen,setMobileOpen]=useState(false); const [searchOpen,setSearchOpen]=useState(false); const hydrated=useRef(false);
  useEffect(()=>{dataService.load().then((loaded)=>{setData(loaded);hydrated.current=true;}).catch((error)=>{console.error(error);setLoadError('No pude cargar tus datos desde Supabase.');});},[]);
  useEffect(()=>{if(hydrated.current&&data)dataService.save(data);},[data]);
  useEffect(()=>{const handler=(event)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setSearchOpen(true);}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[]);
  if(loadError)return <div className="loading-screen error-loading"><span className="brand-mark">VX</span><p>{loadError}</p><button className="btn btn-primary" onClick={()=>location.reload()}>Reintentar</button></div>;
  if(!data)return <div className="loading-screen"><span className="brand-mark">VX</span><p>Cargando desde Supabase…</p></div>;
  const selectedProject=data.projects.find((p)=>p.id===selectedProjectId)||null;
  const openDashboard=()=>{setSection('dashboard');setSelectedProjectId(null);}; const openProject=(id)=>{setSelectedProjectId(id);setSection('project');setProjectTab('overview');}; const openTaskProject=(id)=>{setSelectedProjectId(id);setSection('project');setProjectTab('tasks');}; const openTeam=()=>{setSection('team');setSelectedProjectId(null);};
  const saveProject=(form)=>{if(form.id){setData(prev=>({...prev,projects:prev.projects.map(p=>p.id===form.id?{...p,...form}:p)}));}else{const project={...form,id:uid('project'),tasks:[],payments:[]};setData(prev=>({...prev,projects:[...prev.projects,project]}));setSelectedProjectId(project.id);setSection('project');}setModal(null);};
  const deleteProject=(projectId)=>{const project=data.projects.find((item)=>item.id===projectId);if(!project||!window.confirm(`¿Eliminar ${project.name}?\n\nTambién se eliminarán sus tareas y movimientos. Esta acción no se puede deshacer.`))return;setData(prev=>({...prev,projects:prev.projects.filter(item=>item.id!==projectId)}));setModal(null);openDashboard();};
  const saveTask=(form)=>{if(!selectedProject)return;setData(prev=>({...prev,projects:prev.projects.map(project=>{if(project.id!==selectedProject.id)return project;const exists=project.tasks.some(task=>task.id===form.id);return {...project,tasks:exists?project.tasks.map(task=>task.id===form.id?form:task):[...project.tasks,{...form,id:uid('task')}]};})}));setModal(null);};
  const deleteTask=(taskId)=>{if(!selectedProject||!window.confirm('¿Eliminar esta tarea?'))return;setData(prev=>({...prev,projects:prev.projects.map(project=>project.id===selectedProject.id?{...project,tasks:project.tasks.filter(task=>task.id!==taskId)}:project)}));setModal(null);};
  const savePayment=(form)=>{if(!selectedProject)return;setData(prev=>({...prev,projects:prev.projects.map(project=>{if(project.id!==selectedProject.id)return project;const payments=project.payments||[];const exists=form.id&&payments.some(payment=>payment.id===form.id);return {...project,payments:exists?payments.map(payment=>payment.id===form.id?form:payment):[...payments,{...form,id:uid('payment')}]};})}));setModal(null);};
  const deletePayment=(paymentId)=>{if(!selectedProject||!window.confirm('¿Eliminar este movimiento? Los totales del proyecto se recalcularán automáticamente.'))return;setData(prev=>({...prev,projects:prev.projects.map(project=>project.id===selectedProject.id?{...project,payments:(project.payments||[]).filter(payment=>payment.id!==paymentId)}:project)}));setModal(null);};
  const importTasks=(file)=>{if(!file||!selectedProject)return;const reader=new FileReader();reader.onload=()=>{const tasks=String(reader.result||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map((line)=>{const [title,description='',cost='0',area='General',effort='3']=line.split('|').map(v=>v.trim());return{id:uid('task'),title,description,cost:Number(cost)||0,area:area||'General',effort:Number(effort)||3,priority:'medium',status:'pending',progress:0,assignee:'',dueDate:'',notes:''};}).filter(task=>task.title);if(!tasks.length)return;setData(prev=>({...prev,projects:prev.projects.map(project=>project.id===selectedProject.id?{...project,tasks:[...project.tasks,...tasks]}:project)}));};reader.readAsText(file);};
  const addCollaborator=(name)=>{if(!name||data.collaborators.includes(name))return;setData(prev=>({...prev,collaborators:[...prev.collaborators,name]}));setModal(null);};
  const removeCollaborator=(name)=>{if(!window.confirm(`¿Quitar a ${name} del equipo?`))return;setData(prev=>({...prev,collaborators:prev.collaborators.filter(p=>p!==name),projects:prev.projects.map(project=>({...project,tasks:project.tasks.map(task=>task.assignee===name?{...task,assignee:''}:task)}))}));};
  const headerTitle=section==='dashboard'?'Resumen':section==='team'?'Equipo':selectedProject?.name||'Proyecto'; const headerSubtitle=section==='dashboard'?'WORKSPACE':section==='team'?'PERSONAS':'PROYECTO';
  return <div className="app-shell"><Sidebar data={data} selectedProjectId={selectedProjectId} section={section} onDashboard={openDashboard} onProject={openProject} onTeam={openTeam} onNewProject={()=>setModal({type:'project'})} onLogout={()=>supabase.auth.signOut()} mobileOpen={mobileOpen} closeMobile={()=>setMobileOpen(false)}/><main className="main-area"><Header title={headerTitle} subtitle={headerSubtitle} onMenu={()=>setMobileOpen(true)} onNewProject={()=>setModal({type:'project'})} onSearch={()=>setSearchOpen(true)}/>{section==='dashboard'&&<CompanyDashboard data={data} onProject={openProject} onNewProject={()=>setModal({type:'project'})}/>} {section==='team'&&<TeamView data={data} onAdd={()=>setModal({type:'collaborator'})} onRemove={removeCollaborator}/>} {section==='project'&&selectedProject&&<ProjectWorkspace project={selectedProject} tab={projectTab} setTab={setProjectTab} onEditProject={()=>setModal({type:'project',project:selectedProject})} onNewTask={()=>setModal({type:'task'})} onEditTask={(task)=>setModal({type:'task',task})} onImport={importTasks} onNewPayment={()=>setModal({type:'payment'})} onEditPayment={(payment)=>setModal({type:'payment',payment})}/>}</main>{modal?.type==='project'&&<ProjectModalPro project={modal.project} onSave={saveProject} onDelete={()=>deleteProject(modal.project?.id)} onClose={()=>setModal(null)}/>} {modal?.type==='task'&&<TaskModal task={modal.task} collaborators={data.collaborators} onSave={saveTask} onDelete={()=>deleteTask(modal.task.id)} onClose={()=>setModal(null)}/>} {modal?.type==='payment'&&selectedProject&&<PaymentModal project={selectedProject} payment={modal.payment} onSave={savePayment} onDelete={()=>deletePayment(modal.payment?.id)} onClose={()=>setModal(null)}/>} {modal?.type==='collaborator'&&<CollaboratorModal onSave={addCollaborator} onClose={()=>setModal(null)}/>}<CommandPalette data={data} open={searchOpen} onClose={()=>setSearchOpen(false)} onProject={openProject} onTask={openTaskProject} onTeam={openTeam}/></div>;
}
