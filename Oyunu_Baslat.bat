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
netsh advfirewall firewall show rule name="CiviFutbolu_LAN" >nul 2>&1
if %errorLevel% neq 0 (
    echo [BILGI] LAN erisimi icin Guvenlik Duvari ayarlaniyor...
    echo [DIKKAT] Lutfen ekrana gelecek Yonetici Iznine (Evet) basin!
    powershell -Command "Start-Process cmd -ArgumentList '/c netsh advfirewall firewall add rule name=\"CiviFutbolu_LAN\" dir=in action=allow protocol=TCP localport=3000' -Verb RunAs -Wait"
    echo [BILGI] Guvenlik Duvari ayari tamamlandi.
    echo.
)

:start_server
echo [BILGI] Sunucu baslatiliyor... 
echo [BILGI] Oyunu oynarken lutfen BU PENCEREYI KULLANMAYIN/KAPATMAYIN!
echo.
node server/server.js

pause
