# Starts (or updates) your society's server. Data stays in the data folder between runs.
. "$PSScriptRoot\common.ps1"
Invoke-Ds up -d --build api minio
Write-Host "Server starting on http://localhost:8080 (health: /health). Data folder: $DataDir"
