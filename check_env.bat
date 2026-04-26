@echo off
echo === Java ===
java -version 2>&1
echo.
echo === JAVA_HOME ===
echo %JAVA_HOME%
echo.
echo === Node ===
"C:\Program Files\nodejs\node.exe" --version 2>&1
echo.
echo === Android SDK ===
echo ANDROID_HOME=%ANDROID_HOME%
echo ANDROID_SDK_ROOT=%ANDROID_SDK_ROOT%
if exist "%LOCALAPPDATA%\Android\Sdk" echo SDK found at %LOCALAPPDATA%\Android\Sdk
if exist "C:\Android\Sdk" echo SDK found at C:\Android\Sdk
echo.
echo === Gradle ===
gradle --version 2>&1
echo.
echo === JDK location ===
where java 2>nul
dir "C:\Program Files\Java" 2>nul
dir "C:\Program Files\Eclipse Adoptium" 2>nul
dir "C:\Program Files\Microsoft" 2>nul | findstr /i "jdk"
echo DONE
