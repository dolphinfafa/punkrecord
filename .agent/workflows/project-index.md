---
description: 宸ョ▼绱㈠紩 鈥?PunkRecord 浼佷笟绠＄悊绯荤粺锛堜緵 Agent 蹇�€熷畾浣嶄唬鐮佺粨鏋勶紝姣忔�宸ヤ綔鍚庨』鏇存柊锛?
---

> **Agent 娉ㄦ剰**锛氭瘡娆″紑濮嬩换鍔″墠蹇呴』鍏堥槄璇绘湰鏂囦欢锛屽畬鎴愪换鍔″悗鑻ユ湁缁撴瀯鎬у彉鏇撮』鏇存柊瀵瑰簲绔犺妭銆?

---

## 1. 鐩�綍缁撴瀯锛? 灞傦級

```
punkrecord/
鈹溾攢鈹€ backend/                  # Python FastAPI 鍚庣�
鈹?  鈹溾攢鈹€ app/
鈹?  鈹?  鈹溾攢鈹€ api/              # 璺�敱灞傦細auth, iam, todo, contract, project, finance, ai
鈹?  鈹?  鈹溾攢鈹€ core/             # 鍩虹�璁炬柦锛歝onfig, database, auth, security, response, exceptions, init_db
鈹?  鈹?  鈹溾攢鈹€ models/           # SQLModel ORM 琛�細base, iam, todo, contract, project, finance, shared, approval
鈹?  鈹?  鈹溾攢鈹€ schemas/          # Pydantic DTO锛歵odo, contract, project, finance
鈹?  鈹?  鈹溾攢鈹€ services/         # 鏈嶅姟灞傦紙濡?docx_generator.py 绛夛級
鈹?  鈹?  鈹斺攢鈹€ utils/
鈹?  鈹溾攢鈹€ db_migrations/        # Alembic migration scripts
鈹?  鈹溾攢鈹€ tests/                # 楠岃瘉鑴氭湰
鈹?  鈹斺攢鈹€ requirements.txt
鈹溾攢鈹€ frontend/                 # React + Vite 鍓嶇�
鈹?  鈹斺攢鈹€ src/
鈹?      鈹溾攢鈹€ api/              # Axios 璇锋眰灏佽�锛堟寜妯″潡锛?
鈹?      鈹溾攢鈹€ components/
鈹?      鈹?  鈹溾攢鈹€ common/       # Modal 绛夐€氱敤缁勪欢
鈹?      鈹?  鈹溾攢鈹€ layout/       # Layout, Sidebar
鈹?      鈹?  鈹斺攢鈹€ todo/         # TodoModal, TodoDetailModal
鈹?      鈹溾攢鈹€ contexts/         # AuthContext锛堝叏灞€璁よ瘉鐘舵€侊級
鈹?      鈹溾攢鈹€ hooks/            # 鑷�畾涔?Hook
鈹?      鈹溾攢鈹€ pages/            # 椤甸潰锛歛uth, dashboard, finance, iam, contract, project, todo
鈹?      鈹斺攢鈹€ utils/
鈹溾攢鈹€ apps/api/                 # NestJS API锛堟柊鎶€鏈�爤鎺㈢储锛屼娇鐢?Prisma锛?
鈹溾攢鈹€ prd/                      # 浜у搧闇€姹傛枃妗ｏ紙00~80 缂栧彿锛?
鈹溾攢鈹€ milestone/                # 鎸夋棩鏈熻�褰曠殑閲岀▼纰?
鈹斺攢鈹€ .agent/workflows/         # Agent 宸ヤ綔娴?& 鏈�储寮曟枃浠?
```

---

## 2. 鍏抽敭妯″潡鑱岃矗

