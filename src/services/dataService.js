import { mockData } from '../data/mockData';
import { supabase } from './supabaseClient';

const clone = (value) => structuredClone(value);
let saveTimer = null;
let pendingSave = null;
let retryTimer = null;
const emitSyncStatus = (status) => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vencodex-sync-status', { detail: status })); };

const getUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('No hay una sesión activa de Supabase.');
  return user;
};

const fetchWorkspace = async (ownerId) => {
  const [collaboratorsRes, projectsRes, areasRes, tasksRes, paymentsRes, resourcesRes, inboxRes] = await Promise.all([
    supabase.from('collaborators').select('*').eq('owner_id', ownerId).order('created_at'),
    supabase.from('projects').select('*').eq('owner_id', ownerId).order('created_at'),
    supabase.from('project_areas').select('*').eq('owner_id', ownerId).order('sort_order'),
    supabase.from('tasks').select('*').eq('owner_id', ownerId).order('created_at'),
    supabase.from('project_payments').select('*').eq('owner_id', ownerId).order('paid_at'),
    supabase.from('project_resources').select('*').eq('owner_id', ownerId).order('created_at'),
    supabase.from('inbox_notes').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }),
  ]);

  for (const result of [collaboratorsRes, projectsRes, areasRes, tasksRes, paymentsRes, resourcesRes, inboxRes]) {
    if (result.error) throw result.error;
  }

  const collaborators = collaboratorsRes.data || [];
  const projects = projectsRes.data || [];
  const areas = areasRes.data || [];
  const tasks = tasksRes.data || [];
  const payments = paymentsRes.data || [];
  const resources = resourcesRes.data || [];
  const inbox = inboxRes.data || [];
  const collaboratorById = new Map(collaborators.map((item) => [item.id, item.name]));
  const areaById = new Map(areas.map((item) => [item.id, item.name]));
  const taskKeyById = new Map(tasks.map((item) => [item.id, item.client_key || item.id]));
  const projectKeyById = new Map(projects.map((item) => [item.id, item.client_key || item.id]));

  return {
    version: 7,
    collaborators: collaborators.map((item) => item.name),
    inbox: inbox.map((item) => ({
      id: item.client_key || item.id,
      content: item.content,
      projectId: item.project_id ? projectKeyById.get(item.project_id) || '' : '',
      status: item.status || 'inbox',
      createdAt: item.created_at || '',
    })),
    projects: projects.map((project) => ({
      id: project.client_key || project.id,
      name: project.name,
      client: project.client_name || '',
      total: Number(project.total_value || 0),
      status: project.status || 'active',
      startDate: project.start_date || '',
      notes: project.description || '',
      dueDate: project.delivery_date || '',
      resources: resources
        .filter((resource) => resource.project_id === project.id)
        .map((resource) => ({
          id: resource.client_key || resource.id,
          type: resource.resource_type || 'other',
          label: resource.label,
          url: resource.url || '',
          username: resource.username || '',
          secret: resource.secret_value || '',
          notes: resource.notes || '',
        })),
      tasks: tasks
        .filter((task) => task.project_id === project.id)
        .map((task) => ({
          id: task.client_key || task.id,
          title: task.title,
          description: task.description || '',
          area: areaById.get(task.area_id) || 'General',
          status: task.status || 'pending',
          priority: task.priority || 'medium',
          progress: Number(task.progress || 0),
          effort: Number(task.effort || 3),
          assignee: collaboratorById.get(task.assignee_id) || '',
          dueDate: task.target_date || '',
          cost: Number(task.cost || 0),
          notes: task.notes || '',
        })),
      payments: payments
        .filter((payment) => payment.project_id === project.id)
        .map((payment) => ({
          id: payment.client_key || payment.id,
          type: payment.type,
          amount: Number(payment.amount || 0),
          date: payment.paid_at ? String(payment.paid_at).slice(0, 10) : '',
          party: payment.concept || '',
          taskId: payment.task_id ? taskKeyById.get(payment.task_id) || '' : '',
          note: payment.notes || '',
        })),
    })),
  };
};

