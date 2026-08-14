import fs from 'node:fs';

const path = 'src/App.jsx';
let source = fs.readFileSync(path, 'utf8');

if (!source.includes("import CompanyDashboard from './CompanyDashboard';")) {
  source = source.replace(
    "import { dataService } from './services/dataService';\n",
    "import { dataService } from './services/dataService';\nimport CompanyDashboard from './CompanyDashboard';\n",
  );
}

const oldRender = "{section==='dashboard'&&<Dashboard data={data} onProject={openProject} onNewProject={()=>setModal({type:'project'})}/>}";
const newRender = "{section==='dashboard'&&<CompanyDashboard data={data} onProject={openProject} onNewProject={()=>setModal({type:'project'})}/>}";

if (!source.includes(oldRender) && !source.includes(newRender)) {
  throw new Error('Dashboard render target not found in App.jsx');
}

source = source.replace(oldRender, newRender);
fs.writeFileSync(path, source);
