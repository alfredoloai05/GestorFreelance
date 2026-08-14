import React, { useMemo } from 'react';
import BriefingInbox from './BriefingInbox';

const money = (value) => new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const localDayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dayDiff = (date) => {
  if (!date) return null;
  const today = new Date(`${localDayKey()}T12:00:00`);
  const due = new Date(`${date}T12:00:00`);
  return Math.round((due - today) / 86400000);
};
const prettyDate = (date, long = false) => {
  if (!date) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-EC', long
    ? { weekday: 'long', day: 'numeric', month: 'long' }
    : { day: '2-digit', month: 'short' }
  ).format(new Date(`${date}T12:00:00`));
};
const taskDeadline = (task, project) => task.dueDate || project.dueDate || '';
const priorityLabel = { high: 'Alta', medium: 'Media', low: 'Baja' };

const taskScore = (task, project) => {
  const date = taskDeadline(task, project);
  const days = dayDiff(date);
  let score = Number(task.effort || 1) * 90;
  if (days !== null && days < 0) score += 12000 + Math.abs(days) * 100;
  else if (days === 0) score += 10000;
  else if (days !== null && days <= 3) score += 7500;
  else if (days !== null && days <= 7) score += 4200;
  if ((task.priority || 'medium') === 'high') score += 2600;
  else if ((task.priority || 'medium') === 'medium') score += 850;
  if (task.status === 'review') score += 700;
  else if (task.status === 'progress') score += 500;
  return score;
};

function Metric({ label, value, detail, tone = 'default' }) {
  return <article className={`vx2-metric vx2-metric-${tone}`}>
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{detail}</small>
  </article>;
}

function Deadline({ date }) {
  if (!date) return <span className="vx2-deadline none"><i/>Sin fecha</span>;
  const days = dayDiff(date);
  if (days < 0) return <span className="vx2-deadline danger"><i/>Vencido · {Math.abs(days)} d</span>;
  if (days === 0) return <span className="vx2-deadline danger"><i/>Hoy</span>;
  if (days <= 3) return <span className="vx2-deadline warning"><i/>{days === 1 ? 'Mañana' : `${days} días`}</span>;
  if (days <= 7) return <span className="vx2-deadline warning"><i/>{days} días</span>;
  return <span className="vx2-deadline good"><i/>{prettyDate(date)}</span>;
}

function Insight({ icon, title, value, detail, tone = 'default', action, onClick }) {
  return <button className={`vx2-insight vx2-insight-${tone}`} onClick={onClick} disabled={!onClick}>
    <span className="vx2-insight-icon">{icon}</span>
    <span className="vx2-insight-copy"><small>{title}</small><strong>{value}</strong><p>{detail}</p></span>
    {action && <span className="vx2-insight-action">{action} →</span>}
  </button>;
}

