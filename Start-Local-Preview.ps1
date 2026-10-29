$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $PSScriptRoot).Path.TrimEnd('\') + '\'
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 8000)

try {
    try { $listener.Start() }
    catch {
        Write-Host 'Port 8000 is already in use. Stop the old preview server, then run this file again.' -ForegroundColor Yellow
        Write-Host 'If you are unsure which program owns it, run: Get-NetTCPConnection -LocalPort 8000 -State Listen | Select LocalAddress,LocalPort,OwningProcess'
        Read-Host 'Press Enter to close this window' | Out-Null
        exit 1
    }

    Write-Host 'Midnight Candy preview is running at http://127.0.0.1:8000/' -ForegroundColor Green
    Write-Host 'Keep this window open while playing. Press Ctrl+C to stop the server.'
    try { Start-Process 'http://127.0.0.1:8000/' } catch { }

    $types = @{
        '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
        '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'
        '.gif' = 'image/gif'; '.ico' = 'image/x-icon'; '.woff2' = 'font/woff2'; '.json' = 'application/json; charset=utf-8'
    }
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $stream.ReadTimeout = 5000
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $request = $reader.ReadLine()
            if (-not $request) { continue }
            $parts = $request -split ' ', 3
            $relative = [Uri]::UnescapeDataString(($parts[1] -split '\?')[0].TrimStart('/')).Replace('/', '\')
            if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
            $file = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
            if (-not $file.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $file -PathType Leaf)) {
                $status = '404 Not Found'
                $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
                $contentType = 'text/plain; charset=utf-8'
            } else {
                $status = '200 OK'
                $contentType = $types[[System.IO.Path]::GetExtension($file).ToLowerInvariant()]
                if (-not $contentType) { $contentType = 'application/octet-stream' }
                $body = [System.IO.File]::ReadAllBytes($file)
            }
            $headers = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
            $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            $stream.Write($body, 0, $body.Length)
            $stream.Flush()
        } catch {
            Write-Host "Preview request failed: $($_.Exception.Message)" -ForegroundColor Yellow
        } finally { $client.Close() }
    }
} finally { $listener.Stop() }
