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
  priority: 'medium',
  assignee: '',
  dueDate: '',
  cost: 0,
  notes: '',
}));

const riosacTasks = [
  ['Cargar inventario corte 04 de agosto', 'Cargar y validar el inventario correspondiente al corte del 04 de agosto.', 'Inventario', 5],
  ['Probar despachos', 'Ejecutar pruebas del flujo de despachos y validar resultados.', 'Pruebas', 3],
  ['Probar traspasos', 'Ejecutar pruebas del flujo de traspasos entre ubicaciones o responsables.', 'Pruebas', 3],
  ['Probar creación de cortes', 'Validar la creación de nuevos cortes y su comportamiento dentro del sistema.', 'Pruebas', 3],
  ['Probar entrega a cuadrillas', 'Validar el flujo de entrega de inventario y materiales a cuadrillas.', 'Pruebas', 3],
  ['Crear reporte de utilización de cuadrilla', 'Implementar el reporte de utilización de materiales o equipos por cuadrilla.', 'Reportes', 5],
  ['Extraer actividades suspendidas', 'Incluir la extracción de actividades suspendidas dentro del procesamiento requerido.', 'Procesamiento', 3],
  ['Compilar proyecto', 'Generar una compilación estable del proyecto con los cambios pendientes integrados.', 'Entrega', 2],
  ['Entregar nuevo ejecutable', 'Preparar y entregar la nueva versión ejecutable al cliente.', 'Entrega', 2],
  ['Crear nuevo reporte de actividades suspendidas', 'Implementar un reporte específico para consultar las actividades suspendidas.', 'Reportes', 5],
];

const vencodexTasks = [
  ['Terminar la web de Vencodex', 'Completar los ajustes y secciones pendientes del sitio web de Vencodex.', 'Web', 5],
  ['Revisar responsive de la web', 'Revisar y corregir la experiencia visual y funcional en móvil, tablet y diferentes resoluciones.', 'Web', 3],
  ['Crear Instagram de Vencodex', 'Crear y configurar la cuenta oficial de Instagram de la marca.', 'Marca', 2],
  ['Crear Facebook de Vencodex', 'Crear y configurar la página oficial de Facebook de la marca.', 'Marca', 2],
  ['Empezar publicidad de Vencodex', 'Definir las primeras piezas, canales y acciones para comenzar a promocionar la marca.', 'Marketing', 5],
];

const classesTasks = [
  ['Definir tema de las clases', 'Definir el tema, alcance y objetivos que se cubrirán durante las clases.', 'Planificación', 3],
  ['Crear diapositivas', 'Preparar las presentaciones y material visual necesario para impartir las clases.', 'Contenido', 5],
  ['Planificar cada clase', 'Organizar cada sesión con objetivos, contenidos, actividades, tiempos y material requerido.', 'Planificación', 5],
];

export const mockData = {
  version: 5,
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
    {
      id: 'project_riosac_v2',
      name: 'RIOSAC V2',
      client: 'RIOSAC',
      total: 1250,
      status: 'active',
      notes: 'Segunda etapa del sistema RIOSAC. Se muestran únicamente los pendientes actuales.',
      tasks: buildTasks(riosacTasks, 'riosac'),
      payments: [
        {
          id: 'payment_riosac_received_850',
          type: 'income',
          amount: 850,
          date: '2026-08-11',
          party: 'RIOSAC',
          taskId: '',
          note: 'Primer pago recibido del proyecto.',
        },
      ],
    },
    {
      id: 'project_vencodex',
      name: 'Vencodex',
      client: 'Proyecto personal',
      total: 0,
      status: 'active',
      notes: 'Marca y presencia digital propia de Vencodex.',
      tasks: buildTasks(vencodexTasks, 'vencodex'),
      payments: [],
    },
    {
      id: 'project_clases',
      name: 'Clases',
      client: '',
      total: 400,
      status: 'active',
      notes: 'Preparación e impartición de clases. Valor pendiente de cobro completo.',
      tasks: buildTasks(classesTasks, 'classes'),
      payments: [],
    },
  ],
};
