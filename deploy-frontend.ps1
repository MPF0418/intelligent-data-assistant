# Smart Data Analysis Assistant - Public Deployment Guide
# Run this script to create public access links

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Smart Data Assistant - Public Deploy" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Refresh PATH environment variable
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")

Write-Host "Step 1: Starting Frontend Tunnel (Port 8080)..." -ForegroundColor Yellow
Write-Host "Please copy the URL shown below and share with your friends." -ForegroundColor Yellow
Write-Host ""

# Start frontend tunnel
cloudflared tunnel --url http://localhost:8080
