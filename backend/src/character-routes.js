import express from "express";
import { safeJsonParse } from "./utils.js";

export const characterCategories = [
  "身份信息",
  "身体信息",
  "健康信息",
  "成长经历",
  "心理信息",
  "社会关系",
  "职业经济",
  "性格",
  "能力特长",
  "兴趣习惯",
  "其他",
];

const fieldTypes = new Set([
  "text",
  "number",
  "date",
  "textarea",
  "tag",
  "select",
  "multiple",
  "image",
]);

function mapField(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    fieldName: row.field_name,
    fieldType: row.field_type,
    systemKey: row.system_key || "",
    category: row.category,
    description: row.description || "",
    options: safeJsonParse(row.options, []),
    sortOrder: Number(row.sort_order),
    isRequired: Boolean(row.is_required),
    isDefault: Boolean(row.is_default),
    isDeleted: Boolean(row.is_deleted),
    createdTime: row.created_time,
    valueCount: Number(row.value_count || 0),
  };
}

function mapCharacter(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.name,
    avatar: row.avatar || "",
    createdTime: row.created_time,
    updatedTime: row.updated_time,
    filledCount: Number(row.filled_count || 0),
  };
}

function sortFields(fields) {
  const categoryIndex = new Map(
    characterCategories.map((category, index) => [category, index]),
  );
  return fields.sort((left, right) => {
    const leftCategory = categoryIndex.get(left.category) ?? 999;
    const rightCategory = categoryIndex.get(right.category) ?? 999;
    return (
      leftCategory - rightCategory ||
      left.sortOrder - right.sortOrder ||
      left.id - right.id
    );
  });
}

function getFields(db, includeDeleted = false) {
  const rows = db.prepare(`
    SELECT f.*,
      (
        SELECT COUNT(*)
        FROM "Character_Value" v
        WHERE v.field_id = f.id AND v.value <> ''
      ) AS value_count
    FROM "Character_Field" f
    ${includeDeleted ? "" : "WHERE f.is_deleted = 0"}
  `).all();
  return sortFields(rows.map(mapField));
}

function parseStoredValue(fieldType, value) {
  if (fieldType === "tag" || fieldType === "multiple") {
    const parsed = safeJsonParse(value, []);
    return Array.isArray(parsed) ? parsed : [];
  }
  return value ?? "";
}

