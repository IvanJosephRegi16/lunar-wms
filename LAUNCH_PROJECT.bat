@echo off
TITLE UPPER STOCK - STARTUP DEBUG
echo.
echo ==================================================
echo   UPPER STOCK MANAGEMENT SYSTEM LAUNCHER
echo ==================================================
echo.

:: 1. Check if Node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found. Please install Node.js first.
    pause
    exit /b
)

:: 2. Set Directory
set APP_DIR="c:\Users\asus\Downloads\jobin chettan\Antigravity\stock-app"
echo [INFO] Moving to %APP_DIR%
cd /d %APP_DIR%

:: 3. Check if node_modules exists (verification)
if not exist "node_modules" (
    echo [ERROR] Application is not built. Please run 'npm install' and 'npm run build' first.
    pause
    exit /b
)

:: 4. Start the server
echo [INFO] Starting Application Server...
:: We use 'start' to run it in a separate window so it stays open
start "STOCK SERVER" /d %APP_DIR% cmd /c "npm start"

:: 5. Wait for server (Wait 5 seconds)
echo [INFO] Warming up...
timeout /t 5 /nobreak > nul

:: 6. Open Browser
echo [INFO] Opening Browser...
start http://localhost:3000

echo.
echo [DONE] System should now be open in your browser.
echo [NOTE] Please do NOT close the other black window (STOCK SERVER).
echo.
timeout /t 5
