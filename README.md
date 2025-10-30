# Outlook ↔ Salesforce Contact Upserter (v2)

This version adds:
- **Settings UI** to enter your Salesforce **Sandbox/Prod domain**, **Client ID**, and **Client Secret** from the add-in (no code edits).
- Credentials are stored **encrypted at rest** on the backend (AES-256-GCM with a random key generated on first run).
- **No ExternalEmail__c** required. Upsert now matches **FirstName + LastName + Email + Charter__c**.
- Still includes: message-read **Send to Salesforce**, **preview** (Name/Title/Account) and **deep links**, and **OnMessageSend** (logs a Task).

> For production, protect `backend/secure-store.key` using a secrets manager (Key Vault, KMS, etc.) and store encrypted config in a database or secure storage.

## Quick start (dev)
1) Start backend:
```bash
cd backend
cp .env.example .env   # Optional; defaults are okay
npm i
npm run dev
```
The first run creates an encryption key at `backend/secure-store.key`. When you use the **Settings** UI, the Salesforce app credentials are saved encrypted in `backend/secure-store.json`.

2) HTTPS proxy (Outlook add-ins require HTTPS):
```bash
# In project root
# First time only:
#   npm i -g mkcert local-ssl-proxy
mkcert -install
mkcert localhost
local-ssl-proxy --source 3000 --target 3000 --cert localhost.pem --key localhost-key.pem
```

3) Sideload add-in
- Use `manifest.xml` to sideload (Outlook web/desktop).
- Open **Settings** from the add-in and enter your **Salesforce domain** (e.g., `https://jacanada--poc.sandbox.my.salesforce.com`), **Client ID**, **Client Secret**.
- Click **Save**, then **Connect to Salesforce** to authorize.

## Upsert logic
We query for a Contact by **FirstName + LastName + Email + Charter__c**:
```soql
SELECT Id FROM Contact
WHERE FirstName = :firstName AND LastName = :lastName
  AND Email = :email AND Charter__c = :charter
LIMIT 2
```
- If exactly 1 match → update it.
- If none → create a new Contact.
- If more than 1 → return a “multiple matches” message so the user can resolve duplicates.