| 妯″潡 | 鍚庣�璺�敱鍓嶇紑 | 鑱岃矗 |
|------|------------|------|
| **auth** | `/api/v1` | 鐧诲綍(`/login`)銆佺櫥鍑?`/logout`)銆佸綋鍓嶇敤鎴?`/me`)锛汮WT Bearer Token |
| **iam** | `/api/v1` | 鐢ㄦ埛銆侀儴闂?OrgUnit)銆佽亴浣?JobTitle)銆佹硶浜轰富浣?OurEntity)銆佽�鑹叉潈闄愩€佺粍缁囨灦鏋勫浘 |
| **todo** | `/api/v1/todo` | 寰呭姙鍏ㄧ敓鍛藉懆鏈燂細鍒涘缓鈫掑紑濮嬧啋鎻愪氦鈫掑�鎵光啋瀹屾垚/鎷掔粷/闃诲�/蹇界暐锛涜�鍋囩敵璇峰垱寤轰笌鏌ヨ� |
| **contract** | `/api/v1` | 鍚堝悓銆佸�鎵嬫柟(Counterparty)銆佷粯娆捐�鍒?PaymentPlan)銆佸悎鍚屾彁浜ゅ�鎵?|
| **project** | `/api/v1` | 椤圭洰銆侀樁娈?Stage)銆佹垚鍛樸€佸緟鍔炲叧鑱斻€佹姤浠峰崟瀵煎嚭Excel銆佸姛鑳芥竻鍗曘€丄I鐢熸垚寮€鍙戜换鍔°€佸悎鍚岀敾甯冦€佸悎鍚學ord瀵煎嚭 |
| **finance** | `/api/v1` | 璐︽埛(FinanceAccount)銆佹敹鏀�祦姘?Transaction)銆佸彂绁?Invoice)銆佹姤閿€(Reimbursement) |
| **ai** | `/api/v1/ai` | AI 瀵硅瘽(`/chat`)銆佹祦寮忓�璇?`/chat-stream`) |

**鍓嶇�妯″潡**

| 鐩�綍 | 鑱岃矗 |
|------|------|
| `pages/auth` | 鐧诲綍椤?|
| `pages/dashboard` | 浠�〃鐩?|
| `pages/project` | 椤圭洰鍒楄〃/璇︽儏椤碉紝鍚��涓?Modal 瀛愮粍浠?|
| `pages/finance` | 璐︽埛鍒楄〃銆佹祦姘村垪琛?|
| `pages/iam` | 鐢ㄦ埛鍒楄〃銆侀儴闂ㄣ€佽亴浣嶃€佹硶浜轰富浣撱€佺粍缁囨灦鏋勫浘 |
| `pages/contract` | 鍚堝悓鍒楄〃銆佸�鎵嬫柟鍒楄〃 |
| `pages/todo` | 寰呭姙椤碉紙鍚?TodoModal銆乀odoDetailModal锛?|
| `contexts/AuthContext` | 鍏ㄥ眬鐢ㄦ埛鐘舵€併€乼oken 绠＄悊銆佽嚜鍔ㄥ埛鏂?|

---

## 3. 鏍稿績鏁版嵁妯″瀷锛堢畝鍐欙級

鎵€鏈夎〃缁ф壙 `BaseDBModel`锛堝惈 `id: UUID`, `created_at`, `updated_at`锛夈€?

```
# IAM
User: username, hashed_password, real_name, email, phone, status(active/inactive), entity_id鈫扥urEntity
OurEntity: name, type(company/branch/subsidiary), status
OrgUnit (閮ㄩ棬): name, parent_id(self-ref), entity_id, manager_id鈫扷ser
JobTitle: name, entity_id
OrgMembership: user_id, org_unit_id, job_title_id, is_primary

# Todo
TodoItem: title, description, source_type(manual/project_task), action_type, priority(low/medium/high/urgent),
          status(pending/in_progress/submitted/approved/rejected/done/blocked/dismissed),
          assignee_id鈫扷ser, reporter_id鈫扷ser, project_id鈫扨roject, due_date, started_at, completed_at
LeaveRequest: applicant_user_id鈫扷ser, leave_type(annual/maternity/marriage/personal/sick),
              status(pending/approved/rejected/cancelled), start_at, end_at, reason
User(鍋囨湡浣欓�): leave_annual_remaining(5), leave_maternity_remaining(15),
              leave_marriage_remaining(3), leave_personal_remaining(3), leave_sick_remaining(3),
              leave_balance_reset_year(鏈€杩戦噸缃�勾浠芥爣璁?

# Project
Project: name, type(internal/client), status(planning/active/on_hold/completed/cancelled),
         entity_id鈫扥urEntity, contract_id鈫扖ontract, budget, attachments(JSON)
ProjectStage: project_id, name, status(pending/active/done), order, description, attachments(JSON)
ProjectMember: project_id, user_id, role

# Contract
Counterparty: name, type(client/supplier/partner/individual), tax_id, contact_*
Contract: title, type(client/supplier/tripartite), status(draft/review/active/completed/terminated),
          our_entity_id, counterparty_id, amount, signed_date, start_date, end_date
ContractPaymentPlan: contract_id, amount, direction(inbound/outbound), due_date, status

# Finance
FinanceAccount: name, category(bank/cash/receivable/payable/equity), balance, currency, entity_id
FinanceTransaction: account_id, direction(credit/debit), amount, description, txn_date, contract_id
FinanceInvoice: transaction_id, kind(vat_special/vat_normal/receipt/other), medium(paper/digital),
                amount, invoice_no, status(ocr_pending/ocr_done/verified)
```

