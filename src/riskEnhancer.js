const DATA_KEY = 'gestor_freelance_v2';
const META_KEY = 'gestor_freelance_risk_meta_v1';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const dayDiff = (date) => {
  if (!date) return null;
  const from = new Date(`${todayKey()}T12:00:00`);
  const to = new Date(`${date}T12:00:00`);
  return Math.round((to - from) / 86400000);
};

const readData = () => {
  try {
    return JSON.parse(localStorage.getItem(DATA_KEY) || '{"projects":[]}');
  } catch {
    return { projects: [] };
  }
};

const readMeta = () => {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || '{"projectDeadlines":{}}');
  } catch {
    return { projectDeadlines: {} };
  }
};

const writeMeta = (meta) => localStorage.setItem(META_KEY, JSON.stringify(meta));

const syncDeadlineIntoData = (projectId, dueDate) => {
  const data = readData();
  if (!Array.isArray(data.projects)) return;
  data.projects = data.projects.map((project) => project.id === projectId ? { ...project, dueDate } : project);
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
};

const seedMetaFromData = () => {
  const data = readData();
  const meta = readMeta();
  let changed = false;
  for (const project of data.projects || []) {
    if (project.dueDate && !meta.projectDeadlines?.[project.id]) {
      meta.projectDeadlines = meta.projectDeadlines || {};
      meta.projectDeadlines[project.id] = project.dueDate;
      changed = true;
    }
  }
  if (changed) writeMeta(meta);
};

const remainingEffort = (task) => Number(task.effort || 1) * (1 - clamp(Number(task.progress || 0), 0, 100) / 100);

const taskRisk = (task, inheritedDeadline = '') => {
  if (task.status === 'done' || Number(task.progress || 0) >= 100) {
    return { level: 'green', label: 'Completada', detail: 'Trabajo terminado', score: 0 };
  }

  const dueDate = task.dueDate || inheritedDeadline || '';
  if (!dueDate) {
    return { level: 'neutral', label: 'Sin fecha', detail: 'Define una fecha para calcular riesgo', score: 1 };
  }

  const days = dayDiff(dueDate);
  const availableDays = Math.max(0.65, Number(days) + 1);
  const rem = Math.max(0.15, remainingEffort(task));
  const priorityFactor = task.priority === 'high' ? 1.18 : task.priority === 'low' ? 0.9 : 1;
  const stateFactor = task.status === 'review' ? 0.72 : task.status === 'progress' ? 0.88 : 1;
  const pressure = (rem * priorityFactor * stateFactor) / availableDays;

  if (days < 0) {
    return { level: 'red', label: 'Atrasada', detail: `Venció hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`, score: 4 };
  }
  if (days === 0 && Number(task.progress || 0) < 90) {
    return { level: 'red', label: 'Crítica', detail: 'Entrega hoy con trabajo pendiente', score: 3.8 };
  }
  if (pressure >= 1.8 || (days <= 2 && rem >= 4)) {
    return { level: 'red', label: 'En riesgo', detail: `${days} d disponibles · ${rem.toFixed(1)} pts pendientes`, score: 3.4 };
  }
  if (pressure >= 0.9 || days <= 2) {
    return { level: 'amber', label: 'Atención', detail: `${days} d disponibles · ${rem.toFixed(1)} pts pendientes`, score: 2.2 };
  }
  return { level: 'green', label: 'En ritmo', detail: `${days} d disponibles · ${rem.toFixed(1)} pts pendientes`, score: 1 };
};

const projectRisk = (project, projectDeadline = '') => {
  const openTasks = (project.tasks || []).filter((task) => task.status !== 'done' && Number(task.progress || 0) < 100);
  if (!openTasks.length) return { level: 'green', label: 'Completado', detail: 'Sin tareas abiertas', score: 0, value: 100 };

  const risks = openTasks.map((task) => ({ task, risk: taskRisk(task, projectDeadline) }));
  const dated = risks.filter(({ task }) => task.dueDate || projectDeadline);
  if (!dated.length) return { level: 'neutral', label: 'Sin fechas', detail: 'Agrega fechas para activar el radar', score: 1, value: 25 };

  const totalWeight = dated.reduce((sum, { task }) => sum + Math.max(0.25, remainingEffort(task)), 0) || 1;
  const weighted = dated.reduce((sum, { task, risk }) => sum + risk.score * Math.max(0.25, remainingEffort(task)), 0) / totalWeight;
  const redWeight = dated.filter(({ risk }) => risk.level === 'red').reduce((sum, { task }) => sum + Math.max(0.25, remainingEffort(task)), 0) / totalWeight;

  let level = weighted >= 2.45 || redWeight >= 0.28 ? 'red' : weighted >= 1.65 ? 'amber' : 'green';
  let detail = `${dated.length}/${openTasks.length} tareas con fecha`;

  if (projectDeadline) {
    const days = dayDiff(projectDeadline);
    const remaining = openTasks.reduce((sum, task) => sum + remainingEffort(task), 0);
    const projectPressure = remaining / Math.max(1, Number(days) + 1);
    if (days < 0) level = 'red';
    else if (projectPressure >= 3.2) level = 'red';
    else if (projectPressure >= 1.7 && level === 'green') level = 'amber';
    detail = days < 0
      ? `Proyecto vencido hace ${Math.abs(days)} d`
      : `${days} d para entrega · ${remaining.toFixed(1)} pts restantes`;
  }

  const label = level === 'red' ? 'En riesgo' : level === 'amber' ? 'Atención' : 'En ritmo';
  const value = level === 'red' ? 18 : level === 'amber' ? 56 : 88;
  return { level, label, detail, score: weighted, value };
};

