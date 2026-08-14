import React, { useMemo, useState } from 'react';

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

const prettyDate = (date) => {
  if (!date) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short' }).format(new Date(`${date}T12:00:00`));
};

const taskDeadline = (task, project) => task.dueDate || project.dueDate || '';

const deadlineMeta = (date) => {
  if (!date) return { tone: 'none', label: 'Sin fecha' };
  const days = dayDiff(date);
  if (days < 0) return { tone: 'late', label: `${Math.abs(days)} d tarde` };
  if (days === 0) return { tone: 'today', label: 'Hoy' };
  if (days === 1) return { tone: 'soon', label: 'Mañana' };
  if (days <= 3) return { tone: 'soon', label: `${days} días` };
  if (days <= 7) return { tone: 'watch', label: `${days} días` };
  return { tone: 'ok', label: prettyDate(date) };
};

const priorityLabel = { high: 'Alta', medium: 'Media', low: 'Baja' };
const statusLabel = { pending: 'Pendiente', progress: 'En desarrollo', review: 'Revisión', done: 'Terminada' };

const taskScore = (task, project) => {
  const date = taskDeadline(task, project);
  const days = dayDiff(date);
  let score = Number(task.effort || 1) * 100;
  if (days !== null && days < 0) score += 12000 + Math.abs(days) * 120;
  else if (days === 0) score += 10000;
  else if (days !== null && days <= 2) score += 8000;
  else if (days !== null && days <= 7) score += 4500 - days * 100;
  if ((task.priority || 'medium') === 'high') score += 2600;
  else if ((task.priority || 'medium') === 'medium') score += 900;
  if (task.status === 'review') score += 650;
  else if (task.status === 'progress') score += 500;
  return score;
};

function Metric({ label, value, detail, tone = 'default' }) {
  return <article className={`vx-metric vx-metric-${tone}`}>
    <span className="vx-metric-label">{label}</span>
    <strong>{value}</strong>
    <small>{detail}</small>
  </article>;
}

function TimeBadge({ date }) {
  const meta = deadlineMeta(date);
  return <span className={`vx-time vx-time-${meta.tone}`}><i />{meta.label}</span>;
}

