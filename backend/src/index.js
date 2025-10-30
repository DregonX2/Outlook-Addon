import express from 'express';
import fetch from 'node-fetch';
import session from 'cookie-session';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureToken, upsertContactByEmail, lookupContact, createTaskForContact } from './salesforce.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(session({ name: 'sess', keys: [process.env.SESSION_SECRET||'dev'], maxAge: 7*24*60*60*1000 }));

app.use('/addin', express.static(path.join(__dirname, '../../addin')));

app.get('/healthz', (_req,res)=>res.send('ok'));

app.get('/auth/sf/login', (req,res)=>{
  const state = 'st';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SF_CLIENT_ID,
    redirect_uri: process.env.SF_REDIRECT_URI,
    scope: process.env.SF_SCOPES||'api refresh_token',
    state
  });
  res.redirect(`${process.env.SF_LOGIN_URL}/services/oauth2/authorize?${params.toString()}`);
});

app.get('/auth/sf/callback', async (req,res)=>{
  const { code } = req.query;
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: process.env.SF_CLIENT_ID,
    client_secret: process.env.SF_CLIENT_SECRET,
    redirect_uri: process.env.SF_REDIRECT_URI
  });
  const r = await fetch(`${process.env.SF_LOGIN_URL}/services/oauth2/token`, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: params });
  const tok = await r.json();
  if(!r.ok){ return res.status(500).json(tok); }
  req.session.sf = { refresh_token: tok.refresh_token, instance_url: tok.instance_url, id: tok.id };
  res.send('Salesforce connected. You can close this window.');
});

app.get('/api/me', (req,res)=>{
  res.json({ defaultCharter: req.session.defaultCharter||'' });
});
app.post('/api/me/charter-default', (req,res)=>{
  req.session.defaultCharter = req.body.value;
  res.json({ ok: true });
});

app.post('/api/sf/upsert-contact', async (req,res)=>{
  try{
    const token = await ensureToken(req.session);
    const { email, firstName, lastName, charter } = req.body;
    const { contactId, contactUrl, preview } = await upsertContactByEmail(token, { email, firstName, lastName, charter });
    res.json({ ok:true, contactId, contactUrl, preview });
  }catch(e){
    res.status(500).json({ ok:false, error: e.message });
  }
});

app.post('/api/sf/log-activity', async (req,res)=>{
  try{
    const token = await ensureToken(req.session);
    const { email, subject, charter } = req.body;
    const { contactId } = await upsertContactByEmail(token, { email, firstName:'', lastName:'', charter });
    const taskId = await createTaskForContact(token, { contactId, subject, charter });
    res.json({ ok:true, taskId });
  }catch(e){
    res.status(500).json({ ok:false, error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, ()=>{
  console.log('Server on https://localhost:'+port);
  console.log('Add-in assets at https://localhost:'+port+'/addin/src/taskpane.html');
  console.log('Connect Salesforce at https://localhost:'+port+'/auth/sf/login');
});
