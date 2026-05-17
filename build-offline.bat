@echo off
title Building Stock App Offline Package
echo ==============================================
echo  Building Offline Distribution Package...
echo ==============================================

echo.
echo [1/7] Running Next.js Production Build...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Build failed! Fix the errors above and try again.
    pause
    exit /b 1
)

echo.
echo [2/7] Preparing Offline_App directory...
if exist "Offline_App" rmdir /s /q "Offline_App"
mkdir "Offline_App"

echo.
echo [3/7] Copying Standalone Server Files...
if exist ".next\standalone" (
    xcopy /s /e /q /y ".next\standalone\*" "Offline_App\"
    echo     OK: Standalone files copied.
) else (
    echo ERROR: .next\standalone folder not found! Make sure output:'standalone' is in next.config.ts
    pause
    exit /b 1
)

echo.
echo [4/7] Copying Public Assets...
if exist "public" (
    mkdir "Offline_App\public"
    xcopy /s /e /q /y "public\*" "Offline_App\public\"
    echo     OK: Public assets copied.
)

echo.
echo [5/7] Copying Static Assets...
mkdir "Offline_App\.next\static"
xcopy /s /e /q /y ".next\static\*" "Offline_App\.next\static\"
echo     OK: Static assets copied.

echo.
echo [6/7] Copying Database...
mkdir "Offline_App\data"
if exist "data\stock.db" (
    copy "data\stock.db" "Offline_App\data\stock.db"
    echo     OK: Database copied.
) else (
    echo     INFO: No existing database found. A fresh one will be created on first run.
)

echo.
echo [7/7] Downloading Portable 32-bit Node.js (for Windows 7 compatibility)...
powershell -Command "& { try { Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.1/win-x86/node.exe' -OutFile 'Offline_App\node.exe' -UseBasicParsing; Write-Host '    OK: 32-bit node.exe downloaded.' } catch { Write-Host '    ERROR: Download failed.' } }"

echo.
echo Updating run-server.bat for Windows 7...
echo @echo off > "Offline_App\run-server.bat"
echo set NODE_SKIP_PLATFORM_CHECK=1 >> "Offline_App\run-server.bat"
echo cd /d "%%~dp0" >> "Offline_App\run-server.bat"
echo node.exe server.js >> "Offline_App\run-server.bat"

echo.
echo Updating Startup Script...
copy "StockApp.template.vbs" "Offline_App\Stock App.vbs"
echo     OK: Startup script created.

echo.
echo ==============================================
echo  DONE! Package is ready.
echo ==============================================
echo.
echo  Folder: Offline_App\
echo  What to do next:
echo    1. Zip the "Offline_App" folder
echo    2. Send it to the other PC
echo    3. They extract the ZIP
echo    4. Double-click "Stock App.vbs"
echo    5. Wait 5 seconds - browser opens automatically!
echo.
echo  Login: admin / admin123
echo ==============================================
pause
