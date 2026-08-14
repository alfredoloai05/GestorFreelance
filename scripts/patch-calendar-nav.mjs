import fs from 'node:fs';

const appPath = 'src/App.jsx';
let app = fs.readFileSync(appPath, 'utf8');

if (!app.includes("import CalendarView from './CalendarView';")) {
  app = app.replace(
    "import ProjectModalPro from './ProjectModalPro';\n",
    "import ProjectModalPro from './ProjectModalPro';\nimport CalendarView from './CalendarView';\nimport ProjectsHub from './ProjectsHub';\n",
  );
}

if (!app.includes('calendar: <')) {
  app = app.replace(
    'folder: <path d="M3 7.5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>,',
    'folder: <path d="M3 7.5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>,\n    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,',
  );
}

app = app.replace(
  'function Sidebar({ data, selectedProjectId, section, onDashboard, onProject, onTeam, onNewProject, onLogout, mobileOpen, closeMobile }) {',
  'function Sidebar({ data, selectedProjectId, section, onDashboard, onProject, onProjects, onTeam, onCalendar, onNewProject, onLogout, mobileOpen, closeMobile }) {',
);

const oldNav = '<nav className="main-nav"><button className={section === \'dashboard\' ? \'active\' : \'\'} onClick={() => { onDashboard(); closeMobile(); }}><Icon name="grid"/><span>Resumen</span></button><button className={section === \'team\' ? \'active\' : \'\'} onClick={() => { onTeam(); closeMobile(); }}><Icon name="users"/><span>Equipo</span></button></nav>';
const newNav = '<nav className="main-nav"><button className={section === \'dashboard\' ? \'active\' : \'\'} onClick={() => { onDashboard(); closeMobile(); }}><Icon name="grid"/><span>Resumen</span></button><button className={section === \'team\' ? \'active\' : \'\'} onClick={() => { onTeam(); closeMobile(); }}><Icon name="users"/><span>Equipo</span></button><button className={`projects-nav ${section === \'projects\' ? \'active\' : \'\'}`} onClick={() => { onProjects(); closeMobile(); }}><Icon name="folder"/><span>Proyectos</span></button><button className={`calendar-nav ${section === \'calendar\' ? \'active\' : \'\'}`} onClick={() => { onCalendar(); closeMobile(); }}><Icon name="calendar"/><span>Calendario</span></button></nav>';
app = app.replace(oldNav, newNav);

app = app.replace(
  "const openDashboard=()=>{setSection('dashboard');setSelectedProjectId(null);}; const openProject=(id)=>{setSelectedProjectId(id);setSection('project');setProjectTab('overview');}; const openTaskProject=(id)=>{setSelectedProjectId(id);setSection('project');setProjectTab('tasks');}; const openTeam=()=>{setSection('team');setSelectedProjectId(null);};",
  "const openDashboard=()=>{setSection('dashboard');setSelectedProjectId(null);}; const openProject=(id)=>{setSelectedProjectId(id);setSection('project');setProjectTab('overview');}; const openTaskProject=(id)=>{setSelectedProjectId(id);setSection('project');setProjectTab('tasks');}; const openProjects=()=>{setSection('projects');setSelectedProjectId(null);}; const openTeam=()=>{setSection('team');setSelectedProjectId(null);}; const openCalendar=()=>{setSection('calendar');setSelectedProjectId(null);};",
);

app = app.replace(
  "const headerTitle=section==='dashboard'?'Resumen':section==='team'?'Equipo':selectedProject?.name||'Proyecto'; const headerSubtitle=section==='dashboard'?'WORKSPACE':section==='team'?'PERSONAS':'PROYECTO';",
  "const headerTitle=section==='dashboard'?'Resumen':section==='team'?'Equipo':section==='projects'?'Proyectos':section==='calendar'?'Calendario':selectedProject?.name||'Proyecto'; const headerSubtitle=section==='dashboard'?'TU CENTRO DE CONTROL':section==='team'?'TU EQUIPO':section==='projects'?'TU PORTAFOLIO':section==='calendar'?'TU AGENDA':'PROYECTO';",
);

app = app.replace(
  '<Sidebar data={data} selectedProjectId={selectedProjectId} section={section} onDashboard={openDashboard} onProject={openProject} onTeam={openTeam} onNewProject={()=>setModal({type:\'project\'})}',
  '<Sidebar data={data} selectedProjectId={selectedProjectId} section={section} onDashboard={openDashboard} onProject={openProject} onProjects={openProjects} onTeam={openTeam} onCalendar={openCalendar} onNewProject={()=>setModal({type:\'project\'})}',
);

const dashboardRender = "{section==='dashboard'&&<CompanyDashboard data={data} onProject={openProject} onNewProject={()=>setModal({type:'project'})}/>}";
if (app.includes(dashboardRender) && !app.includes("section==='projects'&&<ProjectsHub")) {
  app = app.replace(
    dashboardRender,
    `${dashboardRender} {section==='projects'&&<ProjectsHub data={data} onProject={openProject} onNewProject={()=>setModal({type:'project'})}/>} {section==='calendar'&&<CalendarView data={data} onProject={openProject} onTask={openTaskProject}/>} `,
  );
}

fs.writeFileSync(appPath, app);

const servicePath = 'src/services/dataService.js';
let service = fs.readFileSync(servicePath, 'utf8');
if (!service.includes('startDate: project.start_date')) {
  service = service.replace(
    "status: project.status || 'active',\n      notes: project.description || '',",
    "status: project.status || 'active',\n      startDate: project.start_date || '',\n      notes: project.description || '',",
  );
}
if (!service.includes('start_date: project.startDate')) {
  service = service.replace(
    "status: project.status || 'active',\n        delivery_date: project.dueDate || null,",
    "status: project.status || 'active',\n        start_date: project.startDate || null,\n        delivery_date: project.dueDate || null,",
  );
}
fs.writeFileSync(servicePath, service);

const mainPath = 'src/main.jsx';
let main = fs.readFileSync(mainPath, 'utf8');
if (!main.includes("import './calendarPolish.css';")) {
  main = main.replace("import './jarvisPolish.css';\n", "import './jarvisPolish.css';\nimport './calendarPolish.css';\n");
}
fs.writeFileSync(mainPath, main);

// trigger calendar wiring
