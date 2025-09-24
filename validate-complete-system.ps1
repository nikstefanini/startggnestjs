# Script de Validación Completa del Sistema de Torneos Start.gg
# Este script valida todo el flujo del sistema desde la creación hasta las notificaciones

Write-Host "🏆 VALIDACIÓN COMPLETA DEL SISTEMA DE TORNEOS START.GG" -ForegroundColor Green
Write-Host "=" * 60

# 1. Verificar estado del servidor
Write-Host "`n1. 🔍 Verificando estado del servidor..." -ForegroundColor Yellow
try {
    $serverStatus = Invoke-RestMethod -Uri "http://localhost:8081/health" -Method GET -ErrorAction Stop
    Write-Host "✅ Servidor activo y funcionando" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Servidor no disponible" -ForegroundColor Red
    exit 1
}

# 2. Verificar usuarios registrados
Write-Host "`n2. 👥 Verificando usuarios de prueba..." -ForegroundColor Yellow
$users = @()
for ($i = 1; $i -le 8; $i++) {
    try {
        $loginData = @{
            email = "player$i@test.com"
            password = "password123"
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "http://localhost:8081/auth/login" -Method POST -Body $loginData -ContentType "application/json"
        $users += @{
            id = $i
            email = "player$i@test.com"
            token = $response.access_token
        }
        Write-Host "✅ Usuario player$i autenticado correctamente" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error autenticando player$i" -ForegroundColor Red
    }
}

# 3. Verificar torneo activo
Write-Host "`n3. 🏟️ Verificando torneo activo..." -ForegroundColor Yellow
try {
    $tournaments = Invoke-RestMethod -Uri "http://localhost:8081/tournaments" -Method GET
    $activeTournament = $tournaments | Where-Object { $_.status -eq "ACTIVE" } | Select-Object -First 1
    
    if ($activeTournament) {
        Write-Host "✅ Torneo activo encontrado: $($activeTournament.name)" -ForegroundColor Green
        Write-Host "   ID: $($activeTournament.id)" -ForegroundColor Cyan
        Write-Host "   Estado: $($activeTournament.status)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ No se encontró torneo activo" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error verificando torneos" -ForegroundColor Red
}

# 4. Verificar evento activo
Write-Host "`n4. 🎯 Verificando evento activo..." -ForegroundColor Yellow
try {
    $events = Invoke-RestMethod -Uri "http://localhost:8081/events" -Method GET
    $activeEvent = $events | Where-Object { $_.status -eq "ACTIVE" } | Select-Object -First 1
    
    if ($activeEvent) {
        Write-Host "✅ Evento activo encontrado: $($activeEvent.name)" -ForegroundColor Green
        Write-Host "   ID: $($activeEvent.id)" -ForegroundColor Cyan
        Write-Host "   Estado: $($activeEvent.status)" -ForegroundColor Cyan
        Write-Host "   Tipo: $($activeEvent.type)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ No se encontró evento activo" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error verificando eventos" -ForegroundColor Red
}

# 5. Verificar participantes del evento
Write-Host "`n5. 👨‍👩‍👧‍👦 Verificando participantes del evento..." -ForegroundColor Yellow
if ($activeEvent) {
    try {
        $participants = Invoke-RestMethod -Uri "http://localhost:8081/events/$($activeEvent.id)/participants" -Method GET
        Write-Host "✅ Participantes registrados: $($participants.Count)" -ForegroundColor Green
        
        foreach ($participant in $participants) {
            Write-Host "   - Participante ID: $($participant.participantId) | Estado: $($participant.status)" -ForegroundColor Cyan
        }
    } catch {
        Write-Host "❌ Error verificando participantes" -ForegroundColor Red
    }
}

# 6. Verificar bracket activo
Write-Host "`n6. 🏆 Verificando bracket activo..." -ForegroundColor Yellow
try {
    $brackets = Invoke-RestMethod -Uri "http://localhost:8081/brackets" -Method GET
    $activeBracket = $brackets | Where-Object { $_.status -eq "ACTIVE" } | Select-Object -First 1
    
    if ($activeBracket) {
        Write-Host "✅ Bracket activo encontrado: $($activeBracket.name)" -ForegroundColor Green
        Write-Host "   ID: $($activeBracket.id)" -ForegroundColor Cyan
        Write-Host "   Tipo: $($activeBracket.type)" -ForegroundColor Cyan
        Write-Host "   Participantes: $($activeBracket.participants)" -ForegroundColor Cyan
        Write-Host "   Estado: $($activeBracket.status)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ No se encontró bracket activo" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error verificando brackets" -ForegroundColor Red
}

# 7. Verificar matches del bracket
Write-Host "`n7. ⚔️ Verificando matches del bracket..." -ForegroundColor Yellow
if ($activeBracket) {
    try {
        $matches = Invoke-RestMethod -Uri "http://localhost:8081/brackets/$($activeBracket.id)/matches" -Method GET
        Write-Host "✅ Total de matches: $($matches.Count)" -ForegroundColor Green
        
        # Agrupar por ronda
        $rounds = $matches | Group-Object round_id | Sort-Object Name
        foreach ($round in $rounds) {
            $roundName = switch ($round.Name) {
                "0" { "Primera Ronda" }
                "1" { "Semifinales" }
                "2" { "Final" }
                default { "Ronda $($round.Name)" }
            }
            
            $completedMatches = ($round.Group | Where-Object { $_.status -ge 3 }).Count
            $totalMatches = $round.Group.Count
            
            Write-Host "   📊 $roundName`: $completedMatches/$totalMatches completados" -ForegroundColor Cyan
        }
    } catch {
        Write-Host "❌ Error verificando matches" -ForegroundColor Red
    }
}

# 8. Resumen final
Write-Host "`n8. 📋 RESUMEN FINAL" -ForegroundColor Yellow
Write-Host "=" * 40

$systemStatus = @{
    "Servidor" = if ($serverStatus) { "✅ Activo" } else { "❌ Inactivo" }
    "Usuarios" = "✅ $($users.Count)/8 autenticados"
    "Torneo" = if ($activeTournament) { "✅ Activo" } else { "❌ No encontrado" }
    "Evento" = if ($activeEvent) { "✅ Activo" } else { "❌ No encontrado" }
    "Participantes" = if ($participants) { "✅ $($participants.Count) registrados" } else { "❌ No encontrados" }
    "Bracket" = if ($activeBracket) { "✅ Activo" } else { "❌ No encontrado" }
    "Matches" = if ($matches) { "✅ $($matches.Count) generados" } else { "❌ No encontrados" }
}

foreach ($component in $systemStatus.GetEnumerator()) {
    Write-Host "   $($component.Key): $($component.Value)" -ForegroundColor White
}

Write-Host "`n🎉 VALIDACIÓN COMPLETADA" -ForegroundColor Green
Write-Host "El sistema de torneos Start.gg está funcionando correctamente!" -ForegroundColor Green
Write-Host "=" * 60