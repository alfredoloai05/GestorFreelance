import { supabase } from './services/supabaseClient';
import { dataService } from './services/dataService';

const normalize = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase();

const normalizeStatus = (value) => {
  const key = normalize(value).replace(/[_-]+/g, ' ');
  if (!key) return '';
  if (['pendiente', 'pending', 'por hacer', 'todo'].includes(key)) return 'pending';
  if (['en desarrollo', 'desarrollo', 'en progreso', 'progreso', 'progress', 'in progress', 'in progress'].includes(key)) return 'progress';
  if (['revision', 'revisión', 'review', 'qa', 'validacion', 'validación'].includes(key)) return 'review';
  if (['terminada', 'terminado', 'completada', 'completado', 'done', 'completed', 'finalizada', 'finalizado'].includes(key)) return 'done';
  return '';
};

const normalizePriority = (value) => {
  const key = normalize(value);
  if (!key) return '';
  if (['alta', 'high', 'urgente'].includes(key)) return 'high';
  if (['media', 'medium', 'normal'].includes(key)) return 'medium';
  if (['baja', 'low'].includes(key)) return 'low';
  return '';
};

const numeric = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const isoDate = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`Fecha inválida: ${text}. Usa YYYY-MM-DD.`);
  return text;
};

const parseLine = (line) => {
  const parts = line.split('|').map((value) => value.trim());
  if (!parts[0]) return null;
  if (['tarea', 'titulo', 'título', 'title'].includes(normalize(parts[0]))) return null;

  if (parts.length <= 5) {
    const [title, description = '', cost = '', area = '', effort = ''] = parts;
    return { mode: 'legacy', title, description, cost, area, effort };
  }

  const [title, description = '', area = '', assignee = '', status = '', priority = '', effort = '', progress = '', startDate = '', dueDate = '', cost = '', ...notesParts] = parts;
  return {
    mode: 'full',
    title,
    description,
    area,
    assignee,
    status,
    priority,
    effort,
    progress,
    startDate,
    dueDate,
    cost,
    notes: notesParts.join(' | ').trim(),
  };
};

const getCurrentProjectName = () => document.querySelector('.project-title-row h2')?.textContent?.trim() || '';

