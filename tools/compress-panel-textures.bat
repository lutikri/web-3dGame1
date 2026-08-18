@echo off
setlocal
set "PROJECT_ROOT=%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\tools\generate-runtime-textures.ps1" -Filter "T_Panel1_*" %*
exit /b %ERRORLEVEL%
