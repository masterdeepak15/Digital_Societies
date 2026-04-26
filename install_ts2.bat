@echo off
echo Installing TypeScript globally...
"C:\Program Files\nodejs\npm.cmd" install -g typescript > "D:\Claude\Society-App\society-app-spec\ts_global.txt" 2>&1
echo Exit=%ERRORLEVEL% >> "D:\Claude\Society-App\society-app-spec\ts_global.txt"
echo Done