---

## 4. 鍏抽敭娴佺▼

### 璁よ瘉娴佺▼
1. `POST /api/v1/login` 鈫?杩斿洖 `access_token`(JWT)
2. 鍓嶇�瀛樺叆 `localStorage`锛屽悗缁��姹?Header锛歚Authorization: Bearer <token>`
3. Token 鏈夋晥鏈?1440 鍒嗛挓锛坄AuthContext` 鑷�姩鍦ㄨ繃鏈熷墠鍒锋柊锛?

### Todo 鐢熷懡鍛ㄦ湡
```
pending 鈫?[start] 鈫?in_progress 鈫?[submit] 鈫?submitted
    鈫?[approve] 鈫?done
    鈫?[reject]  鈫?rejected
in_progress / submitted 鈫?[block]   鈫?blocked
Any 鈫?[dismiss] 鈫?dismissed
```

### 宸ヤ綔鍙拌�鍋囨祦绋?
1. L0 鍛樺伐锛堟棤鐩村睘涓婄骇锛変笉鍙�彁浜よ�鍋囷紝L0 浠ヤ笅鍛樺伐鍙�彁浜?
2. 鎻愪氦璇峰亣鍚庯細
   - 鍒涘缓 `LeaveRequest`锛堢姸鎬?`pending`锛?
   - 鍦ㄢ€滃緟鎴戝�鎵光€濊�鍋囧垪琛ㄤ腑鐢辩洿灞炰富绠″�鐞?
3. 鐩村睘涓荤�瀹℃壒閫氳繃鍚庯細
   - 鍦ㄢ€滃緟鎴戝鎵光€濊鍋囧垪琛ㄤ腑鐢辩洿灞炰富绠″鐞?
3. 鐩村睘涓荤瀹℃壒閫氳繃鍚庯細
   - `LeaveRequest` 鍙樻洿涓?`approved`
   - 鎸夎鍋囩被鍨嬫墸鍑忕敵璇蜂汉鐨勫亣鏈熶綑棰?
4. 椹冲洖鍚庯細
   - `LeaveRequest` 鍙樻洿涓?`rejected`

### 椤圭洰 鈫?Todo 鍏宠仈
- `GET /projects` 项目列表
- `POST /projects` 创建项目（附带初始阶段生成）
- `GET /projects/{id}/acceptance-report/download` 下载验收报告 (docx)

#### 里程碑 & 待办 (Todos)
`project.py` `POST /projects/{id}/generate-dev-tasks` 璋冪敤 AI 鐢熸垚 `TodoItem`锛坰ource_type=project_task锛夛紝缁戝畾 project_id 鍜?stage 淇℃伅銆?

### 鍚堝悓 鈫?椤圭洰鍏宠仈
`Project.contract_id` FK 鎸囧悜 `Contract`锛沗/projects/{id}/contract-context` 鑱氬悎鍚堝悓淇℃伅鐢ㄤ簬 AI 鐢诲竷銆?

---

## 5. 甯哥敤鍛戒护

```bash
# 鍚庣锛堝湪 backend/ 鐩綍锛?
source ../punkrecord/bin/activate          # 婵€娲?venv锛圥ython 3.9锛?
uvicorn app.main:app --reload --port 8000  # 鍚姩寮€鍙戞湇鍔″櫒
alembic upgrade head                        # 杩愯杩佺Щ
alembic revision --autogenerate -m "desc"  # 鐢熸垚杩佺Щ
python create_admin.py                      # 鍒涘缓绠＄悊鍛樿处鍙?
python init_database.py                     # 鍒濆鍖栧熀纭€鏁版嵁

# 鍓嶇锛堝湪 frontend/ 鐩綍锛?
npm run dev          # 鍚姩寮€鍙戞湇鍔″櫒锛堢鍙?5173锛?
npm run build        # 鏋勫缓鐢熶骇鍖?
npm run lint         # ESLint 妫€鏌?
npm run preview      # 棰勮鐢熶骇鍖?

