@echo off
title Civi Futbolu - Sunucu Yoneticisi
color 0A

echo ===================================================
echo             CIVI FUTBOLU BASLATICI
echo ===================================================
echo.

cd /d "%~dp0nail-football"

:: Gerekli modulleri kontrol et
if exist "node_modules\" goto start_manager

echo [BILGI] Ilk kurulum yapiliyor (Gerekli moduller indiriliyor)...
echo Lutfen bekleyin...
call npm install
echo.

:start_manager
echo [BILGI] Sunucu Yoneticisi (Pano) arkaplanda baslatiliyor...
echo.
echo ===================================================
echo Lutfen acilan TARAYICI penceresini kullanin.
echo Siyah konsol penceresini KUCULTEREK arkaplanda
echo acik birakabilirsiniz.
echo ===================================================
echo.

npm start

