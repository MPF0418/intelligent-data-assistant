# Start API Tunnel (Port 5001)
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
Write-Host "Starting API Tunnel on port 5001..." -ForegroundColor Green
cloudflared tunnel --url http://localhost:5001
