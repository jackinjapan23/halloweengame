$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $PSScriptRoot).Path.TrimEnd('\') + '\'
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 8000)

try {
    $listener.Start()
    try { Start-Process 'http://127.0.0.1:8000/' } catch { Write-Host 'Open http://127.0.0.1:8000/ in your browser.' }
    Write-Host 'Local Midnight Candy preview: http://127.0.0.1:8000/'
    Write-Host 'Keep this window open. Press Ctrl+C here to stop the preview server.'

    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $request = $reader.ReadLine()
            while (($line = $reader.ReadLine()) -ne $null -and $line -ne '') { }

            if (-not $request) { continue }
            $parts = $request -split ' ', 3
            $relative = [Uri]::UnescapeDataString(($parts[1] -split '\?')[0].TrimStart('/')).Replace('/', '\')
            if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
            $file = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
            $status = '200 OK'
            if (-not $file.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $file -PathType Leaf)) {
                $status = '404 Not Found'
                $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
                $contentType = 'text/plain; charset=utf-8'
            }
            else {
                $contentType = switch ([System.IO.Path]::GetExtension($file).ToLowerInvariant()) {
                    '.html' { 'text/html; charset=utf-8' }
                    '.css'  { 'text/css; charset=utf-8' }
                    '.js'   { 'text/javascript; charset=utf-8' }
                    '.svg'  { 'image/svg+xml' }
                    default { 'application/octet-stream' }
                }
                $body = [System.IO.File]::ReadAllBytes($file)
            }

            $headers = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
            $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            $stream.Write($body, 0, $body.Length)
            $stream.Flush()
        }
        finally { $client.Close() }
    }
}
finally { $listener.Stop() }

