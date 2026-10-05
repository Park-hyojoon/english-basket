@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "BASKET_OPEN_BROWSER=1"
set "BASKET_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "BASKET_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%BASKET_NODE%" --env-file-if-exists=.env server.mjs
pause
