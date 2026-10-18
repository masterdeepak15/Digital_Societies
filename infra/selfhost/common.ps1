# Shared settings for the self-host scripts. Edit $DataDir if your data lives somewhere else.
$DataDir  = if ($env:DS_DATA_DIR) { $env:DS_DATA_DIR } else { 'D:\ClaudeWorkspace\ds-data' }
$EnvFile  = Join-Path $DataDir 'selfhost.env'
$DockerDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'docker'
if (-not (Test-Path $EnvFile)) { throw "Missing $EnvFile. Copy infra\docker\selfhost.env.example there and fill it in." }
function Invoke-Ds {
  param([Parameter(ValueFromRemainingArguments)] $Args)
  Push-Location $DockerDir
  try { docker compose -p ds -f docker-compose.yml -f docker-compose.selfhost.yml --env-file $EnvFile @Args }
  finally { Pop-Location }
}
