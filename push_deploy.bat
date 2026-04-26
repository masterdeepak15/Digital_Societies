@echo off
cd /d "D:\Claude\Society-App\society-app-spec\Digital_Societies"
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul
"C:\Program Files\Git\cmd\git.exe" add infra/docker/docker-compose.prod.yml infra/docker/Caddyfile.prod infra/docker/.env.prod.example
"C:\Program Files\Git\cmd\git.exe" commit -m "feat(deploy): add production docker-compose for API-only backend deployment" > "D:\Claude\Society-App\society-app-spec\push_deploy_out.txt" 2>&1
"C:\Program Files\Git\cmd\git.exe" push origin main >> "D:\Claude\Society-App\society-app-spec\push_deploy_out.txt" 2>&1
echo Exit=%ERRORLEVEL% >> "D:\Claude\Society-App\society-app-spec\push_deploy_out.txt"
"C:\Program Files\Git\cmd\git.exe" log --oneline -3 >> "D:\Claude\Society-App\society-app-spec\push_deploy_out.txt" 2>&1
