#!/bin/sh
set -eu

# Vérifs de base
: "${APPUSER_NAME:?APPUSER_NAME manquant}"
: "${APPUSER_PASSWORD:?APPUSER_PASSWORD manquant}"
: "${POSTGRES_DB:?POSTGRES_DB manquant}"
: "${POSTGRES_USER:?POSTGRES_USER manquant}"

echo "[init-from-env] Création rôle/appuser et base si besoin…"

# 1) Créer le rôle et la base si pas existants (DB postgres)
psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d postgres <<SQL
DO \$\$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APPUSER_NAME}') THEN
      EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '${APPUSER_NAME}', '${APPUSER_PASSWORD}');
   END IF;
END
\$\$;

DO \$\$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${POSTGRES_DB}') THEN
      EXECUTE format('CREATE DATABASE %I OWNER %I', '${POSTGRES_DB}', '${APPUSER_NAME}');
   END IF;
END
\$\$;
SQL

# 2) Droits dans la base applicative
psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<SQL
GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO ${APPUSER_NAME};

-- droits schéma & défauts
GRANT USAGE, CREATE ON SCHEMA public TO ${APPUSER_NAME};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO ${APPUSER_NAME};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT,UPDATE ON SEQUENCES TO ${APPUSER_NAME};

-- droits sur existant
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${APPUSER_NAME};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${APPUSER_NAME};

-- schéma drizzle
CREATE SCHEMA IF NOT EXISTS drizzle AUTHORIZATION ${APPUSER_NAME};

-- search_path par défaut
ALTER ROLE ${APPUSER_NAME} IN DATABASE ${POSTGRES_DB} SET search_path = public, drizzle;
SQL

echo "[init-from-env] Terminé."
