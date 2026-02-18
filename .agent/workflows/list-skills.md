---
description: List all available agent skills — both global and project-local.
---

# List Available Skills

## Global Skills Directory

All globally installed skills are located at `C:\Users\YZ\.antigravity\skills\`.

### 1. Check Anthropic Skills

// turbo
```powershell
Get-ChildItem "C:\Users\YZ\.antigravity\skills\skills\skills" -Directory | Select-Object Name
```

### 2. Check UI UX Pro Max Skill

// turbo
```powershell
Get-ChildItem "C:\Users\YZ\.antigravity\skills\ui-ux-pro-max-skill\src\ui-ux-pro-max" -Directory | Select-Object Name
```



## Known Skills Summary

### Global — Anthropic Skills (`C:\Users\YZ\.antigravity\skills\skills\skills\`)

| Skill | Description |
|-------|-------------|
| `algorithmic-art` | Generative art and creative coding |
| `brand-guidelines` | Brand consistency and style guides |
| `canvas-design` | Canvas-based graphics and drawing |
| `doc-coauthoring` | Collaborative document editing |
| `docx` | Word document creation |
| `frontend-design` | Distinctive UI/UX interfaces |
| `internal-comms` | Internal communication documents |
| `mcp-builder` | MCP server construction |
| `pdf` | PDF generation and processing |
| `pptx` | PowerPoint presentation creation |
| `skill-creator` | Creating new custom skills |
| `slack-gif-creator` | GIF creation for Slack |
| `theme-factory` | Design system and theme generation |
| `web-artifacts-builder` | Web app and component building |
| `webapp-testing` | Automated web app testing |
| `xlsx` | Excel spreadsheet processing |

### Global — UI UX Pro Max (`C:\Users\YZ\.antigravity\skills\ui-ux-pro-max-skill\`)

| Resource | Path |
|----------|------|
| Search script | `src\ui-ux-pro-max\scripts\search.py` |
| Data files | `src\ui-ux-pro-max\data\` |
| Templates | `src\ui-ux-pro-max\templates\` |

### Project-Local

本项目当前没有项目专属 skill（`.agent/skills/` 目录已移除）。

## How to Use a Skill

Reference the SKILL.md file path when asking the AI to use a specific skill:

```
请使用 C:\Users\YZ\.antigravity\skills\skills\skills\frontend-design\SKILL.md 中的 skill 来设计这个组件
```