# 鍋ュ悍妫€鏌?
curl http://localhost:8000/health
```

---

## 6. 绾﹀畾

### 鍛藉悕
- **鍚庣鏂囦欢**锛歴nake_case锛?*鍓嶇鏂囦欢**锛歅ascalCase锛堢粍浠讹級/ camelCase锛堝伐鍏枫€乭ooks锛?
- **API 璺敱**锛歬ebab-case锛屼緥濡?`/payment-plans`, `/our-entities`
- **鏁版嵁搴撳垪**锛歴nake_case锛?*鍓嶇鍙橀噺**锛歝amelCase

### API 鍝嶅簲鏍煎紡
```json
// 鎴愬姛
{ "data": {...}, "message": "ok" }
// 閿欒锛圓tlasException锛?
{ "code": 400, "message": "鍏蜂綋閿欒淇℃伅" }
```

### 鐜鍙橀噺锛坄backend/.env`锛?
- `DB_TYPE=sqlite`锛堝紑鍙诧級/ `mysql`锛堢敓浜э級
- `SQLITE_DB_PATH=./atlas.db`
- `SECRET_KEY=...`锛圝WT 绛惧悕瀵嗛挜锛?
- `BACKEND_CORS_ORIGINS=["http://localhost:5173"]`
- `ACCESS_TOKEN_EXPIRE_MINUTES=1440`

### 鏁版嵁搴?
- **寮€鍙?*锛歋QLite锛坅tlas.db锛屽凡鍔犲叆 .gitignore锛屼笉鎻愪氦锛?
- **鐢熶骇**锛歁ySQL锛岄€氳繃 `DB_TYPE=mysql` 鍒囨崲
- ORM锛歋QLModel锛圫QLAlchemy + Pydantic锛夛紱杩佺Щ宸ュ叿锛欰lembic

### 閿欒鐮?
- `400` 鍙傛暟閿欒 / 涓氬姟閫昏緫閿欒
- `401` 鏈璇?
- `403` 鏃犳潈闄?
- `404` 璧勬簮涓嶅瓨鍦?
- `500` 鏈嶅姟鍣ㄥ唴閮ㄩ敊璇?

### 鏃ュ織鏍煎紡锛坢ain.py 涓棿浠讹級
```
馃摜 Incoming request: {METHOD} {path}
馃摛 Response status: {status_code}
鉂?Request failed: {ExceptionType}: {message}
```

---

## 7. 澧為噺鏇存柊锛?026-02-24 ~ 2026-03-01锛?

- 鏂板椤甸潰锛歚frontend/src/pages/project/DevelopmentProgressPage.jsx` + `frontend/src/pages/project/DevelopmentProgressPage.css`
- 鏂板璺敱锛歚/project/:id/dev-progress`锛堥」鐩紑鍙戝繝搴︾鐞嗛〉锛?
- 椤圭洰璇︽儏鈥渄evelopment鈥濋樁娈靛叆鍙ｆ枃妗堢敱鈥滅敓鎴愬紑鍙戜换鍔♀€濇敼涓衡€滃紑鍙戣繘搴︹€?
- 鏂板鎺ュ彛锛歚POST /api/v1/project/projects/{project_id}/todos/{todo_id}/assign`锛堜粎椤圭洰缁忕悊鍙敼鎸囨淳锛?
- 鏂板鎺ュ彛锛歚POST /api/v1/project/projects/{project_id}/todos/{todo_id}/plan`
  - 鏀寔寮€鍙戜换鍔¤鍒掑瓧娈垫洿鏂帮細`assignee_user_id`銆乣due_at`銆乣priority`
- 寮€鍙戣繘搴﹂〉鑳藉姏澧炲己锛?
  - 鏀寔璐熻矗浜恒€佹埅姝㈡棩鏈熴€佷紭鍏堢骇鍦ㄧ嚎淇敼
  - 鏀寔鎸夌被鍨嬪垎缁勬帓搴忎笌鎶樺彔锛堝墠绔?鍚庣/UI/浜у搧锛?
  - 鏀寔琛ㄦ牸瑙嗗浘涓庣敇鐗硅鍥惧垏鎹?
