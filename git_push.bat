@echo off
cd /d "D:\Claude\Society-App\society-app-spec\Digital_Societies"
"C:\Program Files\Git\cmd\git.exe" remote -v > "D:\Claude\Society-App\society-app-spec\git_push_out.txt" 2>&1
"C:\Program Files\Git\cmd\git.exe" push origin main >> "D:\Claude\Society-App\society-app-spec\git_push_out.txt" 2>&1
echo PushExit=%ERRORLEVEL% >> "D:\Claude\Society-App\society-app-spec\git_push_out.txt"
"C:\Program Files\Git\cmd\git.exe" log --oneline -5 >> "D:\Claude\Society-App\society-app-spec\git_push_out.txt" 2>&1
