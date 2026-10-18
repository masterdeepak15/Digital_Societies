# Saves a full copy of the database to <data folder>\backups (a .sql file named with today's date).
. "$PSScriptRoot\common.ps1"
$file = Join-Path $DataDir ("backups\ds-{0}.sql" -f (Get-Date -Format 'yyyy-MM-dd-HHmm'))
docker exec ds-postgres-1 pg_dump -U ds_app -d digital_societies --no-owner | Out-File -Encoding utf8 $file
Write-Host "Backup written: $file ($([math]::Round((Get-Item $file).Length/1KB)) KB)"
