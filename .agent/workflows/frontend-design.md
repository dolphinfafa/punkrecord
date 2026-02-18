---
description: Apply the frontend-design skill to create distinctive, production-grade interfaces.
---

# Frontend Design Workflow

This workflow guides the creation of distinctive, production-grade frontend interfaces using the globally installed `frontend-design` skill at `C:\Users\YZ\.antigravity\skills\skills\skills\frontend-design`.

Before starting, read the skill instructions:
```
C:\Users\YZ\.antigravity\skills\skills\skills\frontend-design\SKILL.md
```

## 1. Analyze Requirements

- **Context**: Understand the user's request (component, page, app).
- **Goal**: Identify the problem to solve and the target audience.
- **Project Stack**: React + Vite + Vanilla CSS (this project does NOT use Tailwind).

## 2. Adopt Design Persona

- **Tone**: Choose a bold aesthetic (e.g., Brutalist, Glassmorphism, Neobrutalism, Minimalist Luxury).
- **Differentiation**: What makes this design unforgettable?
- **Constraint**: Use vanilla CSS — no Tailwind utility classes.

## 3. Aesthetic Guidelines (The "Pro Max" Standard)

- **Typography**: Use distinctive font weights and tracking. Import from Google Fonts if needed.
- **Color**: Use cohesive, bold palettes. High contrast or subtle sophisticated gradients.
- **Motion**:
  - CSS transitions for smooth state changes (`transition: all 0.2s ease`)
  - Entrance animations with `@keyframes`
  - Micro-interactions on hover/active states
- **Composition**:
  - Use generous negative space
  - Break the grid where appropriate
  - Use depth (box-shadow, layers, backdrop-filter)
- **Details**:
  - Add texture (gradients, subtle noise via SVG)
  - Glassmorphism (`backdrop-filter: blur()`, `rgba` backgrounds)
  - Custom scrollbars where appropriate

## 4. Implementation Steps

1. **Scaffold**: Create the component/page file structure
2. **Style**: Write CSS with the chosen aesthetic — create a dedicated `.css` file
3. **Interact**: Add React state and event handlers
4. **Refine**: Review against the "Generic AI" trap — is it too boring? Add more detail

## 5. Review Checklist

- [ ] Is the typography distinct (not default browser fonts)?
- [ ] Are there micro-interactions on interactive elements?
- [ ] Is the layout responsive (mobile-friendly)?
- [ ] Does it feel "Premium" — not like a generic template?
- [ ] Are animations smooth and purposeful (not distracting)?
