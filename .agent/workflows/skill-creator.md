---
description: Create or update agent skills that extend Claude's capabilities with specialized knowledge, workflows, or tool integrations
---

# Skill Creator Skill

This workflow uses the globally installed `skill-creator` skill at:
`C:\Users\YZ\.antigravity\skills\skills\skills\skill-creator`

Read the full skill instructions before proceeding:
```
C:\Users\YZ\.antigravity\skills\skills\skills\skill-creator\SKILL.md
```

## When to Use

Use this skill when:
- Creating a new skill to extend Claude's capabilities
- Updating or improving an existing skill
- Packaging a skill for distribution

## Six-Step Process

### Step 1: Understand with Concrete Examples

Ask the user for specific examples of how the skill will be used. Understand:
- What tasks will it handle?
- What would trigger this skill?
- What are the expected inputs and outputs?

### Step 2: Plan Reusable Contents

Analyze each example to identify what to include:
- **`scripts/`**: Code that gets rewritten repeatedly
- **`references/`**: Documentation Claude needs while working
- **`assets/`**: Templates, images, fonts used in output

### Step 3: Initialize the Skill

```bash
python scripts/init_skill.py <skill-name> --path <output-directory>
```

### Step 4: Edit the Skill

- Write `SKILL.md` with clear frontmatter `name` and `description`
- Keep SKILL.md under 500 lines — move details to reference files
- Include only what Claude doesn't already know
- Use imperative/infinitive form in instructions

### Step 5: Package the Skill

```bash
python scripts/package_skill.py <path/to/skill-folder>
```

### Step 6: Iterate

Test on real tasks, identify gaps, update and repackage.

## Key Principles

- **Concise is key**: Don't waste context window tokens
- **Progressive disclosure**: SKILL.md → references → assets
- **No README files**: Only include files Claude needs to do the job
