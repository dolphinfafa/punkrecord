---
description: Python environment setup and execution requirements for this project.
---

# Python Environment

## Requirements
- macOS: `pyenv`, environment name `punkrecord`
- Windows: `conda`, environment name `punkrecord`

## Command Rules
1. Detect OS first.
2. Activate environment before any Python command.
3. Run Python command only after activation.

## Activation
```bash
# macOS
pyenv activate punkrecord

# Windows
conda activate punkrecord
```

## Notes
- Never run project Python commands outside the `punkrecord` environment.
- If shell activation is unavailable, use an equivalent isolated execution method.
