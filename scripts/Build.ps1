param([switch]$SkipTests)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$go = Join-Path $projectRoot '.tools\go\bin\go.exe'
if (-not (Test-Path -LiteralPath $go)) { $go = (Get-Command go -ErrorAction Stop).Source }
$wails = Join-Path $projectRoot '.tools\bin\wails.exe'
if (-not (Test-Path -LiteralPath $wails)) { $wails = (Get-Command wails -ErrorAction Stop).Source }
$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if ($pnpm) { $pnpm = $pnpm.Source } else { $pnpm = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' }
if (-not (Test-Path -LiteralPath $pnpm)) { throw 'Install pnpm and Node.js before building.' }
$env:PATH = (Split-Path -Parent $go) + ';' + $env:PATH
if (Test-Path -LiteralPath (Join-Path $projectRoot '.tools\gomodcache')) { $env:GOMODCACHE = Join-Path $projectRoot '.tools\gomodcache' }
$env:GOPATH = Join-Path $projectRoot '.tools\gopath'
Push-Location $projectRoot
try {
    Push-Location (Join-Path $projectRoot 'frontend')
    try { & $pnpm install --frozen-lockfile; if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }; node build.mjs; if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' } } finally { Pop-Location }
    if (-not $SkipTests) { & $go test ./...; if ($LASTEXITCODE -ne 0) { throw 'Go tests failed.' }; & $go vet ./...; if ($LASTEXITCODE -ne 0) { throw 'Go vet failed.' } }
    & (Join-Path $PSScriptRoot 'GenerateIcon.ps1')
    & $wails build -m -s -trimpath -webview2 browser
    if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed.' }
    & (Join-Path $PSScriptRoot 'Package.ps1') -GoExecutable $go
} finally { Pop-Location }
