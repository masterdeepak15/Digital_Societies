# Stops everything. Nothing is deleted: start.ps1 brings it all back with the same data.
. "$PSScriptRoot\common.ps1"
Invoke-Ds --profile tunnel down
