---
description: Rules for using and maintaining project-index.md during task execution.
---

# Use Project Index

## Before Starting Any Task (Required)
1. Read `.agent/workflows/project-index.md` fully.
2. Use it to locate modules, files, and routes first.
3. Only scan directories when index details are insufficient.

## After Task Completion (When Changes Exist)
Update only impacted sections in `project-index.md`:
- Directory changes -> `Directory Map`
- Module responsibility changes -> `Core Modules`
- Data model changes -> `Key Models`
- Workflow changes -> `Critical Flows`
- Command changes -> `Common Commands`
- Convention changes -> `Conventions`

Also update `Last updated` date.

## Principles
- Index first, code second.
- Minimal updates only.
- Record what/where, not implementation internals.
