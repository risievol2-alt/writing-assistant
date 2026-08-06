PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('简单', '进阶', '挑战')),
  description TEXT NOT NULL,
  requirements TEXT NOT NULL DEFAULT '[]',
  word_limit INTEGER NOT NULL DEFAULT 800,
  duration_minutes INTEGER NOT NULL DEFAULT 25,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS works (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '练习作品',
  content TEXT NOT NULL DEFAULT '',
  prompt_id INTEGER,
  training_type TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  edit_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_prompts_type ON prompts(type);
CREATE INDEX IF NOT EXISTS idx_works_category ON works(category);
CREATE INDEX IF NOT EXISTS idx_works_updated_at ON works(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_works_completed_at ON works(completed_at);

CREATE TABLE IF NOT EXISTS "Character" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '',
  created_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Character_Field" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (
    field_type IN ('text', 'number', 'date', 'textarea', 'tag', 'select', 'multiple', 'image')
  ),
  system_key TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  options TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Character_Value" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  field_id INTEGER NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (character_id) REFERENCES "Character"(id) ON DELETE CASCADE,
  FOREIGN KEY (field_id) REFERENCES "Character_Field"(id) ON DELETE RESTRICT,
  UNIQUE(character_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_character_name ON "Character"(name);
CREATE INDEX IF NOT EXISTS idx_character_updated_time ON "Character"(updated_time DESC);
CREATE INDEX IF NOT EXISTS idx_character_field_category_order
  ON "Character_Field"(category, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_character_field_deleted
  ON "Character_Field"(is_deleted);
CREATE INDEX IF NOT EXISTS idx_character_field_system_key
  ON "Character_Field"(system_key);
CREATE INDEX IF NOT EXISTS idx_character_value_character
  ON "Character_Value"(character_id);
CREATE INDEX IF NOT EXISTS idx_character_value_field
  ON "Character_Value"(field_id);
