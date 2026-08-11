import { mockData } from '../data/mockData';

const STORAGE_KEY = 'gestor_freelance_v2';
const clone = (value) => JSON.parse(JSON.stringify(value));

const normalize = (data) => ({
  version: 3,
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

export const dataService = {
  async load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return normalize(JSON.parse(saved));
    } catch (error) {
      console.warn('No se pudo leer el almacenamiento local', error);
    }
    const initial = clone(mockData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  },

  async save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
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
