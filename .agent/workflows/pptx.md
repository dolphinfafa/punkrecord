---
description: Create, edit, and analyze PowerPoint (.pptx) presentations with professional design
---

# PPTX Skill

This workflow uses the globally installed `pptx` skill at:
`C:\Users\YZ\.antigravity\skills\skills\skills\pptx`

Read the full skill instructions before proceeding:
```
C:\Users\YZ\.antigravity\skills\skills\skills\pptx\SKILL.md
```

## When to Use

Use this skill any time a `.pptx` file is involved:
- Creating slide decks, pitch decks, or presentations
- Reading or extracting text from `.pptx` files
- Editing or modifying existing presentations
- Working with templates, layouts, or speaker notes

Trigger whenever the user mentions "deck," "slides," "presentation," or references a `.pptx` filename.

## Workflow

### 1. Read the Skill

```
view_file C:\Users\YZ\.antigravity\skills\skills\skills\pptx\SKILL.md
```

### 2. Choose Your Approach

| Task | Guide |
|------|-------|
| Read/analyze content | `python -m markitdown presentation.pptx` |
| Edit from template | Read `editing.md` in skill folder |
| Create from scratch | Read `pptxgenjs.md` in skill folder |

### 3. Design Principles

- **Pick a bold color palette** specific to the topic
- **Commit to a visual motif** and repeat it across slides
- **Every slide needs a visual element** — no text-only slides
- **Vary layouts** — don't repeat the same structure
- **Avoid accent lines under titles** (AI cliché)

### 4. QA (Required)

Always run visual QA after generation:

```bash
# Extract text to check content
python -m markitdown output.pptx

# Convert to images for visual inspection
python scripts/office/soffice.py --headless --convert-to pdf output.pptx
pdftoppm -jpeg -r 150 output.pdf slide
```

Use a subagent to visually inspect slides — you'll miss issues after staring at the code.

### 5. Dependencies

```bash
pip install "markitdown[pptx]" Pillow
npm install -g pptxgenjs
# LibreOffice required for PDF conversion
```
