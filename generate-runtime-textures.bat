@echo off
setlocal
set "TEXTURE_TOOL_ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$content = Get-Content -Raw -LiteralPath '%~f0'; $script = ($content -split ':POWERSHELL_SCRIPT\r?\n', 2)[1]; Invoke-Expression $script"
exit /b %ERRORLEVEL%

:POWERSHELL_SCRIPT
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = $env:TEXTURE_TOOL_ROOT.TrimEnd("\")
$assets = Join-Path $root "assets"
$outDir = Join-Path $assets "runtime-textures"
$tmpDir = Join-Path $outDir "_tmp"
$basisu = Join-Path $root "node_modules\basisu\bin\win\x64_sse\basisu.exe"

if (!(Test-Path -LiteralPath $basisu)) {
  throw "Missing basisu encoder. Run: npm install"
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

$jobs = @(
  @{ Source = "T_Panel1_BaseColor.png"; Prefix = "T_Panel1_BaseColor_Critical"; Preview = 1024; Mode = "srgb"; Quality = 190 },
  @{ Source = "T_Panel1_Normal.png"; Prefix = "T_Panel1_Normal_Critical"; Preview = 1024; Mode = "normal"; Quality = 200 },
  @{ Source = "T_Panel1_OcclusionRoughnessMetallic.png"; Prefix = "T_Panel1_OcclusionRoughnessMetallic_Critical"; Preview = 1024; Mode = "linear"; Quality = 190 },

  @{ Source = "T_Interior1_BaseColor.png"; Prefix = "T_Interior1_BaseColor_Background"; Preview = 1024; Mode = "srgb"; Quality = 170 },
  @{ Source = "T_Interior1_Normal.png"; Prefix = "T_Interior1_Normal_Background"; Preview = 1024; Mode = "normal"; Quality = 190 },
  @{ Source = "T_Interior1_OcclusionRoughnessMetallic.png"; Prefix = "T_Interior1_OcclusionRoughnessMetallic_Background"; Preview = 1024; Mode = "linear"; Quality = 170 },
  @{ Source = "T_Interior1_Mask_Mask.png"; Prefix = "T_Interior1_Mask_Background"; Preview = 1024; Mode = "linear"; Quality = 190; KeepPreviewPng = $true },

  @{ Source = "T_Bricks1Old_BaseColor.png"; Prefix = "T_Bricks1Old_BaseColor_Background"; Preview = 1024; Mode = "srgb"; Quality = 180 },
  @{ Source = "T_Bricks1Old_Normal.png"; Prefix = "T_Bricks1Old_Normal_Background"; Preview = 1024; Mode = "normal"; Quality = 195 },
  @{ Source = "T_Bricks1Old_ORM.png"; Prefix = "T_Bricks1Old_ORM_Background"; Preview = 1024; Mode = "linear"; Quality = 180 },

  @{ Source = "T_Details1_BaseColor.png"; Prefix = "T_Details1_BaseColor_Secondary"; Preview = 1024; Mode = "srgb"; Quality = 180 },
  @{ Source = "T_Details1_Normal.png"; Prefix = "T_Details1_Normal_Secondary"; Preview = 1024; Mode = "normal"; Quality = 195 },
  @{ Source = "T_Details1_OcclusionRoughnessMetallic.png"; Prefix = "T_Details1_OcclusionRoughnessMetallic_Secondary"; Preview = 1024; Mode = "linear"; Quality = 180 },

  @{ Source = "T_Pipes1_BaseColor.png"; Prefix = "T_Pipes1_BaseColor_Secondary"; Preview = 1024; Mode = "srgb"; Quality = 185 },
  @{ Source = "T_Pipes1_Normal.png"; Prefix = "T_Pipes1_Normal_Secondary"; Preview = 1024; Mode = "normal"; Quality = 200 },
  @{ Source = "T_Pipes1_OcclusionRoughnessMetallic.png"; Prefix = "T_Pipes1_OcclusionRoughnessMetallic_Secondary"; Preview = 1024; Mode = "linear"; Quality = 185 },

  @{ Source = "T_DoorLamp1_BaseColor.png"; Prefix = "T_DoorLamp1_BaseColor_Interactive"; Preview = 1024; Mode = "srgb"; Quality = 190 },
  @{ Source = "T_DoorLamp1_Normal.png"; Prefix = "T_DoorLamp1_Normal_Interactive"; Preview = 1024; Mode = "normal"; Quality = 200 },
  @{ Source = "T_DoorLamp1_OcclusionRoughnessMetallic.png"; Prefix = "T_DoorLamp1_OcclusionRoughnessMetallic_Interactive"; Preview = 1024; Mode = "linear"; Quality = 190 },
  @{ Source = "T_DoorLamp1_Emissive.png"; Prefix = "T_DoorLamp1_Emissive_Interactive"; Preview = 512; Mode = "srgb"; Quality = 170 },

  @{ Source = "T_Lamp1_BaseColor.png"; Prefix = "T_Lamp1_BaseColor_Critical"; Preview = 512; Mode = "srgb"; Quality = 190 },
  @{ Source = "T_Lamp1_Normal.png"; Prefix = "T_Lamp1_Normal_Critical"; Preview = 512; Mode = "normal"; Quality = 200 },
  @{ Source = "T_Lamp1_OcclusionRoughnessMetallic.png"; Prefix = "T_Lamp1_OcclusionRoughnessMetallic_Critical"; Preview = 512; Mode = "linear"; Quality = 190 },
  @{ Source = "T_Lamp1_Emissive.png"; Prefix = "T_Lamp1_Emissive_Critical"; Preview = 512; Mode = "srgb"; Quality = 170 }
)

function Save-ResizedPng($sourcePath, $targetPath, $maxSize) {
  if (!(Test-Path -LiteralPath $sourcePath)) {
    Write-Warning "Missing source: $sourcePath"
    return $false
  }

  $source = [System.Drawing.Image]::FromFile($sourcePath)
  try {
    $largestSide = [Math]::Max($source.Width, $source.Height)
    $scale = if ($largestSide -gt $maxSize) { $maxSize / $largestSide } else { 1.0 }
    $targetWidth = [Math]::Max(1, [int][Math]::Round($source.Width * $scale))
    $targetHeight = [Math]::Max(1, [int][Math]::Round($source.Height * $scale))

    $bitmap = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($source, 0, 0, $targetWidth, $targetHeight)
      } finally {
        $graphics.Dispose()
      }

      $bitmap.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
      return $true
    } finally {
      $bitmap.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}

function Invoke-BasisuKtx2($inputPath, $outputPath, $mode, $quality) {
  $args = @("-ktx2", "-mipmap", "-q", "$quality", "-comp_level", "1", "-file", $inputPath, "-output_file", $outputPath)
  if ($mode -eq "normal") {
    $args = @("-ktx2", "-mipmap", "-normal_map", "-q", "$quality", "-comp_level", "1", "-file", $inputPath, "-output_file", $outputPath)
  } elseif ($mode -eq "linear") {
    $args = @("-ktx2", "-mipmap", "-linear", "-q", "$quality", "-comp_level", "1", "-file", $inputPath, "-output_file", $outputPath)
  }

  $output = & $basisu @args 2>&1
  if ($LASTEXITCODE -ne 0) {
    $output | Out-Host
    throw "basisu failed for $inputPath"
  }
}

function Get-JobPaths($job) {
  $source = Join-Path $assets $job.Source
  $previewPng = Join-Path $tmpDir "$($job.Prefix)_Preview_$($job.Preview).png"
  $previewRuntimePng = Join-Path $outDir "$($job.Prefix)_Preview_$($job.Preview).png"
  $previewKtx2 = Join-Path $outDir "$($job.Prefix)_Preview_$($job.Preview)_ETC1S.ktx2"
  $fullKtx2 = Join-Path $outDir "$($job.Prefix)_Full_ETC1S.ktx2"

  return @{
    Source = $source
    PreviewPng = $previewPng
    PreviewRuntimePng = $previewRuntimePng
    PreviewKtx2 = $previewKtx2
    FullKtx2 = $fullKtx2
  }
}

function Test-JobOutputsCurrent($job) {
  $paths = Get-JobPaths $job
  if (!(Test-Path -LiteralPath $paths.Source)) {
    return $false
  }
  if (!(Test-Path -LiteralPath $paths.PreviewKtx2) -or !(Test-Path -LiteralPath $paths.FullKtx2)) {
    return $false
  }
  if ($job.KeepPreviewPng -and !(Test-Path -LiteralPath $paths.PreviewRuntimePng)) {
    return $false
  }

  $sourceTime = (Get-Item -LiteralPath $paths.Source).LastWriteTimeUtc
  $previewTime = (Get-Item -LiteralPath $paths.PreviewKtx2).LastWriteTimeUtc
  $fullTime = (Get-Item -LiteralPath $paths.FullKtx2).LastWriteTimeUtc
  if ($job.KeepPreviewPng) {
    $previewPngTime = (Get-Item -LiteralPath $paths.PreviewRuntimePng).LastWriteTimeUtc
    return ($previewTime -ge $sourceTime -and $fullTime -ge $sourceTime -and $previewPngTime -ge $sourceTime)
  }
  return ($previewTime -ge $sourceTime -and $fullTime -ge $sourceTime)
}

Write-Host ""
Write-Host "Runtime texture generation"
Write-Host "  [N] Only new/changed textures (default)"
Write-Host "  [A] Convert all textures"
$choice = Read-Host "Choose mode"
$convertAll = $choice -match "^[Aa]"

$selectedJobs = @()
foreach ($job in $jobs) {
  $paths = Get-JobPaths $job
  if (!(Test-Path -LiteralPath $paths.Source)) {
    Write-Warning "Skipping missing source: $($paths.Source)"
    continue
  }

  if ($convertAll -or !(Test-JobOutputsCurrent $job)) {
    $selectedJobs += $job
  } else {
    Write-Host "Current   $($job.Source)"
  }
}

if ($selectedJobs.Count -eq 0) {
  Write-Host "No runtime textures need conversion: $outDir"
  Remove-Item -LiteralPath $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
  exit 0
}

$modeLabel = if ($convertAll) { "all textures" } else { "new/changed textures" }
Write-Host "Converting $($selectedJobs.Count) source texture(s): $modeLabel"

$jobIndex = 0
foreach ($job in $selectedJobs) {
  $jobIndex++
  $paths = Get-JobPaths $job
  $source = $paths.Source
  $previewPng = $paths.PreviewPng
  $previewKtx2 = $paths.PreviewKtx2
  $fullKtx2 = $paths.FullKtx2
  $percent = [int](($jobIndex - 1) / $selectedJobs.Count * 100)

  Write-Progress -Activity "Generating runtime textures" -Status "[$jobIndex/$($selectedJobs.Count)] $($job.Source)" -PercentComplete $percent
  Write-Host "Converting $($job.Source)"

  if (Save-ResizedPng -sourcePath $source -targetPath $previewPng -maxSize $job.Preview) {
    if ($job.KeepPreviewPng) {
      Copy-Item -LiteralPath $previewPng -Destination $paths.PreviewRuntimePng -Force
      Write-Host "Generated $([IO.Path]::GetFileName($paths.PreviewRuntimePng))"
    }
    Write-Progress -Activity "Generating runtime textures" -Status "[$jobIndex/$($selectedJobs.Count)] Preview $($job.Source)" -PercentComplete $percent
    Invoke-BasisuKtx2 -inputPath $previewPng -outputPath $previewKtx2 -mode $job.Mode -quality $job.Quality
    Remove-Item -LiteralPath $previewPng -Force
    Write-Host "Generated $([IO.Path]::GetFileName($previewKtx2))"
  }

  Write-Progress -Activity "Generating runtime textures" -Status "[$jobIndex/$($selectedJobs.Count)] Full $($job.Source)" -PercentComplete $percent
  Invoke-BasisuKtx2 -inputPath $source -outputPath $fullKtx2 -mode $job.Mode -quality $job.Quality
  Write-Host "Generated $([IO.Path]::GetFileName($fullKtx2))"
}

Write-Progress -Activity "Generating runtime textures" -Completed
Remove-Item -LiteralPath $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Runtime KTX2 texture generation complete: $outDir"
