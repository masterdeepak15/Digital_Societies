@echo off
cd /d "D:\Claude\Society-App\society-app-spec\Digital_Societies"
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul
"C:\Program Files\Git\cmd\git.exe" add .github/workflows/ci.yml
"C:\Program Files\Git\cmd\git.exe" commit -m "ci: replace CI with backend-release + apk-release jobs only" > "D:\Claude\Society-App\society-app-spec\push_ci_out.txt" 2>&1
"C:\Program Files\Git\cmd\git.exe" push origin main >> "D:\Claude\Society-App\society-app-spec\push_ci_out.txt" 2>&1
echo Exit=%ERRORLEVEL% >> "D:\Claude\Society-App\society-app-spec\push_ci_out.txt"
"C:\Program Files\Git\cmd\git.exe" log --oneline -3 >> "D:\Claude\Society-App\society-app-spec\push_ci_out.txt" 2>&1
