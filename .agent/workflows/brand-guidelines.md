---
description: Apply Anthropic brand guidelines (colors, typography) to any artifact or document
---

# Brand Guidelines Skill

This workflow uses the globally installed `brand-guidelines` skill.

> **Skill 路径（按操作系统）**
> - **Windows**: `C:\Users\YZ\.antigravity\skills\skills\skills\brand-guidelines`
> - **macOS**: `/Users/yangzhe/.antigravity/skills/brand-guidelines`

Read the full skill instructions before proceeding:

**Windows:** `view_file C:\Users\YZ\.antigravity\skills\skills\skills\brand-guidelines\SKILL.md`
**macOS:** `view_file /Users/yangzhe/.antigravity/skills/brand-guidelines/SKILL.md`

## When to Use

Use this skill when:
- Applying consistent brand styling to any artifact (slides, docs, HTML, etc.)
- Ensuring color and typography match Anthropic's brand identity
- Creating branded materials that need to look official

## Brand Tokens

### Colors
- **Primary**: Refer to SKILL.md for exact hex values
- **Accent**: Refer to SKILL.md for exact hex values

### Typography
- **Headings**: Poppins
- **Body**: Lora

## Workflow

### 1. Read the Skill

**Windows:** `view_file C:\Users\YZ\.antigravity\skills\skills\skills\brand-guidelines\SKILL.md`
**macOS:** `view_file /Users/yangzhe/.antigravity/skills/brand-guidelines/SKILL.md`

### 2. Identify the Artifact Type

- Slides (PPTX) → apply colors to backgrounds, text, and shapes
- Documents (DOCX) → apply fonts and heading styles
- HTML/CSS → inject CSS variables for brand colors and Google Fonts

### 3. Apply Brand Styles

- Use CSS variables or theme tokens for consistency
- Load Poppins and Lora from Google Fonts for web artifacts
- Maintain contrast ratios for accessibility

### 4. Verify

- Check all text uses brand typography
- Confirm color usage matches brand palette
- Ensure no off-brand fonts or colors remain
