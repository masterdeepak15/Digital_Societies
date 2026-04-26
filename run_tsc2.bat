@echo off
cd /d "D:\Claude\Society-App\society-app-spec\Digital_Societies\apps\mobile"
echo Running tsc --noEmit...
"%APPDATA%\npm\tsc.cmd" --noEmit > "D:\Claude\Society-App\society-app-spec\tsc_final.txt" 2>&1
echo TscExit=%ERRORLEVEL% >> "D:\Claude\Society-App\society-app-spec\tsc_final.txt"
echo DONE