export default function CompanyDashboard({ data, onProject, onNewProject, onAddInbox, onArchiveInbox, onConvertInbox }) {
  const activeProjects = useMemo(() => data.projects.filter((project) => project.status !== 'archived'), [data.projects]);

  const finance = useMemo(() => {
    let contracted = 0;
    let received = 0;
    let outgoing = 0;
    let receivable = 0;
    activeProjects.forEach((project) => {
      const income = (project.payments || []).filter((payment) => payment.type === 'income').reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const expense = (project.payments || []).filter((payment) => payment.type === 'expense').reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      contracted += Number(project.total || 0);
      received += income;
      outgoing += expense;
      receivable += Math.max(0, Number(project.total || 0) - income);
    });
    return { contracted, received, outgoing, receivable, net: received - outgoing };
  }, [activeProjects]);

  const openTasks = useMemo(() => activeProjects.flatMap((project) => (project.tasks || [])
    .filter((task) => task.status !== 'done' && Number(task.progress || 0) < 100)
    .map((task) => ({
      ...task,
      projectId: project.id,
      projectName: project.name,
      projectDueDate: project.dueDate || '',
      effectiveDate: taskDeadline(task, project),
      score: taskScore(task, project),
    }))), [activeProjects]);

  const overdueTasks = useMemo(() => openTasks.filter((task) => {
    const days = dayDiff(task.effectiveDate);
    return days !== null && days < 0;
  }), [openTasks]);
  const dueSoonTasks = useMemo(() => openTasks.filter((task) => {
    const days = dayDiff(task.effectiveDate);
    return days !== null && days >= 0 && days <= 7;
  }), [openTasks]);
  const undatedTasks = useMemo(() => openTasks.filter((task) => !task.effectiveDate), [openTasks]);
  const unassignedTasks = useMemo(() => openTasks.filter((task) => !task.assignee), [openTasks]);
  const projectsWithoutDate = useMemo(() => activeProjects.filter((project) => !project.dueDate), [activeProjects]);

  const receivableProjects = useMemo(() => activeProjects.map((project) => {
    const received = (project.payments || []).filter((payment) => payment.type === 'income').reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return { project, due: Math.max(0, Number(project.total || 0) - received) };
  }).filter((item) => item.due > 0).sort((a, b) => b.due - a.due), [activeProjects]);

  const upcomingProjects = useMemo(() => activeProjects
    .filter((project) => project.dueDate)
    .map((project) => ({ project, days: dayDiff(project.dueDate) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 5), [activeProjects]);

  const criticalTasks = useMemo(() => [...openTasks].sort((a, b) => b.score - a.score).slice(0, 6), [openTasks]);
  const organizationIssues = undatedTasks.length + unassignedTasks.length + projectsWithoutDate.length;
  const today = prettyDate(localDayKey(), true);

  const firstUndatedProject = projectsWithoutDate[0] || activeProjects.find((project) => (project.tasks || []).some((task) => !task.dueDate));
  const firstUnassignedProject = activeProjects.find((project) => (project.tasks || []).some((task) => task.status !== 'done' && !task.assignee));
  const firstDeliveryProject = upcomingProjects[0]?.project || null;
  const firstReceivableProject = receivableProjects[0]?.project || null;

  return <div className="page vx2-dashboard">
    <section className="vx2-hero">
      <div className="vx2-hero-copy">
        <span className="vx2-kicker">VENCODEX · TU CENTRO DE CONTROL</span>
        <h2>Hola, Alfredo.<br/><em>Esto es lo que tenemos pendiente.</em></h2>
        <p>Te resumo la operación para que sepas dónde poner tu atención sin revisar proyecto por proyecto.</p>
        <div className="vx2-hero-summary">
          <span><b>{activeProjects.length}</b> proyectos activos</span>
          <span><b>{openTasks.length}</b> tareas abiertas</span>
          <span className={organizationIssues ? 'attention' : ''}><b>{organizationIssues}</b> cosas por ordenar</span>
        </div>
      </div>
      <aside className="vx2-system-card">
        <div className="vx2-system-head"><span>ESTADO DE HOY</span><small>{today}</small></div>
        <div className="vx2-system-line"><span>Entregas</span><strong>{overdueTasks.length ? `${overdueTasks.length} vencidas` : `${dueSoonTasks.length} próximas`}</strong></div>
        <div className="vx2-system-line"><span>Organización</span><strong>{undatedTasks.length} sin fecha · {unassignedTasks.length} sin responsable</strong></div>
        <div className="vx2-system-line"><span>Caja</span><strong>{money(finance.receivable)} por cobrar</strong></div>
        <div className={`vx2-system-state ${overdueTasks.length ? 'warning' : 'good'}`}><i/>{overdueTasks.length ? 'Hay asuntos que necesitan tu atención' : 'Operación bajo control'}</div>
      </aside>
    </section>

    <section className="vx2-metrics">
      <Metric label="Te deben" value={money(finance.receivable)} detail={`${money(finance.contracted)} contratados`} tone="blue"/>
      <Metric label="Ya entró" value={money(finance.received)} detail="cobros registrados" tone="mint"/>
      <Metric label="Ya salió" value={money(finance.outgoing)} detail="egresos registrados" tone="warm"/>
      <Metric label="Queda en Vencodex" value={money(finance.net)} detail="entradas menos salidas" tone="navy"/>
      <Metric label="Proyectos activos" value={String(activeProjects.length)} detail={`${openTasks.length} tareas abiertas`} />
    </section>

    <BriefingInbox data={data} onProject={onProject} onAdd={onAddInbox} onArchive={onArchiveInbox} onConvert={onConvertInbox}/>

    <section className="vx2-section">
      <div className="vx2-section-head">
        <div><span className="vx2-kicker dark">ORGANIZACIÓN</span><h3>Lo que conviene ordenar</h3><p>Son datos incompletos o frentes que pueden hacerte perder control más adelante.</p></div>
        <button className="vx2-primary-action" onClick={onNewProject}>+ Nuevo proyecto</button>
      </div>
      <div className="vx2-insight-grid">
        <Insight icon="⌁" title="ENTREGAS" value={overdueTasks.length ? `${overdueTasks.length} vencidas` : `${dueSoonTasks.length} próximas`} detail={firstDeliveryProject ? `${firstDeliveryProject.name} · ${prettyDate(firstDeliveryProject.dueDate)}` : 'No hay entregas con fecha todavía.'} tone={overdueTasks.length ? 'danger' : 'blue'} action={firstDeliveryProject ? 'Revisar' : ''} onClick={firstDeliveryProject ? () => onProject(firstDeliveryProject.id) : undefined}/>
        <Insight icon="◷" title="SIN FECHA" value={`${projectsWithoutDate.length + undatedTasks.length}`} detail={`${projectsWithoutDate.length} proyectos · ${undatedTasks.length} tareas necesitan fecha.`} tone="neutral" action={firstUndatedProject ? 'Ordenar' : ''} onClick={firstUndatedProject ? () => onProject(firstUndatedProject.id) : undefined}/>
        <Insight icon="◎" title="SIN RESPONSABLE" value={String(unassignedTasks.length)} detail={unassignedTasks.length ? 'Tareas abiertas que todavía no tienen dueño.' : 'Todas las tareas abiertas tienen responsable.'} tone={unassignedTasks.length ? 'warning' : 'mint'} action={firstUnassignedProject ? 'Asignar' : ''} onClick={firstUnassignedProject ? () => onProject(firstUnassignedProject.id) : undefined}/>
        <Insight icon="$" title="COBROS" value={money(finance.receivable)} detail={receivableProjects.length ? `${receivableProjects.length} proyectos con saldo pendiente.` : 'No tienes cobros pendientes.'} tone="mint" action={firstReceivableProject ? 'Ver mayor saldo' : ''} onClick={firstReceivableProject ? () => onProject(firstReceivableProject.id) : undefined}/>
      </div>
    </section>

    <section className="vx2-lower-grid">
      <div className="vx2-section vx2-deliveries">
        <div className="vx2-section-head compact"><div><span className="vx2-kicker dark">AGENDA</span><h3>Próximas entregas</h3></div></div>
        <div className="vx2-delivery-list">
          {upcomingProjects.map(({ project }) => <button key={project.id} onClick={() => onProject(project.id)}>
            <span className="vx2-delivery-date"><b>{new Date(`${project.dueDate}T12:00:00`).getDate()}</b><small>{new Intl.DateTimeFormat('es-EC',{month:'short'}).format(new Date(`${project.dueDate}T12:00:00`))}</small></span>
            <span className="vx2-delivery-copy"><strong>{project.name}</strong><small>{project.client || 'Proyecto interno'}</small></span>
            <Deadline date={project.dueDate}/><span className="vx2-arrow">→</span>
          </button>)}
          {!upcomingProjects.length && <div className="vx2-empty">Todavía no has definido fechas oficiales de entrega.</div>}
        </div>
      </div>

      <div className="vx2-section vx2-critical">
        <div className="vx2-section-head compact"><div><span className="vx2-kicker dark">ATENCIÓN</span><h3>Pendientes que pesan más</h3></div><small>{criticalTasks.length} visibles</small></div>
        <div className="vx2-critical-list">
          {criticalTasks.map((task) => <button key={`${task.projectId}-${task.id}`} onClick={() => onProject(task.projectId)}>
            <span className={`vx2-priority-dot ${task.priority || 'medium'}`}/>
            <span className="vx2-critical-copy"><strong>{task.title}</strong><small>{task.projectName} · {task.area || 'General'} · {priorityLabel[task.priority || 'medium']}</small></span>
            <Deadline date={task.effectiveDate}/><span className="vx2-arrow">→</span>
          </button>)}
          {!criticalTasks.length && <div className="vx2-empty">No tienes tareas pendientes. Buen trabajo.</div>}
        </div>
      </div>
    </section>
  </div>;
}