function serializeValue(fieldType, value) {
  if (fieldType === "tag" || fieldType === "multiple") {
    const list = Array.isArray(value)
      ? value
      : String(value || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
    return JSON.stringify([...new Set(list)]);
  }
  return value == null ? "" : String(value);
}

function isEmptyValue(fieldType, value) {
  if (fieldType === "tag" || fieldType === "multiple") {
    return !Array.isArray(value) || value.length === 0;
  }
  return value == null || String(value).trim() === "";
}

function getCharacterValues(db, characterId, includeDeleted = false) {
  const rows = db.prepare(`
    SELECT v.field_id, v.value, f.field_type
    FROM "Character_Value" v
    JOIN "Character_Field" f ON f.id = v.field_id
    WHERE v.character_id = ?
      ${includeDeleted ? "" : "AND f.is_deleted = 0"}
  `).all(characterId);

  return Object.fromEntries(
    rows.map((row) => [
      String(row.field_id),
      parseStoredValue(row.field_type, row.value),
    ]),
  );
}

function getPersonalityTags(db, characterId) {
  const rows = db.prepare(`
    SELECT v.value, f.field_type
    FROM "Character_Value" v
    JOIN "Character_Field" f ON f.id = v.field_id
    WHERE v.character_id = ?
      AND f.is_deleted = 0
      AND f.category = '性格'
      AND f.field_type IN ('tag', 'multiple')
  `).all(characterId);

  const tags = rows.flatMap((row) => parseStoredValue(row.field_type, row.value));
  return [...new Set(tags.filter(Boolean))];
}

function getCharacterDetail(db, characterId) {
  const row = db.prepare(`
    SELECT c.*,
      (
        SELECT COUNT(*)
        FROM "Character_Value" v
        JOIN "Character_Field" f ON f.id = v.field_id
        WHERE v.character_id = c.id
          AND f.is_deleted = 0
          AND v.value <> ''
      ) AS filled_count
    FROM "Character" c
    WHERE c.id = ?
  `).get(characterId);
  if (!row) return null;

  return {
    ...mapCharacter(row),
    values: getCharacterValues(db, characterId),
    personalityTags: getPersonalityTags(db, characterId),
  };
}

function prepareCharacterPayload(db, body = {}) {
  const fields = getFields(db);
  const fieldMap = new Map(fields.map((field) => [String(field.id), field]));
  const values =
    body.values && typeof body.values === "object" && !Array.isArray(body.values)
      ? { ...body.values }
      : {};
  const nameField = fields.find((field) => field.systemKey === "name");
  const avatarField = fields.find((field) => field.systemKey === "avatar");

  const name = String(
    (nameField && values[String(nameField.id)]) ?? body.name ?? "",
  ).trim();
  if (!name) {
    const error = new Error("姓名是必填项。");
    error.statusCode = 400;
    throw error;
  }

  if (nameField) values[String(nameField.id)] = name;

  let avatar = String(body.avatar || "");
  if (avatarField && values[String(avatarField.id)] != null) {
    avatar = String(values[String(avatarField.id)] || "");
  } else if (avatarField && avatar) {
    values[String(avatarField.id)] = avatar;
  }

  if (avatar.length > 2_500_000) {
    const error = new Error("头像文件过大，请使用 1.5MB 以内的图片。");
    error.statusCode = 400;
    throw error;
  }

  return { avatar, fieldMap, name, values };
}

function saveValues(db, characterId, values, fieldMap) {
  const upsert = db.prepare(`
    INSERT INTO "Character_Value" (character_id, field_id, value)
    VALUES (?, ?, ?)
    ON CONFLICT(character_id, field_id)
    DO UPDATE SET value = excluded.value
  `);
  const remove = db.prepare(`
    DELETE FROM "Character_Value"
    WHERE character_id = ? AND field_id = ?
  `);

  for (const [fieldId, value] of Object.entries(values)) {
    const field = fieldMap.get(String(fieldId));
    if (!field || field.isDeleted) continue;
    if (isEmptyValue(field.fieldType, value)) {
      remove.run(characterId, field.id);
    } else {
      upsert.run(
        characterId,
        field.id,
        serializeValue(field.fieldType, value),
      );
    }
  }
}

function parseTagFilter(request) {
  const source = request.query.tags ?? request.query.tag ?? "";
  const values = Array.isArray(source) ? source : String(source).split(",");
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

export function createCharacterRouter(db) {
  const router = express.Router();

  router.get("/character-fields", (request, response) => {
    const includeDeleted = request.query.includeDeleted === "true";
    const fields = getFields(db, includeDeleted);
    response.json({
      items: fields,
      total: fields.length,
      categories: characterCategories,
      fieldTypes: [...fieldTypes],
    });
  });

  router.post("/character-fields", (request, response) => {
    const fieldName = String(request.body.fieldName || "").trim();
    const fieldType = String(request.body.fieldType || "");
    const category = String(request.body.category || "").trim();
    if (!fieldName || !category || !fieldTypes.has(fieldType)) {
      return response.status(400).json({ message: "字段名称、类型和分类不能为空。" });
    }

    const duplicate = db.prepare(`
      SELECT id FROM "Character_Field"
      WHERE field_name = ? AND category = ? AND is_deleted = 0
    `).get(fieldName, category);
    if (duplicate) {
      return response.status(409).json({ message: "该分类下已经存在同名字段。" });
    }

    const maxOrder = db.prepare(`
      SELECT COALESCE(MAX(sort_order), 0) AS max_order
      FROM "Character_Field"
      WHERE category = ?
    `).get(category).max_order;
    const sortOrder =
      Number.isFinite(Number(request.body.sortOrder))
        ? Number(request.body.sortOrder)
        : Number(maxOrder) + 10;
    const options = Array.isArray(request.body.options) ? request.body.options : [];

    const result = db.prepare(`
      INSERT INTO "Character_Field" (
        field_name,
        field_type,
        category,
        description,
        options,
        sort_order,
        is_required,
        is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      fieldName,
      fieldType,
      category,
      String(request.body.description || ""),
      JSON.stringify(options),
      sortOrder,
      Number(Boolean(request.body.isRequired)),
    );

    const field = db.prepare(`
      SELECT f.*, 0 AS value_count
      FROM "Character_Field" f
      WHERE f.id = ?
    `).get(result.lastInsertRowid);
    response.status(201).json(mapField(field));
  });

  router.put("/character-fields/reorder", (request, response) => {
    const items = Array.isArray(request.body.items) ? request.body.items : [];
    if (!items.length) {
      return response.status(400).json({ message: "请提供需要排序的字段。" });
    }

    const update = db.prepare(`
      UPDATE "Character_Field"
      SET sort_order = ?
      WHERE id = ?
    `);
    db.exec("BEGIN");
    try {
      items.forEach((item, index) => {
        update.run(
          Number.isFinite(Number(item.sortOrder))
            ? Number(item.sortOrder)
            : (index + 1) * 10,
          item.id,
        );
      });
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    response.json({ items: getFields(db, request.body.includeDeleted === true) });
  });

  router.put("/character-fields/:id", (request, response) => {
    const existing = db.prepare(`
      SELECT * FROM "Character_Field" WHERE id = ?
    `).get(request.params.id);
    if (!existing) {
      return response.status(404).json({ message: "人物字段不存在。" });
    }

    const fieldName = String(request.body.fieldName ?? existing.field_name).trim();
    const fieldType = String(request.body.fieldType ?? existing.field_type);
    const category = String(request.body.category ?? existing.category).trim();
    if (!fieldName || !category || !fieldTypes.has(fieldType)) {
      return response.status(400).json({ message: "字段名称、类型和分类不能为空。" });
    }

    const options = Array.isArray(request.body.options)
      ? request.body.options
      : safeJsonParse(existing.options, []);
    db.prepare(`
      UPDATE "Character_Field"
      SET field_name = ?,
          field_type = ?,
          category = ?,
          description = ?,
          options = ?,
          sort_order = ?,
          is_required = ?
      WHERE id = ?
    `).run(
      fieldName,
      fieldType,
      category,
      String(request.body.description ?? existing.description),
      JSON.stringify(options),
      Number(request.body.sortOrder ?? existing.sort_order),
      Number(request.body.isRequired ?? Boolean(existing.is_required)),
      request.params.id,
    );

    const field = db.prepare(`
      SELECT f.*,
        (
          SELECT COUNT(*) FROM "Character_Value" v
          WHERE v.field_id = f.id AND v.value <> ''
        ) AS value_count
      FROM "Character_Field" f
      WHERE f.id = ?
    `).get(request.params.id);
    response.json(mapField(field));
  });

  router.delete("/character-fields/:id", (request, response) => {
    const result = db.prepare(`
      UPDATE "Character_Field"
      SET is_deleted = 1
      WHERE id = ? AND is_deleted = 0
    `).run(request.params.id);
    if (!result.changes) {
      return response.status(404).json({ message: "人物字段不存在或已隐藏。" });
    }
    response.status(204).end();
  });

  router.get("/character-tags", (_request, response) => {
    const rows = db.prepare(`
      SELECT v.value, f.field_type
      FROM "Character_Value" v
      JOIN "Character_Field" f ON f.id = v.field_id
      WHERE f.is_deleted = 0
        AND f.category = '性格'
        AND f.field_type IN ('tag', 'multiple')
    `).all();
    const tags = [
      ...new Set(
        rows
          .flatMap((row) => parseStoredValue(row.field_type, row.value))
          .filter(Boolean),
      ),
    ].sort((left, right) => left.localeCompare(right, "zh-CN"));
    response.json({ items: tags });
  });

  router.get("/characters", (request, response) => {
    const search = String(request.query.search || "").trim();
    const rows = db.prepare(`
      SELECT c.*,
        (
          SELECT COUNT(*)
          FROM "Character_Value" v
          JOIN "Character_Field" f ON f.id = v.field_id
          WHERE v.character_id = c.id
            AND f.is_deleted = 0
            AND v.value <> ''
        ) AS filled_count
      FROM "Character" c
      WHERE c.name LIKE ?
      ORDER BY c.updated_time DESC, c.id DESC
    `).all(`%${search}%`);
    const requiredTags = parseTagFilter(request);
    const characters = rows
      .map((row) => ({
        ...mapCharacter(row),
        personalityTags: getPersonalityTags(db, row.id),
      }))
      .filter((character) =>
        requiredTags.every((tag) => character.personalityTags.includes(tag)),
      );

    response.json({
      items: characters,
      total: characters.length,
      activeFieldCount: getFields(db).length,
    });
  });

  router.get("/characters/:id", (request, response) => {
    const character = getCharacterDetail(db, request.params.id);
    if (!character) {
      return response.status(404).json({ message: "人物不存在。" });
    }
    response.json(character);
  });

  router.post("/characters", (request, response) => {
    let payload;
    try {
      payload = prepareCharacterPayload(db, request.body);
    } catch (error) {
      return response
        .status(error.statusCode || 400)
        .json({ message: error.message });
    }

    db.exec("BEGIN");
    try {
      const result = db.prepare(`
        INSERT INTO "Character" (name, avatar)
        VALUES (?, ?)
      `).run(payload.name, payload.avatar);
      const characterId = Number(result.lastInsertRowid);
      saveValues(db, characterId, payload.values, payload.fieldMap);
      db.exec("COMMIT");
      response.status(201).json(getCharacterDetail(db, characterId));
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  });

  router.put("/characters/:id", (request, response) => {
    const existing = db.prepare(`
      SELECT * FROM "Character" WHERE id = ?
    `).get(request.params.id);
    if (!existing) {
      return response.status(404).json({ message: "人物不存在。" });
    }

    let payload;
    try {
      payload = prepareCharacterPayload(db, {
        ...request.body,
        name: request.body.name ?? existing.name,
        avatar: request.body.avatar ?? existing.avatar,
      });
    } catch (error) {
      return response
        .status(error.statusCode || 400)
        .json({ message: error.message });
    }

    db.exec("BEGIN");
    try {
      db.prepare(`
        UPDATE "Character"
        SET name = ?, avatar = ?, updated_time = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(payload.name, payload.avatar, request.params.id);
      saveValues(db, request.params.id, payload.values, payload.fieldMap);
      db.exec("COMMIT");
      response.json(getCharacterDetail(db, request.params.id));
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  });

  router.delete("/characters/:id", (request, response) => {
    const result = db.prepare(`
      DELETE FROM "Character" WHERE id = ?
    `).run(request.params.id);
    if (!result.changes) {
      return response.status(404).json({ message: "人物不存在。" });
    }
    response.status(204).end();
  });

  return router;
}
