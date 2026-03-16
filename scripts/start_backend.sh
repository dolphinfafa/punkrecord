#!/bin/bash
# Script to start the backend server

cd "$(dirname "$0")/.."

# Activate conda environment
eval "$(conda shell.bash hook)"
conda activate punk

cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8085