export default function CompanyDashboard({ data, onProject, onNewProject }) {
  const [filter, setFilter] = useState('all');

  const finance = useMemo(() => {
    let contracted = 0;
    let received = 0;
    let outgoing = 0;
    let receivable = 0;
    const activeProjects = data.projects.filter((project) => project.status !== 'archived');

    activeProjects.forEach((project) => {
      const income = (project.payments || []).filter((payment) => payment.type === 'income').reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const expense = (project.payments || []).filter((payment) => payment.type === 'expense').reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      contracted += Number(project.total || 0);
      received += income;
      outgoing += expense;
      receivable += Math.max(0, Number(project.total || 0) - income);
    });

    return {
      contracted,
      received,
      outgoing,
      receivable,
      net: received - outgoing,
      projects: activeProjects.length,
    };
  }, [data]);

  const tasks = useMemo(() => data.projects.flatMap((project) => (project.tasks || [])
    .filter((task) => task.status !== 'done' && Number(task.progress || 0) < 100)
    .map((task) => ({
      ...task,
      projectId: project.id,
      projectName: project.name,
      projectDueDate: project.dueDate || '',
      effectiveDate: taskDeadline(task, project),
      score: taskScore(task, project),
    })))
    .sort((a, b) => b.score - a.score), [data]);

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    if (filter === 'urgent') {
      const days = dayDiff(task.effectiveDate);
      return (days !== null && days <= 3) || task.priority === 'high';
    }
    if (filter === 'undated') return !task.effectiveDate;
    return true;
  }), [tasks, filter]);

  const urgentCount = useMemo(() => tasks.filter((task) => {
    const days = dayDiff(task.effectiveDate);
    return (days !== null && days <= 3) || task.priority === 'high';
  }).length, [tasks]);

  const nextTask = tasks[0] || null;

  return <div className="page vx-dashboard">
    <section className="vx-hero">
      <div className="vx-hero-copy">
        <span className="vx-kicker">VENCODEX · CONTROL DE OPERACIÓN</span>
        <h2>Trabajo claro.<br/><em>Caja y entregas bajo control.</em></h2>
        <p>Una vista rápida de lo que entra, lo que sale y qué necesita tu atención primero.</p>
        <div className="vx-hero-pills">
          <span><b>{finance.projects}</b> proyectos activos</span>
          <span><b>{tasks.length}</b> tareas pendientes</span>
          <span className={urgentCount ? 'attention' : ''}><b>{urgentCount}</b> prioritarias</span>
        </div>
      </div>

      <aside className="vx-next-focus">
        <span>PRÓXIMA PRIORIDAD</span>
        {nextTask ? <>
          <h3>{nextTask.title}</h3>
          <p>{nextTask.projectName} · {priorityLabel[nextTask.priority || 'medium']}</p>
          <div className="vx-next-focus-meta">
            <TimeBadge date={nextTask.effectiveDate}/>
            <span>{nextTask.effort || 1} pts</span>
            <span>{nextTask.progress || 0}%</span>
          </div>
          <button onClick={() => onProject(nextTask.projectId)}>Abrir proyecto <span>→</span></button>
        </> : <div className="vx-all-clear"><strong>Todo al día</strong><p>No hay tareas pendientes.</p></div>}
      </aside>
    </section>

    <section className="vx-metrics-grid">
      <Metric label="Por cobrar" value={money(finance.receivable)} detail={`de ${money(finance.contracted)} contratados`} tone="blue"/>
      <Metric label="Ya ingresó" value={money(finance.received)} detail="cobros registrados" tone="positive"/>
      <Metric label="Ya salió" value={money(finance.outgoing)} detail="egresos registrados" tone="expense"/>
      <Metric label="Saldo operativo" value={money(finance.net)} detail="ingresos menos egresos" tone="navy"/>
      <Metric label="Proyectos" value={String(finance.projects)} detail={`${tasks.length} tareas abiertas`} tone="default"/>
    </section>

    <section className="vx-work-panel">
      <div className="vx-work-head">
        <div>
          <span className="vx-kicker dark">EJECUCIÓN</span>
          <h3>Tareas pendientes</h3>
          <p>Ordenadas automáticamente por fecha, prioridad, estado y complejidad.</p>
        </div>
        <div className="vx-work-actions">
          <div className="vx-filter-tabs">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todas <span>{tasks.length}</span></button>
            <button className={filter === 'urgent' ? 'active' : ''} onClick={() => setFilter('urgent')}>Prioridad <span>{urgentCount}</span></button>
            <button className={filter === 'undated' ? 'active' : ''} onClick={() => setFilter('undated')}>Sin fecha <span>{tasks.filter((task) => !task.effectiveDate).length}</span></button>
          </div>
          <button className="vx-new-project" onClick={onNewProject}>+ Proyecto</button>
        </div>
      </div>

      <div className="vx-task-list">
        {filteredTasks.slice(0, 18).map((task) => <button className="vx-task-row" key={`${task.projectId}-${task.id}`} onClick={() => onProject(task.projectId)}>
          <span className={`vx-task-priority vx-priority-${task.priority || 'medium'}`} />
          <div className="vx-task-main">
            <strong>{task.title}</strong>
            <small>{task.projectName} · {task.area || 'General'}</small>
          </div>
          <span className={`vx-status vx-status-${task.status || 'pending'}`}>{statusLabel[task.status || 'pending']}</span>
          <span className={`vx-priority-label vx-priority-label-${task.priority || 'medium'}`}>{priorityLabel[task.priority || 'medium']}</span>
          <TimeBadge date={task.effectiveDate}/>
          <span className="vx-effort">{task.effort || 1} pts</span>
          <div className="vx-row-progress"><i><b style={{ width: `${Math.max(0, Math.min(100, Number(task.progress || 0)))}%` }}/></i><span>{task.progress || 0}%</span></div>
          <span className="vx-row-arrow">→</span>
        </button>)}
        {!filteredTasks.length && <div className="vx-empty-tasks"><strong>No hay tareas en este filtro.</strong><p>Buen momento para avanzar lo que ya está en marcha.</p></div>}
      </div>
    </section>
  </div>;
}
