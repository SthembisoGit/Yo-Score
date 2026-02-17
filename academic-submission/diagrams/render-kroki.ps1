Param(
  [string]$InputDir = ".",
  [string]$OutputDir = "./exports"
)

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$files = Get-ChildItem -Path $InputDir -Filter *.puml -File
foreach ($file in $files) {
  $name = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
  $out = Join-Path $OutputDir "$name.png"
  $content = Get-Content -Path $file.FullName -Raw
  Invoke-WebRequest `
    -Uri "https://kroki.io/plantuml/png" `
    -Method Post `
    -ContentType "text/plain; charset=utf-8" `
    -Body $content `
    -OutFile $out
  Write-Host "Rendered $($file.Name) -> $out"
}
