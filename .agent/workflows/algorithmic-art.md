---
description: Generate algorithmic art using p5.js with seeded randomness and Anthropic brand guidelines
---

# Algorithmic Art Skill

This workflow uses the globally installed `algorithmic-art` skill at:
`C:\Users\YZ\.antigravity\skills\skills\skills\algorithmic-art`

Read the full skill instructions before proceeding:
```
C:\Users\YZ\.antigravity\skills\skills\skills\algorithmic-art\SKILL.md
```

## When to Use

Use this skill when the user asks to:
- Generate algorithmic or generative art
- Create visual patterns, fractals, or procedural graphics
- Build p5.js sketches or creative coding artifacts

## Workflow

### 1. Read the Skill

Always read the SKILL.md before starting:

```
view_file C:\Users\YZ\.antigravity\skills\skills\skills\algorithmic-art\SKILL.md
```

### 2. Understand the Request

- Identify the visual concept or theme
- Determine color palette (default to Anthropic brand colors if unspecified)
- Plan the algorithm: what parameters will drive the art?

### 3. Implement with p5.js

- Use seeded randomness for reproducibility
- Expose key parameters (seed, color, density, etc.)
- Output as a self-contained HTML artifact with p5.js CDN

### 4. Key Principles

- **Seeded randomness**: Use `randomSeed()` so results are reproducible
- **Parameter tuning**: Expose meaningful parameters for variation
- **Brand alignment**: Use Anthropic colors unless user specifies otherwise
- **Performance**: Keep frame rate smooth; avoid heavy computation in `draw()`

## Example Prompts

- "Create a flowing particle system"
- "Generate a Voronoi diagram with Anthropic colors"
- "Make a recursive tree fractal"
- "Build a noise-based landscape generator"
