@echo off
chcp 65001 >nul
title ⚽ Çivi Futbolu - Nail Football

echo.
echo  ╔══════════════════════════════════════╗
echo  ║    ⚽ Çivi Futbolu - Nail Football    ║
echo  ╚══════════════════════════════════════╝
echo.

:: Check if Node.js is available
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Node.js bulunamadı!
    echo  [!] Lütfen nodejs.org'dan Node.js kuruyun.
    echo  [!] Veya aşağıdaki linkten indirin:
    echo      https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi
    echo.
    pause
    exit /b 1
)

echo  [✓] Node.js bulundu
echo  [*] Bağımlılıklar kontrol ediliyor...

:: Install dependencies if needed
if not exist "node_modules" (
    echo  [*] npm install yapılıyor...
    npm install --production 2>nul
)

echo  [✓] Bağımlılıklar hazır
echo.
echo  [*] Sunucu başlatılıyor...
echo  [*] Oyun açılacak: http://localhost:3000
echo.

:: Open browser after a short delay
start /b cmd /c "timeout /t 2 >nul && start http://localhost:3000"

:: Start the server
node server/server.js

pause
