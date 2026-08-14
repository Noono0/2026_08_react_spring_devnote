@echo off
python scripts\verify-static.py
if errorlevel 1 exit /b 1
