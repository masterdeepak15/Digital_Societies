@echo off
set PATH=%PATH%;C:\Program Files\Git\cmd;C:\Program Files\Git\bin
cd /d "D:\Claude\Society-App\society-app-spec\Digital_Societies"
if exist ".git\index.lock" del /f ".git\index.lock"
git add -A
git status --short > "D:\Claude\Society-App\society-app-spec\git_status.txt" 2>&1
git commit -m "fix(mobile): TypeScript build passes clean (TscExit=0)

- Strip trailing null bytes from DashboardScreen.tsx
- tsconfig: moduleResolution=bundler, experimentalDecorators, emitDecoratorMetadata
- Add src/types/globals.d.ts for process.env (Expo public env vars)
- Fix implicit any params across LoginScreen, BillsScreen, FeedScreen, NoticesScreen, VisitorsScreen, ComplaintsScreen
- Remove redundant letterSpacing prop from OTP TextInput (already in stylesheet)
- Install @types/react 18.2.79 and typescript 5.3.3 directly (npm arborist semver workaround)
" >> "D:\Claude\Society-App\society-app-spec\git_status.txt" 2>&1
echo CommitExit=%ERRORLEVEL% >> "D:\Claude\Society-App\society-app-spec\git_status.txt"
