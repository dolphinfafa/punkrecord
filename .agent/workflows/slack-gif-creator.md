---
description: Create animated GIFs optimized for Slack (emoji or message size) using PIL and Python
---

# Slack GIF Creator Skill

This workflow uses the globally installed `slack-gif-creator` skill at:
`C:\Users\YZ\.antigravity\skills\skills\skills\slack-gif-creator`

Read the full skill instructions before proceeding:
```
C:\Users\YZ\.antigravity\skills\skills\skills\slack-gif-creator\SKILL.md
```

## When to Use

Use this skill when:
- Creating animated GIFs for Slack (emoji or message)
- User says "make me a GIF of X for Slack"
- Animating images or creating custom Slack reactions

## Slack Requirements

| Type | Dimensions | Max Duration |
|------|-----------|--------------|
| Emoji GIF | 128×128 px | 3 seconds |
| Message GIF | 480×480 px | No strict limit |

**Parameters**: FPS 10-30, Colors 48-128

## Workflow

### 1. Read the Skill

```
view_file C:\Users\YZ\.antigravity\skills\skills\skills\slack-gif-creator\SKILL.md
```

### 2. Plan the Animation

Choose an animation concept:
- Shake/Vibrate, Pulse/Heartbeat, Bounce, Spin/Rotate
- Fade In/Out, Slide, Zoom, Explode/Particle Burst

### 3. Implement

```python
from core.gif_builder import GIFBuilder
from PIL import Image, ImageDraw

builder = GIFBuilder(width=128, height=128, fps=10)

for i in range(12):
    frame = Image.new('RGB', (128, 128), (240, 248, 255))
    draw = ImageDraw.Draw(frame)
    # Draw animation frame using PIL primitives
    builder.add_frame(frame)

builder.save('output.gif', num_colors=48, optimize_for_emoji=True)
```

### 4. Validate

```python
from core.validators import validate_gif
passes, info = validate_gif('output.gif', is_emoji=True, verbose=True)
```

### 5. Design Tips

- Use thick lines (`width=2+`) — thin lines look amateurish
- Add visual depth with gradients and layered shapes
- Use vibrant, complementary colors
- Be creative — combine animation concepts

### 6. Dependencies

```bash
pip install pillow imageio numpy
```
