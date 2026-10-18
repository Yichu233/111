@echo off
cd /d "%~dp0"
python -m app.server --port 18768
if errorlevel 1 pause
