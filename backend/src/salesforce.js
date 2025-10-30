import fetch from 'node-fetch';

export async function ensureToken(session){
  if(!session.sf || !session.sf.refresh_token) throw new Error('Not connected to Salesforce. Open /auth/sf/login');
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.SF_CLIENT_ID,
    client_secret: process.env.SF_CLIENT_SECRET,
    refresh_token: session.sf.refresh_token
  });
  const r = await fetch(`${process.env.SF_LOGIN_URL}/services/oauth2/token`, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: params });
  const tok = await r.json();
  if(!r.ok) throw new Error(tok.error_description||'Salesforce token error');
  return { access_token: tok.access_token, instance_url: session.sf.instance_url };
}

export async function lookupContact(token, email){
  const soql = `SELECT Id, Name, Title, Account.Name FROM Contact WHERE Email='${email.replace(/'/g, "\'")}' LIMIT 2`;
  const r = await sfGet(token, `/services/data/v61.0/query?q=${encodeURIComponent(soql)}`);
  return r;
}

export async function upsertContactByEmail(token, { email, firstName, lastName, charter }){
  const path = `/services/data/v61.0/sobjects/Contact/ExternalEmail__c/${encodeURIComponent(email)}`;
  const body = { FirstName: firstName||'', LastName: lastName||(email.split('@')[0]), Email: email, Charter__c: charter||null };
  const resp = await sfPatch(token, path, body);
  const contactId = resp.id || resp.Id || (resp.success && resp.id);
  const contactUrl = `${token.instance_url}/lightning/r/Contact/${contactId}/view`;
  // Get preview
  let preview = null;
  try{
    const soql = `SELECT Id, Name, Title, Account.Name FROM Contact WHERE Id='${contactId}' LIMIT 1`;
    const q = await sfGet(token, `/services/data/v61.0/query?q=${encodeURIComponent(soql)}`);
    if(q.records && q.records[0]){
      const rec = q.records[0];
      preview = { Name: rec.Name, Title: rec.Title||'', Account: rec.Account? rec.Account.Name: '' };
    }
  }catch{}
  return { contactId, contactUrl, preview };
}

export async function createTaskForContact(token, { contactId, subject, charter }){
  const body = {
    Subject: subject || 'Email sent',
    WhoId: contactId,
    Status: 'Completed',
    Description: charter ? `Charter: ${charter}` : undefined
  };
  const resp = await sfPost(token, '/services/data/v61.0/sobjects/Task', body);
  return resp.id;
}

async function sfGet(token, url){
  const r = await fetch(token.instance_url + url, { headers: { Authorization: 'Bearer '+token.access_token }});
  const j = await r.json();
  if(!r.ok) throw new Error(j[0]?.message || j.message || 'Salesforce GET error');
  return j;
}
async function sfPatch(token, url, body){
  const r = await fetch(token.instance_url + url, { method:'PATCH', headers: { Authorization: 'Bearer '+token.access_token, 'Content-Type':'application/json' }, body: JSON.stringify(body)});
  if(r.status===204){
    // No content but success; fetch Id via lookup
    const q = await lookupContact(token, body.Email);
    return { id: q.records?.[0]?.Id };
  }
  const j = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j[0]?.message || j.message || 'Salesforce PATCH error');
  return j;
}
async function sfPost(token, url, body){
  const r = await fetch(token.instance_url + url, { method:'POST', headers: { Authorization: 'Bearer '+token.access_token, 'Content-Type':'application/json' }, body: JSON.stringify(body)});
  const j = await r.json();
  if(!r.ok) throw new Error(j[0]?.message || j.message || 'Salesforce POST error');
  return j;
}
