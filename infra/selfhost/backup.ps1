# Saves a full copy of the database to <your data folder>\backups (a dated .sql.gz file).
. "$PSScriptRoot\common.ps1"
docker exec $Container ds-backup