- 鍔熻兘娓呭崟锛團eatureListModal锛夊寮猴細
  - 鏀寔鈥滀笅杞芥ā鏉库€?
  - 鏀寔鈥滀笂浼犲鍏ワ紙Excel/CSV锛夊苟鑷姩璇嗗埆琛ㄥご瀵煎叆鈥?
  - 鍔熻兘娓呭崟瀵煎嚭鏀逛负鍓嶇鏈湴 `xlsx` 瀵煎嚭
- 寮€鍙戜换鍔＄敓鎴愯鍒欐洿鏂帮細`generate-dev-tasks` 鐢熸垚鐨?Todo 缁熶竴浣跨敤
  - `source_type=project_task`
  - `source_id={project_id}`锛堢‘淇濆彲琚」鐩換鍔″垪琛ㄥ拰杩涘害缁熻姝ｇ‘妫€绱級
  - `creator_user_id=project.pm_user_id`锛堢粺涓€鐢遍」鐩粡鐞嗕綔涓哄鏍稿憳锛?
- 璁よ瘉璇诲彇椤哄簭鏇存柊锛坄backend/app/core/auth.py`锛夛細
  - 浼樺厛浣跨敤 `Authorization: Bearer` token
  - 鏃?Bearer 鏃跺啀鍥為€€璇诲彇 cookie锛岄伩鍏嶅璐﹀彿鍒囨崲鏃惰韩浠介敊浣?
- 闄勪欢绠＄悊鏀逛负鈥滈」鐩骇鈥濆叆鍙ｏ紙浣嶄簬椤圭洰璇︽儏椤碘€滈樁娈碘€濇ā鍧楀彸涓婅鈥滈檮浠垛€濇寜閽級锛?
  - 鏀寔涓婁紶銆佷笅杞姐€佸垹闄ゅ苟鏌ョ湅鏈」鐩浉鍏抽檮浠讹紙鍚堝悓銆佸師鍨嬬‘璁ゅ崟绛夛級
  - 鏂板鎺ュ彛锛歚GET /api/v1/project/projects/{project_id}/attachments`
  - 鏂板鎺ュ彛锛歚POST /api/v1/project/projects/{project_id}/attachments`
  - 鏂板鎺ュ彛锛歚GET /api/v1/project/projects/{project_id}/attachments/{attachment_id}/download`
  - 鏂板鎺ュ彛锛歚DELETE /api/v1/project/projects/{project_id}/attachments/{attachment_id}`
  - `Project` 鏂板瀛楁锛歚attachments`锛圝SON锛屽瓨椤圭洰闄勪欢鍏冩暟鎹級
  - SQLite 鍚姩鏃惰嚜鍔ㄨˉ榻?`project.attachments` 鍒楀苟淇绌哄€硷紙鍏煎鏃у簱锛?
