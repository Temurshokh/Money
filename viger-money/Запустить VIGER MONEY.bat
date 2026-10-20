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
start "VIGER MONEY server" /min cmd /c "py -m http.server 8000 --bind 127.0.0.1"
goto openbrowser
:usepython
start "VIGER MONEY server" /min cmd /c "python -m http.server 8000 --bind 127.0.0.1"
:openbrowser
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8000/"
echo VIGER MONEY запущен. Не закрывай окно локального сервера, пока пользуешься приложением.
echo Чтобы остановить сервер, закрой окно "VIGER MONEY server".
pause
