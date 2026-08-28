@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================
echo ZCode Account Switcher Patcher
echo ============================================
echo.

:: Check if ZCode is running (use findstr, not find, to avoid Unix-find shadowing)
tasklist /FI "IMAGENAME eq ZCode.exe" 2>nul | findstr /I /C:"ZCode.exe" >nul
if %errorlevel% equ 0 (
    echo [ERROR] ZCode is still running!
    echo Please close ZCode completely and try again.
    echo.
    pause
    exit /b 1
)

set "BASE=%~dp0"
:: EDIT ME: ZCode install directory
set "ASAR_PATH=H:\Zcode\resources\app.asar"
set "BACKUP_PATH=H:\Zcode\resources\app.asar.acctbak"
set "UNPACKED_PATH=H:\Zcode\resources\app.asar.unpacked"
set "BACKUP_UNPACKED=H:\Zcode\resources\app.asar.acctbak.unpacked"
set "UI_JS=%BASE%ui_accounts.js"
set "MAIN_MJS=%BASE%zcode-account-switcher-main.mjs"
set "INJECT_PY=%BASE%inject-account-switcher.py"

:: Check input files exist
if not exist "%ASAR_PATH%" ( echo [ERROR] app.asar not found: %ASAR_PATH% & pause & exit /b 1 )
if not exist "%UI_JS%"    ( echo [ERROR] ui_accounts.js not found & pause & exit /b 1 )
if not exist "%MAIN_MJS%" ( echo [ERROR] zcode-account-switcher-main.mjs not found & pause & exit /b 1 )
if not exist "%INJECT_PY%" ( echo [ERROR] inject-account-switcher.py not found & pause & exit /b 1 )

:: Backup original asar + unpacked dir (first time only)
if not exist "%BACKUP_PATH%" (
    echo [1/6] Creating backup...
    copy /Y "%ASAR_PATH%" "%BACKUP_PATH%" >nul
    if !errorlevel! neq 0 ( echo [ERROR] Backup failed & pause & exit /b 1 )
    echo       Backup saved: app.asar.acctbak
) else (
    echo [1/6] Backup already exists, skip.
)
if not exist "%BACKUP_UNPACKED%" (
    if exist "%UNPACKED_PATH%" (
        xcopy "%UNPACKED_PATH%" "%BACKUP_UNPACKED%" /E /I /Y >nul
        echo       Backup saved: app.asar.acctbak.unpacked
    )
)

:: Extract from the CURRENT asar (not the backup) so other injections
:: (e.g. the skin plugin) already present are preserved.
echo [2/6] Extracting current asar (2-3 minutes)...
set "EXTRACT_DIR=%TEMP%\zcode-acct-patch"
if exist "%EXTRACT_DIR%" rmdir /S /Q "%EXTRACT_DIR%" 2>nul
call npx --yes @electron/asar extract "%ASAR_PATH%" "%EXTRACT_DIR%"
if !errorlevel! neq 0 ( echo [ERROR] Extraction failed & pause & exit /b 1 )

:: Inject files
echo [3/6] Injecting account switcher...
python "%INJECT_PY%" "%EXTRACT_DIR%\out" "%UI_JS%" "%MAIN_MJS%"
if !errorlevel! neq 0 ( echo [ERROR] Injection failed & pause & exit /b 1 )

:: Repack asar (must --unpack native binaries or terminal/SSH breaks)
echo [4/6] Repacking asar (2-3 minutes)...
rmdir /S /Q "%UNPACKED_PATH%" 2>nul
call npx --yes @electron/asar pack "%EXTRACT_DIR%" "%ASAR_PATH%" --unpack "*.{node,dll,exe}"
if !errorlevel! neq 0 (
    echo [ERROR] Repacking failed. Restoring backup...
    copy /Y "%BACKUP_PATH%" "%ASAR_PATH%" >nul
    rmdir /S /Q "%UNPACKED_PATH%" 2>nul
    if exist "%BACKUP_UNPACKED%" xcopy "%BACKUP_UNPACKED%" "%UNPACKED_PATH%" /E /I /Y >nul
    pause
    exit /b 1
)

:: Cleanup
echo [5/6] Cleaning up...
rmdir /S /Q "%EXTRACT_DIR%" 2>nul
echo [6/6] Done.

echo.
echo ============================================
echo [SUCCESS] Account switcher patched!
echo ============================================
echo.
echo Open ZCode - click the avatar (bottom-left) - you will see
echo "切换账号" at the bottom of the menu.
echo.
echo To revert: run unpatch-account-switcher.bat
echo.
pause