- 宸ヤ綔鍙版柊澧炩€滆鍋囧姛鑳解€濓細
  - 鏂板宸ヤ綔鍙拌鍋囩敵璇疯〃鍗曘€佸墿浣欏亣鏈熷睍绀恒€佹渶杩戣鍋囪褰?
  - 鏂板鈥滃緟鎴戝鎵光€濆垪琛紙鐩村睘涓荤瀹℃壒鍏ュ彛锛?
  - 瑙勫垯锛歀0 鍛樺伐鏃犻渶璇峰亣锛汱0 浠ヤ笅鐢辩洿灞炰富绠″鎵?
  - 鏂板鎺ュ彛锛歚POST /api/v1/todo/leaves`
  - 鏂板鎺ュ彛锛歚GET /api/v1/todo/leaves/my`
  - 鏂板鎺ュ彛锛歚GET /api/v1/todo/leaves/team/pending`
  - 鏂板鎺ュ彛锛歚POST /api/v1/todo/leaves/{leave_id}/approve`
  - 鏂板鎺ュ彛锛歚POST /api/v1/todo/leaves/{leave_id}/reject`
  - 鏂板妯″瀷锛歚LeaveRequest`
  - 鐢ㄦ埛妯″瀷鏂板鍋囨湡浣欓瀛楁锛圠0 鍙湪鐢ㄦ埛绠＄悊涓紪杈戯級
  - 鍙栨秷鑷姩閲嶇疆锛涙敼涓?L0 鎵嬪姩閲嶇疆
  - 鍛樺伐绠＄悊璋冩暣锛氶噸缃叆鍙ｄ粠鈥滅紪杈戝憳宸ュ脊绐椻€濊縼绉昏嚦鈥滃憳宸ョ鐞嗕富椤甸潰缁熶竴鍏ュ彛鈥濓紝鏀寔涓€閿噸缃墍鏈夊憳宸?
  - 鏂板 IAM 鎺ュ彛锛歚POST /api/v1/iam/users/reset-leave-balances`锛圠0 瑙﹀彂鍏ㄥ憳閲嶇疆锛?

---

*鏈€鍚庢洿鏂帮細2026-03-01 | 濡傛湁缁撴瀯鎬у彉鏇磋鍚屾鏇存柊鏈枃浠?

## 8. 增量更新（2026-03-01 晚间追加）

- 开发进度新增“严格同步功能清单任务”能力：
  - 新接口：`POST /api/v1/project/projects/{project_id}/sync-dev-tasks`
  - 行为：先清空该项目 `PROJECT_TASK` 再按功能清单重建，确保任务列表与功能清单严格一致。
  - 同步返回统计：`created`、`deleted`、`feature_total`、`source_stage`。
- 开发任务标题映射修复：
  - 统一为 `[后端] / [前端] / [UI] / [产品]` 前缀，不再出现 `[??]`。
- 权限策略调整（开发进度管理）：
  - 原“仅项目经理”扩展为“项目经理或项目负责人（owner）”。
  - 覆盖接口：`/todos/{todo_id}/assign`、`/todos/{todo_id}/plan`、`/sync-dev-tasks`。
  - 前端 `DevelopmentProgressPage` 同步采用 `pm || owner` 判定，并做 id 标准化比较（兼容有无连字符 UUID）。
- 开发进度页面能力补齐：
  - 新增“新建任务”“编辑任务”弹窗能力。
  - 编辑支持字段：标题、描述、负责人、优先级、截止日期、开发类型。
  - 对应后端 `ProjectTaskPlanUpdateRequest` 增加：`title`、`description`、`dev_type`。
- 项目成员角色同步修复：
  - 新增成员时若未传 `role_in_project`，自动回填用户岗位名（`JobTitle.name`），无岗位则填“项目成员”。
  - 成员列表接口增加兜底展示（空角色时按岗位名/默认值返回）。

- 数据库执行记录（atlas.db，2026-03-01）：
  - B2B 项目 `test`：清空并重建 `64 -> 64`（来源阶段：需求对齐）
  - B2C 项目 `龙虾派`：清空并重建 `30 -> 30`（来源阶段：项目立项）
  - `project_member` 空角色回填：`3 -> 0`

---

## 8. 澧為噺鏇存柊锛?026-02-27锛?

- 璐㈠姟浜ゆ槗鏄庣粏椤甸潰閲嶆瀯锛?
  - 鍏堝疄鐜扳€滄敹娆?浠樻/鎶ラ攢鈥濅笁鍒嗗尯瑙嗗浘涓庡垎鍖烘暟鎹姞杞斤紱
  - 鍚庢寜涓氬姟纭鏀逛负鍗曞叆鍙ｆ柟妗堬紝浠呬繚鐣欌€滄柊澧炰氦鏄撴槑缁嗏€濇寜閽笌缁熶竴浜ゆ槗鍒楄〃銆?
- 鏂板浜ゆ槗鏄庣粏鑳藉姏澧炲己锛?
  - 鍒涘缓浜ゆ槗寮圭獥鏀寔鈥滀笂浼犲彂绁ㄢ€濆苟闅忎氦鏄撴彁浜わ紙`attachments`锛夈€?
  - 浜ゆ槗鍒楄〃鏂板鈥滃彂绁ㄩ檮浠垛€濆垪锛屾樉绀洪檮浠舵暟閲忋€?
- 鎶ラ攢鑳藉姏钀藉湴锛堥鐗堬級锛?
  - 鏂板 `CreateReimbursementModal`锛屾敮鎸佷富浣撴潵婧愯处鎴枫€佸叧鑱斿悎鍚?椤圭洰銆佽垂鐢ㄦ槑缁嗕笌闄勪欢銆?
  - 鎶ラ攢鍒楄〃灞曠ず璐圭敤鏉＄洰鏁般€佺姸鎬佸拰閲戦銆?
- 鎺ュ彛涓庢暟鎹粨鏋勮ˉ榻愶細
  - 鍓嶇 `financeApi.listTransactions` 鏀寔閫忎紶 `txn_direction/account_id` 鏌ヨ銆?
  - 鍚庣浜ゆ槗鍒涘缓鎺ュ彛鏀寔鎺ユ敹骞跺瓨鍌?`attachments` 瀛楁銆?
  - 鎶ラ攢杩斿洖缁撴瀯琛ュ厖 `expense_lines`銆?
- 422 鍒嗛〉鍙傛暟淇锛?
  - 涓哄吋瀹瑰墠绔?`page_size=200`锛屽皢浠ヤ笅鍒楄〃鎺ュ彛鍒嗛〉涓婇檺浠?`100` 鎻愬崌鍒?`200`锛?
    - `GET /api/v1/finance/transactions`
    - `GET /api/v1/finance/invoices`
    - `GET /api/v1/finance/reimbursements`
    - `GET /api/v1/contract/contracts`
    - `GET /api/v1/project/projects`
- UI 鍙敤鎬т慨澶嶏細
  - 浜ゆ槗鍒涘缓寮圭獥澧炲姞涓撶敤鏍峰紡鏂囦欢锛岃緭鍏ユ鏀逛负娴呰壊楂樺姣旓紝淇榛戝簳鍙鎬ч棶棰橀€?

---

## 9. 澧為噺鏇存柊锛?026-02-27 杩藉姞锛?

- 浜ゆ槗鏄庣粏涓氬姟璇箟鍗囩骇锛?
  - 鏂板浜ゆ槗绫诲瀷 `txn_type`锛歚receipt` / `payment` / `reimbursement`銆?
  - 鎶ラ攢绫诲瀷缁熶竴鎸夋敮鍑烘柟鍚戝鐞嗭紙`txn_direction=out`锛夈€?
