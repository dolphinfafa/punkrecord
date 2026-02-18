---
description: Work with PDF files — merge, split, rotate, extract text/tables, create PDFs, and perform OCR
---

# PDF Skill

This workflow uses the globally installed `pdf` skill at:
`C:\Users\YZ\.antigravity\skills\skills\skills\pdf`

Read the full skill instructions before proceeding:
```
C:\Users\YZ\.antigravity\skills\skills\skills\pdf\SKILL.md
```

## When to Use

Use this skill any time a PDF file is involved:
- Merging or splitting PDF files
- Rotating pages
- Extracting text or tables from PDFs
- Creating new PDFs programmatically
- Performing OCR on scanned PDFs

## Workflow

### 1. Read the Skill

```
view_file C:\Users\YZ\.antigravity\skills\skills\skills\pdf\SKILL.md
```

### 2. Choose the Right Tool

| Task | Tool |
|------|------|
| Extract text | `pdfplumber` or `pdftotext` |
| Extract tables | `pdfplumber` |
| Merge/split/rotate | `pypdf` or `qpdf` |
| Create PDF | `reportlab` |
| OCR scanned PDF | `pytesseract` + `pdf2image` |

### 3. Quick Start Examples

```python
# Extract text
import pdfplumber
with pdfplumber.open('file.pdf') as pdf:
    for page in pdf.pages:
        print(page.extract_text())

# Merge PDFs
from pypdf import PdfWriter
writer = PdfWriter()
for f in ['a.pdf', 'b.pdf']:
    writer.append(f)
writer.write('merged.pdf')

# Create PDF
from reportlab.pdfgen import canvas
c = canvas.Canvas('output.pdf')
c.drawString(100, 750, 'Hello World')
c.save()
```

### 4. Install Dependencies

```bash
pip install pdfplumber pypdf reportlab
# For OCR:
pip install pytesseract pdf2image
```
