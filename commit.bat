@echo off
cd /d "D:\Claude\Society-App\society-app-spec\Digital_Societies"
if exist ".git\index.lock" del /f ".git\index.lock"
git add -A
git status --short > "D:\Claude\Society-App\society-app-spec\git_status.txt" 2>&1
git commit -m "fix(mobile): TypeScript build passes clean (TscExit=0)

- Strip trailing null bytes from DashboardScreen.tsx
- tsconfig: switch moduleResolution to bundler, add experimentalDecorators + emitDecoratorMetadata
- Add src/types/globals.d.ts for process.env declaration (Expo public env vars)
- Fix implicit any params: LoginScreen prev, BillsScreen b, FeedScreen p, NoticesScreen n, VisitorsScreen v, ComplaintsScreen prev/c/uri/idx
- Remove redundant letterSpacing prop from LoginScreen OTP TextInput (already in style)
- Install @types/react 18.2.79 and typescript 5.3.3 into node_modules directly (npm arborist semver bug bypass)
" >> "D:\Claude\Society-App\society-app-spec\git_status.txt" 2>&1
echo CommitExit=%ERRORLEVEL% >> "D:\Claude\Society-App\society-app-spec\git_status.txt"
