(function(){
  Office.onReady(()=>{
    const params = new URLSearchParams(location.search);
    const email = params.get('email')||''; const name = params.get('name')||'';
    document.getElementById('sender').textContent = name + ' <' + email + '>';
    document.getElementById('submitBtn').onclick = onUpsertContact;
    document.getElementById('saveEmailBtn').onclick = onSaveEmail;
  });

  async function onUpsertContact(){
    const params = new URLSearchParams(location.search);
    const email = params.get('email')||''; const name = params.get('name')||'';
    const charter = document.getElementById('charter').value;
    const parts = (name||'').trim().split(/\s+/); const last = parts.pop()||''; const first = parts.join(' ');
    const res = await fetch('/api/sf/upsert-contact',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({email,firstName:first,lastName:last,charter})});
    const data = await res.json(); const result = document.getElementById('result');
    if(!data.ok){ result.textContent = 'Salesforce error: '+(data.error||'Unknown'); return; }
    result.innerHTML = 'Saved: <a target="_blank" href="'+data.contactUrl+'">'+data.contactId+'</a>';
  }

  function getRecipientsAsync(prop){
    return new Promise((resolve)=>{
      const item = Office.context.mailbox.item;
      const getter = item[prop] && item[prop].getAsync ? item[prop].getAsync.bind(item[prop]) : null;
      if(!getter){ resolve([]); return; }
      getter((res)=>{
        const arr = (res && res.value || []).map(x => x.emailAddress||x.address||'').filter(Boolean);
        resolve(arr);
      });
    });
  }
  function getFromAsync(){
    return new Promise((resolve)=>{
      const item = Office.context.mailbox.item;
      if(item.from && item.from.getAsync){
        item.from.getAsync(res=>{
          const from = res.value||{}; resolve(from.emailAddress||from.address||'');
        });
      }else{ resolve(''); }
    });
  }
  function getBodyAsync(){
    return new Promise((resolve)=>{
      const item = Office.context.mailbox.item;
      if(item.body && item.body.getAsync){
        item.body.getAsync(Office.CoercionType.Html, res=> resolve(String(res && res.value || '')));
      }else{ resolve(''); }
    });
  }

  async function onSaveEmail(){
    const charter = document.getElementById('charter').value;
    const item = Office.context.mailbox.item;
    const subject = item.subject || '';
    const [from, toArr, ccArr, htmlBody] = await Promise.all([ getFromAsync(), getRecipientsAsync('to'), getRecipientsAsync('cc'), getBodyAsync() ]);
    const messageDate = (item.dateTimeCreated && item.dateTimeCreated.toISOString) ? item.dateTimeCreated.toISOString() : new Date().toISOString();
    const me = (Office.context && Office.context.mailbox && Office.context.mailbox.userProfile && Office.context.mailbox.userProfile.emailAddress) || '';
    const direction = (from && me && from.toLowerCase()===me.toLowerCase()) ? 'outbound' : 'inbound';
    const payload = { senderEmail: from, subject, htmlBody, to: toArr, cc: ccArr, messageDate, direction, charter };
    const res = await fetch('/api/sf/save-email',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(payload)});
    const data = await res.json(); const result = document.getElementById('result');
    if(!data.ok){ result.textContent = 'Salesforce error: '+(data.error||'Unknown'); return; }
    result.innerHTML = 'Email saved: <a target="_blank" href="'+data.emailUrl+'">'+data.emailId+'</a>';
  }
})();