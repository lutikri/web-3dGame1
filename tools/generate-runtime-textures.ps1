param(
  [switch]$All,
  [string]$Filter = "*"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$pipelineHost = Join-Path $projectRoot "generate-runtime-textures.bat"

if (!(Test-Path -LiteralPath $pipelineHost)) {
  throw "Texture pipeline host was not found: $pipelineHost"
}

$env:TEXTURE_TOOL_ROOT = $projectRoot
$env:TEXTURE_TOOL_MODE = if ($All) { "all" } else { "incremental" }
$env:TEXTURE_TOOL_FILTER = if ([string]::IsNullOrWhiteSpace($Filter)) { "*" } else { $Filter }

$content = Get-Content -Raw -LiteralPath $pipelineHost
$parts = $content -split ':POWERSHELL_SCRIPT\r?\n', 2
if ($parts.Count -ne 2) {
  throw "Embedded texture pipeline was not found in: $pipelineHost"
}

Invoke-Expression $parts[1]
