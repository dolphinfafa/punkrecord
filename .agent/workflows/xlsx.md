---
description: Create, edit, and analyze Excel (.xlsx) spreadsheets including formulas, formatting, financial models, and data analysis
---

# XLSX Skill

This workflow uses the globally installed `xlsx` skill at:
`C:\Users\YZ\.antigravity\skills\skills\skills\xlsx`

Read the full skill instructions before proceeding:
```
C:\Users\YZ\.antigravity\skills\skills\skills\xlsx\SKILL.md
```

## When to Use

Use this skill any time a spreadsheet file is the primary input or output:
- Opening, reading, editing, or fixing `.xlsx`, `.xlsm`, `.csv`, or `.tsv` files
- Creating new spreadsheets from scratch or from other data
- Cleaning or restructuring messy tabular data
- Building financial models

## Workflow

### 1. Read the Skill

```
view_file C:\Users\YZ\.antigravity\skills\skills\skills\xlsx\SKILL.md
```

### 2. Choose the Right Library

| Task | Library |
|------|---------|
| Data analysis, bulk operations | `pandas` |
| Formulas, formatting, Excel features | `openpyxl` |

### 3. CRITICAL: Use Excel Formulas, Not Hardcoded Values

```python
# ❌ WRONG
sheet['B10'] = df['Sales'].sum()  # Hardcodes value

# ✅ CORRECT
sheet['B10'] = '=SUM(B2:B9)'  # Dynamic formula
```

### 4. Common Workflow

```python
# Create/edit with openpyxl
from openpyxl import Workbook, load_workbook

wb = Workbook()
sheet = wb.active
sheet['A1'] = 'Revenue'
sheet['B1'] = '=SUM(B2:B10)'
wb.save('output.xlsx')

# Recalculate formulas (MANDATORY if using formulas)
python scripts/recalc.py output.xlsx
```

### 5. Recalculate Formulas

Always recalculate after creating/editing files with formulas:

```bash
python scripts/recalc.py output.xlsx
```

Check the JSON output for errors (`#REF!`, `#DIV/0!`, `#VALUE!`, `#NAME?`) and fix them.

### 6. Financial Model Standards

- **Blue text**: Hardcoded inputs
- **Black text**: Formulas and calculations
- **Green text**: Cross-sheet links
- **Yellow background**: Key assumptions needing attention
- **Zero formula errors**: Deliver with zero `#REF!`, `#DIV/0!`, etc.

### 7. Dependencies

```bash
pip install pandas openpyxl
# LibreOffice required for formula recalculation
```
