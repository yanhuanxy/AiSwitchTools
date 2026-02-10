$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$clientDir = Join-Path $root "client"

$serverDir = $null
$candidateServerDir = Join-Path $root "server"
$candidateServiceDir = Join-Path $root "service"
if (Test-Path $candidateServerDir) {
  $serverDir = $candidateServerDir
} elseif (Test-Path $candidateServiceDir) {
  $serverDir = $candidateServiceDir
} else {
  throw "未找到后端目录：期望存在 ./server 或 ./service"
}

if (-not (Test-Path $clientDir)) {
  throw "未找到前端目录：$clientDir"
}

function Start-NpmDev {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$WorkingDir
  )

  Write-Host "Starting $Name in $WorkingDir ..."
  if ($Name -eq "backend") {
    Write-Host "Generating Prisma Client..."
    Push-Location $WorkingDir
    try {
        npx prisma generate
    } catch {
        Write-Warning "Prisma generation failed. Continuing anyway..."
    } finally {
        Pop-Location
    }
  }
  $cmd = "Set-Location -LiteralPath `"$WorkingDir`"; npm run dev"
  Start-Process -FilePath "powershell" -ArgumentList @("-NoExit", "-Command", $cmd) -WindowStyle Normal | Out-Null
}

Start-NpmDev -Name "backend" -WorkingDir $serverDir
Start-NpmDev -Name "frontend" -WorkingDir $clientDir

Write-Host ""
Write-Host "Frontend: http://localhost:3000/"
Write-Host "Backend:  http://localhost:3100/"
