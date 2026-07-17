@echo off
setlocal
set "AUDIO_TOOL_ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$content = Get-Content -Raw -LiteralPath '%~f0'; $script = ($content -split ':POWERSHELL_SCRIPT\r?\n', 2)[1]; Invoke-Expression $script"
exit /b %ERRORLEVEL%

:POWERSHELL_SCRIPT
$ErrorActionPreference = "Stop"

$root = $env:AUDIO_TOOL_ROOT.TrimEnd("\")
$sourceDir = Join-Path $root "asset-source\audio"
$outDir = Join-Path $root "assets\sounds"
$ffmpegCommand = Get-Command ffmpeg -ErrorAction SilentlyContinue

if (!$ffmpegCommand) {
  throw "Missing ffmpeg in PATH. Install ffmpeg or add it to PATH."
}

if (!(Test-Path -LiteralPath $sourceDir)) {
  throw "Missing source audio directory: $sourceDir"
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$quality = 4
$sources = Get-ChildItem -LiteralPath $sourceDir -File -Filter "*.wav" | Sort-Object Name

if ($sources.Count -eq 0) {
  Write-Host "No .wav files found in $sourceDir"
  exit 0
}

Write-Host "Runtime audio conversion"
Write-Host "  Source: $sourceDir"
Write-Host "  Output: $outDir"
Write-Host "  Codec:  Ogg Vorbis q=$quality"

$index = 0
foreach ($source in $sources) {
  $index++
  $targetName = [System.IO.Path]::ChangeExtension($source.Name, ".ogg")
  $targetPath = Join-Path $outDir $targetName
  Write-Host "[$index/$($sources.Count)] $($source.Name) -> $targetName"
  & $ffmpegCommand.Source -y -hide_banner -loglevel error -i $source.FullName -c:a libvorbis -q:a $quality $targetPath
  if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg failed for $($source.FullName)"
  }
}

Write-Host "Runtime audio conversion complete."
