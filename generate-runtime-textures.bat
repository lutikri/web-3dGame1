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
$sourceDir = Join-Path $root "source-assets\textures"
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

  @{ Source = "T_PanelStatusView1_BaseColor.png"; Prefix = "T_PanelStatusView1_BaseColor_Interactive"; Preview = 1024; Mode = "srgb"; Quality = 190 },
  @{ Source = "T_PanelStatusView1_Normal.png"; Prefix = "T_PanelStatusView1_Normal_Interactive"; Preview = 1024; Mode = "normal"; Quality = 200 },
  @{ Source = "T_PanelStatusView1_OcclusionRoughnessMetallic.png"; Prefix = "T_PanelStatusView1_OcclusionRoughnessMetallic_Interactive"; Preview = 1024; Mode = "linear"; Quality = 190 },
  @{ Source = "T_PanelStatusView1_Emissive.png"; Prefix = "T_PanelStatusView1_Emissive_Interactive"; Preview = 512; Mode = "srgb"; Quality = 175 },

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

  @{ Source = "T_Beams1_BaseColor.png"; Prefix = "T_Beams1_BaseColor_Secondary"; Preview = 1024; Mode = "srgb"; Quality = 185 },
  @{ Source = "T_Beams1_Normal.png"; Prefix = "T_Beams1_Normal_Secondary"; Preview = 1024; Mode = "normal"; Quality = 200 },
  @{ Source = "T_Beams1_OcclusionRoughnessMetallic.png"; Prefix = "T_Beams1_OcclusionRoughnessMetallic_Secondary"; Preview = 1024; Mode = "linear"; Quality = 185 },

  @{ Source = "T_DoorLamp1_BaseColor.png"; Prefix = "T_DoorLamp1_BaseColor_Interactive"; Preview = 1024; Mode = "srgb"; Quality = 190 },
  @{ Source = "T_DoorLamp1_Normal.png"; Prefix = "T_DoorLamp1_Normal_Interactive"; Preview = 1024; Mode = "normal"; Quality = 200 },
  @{ Source = "T_DoorLamp1_OcclusionRoughnessMetallic.png"; Prefix = "T_DoorLamp1_OcclusionRoughnessMetallic_Interactive"; Preview = 1024; Mode = "linear"; Quality = 190 },
  @{ Source = "T_DoorLamp1_Emissive.png"; Prefix = "T_DoorLamp1_Emissive_Interactive"; Preview = 512; Mode = "srgb"; Quality = 170 },

  @{ Source = "T_DoorLamp2_BaseColor.png"; Prefix = "T_DoorLamp2_BaseColor_Interactive"; Preview = 1024; Mode = "srgb"; Quality = 190 },
  @{ Source = "T_DoorLamp2_Normal.png"; Prefix = "T_DoorLamp2_Normal_Interactive"; Preview = 1024; Mode = "normal"; Quality = 200 },
  @{ Source = "T_DoorLamp2_OcclusionRoughnessMetallic.png"; Prefix = "T_DoorLamp2_OcclusionRoughnessMetallic_Interactive"; Preview = 1024; Mode = "linear"; Quality = 190 },
  @{ Source = "T_DoorLamp2_Emissive.png"; Prefix = "T_DoorLamp2_Emissive_Interactive"; Preview = 512; Mode = "srgb"; Quality = 170 },

  @{ Source = "T_Door2_BaseColor.png"; Prefix = "T_Door2_BaseColor_Interactive"; Preview = 1024; Mode = "srgb"; Quality = 190 },
  @{ Source = "T_Door2_Normal.png"; Prefix = "T_Door2_Normal_Interactive"; Preview = 1024; Mode = "normal"; Quality = 200 },
  @{ Source = "T_Door2_OcclusionRoughnessMetallic.png"; Prefix = "T_Door2_OcclusionRoughnessMetallic_Interactive"; Preview = 1024; Mode = "linear"; Quality = 190 },

  @{ Source = "T_Barrier1_BaseColor.png"; Prefix = "T_Barrier1_BaseColor_Interactive"; Preview = 1024; Mode = "srgb"; Quality = 185 },
  @{ Source = "T_Barrier1_Normal.png"; Prefix = "T_Barrier1_Normal_Interactive"; Preview = 1024; Mode = "normal"; Quality = 200 },
  @{ Source = "T_Barrier1_OcclusionRoughnessMetallic.png"; Prefix = "T_Barrier1_OcclusionRoughnessMetallic_Interactive"; Preview = 1024; Mode = "linear"; Quality = 185 },

  @{ Source = "T_ControlPost1_BaseColor.png"; Prefix = "T_ControlPost1_BaseColor_Interactive"; Preview = 1024; Mode = "srgb"; Quality = 185 },
  @{ Source = "T_ControlPost1_Normal.png"; Prefix = "T_ControlPost1_Normal_Interactive"; Preview = 1024; Mode = "normal"; Quality = 200 },
  @{ Source = "T_ControlPost1_OcclusionRoughnessMetallic.png"; Prefix = "T_ControlPost1_OcclusionRoughnessMetallic_Interactive"; Preview = 1024; Mode = "linear"; Quality = 185 },

  @{ Source = "T_Desk1_BaseColor.png"; Prefix = "T_Desk1_BaseColor_Interactive"; Preview = 1024; Mode = "srgb"; Quality = 185 },
  @{ Source = "T_Desk1_Normal.png"; Prefix = "T_Desk1_Normal_Interactive"; Preview = 1024; Mode = "normal"; Quality = 200 },
  @{ Source = "T_Desk1_OcclusionRoughnessMetallic.png"; Prefix = "T_Desk1_OcclusionRoughnessMetallic_Interactive"; Preview = 1024; Mode = "linear"; Quality = 185 },

  @{ Source = "T_TrimConcrete1_BaseColor.png"; Prefix = "T_TrimConcrete1_BaseColor_Background"; Preview = 1024; Mode = "srgb"; Quality = 180 },
  @{ Source = "T_TrimConcrete1_Normal.png"; Prefix = "T_TrimConcrete1_Normal_Background"; Preview = 1024; Mode = "normal"; Quality = 195 },
  @{ Source = "T_TrimConcrete1_OcclusionRoughnessMetallic.png"; Prefix = "T_TrimConcrete1_OcclusionRoughnessMetallic_Background"; Preview = 1024; Mode = "linear"; Quality = 180 },

  @{ Source = "T_Trim2Tiles1_BaseColor.png"; Prefix = "T_Trim2Tiles1_BaseColor_Background"; Preview = 1024; Mode = "srgb"; Quality = 180 },
  @{ Source = "T_Trim2Tiles1_Normal.png"; Prefix = "T_Trim2Tiles1_Normal_Background"; Preview = 1024; Mode = "normal"; Quality = 195 },
  @{ Source = "T_Trim2Tiles1_OcclusionRoughnessMetallic.png"; Prefix = "T_Trim2Tiles1_OcclusionRoughnessMetallic_Background"; Preview = 1024; Mode = "linear"; Quality = 180 },

  @{ Source = "T_Rock1_BaseColor.jpg"; Prefix = "T_Rock1_BaseColor_Background"; Preview = 1024; Mode = "srgb"; Quality = 180 },
  @{ Source = "T_Rock1_Normal.jpg"; Prefix = "T_Rock1_Normal_Background"; Preview = 1024; Mode = "normal"; Quality = 195 },
  @{ Source = "T_Rock1_Roughness.jpg"; Prefix = "T_Rock1_Roughness_Background"; Preview = 1024; Mode = "linear"; Quality = 180 },

  @{ Source = "T_Signs1_BaseColor.png"; Prefix = "T_Signs1_BaseColor_Secondary"; Preview = 1024; Mode = "srgb"; Quality = 185 },
  @{ Source = "T_Signs1_Normal.png"; Prefix = "T_Signs1_Normal_Secondary"; Preview = 1024; Mode = "normal"; Quality = 200 },
  @{ Source = "T_Signs1_OcclusionRoughnessMetallic.png"; Prefix = "T_Signs1_OcclusionRoughnessMetallic_Secondary"; Preview = 1024; Mode = "linear"; Quality = 185 },
  @{ Source = "T_Signs1_Emissive.png"; Prefix = "T_Signs1_Emissive_Secondary"; Preview = 512; Mode = "srgb"; Quality = 170 },

  @{ Source = "T_Clock1_BaseColor.png"; Prefix = "T_Clock1_BaseColor_Secondary"; Preview = 1024; Mode = "srgb"; Quality = 185 },
  @{ Source = "T_Clock1_Normal.png"; Prefix = "T_Clock1_Normal_Secondary"; Preview = 1024; Mode = "normal"; Quality = 200 },
  @{ Source = "T_Clock1_OcclusionRoughnessMetallic.png"; Prefix = "T_Clock1_OcclusionRoughnessMetallic_Secondary"; Preview = 1024; Mode = "linear"; Quality = 185 },

  @{ Source = "T_Posters1.png"; Prefix = "T_Posters1_BaseColor_Secondary"; Preview = 1024; Mode = "srgb"; Quality = 180 },

  @{ Source = "T_Radio1_BaseColor.png"; Prefix = "T_Radio1_BaseColor_Secondary"; Preview = 1024; Mode = "srgb"; Quality = 185 },
  @{ Source = "T_Radio1_Normal.png"; Prefix = "T_Radio1_Normal_Secondary"; Preview = 1024; Mode = "normal"; Quality = 200 },
  @{ Source = "T_Radio1_OcclusionRoughnessMetallic.png"; Prefix = "T_Radio1_OcclusionRoughnessMetallic_Secondary"; Preview = 1024; Mode = "linear"; Quality = 185 },

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
    Complete-FancyProgressLine
    $output | Out-Host
    throw "basisu failed for $inputPath"
  }
}

