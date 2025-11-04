# Outlook-Addon (Full, merged)
Complete repo with EmailMessage saving and Contact upsert.

## Run (dev)
```bash
cd backend
npm install
npm run dev
```
Serve the add-in over HTTPS (e.g., mkcert + simple proxy on port 3001) so the manifest URLs work.

## Configure Salesforce
- Connected App scopes: `api`, `refresh_token`
- Callback URL: `https://localhost:3000/auth/sf/callback`
- If using Okta SSO: configure Salesforce SSO with Okta; users will authenticate at Okta during `/auth/sf/login`.

## Use
- Sideload `manifest.xml` into Outlook.
- Open an email → **Send to Salesforce**.
- In the task pane, choose a **Charter**, then:
  - **Upsert Contact** (by sender email + Charter)
  - **Save Email to Salesforce** (creates `EmailMessage` linked to the Contact)
