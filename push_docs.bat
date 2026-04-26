@echo off
cd /d "D:\Claude\Society-App\society-app-spec\Digital_Societies"
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul
"C:\Program Files\Git\cmd\git.exe" add README.md DEVELOPMENT_STATUS.md services/DigitalSocieties.Api/Dockerfile .gitignore > "D:\Claude\Society-App\society-app-spec\push_docs_out.txt" 2>&1
"C:\Program Files\Git\cmd\git.exe" status --short >> "D:\Claude\Society-App\society-app-spec\push_docs_out.txt" 2>&1
"C:\Program Files\Git\cmd\git.exe" commit -m "docs: rewrite README + add DEVELOPMENT_STATUS; fix Dockerfile restore" >> "D:\Claude\Society-App\society-app-spec\push_docs_out.txt" 2>&1
"C:\Program Files\Git\cmd\git.exe" push origin main >> "D:\Claude\Society-App\society-app-spec\push_docs_out.txt" 2>&1
echo Exit=%ERRORLEVEL% >> "D:\Claude\Society-App\society-app-spec\push_docs_out.txt"
"C:\Program Files\Git\cmd\git.exe" log --oneline -5 >> "D:\Claude\Society-App\society-app-spec\push_docs_out.txt" 2>&1
