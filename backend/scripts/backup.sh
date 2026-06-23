#!/bin/bash
# Backup script for SX Prediction DB

BACKUP_DIR="/var/backups/postgres"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/sx_prediction_db_$TIMESTAMP.sql"

echo "Starting database backup at $TIMESTAMP..."

# Execute pg_dump inside the docker container
docker exec sx-postgres pg_dump -U postgres sx_prediction_db > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "Backup successfully created: $BACKUP_FILE"
else
  echo "Backup failed!" >&2
  exit 1
fi

# Clean up backups older than 7 days
find "$BACKUP_DIR" -type f -name "*.sql" -mtime +7 -delete

echo "Old backups cleaned up."
