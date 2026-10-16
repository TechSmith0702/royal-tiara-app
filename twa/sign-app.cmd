@echo off
rem Signs the Royal Tiara Android app (TWA) after a build.
rem
rem Run it by double-clicking, or from a terminal in this folder:  sign-app.cmd
rem It asks for the signing-key password several times (Java's tools each ask).
rem The first time, it creates the signing key and asks you to choose that password.
rem KEEP THE KEY AND ITS PASSWORD SAFE: every future update must be signed with it.

setlocal
set "JAVA_HOME=C:\Program Files\Java\jdk-17"
set "KEYS=C:\Users\Private\royal-tiara-keys"
set "KS=%KEYS%\royal-tiara-upload.keystore"
set "BT=%LOCALAPPDATA%\Android\Sdk\build-tools\35.0.0"
cd /d "%~dp0"

if not exist "app\build\outputs\apk\release\app-release-unsigned.apk" (
  echo The app has not been built yet. Build it first ^(see HANDBOOK.md, Google Play app^).
  goto :fail
)

if not exist "%KS%" (
  if not exist "%KEYS%" mkdir "%KEYS%"
  echo.
  echo === Creating the signing key ===
  echo Choose a strong password and write it down somewhere safe.
  echo Without it, the app can never be updated on Google Play.
  echo.
  "%JAVA_HOME%\bin\keytool" -genkeypair -v -keystore "%KS%" -alias royaltiara -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Royal Tiara, O=Royal Tiara, L=Meyerton, ST=Gauteng, C=ZA" || goto :fail
)

echo.
echo === Signing the APK (to install on phones for testing) ===
"%BT%\zipalign.exe" -f -p 4 "app\build\outputs\apk\release\app-release-unsigned.apk" "app-release-aligned.apk" || goto :fail
call "%BT%\apksigner.bat" sign --ks "%KS%" --ks-key-alias royaltiara --out "RoyalTiara.apk" "app-release-aligned.apk" || goto :fail
del "app-release-aligned.apk"

echo.
echo === Signing the AAB (the file Google Play wants) ===
copy /y "app\build\outputs\bundle\release\app-release.aab" "RoyalTiara.aab" >nul || goto :fail
"%JAVA_HOME%\bin\jarsigner" -keystore "%KS%" "RoyalTiara.aab" royaltiara || goto :fail

echo.
echo === Key fingerprint (send this line to Claude for the website link) ===
"%JAVA_HOME%\bin\keytool" -list -v -keystore "%KS%" -alias royaltiara | findstr /c:"SHA256:"

echo.
echo Done. RoyalTiara.apk and RoyalTiara.aab are in %~dp0
goto :end

:fail
echo.
echo Something went wrong - see the message above.
:end
pause
