import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const STORE = path.join(process.cwd(), '.secure-config.json');

function getKey(){
  const raw = process.env.CONFIG_KEY || 'dev-key-not-for-prod';
  return crypto.createHash('sha256').update(raw).digest();
}

function enc(val){
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(val), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

function dec(b64){
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.slice(0,12);
  const tag = buf.slice(12,28);
  const data = buf.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}

export function saveConfig(cfg){
  const payload = { s: enc(cfg) };
  fs.writeFileSync(STORE, JSON.stringify(payload, null, 2));
}

export function loadConfig(){
  try{
    const txt = fs.readFileSync(STORE, 'utf8');
    const j = JSON.parse(txt);
    return dec(j.s);
  }catch{
    return null;
  }
}
