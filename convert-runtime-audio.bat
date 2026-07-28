@echo off
setlocal
set "AUDIO_TOOL_ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$content = Get-Content -Raw -LiteralPath '%~f0'; $script = ($content -split ':POWERSHELL_SCRIPT\r?\n', 2)[1]; Invoke-Expression $script"
exit /b %ERRORLEVEL%

:POWERSHELL_SCRIPT
$ErrorActionPreference = "Stop"

$root = $env:AUDIO_TOOL_ROOT.TrimEnd("\")
$sourceDir = Join-Path $root "source-assets\audio"
$outDir = Join-Path $root "assets\sounds"
$ffmpegCommand = Get-Command ffmpeg -ErrorAction SilentlyContinue

if (!$ffmpegCommand) {
  throw "Missing ffmpeg in PATH. Install ffmpeg or add it to PATH."
}

if (!(Test-Path -LiteralPath $sourceDir)) {
  throw "Missing source audio directory: $sourceDir"
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Get-AudioCategory($name) {
  if ($name -like "Menu_Click*" -or $name -like "Menu_Hover*" -or $name -like "Menu_SetupComlete*") { return "ui" }
  if ($name -like "Ambience_*" -or $name -like "AmbienceLoop_*" -or $name -like "Menu_*") { return "ambience" }
  if ($name -like "UI_*") { return "ui" }
  if ($name -like "Message*" -or $name -like "Radio*") { return "narration" }
  if ($name -like "FusionCore_*" -or $name -like "Core1_*" -or $name -like "Lamp*" -or $name -like "Panel1_*" -or $name -like "ControlPostBuzz*" -or $name -like "Clock*") { return "machinery" }
  if ($name -like "Footsteps*") { return "player" }
  if ($name -like "Button*" -or $name -like "Panel_Knob*" -or $name -like "Door*" -or $name -like "Motor*" -or $name -like "Beep*" -or $name -like "ControlPostAlert*") { return "interaction" }
  return "misc"
}

function Get-AudioFilter($name) {
  if ($name -eq "Menu_SetupComlete1.wav") { return "volume=12dB" }
  return $null
}

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
  $category = Get-AudioCategory $source.Name
  $categoryOutDir = Join-Path $outDir $category
  New-Item -ItemType Directory -Force -Path $categoryOutDir | Out-Null
  $targetName = [System.IO.Path]::ChangeExtension($source.Name, ".ogg")
  $targetPath = Join-Path $categoryOutDir $targetName
  if ((Test-Path -LiteralPath $targetPath) -and (Get-Item -LiteralPath $targetPath).LastWriteTimeUtc -ge $source.LastWriteTimeUtc) {
    Write-Host "[$index/$($sources.Count)] Current $category/$targetName"
    continue
  }
  Write-Host "[$index/$($sources.Count)] $($source.Name) -> $category/$targetName"
  $audioFilter = Get-AudioFilter $source.Name
  if ($audioFilter) {
    & $ffmpegCommand.Source -y -hide_banner -loglevel error -i $source.FullName -af $audioFilter -c:a libvorbis -q:a $quality $targetPath
  } else {
    & $ffmpegCommand.Source -y -hide_banner -loglevel error -i $source.FullName -c:a libvorbis -q:a $quality $targetPath
  }
  if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg failed for $($source.FullName)"
  }
}

Write-Host "Runtime audio conversion complete."
