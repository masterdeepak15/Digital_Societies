# Starts your society server (or updates it to the newest published image). Data stays in your data folder.
. "$PSScriptRoot\common.ps1"
Invoke-Ds pull societies
Invoke-Ds up -d societies
Write-Host "Server starting. Open http://localhost:8080 (give it about 40 seconds the first time)."
