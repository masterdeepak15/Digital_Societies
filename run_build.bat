@echo off
set DOTNET="C:\Program Files\dotnet\dotnet.exe"
set SLN=D:\Claude\Society-App\society-app-spec\Digital_Societies\services\DigitalSocieties.sln
set LOG=D:\Claude\Society-App\society-app-spec\build_output.log

echo ====== RESTORE ====== > %LOG%
%DOTNET% restore %SLN% --verbosity normal >> %LOG% 2>&1
echo RESTORE_EXIT=%ERRORLEVEL% >> %LOG%

echo ====== BUILD ====== >> %LOG%
%DOTNET% build %SLN% --no-restore -c Release --verbosity normal >> %LOG% 2>&1
echo BUILD_EXIT=%ERRORLEVEL% >> %LOG%

echo Done. Check build_output.log
type %LOG%
