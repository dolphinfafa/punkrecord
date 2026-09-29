#!/usr/bin/env bash
# Start the development backend with the project's pinned Conda interpreter.

cd "$(dirname "$0")/.."
cd backend

PYTHON="/opt/miniconda3/envs/punkrecord/bin/python"
exec "$PYTHON" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 15085