- 浜ゆ槗瀵硅薄鎵╁睍锛?
  - 鎶ラ攢鍦烘櫙鏂板 `employee_user_id`锛屼氦鏄撳璞℃敼涓洪€夋嫨鍛樺伐锛堟潵鑷敤鎴风鐞?`GET /api/v1/iam/users`锛夈€?
  - 闈炴姤閿€鍦烘櫙浠嶄娇鐢ㄥ鎵嬫柟 `counterparty_id`銆?
- 浜ゆ槗鐘舵€佷綋绯昏皟鏁达細
  - 鐘舵€佹敼涓轰笁妗ｏ細`鏈畬鎴?unreconciled)`銆乣宸插畬鎴?completed)`銆乣宸插璐?reconciled)`銆?
  - 鏂板鎺ュ彛锛歚PATCH /api/v1/finance/transactions/{txn_id}`锛屾敮鎸佸湪浜ゆ槗鏄庣粏鍒楄〃涓洿鎺ョ紪杈戠姸鎬併€?
- 璐︽埛浣欓鍙ｅ緞鏇存柊锛?
  - 璐︽埛浣欓浠呯粺璁♀€滃凡瀹屾垚/宸插璐︹€濅氦鏄擄紱鈥滄湭瀹屾垚鈥濅氦鏄撲笉鍏ヨ处銆?
- SQLite 鍏煎淇锛?
  - 鑷姩琛ラ綈 `finance_transaction.txn_type`銆乣finance_transaction.employee_user_id`銆?
  - 鍚姩鏃惰嚜鍔ㄨ鑼冨巻鍙叉灇涓惧€间簬`txn_type/reconcile_status`锛夊埌 ORM 鍙瘑鍒牸寮忥紝淇浜ゆ槗鍒楄〃 500銆?
- 鍓嶇鍙敤鎬т慨澶嶏細
  - 鎶ラ攢鍛樺伐涓嬫媺浣跨敤鐢ㄦ埛绠＄悊鍛樺伐鍒楄〃锛屼慨澶嶇┖鍒楄〃闂銆?
  - 浜ゆ槗鍒楄〃鐘舵€侀€夋嫨鍣ㄦ敼涓烘祬鑹插繝瀵规瘮鏍峰紡锛屼慨澶嶉粦鑹蹭笉鍙銆?
  - 璐㈠姟椤?IAM 鐢ㄦ埛璇锋眰 `page_size` 璋冩暣涓?100锛屼慨澶?422銆?

---

## 10. 增量更新（2026-02-28）

- 项目管理新增“原型确认单”能力（原型确认阶段）：
  - 新增前端组件：frontend/src/pages/project/components/PrototypeConfirmModal.jsx
  - 项目经理填写“原型地址/设计地址”后可保存并导出 Word；
  - 模板包含确认说明、范围边界、签署栏，统一文档样式。

