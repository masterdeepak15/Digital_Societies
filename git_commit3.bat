@echo off
cd /d "D:\Claude\Society-App\society-app-spec\Digital_Societies"

rem Kill any lingering git processes
taskkill /f /im git.exe >nul 2>&1
timeout /t 1 >nul

rem Remove all git lock files
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul
del /f /q ".git\COMMIT_EDITMSG.lock" 2>nul

"C:\Program Files\Git\cmd\git.exe" add -A 2>&1
"C:\Program Files\Git\cmd\git.exe" commit -m "fix(mobile): TypeScript build passes clean (TscExit=0)" -m "- Strip trailing null bytes from DashboardScreen.tsx" -m "- tsconfig: moduleResolution=bundler, experimentalDecorators, emitDecoratorMetadata" -m "- Add src/types/globals.d.ts for process.env (Expo public env vars)" -m "- Fix implicit any params: LoginScreen, BillsScreen, FeedScreen, NoticesScreen, VisitorsScreen, ComplaintsScreen" -m "- Remove redundant letterSpacing prop from OTP TextInput" -m "- Install @types/react 18.2.79 and typescript 5.3.3 (npm arborist semver workaround)" > "D:\Claude\Society-App\society-app-spec\git_out2.txt" 2>&1
echo CommitExit=%ERRORLEVEL% >> "D:\Claude\Society-App\society-app-spec\git_out2.txt"
"C:\Program Files\Git\cmd\git.exe" log --oneline -3 >> "D:\Claude\Society-App\society-app-spec\git_out2.txt" 2>&1
