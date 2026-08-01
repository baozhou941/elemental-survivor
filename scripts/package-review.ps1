param(
  [string]$Version = 'v0.3'
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$reviewDir = Join-Path $root 'artifacts\review'
$stage = Join-Path $root "artifacts\review-stage-$Version"
$zip = Join-Path $reviewDir "elemental-survivor-$Version-review.zip"

if (Test-Path -LiteralPath $stage) {
  throw "Review staging directory already exists: $stage"
}

New-Item -ItemType Directory -Force -Path $reviewDir | Out-Null
New-Item -ItemType Directory -Path $stage | Out-Null

foreach ($directory in @('src', 'tests', 'e2e', 'scripts', 'docs')) {
  Copy-Item -LiteralPath (Join-Path $root $directory) -Destination (Join-Path $stage $directory) -Recurse
}

foreach ($file in @('index.html', 'styles.css', 'package.json', 'package-lock.json', 'playwright.config.js')) {
  Copy-Item -LiteralPath (Join-Path $root $file) -Destination (Join-Path $stage $file)
}

$screenshotStage = Join-Path $stage 'artifacts\screenshots'
$playtestStage = Join-Path $stage 'artifacts\playtest'
New-Item -ItemType Directory -Force -Path $screenshotStage, $playtestStage | Out-Null

foreach ($name in @('title', 'gameplay', 'upgrade', 'paused', 'game-over')) {
  Copy-Item -LiteralPath (Join-Path $root "artifacts\screenshots\$Version-$name.png") -Destination $screenshotStage
}

foreach ($name in @("$Version-three-minute.png", "$Version-three-minute.json", "$Version-balance-30-seeds.json")) {
  Copy-Item -LiteralPath (Join-Path $root "artifacts\playtest\$name") -Destination $playtestStage
}

foreach ($name in @("$Version-wind-90s-30-seeds.json", "$Version-ice-90s-30-seeds.json")) {
  $source = Join-Path $root "artifacts\playtest\$name"
  if (Test-Path -LiteralPath $source) {
    Copy-Item -LiteralPath $source -Destination $playtestStage
  }
}

$sensitiveNames = Get-ChildItem -LiteralPath $stage -Recurse -Force | Where-Object {
  $_.Name -match '(^\.env($|\.)|cookie|credential|private.?key|\.pem$|\.pfx$|browser.?state)'
}
if ($sensitiveNames) {
  $sensitiveNames.FullName | Write-Output
  throw 'Sensitive filename found in review package.'
}

$textFiles = Get-ChildItem -LiteralPath $stage -Recurse -File | Where-Object {
  $_.Extension -match '^\.(js|mjs|json|md|html|css|ps1)$'
}
$secretPattern = '(?i)(api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*["''][A-Za-z0-9_-]{16,}'
$secretMatches = $textFiles | Select-String -Pattern $secretPattern -AllMatches
if ($secretMatches) {
  $secretMatches | Write-Output
  throw 'Secret-like value found in review package.'
}

Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal -Force

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
$entries = @($archive.Entries | ForEach-Object FullName)
$archive.Dispose()

$excludedEntries = $entries | Where-Object {
  $_ -match '(^|/)(node_modules|\.git|dist|build|coverage|cache)(/|$)' -or
  $_ -match '(^|/)\.env($|\.)|cookie|credential|private.?key'
}
if ($excludedEntries) {
  $excludedEntries | Write-Output
  throw 'Excluded path found in completed archive.'
}

[PSCustomObject]@{
  Archive = $zip
  Size = (Get-Item -LiteralPath $zip).Length
  Files = $entries.Count
  Sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash
}
