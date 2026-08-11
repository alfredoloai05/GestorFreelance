import { mockData } from '../data/mockData';

const STORAGE_KEY = 'gestor_freelance_v2';
const clone = (value) => JSON.parse(JSON.stringify(value));

const normalize = (data) => ({
  version: 4,
  collaborators: Array.isArray(data?.collaborators) ? data.collaborators : ['Alfredo Loaiza'],
  projects: Array.isArray(data?.projects)
    ? data.projects.map((project) => ({
        ...project,
        status: project.status || 'active',
        tasks: Array.isArray(project.tasks) ? project.tasks : [],
        payments: Array.isArray(project.payments) ? project.payments : [],
      }))
    : [],
});

const mergeSeededProjects = (savedData) => {
  const normalized = normalize(savedData);
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
  normalized.version = 4;
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
