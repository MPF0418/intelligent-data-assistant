# Restart Tunnel Script
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")

Write-Host "Restarting Cloudflare Tunnel..." -ForegroundColor Cyan
Write-Host "Waiting for network to stabilize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

cloudflared tunnel --url http://localhost:8080
