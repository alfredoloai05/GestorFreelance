import React, { useMemo, useState } from 'react';

const monthFmt = new Intl.DateTimeFormat('es-EC', { month: 'long', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short' });
const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const asDate = (key) => key ? new Date(`${key}T12:00:00`) : null;
const priorityWeight = { high: 3, medium: 2, low: 1 };

function buildMonth(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const mondayIndex = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = mondayIndex; i > 0; i -= 1) cells.push(new Date(first.getFullYear(), first.getMonth(), 1 - i));
  for (let day = 1; day <= last.getDate(); day += 1) cells.push(new Date(date.getFullYear(), date.getMonth(), day));
  while (cells.length % 7) {
    const lastCell = cells[cells.length - 1];
    cells.push(new Date(lastCell.getFullYear(), lastCell.getMonth(), lastCell.getDate() + 1));
  }
  return cells;
}

function buildEvents(projects) {
  return projects.flatMap((project) => {
    const events = [];
    if (project.startDate) events.push({
      id: `start-${project.id}`,
      type: 'start',
      date: project.startDate,
      projectId: project.id,
      projectName: project.name,
      title: `Inicio · ${project.name}`,
      priority: 'medium',
    });
    if (project.dueDate) events.push({
      id: `delivery-${project.id}`,
      type: 'delivery',
      date: project.dueDate,
      projectId: project.id,
      projectName: project.name,
      title: `Entrega · ${project.name}`,
      priority: 'high',
    });
    (project.tasks || []).forEach((task) => {
      if (!task.dueDate || task.status === 'done' || Number(task.progress || 0) >= 100) return;
      events.push({
        id: `task-${project.id}-${task.id}`,
        type: 'task',
        date: task.dueDate,
        projectId: project.id,
        projectName: project.name,
        taskId: task.id,
        title: task.title,
        area: task.area || 'General',
        priority: task.priority || 'medium',
        progress: Number(task.progress || 0),
      });
    });
    return events;
  });
}

function CalendarEvent({ event, onProject, onTask }) {
  const open = () => event.type === 'task' ? onTask(event.projectId) : onProject(event.projectId);
  return <button className={`jarvis-calendar-event event-${event.type} priority-${event.priority || 'medium'}`} onClick={open} title={`${event.projectName} · ${event.title}`}>
    <span className="calendar-event-dot"/>
    <span className="calendar-event-copy"><b>{event.title}</b>{event.type === 'task' && <small>{event.projectName}</small>}</span>
  </button>;
}

export default function CalendarView({ data, onProject, onTask }) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const cells = useMemo(() => buildMonth(cursor), [cursor]);
  const events = useMemo(() => buildEvents(data.projects || []), [data.projects]);
  const grouped = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      if (!map.has(event.date)) map.set(event.date, []);
      map.get(event.date).push(event);
    });
    for (const list of map.values()) list.sort((a, b) => {
      const typeOrder = { delivery: 3, task: 2, start: 1 };
      return (typeOrder[b.type] - typeOrder[a.type]) || ((priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));
    });
    return map;
  }, [events]);

  const monthEvents = useMemo(() => events.filter((event) => {
    const date = asDate(event.date);
    return date && date.getFullYear() === cursor.getFullYear() && date.getMonth() === cursor.getMonth();
  }), [events, cursor]);
  const deliveries = monthEvents.filter((event) => event.type === 'delivery').length;
  const taskDates = monthEvents.filter((event) => event.type === 'task').length;
  const starts = monthEvents.filter((event) => event.type === 'start').length;
  const activeDays = new Set(monthEvents.map((event) => event.date)).size;
  const upcoming = [...events]
    .filter((event) => asDate(event.date) >= new Date(`${dateKey(today)}T00:00:00`))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const shiftMonth = (delta) => setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  const goToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1));

  return <div className="page jarvis-calendar-page">
    <section className="jarvis-calendar-hero">
      <div>
        <span className="jarvis-eyebrow">CALENDARIO · VENCODEX</span>
        <h2>Alfredo, aquí ves<br/><span>cuándo se mueve todo.</span></h2>
        <p>Solo te muestro fechas que importan: inicios, tareas con vencimiento y entregas oficiales.</p>
      </div>
      <div className="jarvis-calendar-brief">
        <span>ESTE MES</span>
        <strong>{deliveries ? `${deliveries} entrega${deliveries === 1 ? '' : 's'} oficial${deliveries === 1 ? '' : 'es'}` : 'Sin entregas oficiales'}</strong>
        <p>{taskDates} tareas con fecha · {starts} inicios · {activeDays} días con movimiento</p>
      </div>
    </section>

    <section className="jarvis-calendar-shell">
      <header className="calendar-toolbar">
        <div><span className="jarvis-eyebrow dark">AGENDA</span><h3>{monthFmt.format(cursor)}</h3></div>
        <div className="calendar-actions"><button onClick={() => shiftMonth(-1)} aria-label="Mes anterior">←</button><button className="today" onClick={goToday}>Hoy</button><button onClick={() => shiftMonth(1)} aria-label="Mes siguiente">→</button></div>
      </header>

      <div className="calendar-legend">
        <span className="legend-start"><i/>Inicio de proyecto</span>
        <span className="legend-task"><i/>Tarea con fecha</span>
        <span className="legend-delivery"><i/>Entrega oficial</span>
      </div>

      <div className="calendar-grid">
        {weekdays.map((day) => <div key={day} className="calendar-weekday">{day}</div>)}
        {cells.map((date) => {
          const key = dateKey(date);
          const dayEvents = grouped.get(key) || [];
          const outside = date.getMonth() !== cursor.getMonth();
          const isToday = key === dateKey(today);
          const visible = dayEvents.slice(0, 3);
          return <div key={key} className={`calendar-day ${outside ? 'outside' : ''} ${isToday ? 'is-today' : ''} ${dayEvents.some((event) => event.type === 'delivery') ? 'has-delivery' : ''}`}>
            <div className="calendar-day-number"><span>{date.getDate()}</span>{isToday && <small>HOY</small>}</div>
            <div className="calendar-day-events">
              {visible.map((event) => <CalendarEvent key={event.id} event={event} onProject={onProject} onTask={onTask}/>)}
              {dayEvents.length > visible.length && <span className="calendar-more">+{dayEvents.length - visible.length} más</span>}
            </div>
          </div>;
        })}
      </div>
    </section>

    <section className="jarvis-calendar-bottom">
      <div className="calendar-upcoming">
        <div className="calendar-section-head"><div><span className="jarvis-eyebrow dark">SIGUIENTE</span><h3>Lo próximo en el radar</h3></div></div>
        <div className="upcoming-list">{upcoming.map((event) => <button key={event.id} onClick={() => event.type === 'task' ? onTask(event.projectId) : onProject(event.projectId)}>
          <span className={`upcoming-type upcoming-${event.type}`}/>
          <div><b>{event.title}</b><small>{event.projectName}{event.area ? ` · ${event.area}` : ''}</small></div>
          <time>{shortFmt.format(asDate(event.date))}</time>
        </button>)}{!upcoming.length && <p className="calendar-empty">No tienes fechas próximas registradas.</p>}</div>
      </div>
    </section>
  </div>;
}
