# Outlook ↔ Salesforce Contact Upserter

Cross-platform Outlook Web Add-in + Node/Express backend that:
- Adds a **Send to Salesforce** button on message read.
- Reads sender (first, last, email) and a **Charter** dropdown.
- **Upserts** a Salesforce Contact (update if email exists, otherwise create).
- Shows a **preview** if a match is found (Name, Title, Account).
- Adds an **OnMessageSend** event so while composing you can set Charter and log an **Activity** in Salesforce.
- Returns **deep links** to the Contact.

> This project is intended for development sideloading. Replace `localhost` with your HTTPS domain when deploying.

## Quick start

### 1) Salesforce
1. Create a **Connected App** (OAuth 2.0, enable refresh tokens).
2. (Recommended) Create a Contact field **ExternalEmail__c** (Text, Unique, External ID, Case-insensitive).
3. Create an optional **Charter__c** picklist on Contact to persist the Charter value.
4. Note the **Consumer Key** and **Consumer Secret**.

### 2) Backend
```bash
cd backend
cp .env.example .env
# Fill in SF_* values
npm i
npm run dev
```
This serves APIs on http://localhost:3000 and static add-in assets from `/addin/src`.

### 3) Outlook Add-in
- Open `manifest.xml` and ensure:
  - `<Hosts>` includes Outlook
  - `<SourceLocation>` and icon URLs point to your dev server (https://localhost:3000)
- Enable HTTPS locally (e.g., dev cert + reverse proxy) or update the manifest to match your server URL.
- Sideload into Outlook for Web/Desktop (see Microsoft docs).

### 4) Flows
- **Send to Salesforce (Read mode):**
  1. Click the ribbon button.
  2. Choose **Charter**, submit.
  3. If a Contact with that email exists → update + preview (Name/Title/Account) and deep link.
  4. If none → create Contact, show link.
- **OnMessageSend (Compose mode):**
  - When sending an email, a dialog asks for **Charter**. On confirm, an **Activity (Task)** is created on the matched/new Contact.

### 5) Security
- The add-in never stores Salesforce passwords.
- Backend holds refresh tokens in a cookie session (dev). Use a secrets manager & DB in prod.

### 6) Icons
Placeholder icons are included in `addin/assets/`. Replace with your branding.

---

## Environment (.env)
See `backend/.env.example` for all variables.
