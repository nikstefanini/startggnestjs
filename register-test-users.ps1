# Script para registrar usuarios de prueba
$users = Get-Content -Path "test-users.json" | ConvertFrom-Json

$registeredUsers = @()

foreach ($user in $users) {
    Write-Host "Registrando usuario: $($user.username)"
    
    $userJson = $user | ConvertTo-Json -Compress
    
    try {
        $response = curl -X POST http://localhost:8081/auth/register -H "Content-Type: application/json" -d $userJson --silent
        $responseObj = $response | ConvertFrom-Json
        
        if ($responseObj.user) {
            Write-Host "✓ Usuario $($user.username) registrado exitosamente con ID: $($responseObj.user.id)"
            $registeredUsers += @{
                username = $user.username
                id = $responseObj.user.id
                accessToken = $responseObj.accessToken
            }
        } else {
            Write-Host "✗ Error registrando usuario $($user.username): $response"
        }
    }
    catch {
        Write-Host "✗ Error registrando usuario $($user.username): $($_.Exception.Message)"
    }
    
    Start-Sleep -Milliseconds 500
}

# Guardar información de usuarios registrados
$registeredUsers | ConvertTo-Json | Out-File -FilePath "registered-users.json"
Write-Host "`nUsuarios registrados guardados en registered-users.json"
Write-Host "Total de usuarios registrados: $($registeredUsers.Count)"