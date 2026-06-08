@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%.."
set "SOURCE_DIR=%ROOT_DIR%\3dGameAssetsDev\RuntimeTextureSources"
set "OUTPUT_DIR=%ROOT_DIR%\assets"
set "TOKTX=toktx"
set "TOKTX_FOUND="

if exist "%ProgramFiles%\KTX-Software\bin\toktx.exe" (
  set "TOKTX=%ProgramFiles%\KTX-Software\bin\toktx.exe"
  set "TOKTX_FOUND=1"
)
if exist "%ProgramFiles(x86)%\KTX-Software\bin\toktx.exe" (
  set "TOKTX=%ProgramFiles(x86)%\KTX-Software\bin\toktx.exe"
  set "TOKTX_FOUND=1"
)

if not defined TOKTX_FOUND (
  where toktx >nul 2>nul
  if not errorlevel 1 set "TOKTX_FOUND=1"
)

if not defined TOKTX_FOUND (
  echo ERROR: toktx.exe was not found.
  echo Install Khronos KTX-Software from:
  echo https://github.com/KhronosGroup/KTX-Software/releases
  exit /b 1
)

if not exist "%SOURCE_DIR%\T_Panel1_BaseColor.png" (
  echo ERROR: Missing source textures in "%SOURCE_DIR%".
  exit /b 1
)

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

echo Compressing Panel1 base color...
"%TOKTX%" --t2 --genmipmap --encode etc1s --clevel 5 --qlevel 180 --assign_oetf srgb "%OUTPUT_DIR%\T_Panel1_BaseColor.ktx2" "%SOURCE_DIR%\T_Panel1_BaseColor.png"
if errorlevel 1 exit /b 1

echo Compressing Panel1 normal map...
"%TOKTX%" --t2 --genmipmap --encode uastc --uastc_quality 2 --uastc_rdo_l 0.5 --zcmp 18 --assign_oetf linear "%OUTPUT_DIR%\T_Panel1_Normal.ktx2" "%SOURCE_DIR%\T_Panel1_Normal.png"
if errorlevel 1 exit /b 1

echo Compressing Panel1 ORM map...
"%TOKTX%" --t2 --genmipmap --encode etc1s --clevel 5 --qlevel 180 --assign_oetf linear "%OUTPUT_DIR%\T_Panel1_OcclusionRoughnessMetallic.ktx2" "%SOURCE_DIR%\T_Panel1_OcclusionRoughnessMetallic.png"
if errorlevel 1 exit /b 1

echo Done. Compressed textures were written to "%OUTPUT_DIR%".