- 项目管理测试阶段新增“Bug 管理”能力，并与待办打通：
  - 新增前端组件：frontend/src/pages/project/components/BugManagementModal.jsx
  - 项目详情 testing 阶段新增入口“Bug管理”；
  - Bug 作为项目任务进行追踪（source_type=project_task + tags=bug/testing）；
  - 新建 Bug 时同时镜像创建一条开发人员 custom 待办，确保在“我的任务”可见；
  - 新建表单新增“测试员（创建人/审核人）+ 开发人员（待办接收人）”；
  - 约束：仅所选测试员本人可创建（保证创建人与审核人为测试员）。

- Bug 管理增强：
  - 新增“提交验收后审核通过”按钮（pending_review -> done，调用 todoApi.approve）；
  - 新增“删除 Bug”按钮（带二次确认）。

- 后端新增项目任务删除接口（供 Bug 删除复用）：
  - DELETE /api/v1/project/projects/{project_id}/todos/{todo_id}
  - 权限：项目经理 / 项目负责人 / 任务创建人。

- 待办页面可见性与信息增强：
  - Todo 列表请求分页参数调整为 page_size=100（避免超限 422）；
  - 待办卡片与列表新增“项目”标签（优先 todo.link.project_name，兜底“项目任务”）。


---

## 11. Incremental Update (2026-02-28 Night, User Points)

- Added user points management in IAM (unit: Beli).
  - `User` now has `beili_balance` (default 0).
  - User list includes a Beli balance column.
  - L0 admin can manually adjust Beli balance in user edit.

- Added Beli rule model and APIs.
  - Fields: `name`, `enabled`, `early_days`, `reward_beili`, `late_days`, `penalty_beili`, `note`.
  - Endpoints:
    - `GET /api/v1/iam/beli-rules`
    - `POST /api/v1/iam/beli-rules` (L0)
    - `PATCH /api/v1/iam/beli-rules/{rule_id}` (L0)
    - `DELETE /api/v1/iam/beli-rules/{rule_id}` (L0)

- Linked todo completion with Beli settlement.
  - Apply enabled rules based on due date vs done date.
  - Reward for early completion, penalty for late completion.
  - Idempotency via `todo.link.beli_applied`.
  - Audit fields saved in `todo.link`: `beli_delta`, `beli_days_diff`, `beli_rule_hits`, `beli_applied_at`.

---

## 12. Incremental Update (2026-02-28 Late Night, Beli Rule Refinement)

- Separated Beli rule management as an independent IAM module.
  - New page: `/iam/beli-rules`.
  - Navigation now shows it in parallel with Users / Departments / Job Titles.

- Added rule type support for Beli rules.
  - New field: `rule_type`.
  - Current supported value: `task_timeliness` (task early/late completion).
  - UI supports selecting rule type when creating/editing rules.

- Updated settlement semantics to threshold-based one-time trigger.
  - Not "every X days" accumulation.
  - Once threshold is met, apply one reward/penalty hit.
  - If multiple rules match in the same direction, choose the best threshold match only.

- Changed admin employee Beli operation from absolute override to delta adjustment.
  - New update payload: `beili_adjust_action` + `beili_adjust_amount`.
  - Actions: `add` / `subtract`.

## 14. Incremental Update (2026-03-01, Alembic Startup Migration)

- Refactored backend startup DB compatibility flow from inline SQL backfill to Alembic migration execution.
- Updated backend/app/core/database.py:
  - Removed _ensure_legacy_columns runtime backfill path.
  - Added run_migrations() and executed alembic upgrade head during startup init.
- Added Alembic config: backend/alembic.ini.
- Added migration script directory: backend/db_migrations/ (env.py + versions/).
- Added migration script: backend/db_migrations/versions/20260301_0001_legacy_compatibility_fixes.py.
- Migration script covers legacy schema/data compatibility for: user, beli_rule, project, project_stage, finance_transaction.

---

## 15. Incremental Update (2026-03-01, Acceptance Report)
- Added Acceptance Report endpoint for B2B Project Delivery Stage using `python-docx`
  - `GET /projects/{project_id}/acceptance-report/download`
  - `backend/app/services/docx_generator.py` service
  - Frontend: `projectApi.downloadAcceptanceReport`
