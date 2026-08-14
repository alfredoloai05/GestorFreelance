import React, { useMemo, useState } from 'react';

const money = (value) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value || 0));
const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dayDiff = (date) => {
  if (!date) return null;
  const today = new Date(`${dayKey()}T12:00:00`);
  const target = new Date(`${date}T12:00:00`);
  return Math.round((target - today) / 86400000);
};
const uid = () => `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

function buildBriefing(data) {
  const projects = (data.projects || []).filter((project) => project.status !== 'archived');
  const openTasks = projects.flatMap((project) => (project.tasks || []).filter((task) => task.status !== 'done' && Number(task.progress || 0) < 100).map((task) => ({ ...task, project })));
  const overdue = openTasks.filter((task) => { const d = dayDiff(task.dueDate || task.project.dueDate); return d !== null && d < 0; });
  const next7 = openTasks.filter((task) => { const d = dayDiff(task.dueDate || task.project.dueDate); return d !== null && d >= 0 && d <= 7; });
  const unassigned = openTasks.filter((task) => !task.assignee);
  const undated = openTasks.filter((task) => !(task.dueDate || task.project.dueDate));
  const received = projects.reduce((sum, project) => sum + (project.payments || []).filter((p) => p.type === 'income').reduce((s, p) => s + Number(p.amount || 0), 0), 0);
  const contracted = projects.reduce((sum, project) => sum + Number(project.total || 0), 0);
  const receivable = Math.max(0, contracted - received);
  const deliveries = projects.filter((project) => project.dueDate).map((project) => ({ project, days: dayDiff(project.dueDate) })).filter((item) => item.days !== null).sort((a, b) => a.days - b.days);
  const nextProject = deliveries.find((item) => item.days >= 0)?.project || deliveries[0]?.project;
  const notes = (data.inbox || []).filter((note) => note.status !== 'archived');

  const lines = [];
  if (overdue.length) lines.push({ tone: 'danger', text: `Tienes ${overdue.length} ${overdue.length === 1 ? 'tarea vencida' : 'tareas vencidas'}. Eso es lo primero que revisaría.` });
  else if (next7.length) lines.push({ tone: 'warning', text: `Esta semana tienes ${next7.length} ${next7.length === 1 ? 'tarea con fecha' : 'tareas con fecha'}. Vas con margen, pero conviene no perderlas de vista.` });
  else lines.push({ tone: 'good', text: 'No veo tareas vencidas ni entregas críticas para los próximos 7 días.' });
  if (nextProject) lines.push({ tone: 'blue', text: `${nextProject.name} es la siguiente entrega oficial${nextProject.dueDate ? `, el ${new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'long' }).format(new Date(`${nextProject.dueDate}T12:00:00`))}` : ''}.` });
  if (receivable > 0) lines.push({ tone: 'mint', text: `Vencodex tiene ${money(receivable)} pendientes de cobro entre los proyectos activos.` });
  if (unassigned.length || undated.length) lines.push({ tone: 'neutral', text: `Hay ${unassigned.length} tareas sin responsable y ${undated.length} sin una fecha útil. Son pequeños huecos de organización que podemos ir cerrando.` });
  if (notes.length) lines.push({ tone: 'neutral', text: `Tienes ${notes.length} ${notes.length === 1 ? 'nota rápida esperando decisión' : 'notas rápidas esperando decisión'} en tu Inbox.` });
  return lines.slice(0, 5);
}

export default function BriefingInbox({ data, onProject, onAdd, onArchive, onConvert }) {
  const [content, setContent] = useState('');
  const [projectId, setProjectId] = useState('');
  const briefing = useMemo(() => buildBriefing(data), [data]);
  const notes = useMemo(() => (data.inbox || []).filter((note) => note.status !== 'archived'), [data.inbox]);
  const submit = (event) => {
    event.preventDefault();
    const text = content.trim();
    if (!text) return;
    onAdd({ id: uid(), content: text, projectId, status: 'inbox', createdAt: new Date().toISOString() });
    setContent('');
  };
  const projectName = (id) => data.projects.find((project) => project.id === id)?.name || '';

  return <section className="jarvis-grid">
    <article className="jarvis-briefing">
      <div className="jarvis-head"><div><span>BRIEFING DE VENCODEX</span><h3>Alfredo, esto es lo que veo.</h3></div><span className="jarvis-pulse"><i/>EN LÍNEA</span></div>
      <div className="jarvis-lines">{briefing.map((line, index) => <div key={`${line.text}-${index}`} className={`jarvis-line ${line.tone}`}><span>{String(index + 1).padStart(2, '0')}</span><p>{line.text}</p></div>)}</div>
      <p className="jarvis-foot">No es una lista completa. Te muestro solo señales que pueden cambiar qué conviene hacer después.</p>
    </article>

    <article className="jarvis-inbox">
      <div className="jarvis-head"><div><span>INBOX RÁPIDO</span><h3>Sácalo de tu cabeza.</h3></div><b>{notes.length}</b></div>
      <form className="jarvis-capture" onSubmit={submit}>
        <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Ej. Revisar integración de pagos en Canchas..." rows="3"/>
        <div><select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Sin proyecto todavía</option>{data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><button>Guardar nota</button></div>
      </form>
      <div className="jarvis-note-list">{notes.slice(0, 5).map((note) => <div key={note.id} className="jarvis-note">
        <button className="jarvis-note-main" onClick={() => note.projectId && onProject(note.projectId)}><p>{note.content}</p><small>{note.projectId ? projectName(note.projectId) : 'Sin proyecto'}{note.createdAt ? ` · ${new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short' }).format(new Date(note.createdAt))}` : ''}</small></button>
        <div className="jarvis-note-actions">{note.projectId && <button onClick={() => onConvert(note)}>→ Tarea</button>}<button onClick={() => onArchive(note.id)}>Archivar</button></div>
      </div>)}{!notes.length && <div className="jarvis-inbox-empty">Tu Inbox está limpio. Cuando se te ocurra algo, déjalo aquí y sigue trabajando.</div>}</div>
    </article>
  </section>;
}
