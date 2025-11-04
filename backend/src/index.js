import express from 'express';
import session from 'cookie-session';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { saveConfig, loadConfig } from './configStore.js';
import { ensureToken, startOAuthUrl, exchangeCodeForToken, upsertContactByFour, createTaskForContact, createEmailMessageForContact } from './salesforce.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(session({ name: 'sess', keys: [process.env.SESSION_SECRET||'dev'], maxAge: 7*24*60*60*1000 }));

// Serve add-in static assets
app.use('/addin', express.static(path.join(__dirname, '../../addin')));

app.get('/healthz', (_req,res)=>res.send('ok'));

// ----- Settings (encrypted) -----
app.get('/api/config', (req,res)=>{
  const cfg = loadConfig() || {};
  res.json({ domain: cfg.domain || '', clientId: cfg.clientId || '' }); // never return clientSecret
});

app.post('/api/config', (req,res)=>{
  const { domain, clientId, clientSecret } = req.body || {};
  if(!domain || !clientId || !clientSecret){
    return res.status(400).json({ ok:false, error:'Please provide domain, clientId, and clientSecret.' });
  }
  try{
    saveConfig({ domain: String(domain).trim(), clientId: String(clientId).trim(), clientSecret: String(clientSecret).trim() });
    res.json({ ok:true });
  }catch(e){
    res.status(500).json({ ok:false, error: e.message });
  }
});

// ----- OAuth -----
app.get('/auth/sf/login', async (_req,res)=>{
  try{
    const url = await startOAuthUrl();
    res.redirect(url);
  }catch(e){
    res.status(500).send(String(e.message||e));
  }
});

app.get('/auth/sf/callback', async (req,res)=>{
  try{
    const { code } = req.query;
    const tok = await exchangeCodeForToken(code);
    req.session.sf = { refresh_token: tok.refresh_token, instance_url: tok.instance_url, id: tok.id };
    res.send('Salesforce connected. You can close this window.');
  }catch(e){
    res.status(500).send('OAuth error: ' + String(e.message||e));
  }
});

// ----- Me prefs -----
app.get('/api/me', (req,res)=>{
  res.json({ defaultCharter: req.session.defaultCharter||'' });
});
app.post('/api/me/charter-default', (req,res)=>{
  req.session.defaultCharter = req.body.value;
  res.json({ ok: true });
});

// ----- Salesforce endpoints -----
app.post('/api/sf/upsert-contact', async (req,res)=>{
  try{
    const token = await ensureToken(req.session);
    const { email, firstName, lastName, charter } = req.body;
    const { contactId, contactUrl, preview } = await upsertContactByFour(token, { email, firstName, lastName, charter });
    res.json({ ok:true, contactId, contactUrl, preview });
  }catch(e){
    res.status(500).json({ ok:false, error: e.message });
  }
});

// Existing: log-activity (Task)
app.post('/api/sf/log-activity', async (req,res)=>{
  try{
    const token = await ensureToken(req.session);
    const { email, subject, charter } = req.body;
    const { contactId } = await upsertContactByFour(token, { email, firstName:'', lastName:'', charter });
    const taskId = await createTaskForContact(token, { contactId, subject, charter });
    res.json({ ok:true, taskId });
  }catch(e){
    res.status(500).json({ ok:false, error: e.message });
  }
});

// New: save-email as EmailMessage and link to Contact
app.post('/api/sf/save-email', async (req,res)=>{
  try{
    const token = await ensureToken(req.session);
    const { senderEmail, subject, htmlBody, textBody, to, cc, messageDate, direction, charter } = req.body || {};
    // Upsert Contact by sender email; name unknown here (we only have address)
    const { contactId } = await upsertContactByFour(token, { email: senderEmail, firstName:'', lastName:'', charter });
    const { emailId, emailUrl } = await createEmailMessageForContact(token, {
      contactId,
      subject,
      htmlBody,
      textBody,
      from: senderEmail,
      to,
      cc,
      messageDate,
      direction
    });
    res.json({ ok:true, emailId, emailUrl, contactId });
  }catch(e){
    res.status(500).json({ ok:false, error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, ()=>{
  console.log('Server on http://localhost:'+port);
  console.log('Add-in assets at https://localhost:'+port+'/addin/src/taskpane.html (via SSL proxy)');
  console.log('Open Settings at https://localhost:'+port+'/addin/src/settings.html after SSL proxy is up.');
});
