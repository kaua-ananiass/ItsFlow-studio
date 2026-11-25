@echo off
setlocal
cd /d "%~dp0"
if not exist "tauri_gerador\target\debug\itsflow-studio-dev.exe" (
  echo Executavel de desenvolvimento nao encontrado.
  pause
  exit /b 1
)
echo Feche a instancia anterior do Studio antes de abrir esta versao.
powershell.exe -NoProfile -Command "if(Get-Process gerador_automacao,itsflow-studio-dev,FlowDetect -ErrorAction SilentlyContinue){Write-Host 'O Studio ainda esta aberto. Feche-o por completo, incluindo o assistente, e abra este atalho novamente.'; Read-Host 'Pressione Enter para sair'; exit 1}; Start-Process -FilePath (Join-Path (Get-Location) 'tauri_gerador\target\debug\itsflow-studio-dev.exe') -WorkingDirectory (Get-Location).Path -Verb RunAs"
