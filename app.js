const KEY="gestor_freelance_v2";
let data=loadData();
let currentProjectId=null;

const $=id=>document.getElementById(id);
const uid=(p="id")=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const money=v=>new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(n(v));
const esc=s=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

function clone(x){return JSON.parse(JSON.stringify(x))}
function loadData(){
  try{
    const raw=localStorage.getItem(KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  const initial=clone(window.INITIAL_DATA);
  localStorage.setItem(KEY,JSON.stringify(initial));
  return initial;
}
function save(){localStorage.setItem(KEY,JSON.stringify(data))}
function project(){return data.projects.find(p=>p.id===currentProjectId)}
function payments(p,type){return (p.payments||[]).filter(x=>x.type===type)}
function received(p){return payments(p,"income").reduce((s,x)=>s+n(x.amount),0)}
function expenses(p){return payments(p,"expense").reduce((s,x)=>s+n(x.amount),0)}
function taskPaid(p,taskId){return payments(p,"expense").filter(x=>x.taskId===taskId).reduce((s,x)=>s+n(x.amount),0)}
function taskDue(p,t){return Math.max(0,n(t.cost)-taskPaid(p,t.id))}
function projectTaskDue(p){return (p.tasks||[]).reduce((s,t)=>s+taskDue(p,t),0)}
function dueFromClient(p){return Math.max(0,n(p.total)-received(p))}
function projectProgress(p){
  const tasks=p.tasks||[]; if(!tasks.length)return 0;
  const den=tasks.reduce((s,t)=>s+Math.max(1,n(t.effort)),0);
  const num=tasks.reduce((s,t)=>s+Math.max(1,n(t.effort))*Math.min(100,Math.max(0,n(t.progress))),0);
  return den?Math.round(num/den):0;
}
function showToast(msg){const t=$("toast");t.textContent=msg;t.classList.remove("hidden");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.add("hidden"),2400)}
function openModal(id){$(id).classList.remove("hidden")}
function closeModal(id){$(id).classList.add("hidden")}

function render(){
  renderNav(); renderDashboard(); renderTeam();
  if(currentProjectId&&project()) renderProject(); else showDashboard();
}
function renderNav(){
  const nav=$("projectNav");nav.innerHTML="";
  data.projects.forEach(p=>{
    const b=document.createElement("button");
    b.className=p.id===currentProjectId?"active":"";
    b.innerHTML=`<b>${esc(p.name)}</b><small>${projectProgress(p)}% · debe ${money(dueFromClient(p))}</small>`;
    b.onclick=()=>openProject(p.id);nav.appendChild(b);
  });
}
function renderDashboard(){
  const ps=data.projects;
  const totalEffort=ps.reduce((s,p)=>s+(p.tasks||[]).reduce((a,t)=>a+Math.max(1,n(t.effort)),0),0);
  const doneEffort=ps.reduce((s,p)=>s+(p.tasks||[]).reduce((a,t)=>a+Math.max(1,n(t.effort))*n(t.progress)/100,0),0);
  $("dashProjects").textContent=ps.length;
  $("dashProgress").textContent=`${totalEffort?Math.round(doneEffort/totalEffort*100):0}%`;
  $("dashReceivable").textContent=money(ps.reduce((s,p)=>s+dueFromClient(p),0));
  $("dashPayable").textContent=money(ps.reduce((s,p)=>s+projectTaskDue(p),0));
  const c=$("projectCards");c.innerHTML="";
  ps.forEach(p=>{
    const card=document.createElement("article");card.className="card";
    card.innerHTML=`<div class="card-top"><div><h3>${esc(p.name)}</h3><span class="muted">${esc(p.client||"Sin cliente")}</span></div><strong>${projectProgress(p)}%</strong></div>
      <div class="track"><div class="bar" style="width:${projectProgress(p)}%"></div></div>
      <div class="money-grid"><div><span>Valor</span><strong>${money(p.total)}</strong></div><div><span>Por cobrar</span><strong>${money(dueFromClient(p))}</strong></div><div><span>Por pagar</span><strong>${money(projectTaskDue(p))}</strong></div></div>`;
    card.onclick=()=>openProject(p.id);c.appendChild(card);
  });
}
function showDashboard(){
  currentProjectId=null;
  $("dashboardView").classList.remove("hidden");$("projectView").classList.add("hidden");$("pageTitle").textContent="Resumen";renderNav();renderDashboard();
}
function openProject(id){
  currentProjectId=id; const p=project(); if(!p)return;
  $("dashboardView").classList.add("hidden");$("projectView").classList.remove("hidden");$("pageTitle").textContent=p.name;
  document.querySelectorAll(".tab").forEach((x,i)=>x.classList.toggle("active",i===0));$("tasksTab").classList.remove("hidden");$("paymentsTab").classList.add("hidden");
  renderNav();renderProject();
}
function renderProject(){
  const p=project();if(!p)return;
  $("projectName").textContent=p.name;$("projectNotes").textContent=[p.client,p.notes].filter(Boolean).join(" · ");
  const pr=projectProgress(p);$("projectProgressText").textContent=`${pr}%`;$("projectProgressBar").style.width=`${pr}%`;
  $("finTotal").textContent=money(p.total);$("finReceived").textContent=money(received(p));$("finDue").textContent=money(dueFromClient(p));$("finTaskDue").textContent=money(projectTaskDue(p));
  renderAreaFilter();renderTasks();renderPayments();
}
function renderAreaFilter(){
  const p=project(), sel=$("areaFilter"), old=sel.value||"all";
  const areas=[...new Set((p.tasks||[]).map(t=>t.area||"General"))].sort();
  sel.innerHTML=`<option value="all">Todas las áreas</option>`+areas.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join("");
  if([...sel.options].some(o=>o.value===old))sel.value=old;
}
function renderTasks(){
  const p=project();if(!p)return;
  const area=$("areaFilter").value||"all",status=$("statusFilter").value||"all",q=$("taskSearch").value.trim().toLowerCase();
  const all=p.tasks||[];
  const list=all.filter(t=>(area==="all"||(t.area||"General")===area)&&(status==="all"||t.status===status)&&(!q||`${t.title} ${t.description} ${t.area} ${t.assignee}`.toLowerCase().includes(q)));
  const counts={pending:all.filter(t=>t.status==="pending").length,progress:all.filter(t=>t.status==="progress").length,review:all.filter(t=>t.status==="review").length,done:all.filter(t=>t.status==="done").length};
  $("taskChips").innerHTML=`<span class="chip"><b>${all.length}</b> tareas</span><span class="chip"><b>${counts.pending}</b> pendientes</span><span class="chip"><b>${counts.progress}</b> desarrollo</span><span class="chip"><b>${counts.review}</b> revisión</span><span class="chip"><b>${counts.done}</b> terminadas</span><span class="chip"><b>${all.reduce((s,t)=>s+n(t.effort),0)}</b> puntos de esfuerzo</span>`;
  const labels={pending:"Pendiente",progress:"En desarrollo",review:"Revisión",done:"Terminada"};
  $("taskBody").innerHTML=list.map(t=>{
    const paid=taskPaid(p,t.id),due=taskDue(p,t);
    return `<tr>
      <td class="task-title"><strong>${esc(t.title)}</strong><small>${esc(t.description||"Sin descripción")}</small></td>
      <td>${esc(t.area||"General")}</td><td>${esc(t.assignee||"Sin asignar")}</td>
      <td><span class="badge ${t.status}">${labels[t.status]||"Pendiente"}</span></td>
      <td><span class="effort">${n(t.effort)||1}</span></td>
      <td><div class="mini"><b>${n(t.progress)}%</b><div class="track"><div class="bar" style="width:${n(t.progress)}%"></div></div></div></td>
      <td>${money(t.cost)}</td><td>${money(paid)}</td><td><b>${money(due)}</b></td>
      <td><button class="row-btn" data-edit-task="${t.id}">Editar</button></td>
    </tr>`;
  }).join("");
  document.querySelectorAll("[data-edit-task]").forEach(b=>b.onclick=()=>editTask(b.dataset.editTask));
}
function renderPayments(){
  const p=project();if(!p)return;
  const rows=[...(p.payments||[])].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  $("paymentBody").innerHTML=rows.map(x=>{
    const task=(p.tasks||[]).find(t=>t.id===x.taskId);
    return `<tr><td>${esc(x.date||"")}</td><td><span class="badge ${x.type==="income"?"done":"review"}">${x.type==="income"?"Me pagaron":"Yo pagué"}</span></td>
    <td>${esc(x.party||"-")}</td><td>${esc(task?.title||"-")}</td><td><b>${money(x.amount)}</b></td><td>${esc(x.note||"")}</td>
    <td><button class="row-btn" data-del-payment="${x.id}">Eliminar</button></td></tr>`;
  }).join("");
  $("paymentEmpty").classList.toggle("hidden",rows.length>0);
  document.querySelectorAll("[data-del-payment]").forEach(b=>b.onclick=()=>deletePayment(b.dataset.delPayment));
}
function renderTeam(){
  $("teamList").innerHTML=data.collaborators.map((name,i)=>`<div class="team-row"><span>${esc(name)}</span><button data-del-team="${i}">Quitar</button></div>`).join("")||`<div class="empty">Sin colaboradores.</div>`;
  document.querySelectorAll("[data-del-team]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.delTeam);data.collaborators.splice(i,1);save();renderTeam();showToast("Colaborador eliminado")});
}
function fillAssignees(selected=""){
  $("taskAssigneeInput").innerHTML=`<option value="">Sin asignar</option>`+data.collaborators.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
  $("taskAssigneeInput").value=selected;
}
function newProject(){
  $("projectIdInput").value="";$("projectModalTitle").textContent="Nuevo proyecto";$("projectNameInput").value="";$("projectClientInput").value="";$("projectTotalInput").value=0;$("projectNotesInput").value="";openModal("projectModal");
}
function editProject(){
  const p=project();if(!p)return;$("projectIdInput").value=p.id;$("projectModalTitle").textContent="Editar proyecto";$("projectNameInput").value=p.name;$("projectClientInput").value=p.client||"";$("projectTotalInput").value=n(p.total);$("projectNotesInput").value=p.notes||"";openModal("projectModal");
}
function newTask(){
  $("taskIdInput").value="";$("taskModalTitle").textContent="Nueva tarea";$("taskTitleInput").value="";$("taskDescriptionInput").value="";$("taskAreaInput").value=$("areaFilter").value!=="all"?$("areaFilter").value:"General";fillAssignees("");$("taskStatusInput").value="pending";$("taskProgressInput").value="0";$("taskEffortInput").value="3";$("taskDateInput").value="";$("taskCostInput").value="0";$("taskNotesInput").value="";$("deleteTaskBtn").classList.add("hidden");openModal("taskModal");
}
function editTask(id){
  const t=(project()?.tasks||[]).find(x=>x.id===id);if(!t)return;
  $("taskIdInput").value=t.id;$("taskModalTitle").textContent="Editar tarea";$("taskTitleInput").value=t.title;$("taskDescriptionInput").value=t.description||"";$("taskAreaInput").value=t.area||"General";fillAssignees(t.assignee||"");$("taskStatusInput").value=t.status||"pending";$("taskProgressInput").value=String(n(t.progress));$("taskEffortInput").value=String(n(t.effort)||3);$("taskDateInput").value=t.dueDate||"";$("taskCostInput").value=n(t.cost);$("taskNotesInput").value=t.notes||"";$("deleteTaskBtn").classList.remove("hidden");openModal("taskModal");
}
function newPayment(){
  const p=project();if(!p)return;
  $("paymentTypeInput").value="income";$("paymentAmountInput").value="";$("paymentDateInput").value=new Date().toISOString().slice(0,10);$("paymentPartyInput").value=p.client||"";$("paymentNoteInput").value="";
  fillPaymentTasks();togglePaymentTask();openModal("paymentModal");
}
function fillPaymentTasks(){
  const p=project();$("paymentTaskInput").innerHTML=`<option value="">Sin relacionar a una tarea</option>`+(p.tasks||[]).map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join("");
}
function togglePaymentTask(){
  const expense=$("paymentTypeInput").value==="expense";$("paymentTaskLabel").classList.toggle("hidden",!expense);if(!expense)$("paymentTaskInput").value="";
}
function deletePayment(id){
  const p=project();if(!p||!confirm("¿Eliminar este movimiento?"))return;p.payments=(p.payments||[]).filter(x=>x.id!==id);save();renderProject();renderDashboard();showToast("Movimiento eliminado");
}
function download(name,content,type="text/plain;charset=utf-8"){
  const b=new Blob([content],{type}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u);
}
function template(){
  download("plantilla_tareas.txt",`# Una tarea por línea\n# Formato: Tarea | Descripción | Costo\n# Se importan como Pendiente, 0%, sin responsable, área General y esfuerzo 3.\n\nCrear login | Implementar autenticación | 0\nCrear dashboard | Mostrar resumen del proyecto | 0\nRevisión responsive | Validar móvil y escritorio | 0\n`);
}
async function importTxt(file){
  const p=project();if(!p)return;const text=await file.text();let count=0;
  for(const raw of text.split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith("#"))continue;const cols=line.split("|").map(s=>s.trim());if(!cols[0]||cols[0].toLowerCase()==="tarea")continue;
    p.tasks.push({id:uid("task"),title:cols[0],description:cols[1]||"",area:"General",status:"pending",progress:0,effort:3,assignee:"",dueDate:"",cost:n((cols[2]||"0").replace(",",".")),notes:""});count++;
  }save();renderProject();renderDashboard();showToast(`${count} tarea(s) importada(s)`);
}
function backup(){download(`respaldo_gestor_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({app:"Gestor Freelance",version:2,data},null,2),"application/json;charset=utf-8");showToast("Respaldo descargado")}
async function restore(file){try{const obj=JSON.parse(await file.text());const d=obj.data||obj;if(!d.projects||!d.collaborators)throw 0;if(!confirm("Esto reemplazará los datos actuales. ¿Continuar?"))return;data=d;currentProjectId=null;save();render();showToast("Respaldo restaurado")}catch(e){showToast("JSON no válido")}}

$("projectForm").onsubmit=e=>{e.preventDefault();const id=$("projectIdInput").value,payload={name:$("projectNameInput").value.trim(),client:$("projectClientInput").value.trim(),total:n($("projectTotalInput").value),notes:$("projectNotesInput").value.trim()};if(id){Object.assign(data.projects.find(x=>x.id===id),payload)}else{const p={id:uid("project"),...payload,tasks:[],payments:[]};data.projects.push(p);currentProjectId=p.id}save();closeModal("projectModal");render();if(currentProjectId)openProject(currentProjectId);showToast("Proyecto guardado")};
$("taskForm").onsubmit=e=>{e.preventDefault();const p=project();if(!p)return;const id=$("taskIdInput").value;let status=$("taskStatusInput").value,progress=n($("taskProgressInput").value);if(status==="done")progress=100;const payload={title:$("taskTitleInput").value.trim(),description:$("taskDescriptionInput").value.trim(),area:$("taskAreaInput").value.trim()||"General",assignee:$("taskAssigneeInput").value,status,progress,effort:n($("taskEffortInput").value)||3,dueDate:$("taskDateInput").value,cost:n($("taskCostInput").value),notes:$("taskNotesInput").value.trim()};if(id)Object.assign(p.tasks.find(x=>x.id===id),payload);else p.tasks.push({id:uid("task"),...payload});save();closeModal("taskModal");renderProject();renderDashboard();renderNav();showToast("Tarea guardada")};
$("paymentForm").onsubmit=e=>{e.preventDefault();const p=project();if(!p)return;p.payments=p.payments||[];p.payments.push({id:uid("pay"),type:$("paymentTypeInput").value,amount:n($("paymentAmountInput").value),date:$("paymentDateInput").value,party:$("paymentPartyInput").value.trim(),taskId:$("paymentTypeInput").value==="expense"?$("paymentTaskInput").value:"",note:$("paymentNoteInput").value.trim()});save();closeModal("paymentModal");renderProject();renderDashboard();renderNav();showToast("Pago registrado")};
$("teamForm").onsubmit=e=>{e.preventDefault();const x=$("teamNameInput").value.trim();if(x&&!data.collaborators.includes(x)){data.collaborators.push(x);save();renderTeam();showToast("Colaborador agregado")}$("teamNameInput").value=""};

$("deleteTaskBtn").onclick=()=>{const p=project(),id=$("taskIdInput").value;if(!p||!id||!confirm("¿Eliminar esta tarea?"))return;p.tasks=p.tasks.filter(t=>t.id!==id);p.payments=(p.payments||[]).map(x=>x.taskId===id?{...x,taskId:""}:x);save();closeModal("taskModal");renderProject();renderDashboard();showToast("Tarea eliminada")};
$("deleteProjectBtn").onclick=()=>{const p=project();if(!p||!confirm(`¿Eliminar ${p.name} y todos sus datos?`))return;data.projects=data.projects.filter(x=>x.id!==p.id);currentProjectId=null;save();render();showToast("Proyecto eliminado")};

$("newProjectBtn").onclick=newProject;$("editProjectBtn").onclick=editProject;$("newTaskBtn").onclick=newTask;$("newPaymentBtn").onclick=newPayment;$("teamBtn").onclick=()=>openModal("teamModal");$("dashboardBtn").onclick=showDashboard;$("templateBtn").onclick=template;$("backupBtn").onclick=backup;
$("areaFilter").onchange=renderTasks;$("statusFilter").onchange=renderTasks;$("taskSearch").oninput=renderTasks;$("paymentTypeInput").onchange=()=>{togglePaymentTask();if($("paymentTypeInput").value==="expense")$("paymentPartyInput").value="";else $("paymentPartyInput").value=project()?.client||""};
$("taskStatusInput").onchange=()=>{if($("taskStatusInput").value==="done")$("taskProgressInput").value="100";else if($("taskStatusInput").value==="pending"&&$("taskProgressInput").value==="100")$("taskProgressInput").value="0"};
$("taskTxtInput").onchange=async e=>{if(e.target.files[0])await importTxt(e.target.files[0]);e.target.value=""};$("restoreInput").onchange=async e=>{if(e.target.files[0])await restore(e.target.files[0]);e.target.value=""};
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));document.querySelectorAll(".modal").forEach(m=>m.onclick=e=>{if(e.target===m)closeModal(m.id)});
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");const pay=b.dataset.tab==="payments";$("tasksTab").classList.toggle("hidden",pay);$("paymentsTab").classList.toggle("hidden",!pay)});

render();
