@echo off
cd /d "D:\Claude\Society-App\society-app-spec\Digital_Societies\apps\mobile"
"C:\Program Files\nodejs\node.exe" "node_modules\typescript\bin\tsc" --noEmit > "D:\Claude\Society-App\society-app-spec\tsc_out.txt" 2>&1
echo ExitCode=%ERRORLEVEL% >> "D:\Claude\Society-App\society-app-spec\tsc_out.txt"
