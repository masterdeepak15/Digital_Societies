@echo off
echo Checking global tsc...
where tsc 2>nul
if %ERRORLEVEL%==0 (
  echo tsc found globally
  tsc --version > "D:\Claude\Society-App\society-app-spec\ts_check.txt" 2>&1
) else (
  echo tsc not global
  echo tsc not global > "D:\Claude\Society-App\society-app-spec\ts_check.txt"
)

echo Checking npx tsc...
cd /d "D:\Claude\Society-App\society-app-spec\Digital_Societies\apps\mobile"
"C:\Program Files\nodejs\npx.cmd" --yes tsc@5.3 --version >> "D:\Claude\Society-App\society-app-spec\ts_check.txt" 2>&1
echo NpxExit=%ERRORLEVEL% >> "D:\Claude\Society-App\society-app-spec\ts_check.txt"
echo DONE >> "D:\Claude\Society-App\society-app-spec\ts_check.txt"
