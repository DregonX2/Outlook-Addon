(function(){
  async function load(){
    try{
      const cfg = await fetch('/api/config').then(r=>r.json());
      if(cfg && cfg.domain){ document.getElementById('domain').value = cfg.domain; }
      if(cfg && cfg.clientId){ document.getElementById('clientId').value = cfg.clientId; }
    }catch{}
  }
  document.addEventListener('DOMContentLoaded', ()=>{
    load();
    document.getElementById('save').onclick = async ()=>{
      const status = document.getElementById('status');
      status.textContent = 'Saving...';
      const domain = document.getElementById('domain').value.trim();
      const clientId = document.getElementById('clientId').value.trim();
      const clientSecret = document.getElementById('clientSecret').value.trim();
      const resp = await fetch('/api/config', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ domain, clientId, clientSecret })
      });
      const j = await resp.json();
      status.textContent = j.ok ? 'Saved.' : ('Error: '+(j.error||'Unknown'));
    };
    document.getElementById('connect').onclick = ()=>{
      window.open('/auth/sf/login','_blank');
    };
  });
})();
