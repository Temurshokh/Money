@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 goto usepy
where python >nul 2>nul
if %errorlevel%==0 goto usepython
echo Python не найден.
echo Установи Python с python.org либо запусти сервер вручную из этой папки.
pause
exit /b 1
:usepy
start "V Money server" /min cmd /c "py -m http.server 8000 --bind 127.0.0.1"
goto openbrowser
:usepython
start "V Money server" /min cmd /c "python -m http.server 8000 --bind 127.0.0.1"
:openbrowser
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8000/"
echo V Money запущен. Не закрывай окно локального сервера, пока пользуешься приложением.
echo Чтобы остановить сервер, закрой окно "V Money server".
pause
