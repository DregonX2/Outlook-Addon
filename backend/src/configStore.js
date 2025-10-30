import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const STORE = path.join(ROOT, 'secure-store.json');
const KEYFILE = path.join(ROOT, 'secure-store.key');

function getKey(){
  if(!fs.existsSync(KEYFILE)){
    const key = crypto.randomBytes(32); // 256-bit
    fs.writeFileSync(KEYFILE, key);
    return key;
  }
  return fs.readFileSync(KEYFILE);
}

const key = getKey();

function encrypt(obj){
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj),'utf8');
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(b64){
  const buf = Buffer.from(b64,'base64');
  const iv = buf.subarray(0,12);
  const tag = buf.subarray(12,28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
}

export function saveConfig(cfg){
  const data = encrypt(cfg);
  fs.writeFileSync(STORE, data, {encoding:'utf8'});
}

export function loadConfig(){
  try{
    if(!fs.existsSync(STORE)) return null;
    const data = fs.readFileSync(STORE,'utf8');
    return decrypt(data);
  }catch{
    return null;
  }
}