const createRadiation = (risk, compact = false) => {
  const node = document.createElement('span');
  node.className = `risk-radiation risk-${risk.level}${compact ? ' compact' : ''}`;
  node.innerHTML = `<span class="risk-symbol">☢</span>${compact ? '' : `<span class="risk-copy"><b>${risk.label}</b><small>${risk.detail}</small></span>`}`;
  node.title = `${risk.label}: ${risk.detail}`;
  return node;
};

const findProjectByName = (data, name) => (data.projects || []).find((project) => project.name.trim().toLowerCase() === String(name || '').trim().toLowerCase());

const decorateTaskRows = (data, currentProject) => {
  if (!currentProject) return;
  document.querySelectorAll('.task-table tbody tr').forEach((row) => {
    const title = row.querySelector('.task-name b')?.textContent?.trim();
    if (!title) return;
    const task = (currentProject.tasks || []).find((item) => item.title === title);
    if (!task) return;
    const host = row.querySelector('.task-name');
    if (!host) return;
    const existing = host.querySelector('.risk-radiation');
    if (existing) existing.remove();
    const risk = taskRisk(task, currentProject.dueDate || '');
    host.appendChild(createRadiation(risk, true));
    row.dataset.risk = risk.level;
  });
};

const decorateFocus = (data) => {
  document.querySelectorAll('.focus-list button').forEach((button) => {
    const title = button.querySelector('.focus-copy b')?.textContent?.trim();
    const meta = button.querySelector('.focus-copy small')?.textContent || '';
    const projectName = meta.split('·')[0]?.trim();
    const project = findProjectByName(data, projectName);
    const task = project?.tasks?.find((item) => item.title === title);
    if (!project || !task) return;
    button.querySelector('.risk-radiation')?.remove();
    const risk = taskRisk(task, project.dueDate || '');
    button.insertBefore(createRadiation(risk, true), button.querySelector('.effort-badge'));
  });
};

const decorateProjectCards = (data, meta) => {
  document.querySelectorAll('.project-card').forEach((card) => {
    const name = card.querySelector('.project-card-copy h4')?.textContent?.trim();
    const project = findProjectByName(data, name);
    if (!project) return;
    const deadline = meta.projectDeadlines?.[project.id] || project.dueDate || '';
    const risk = projectRisk(project, deadline);
    let badge = card.querySelector('.project-risk-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'project-risk-badge';
      card.querySelector('.project-card-top')?.appendChild(badge);
    }
    badge.className = `project-risk-badge risk-${risk.level}`;
    badge.innerHTML = `<span>☢</span>${risk.label}`;
    badge.title = risk.detail;
  });
};

const decorateProjectHero = (data, meta) => {
  const hero = document.querySelector('.project-hero');
  if (!hero) return null;
  const name = hero.querySelector('.project-title-row h2')?.textContent?.trim();
  const project = findProjectByName(data, name);
  if (!project) return null;

  const deadline = meta.projectDeadlines?.[project.id] || project.dueDate || '';
  const risk = projectRisk(project, deadline);
  const score = hero.querySelector('.project-score');
  if (!score) return project;

  let block = score.querySelector('.risk-project-block');
  if (!block) {
    block = document.createElement('div');
    block.className = 'risk-project-block';
    block.innerHTML = `
      <div class="risk-project-head">
        <div class="risk-mini-radar"><span>☢</span></div>
        <div><small>RADAR DE ENTREGA</small><b class="risk-project-label"></b></div>
      </div>
      <p class="risk-project-detail"></p>
      <label class="risk-project-date">Fecha de entrega del proyecto<input type="date"></label>
    `;
    score.appendChild(block);
  }

  block.className = `risk-project-block risk-${risk.level}`;
  block.querySelector('.risk-project-label').textContent = risk.label;
  block.querySelector('.risk-project-detail').textContent = risk.detail;
  block.querySelector('.risk-mini-radar').style.setProperty('--risk-value', `${risk.value * 3.6}deg`);
  const input = block.querySelector('input');
  if (input.value !== deadline) input.value = deadline;
  if (!input.dataset.bound) {
    input.dataset.bound = '1';
    input.addEventListener('change', () => {
      const next = readMeta();
      next.projectDeadlines = next.projectDeadlines || {};
      if (input.value) next.projectDeadlines[project.id] = input.value;
      else delete next.projectDeadlines[project.id];
      writeMeta(next);
      syncDeadlineIntoData(project.id, input.value);
      scheduleDecorate();
    });
  }
  return project;
};

const renameDeadlineField = () => {
  document.querySelectorAll('.modal-card label').forEach((label) => {
    if (label.childNodes?.[0]?.nodeType === Node.TEXT_NODE && label.childNodes[0].textContent.trim() === 'Fecha límite') {
      label.childNodes[0].textContent = 'Fecha de entrega';
    }
  });
};

let scheduled = false;
const decorate = () => {
  scheduled = false;
  seedMetaFromData();
  const data = readData();
  const meta = readMeta();
  const currentProject = decorateProjectHero(data, meta);
  decorateTaskRows(data, currentProject);
  decorateFocus(data);
  decorateProjectCards(data, meta);
  renameDeadlineField();
};

function scheduleDecorate() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(decorate);
}

const observer = new MutationObserver(scheduleDecorate);

if (typeof window !== 'undefined') {
  const start = () => {
    seedMetaFromData();
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleDecorate();
    window.addEventListener('storage', scheduleDecorate);
    window.addEventListener('focus', scheduleDecorate);
    setInterval(scheduleDecorate, 30000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
