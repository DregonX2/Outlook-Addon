(function(){
  document.addEventListener('DOMContentLoaded', ()=>{
    fetch('/api/config').then(r=>r.json()).then(cfg=>{
      if(cfg.domain) document.getElementById('domain').value = cfg.domain;
      if(cfg.clientId) document.getElementById('clientId').value = cfg.clientId;
    }).catch(()=>{});
    document.getElementById('save').onclick = async ()=>{
      const status = document.getElementById('status');
      status.textContent = 'Saving...';
      const body = {domain: domain.value.trim(), clientId: clientId.value.trim(), clientSecret: clientSecret.value.trim()};
      const r = await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const j = await r.json();
      status.textContent = j.ok ? 'Saved.' : ('Error: '+(j.error||'Unknown'));
    };
    document.getElementById('connect').onclick = ()=> window.open('/auth/sf/login','_blank');
  });
})();