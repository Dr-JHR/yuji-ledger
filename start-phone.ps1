param(
  [int]$Port = 4780
)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

function Find-Node {
  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $candidates = @(
    "C:\Program Files\nodejs\node.exe",
    "C:\Program Files (x86)\nodejs\node.exe"
  )
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }
  return $null
}

function Find-Python {
  $command = Get-Command python -ErrorAction SilentlyContinue
  if ($command -and $command.Source -notlike "*WindowsApps*") { return $command.Source }
  $candidates = @(
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
    "C:\Python312\python.exe",
    "C:\Python311\python.exe"
  )
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }
  return $null
}

function Get-LanAddresses {
  return Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.InterfaceAlias -notmatch "Radmin|VPN|Virtual|vEthernet|VMware|Tailscale|ZeroTier"
    } |
    Sort-Object InterfaceAlias
}

function Test-YujiRunning {
  try {
    $response = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$Port/" -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content -match "<title>余记"
  } catch {
    return $false
  }
}

if (Test-YujiRunning) {
  $addresses = Get-LanAddresses
  Write-Host ""
  Write-Host "  余记服务已经在运行，无需重复启动。" -ForegroundColor Green
  Write-Host "  电脑本机：http://localhost:$Port"
  foreach ($item in $addresses) {
    Write-Host "  手机访问：http://$($item.IPAddress):$Port  ($($item.InterfaceAlias))"
  }
  Write-Host ""
  Write-Host "  手机与电脑连接同一个 Wi-Fi，然后打开上面的手机访问地址。"
  Write-Host ""
  Read-Host "按 Enter 关闭这个提示窗口（服务会继续运行）"
  exit 0
}

$node = Find-Node
if ($node) {
  Write-Host ""
  Write-Host "  正在启动余记手机访问服务..." -ForegroundColor Green
  Write-Host ""
  & $node (Join-Path $PSScriptRoot "server.mjs") --port $Port
  $exitCode = $LASTEXITCODE
} else {
  $python = Find-Python
  if (-not $python) {
    Write-Host "没有找到 Node.js 或 Python。" -ForegroundColor Red
    Write-Host "请安装 Node.js（推荐），或把项目部署到任意静态网站。"
    Read-Host "按 Enter 关闭"
    exit 1
  }

  $addresses = Get-LanAddresses

  Write-Host ""
  Write-Host "  余记 · 手机访问服务已启动（Python）" -ForegroundColor Green
  Write-Host "  电脑本机：http://localhost:$Port"
  foreach ($item in $addresses) {
    Write-Host "  手机访问：http://$($item.IPAddress):$Port  ($($item.InterfaceAlias))"
  }
  Write-Host ""
  Write-Host "  手机与电脑需连接同一 Wi-Fi；按 Ctrl+C 停止。"
  Write-Host ""
  & $python -m http.server $Port --bind 0.0.0.0
  $exitCode = $LASTEXITCODE
}

Write-Host ""
if ($exitCode -eq 0) {
  Write-Host "服务已停止。" -ForegroundColor Yellow
} else {
  Write-Host "服务异常退出，请检查上方错误信息。" -ForegroundColor Red
}
Read-Host "按 Enter 关闭窗口"
