@echo off
title Allow phone access to Yuji

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting administrator permission...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo.
echo Opening Windows Firewall TCP port 4780 for Yuji (private/public profiles)...
echo Use this only on a trusted home Wi-Fi network.
echo.
netsh advfirewall firewall delete rule name="Yuji Mobile 4780" >nul 2>&1
netsh advfirewall firewall add rule name="Yuji Mobile 4780" dir=in action=allow protocol=TCP localport=4780 profile=private,public
if %errorlevel% neq 0 (
  echo.
  echo Failed. Please allow Node.js through the firewall manually.
) else (
  echo.
  echo Port 4780 is open for private/public networks.
  echo Return to the start-phone window and open the LAN URL on your phone.
  echo.
  echo To remove this rule later, run as administrator:
  echo netsh advfirewall firewall delete rule name="Yuji Mobile 4780"
)
echo.
pause
