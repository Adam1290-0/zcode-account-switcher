@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================
echo ZCode Combined Patcher
echo (skin + account-switcher, one pass)
echo ============================================
echo.

:: Check if ZCode is running
tasklist /FI "IMAGENAME eq ZCode.exe" 2>nul | findstr /I /C:"ZCode.exe" >nul
if %errorlevel% equ 0 (
    echo [ERROR] ZCode is still running!
    echo Please close ZCode completely and try again.
    echo.
    pause
    exit /b 1
)

set "BASE=%~dp0"
:: EDIT ME: ZCode install directory (used for app.asar paths below)
set "ASAR_PATH=H:\Zcode\resources\app.asar"
set "PRISTINE=H:\Zcode\resources\app.asar.skinbak"
set "UNPACKED_PATH=H:\Zcode\resources\app.asar.unpacked"
:: The zcode-skin-manager repo is expected as a SIBLING of this repo.
:: If it lives elsewhere, edit this line.
set "SKIN_DIR=%~dp0..\zcode-skin-manager"
set "SKIN_INJECT=%SKIN_DIR%\inject.py"
set "SKIN_UI=%SKIN_DIR%\ui_skin.js"
set "UI_JS=%BASE%ui_accounts.js"
set "MAIN_MJS=%BASE%zcode-account-switcher-main.mjs"
set "INJECT_PY=%BASE%inject-account-switcher.py"

:: Check input files
if not exist "%PRISTINE%"    ( echo [ERROR] pristine backup not found: %PRISTINE% & pause & exit /b 1 )
if not exist "%SKIN_INJECT%" ( echo [ERROR] skin inject.py not found & pause & exit /b 1 )
if not exist "%SKIN_UI%"     ( echo [ERROR] ui_skin.js not found & pause & exit /b 1 )
if not exist "%UI_JS%"       ( echo [ERROR] ui_accounts.js not found & pause & exit /b 1 )
if not exist "%MAIN_MJS%"    ( echo [ERROR] main module not found & pause & exit /b 1 )
if not exist "%INJECT_PY%"   ( echo [ERROR] inject-account-switcher.py not found & pause & exit /b 1 )

echo [1/5] Extracting pristine asar (2-3 minutes)...
set "EXTRACT_DIR=%TEMP%\zcode-combined-patch"
if exist "%EXTRACT_DIR%" rmdir /S /Q "%EXTRACT_DIR%" 2>nul
call npx --yes @electron/asar extract "%PRISTINE%" "%EXTRACT_DIR%"
if !errorlevel! neq 0 ( echo [ERROR] Extraction failed & pause & exit /b 1 )

echo [2/5] Injecting skin...
python "%SKIN_INJECT%" "%EXTRACT_DIR%\out\renderer\index.html" "%SKIN_UI%"
if !errorlevel! neq 0 (
    if !errorlevel! neq 2 ( echo [ERROR] skin injection failed & pause & exit /b 1 )
    echo       (skin marker already present, skip)
)

echo [3/5] Injecting account switcher...
python "%INJECT_PY%" "%EXTRACT_DIR%\out" "%UI_JS%" "%MAIN_MJS%"
if !errorlevel! neq 0 ( echo [ERROR] account injection failed & pause & exit /b 1 )

echo [4/5] Repacking asar (2-3 minutes)...
rmdir /S /Q "%UNPACKED_PATH%" 2>nul
call npx --yes @electron/asar pack "%EXTRACT_DIR%" "%ASAR_PATH%" --unpack "*.{node,dll,exe}"
if !errorlevel! neq 0 (
    echo [ERROR] Repacking failed. Restoring pristine backup...
    copy /Y "%PRISTINE%" "%ASAR_PATH%" >nul
    rmdir /S /Q "%UNPACKED_PATH%" 2>nul
    pause
    exit /b 1
)

echo [5/5] Cleaning up...
rmdir /S /Q "%EXTRACT_DIR%" 2>nul

echo.
echo ============================================
echo [SUCCESS] Combined patch applied!
echo ============================================
echo.
echo Both the skin and the account switcher are now active.
echo Open ZCode to verify:
echo   1. bottom-left avatar menu - "切换账号" item
echo   2. Settings sidebar - "账号切换" entry
echo   3. skin button (top-right paint icon)
echo.
echo NOTE: do NOT run the individual patch.bat scripts anymore -
echo they overwrite each other. Always use this combined patcher.
echo.
pause
