$ErrorActionPreference = "Stop"

function Invoke-Api {
    param(
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [object]$Body = $null
    )
    
    $params = @{
        Uri = "http://localhost:3100$Url"
        Method = $Method
        Headers = $Headers
        ContentType = "application/json"
    }
    
    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 10)
    }

    try {
        $response = Invoke-RestMethod @params
        return @{ Success = $true; Data = $response; StatusCode = 200 } # Invoke-RestMethod returns body on success, status is usually 200-299
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorBody = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorBody)
        $respBody = $reader.ReadToEnd()
        return @{ Success = $false; StatusCode = $statusCode; ErrorBody = $respBody }
    }
}

Write-Host "1. Getting Auth Token..."
$auth = Invoke-Api -Url "/api/auth/anon" -Method "POST"
if (-not $auth.Success) {
    Write-Host "Error getting token: $($auth.StatusCode)"
    Write-Host "Body: $($auth.ErrorBody)"
    Write-Error "Failed to get auth token"
}
$token = $auth.Data.accessToken
Write-Host "Token obtained."
$headers = @{ "Authorization" = "Bearer $token" }

Write-Host "`n2. Testing Character Not Found (Should be 403)..."
$res = Invoke-Api -Url "/api/characters/non-existent-id-123" -Method "GET" -Headers $headers
if ($res.StatusCode -eq 403) {
    Write-Host "✅ PASS: Returned 403 Forbidden as expected."
} else {
    Write-Host "❌ FAIL: Expected 403, got $($res.StatusCode)"
    Write-Host "Body: $($res.ErrorBody)"
}

Write-Host "`n3. Testing Create Character with Invalid Avatar (Should be 400)..."
$body = @{
    name = "Test Char"
    avatarAttachmentId = "non-existent-att-id"
}
$res = Invoke-Api -Url "/api/characters" -Method "POST" -Headers $headers -Body $body
if ($res.StatusCode -eq 400) {
    if ($res.ErrorBody -match "Invalid avatar attachment") {
        Write-Host "✅ PASS: Returned 400 and 'Invalid avatar attachment' as expected."
    } else {
        Write-Host "⚠️ PARTIAL: Returned 400 but message mismatch."
        Write-Host "Body: $($res.ErrorBody)"
    }
} else {
    Write-Host "❌ FAIL: Expected 400, got $($res.StatusCode)"
    Write-Host "Body: $($res.ErrorBody)"
}
