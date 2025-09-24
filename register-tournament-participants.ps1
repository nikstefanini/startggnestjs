# Script para registrar usuarios en el torneo
$tournamentId = "cmfy37nsa0001300yuyf2vw50"
$eventId = "cmfy38nge0001tw8xgiqtw0x6"

$users = Get-Content -Path "registered-users.json" | ConvertFrom-Json

$tournamentParticipants = @()
$eventParticipants = @()

Write-Host "Registrando usuarios en el torneo: $tournamentId"
Write-Host "Registrando usuarios en el evento: $eventId"
Write-Host ""

foreach ($user in $users) {
    Write-Host "Registrando $($user.username) en el torneo..."
    
    # Registrar en el torneo
    $tournamentData = @{
        userId = $user.id
    } | ConvertTo-Json -Compress
    
    try {
        $response = curl -X POST "http://localhost:8081/tournaments/$tournamentId/participants" -H "Content-Type: application/json" -d $tournamentData --silent
        $responseObj = $response | ConvertFrom-Json
        
        if ($responseObj.id) {
            Write-Host "✓ $($user.username) registrado en torneo exitosamente"
            $tournamentParticipants += $responseObj
        } else {
            Write-Host "✗ Error registrando $($user.username) en torneo: $response"
        }
    }
    catch {
        Write-Host "✗ Error registrando $($user.username) en torneo: $($_.Exception.Message)"
    }
    
    Start-Sleep -Milliseconds 300
    
    Write-Host "Registrando $($user.username) en el evento..."
    
    # Registrar en el evento
    $eventData = @{
        userId = $user.id
    } | ConvertTo-Json -Compress
    
    try {
        $response = curl -X POST "http://localhost:8081/events/$eventId/participants" -H "Content-Type: application/json" -d $eventData --silent
        $responseObj = $response | ConvertFrom-Json
        
        if ($responseObj.id) {
            Write-Host "✓ $($user.username) registrado en evento exitosamente"
            $eventParticipants += $responseObj
        } else {
            Write-Host "✗ Error registrando $($user.username) en evento: $response"
        }
    }
    catch {
        Write-Host "✗ Error registrando $($user.username) en evento: $($_.Exception.Message)"
    }
    
    Write-Host ""
    Start-Sleep -Milliseconds 300
}

Write-Host "Resumen:"
Write-Host "Participantes registrados en torneo: $($tournamentParticipants.Count)"
Write-Host "Participantes registrados en evento: $($eventParticipants.Count)"

# Guardar información de participantes
$tournamentParticipants | ConvertTo-Json | Out-File -FilePath "tournament-participants.json"
$eventParticipants | ConvertTo-Json | Out-File -FilePath "event-participants.json"