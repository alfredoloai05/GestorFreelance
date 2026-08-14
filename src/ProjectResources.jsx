import React, { useMemo, useState } from 'react';

const typeMeta = {
  repository: ['Repositorio', '⌘'],
  production: ['Producción', '↗'],
  staging: ['Staging', '◫'],
  database: ['Base de datos', '◉'],
  supabase: ['Supabase', 'S'],
  cloudflare: ['Cloudflare', 'C'],
  figma: ['Figma', 'F'],
  docs: ['Documentación', '≡'],
  other: ['Otro', '•'],
};

const uid = () => `resource_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

function ResourceModal({ resource, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(resource || { id: uid(), type: 'repository', label: '', url: '', username: '', secret: '', notes: '' });
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  return <div className="vx-resource-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="vx-resource-modal">
      <div className="vx-resource-modal-head"><div><span>RECURSO DEL PROYECTO</span><h3>{resource ? 'Editar acceso' : 'Guardar un acceso'}</h3><p>Ten a mano los lugares y credenciales que necesitas para trabajar.</p></div><button onClick={onClose}>×</button></div>
      <form onSubmit={(event) => { event.preventDefault(); onSave(form); }}>
        <div className="vx-resource-grid">
          <label>Tipo<select value={form.type || 'other'} onChange={(event) => set('type', event.target.value)}>{Object.entries(typeMeta).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label>Nombre<input required value={form.label || ''} onChange={(event) => set('label', event.target.value)} placeholder="Ej. Backend API"/></label>
        </div>
        <label>URL<input value={form.url || ''} onChange={(event) => set('url', event.target.value)} placeholder="https://..."/></label>
        <div className="vx-resource-grid">
          <label>Usuario<input value={form.username || ''} onChange={(event) => set('username', event.target.value)} placeholder="Usuario o correo"/></label>
          <label>Clave / token<input type="password" value={form.secret || ''} onChange={(event) => set('secret', event.target.value)} placeholder="Opcional" autoComplete="off"/></label>
        </div>
        <label>Nota<textarea rows="3" value={form.notes || ''} onChange={(event) => set('notes', event.target.value)} placeholder="Qué es, para qué sirve, detalles que no quieras olvidar..."/></label>
        <div className={`vx-resource-actions ${resource ? 'split' : ''}`}>{resource ? <button type="button" className="danger" onClick={() => onDelete(resource.id)}>Eliminar</button> : <span/>}<div><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary">Guardar</button></div></div>
      </form>
    </div>
  </div>;
}

function ResourceCard({ resource, onEdit }) {
  const [revealed, setRevealed] = useState(false);
  const [label, glyph] = typeMeta[resource.type] || typeMeta.other;
  const copy = async (value) => { if (value) await navigator.clipboard?.writeText(value); };
  return <article className="vx-resource-card">
    <div className="vx-resource-card-head"><span className={`vx-resource-icon type-${resource.type}`}>{glyph}</span><div><small>{label}</small><h4>{resource.label}</h4></div><button className="vx-resource-edit" onClick={() => onEdit(resource)}>•••</button></div>
    {resource.url && <a className="vx-resource-url" href={resource.url} target="_blank" rel="noreferrer"><span>{resource.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span><b>↗</b></a>}
    {(resource.username || resource.secret) && <div className="vx-resource-access">
      {resource.username && <div><span>Usuario</span><button onClick={() => copy(resource.username)}>{resource.username}<b>Copiar</b></button></div>}
      {resource.secret && <div><span>Clave / token</span><button onClick={() => revealed ? copy(resource.secret) : setRevealed(true)}>{revealed ? resource.secret : '••••••••••••'}<b>{revealed ? 'Copiar' : 'Ver'}</b></button></div>}
    </div>}
    {resource.notes && <p>{resource.notes}</p>}
  </article>;
}

export default function ProjectResources({ project, onChange }) {
  const [editing, setEditing] = useState(null);
  const resources = useMemo(() => project.resources || [], [project.resources]);
  const save = (resource) => {
    const exists = resources.some((item) => item.id === resource.id);
    onChange(exists ? resources.map((item) => item.id === resource.id ? resource : item) : [...resources, resource]);
    setEditing(null);
  };
  const remove = (id) => {
    if (!window.confirm('¿Eliminar este recurso o acceso?')) return;
    onChange(resources.filter((item) => item.id !== id));
    setEditing(null);
  };
  return <div className="vx-resources-page">
    <section className="vx-resources-hero"><div><span>RECURSOS DEL PROYECTO</span><h3>Todo lo que necesitas para entrar y trabajar.</h3><p>Repositorio, ambientes, base de datos, documentación y accesos en un solo lugar.</p></div><button onClick={() => setEditing({})}>+ Guardar recurso</button></section>
    <div className="vx-resource-security"><span>◎</span><p><strong>Acceso personal.</strong> Los datos se guardan bajo tu usuario de Supabase y RLS. Para secretos críticos o compartidos con equipo, más adelante conviene usar un gestor de contraseñas dedicado.</p></div>
    {resources.length ? <section className="vx-resource-grid-cards">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} onEdit={setEditing}/>)}</section> : <section className="vx-resource-empty"><span>⌘</span><h4>Todavía no guardaste recursos</h4><p>Empieza por el repositorio, producción y la base de datos de este proyecto.</p><button onClick={() => setEditing({})}>Guardar el primero</button></section>}
    {editing !== null && <ResourceModal resource={editing.id ? editing : null} onSave={save} onDelete={remove} onClose={() => setEditing(null)}/>} 
  </div>;
}
