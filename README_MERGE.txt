# Outlook-Addon: Merged Overlay

This ZIP contains only the files that changed to add **EmailMessage** logging and the new **Save Email to Salesforce** action.
Unzip this into the **root** of your existing `Outlook-Addon` repo and allow it to **overwrite** files.

Changed files:
- addin/src/taskpane.html
- addin/src/taskpane.js
- backend/src/index.js
- backend/src/salesforce.js

After overwriting:
1) Start your backend as usual (`cd backend && npm i && npm run dev`).
2) Run your HTTPS proxy and sideload the existing `manifest.xml`.
3) In the task pane you will now see a **Save Email to Salesforce** button.
