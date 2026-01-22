#!/bin/bash
# Script to start the backend server

cd "$(dirname "$0")/.."
# Ensure we are using the correct pyenv version
export PYENV_VERSION=punkrecord

cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