function Get-JobPaths($job) {
  $source = Join-Path $sourceDir $job.Source
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

$script:LastProgressLineLength = 0
$script:UseAnsiProgress = $true

function Get-CompactLabel($text, $maxLength) {
  if ($text.Length -le $maxLength) {
    return $text
  }
  if ($maxLength -le 3) {
    return $text.Substring(0, $maxLength)
  }
  return "$($text.Substring(0, $maxLength - 3))..."
}

function New-ProgressBar($percent, $width) {
  $filled = [Math]::Min($width, [int][Math]::Floor(($percent / 100) * $width))
  $empty = $width - $filled
  if ($filled -le 0) { return "." * $width }
  if ($filled -ge $width) { return "=" * $width }
  return ("=" * ($filled - 1)) + ">" + ("." * $empty)
}

function Write-FancyProgress($completedUnits, $totalUnits, $jobIndex, $jobTotal, $currentTexture, $stage, $currentPercent) {
  if ($totalUnits -le 0) {
    return
  }

  $percent = [Math]::Min(100, [Math]::Max(0, [int][Math]::Floor(($completedUnits / $totalUnits) * 100)))
  $consoleWidth = 100
  try {
    $consoleWidth = [Math]::Max(80, [Console]::WindowWidth)
  } catch {
    $consoleWidth = 100
  }

  $barWidth = [Math]::Max(12, [Math]::Min(24, [int](($consoleWidth - 76) / 2)))
  $bar = New-ProgressBar $percent $barWidth
  $textureBar = New-ProgressBar $currentPercent $barWidth

  $textureLabel = Get-CompactLabel $currentTexture 38
  $stageLabel = Get-CompactLabel $stage 18
  $plainLine = "ALL [{0}] {1,3}%  TEX [{2}] {3,3}%  {4}/{5}  {6} - {7}" -f $bar, $percent, $textureBar, $currentPercent, $jobIndex, $jobTotal, $textureLabel, $stageLabel

  if ($script:UseAnsiProgress) {
    $esc = [char]27
    $barColor = if ($percent -ge 100) { "32" } elseif ($percent -ge 66) { "36" } elseif ($percent -ge 33) { "33" } else { "35" }
    $line = "ALL [${esc}[1;${barColor}m$bar${esc}[0m] ${esc}[1m$($percent.ToString().PadLeft(3))%${esc}[0m  TEX [${esc}[36m$textureBar${esc}[0m] $($currentPercent.ToString().PadLeft(3))%  $jobIndex/$jobTotal  ${esc}[36m$textureLabel${esc}[0m - $stageLabel"
  } else {
    $line = $plainLine
  }

  $padding = ""
  $visibleLength = $plainLine.Length
  if ($script:LastProgressLineLength -gt $visibleLength) {
    $padding = " " * ($script:LastProgressLineLength - $visibleLength)
  }
  $script:LastProgressLineLength = $visibleLength
  Write-Host -NoNewline "`r$line$padding"
}

function Complete-FancyProgressLine() {
  if ($script:LastProgressLineLength -gt 0) {
    Write-Host ""
    $script:LastProgressLineLength = 0
  }
}

$requestedMode = [string]$env:TEXTURE_TOOL_MODE
$convertAll = $requestedMode -eq "all"
$textureFilter = if ([string]::IsNullOrWhiteSpace($env:TEXTURE_TOOL_FILTER)) { "*" } else { $env:TEXTURE_TOOL_FILTER }

Write-Host ""
Write-Host "Runtime texture generation"
Write-Host "  mode:   $(if ($convertAll) { 'all textures' } else { 'new/changed only' })"
Write-Host "  filter: $textureFilter"

$selectedJobs = @()
foreach ($job in $jobs) {
  if ($job.Source -notlike $textureFilter) {
    continue
  }
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
$completedUnits = 0
$totalUnits = 0
foreach ($job in $selectedJobs) {
  $totalUnits += 3
  if ($job.KeepPreviewPng) {
    $totalUnits += 1
  }
}

foreach ($job in $selectedJobs) {
  $jobIndex++
  $paths = Get-JobPaths $job
  $source = $paths.Source
  $previewPng = $paths.PreviewPng
  $previewKtx2 = $paths.PreviewKtx2
  $fullKtx2 = $paths.FullKtx2

  $percent = [int](($completedUnits / $totalUnits) * 100)
  Write-Progress -Activity "Generating runtime textures" -Status "[$jobIndex/$($selectedJobs.Count)] Resize preview: $($job.Source)" -PercentComplete $percent
  Write-FancyProgress $completedUnits $totalUnits $jobIndex $selectedJobs.Count $job.Source "resize preview" 0

  if (Save-ResizedPng -sourcePath $source -targetPath $previewPng -maxSize $job.Preview) {
    $completedUnits++
    $previewReadyPercent = if ($job.KeepPreviewPng) { 25 } else { 33 }
    Write-FancyProgress $completedUnits $totalUnits $jobIndex $selectedJobs.Count $job.Source "preview ready" $previewReadyPercent

    if ($job.KeepPreviewPng) {
      Write-Progress -Activity "Generating runtime textures" -Status "[$jobIndex/$($selectedJobs.Count)] Copy preview PNG: $($job.Source)" -PercentComplete ([int](($completedUnits / $totalUnits) * 100))
      Write-FancyProgress $completedUnits $totalUnits $jobIndex $selectedJobs.Count $job.Source "copy preview png" 25
      Copy-Item -LiteralPath $previewPng -Destination $paths.PreviewRuntimePng -Force
      $completedUnits++
      Write-FancyProgress $completedUnits $totalUnits $jobIndex $selectedJobs.Count $job.Source "preview png copied" 50
    }

    Write-Progress -Activity "Generating runtime textures" -Status "[$jobIndex/$($selectedJobs.Count)] Encode preview KTX2: $($job.Source)" -PercentComplete ([int](($completedUnits / $totalUnits) * 100))
    $previewEncodePercent = if ($job.KeepPreviewPng) { 50 } else { 33 }
    Write-FancyProgress $completedUnits $totalUnits $jobIndex $selectedJobs.Count $job.Source "encode preview" $previewEncodePercent
    Invoke-BasisuKtx2 -inputPath $previewPng -outputPath $previewKtx2 -mode $job.Mode -quality $job.Quality
    Remove-Item -LiteralPath $previewPng -Force
    $completedUnits++
    $previewEncodedPercent = if ($job.KeepPreviewPng) { 75 } else { 67 }
    Write-FancyProgress $completedUnits $totalUnits $jobIndex $selectedJobs.Count $job.Source "preview encoded" $previewEncodedPercent
  } else {
    $completedUnits += 2
    if ($job.KeepPreviewPng) {
      $completedUnits++
    }
  }

  Write-Progress -Activity "Generating runtime textures" -Status "[$jobIndex/$($selectedJobs.Count)] Encode full KTX2: $($job.Source)" -PercentComplete ([int](($completedUnits / $totalUnits) * 100))
  $fullEncodePercent = if ($job.KeepPreviewPng) { 75 } else { 67 }
  Write-FancyProgress $completedUnits $totalUnits $jobIndex $selectedJobs.Count $job.Source "encode full" $fullEncodePercent
  Invoke-BasisuKtx2 -inputPath $source -outputPath $fullKtx2 -mode $job.Mode -quality $job.Quality
  $completedUnits++
  Write-FancyProgress $completedUnits $totalUnits $jobIndex $selectedJobs.Count $job.Source "done" 100
}

Write-Progress -Activity "Generating runtime textures" -Completed
Complete-FancyProgressLine
Remove-Item -LiteralPath $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Runtime KTX2 texture generation complete: $outDir"
