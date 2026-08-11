import { mockData } from '../data/mockData';

const STORAGE_KEY = 'gestor_freelance_v2';
const clone = (value) => JSON.parse(JSON.stringify(value));

const normalize = (data) => ({
  version: 5,
  collaborators: Array.isArray(data?.collaborators) ? data.collaborators : ['Alfredo Loaiza'],
  projects: Array.isArray(data?.projects)
    ? data.projects.map((project) => ({
        ...project,
        status: project.status || 'active',
        tasks: Array.isArray(project.tasks)
          ? project.tasks.map((task) => ({ ...task, priority: task.priority || 'medium' }))
          : [],
        payments: Array.isArray(project.payments) ? project.payments : [],
      }))
    : [],
});

const applyKnownCorrections = (data) => {
  const normalized = normalize(data);
  normalized.projects = normalized.projects.map((project) => {
    if (project.id !== 'project_riosac_v2') return project;

    const payments = (project.payments || []).map((payment) => {
      if (payment.id === 'payment_riosac_received_1200') {
        return {
          ...payment,
          id: 'payment_riosac_received_850',
          amount: 850,
          date: '',
          note: 'Primer pago recibido del proyecto.',
        };
      }
      return payment;
    });

    return {
      ...project,
      total: Number(project.total) === 1600 ? 1250 : project.total,
      payments,
    };
  });
  normalized.version = 5;
  return normalized;
};

const mergeSeededProjects = (savedData) => {
  const normalized = applyKnownCorrections(savedData);
  const existingIds = new Set(normalized.projects.map((project) => project.id));
  const missingProjects = mockData.projects
    .filter((project) => !existingIds.has(project.id))
    .map((project) => clone(project));

  if (missingProjects.length) {
    normalized.projects.push(...missingProjects);
  }

  const collaborators = new Set(normalized.collaborators);
  mockData.collaborators.forEach((collaborator) => collaborators.add(collaborator));
  normalized.collaborators = [...collaborators];
  normalized.version = 5;
  return normalized;
};

export const dataService = {
  async load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const migrated = mergeSeededProjects(JSON.parse(saved));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    } catch (error) {
      console.warn('No se pudo leer el almacenamiento local', error);
    }

    const initial = clone(mockData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  },

  async save(data) {
    const normalized = normalize(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  },

  async reset() {
    const initial = clone(mockData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  },

  // La interfaz permanece estable. Al conectar Supabase cambiaremos
  // esta implementación sin rehacer los componentes React.
  provider: 'local',
};
