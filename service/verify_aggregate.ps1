# Verify Aggregate Service Integration

Write-Host "Verifying Aggregate Service Integration..." -ForegroundColor Cyan

# 1. Run Unit Tests
Write-Host "Running Unit Tests..."
npm test src/modules/aggregate/aggregate.service.spec.ts

if ($LASTEXITCODE -ne 0) {
    Write-Error "Unit tests failed!"
    exit 1
}

# 2. Check SSE Format (Manual Verification Instructions)
Write-Host "`nSSE Verification Instructions:" -ForegroundColor Yellow
Write-Host "1. Start the server: npm run dev"
Write-Host "2. Send a POST request to /api/chat/tasks with a workflow-bound conversation."
Write-Host "3. Connect to SSE stream using: curl -N -H 'Authorization: Bearer <TOKEN>' http://localhost:3000/api/chat/tasks/<TASK_ID>/events"
Write-Host "4. Verify output contains:"
Write-Host "   - id: <ULID>"
Write-Host "   - retry: 3000"
Write-Host "   - :keep-alive (every 15s)"

Write-Host "`nVerification Script Completed." -ForegroundColor Green
