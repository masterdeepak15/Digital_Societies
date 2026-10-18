# Shared settings for the self-host scripts (one all-in-one image; see docs/SELFHOST.md).
# Your private settings (email account, port) live OUTSIDE the repo in <data folder>\allinone.env.
$DataRoot  = if ($env:DS_DATA_ROOT) { $env:DS_DATA_ROOT } else { 'D:\ClaudeWorkspace\ds-data' }
$EnvFile   = Join-Path $DataRoot 'allinone.env'
$ComposeDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'docker\allinone'
$Container = 'digital-societies-societies-1'
if (-not (Test-Path $EnvFile)) { throw "Missing $EnvFile. Copy infra\docker\allinone\.env.example there and fill it in (set DS_DATA_DIR to the folder for your data)." }
$env:DS_ENV_FILE = $EnvFile
function Invoke-Ds {
  param([Parameter(ValueFromRemainingArguments)] $Args)
  Push-Location $ComposeDir
  try { docker compose --env-file $EnvFile @Args }
  finally { Pop-Location }
}
