@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "D:\Claude\Society-App\society-app-spec\Digital_Societies\apps\mobile"
echo Running tsc --noEmit...
"C:\Program Files\nodejs\node.exe" "%APPDATA%\npm\node_modules\typescript\bin\tsc" --noEmit > "D:\Claude\Society-App\society-app-spec\tsc_final.txt" 2>&1
echo TscExit=%ERRORLEVEL% >> "D:\Claude\Society-App\society-app-spec\tsc_final.txt"
echo DONE
