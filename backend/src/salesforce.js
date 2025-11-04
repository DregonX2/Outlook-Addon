import fetch from 'node-fetch';
import { loadConfig } from './configStore.js';

function requireConfig(){
  const cfg = loadConfig();
  if(!cfg || !cfg.domain || !cfg.clientId || !cfg.clientSecret){
    throw new Error('Salesforce not configured. Open Settings and save your domain, client id, and client secret.');
  }
  return cfg;
}

export async function ensureToken(session){
  const cfg = requireConfig();
  if(!session.sf || !session.sf.refresh_token){
    throw new Error('Not connected to Salesforce. Use Settings → Connect.');
  }
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: session.sf.refresh_token
  });
  const r = await fetch(`${cfg.domain}/services/oauth2/token`, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: params });
  const tok = await r.json();
  if(!r.ok) throw new Error(tok.error_description||'Salesforce token error');
  return { access_token: tok.access_token, instance_url: session.sf.instance_url };
}

export async function startOAuthUrl(){
  const cfg = requireConfig();
  const redirectUri = process.env.SF_REDIRECT_URI || 'https://localhost:3000/auth/sf/callback';
  const scopes = process.env.SF_SCOPES || 'api refresh_token';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state: 'st'
  });
  return `${cfg.domain}/services/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code){
  const cfg = requireConfig();
  const redirectUri = process.env.SF_REDIRECT_URI || 'https://localhost:3000/auth/sf/callback';
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: redirectUri
  });
  const r = await fetch(`${cfg.domain}/services/oauth2/token`, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: params });
  const tok = await r.json();
  if(!r.ok) throw new Error(tok.error_description || tok.error || 'OAuth token error');
  return tok;
}

export async function lookupContactByFour(token, { email, firstName, lastName, charter }){
  const soql = `SELECT Id, Name, Title, Account.Name FROM Contact WHERE FirstName=${soqlStr(firstName)} AND LastName=${soqlStr(lastName)} AND Email=${soqlStr(email)} AND Charter__c=${soqlStr(charter)} LIMIT 2`;
  const r = await sfGet(token, `/services/data/v61.0/query?q=${encodeURIComponent(soql)}`);
  return r;
}

export async function upsertContactByFour(token, { email, firstName, lastName, charter }){
  const q = await lookupContactByFour(token, { email, firstName, lastName, charter });
  if(q.totalSize > 1){
    throw new Error('Multiple contacts matched (First/Last/Email/Charter). Please resolve duplicates in Salesforce.');
  }
  let contactId = null;
  if(q.totalSize === 1){
    contactId = q.records[0].Id;
    await sfPatch(token, `/services/data/v61.0/sobjects/Contact/${contactId}`, {
      FirstName: firstName||'',
      LastName: lastName|| (email ? email.split('@')[0] : ''),
      Email: email,
      Charter__c: charter || null
    });
  }else{
    const resp = await sfPost(token, '/services/data/v61.0/sobjects/Contact', {
      FirstName: firstName||'',
      LastName: lastName|| (email ? email.split('@')[0] : ''),
      Email: email,
      Charter__c: charter || null
    });
    contactId = resp.id;
  }
  const contactUrl = `${token.instance_url}/lightning/r/Contact/${contactId}/view`;

  // Preview
  let preview = null;
  try{
    const soql = `SELECT Id, Name, Title, Account.Name FROM Contact WHERE Id='${contactId}' LIMIT 1`;
    const q2 = await sfGet(token, `/services/data/v61.0/query?q=${encodeURIComponent(soql)}`);
    if(q2.records && q2.records[0]){
      const rec = q2.records[0];
      preview = { Name: rec.Name, Title: rec.Title||'', Account: rec.Account? rec.Account.Name: '' };
    }
  }catch{}
  return { contactId, contactUrl, preview };
}

// New: Create EmailMessage + relation to Contact
export async function createEmailMessageForContact(token, { contactId, subject, htmlBody, textBody, from, to, cc, messageDate, direction }){
  const payload = {
    Subject: subject || '',
    FromAddress: from || '',
    ToAddress: (to || []).join('; '),
    CcAddress: (cc || []).join('; '),
    HtmlBody: htmlBody || undefined,
    TextBody: (!htmlBody && textBody) ? textBody : undefined,
    MessageDate: messageDate || new Date().toISOString(),
    Incoming: direction === 'inbound'
  };
  const em = await sfPost(token, '/services/data/v61.0/sobjects/EmailMessage', payload);
  const emailId = em.id;

  // Link to Contact via EmailMessageRelation
  try{
    await sfPost(token, '/services/data/v61.0/sobjects/EmailMessageRelation', {
      EmailMessageId: emailId,
      RelationId: contactId,
      RelationType: 'ToAddress' // minimal link; SF populates participants via addresses too
    });
  }catch(e){
    // If relation creation fails, still return email id (the EmailMessage exists)
  }

  const emailUrl = `${token.instance_url}/lightning/r/EmailMessage/${emailId}/view`;
  return { emailId, emailUrl };
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

// Helpers
function soqlStr(v){
  if(v==null) return 'NULL';
  const s = String(v).replace(/'/g, "\'");
  return `'${s}'`;
}

async function sfGet(token, url){
  const r = await fetch(token.instance_url + url, { headers: { Authorization: 'Bearer '+token.access_token }});
  const j = await r.json();
  if(!r.ok) throw new Error(j[0]?.message || j.message || 'Salesforce GET error');
  return j;
}
async function sfPatch(token, url, body){
  const r = await fetch(token.instance_url + url, { method:'PATCH', headers: { Authorization: 'Bearer '+token.access_token, 'Content-Type':'application/json' }, body: JSON.stringify(body)});
  if(r.status===204){ return { success: true }; }
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
