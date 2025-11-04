(function(){
  Office.onReady(() => {
    const params = new URLSearchParams(location.search);
    const email = params.get('email') || '';
    const name = params.get('name') || '';
    document.getElementById('sender').textContent = name + ' <' + email + '>';

    // Load default charter
    fetch('/api/me')
      .then(r=>r.json()).then(me=>{
        if(me.defaultCharter){
          const el = document.getElementById('charter');
          if ([...el.options].some(o => o.value === me.defaultCharter)) {
            el.value = me.defaultCharter;
          }
        }
      }).catch(()=>{});

    document.getElementById('submitBtn').addEventListener('click', onUpsertContact);
    document.getElementById('saveEmailBtn').addEventListener('click', onSaveEmail);
  });

  async function onUpsertContact(){
    const params = new URLSearchParams(location.search);
    const email = params.get('email') || '';
    const name = params.get('name') || '';
    const charter = document.getElementById('charter').value;
    const {firstName,lastName} = splitName(name);
    const payload = { email, firstName, lastName, charter };
    const res = await fetch('/api/sf/upsert-contact', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    const result = document.getElementById('result');
    if(!data.ok){
      result.innerHTML = '<span class="error">Salesforce error: ' + escapeHtml(data.error||'Unknown') + '</span>';
      return;
    }
    result.innerHTML = '<span class="success">Saved to Salesforce:</span> <a target="_blank" href="'+data.contactUrl+'">'+data.contactId+'</a>';

    // Preview if available
    if(data.preview){
      const p = document.getElementById('preview');
      p.classList.remove('hidden');
      p.innerHTML = '<strong>'+escapeHtml(data.preview.Name)+'</strong><br/>' +
                    (data.preview.Title? (escapeHtml(data.preview.Title)+'<br/>'):'') +
                    (data.preview.Account? ('Account: '+escapeHtml(data.preview.Account)+'<br/>'):'') +
                    '<a target="_blank" href="'+data.contactUrl+'">Open in Salesforce</a>';
    }

    // Save default charter
    fetch('/api/me/charter-default', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({value: charter})});
  }

  function getRecipientsAsync(prop){
    return new Promise((resolve) => {
      const item = Office.context.mailbox.item;
      const getter = item[prop] && item[prop].getAsync ? item[prop].getAsync.bind(item[prop]) : null;
      if(!getter){
        resolve([]);
        return;
      }
      getter((res)=>{
        if(res && res.value && Array.isArray(res.value)){
          const arr = res.value.map(x => (x && (x.emailAddress || x.address)) || '').filter(Boolean);
          resolve(arr);
        }else{
          resolve([]);
        }
      });
    });
  }

  function getFromAsync(){
    return new Promise((resolve) => {
      const item = Office.context.mailbox.item;
      if(item.from && item.from.getAsync){
        item.from.getAsync((res)=>{
          const from = res.value || {};
          resolve((from.emailAddress || from.address || '') || '');
        });
      }else{
        resolve('');
      }
    });
  }

  function getBodyAsync(){
    return new Promise((resolve) => {
      const item = Office.context.mailbox.item;
      const type = Office.CoercionType.Html;
      if(item.body && item.body.getAsync){
        item.body.getAsync(type, (res)=>{
          if(res && res.status === Office.AsyncResultStatus.Succeeded){
            resolve(String(res.value||''));
          }else{
            resolve('');
          }
        });
      }else{
        resolve('');
      }
    });
  }

  async function onSaveEmail(){
    const charter = document.getElementById('charter').value;
    const item = Office.context.mailbox.item;
    const subject = item.subject || '';
    const [from, toArr, ccArr, htmlBody] = await Promise.all([
      getFromAsync(),
      getRecipientsAsync('to'),
      getRecipientsAsync('cc'),
      getBodyAsync()
    ]);
    const messageDate = (item.dateTimeCreated && item.dateTimeCreated.toISOString) ? item.dateTimeCreated.toISOString() : new Date().toISOString();

    const mailboxUser = (Office.context && Office.context.mailbox && Office.context.mailbox.userProfile && Office.context.mailbox.userProfile.emailAddress) || '';
    const direction = (from && mailboxUser && from.toLowerCase() === mailboxUser.toLowerCase()) ? 'outbound' : 'inbound';

    const payload = {
      senderEmail: from,
      subject,
      htmlBody,
      to: toArr,
      cc: ccArr,
      messageDate,
      direction,
      charter
    };

    const res = await fetch('/api/sf/save-email', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    const result = document.getElementById('result');
    if(!data.ok){
      result.innerHTML = '<span class="error">Salesforce error: ' + escapeHtml(data.error||'Unknown') + '</span>';
      return;
    }
    result.innerHTML = '<span class="success">Email saved:</span> <a target="_blank" href="'+data.emailUrl+'">'+data.emailId+'</a>';
  }

  function splitName(display){
    if(!display) return {firstName:'', lastName:''};
    const parts = display.trim().split(/\s+/);
    if(parts.length===1) return {firstName:'', lastName:parts[0]};
    return {firstName: parts.slice(0,-1).join(' '), lastName: parts.slice(-1).join(' ')};
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  }
})();
