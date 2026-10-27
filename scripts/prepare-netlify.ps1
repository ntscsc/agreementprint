$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$stage = Join-Path ([System.IO.Path]::GetTempPath()) ('stampvendor-netlify-' + [guid]::NewGuid().ToString('N'))
$outputDirectory = Join-Path $projectRoot 'output'
$archive = Join-Path $outputDirectory 'stampvendor-netlify-source.zip'
New-Item -ItemType Directory -Path $stage | Out-Null
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

# Copy source explicitly: never include local credentials, caches or browser profiles.
$directories = @('app', 'components', 'hooks', 'lib', 'public', 'scripts', 'src', 'tests')
$files = @('package.json', 'package-lock.json', 'netlify.toml', 'next.config.ts', 'next-env.d.ts', 'tsconfig.json', 'postcss.config.mjs', 'eslint.config.mjs', '.gitignore', '.env.example', '.nvmrc', 'firebase-applet-config.json', 'firebase.json', 'firebase.test.json', 'firestore.rules', 'firestore.indexes.json', 'storage.rules', 'README.md', 'NETLIFY-DEPLOY.md')
foreach ($entry in ($directories + $files)) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $entry) -Destination $stage -Recurse
}

# PowerShell's wildcard omits dotfiles on some hosts. Enumerate them explicitly.
$sourceFiles = Get-ChildItem -LiteralPath $stage -Force | Select-Object -ExpandProperty FullName
Compress-Archive -LiteralPath $sourceFiles -DestinationPath $archive -Force
Write-Host "Source archive: $archive"
Write-Host "Checking a clean install and build without local environment files in $stage"
Push-Location $stage
try {
    & npm.cmd ci --include=optional --prefer-offline --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Clean dependency installation failed.' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Clean production build failed.' }
} finally {
    Pop-Location
}
Write-Host 'Clean install and production build passed. Source archive is ready for a Git-connected Netlify build.'
