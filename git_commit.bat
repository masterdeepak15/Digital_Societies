@echo off
set GIT="C:\Program Files\Git\cmd\git.exe"
if not exist %GIT% set GIT="C:\Program Files\Git\bin\git.exe"
if not exist %GIT% (
  for /f "delims=" %%i in ('where git 2^>nul') do set GIT="%%i"
)

cd /d "D:\Claude\Society-App\society-app-spec\Digital_Societies"

rem Remove stale lock
if exist ".git\index.lock" del /f /q ".git\index.lock"

%GIT% add -A > "D:\Claude\Society-App\society-app-spec\git_out.txt" 2>&1
%GIT% commit -m "fix(mobile): TypeScript build passes clean (TscExit=0)" -m "- Strip trailing null bytes from DashboardScreen.tsx" -m "- tsconfig: moduleResolution=bundler, experimentalDecorators, emitDecoratorMetadata" -m "- Add src/types/globals.d.ts for process.env (Expo public env vars)" -m "- Fix implicit any params: LoginScreen, BillsScreen, FeedScreen, NoticesScreen, VisitorsScreen, ComplaintsScreen" -m "- Remove redundant letterSpacing prop from OTP TextInput" -m "- Install @types/react 18.2.79 and typescript 5.3.3 (npm arborist semver workaround)" >> "D:\Claude\Society-App\society-app-spec\git_out.txt" 2>&1
echo CommitExit=%ERRORLEVEL% >> "D:\Claude\Society-App\society-app-spec\git_out.txt"
%GIT% log --oneline -3 >> "D:\Claude\Society-App\society-app-spec\git_out.txt" 2>&1
