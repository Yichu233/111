@echo off
cd /d "%~dp0"
python -m app.server
if errorlevel 1 pause
