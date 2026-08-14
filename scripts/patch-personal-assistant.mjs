import fs from 'node:fs';

const appPath = 'src/App.jsx';
let app = fs.readFileSync(appPath, 'utf8');

if (!app.includes("import CommandPalette from './CommandPalette';")) {
  app = app.replace(
    "import CompanyDashboard from './CompanyDashboard';\n",
    "import CompanyDashboard from './CompanyDashboard';\nimport CommandPalette from './CommandPalette';\nimport SyncStatus from './SyncStatus';\n",
  );
}

app = app.replace(
  "<div className=\"storage-card synced\"><div><span className=\"storage-icon\"><Icon name=\"spark\" size={16}/></span><strong>Supabase conectado</strong></div><p>Workspace sincronizado con tu base de datos.</p></div>",
  "<SyncStatus/>",
);

app = app.replace(
  "function Header({ title, subtitle, onMenu, onNewProject }) {",
  "function Header({ title, subtitle, onMenu, onNewProject, onSearch }) {",
);
app = app.replace(
  '<div className="header-search"><Icon name="search" size={16}/><span>Buscar</span><kbd>⌘ K</kbd></div>',
  '<button className="header-search" type="button" onClick={onSearch}><Icon name="search" size={16}/><span>Buscar</span><kbd>⌘ K</kbd></button>',
);

app = app.replace(
  "const [mobileOpen,setMobileOpen]=useState(false); const hydrated=useRef(false);",
  "const [mobileOpen,setMobileOpen]=useState(false); const [searchOpen,setSearchOpen]=useState(false); const hydrated=useRef(false);",
);

const saveEffect = "useEffect(()=>{if(hydrated.current&&data)dataService.save(data);},[data]);";
if (app.includes(saveEffect) && !app.includes('setSearchOpen(true)')) {
  app = app.replace(saveEffect, `${saveEffect}\n  useEffect(()=>{const handler=(event)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setSearchOpen(true);}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[]);`);
}

app = app.replace(
  "const openDashboard=()=>{setSection('dashboard');setSelectedProjectId(null);}; const openProject=(id)=>{setSelectedProjectId(id);setSection('project');setProjectTab('overview');}; const openTeam=()=>{setSection('team');setSelectedProjectId(null);};",
  "const openDashboard=()=>{setSection('dashboard');setSelectedProjectId(null);}; const openProject=(id)=>{setSelectedProjectId(id);setSection('project');setProjectTab('overview');}; const openTaskProject=(id)=>{setSelectedProjectId(id);setSection('project');setProjectTab('tasks');}; const openTeam=()=>{setSection('team');setSelectedProjectId(null);};",
);

app = app.replace(
  "<Header title={headerTitle} subtitle={headerSubtitle} onMenu={()=>setMobileOpen(true)} onNewProject={()=>setModal({type:'project'})}/>",
  "<Header title={headerTitle} subtitle={headerSubtitle} onMenu={()=>setMobileOpen(true)} onNewProject={()=>setModal({type:'project'})} onSearch={()=>setSearchOpen(true)}/>",
);

const tail = "{modal?.type==='collaborator'&&<CollaboratorModal onSave={addCollaborator} onClose={()=>setModal(null)}/>}</div>;";
if (app.includes(tail)) {
  app = app.replace(tail, "{modal?.type==='collaborator'&&<CollaboratorModal onSave={addCollaborator} onClose={()=>setModal(null)}/>}<CommandPalette data={data} open={searchOpen} onClose={()=>setSearchOpen(false)} onProject={openProject} onTask={openTaskProject} onTeam={openTeam}/></div>;");
}

fs.writeFileSync(appPath, app);

const servicePath = 'src/services/dataService.js';
let service = fs.readFileSync(servicePath, 'utf8');
if (!service.includes('emitSyncStatus')) {
  service = service.replace(
    "let pendingSave = null;\n",
    "let pendingSave = null;\nconst emitSyncStatus = (status) => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vencodex-sync-status', { detail: status })); };\n",
  );
}
service = service.replace(
  "pendingSave = clone(data);\n    clearTimeout(saveTimer);",
  "pendingSave = clone(data);\n    emitSyncStatus('pending');\n    clearTimeout(saveTimer);",
);
service = service.replace(
  "try {\n        await persistWorkspace(snapshot);\n      } catch (error) {\n        console.error('No se pudo sincronizar el workspace con Supabase', error);\n      }",
  "try {\n        emitSyncStatus('saving');\n        await persistWorkspace(snapshot);\n        emitSyncStatus('synced');\n      } catch (error) {\n        emitSyncStatus('error');\n        console.error('No se pudo sincronizar el workspace con Supabase', error);\n      }",
);
fs.writeFileSync(servicePath, service);
