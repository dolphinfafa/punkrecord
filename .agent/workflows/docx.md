---
description: Create, edit, and analyze Word (.docx) documents including tracked changes, comments, tables, and images
---

# DOCX Skill

This workflow uses the globally installed `docx` skill at:
`C:\Users\YZ\.antigravity\skills\skills\skills\docx`

Read the full skill instructions before proceeding:
```
C:\Users\YZ\.antigravity\skills\skills\skills\docx\SKILL.md
```

## When to Use

Use this skill any time a `.docx` file is involved:
- Creating new Word documents
- Editing or modifying existing `.docx` files
- Adding tracked changes or comments
- Extracting text or tables from Word documents
- Converting between document formats

## Workflow

### 1. Read the Skill

```
view_file C:\Users\YZ\.antigravity\skills\skills\skills\docx\SKILL.md
```

### 2. Identify the Task

| Task | Approach |
|------|----------|
| Create new document | Use `docx-js` or `python-docx` |
| Edit existing document | Load with `python-docx`, modify, save |
| Extract text | Use `python-docx` or `markitdown` |
| Tracked changes | Read `REDLINING.md` from skill |
| Tables/images | Read skill for specific guidance |

### 3. Key Libraries

```bash
pip install python-docx
pip install "markitdown[docx]"
```

### 4. Common Operations

```python
from docx import Document

# Read
doc = Document('file.docx')
for para in doc.paragraphs:
    print(para.text)

# Create
doc = Document()
doc.add_heading('Title', 0)
doc.add_paragraph('Content here')
doc.save('output.docx')
```

### 5. Important Rules

- Preserve existing formatting when editing templates
- Use tracked changes for collaborative editing workflows
- Always verify output by extracting text after creation
