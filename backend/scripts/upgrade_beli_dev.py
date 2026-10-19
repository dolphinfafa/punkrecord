"""Backup the local development database, then run migrations. Never production."""
import os
from pathlib import Path
import shutil
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.config import settings
from app.core.database import run_migrations
from app.models.base import now_cn
from app import models  # noqa: F401


def main():
    if not sys.prefix.endswith("/envs/punkrecord"):
        raise SystemExit("Use the punkrecord Conda interpreter")
    if settings.APP_ENV not in ("development", "dev", "test"):
        raise SystemExit("Development environment only")
    if settings.DB_TYPE == "mysql" and settings.DB_HOST not in ("localhost", "127.0.0.1", "::1"):
        raise SystemExit("Refusing to change a non-local database")
    folder = Path.home() / ".local" / "share" / "punkrecord-backups"
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    stamp = now_cn().strftime("%Y%m%d-%H%M%S")
    target = folder / f"pre-beli-{stamp}.sql"
    if settings.DB_TYPE == "mysql":
        env = {**os.environ, "MYSQL_PWD": settings.DB_PASSWORD}
        with target.open("wb") as output:
            target.chmod(0o600)
            result = subprocess.run(["mysqldump", "--single-transaction", "--no-tablespaces",
                "--set-gtid-purged=OFF", "--host", settings.DB_HOST, "--port", str(settings.DB_PORT),
                "--user", settings.DB_USER, settings.DB_NAME], stdout=output, stderr=subprocess.PIPE, env=env)
        if result.returncode:
            raise SystemExit("Database backup failed; migration was not started")
    else:
        import sqlite3
        with sqlite3.connect(settings.SQLITE_DB_PATH) as source, sqlite3.connect(str(target)) as backup:
            source.backup(backup)
        target.chmod(0o600)
    run_migrations()
    print(f"Development backup and migration verified. Backup: {target}")


if __name__ == "__main__":
    main()
