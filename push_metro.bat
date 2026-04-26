@echo off
cd /d "D:\Claude\Society-App\society-app-spec\Digital_Societies"
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul
"C:\Program Files\Git\cmd\git.exe" add .github/workflows/ci.yml apps/mobile/src/services/api/apiClient.ts
"C:\Program Files\Git\cmd\git.exe" commit -m "fix(ci): hoist metro packages + set API URL to societies.athomes.space" -m "- Add metro hoisting step (symlink nested metro to top-level node_modules)" -m "- Set EXPO_PUBLIC_API_URL=https://societies.athomes.space/api/v1 in CI" -m "- Update apiClient.ts default BASE_URL to production domain" > "D:\Claude\Society-App\society-app-spec\push_metro_out.txt" 2>&1
"C:\Program Files\Git\cmd\git.exe" push origin main >> "D:\Claude\Society-App\society-app-spec\push_metro_out.txt" 2>&1
echo Exit=%ERRORLEVEL% >> "D:\Claude\Society-App\society-app-spec\push_metro_out.txt"
"C:\Program Files\Git\cmd\git.exe" log --oneline -4 >> "D:\Claude\Society-App\society-app-spec\push_metro_out.txt" 2>&1
