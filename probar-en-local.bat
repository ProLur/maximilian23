@echo off
rem Abre Maximilian 23 en este ordenador con un servidor local (no hace falta subirlo).
rem Cierra esta ventana negra para apagar el servidor.
cd /d "%~dp0lives"
set PY="C:\Program Files\Blender Foundation\Blender 5.2\5.2\python\bin\python.exe"
if not exist %PY% set PY=python
start "" "http://localhost:8023/?prueba=1"
echo Maximilian 23 en http://localhost:8023  (cierra esta ventana para apagarlo)
%PY% -m http.server 8023
pause