async function importFullTaskFile(file) {
  const projectName = getCurrentProjectName();
  if (!projectName) throw new Error('Abre primero el proyecto donde quieres actualizar las tareas.');

  const text = await file.text();
  const entries = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map(parseLine).filter(Boolean);
  if (!entries.length) throw new Error('El TXT no contiene tareas válidas.');

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Tu sesión de Supabase ya no está activa.');

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id,name')
    .eq('owner_id', user.id)
    .eq('name', projectName)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) throw new Error(`No encontré el proyecto ${projectName} en Supabase.`);

  const [tasksRes, collaboratorsRes, areasRes] = await Promise.all([
    supabase.from('tasks').select('*').eq('owner_id', user.id).eq('project_id', project.id),
    supabase.from('collaborators').select('id,name').eq('owner_id', user.id),
    supabase.from('project_areas').select('id,name').eq('owner_id', user.id).eq('project_id', project.id),
  ]);
  if (tasksRes.error) throw tasksRes.error;
  if (collaboratorsRes.error) throw collaboratorsRes.error;
  if (areasRes.error) throw areasRes.error;

  const requiredPeople = [...new Set(entries.filter((entry) => entry.mode === 'full' && entry.assignee).map((entry) => entry.assignee.trim()))];
  if (requiredPeople.length) {
    const { error } = await supabase.from('collaborators').upsert(
      requiredPeople.map((name) => ({ owner_id: user.id, name, active: true })),
      { onConflict: 'owner_id,name' },
    );
    if (error) throw error;
  }

  const requiredAreas = [...new Set(entries.map((entry) => entry.area?.trim()).filter(Boolean))];
  if (requiredAreas.length) {
    const { error } = await supabase.from('project_areas').upsert(
      requiredAreas.map((name, index) => ({ owner_id: user.id, project_id: project.id, name, sort_order: 900 + index })),
      { onConflict: 'project_id,name' },
    );
    if (error) throw error;
  }

  const [freshPeopleRes, freshAreasRes] = await Promise.all([
    supabase.from('collaborators').select('id,name').eq('owner_id', user.id),
    supabase.from('project_areas').select('id,name').eq('owner_id', user.id).eq('project_id', project.id),
  ]);
  if (freshPeopleRes.error) throw freshPeopleRes.error;
  if (freshAreasRes.error) throw freshAreasRes.error;

  const collaboratorId = new Map((freshPeopleRes.data || []).map((row) => [normalize(row.name), row.id]));
  const areaId = new Map((freshAreasRes.data || []).map((row) => [normalize(row.name), row.id]));

  const existing = tasksRes.data || [];
  const tasksByTitle = new Map();
  existing.forEach((task) => {
    const key = normalize(task.title);
    const list = tasksByTitle.get(key) || [];
    list.push(task);
    tasksByTitle.set(key, list);
  });

  const updates = [];
  const inserts = [];
  const unmatchedTitles = [];

  entries.forEach((entry, index) => {
    const matches = tasksByTitle.get(normalize(entry.title)) || [];
    const exact = matches.find((task) => task.title.trim() === entry.title.trim());
    const current = exact || (matches.length === 1 ? matches[0] : null);

    if (!current && matches.length > 1) {
      unmatchedTitles.push(entry.title);
      return;
    }

    if (current) {
      const legacy = entry.mode === 'legacy';
      const importedStatus = legacy ? '' : normalizeStatus(entry.status);
      const importedPriority = legacy ? '' : normalizePriority(entry.priority);
      const importedProgress = legacy ? null : numeric(entry.progress);
      const importedEffort = numeric(entry.effort);
      const importedCost = numeric(entry.cost);
      const status = importedStatus || current.status || 'pending';
      const progress = importedProgress === null ? Number(current.progress || 0) : Math.max(0, Math.min(100, Math.round(importedProgress)));

      updates.push({
        id: current.id,
        owner_id: user.id,
        project_id: project.id,
        client_key: current.client_key,
        title: current.title,
        description: legacy ? (entry.description || current.description || null) : (entry.description || null),
        area_id: entry.area ? areaId.get(normalize(entry.area)) || current.area_id || null : current.area_id || null,
        assignee_id: legacy ? current.assignee_id : (entry.assignee ? collaboratorId.get(normalize(entry.assignee)) || null : null),
        status,
        priority: importedPriority || current.priority || 'medium',
        progress: status === 'done' && importedProgress === null ? 100 : progress,
        effort: importedEffort === null ? Number(current.effort || 3) : Math.max(1, Math.round(importedEffort)),
        cost: importedCost === null ? Number(current.cost || 0) : importedCost,
        start_date: legacy ? current.start_date || null : (isoDate(entry.startDate) || null),
        target_date: legacy ? current.target_date || null : (isoDate(entry.dueDate) || null),
        notes: legacy ? current.notes || null : (entry.notes || null),
        updated_at: new Date().toISOString(),
      });
      return;
    }

    const status = entry.mode === 'full' ? (normalizeStatus(entry.status) || 'pending') : 'pending';
    const priority = entry.mode === 'full' ? (normalizePriority(entry.priority) || 'medium') : 'medium';
    const progressValue = entry.mode === 'full' ? numeric(entry.progress) : 0;
    const effortValue = numeric(entry.effort);
    const costValue = numeric(entry.cost);
    inserts.push({
      owner_id: user.id,
      project_id: project.id,
      client_key: `task_import_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
      title: entry.title,
      description: entry.description || null,
      area_id: entry.area ? areaId.get(normalize(entry.area)) || null : null,
      assignee_id: entry.mode === 'full' && entry.assignee ? collaboratorId.get(normalize(entry.assignee)) || null : null,
      status,
      priority,
      progress: status === 'done' && progressValue === null ? 100 : Math.max(0, Math.min(100, Math.round(progressValue || 0))),
      effort: Math.max(1, Math.round(effortValue || 3)),
      cost: costValue || 0,
      start_date: entry.mode === 'full' ? (isoDate(entry.startDate) || null) : null,
      target_date: entry.mode === 'full' ? (isoDate(entry.dueDate) || null) : null,
      notes: entry.mode === 'full' ? (entry.notes || null) : null,
      updated_at: new Date().toISOString(),
    });
  });

  if (unmatchedTitles.length) {
    throw new Error(`Hay títulos ambiguos y no quise tocar esas tareas: ${unmatchedTitles.slice(0, 3).join(', ')}${unmatchedTitles.length > 3 ? '…' : ''}`);
  }

  if (updates.length) {
    const { error } = await supabase.from('tasks').upsert(updates, { onConflict: 'id' });
    if (error) throw error;
  }
  if (inserts.length) {
    const { error } = await supabase.from('tasks').insert(inserts);
    if (error) throw error;
  }

  window.dispatchEvent(new CustomEvent('vencodex-sync-status', { detail: 'synced' }));
  window.alert(`TXT procesado para ${projectName}.\n\n${updates.length} tareas actualizadas\n${inserts.length} tareas nuevas\n${entries.length} líneas procesadas`);
  window.location.reload();
}

// Enriquecemos el workspace con la fecha de inicio de tareas sin alterar la capa principal.
const originalLoad = dataService.load.bind(dataService);
dataService.load = async () => {
  const workspace = await originalLoad();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return workspace;
    const { data: rows, error } = await supabase.from('tasks').select('client_key,start_date').eq('owner_id', user.id);
    if (error) throw error;
    const starts = new Map((rows || []).map((row) => [row.client_key, row.start_date || '']));
    workspace.projects.forEach((project) => project.tasks.forEach((task) => { task.startDate = starts.get(task.id) || ''; }));
  } catch (error) {
    console.warn('No pude cargar las fechas de inicio de tareas', error);
  }
  return workspace;
};

if (typeof window !== 'undefined' && window.FileReader) {
  const NativeFileReader = window.FileReader;
  class VencodexFileReader {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this.result = null;
      this._native = new NativeFileReader();
    }

    readAsText(file, encoding) {
      if (file?.name?.toLowerCase().endsWith('.txt')) {
        importFullTaskFile(file).catch((error) => {
          console.error('No se pudo importar el TXT de tareas', error);
          window.dispatchEvent(new CustomEvent('vencodex-sync-status', { detail: 'error' }));
          window.alert(`No pude procesar el TXT.\n\n${error.message || error}`);
          if (typeof this.onerror === 'function') this.onerror(error);
        });
        return;
      }
      this._native.onload = (event) => {
        this.result = this._native.result;
        if (typeof this.onload === 'function') this.onload({ ...event, target: this });
      };
      this._native.onerror = (event) => {
        if (typeof this.onerror === 'function') this.onerror(event);
      };
      this._native.readAsText(file, encoding);
    }
  }
  window.FileReader = VencodexFileReader;
}
