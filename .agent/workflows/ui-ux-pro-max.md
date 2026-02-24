---
description: Generate a professional design system using the globally installed UI UX Pro Max skill.
---

# UI UX Pro Max Workflow

This workflow uses the globally installed `ui-ux-pro-max-skill`.

> **Skill 路径（按操作系统）**
> - **Windows**: `C:\Users\YZ\.antigravity\skills\ui-ux-pro-max-skill`
> - **macOS**: `/Users/yangzhe/.antigravity/skills/ui-ux-pro-max-skill`

## 1. Identify Requirements

- **Query**: What is the user trying to build? (e.g., "SaaS landing page", "Finance dashboard").
- **Stack**: What is the tech stack? (Default: `react` based on this project's frontend).

## 2. Generate Design System

Run the search script to generate the design system.

**Command**:

**Windows:**
```bash
python C:\Users\YZ\.antigravity\skills\ui-ux-pro-max-skill\src\ui-ux-pro-max\scripts\search.py "[User Query]" --design-system --format markdown --stack react
```
**macOS:**
```bash
python /Users/yangzhe/.antigravity/skills/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py "[User Query]" --design-system --format markdown --stack react
```
_(Replace `[User Query]` with the actual request, e.g., "finance management dashboard")_

**Other useful commands**:

**Windows:**
```bash
# Search by style
python C:\Users\YZ\.antigravity\skills\ui-ux-pro-max-skill\src\ui-ux-pro-max\scripts\search.py "glassmorphism" --domain style

# Search typography
python C:\Users\YZ\.antigravity\skills\ui-ux-pro-max-skill\src\ui-ux-pro-max\scripts\search.py "elegant serif" --domain typography

# Stack-specific guidelines
python C:\Users\YZ\.antigravity\skills\ui-ux-pro-max-skill\src\ui-ux-pro-max\scripts\search.py "form validation" --stack react
```
**macOS:**
```bash
# Search by style
python /Users/yangzhe/.antigravity/skills/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py "glassmorphism" --domain style

# Search typography
python /Users/yangzhe/.antigravity/skills/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py "elegant serif" --domain typography

# Stack-specific guidelines
python /Users/yangzhe/.antigravity/skills/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py "form validation" --stack react
```

## 3. Apply Design

- Read the output from the script.
- Use the generated colors, typography, and patterns to implement the user's request.
- **Critical**: Follow the "Anti-patterns" section to avoid generic AI mistakes.

## 4. Project Context

This project (`punkrecord`) is a **React + Vite** frontend with a **FastAPI** backend. When applying design:
- Use vanilla CSS (not Tailwind) per project conventions
- Target financial/enterprise aesthetics
- Maintain dark mode compatibility
