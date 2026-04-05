# Smart Data Analysis Assistant - Public Network Deployment
# Run this script to create a public access link

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Smart Data Assistant - Public Deploy" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Refresh PATH environment variable
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")

Write-Host "Starting Cloudflare Tunnel..." -ForegroundColor Yellow
Write-Host "Keep this window open. Closing will stop public access." -ForegroundColor Yellow
Write-Host ""

# Start tunnel
cloudflared tunnel --url http://localhost:8080
