---
description: Python environment setup and execution requirements
---

# Python Environment Configuration

This project requires running Python scripts in a specific virtual environment depending on the operating system.

## Environment Requirements

### macOS
- **Environment Manager**: pyenv
- **Virtual Environment**: `punkrecord`
- **Activation**: The environment should be activated before running any Python commands
- **Command prefix**: Use `pyenv activate punkrecord` or ensure the environment is active

### Windows
- **Environment Manager**: conda
- **Virtual Environment**: `punkrecord`
- **Activation**: The environment should be activated before running any Python commands
- **Command prefix**: Use `conda activate punkrecord` or ensure the environment is active

## Running Python Commands

When executing Python scripts or commands in this project:

1. **Always check the operating system first**
2. **Activate the appropriate virtual environment**:
   - macOS: `pyenv activate punkrecord`
   - Windows: `conda activate punkrecord`
3. **Run your Python command**

## Examples

### Running backend server
```bash
# macOS
pyenv activate punkrecord
python backend/main.py

# Windows
conda activate punkrecord
python backend/main.py
```

### Running database initialization
```bash
# macOS
pyenv activate punkrecord
python backend/init_database.py

# Windows
conda activate punkrecord
python backend/init_database.py
```

### Installing dependencies
```bash
# macOS
pyenv activate punkrecord
pip install -r backend/requirements.txt

# Windows
conda activate punkrecord
pip install -r backend/requirements.txt
```

## Important Notes

- **Never run Python commands without activating the virtual environment first**
- The virtual environment name is always `punkrecord` regardless of OS
- Only the environment manager differs between macOS (pyenv) and Windows (conda)
- When proposing commands, always include the environment activation step
