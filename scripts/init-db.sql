-- Script de inicialización de base de datos para START.GG Clone
-- Crear la base de datos si no existe

-- Conectar a la base de datos postgres por defecto
\c postgres;

-- Crear usuario si no existe
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'startgg_user') THEN

      CREATE ROLE startgg_user LOGIN PASSWORD 'startgg_password';
   END IF;
END
$do$;

-- Crear la base de datos si no existe
SELECT 'CREATE DATABASE startgg_db OWNER startgg_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'startgg_db')\gexec

-- Otorgar permisos
GRANT ALL PRIVILEGES ON DATABASE startgg_db TO startgg_user;

-- Conectar a la nueva base de datos
\c startgg_db;

-- Crear extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Mensaje de confirmación
\echo 'Base de datos startgg_db creada exitosamente'