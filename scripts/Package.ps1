param([string]$GoExecutable = '')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$releaseVersion = (Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'frontend\package.json') | ConvertFrom-Json).version
if ($releaseVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid release version.' }
$releaseDirectory = Join-Path $projectRoot ('releases\' + $releaseVersion)
$stagingDirectory = Join-Path $projectRoot 'build\packaging'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Windows .NET Framework C# compiler is required.' }
New-Item -ItemType Directory -Force -Path $releaseDirectory,$stagingDirectory | Out-Null
if ($GoExecutable) { $env:ASTER_GO = $GoExecutable }
Push-Location $projectRoot
try {
    node (Join-Path $PSScriptRoot 'CollectLicenses.mjs') $releaseDirectory
    if ($LASTEXITCODE -ne 0) { throw 'License collection failed.' }
    Copy-Item -LiteralPath (Join-Path $projectRoot 'build\bin\AsterSSH.exe') -Destination (Join-Path $releaseDirectory 'AsterSSH.exe')
    Copy-Item -LiteralPath (Join-Path $projectRoot 'docs\使用说明.md') -Destination (Join-Path $releaseDirectory '使用说明.md')
    $applicationHash = (Get-FileHash -LiteralPath (Join-Path $releaseDirectory 'AsterSSH.exe') -Algorithm SHA256).Hash
    $generated = 'internal static class PayloadInfo { internal const string Sha256 = "' + $applicationHash + '"; internal const string Version = "' + $releaseVersion + '"; }'
    Set-Content -LiteralPath (Join-Path $stagingDirectory 'PayloadInfo.cs') -Value $generated -Encoding utf8
    $compressScript = @'
import fs from 'node:fs';
import zlib from 'node:zlib';
fs.writeFileSync('build/packaging/app.gz',zlib.gzipSync(fs.readFileSync(process.argv[2]),{level:9}));
'@
    $compressScript | node --input-type=module - (Join-Path $releaseDirectory 'AsterSSH.exe')
    if ($LASTEXITCODE -ne 0) { throw 'Payload compression failed.' }
    $source = Join-Path $projectRoot 'installer\Installer.cs'
    $manifest = Join-Path $projectRoot 'installer\app.manifest'
    $icon = Join-Path $projectRoot 'build\windows\icon.ico'
    $generatedFile = Join-Path $stagingDirectory 'PayloadInfo.cs'
    $uninstaller = Join-Path $stagingDirectory 'Uninstall.exe'
    $common = @('/nologo','/target:winexe','/platform:x64','/optimize+','/codepage:65001','/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll','/reference:Microsoft.CSharp.dll',('/win32manifest:' + $manifest),('/win32icon:' + $icon))
    & $compiler @common '/define:UNINSTALLER' ('/out:' + $uninstaller) $source $generatedFile
    if ($LASTEXITCODE -ne 0) { throw 'Uninstaller compilation failed.' }
    $setup = Join-Path $releaseDirectory 'AsterSSH-Setup.exe'
    & $compiler @common ('/out:' + $setup) ('/resource:' + (Join-Path $stagingDirectory 'app.gz') + ',Aster.App') ('/resource:' + $uninstaller + ',Aster.Uninstaller') ('/resource:' + (Join-Path $releaseDirectory '使用说明.md') + ',Aster.Guide') ('/resource:' + (Join-Path $releaseDirectory '第三方许可证.txt') + ',Aster.Notices') $source $generatedFile
    if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }
    $portable = Join-Path $releaseDirectory 'AsterSSH-Portable.zip'
    Compress-Archive -LiteralPath @((Join-Path $releaseDirectory 'AsterSSH.exe'),(Join-Path $releaseDirectory '使用说明.md'),(Join-Path $releaseDirectory '第三方许可证.txt')) -DestinationPath $portable -Force
    $checksums = @('AsterSSH.exe','AsterSSH-Setup.exe','AsterSSH-Portable.zip') | ForEach-Object { $itemHash = (Get-FileHash -LiteralPath (Join-Path $releaseDirectory $_) -Algorithm SHA256).Hash.ToLowerInvariant(); $itemHash + '  ' + $_ }
    Set-Content -LiteralPath (Join-Path $releaseDirectory 'SHA256SUMS.txt') -Value $checksums -Encoding ascii
    Get-ChildItem -LiteralPath $releaseDirectory -File | Select-Object Name,Length
} finally {
    Pop-Location
    # This fixed, verified workspace subdirectory contains only generated packaging files.
    $resolvedStaging = [System.IO.Path]::GetFullPath($stagingDirectory)
    $expectedStaging = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'build\packaging'))
    if ($resolvedStaging -eq $expectedStaging -and (Test-Path -LiteralPath $resolvedStaging)) { Remove-Item -LiteralPath $resolvedStaging -Recurse -Force }
}
