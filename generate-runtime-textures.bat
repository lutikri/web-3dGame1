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

  @{ Source = "T_Details1_BaseColor.png"; Prefix = "T_Details1_BaseColor_Secondary"; Preview = 1024; Mode = "srgb"; Quality = 180 },
  @{ Source = "T_Details1_Normal.png"; Prefix = "T_Details1_Normal_Secondary"; Preview = 1024; Mode = "normal"; Quality = 195 },
  @{ Source = "T_Details1_OcclusionRoughnessMetallic.png"; Prefix = "T_Details1_OcclusionRoughnessMetallic_Secondary"; Preview = 1024; Mode = "linear"; Quality = 180 },

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

  & $basisu @args | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "basisu failed for $inputPath"
  }
}

foreach ($job in $jobs) {
  $source = Join-Path $assets $job.Source
  if (!(Test-Path -LiteralPath $source)) {
    Write-Warning "Skipping missing source: $source"
    continue
  }

  $previewPng = Join-Path $tmpDir "$($job.Prefix)_Preview_$($job.Preview).png"
  $previewKtx2 = Join-Path $outDir "$($job.Prefix)_Preview_$($job.Preview)_ETC1S.ktx2"
  $fullKtx2 = Join-Path $outDir "$($job.Prefix)_Full_ETC1S.ktx2"

  if (Save-ResizedPng -sourcePath $source -targetPath $previewPng -maxSize $job.Preview) {
    Invoke-BasisuKtx2 -inputPath $previewPng -outputPath $previewKtx2 -mode $job.Mode -quality $job.Quality
    Remove-Item -LiteralPath $previewPng -Force
    Write-Host "Generated $([IO.Path]::GetFileName($previewKtx2))"
  }

  Invoke-BasisuKtx2 -inputPath $source -outputPath $fullKtx2 -mode $job.Mode -quality $job.Quality
  Write-Host "Generated $([IO.Path]::GetFileName($fullKtx2))"
}

Remove-Item -LiteralPath $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Runtime KTX2 texture generation complete: $outDir"
