# Opens a free public HTTPS address (Cloudflare quick tunnel, no account or domain) and prints it.
# The address is random and changes every time the tunnel starts: type it into the phone app's Server screen.
# While it is open, anyone who has the address can reach your server. Close it with:  .\tunnel.ps1 -Stop
param([switch]$Stop)
. "$PSScriptRoot\common.ps1"
if ($Stop) { Invoke-Ds --profile tunnel rm -sf tunnel; Write-Host 'Tunnel closed.'; return }
Invoke-Ds --profile tunnel up -d tunnel
$url = $null
for ($i = 0; $i -lt 30 -and -not $url; $i++) {
  Start-Sleep -Seconds 2
  $log = docker logs digital-societies-tunnel-1 2>&1 | Out-String
  if ($log -match 'https://[a-z0-9-]+\.trycloudflare\.com') { $url = $Matches[0] }
}
if ($url) { Write-Host "`nPublic address: $url`nEnter it in the app: Server > $url" } else { Write-Host 'No address yet. Run: docker logs digital-societies-tunnel-1' }