const deleteMissing = async (table, ownerId, currentKeys) => {
  const { data, error } = await supabase.from(table).select('id,client_key').eq('owner_id', ownerId);
  if (error) throw error;
  const wanted = new Set(currentKeys.filter(Boolean));
  const stale = (data || []).filter((row) => row.client_key && !wanted.has(row.client_key)).map((row) => row.id);
  if (stale.length) {
    const result = await supabase.from(table).delete().in('id', stale);
    if (result.error) throw result.error;
  }
};

const deleteMissingCollaborators = async (ownerId, names) => {
  const { data, error } = await supabase.from('collaborators').select('id,name').eq('owner_id', ownerId);
  if (error) throw error;
  const wanted = new Set(names);
  const stale = (data || []).filter((row) => !wanted.has(row.name)).map((row) => row.id);
  if (stale.length) {
    const result = await supabase.from('collaborators').delete().in('id', stale);
    if (result.error) throw result.error;
  }
};

const persistWorkspace = async (data) => {
  const user = await getUser();
  const ownerId = user.id;
  const collaborators = [...new Set((data.collaborators || []).filter(Boolean))];

  if (collaborators.length) {
    const { error } = await supabase.from('collaborators').upsert(
      collaborators.map((name) => ({ owner_id: ownerId, name, active: true })),
      { onConflict: 'owner_id,name' },
    );
    if (error) throw error;
  }
  await deleteMissingCollaborators(ownerId, collaborators);

  const { data: collaboratorRows, error: collaboratorError } = await supabase
    .from('collaborators').select('id,name').eq('owner_id', ownerId);
  if (collaboratorError) throw collaboratorError;
  const collaboratorId = new Map((collaboratorRows || []).map((row) => [row.name, row.id]));

  const projects = data.projects || [];
  if (projects.length) {
    const { error } = await supabase.from('projects').upsert(
      projects.map((project) => ({
        owner_id: ownerId,
        client_key: project.id,
        name: project.name,
        client_name: project.client || null,
        description: project.notes || null,
        total_value: Number(project.total || 0),
        status: project.status || 'active',
        start_date: project.startDate || null,
        delivery_date: project.dueDate || null,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'owner_id,client_key' },
    );
    if (error) throw error;
  }
  await deleteMissing('projects', ownerId, projects.map((project) => project.id));

  const { data: projectRows, error: projectError } = await supabase
    .from('projects').select('id,client_key').eq('owner_id', ownerId);
  if (projectError) throw projectError;
  const projectId = new Map((projectRows || []).map((row) => [row.client_key, row.id]));

  const resourceRows = [];
  for (const project of projects) {
    const dbProjectId = projectId.get(project.id);
    for (const resource of project.resources || []) {
      resourceRows.push({
        owner_id: ownerId,
        project_id: dbProjectId,
        client_key: resource.id,
        resource_type: resource.type || 'other',
        label: resource.label || 'Recurso',
        url: resource.url || null,
        username: resource.username || null,
        secret_value: resource.secret || null,
        notes: resource.notes || null,
        updated_at: new Date().toISOString(),
      });
    }
  }
  if (resourceRows.length) {
    const { error } = await supabase.from('project_resources').upsert(resourceRows, { onConflict: 'owner_id,client_key' });
    if (error) throw error;
  }
  await deleteMissing('project_resources', ownerId, resourceRows.map((resource) => resource.client_key));

  const areaRows = [];
  for (const project of projects) {
    const dbProjectId = projectId.get(project.id);
    const names = [...new Set((project.tasks || []).map((task) => task.area || 'General'))];
    names.forEach((name, index) => areaRows.push({ owner_id: ownerId, project_id: dbProjectId, name, sort_order: index }));
  }
  if (areaRows.length) {
    const { error } = await supabase.from('project_areas').upsert(areaRows, { onConflict: 'project_id,name' });
    if (error) throw error;
  }
  const { data: areaData, error: areaError } = await supabase
    .from('project_areas').select('id,project_id,name').eq('owner_id', ownerId);
  if (areaError) throw areaError;
  const areaId = new Map((areaData || []).map((row) => [`${row.project_id}::${row.name}`, row.id]));

  const taskRows = [];
  for (const project of projects) {
    const dbProjectId = projectId.get(project.id);
    for (const task of project.tasks || []) {
      taskRows.push({
        owner_id: ownerId,
        client_key: task.id,
        project_id: dbProjectId,
        area_id: areaId.get(`${dbProjectId}::${task.area || 'General'}`) || null,
        assignee_id: task.assignee ? collaboratorId.get(task.assignee) || null : null,
        title: task.title,
        description: task.description || null,
        status: task.status || 'pending',
        priority: task.priority || 'medium',
        progress: Number(task.progress || 0),
        effort: Number(task.effort || 3),
        cost: Number(task.cost || 0),
        target_date: task.dueDate || null,
        notes: task.notes || null,
        updated_at: new Date().toISOString(),
      });
    }
  }
  if (taskRows.length) {
    const { error } = await supabase.from('tasks').upsert(taskRows, { onConflict: 'owner_id,client_key' });
    if (error) throw error;
  }
  await deleteMissing('tasks', ownerId, taskRows.map((task) => task.client_key));

  const { data: taskData, error: taskError } = await supabase
    .from('tasks').select('id,client_key').eq('owner_id', ownerId);
  if (taskError) throw taskError;
  const taskId = new Map((taskData || []).map((row) => [row.client_key, row.id]));

  const paymentRows = [];
  for (const project of projects) {
    const dbProjectId = projectId.get(project.id);
    for (const payment of project.payments || []) {
      paymentRows.push({
        owner_id: ownerId,
        client_key: payment.id,
        project_id: dbProjectId,
        task_id: payment.taskId ? taskId.get(payment.taskId) || null : null,
        type: payment.type,
        amount: Number(payment.amount || 0),
        paid_at: payment.date ? `${payment.date}T12:00:00` : null,
        concept: payment.party || null,
        notes: payment.note || null,
        updated_at: new Date().toISOString(),
      });
    }
  }
  if (paymentRows.length) {
    const { error } = await supabase.from('project_payments').upsert(paymentRows, { onConflict: 'owner_id,client_key' });
    if (error) throw error;
  }
  await deleteMissing('project_payments', ownerId, paymentRows.map((payment) => payment.client_key));

  const inboxRows = (data.inbox || []).map((note) => ({
    owner_id: ownerId,
    client_key: note.id,
    project_id: note.projectId ? projectId.get(note.projectId) || null : null,
    content: note.content,
    status: note.status || 'inbox',
    updated_at: new Date().toISOString(),
  }));
  if (inboxRows.length) {
    const { error } = await supabase.from('inbox_notes').upsert(inboxRows, { onConflict: 'owner_id,client_key' });
    if (error) throw error;
  }
  await deleteMissing('inbox_notes', ownerId, inboxRows.map((note) => note.client_key));
};

const seedIfNeeded = async (ownerId) => {
  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('workspace_initialized').eq('owner_id', ownerId).maybeSingle();
  if (profileError) throw profileError;
  if (profile?.workspace_initialized) return;

  const { count, error } = await supabase
    .from('projects').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId);
  if (error) throw error;
  if (!count) await persistWorkspace({ ...clone(mockData), inbox: [] });

  const result = await supabase.from('profiles').upsert({ owner_id: ownerId, workspace_initialized: true }, { onConflict: 'owner_id' });
  if (result.error) throw result.error;
};

const performSave = async (snapshot) => {
  try {
    emitSyncStatus('saving');
    await persistWorkspace(snapshot);
    emitSyncStatus('synced');
    clearTimeout(retryTimer);
    retryTimer = null;
  } catch (error) {
    pendingSave = clone(snapshot);
    emitSyncStatus('error');
    console.error('No se pudo sincronizar el workspace con Supabase', error);
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      if (!pendingSave) return;
      const retrySnapshot = pendingSave;
      pendingSave = null;
      performSave(retrySnapshot);
    }, 5000);
  }
};

export const dataService = {
  async load() {
    const user = await getUser();
    await seedIfNeeded(user.id);
    return fetchWorkspace(user.id);
  },

  async save(data) {
    pendingSave = clone(data);
    emitSyncStatus('pending');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const snapshot = pendingSave;
      pendingSave = null;
      if (snapshot) performSave(snapshot);
    }, 650);
    return data;
  },

  provider: 'supabase',
};