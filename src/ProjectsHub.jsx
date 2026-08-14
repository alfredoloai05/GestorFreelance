import React, { useMemo } from 'react';

const money = (value) => new Intl.NumberFormat('es-EC', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(Number(value || 0));
const dateFmt = new Intl.DateTimeFormat('es-EC', { day:'2-digit', month:'short', year:'numeric' });
const asDate = (value) => value ? new Date(`${value}T12:00:00`) : null;

function metrics(project) {
  const tasks = project.tasks || [];
  const effort = tasks.reduce((sum, task) => sum + Number(task.effort || 1), 0);
  const weighted = tasks.reduce((sum, task) => sum + Number(task.effort || 1) * Number(task.progress || 0), 0);
  const progress = effort ? Math.round(weighted / effort) : 0;
  const received = (project.payments || []).filter((payment) => payment.type === 'income').reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const expenses = (project.payments || []).filter((payment) => payment.type === 'expense').reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const open = tasks.filter((task) => task.status !== 'done' && Number(task.progress || 0) < 100).length;
  return { progress, received, expenses, open, due: Math.max(0, Number(project.total || 0) - received) };
}

export default function ProjectsHub({ data, onProject, onNewProject }) {
  const projects = useMemo(() => [...(data.projects || [])].sort((a,b) => {
    const ad = a.dueDate || '9999-12-31';
    const bd = b.dueDate || '9999-12-31';
    return ad.localeCompare(bd) || a.name.localeCompare(b.name);
  }), [data.projects]);

  const totals = useMemo(() => projects.reduce((acc, project) => {
    const m = metrics(project);
    acc.value += Number(project.total || 0); acc.received += m.received; acc.due += m.due; acc.open += m.open;
    return acc;
  }, { value:0, received:0, due:0, open:0 }), [projects]);

  return <div className="page projects-hub-page">
    <section className="projects-hub-hero">
      <div><span className="jarvis-eyebrow">PROYECTOS · VENCODEX</span><h2>Alfredo, aquí tienes<br/><span>el mapa de lo que estás construyendo.</span></h2><p>Una vista limpia para comparar avance, fechas y caja sin mezclarlo con tu resumen diario.</p></div>
      <button className="projects-hub-create" onClick={onNewProject}>+ Crear proyecto</button>
    </section>

    <section className="projects-hub-stats">
      <article><span>Activos</span><strong>{projects.length}</strong><small>{totals.open} tareas abiertas</small></article>
      <article><span>Valor contratado</span><strong>{money(totals.value)}</strong><small>proyectos actuales</small></article>
      <article><span>Ya ingresó</span><strong>{money(totals.received)}</strong><small>cobros registrados</small></article>
      <article><span>Por cobrar</span><strong>{money(totals.due)}</strong><small>pendiente de clientes</small></article>
    </section>

    <section className="projects-hub-grid">
      {projects.map((project, index) => {
        const m = metrics(project);
        return <button key={project.id} className="projects-hub-card" onClick={() => onProject(project.id)}>
          <div className="projects-hub-card-top"><span className="projects-hub-index">{String(index + 1).padStart(2,'0')}</span><span className="projects-hub-arrow">→</span></div>
          <span className="projects-hub-client">{project.client || 'Proyecto Vencodex'}</span>
          <h3>{project.name}</h3>
          <p>{project.notes || 'Sin descripción todavía.'}</p>
          <div className="projects-hub-dates">
            <span><small>Inicio</small><b>{project.startDate ? dateFmt.format(asDate(project.startDate)) : 'Sin fecha'}</b></span>
            <span><small>Entrega</small><b>{project.dueDate ? dateFmt.format(asDate(project.dueDate)) : 'Sin fecha'}</b></span>
          </div>
          <div className="projects-hub-finance"><span><small>Por cobrar</small><b>{money(m.due)}</b></span><span><small>Pendientes</small><b>{m.open}</b></span></div>
          <div className="projects-hub-progress"><div><span>Avance</span><b>{m.progress}%</b></div><i><b style={{width:`${m.progress}%`}}/></i></div>
        </button>;
      })}
    </section>
  </div>;
}
