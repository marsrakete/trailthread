param(
  [int]$Port = 8787,
  [ValidateSet("real", "stub")]
  [string]$Mode = "real",
  [switch]$DebugLog
)

$ErrorActionPreference = "Stop"

$phpCommand = Get-Command php -ErrorAction SilentlyContinue
if (-not $phpCommand) {
  Write-Error "PHP wurde nicht gefunden. Bitte PHP installieren oder in den PATH aufnehmen."
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$router = Join-Path $root "start-komoot-proxy.php"

$env:KOMOOT_PROXY_PORT = "$Port"
$env:KOMOOT_PROXY_MODE = $Mode
$env:KOMOOT_PROXY_DEBUG = if ($DebugLog) { "1" } else { "0" }

Write-Host "TrailCanvas Komoot Proxy (PHP) laeuft auf http://localhost:$Port/ (mode: $Mode)"
Write-Host "Zum Beenden Strg+C druecken."

& $phpCommand.Source -S "localhost:$Port" $router
