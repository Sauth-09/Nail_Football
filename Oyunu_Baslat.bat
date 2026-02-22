@echo off
title Civi Futbolu - Sunucu
color 0A

echo ===================================================
echo             CIVI FUTBOLU BASLATICI
echo ===================================================
echo.

cd /d "%~dp0nail-football"

:: Gerekli modulleri kontrol et
if exist "node_modules\" goto check_firewall

echo [BILGI] Ilk kurulum yapiliyor (Gerekli moduller indiriliyor)...
echo Lutfen bekleyin...
call npm install
echo.

:check_firewall
:: Guvenlik Duvari kuralini kontrol et (LAN erisimi icin 3000 portu)
netsh advfirewall firewall show rule name="Civi Futbolu Server" >nul 2>&1
if %errorLevel% neq 0 (
    echo [BILGI] LAN erisimi icin Guvenlik Duvari kurali ekleniyor...
    echo [BILGI] Lutfen ekrandaki Yonetici Iznini onaylayin!
    powershell -Command "Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command \"New-NetFirewallRule -DisplayName ''Civi Futbolu Server'' -Profile ''Private,Public'' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000\"' -Verb RunAs -Wait"
    echo [BILGI] Guvenlik Duvari ayari tamamlandi.
    echo.
)

:start_server
echo [BILGI] Sunucu baslatiliyor... 
echo [BILGI] Oyunu oynarken lutfen BU PENCEREYI KULLANMAYIN/KAPATMAYIN!
echo.
node server/server.js

pause
