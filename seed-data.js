(function(){
  const build=(rows,prefix)=>rows.map((row,index)=>({id:`${prefix}_${index+1}`,title:row[0],description:row[1],area:row[2],status:"pending",progress:0,effort:row[3]||3,assignee:"",dueDate:"",cost:0,notes:""}));
  window.INITIAL_DATA={
    version:2,
    collaborators:["Alfredo Loaiza"],
    projects:[
      {id:"project_canchas",name:"Canchas",client:"",total:4600,notes:"Proyecto precargado. Pago del cliente todavía pendiente.",tasks:build(window.RAW_CAN||[],"can"),payments:[]},
      {id:"project_indian",name:"INDIAN",client:"Indian House",total:900,notes:"Web de Indian. Pago del cliente todavía pendiente.",tasks:build(window.RAW_IND||[],"ind"),payments:[]}
    ]
  };
})();
