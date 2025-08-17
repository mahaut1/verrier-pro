BEGIN;

-- 1) Table des types (si pas déjà là)
CREATE TABLE IF NOT EXISTS pieces_types (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2) Unicité par user, insensible à la casse, sur (user_id, name)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'pieces_types_name_key') THEN
    DROP INDEX pieces_types_name_key;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ux_piece_types_user_name') THEN
    DROP INDEX ux_piece_types_user_name;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_piece_types_user_name_ci
  ON pieces_types (user_id, lower(name));

-- 3) Colonne FK sur pieces -> pieces_types.id (si manquante)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='pieces' AND column_name='piece_type_id'
  ) THEN
    ALTER TABLE pieces
      ADD COLUMN piece_type_id INTEGER NULL REFERENCES pieces_types(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4) (optionnel) Backfill depuis l'ancienne colonne text "type"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='pieces' AND column_name='type'
  ) THEN
    INSERT INTO pieces_types (user_id, name)
    SELECT DISTINCT p.user_id, p.type
    FROM pieces p
    WHERE p.type IS NOT NULL AND p.type <> ''
      AND NOT EXISTS (
        SELECT 1 FROM pieces_types pt
        WHERE pt.user_id = p.user_id
          AND lower(pt.name) = lower(p.type)
      );

    UPDATE pieces p
    SET piece_type_id = pt.id
    FROM pieces_types pt
    WHERE pt.user_id = p.user_id
      AND lower(pt.name) = lower(p.type)
      AND p.piece_type_id IS NULL;

     ALTER TABLE pieces DROP COLUMN type;
  END IF;
END $$;

-- 5) Unicité par user, insensible à la casse, sur (user_id, unique_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'pieces_unique_id_key') THEN
    DROP INDEX pieces_unique_id_key;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ux_pieces_user_uniqueid') THEN
    DROP INDEX ux_pieces_user_uniqueid;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_pieces_user_uniqueid_ci
  ON pieces (user_id, lower(unique_id));

COMMIT;
