import fs from 'node:fs';
const path='src/App.jsx';
let source=fs.readFileSync(path,'utf8');
if(!source.includes("import ProjectModalPro from './ProjectModalPro';")){
  source=source.replace("import SyncStatus from './SyncStatus';\n","import SyncStatus from './SyncStatus';\nimport ProjectModalPro from './ProjectModalPro';\n");
}
source=source.replace(
  "{modal?.type==='project'&&<ProjectModal project={modal.project} onSave={saveProject} onDelete={()=>deleteProject(modal.project?.id)} onClose={()=>setModal(null)}/>}",
  "{modal?.type==='project'&&<ProjectModalPro project={modal.project} onSave={saveProject} onDelete={()=>deleteProject(modal.project?.id)} onClose={()=>setModal(null)}/>}",
);
source=source.replace('<strong>Vencodex</strong><small>Workspace</small>','<strong>Vencodex</strong><small>Tu workspace</small>');
source=source.replace('Las personas detrás del trabajo.','Tu equipo de trabajo.');
source=source.replace('Agrega colaboradores una sola vez y asígnalos después a cualquier tarea.','Aquí tienes a las personas que trabajan contigo. Asígnalas a las tareas cuando las necesites.');
fs.writeFileSync(path,source);
// one-time wiring patch
