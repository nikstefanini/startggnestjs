# Script de configuración de base de datos para START.GG Clone
# Configurar PostgreSQL y crear la base de datos

Write-Host "=== Configurando Base de Datos PostgreSQL ===" -ForegroundColor Green

# Definir rutas
$PSQL_PATH = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$SQL_SCRIPT = Join-Path $SCRIPT_DIR "init-db.sql"

# Verificar que PostgreSQL esté instalado
if (-not (Test-Path $PSQL_PATH)) {
    Write-Host "Error: PostgreSQL no encontrado en $PSQL_PATH" -ForegroundColor Red
    Write-Host "Por favor instala PostgreSQL 17 o ajusta la ruta en el script" -ForegroundColor Yellow
    exit 1
}

# Verificar que el servicio esté corriendo
$service = Get-Service -Name "postgresql-x64-17" -ErrorAction SilentlyContinue
if ($service.Status -ne "Running") {
    Write-Host "Iniciando servicio PostgreSQL..." -ForegroundColor Yellow
    Start-Service -Name "postgresql-x64-17"
    Start-Sleep -Seconds 3
}

Write-Host "Ejecutando script de inicialización de base de datos..." -ForegroundColor Yellow

# Intentar ejecutar el script SQL
try {
    # Usar autenticación de Windows (trust)
    & $PSQL_PATH -U postgres -f $SQL_SCRIPT
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Base de datos configurada exitosamente" -ForegroundColor Green
        
        # Actualizar archivo .env con las credenciales correctas
        $envPath = Join-Path (Split-Path -Parent $SCRIPT_DIR) ".env"
        if (Test-Path $envPath) {
            $envContent = Get-Content $envPath
            $newEnvContent = $envContent -replace 'DATABASE_URL=".*"', 'DATABASE_URL="postgresql://startgg_user:startgg_password@localhost:5432/startgg_db?schema=public"'
            Set-Content -Path $envPath -Value $newEnvContent
            Write-Host "✓ Archivo .env actualizado con las credenciales de la base de datos" -ForegroundColor Green
        }
        
        Write-Host "`n=== Configuración Completada ===" -ForegroundColor Green
        Write-Host "Base de datos: startgg_db" -ForegroundColor Cyan
        Write-Host "Usuario: startgg_user" -ForegroundColor Cyan
        Write-Host "Contraseña: startgg_password" -ForegroundColor Cyan
        Write-Host "Host: localhost:5432" -ForegroundColor Cyan
        
    } else {
        Write-Host "Error al ejecutar el script SQL" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`nIntentando con configuración alternativa..." -ForegroundColor Yellow
    
    # Si falla, intentar crear manualmente
    Write-Host "Creando base de datos manualmente..." -ForegroundColor Yellow
    & $PSQL_PATH -U postgres -c "CREATE DATABASE startgg_db;"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Base de datos startgg_db creada" -ForegroundColor Green
    }
}

Write-Host "`nPuedes continuar con: npx prisma migrate dev --name init" -ForegroundColor Cyan