#!/bin/bash
# Script to start the backend server

cd "$(dirname "$0")/.."
source punkrecord/bin/activate
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
