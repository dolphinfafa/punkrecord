#!/usr/bin/env bash
# ─── PunkRecord Dev 环境启停脚本 ───
# 固定端口: 后端 15085, 前端 15173

BACKEND_PORT=15085
FRONTEND_PORT=15173
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_LOG="/tmp/punkrecord-backend-zheyang-dev.log"
FRONTEND_LOG="/tmp/punkrecord-frontend-zheyang-dev.log"
PYTHON="/opt/miniconda3/envs/punkrecord/bin/python"

case "${1:-start}" in
  start)
    echo "=== Starting PunkRecord Dev ==="

    # Backend
    if lsof -i :$BACKEND_PORT -t >/dev/null 2>&1; then
      echo "[Backend] Already running on port $BACKEND_PORT"
    else
      cd "$PROJECT_DIR/backend"
      nohup $PYTHON -m uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT > "$BACKEND_LOG" 2>&1 &
      echo "[Backend] Started on port $BACKEND_PORT (PID: $!)"
    fi

    # Frontend
    if lsof -i :$FRONTEND_PORT -t >/dev/null 2>&1; then
      echo "[Frontend] Already running on port $FRONTEND_PORT"
    else
      cd "$PROJECT_DIR/frontend"
      nohup npx vite > "$FRONTEND_LOG" 2>&1 &
      echo "[Frontend] Started on port $FRONTEND_PORT (PID: $!)"
    fi

    echo ""
    echo "Frontend: http://localhost:$FRONTEND_PORT/punkrecord/"
    echo "Backend:  http://localhost:$BACKEND_PORT/docs"
    echo ""
    echo "Logs:"
    echo "  tail -f $BACKEND_LOG"
    echo "  tail -f $FRONTEND_LOG"
    ;;

  stop)
    echo "=== Stopping PunkRecord Dev ==="
    # Kill backend
    PIDS=$(lsof -i :$BACKEND_PORT -t 2>/dev/null)
    if [ -n "$PIDS" ]; then
      kill $PIDS 2>/dev/null
      echo "[Backend] Stopped (port $BACKEND_PORT)"
    else
      echo "[Backend] Not running"
    fi
    # Kill frontend
    PIDS=$(lsof -i :$FRONTEND_PORT -t 2>/dev/null)
    if [ -n "$PIDS" ]; then
      kill $PIDS 2>/dev/null
      echo "[Frontend] Stopped (port $FRONTEND_PORT)"
    else
      echo "[Frontend] Not running"
    fi
    ;;

  restart)
    "$0" stop
    sleep 2
    "$0" start
    ;;

  status)
    echo "=== PunkRecord Dev Status ==="
    if lsof -i :$BACKEND_PORT -t >/dev/null 2>&1; then
      echo "[Backend]  RUNNING on port $BACKEND_PORT"
    else
      echo "[Backend]  STOPPED"
    fi
    if lsof -i :$FRONTEND_PORT -t >/dev/null 2>&1; then
      echo "[Frontend] RUNNING on port $FRONTEND_PORT"
    else
      echo "[Frontend] STOPPED"
    fi
    ;;

  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac
