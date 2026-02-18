---
description: Build elaborate multi-component HTML artifacts using React, Tailwind CSS, and shadcn/ui, bundled into a single self-contained HTML file
---

# Web Artifacts Builder Skill

This workflow uses the globally installed `web-artifacts-builder` skill at:
`C:\Users\YZ\.antigravity\skills\skills\skills\web-artifacts-builder`

Read the full skill instructions before proceeding:
```
C:\Users\YZ\.antigravity\skills\skills\skills\web-artifacts-builder\SKILL.md
```

## When to Use

Use this skill for **complex** claude.ai HTML artifacts that need:
- State management or routing
- shadcn/ui components
- Multiple React components

**Do NOT use** for simple single-file HTML/JSX artifacts.

## Stack

React 18 + TypeScript + Vite + Parcel (bundling) + Tailwind CSS + shadcn/ui

## Workflow

### Step 1: Initialize Project

```bash
bash scripts/init-artifact.sh <project-name>
cd <project-name>
```

Creates a fully configured project with React, TypeScript, Tailwind CSS, 40+ shadcn/ui components, and Parcel bundling.

### Step 2: Develop the Artifact

Edit the generated files. Key design rules:
- **Avoid**: Excessive centered layouts, purple gradients, uniform rounded corners, Inter font
- **Use**: Distinctive typography, cohesive color palettes, intentional layouts

### Step 3: Bundle to Single HTML

```bash
bash scripts/bundle-artifact.sh
```

Creates `bundle.html` — a self-contained artifact with all JS, CSS, and dependencies inlined.

### Step 4: Share with User

Share the `bundle.html` file in conversation as an artifact.

### Step 5: Test (Optional)

Only test if issues arise or user requests it. Use Playwright or the `webapp-testing` skill.

## Reference

- shadcn/ui components: https://ui.shadcn.com/docs/components
