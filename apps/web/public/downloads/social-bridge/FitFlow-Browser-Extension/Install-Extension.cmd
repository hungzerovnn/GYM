@echo off
setlocal
set "ROOT=%~dp0"
powershell.exe -ExecutionPolicy Bypass -File "%ROOT%Open-Extension-Install.ps1" -ExtensionFolder "%ROOT%browser-extension"
