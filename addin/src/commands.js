function sendToSalesforce(event){
  Office.context.mailbox.item.from.getAsync((res)=>{
    const from = res.value||{}; const email = from.emailAddress||from.address||''; const name = from.displayName||'';
    Office.context.ui.displayDialogAsync(window.location.origin + '/addin/src/taskpane.html?email='+encodeURIComponent(email)+'&name='+encodeURIComponent(name),
      {height:45,width:35,displayInIframe:true}, ()=>event.completed());
  });
}
function openSettings(event){
  Office.context.ui.displayDialogAsync(window.location.origin + '/addin/src/settings.html', {height:45,width:40,displayInIframe:true}, ()=>event.completed());
}
function onMessageSendHandler(event){
  Office.context.ui.displayDialogAsync(window.location.origin + '/addin/src/compose.html', {height:35,width:30,displayInIframe:true}, (asyncResult)=>{
    const dlg = asyncResult.value;
    dlg.addEventHandler(Office.EventType.DialogMessageReceived, async (args)=>{
      try{
        const data = JSON.parse(args.message);
        if(data.type==='submitCharter'){
          const item = Office.context.mailbox.item;
          const to = (item.to && item.to.length && (item.to[0].emailAddress||item.to[0].address)) || '';
          const subject = item.subject || '';
          await fetch('/api/sf/log-activity',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({email:to,subject,charter:data.charter})});
          dlg.close(); event.completed({allowEvent:true});
        }
      }catch(e){ try{dlg.close();}catch{} event.completed({allowEvent:true}); }
    });
  });
}
if(typeof module!=='undefined'){ module.exports = { sendToSalesforce, openSettings, onMessageSendHandler }; }