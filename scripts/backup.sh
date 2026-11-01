#!/usr/bin/env bash
# BLC Nexus database + uploads backup.
# Usage: DATABASE_URL=postgresql://... ./scripts/backup.sh [output-dir]
# Schedule it with cron, e.g. daily at 03:00:  0 3 * * * cd /srv/blc-nexus && ./scripts/backup.sh
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL (use the plain postgresql:// URL, without ?schema=...)}"
OUT_DIR="${1:-./backups}"
UPLOAD_DIR="${UPLOAD_DIR:-./backend/uploads}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT_DIR"

# pg_dump rejects Prisma's ?schema= query parameter, so strip it.
PG_URL="${DATABASE_URL%%\?*}"

echo "Dumping database..."
pg_dump --no-owner --format=custom --file "$OUT_DIR/blc-nexus-db-$STAMP.dump" "$PG_URL"

if [ -d "$UPLOAD_DIR" ]; then
  echo "Archiving uploads..."
  tar -czf "$OUT_DIR/blc-nexus-uploads-$STAMP.tar.gz" -C "$UPLOAD_DIR" .
fi

# Keep the 14 most recent backups of each kind.
ls -1t "$OUT_DIR"/blc-nexus-db-*.dump 2>/dev/null | tail -n +15 | xargs -r rm --
ls -1t "$OUT_DIR"/blc-nexus-uploads-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm --

echo "Backup complete: $OUT_DIR (stamp $STAMP)"
echo "Restore with: pg_restore --clean --if-exists --no-owner -d <DATABASE_URL> <dump file>"
