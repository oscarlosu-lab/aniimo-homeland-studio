@echo off
chcp 65001 >nul
title Aniimo Homeland Studio - Sincronizador Local
set "PY_EXE=%LOCALAPPDATA%\Python\bin\python.exe"
if not exist "%PY_EXE%" set "PY_EXE=%LOCALAPPDATA%\Python\pythoncore-3.15-64\python.exe"
if not exist "%PY_EXE%" set "PY_EXE=%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe"
if not exist "%PY_EXE%" set "PY_EXE=python"

"%PY_EXE%" "%~dp0scripts\sync_homeland.py"

echo.
echo Presiona cualquier tecla para cerrar...
pause >nul
