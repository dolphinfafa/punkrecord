# PunkRecord Mini Program

This folder contains the WeChat Mini Program client for PunkRecord.

## 1. Import into WeChat DevTools

- Open WeChat DevTools.
- Import project using this directory as project path:
  - `<repo>/miniprogram`
- Configure your own mini program `appid` in `project.config.json`.

## 2. Backend API Base URL

Default base URL is defined in `app.js`:

```js
baseURL: 'http://127.0.0.1:8000/api/v1'
```

For real-device debugging, replace it with a reachable HTTPS domain and add it to the mini program request domain whitelist.

## 3. Current Feature Scope (V1)

- Login and session persistence
- Home summary dashboard
- Todo list
- Project list
- Finance overview
- Profile page and logout
- Contract and IAM mobile list pages

## 4. Structure

- `pages/` UI pages
- `services/` API services by domain
- `utils/request.js` unified request handling
- `utils/storage.js` token/user storage

## 5. Next Planned Work

- Todo state actions and leave approval flows
- Project detail/stage/member/task planning
- Finance create transaction/reimbursement flows
- Contract detail and submit actions
- IAM management actions and permission-aware UI
