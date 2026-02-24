@echo off
setlocal enabledelayedexpansion

:: Karakter kodlamasını UTF-8 yapalım ki Türkçe karakterler bozulmasın
chcp 65001 >nul

set "HTML_FILE=client\index.html"

echo ==============================================
echo       Çivi Futbolu Versiyon Güncelleyici
echo ==============================================
echo.
echo `client\index.html` dosyasındaki tüm versiyon takıları (?v=X.X) 
echo aşağıda gireceğiniz yeni numarayla güncellenecektir.
echo.

set /p NEW_VERSION="Yeni versiyon numarasını girin (örnek: 1.1 veya 2): "

if "%NEW_VERSION%"=="" (
    echo.
    echo HATA: Versiyon numarası boş bırakılamaz!
    pause
    exit /b 1
)

echo.
echo Güncelleniyor... Tüm ?v= değerleri ?v=%NEW_VERSION% yapılacak.

:: PowerShell Regex kullanarak index.html içindeki tüm ?v= rakamlarını güvenlice bul ve değiştir
powershell -Command "(Get-Content '%HTML_FILE%' -Encoding UTF8) -replace '\?v=[0-9\.]+', '?v=%NEW_VERSION%' | Set-Content '%HTML_FILE%' -Encoding UTF8"

echo.
echo BAŞARILI: İşlem tamamlandı! 
echo Bundan sonra oyuncular otomatik olarak v%NEW_VERSION% versiyonunu çekecektir.
echo.
pause
