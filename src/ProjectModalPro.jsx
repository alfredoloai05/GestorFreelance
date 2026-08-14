import React, { useState } from 'react';

const money = (value) => new Intl.NumberFormat('es-EC', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(Number(value || 0));
const dateFmt = new Intl.DateTimeFormat('es-EC', { day:'2-digit', month:'short', year:'numeric' });
const formatDate = (value) => value ? dateFmt.format(new Date(`${value}T12:00:00`)) : 'Sin fecha';
const uid = () => `resource_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const resourceTypes = [
  ['repository','Repositorio'],['production','Producción'],['staging','Staging'],['database','Base de datos'],['supabase','Supabase'],['cloudflare','Cloudflare'],['figma','Figma'],['docs','Documentación'],['other','Otro'],
];

export default function ProjectModalPro({ project, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(project ? structuredClone({ ...project, resources: project.resources || [] }) : {
    name: '', client: '', total: 0, notes: '', status: 'active', startDate: '', dueDate: '', tasks: [], payments: [], resources: [],
  });
  const [showSecrets, setShowSecrets] = useState({});
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const received = (project?.payments || []).filter((payment) => payment.type === 'income').reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const openTasks = (project?.tasks || []).filter((task) => task.status !== 'done' && Number(task.progress || 0) < 100).length;
  const updateResource = (id, key, value) => setForm((current) => ({ ...current, resources: (current.resources || []).map((item) => item.id === id ? { ...item, [key]: value } : item) }));
  const addResource = () => setForm((current) => ({ ...current, resources: [...(current.resources || []), { id: uid(), type: 'repository', label: '', url: '', username: '', secret: '', notes: '' }] }));
  const removeResource = (id) => setForm((current) => ({ ...current, resources: (current.resources || []).filter((item) => item.id !== id) }));

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="project-modal-pro">
      <header className="project-modal-pro-head">
        <div className="project-modal-pro-brand">VX</div>
        <div><span>{project ? 'AJUSTEMOS EL PROYECTO' : 'NUEVO PROYECTO'}</span><h2>{project ? `Vamos a actualizar ${project.name}.` : '¿Qué vamos a construir?'}</h2><p>{project ? 'Cambia solo lo que necesites. Yo mantengo el resto sincronizado.' : 'Dame lo esencial y yo lo organizo dentro de tu workspace.'}</p></div>
        <button type="button" className="project-modal-close" onClick={onClose} aria-label="Cerrar">×</button>
      </header>

      {project && <div className="project-modal-context">
        <span><small>Valor</small><b>{money(project.total)}</b></span>
        <span><small>Ya entró</small><b>{money(received)}</b></span>
        <span><small>Pendientes</small><b>{openTasks} tareas</b></span>
        <span><small>Inicio</small><b>{formatDate(project.startDate)}</b></span>
        <span><small>Entrega</small><b>{formatDate(project.dueDate)}</b></span>
      </div>}

      <form className="project-modal-form" onSubmit={(event) => { event.preventDefault(); onSave(form); }}>
        <div className="project-form-block">
          <div className="project-form-block-title"><span>01</span><div><strong>Identidad</strong><small>Para reconocerlo rápido en tu día a día.</small></div></div>
          <label>¿Qué vamos a construir?<input autoFocus required value={form.name || ''} onChange={(event) => set('name', event.target.value)} placeholder="Ej. ReservaCancha"/></label>
          <label>¿Para quién es?<input value={form.client || ''} onChange={(event) => set('client', event.target.value)} placeholder="Cliente o proyecto interno"/></label>
        </div>

        <div className="project-form-block">
          <div className="project-form-block-title"><span>02</span><div><strong>Negocio y tiempo</strong><small>Lo que alimenta tu caja, el calendario y mis alertas.</small></div></div>
          <label>¿Cuánto vale?<div className="money-input"><span>$</span><input type="number" min="0" step="0.01" value={form.total || 0} onChange={(event) => set('total', Number(event.target.value))}/></div></label>
          <div className="project-form-two">
            <label>¿Cuándo empezamos?<input type="date" value={form.startDate || ''} onChange={(event) => set('startDate', event.target.value)}/></label>
            <label>¿Cuándo queremos entregarlo?<input type="date" value={form.dueDate || ''} onChange={(event) => set('dueDate', event.target.value)}/></label>
          </div>
        </div>

        <div className="project-form-block">
          <div className="project-form-block-title"><span>03</span><div><strong>Accesos y enlaces</strong><small>Todo lo que necesitas para entrar al proyecto sin volver a buscarlo.</small></div></div>
          <div className="project-resource-editor-head"><p>Repositorio, producción, base de datos, Supabase, Cloudflare, Figma o documentación.</p><button type="button" onClick={addResource}>+ Agregar recurso</button></div>
          <div className="project-resource-editor-list">
            {(form.resources || []).map((resource, index) => <div className="project-resource-editor" key={resource.id}>
              <div className="project-resource-editor-top"><span>{String(index + 1).padStart(2,'0')}</span><select value={resource.type || 'other'} onChange={(event) => updateResource(resource.id, 'type', event.target.value)}>{resourceTypes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><input required value={resource.label || ''} onChange={(event) => updateResource(resource.id, 'label', event.target.value)} placeholder="Nombre, ej. Backend API"/><button type="button" onClick={() => removeResource(resource.id)}>×</button></div>
              <input value={resource.url || ''} onChange={(event) => updateResource(resource.id, 'url', event.target.value)} placeholder="URL · https://..."/>
              <div className="project-resource-access-row"><input value={resource.username || ''} onChange={(event) => updateResource(resource.id, 'username', event.target.value)} placeholder="Usuario / correo"/><div className="project-resource-secret"><input type={showSecrets[resource.id] ? 'text' : 'password'} value={resource.secret || ''} onChange={(event) => updateResource(resource.id, 'secret', event.target.value)} placeholder="Clave / token" autoComplete="off"/><button type="button" onClick={() => setShowSecrets((current) => ({ ...current, [resource.id]: !current[resource.id] }))}>{showSecrets[resource.id] ? 'Ocultar' : 'Ver'}</button></div></div>
              <input value={resource.notes || ''} onChange={(event) => updateResource(resource.id, 'notes', event.target.value)} placeholder="Nota opcional: para qué sirve, ambiente, detalle..."/>
            </div>)}
            {!(form.resources || []).length && <div className="project-resource-editor-empty"><strong>No tienes recursos guardados todavía.</strong><span>Cuando vuelvas a este proyecto, agradecerás tener todo aquí.</span></div>}
          </div>
          <p className="project-resource-warning">Las claves quedan protegidas por tu sesión y RLS de Supabase, pero esta sección no sustituye un gestor de contraseñas dedicado para secretos críticos.</p>
        </div>

        <div className="project-form-block last">
          <div className="project-form-block-title"><span>04</span><div><strong>Contexto</strong><small>Una frase que te recuerde qué importa de este proyecto.</small></div></div>
          <label>¿Qué no quieres olvidar?<textarea rows="4" value={form.notes || ''} onChange={(event) => set('notes', event.target.value)} placeholder="Objetivo, alcance, condición importante, siguiente hito..."/></label>
        </div>

        <footer className={`project-modal-footer ${project ? 'has-delete' : ''}`}>
          {project ? <button type="button" className="project-delete" onClick={onDelete}>Eliminar proyecto</button> : <span/>}
          <div><button type="button" className="project-cancel" onClick={onClose}>Cancelar</button><button className="project-save">{project ? 'Guardar cambios' : 'Crear proyecto'} <span>→</span></button></div>
        </footer>
      </form>
    </section>
  </div>;
}
