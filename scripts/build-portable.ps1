param(
  [string]$Version = "0.2.0",
  [string]$OutputDirectory = "artifacts",
  [string]$NodeExecutable = ""
)

$ErrorActionPreference = "Stop"

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$outputRoot = if ([System.IO.Path]::IsPathRooted($OutputDirectory)) {
  [System.IO.Path]::GetFullPath($OutputDirectory)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDirectory))
}

if (-not $NodeExecutable) {
  $NodeExecutable = (Get-Command node -ErrorAction Stop).Source
}

if (-not (Test-Path -LiteralPath $NodeExecutable -PathType Leaf)) {
  throw "Node.js runtime not found: $NodeExecutable"
}

$nodeVersionText = & $NodeExecutable --version
$nodeVersion = [version]($nodeVersionText.TrimStart("v"))
if ($nodeVersion -lt [version]"22.13.0") {
  throw "Node.js 22.13.0 or newer is required; found $nodeVersionText."
}

Push-Location $projectRoot
try {
  $viteCli = Join-Path $projectRoot "frontend\node_modules\vite\bin\vite.js"
  if (-not (Test-Path -LiteralPath $viteCli -PathType Leaf)) {
    throw "Frontend dependencies are missing. Run 'pnpm setup' first."
  }
  & $NodeExecutable $viteCli build (Join-Path $projectRoot "frontend")
  if ($LASTEXITCODE -ne 0) {
    throw "Frontend build failed."
  }
} finally {
  Pop-Location
}

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

$stageRoot = Join-Path ([System.IO.Path]::GetTempPath()) "ix-$Version"
$bundleName = "inkstone-writing-assistant-$Version-windows-x64"
$bundleRoot = Join-Path $stageRoot $bundleName
$zipPath = Join-Path $outputRoot "$bundleName.zip"

if (Test-Path -LiteralPath $stageRoot) {
  Remove-Item -LiteralPath $stageRoot -Recurse -Force
}
if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Force -Path $bundleRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $bundleRoot "backend") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $bundleRoot "frontend") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $bundleRoot "database") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $bundleRoot "runtime") | Out-Null

# Allow-list packaging keeps local databases, cookies, .env files and reports out.
Copy-Item -LiteralPath (Join-Path $projectRoot "backend\src") -Destination (Join-Path $bundleRoot "backend") -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot "backend\package.json") -Destination (Join-Path $bundleRoot "backend") -Force
Copy-Item -LiteralPath (Join-Path $projectRoot "frontend\dist") -Destination (Join-Path $bundleRoot "frontend") -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot "database\schema.sql") -Destination (Join-Path $bundleRoot "database") -Force
Copy-Item -LiteralPath (Join-Path $projectRoot "database\seed-prompts.json") -Destination (Join-Path $bundleRoot "database") -Force
Copy-Item -LiteralPath (Join-Path $projectRoot "database\seed-character-fields.json") -Destination (Join-Path $bundleRoot "database") -Force
Copy-Item -LiteralPath (Join-Path $projectRoot "LICENSE") -Destination $bundleRoot -Force
Copy-Item -LiteralPath $NodeExecutable -Destination (Join-Path $bundleRoot "runtime\node.exe") -Force

Push-Location (Join-Path $bundleRoot "backend")
try {
  & npm.cmd install --omit=dev --ignore-scripts --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) {
    throw "Production dependency installation failed."
  }
} finally {
  Pop-Location
}

$launcher = @'
@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Inkstone is starting. Keep this window open while writing.
start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:8787'"
"%~dp0runtime\node.exe" "%~dp0backend\src\server.js"
echo.
echo Inkstone has stopped. Press any key to close this window.
pause >nul
'@

$portableReadme = @"
Inkstone Writing Assistant $Version

How to run:
1. Extract the complete ZIP to any writable folder.
2. Double-click Start-Inkstone.cmd.
3. Your browser opens http://127.0.0.1:8787 automatically.
4. Keep the command window open while writing. Close it to stop the app.

Node.js, pnpm and SQLite do not need to be installed.
Writing and character data stay in database\writing-assistant.db.
Back up that database file before upgrading or moving the app.

Project: https://github.com/risievol2-alt/writing-assistant
License: MIT
"@

Set-Content -LiteralPath (Join-Path $bundleRoot "Start-Inkstone.cmd") -Value $launcher -Encoding ASCII
Set-Content -LiteralPath (Join-Path $bundleRoot "PORTABLE-README.txt") -Value $portableReadme -Encoding ASCII

$blockedFiles = Get-ChildItem -LiteralPath $bundleRoot -Recurse -Force -File | Where-Object {
  $_.Name -match "(?i)(cookie|scan|report)" -or
  $_.Name -match "(?i)^\.env" -or
  $_.Extension -match "(?i)^\.(db|db-shm|db-wal|sqlite|sqlite3)$"
}
if ($blockedFiles) {
  throw "Portable bundle contains blocked files: $($blockedFiles.FullName -join ', ')"
}

Compress-Archive -LiteralPath $bundleRoot -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item -LiteralPath $stageRoot -Recurse -Force

$zip = Get-Item -LiteralPath $zipPath
$hash = Get-FileHash -LiteralPath $zipPath -Algorithm SHA256
Write-Output "Portable ZIP: $($zip.FullName)"
Write-Output "Size: $($zip.Length) bytes"
Write-Output "SHA256: $($hash.Hash)"
