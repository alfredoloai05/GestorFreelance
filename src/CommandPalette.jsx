import React, { useEffect, useMemo, useRef, useState } from 'react';

export default function CommandPalette({ data, open, onClose, onProject, onTask, onTeam }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(timer);
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const items = [];
    for (const project of data.projects || []) {
      if (`${project.name} ${project.client || ''} ${project.notes || ''}`.toLowerCase().includes(q)) {
        items.push({ type: 'project', id: project.id, title: project.name, meta: project.client || 'Proyecto interno', projectId: project.id });
      }
      for (const task of project.tasks || []) {
        if (`${task.title} ${task.description || ''} ${task.area || ''} ${task.assignee || ''}`.toLowerCase().includes(q)) {
          items.push({ type: 'task', id: task.id, title: task.title, meta: `${project.name} · ${task.area || 'General'}`, projectId: project.id });
        }
      }
    }
    for (const person of data.collaborators || []) {
      if (person.toLowerCase().includes(q)) items.push({ type: 'person', id: person, title: person, meta: 'Equipo Vencodex' });
    }
    return items.slice(0, 18);
  }, [data, query]);

  useEffect(() => { if (activeIndex >= results.length) setActiveIndex(0); }, [results, activeIndex]);

  useEffect(() => {
    if (!open) return;
    const handler = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((v) => results.length ? (v + 1) % results.length : 0); }
      if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((v) => results.length ? (v - 1 + results.length) % results.length : 0); }
      if (event.key === 'Enter' && results[activeIndex]) { event.preventDefault(); openResult(results[activeIndex]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, results, activeIndex]);

  const openResult = (item) => {
    onClose();
    if (item.type === 'project') onProject(item.projectId);
    else if (item.type === 'task') onTask(item.projectId);
    else onTeam();
  };

  if (!open) return null;
  const typeIcon = { project: 'P', task: 'T', person: 'E' };
  const typeName = { project: 'Proyecto', task: 'Tarea', person: 'Equipo' };

  return <div className="command-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section className="command-card">
      <div className="command-input"><span>⌕</span><input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }} placeholder="Busca proyectos, tareas o personas..."/><kbd>ESC</kbd></div>
      <div className="command-results">
        {!query.trim() && <div className="command-empty">Escribe algo. Aquí sí buscamos de verdad en todo tu workspace.</div>}
        {query.trim() && !results.length && <div className="command-empty">No encontré nada con “{query}”.</div>}
        {!!results.length && <>
          <div className="command-group-label">RESULTADOS</div>
          {results.map((item, index) => <button key={`${item.type}-${item.id}`} className={`command-result ${index === activeIndex ? 'active' : ''}`} onMouseEnter={() => setActiveIndex(index)} onClick={() => openResult(item)}>
            <span className="command-type">{typeIcon[item.type]}</span>
            <span className="command-result-copy"><strong>{item.title}</strong><small>{typeName[item.type]} · {item.meta}</small></span>
            <span>→</span>
          </button>)}
        </>}
      </div>
    </section>
  </div>;
}
