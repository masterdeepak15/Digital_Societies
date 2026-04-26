@echo off
cd /d "D:\Claude\Society-App\society-app-spec\Digital_Societies\apps\mobile"
echo Installing TypeScript...
"C:\Program Files\nodejs\npm.cmd" install typescript --save-dev > "D:\Claude\Society-App\society-app-spec\ts_install2.txt" 2>&1
echo InstallExit=%ERRORLEVEL% >> "D:\Claude\Society-App\society-app-spec\ts_install2.txt"
echo Running tsc...
"C:\Program Files\nodejs\node.exe" node_modules\typescript\bin\tsc --noEmit > "D:\Claude\Society-App\society-app-spec\tsc_out2.txt" 2>&1
echo TscExit=%ERRORLEVEL% >> "D:\Claude\Society-App\society-app-spec\tsc_out2.txt"
echo DONE
