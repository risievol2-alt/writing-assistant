import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { safeJsonParse } from "./utils.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDir, "..", "..");
const schemaPath = resolve(projectRoot, "database", "schema.sql");
const seedPath = resolve(projectRoot, "database", "seed-prompts.json");
const characterFieldSeedPath = resolve(
  projectRoot,
  "database",
  "seed-character-fields.json",
);

export function resolveDatabasePath(dataDirectory = process.env.INKSTONE_DATA_DIR) {
  const normalizedDirectory = String(dataDirectory || "").trim();
  return normalizedDirectory
    ? resolve(normalizedDirectory, "writing-assistant.db")
    : resolve(projectRoot, "database", "writing-assistant.db");
}

export function mapPrompt(row) {
  if (!row) return null;
  return {
    ...row,
    wordLimit: row.word_limit,
    durationMinutes: row.duration_minutes,
    isFavorite: Boolean(row.is_favorite),
    requirements: safeJsonParse(row.requirements),
    isCompleted: Boolean(row.is_completed),
    word_limit: undefined,
    duration_minutes: undefined,
    is_favorite: undefined,
    is_completed: undefined,
  };
}

export function mapWork(row) {
  if (!row) return null;
  return {
    ...row,
    promptId: row.prompt_id,
    trainingType: row.training_type,
    wordCount: row.word_count,
    durationSeconds: row.duration_seconds,
    editCount: row.edit_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    tags: safeJsonParse(row.tags),
    prompt_id: undefined,
    training_type: undefined,
    word_count: undefined,
    duration_seconds: undefined,
    edit_count: undefined,
    created_at: undefined,
    updated_at: undefined,
    completed_at: undefined,
  };
}

export function createDatabase(filename = resolveDatabasePath()) {
  if (filename !== ":memory:") {
    mkdirSync(dirname(filename), { recursive: true });
  }

  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(readFileSync(schemaPath, "utf8"));

  const { count } = db.prepare("SELECT COUNT(*) AS count FROM prompts").get();
  if (count === 0) {
    const prompts = JSON.parse(readFileSync(seedPath, "utf8"));
    const insert = db.prepare(`
      INSERT INTO prompts (
        title, type, difficulty, description, requirements, word_limit, duration_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec("BEGIN");
    try {
      for (const prompt of prompts) {
        insert.run(
          prompt.title,
          prompt.type,
          prompt.difficulty,
          prompt.description,
          JSON.stringify(prompt.requirements),
          prompt.wordLimit,
          prompt.durationMinutes,
        );
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  const { count: characterFieldCount } = db
    .prepare('SELECT COUNT(*) AS count FROM "Character_Field"')
    .get();
  if (characterFieldCount === 0) {
    const fields = JSON.parse(readFileSync(characterFieldSeedPath, "utf8"));
    const insertField = db.prepare(`
      INSERT INTO "Character_Field" (
        field_name,
        field_type,
        system_key,
        category,
        description,
        options,
        sort_order,
        is_required,
        is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    db.exec("BEGIN");
    try {
      for (const field of fields) {
        insertField.run(
          field.fieldName,
          field.fieldType,
          field.systemKey || "",
          field.category,
          field.description || "",
          JSON.stringify(field.options || []),
          field.sortOrder,
          Number(Boolean(field.isRequired)),
        );
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  return db;
}
