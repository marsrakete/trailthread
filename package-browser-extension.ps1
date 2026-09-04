param(
  [string]$OutputPath = (Join-Path $PSScriptRoot "downloads\trailthread-komoot-exporthelfer.zip")
)

$ErrorActionPreference = "Stop"
$sourcePath = Join-Path $PSScriptRoot "browser-extension"
$outputDirectory = Split-Path -Parent $OutputPath

if (-not (Test-Path $sourcePath -PathType Container)) {
  throw "Der Ordner browser-extension wurde nicht gefunden."
}

if (-not (Test-Path $outputDirectory -PathType Container)) {
  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

if (Test-Path $OutputPath -PathType Leaf) {
  Remove-Item -LiteralPath $OutputPath -Force
}

$extensionFiles = Get-ChildItem -Path $sourcePath -File
Compress-Archive -Path $extensionFiles.FullName -DestinationPath $OutputPath -CompressionLevel Optimal
Write-Host "Browser-Erweiterung gepackt: $OutputPath"
