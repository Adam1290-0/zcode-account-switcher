@echo off
chcp 65001 >nul
setlocal

echo ============================================
echo ZCode Account Switcher Unpatcher
echo ============================================
echo.

tasklist /FI "IMAGENAME eq ZCode.exe" 2>nul | findstr /I /C:"ZCode.exe" >nul
if %errorlevel% equ 0 (
    echo [ERROR] ZCode is still running! Close it first.
    echo.
    pause
    exit /b 1
)

:: EDIT ME: ZCode install directory
set "ASAR_PATH=H:\Zcode\resources\app.asar"
set "BACKUP_PATH=H:\Zcode\resources\app.asar.acctbak"
set "UNPACKED_PATH=H:\Zcode\resources\app.asar.unpacked"
set "BACKUP_UNPACKED=H:\Zcode\resources\app.asar.acctbak.unpacked"

if not exist "%BACKUP_PATH%" (
    echo [ERROR] No backup found: %BACKUP_PATH%
    echo Nothing to restore.
    echo.
    pause
    exit /b 1
)

echo Restoring original app.asar...
copy /Y "%BACKUP_PATH%" "%ASAR_PATH%" >nul
if %errorlevel% neq 0 ( echo [ERROR] Restore failed & pause & exit /b 1 )

if exist "%BACKUP_UNPACKED%" (
    rmdir /S /Q "%UNPACKED_PATH%" 2>nul
    xcopy "%BACKUP_UNPACKED%" "%UNPACKED_PATH%" /E /I /Y >nul
)

echo.
echo ============================================
echo [SUCCESS] Account switcher removed.
echo ============================================
echo.
echo Original ZCode restored. Backup (app.asar.acctbak) kept for safety.
echo.
pause
