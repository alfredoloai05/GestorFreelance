import '../../data/can_1.js';
import '../../data/can_2.js';
import '../../data/can_3.js';
import '../../data/can_4.js';
import '../../data/can_5.js';
import '../../data/can_6.js';
import '../../data/can_7.js';
import '../../data/can_8.js';
import '../../data/ind_1.js';
import '../../data/ind_2.js';

const buildTasks = (rows, prefix) => rows.map((row, index) => ({
  id: `${prefix}_${index + 1}`,
  title: row[0],
  description: row[1],
  area: row[2] || 'General',
  status: 'pending',
  progress: 0,
  effort: row[3] || 3,
  assignee: '',
  dueDate: '',
  cost: 0,
  notes: '',
}));

export const mockData = {
  version: 3,
  collaborators: ['Alfredo Loaiza'],
  projects: [
    {
      id: 'project_canchas',
      name: 'Canchas',
      client: '',
      total: 4600,
      status: 'active',
      notes: 'Plataforma de reservas. Proyecto precargado para organizar el desarrollo completo.',
      tasks: buildTasks(window.RAW_CAN || [], 'can'),
      payments: [],
    },
    {
      id: 'project_indian',
      name: 'INDIAN',
      client: 'Indian House',
      total: 900,
      status: 'active',
      notes: 'Web y experiencia digital de Indian.',
      tasks: buildTasks(window.RAW_IND || [], 'ind'),
      payments: [],
    },
  ],
};
