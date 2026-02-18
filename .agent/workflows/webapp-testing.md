---
description: Test local web applications using Playwright — verify frontend functionality, debug UI behavior, capture screenshots, and view browser logs
---

# Webapp Testing Skill

This workflow uses the globally installed `webapp-testing` skill at:
`C:\Users\YZ\.antigravity\skills\skills\skills\webapp-testing`

Read the full skill instructions before proceeding:
```
C:\Users\YZ\.antigravity\skills\skills\skills\webapp-testing\SKILL.md
```

## When to Use

Use this skill when:
- Testing or verifying local web application functionality
- Debugging UI behavior or capturing browser screenshots
- Automating browser interactions with Playwright

## Decision Tree

```
Is it static HTML?
  Yes → Read HTML file → identify selectors → write Playwright script
  No (dynamic webapp) → Is server running?
    No → Use scripts/with_server.py to start server
    Yes → Reconnaissance-then-action pattern
```

## Workflow

### 1. Read the Skill

```
view_file C:\Users\YZ\.antigravity\skills\skills\skills\webapp-testing\SKILL.md
```

### 2. Start Server (if needed)

```bash
python scripts/with_server.py --server "npm run dev" --port 5173 -- python your_test.py
```

For backend + frontend:
```bash
python scripts/with_server.py \
  --server "cd backend && python server.py" --port 8000 \
  --server "cd frontend && npm run dev" --port 5173 \
  -- python your_test.py
```

### 3. Write Playwright Script

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')  # CRITICAL
    # Take screenshot for inspection
    page.screenshot(path='/tmp/inspect.png', full_page=True)
    # ... your test logic
    browser.close()
```

### 4. Reconnaissance-Then-Action

1. Navigate and wait for `networkidle`
2. Take screenshot or inspect DOM
3. Identify selectors from rendered state
4. Execute actions with discovered selectors

### 5. Key Rules

- **Always** wait for `networkidle` before inspecting dynamic apps
- Use descriptive selectors: `text=`, `role=`, CSS selectors, or IDs
- Always close the browser when done
