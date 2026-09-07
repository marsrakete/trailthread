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
$caBundlePath = "C:\PHP\extras\ssl\cacert.pem"

$phpArguments = @()
if (Test-Path $caBundlePath -PathType Leaf) {
  $phpArguments += "-d"
  $phpArguments += "curl.cainfo=$caBundlePath"
  $phpArguments += "-d"
  $phpArguments += "openssl.cafile=$caBundlePath"
  Write-Host "TLS-CA-Bundle: $caBundlePath"
} else {
  Write-Warning "Kein TLS-CA-Bundle unter $caBundlePath gefunden. HTTPS-Logins bei Komoot können fehlschlagen."
}

$env:KOMOOT_PROXY_PORT = "$Port"
$env:KOMOOT_PROXY_MODE = $Mode
$env:KOMOOT_PROXY_DEBUG = if ($DebugLog) { "1" } else { "0" }

Write-Host "TrailCanvas Komoot Proxy (PHP) läuft auf http://localhost:$Port/ (mode: $Mode)"
Write-Host "Zum Beenden Strg+C drücken."

$phpArguments += "-S"
$phpArguments += "localhost:$Port"
$phpArguments += $router
& $phpCommand.Source @phpArguments
