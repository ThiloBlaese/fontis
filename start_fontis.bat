@echo off
setlocal
REM ============================================================================
REM  Fontis – Freies Archivsystem (Windows-Starter)
REM ============================================================================

cd /d "%~dp0"

set "DIST_INDEX=%~dp0fontis_web\dist\index.html"
set "VENV_DIR=%~dp0fontis_web\backend\fastapi_app\venv"
set "VENV_PYTHON=%VENV_DIR%\Scripts\python.exe"
set "REQ_FILE=%~dp0fontis_web\backend\fastapi_app\requirements.txt"
set "DESKTOP_SCRIPT=%~dp0fontis_web\backend\fastapi_app\desktop_app.py"

if not exist "%DIST_INDEX%" (
    echo Frontend-Build nicht gefunden. Baue Frontend einmalig...
    pushd "%~dp0fontis_web"
    call npm install
    if errorlevel 1 (
        echo [Fehler] npm install fehlgeschlagen. Bitte Node.js 20+ installieren.
        popd
        pause
        exit /b 1
    )
    call npm run build
    if errorlevel 1 (
        echo [Fehler] Frontend-Build fehlgeschlagen.
        popd
        pause
        exit /b 1
    )
    popd
)

if not exist "%VENV_PYTHON%" (
    echo Python-Umgebung wird beim ersten Start eingerichtet...
    python -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo [Fehler] Python 3.10+ wurde nicht gefunden. Bitte Python installieren.
        pause
        exit /b 1
    )
    "%VENV_PYTHON%" -m pip install --upgrade pip
    "%VENV_PYTHON%" -m pip install -r "%REQ_FILE%"
    if errorlevel 1 (
        echo [Fehler] Installation der Python-Abhaengigkeiten fehlgeschlagen.
        pause
        exit /b 1
    )
)

echo ====================================================
echo   Starte Fontis – Freies Archivsystem
echo ====================================================
"%VENV_PYTHON%" "%DESKTOP_SCRIPT%" %*
endlocal
