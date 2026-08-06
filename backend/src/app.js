import express from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { calculateStreak, countWords, toLocalDateKey } from "./utils.js";
import { createDatabase, mapPrompt, mapWork } from "./db.js";
import { createCharacterRouter } from "./character-routes.js";

const trainingTypes = [
  "场景描写",
  "人物描写",
  "动作描写",
  "战斗描写",
  "情绪描写",
  "对话训练",
  "开篇训练",
  "剧情续写",
  "设定扩展",
];

function getDateRange(days) {
  const result = [];
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  cursor.setDate(cursor.getDate() - days + 1);

  for (let index = 0; index < days; index += 1) {
    result.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

export function createApp({ database, databasePath, staticDir } = {}) {
  const db = database || createDatabase(databasePath);
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "5mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get("/api/dashboard", (_request, response) => {
    const totals = db.prepare(`
      SELECT
        COALESCE(SUM(word_count), 0) AS total_words,
        COALESCE(SUM(duration_seconds), 0) AS total_seconds,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count
      FROM works
    `).get();

    const completedDates = db.prepare(`
      SELECT DISTINCT DATE(completed_at, 'localtime') AS day
      FROM works
      WHERE completed_at IS NOT NULL
      ORDER BY day DESC
    `).all().map((row) => row.day);

    const dayIndex = Number(toLocalDateKey().replaceAll("-", "")) % 12;
    const todayPrompt = mapPrompt(db.prepare(`
      SELECT p.*,
        EXISTS(
          SELECT 1 FROM works w
          WHERE w.prompt_id = p.id AND w.status = 'completed'
        ) AS is_completed
      FROM prompts p
      ORDER BY p.id
      LIMIT 1 OFFSET ?
    `).get(dayIndex));

    const recentWorks = db.prepare(`
      SELECT * FROM works
      ORDER BY updated_at DESC
      LIMIT 5
    `).all().map(mapWork);

    response.json({
      streak: calculateStreak(completedDates),
      totalWords: Number(totals.total_words || 0),
      totalSeconds: Number(totals.total_seconds || 0),
      completedCount: Number(totals.completed_count || 0),
      todayPrompt,
      recentWorks,
    });
  });

  app.get("/api/prompts/random", (request, response) => {
    const type = request.query.type;
    const prompt = type
      ? db.prepare(`
          SELECT p.*,
            EXISTS(
              SELECT 1 FROM works w
              WHERE w.prompt_id = p.id AND w.status = 'completed'
            ) AS is_completed
          FROM prompts p
          WHERE p.type = ?
          ORDER BY RANDOM()
          LIMIT 1
        `).get(type)
      : db.prepare(`
          SELECT p.*,
            EXISTS(
              SELECT 1 FROM works w
              WHERE w.prompt_id = p.id AND w.status = 'completed'
            ) AS is_completed
          FROM prompts p
          ORDER BY RANDOM()
          LIMIT 1
        `).get();

    if (!prompt) {
      return response.status(404).json({ message: "该分类暂时没有训练题。" });
    }

    response.json(mapPrompt(prompt));
  });

  app.get("/api/prompts", (request, response) => {
    const conditions = [];
    const params = [];

    if (request.query.type && request.query.type !== "全部") {
      conditions.push("p.type = ?");
      params.push(request.query.type);
    }
    if (request.query.favorite === "true") {
      conditions.push("p.is_favorite = 1");
    }
    if (request.query.completed === "true") {
      conditions.push(`
        EXISTS(
          SELECT 1 FROM works w
          WHERE w.prompt_id = p.id AND w.status = 'completed'
        )
      `);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const prompts = db.prepare(`
      SELECT p.*,
        EXISTS(
          SELECT 1 FROM works w
          WHERE w.prompt_id = p.id AND w.status = 'completed'
        ) AS is_completed
      FROM prompts p
      ${where}
      ORDER BY p.is_favorite DESC, p.id
    `).all(...params).map(mapPrompt);

    response.json({ items: prompts, total: prompts.length, types: trainingTypes });
  });

  app.patch("/api/prompts/:id/favorite", (request, response) => {
    const prompt = db.prepare("SELECT * FROM prompts WHERE id = ?").get(request.params.id);
    if (!prompt) return response.status(404).json({ message: "训练题不存在。" });

    const nextValue =
      typeof request.body.isFavorite === "boolean"
        ? Number(request.body.isFavorite)
        : Number(!prompt.is_favorite);

    db.prepare("UPDATE prompts SET is_favorite = ? WHERE id = ?")
      .run(nextValue, request.params.id);

    response.json(mapPrompt(db.prepare("SELECT * FROM prompts WHERE id = ?").get(request.params.id)));
  });

  app.get("/api/works", (request, response) => {
    const conditions = [];
    const params = [];

    if (request.query.category && request.query.category !== "全部") {
      conditions.push("category = ?");
      params.push(request.query.category);
    }
    if (request.query.search) {
      conditions.push("(title LIKE ? OR content LIKE ? OR tags LIKE ?)");
      const term = `%${request.query.search}%`;
      params.push(term, term, term);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const works = db.prepare(`
      SELECT * FROM works
      ${where}
      ORDER BY updated_at DESC
    `).all(...params).map(mapWork);

    response.json({ items: works, total: works.length });
  });

  app.get("/api/works/:id", (request, response) => {
    const work = mapWork(db.prepare("SELECT * FROM works WHERE id = ?").get(request.params.id));
    if (!work) return response.status(404).json({ message: "作品不存在。" });
    response.json(work);
  });

  app.post("/api/works", (request, response) => {
    const promptId = request.body.promptId || null;
    const prompt = promptId
      ? db.prepare("SELECT * FROM prompts WHERE id = ?").get(promptId)
      : null;
    const title = String(request.body.title || prompt?.title || "未命名片段").trim();
    const category = String(request.body.category || "练习作品");
    const content = String(request.body.content || "");
    const tags = Array.isArray(request.body.tags) ? request.body.tags : [];

    const result = db.prepare(`
      INSERT INTO works (
        title, category, content, prompt_id, training_type, word_count, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      category,
      content,
      promptId,
      request.body.trainingType || prompt?.type || null,
      countWords(content),
      JSON.stringify(tags),
    );

    const work = mapWork(db.prepare("SELECT * FROM works WHERE id = ?").get(result.lastInsertRowid));
    response.status(201).json(work);
  });

  app.put("/api/works/:id", (request, response) => {
    const existing = db.prepare("SELECT * FROM works WHERE id = ?").get(request.params.id);
    if (!existing) return response.status(404).json({ message: "作品不存在。" });

    const title = String(request.body.title ?? existing.title).trim() || "未命名片段";
    const category = String(request.body.category ?? existing.category);
    const content = String(request.body.content ?? existing.content);
    const tags = Array.isArray(request.body.tags)
      ? request.body.tags
      : JSON.parse(existing.tags);
    const durationSeconds = Math.max(
      0,
      Number(request.body.durationSeconds ?? existing.duration_seconds) || 0,
    );
    const editCount = Math.max(
      0,
      Number(request.body.editCount ?? existing.edit_count) || 0,
    );

    db.prepare(`
      UPDATE works
      SET title = ?,
          category = ?,
          content = ?,
          training_type = ?,
          word_count = ?,
          duration_seconds = ?,
          edit_count = ?,
          tags = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title,
      category,
      content,
      request.body.trainingType ?? existing.training_type,
      countWords(content),
      durationSeconds,
      editCount,
      JSON.stringify(tags),
      request.params.id,
    );

    response.json(mapWork(db.prepare("SELECT * FROM works WHERE id = ?").get(request.params.id)));
  });

  app.post("/api/works/:id/complete", (request, response) => {
    const existing = db.prepare("SELECT * FROM works WHERE id = ?").get(request.params.id);
    if (!existing) return response.status(404).json({ message: "作品不存在。" });

    const content = String(request.body.content ?? existing.content);
    db.prepare(`
      UPDATE works
      SET title = ?,
          content = ?,
          word_count = ?,
          duration_seconds = ?,
          edit_count = ?,
          status = 'completed',
          completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      String(request.body.title ?? existing.title).trim() || "未命名片段",
      content,
      countWords(content),
      Math.max(0, Number(request.body.durationSeconds ?? existing.duration_seconds) || 0),
      Math.max(0, Number(request.body.editCount ?? existing.edit_count) || 0),
      request.params.id,
    );

    response.json(mapWork(db.prepare("SELECT * FROM works WHERE id = ?").get(request.params.id)));
  });

  app.delete("/api/works/:id", (request, response) => {
    const result = db.prepare("DELETE FROM works WHERE id = ?").run(request.params.id);
    if (!result.changes) return response.status(404).json({ message: "作品不存在。" });
    response.status(204).end();
  });

  app.get("/api/stats", (request, response) => {
    const days = Math.min(90, Math.max(7, Number(request.query.days) || 30));
    const range = getDateRange(days);
    const startDate = range[0];

    const rows = db.prepare(`
      SELECT
        DATE(completed_at, 'localtime') AS day,
        SUM(word_count) AS words,
        SUM(duration_seconds) AS seconds,
        COUNT(*) AS sessions
      FROM works
      WHERE completed_at IS NOT NULL
        AND DATE(completed_at, 'localtime') >= ?
      GROUP BY day
      ORDER BY day
    `).all(startDate);
    const byDate = new Map(rows.map((row) => [row.day, row]));

    const daily = range.map((day) => ({
      date: day,
      words: Number(byDate.get(day)?.words || 0),
      seconds: Number(byDate.get(day)?.seconds || 0),
      sessions: Number(byDate.get(day)?.sessions || 0),
    }));

    const typeRows = db.prepare(`
      SELECT training_type AS type, COUNT(*) AS sessions, SUM(word_count) AS words
      FROM works
      WHERE status = 'completed' AND training_type IS NOT NULL
      GROUP BY training_type
      ORDER BY sessions DESC, words DESC
    `).all();
    const typeMap = new Map(typeRows.map((row) => [row.type, row]));
    const typeStats = trainingTypes.map((type) => ({
      type,
      sessions: Number(typeMap.get(type)?.sessions || 0),
      words: Number(typeMap.get(type)?.words || 0),
    }));

    const totalWords = daily.reduce((sum, item) => sum + item.words, 0);
    const totalSeconds = daily.reduce((sum, item) => sum + item.seconds, 0);
    const totalSessions = daily.reduce((sum, item) => sum + item.sessions, 0);
    const practiced = typeStats.filter((item) => item.sessions > 0);
    const strongest = practiced.sort((a, b) => b.sessions - a.sessions)[0]?.type || "尚未形成";
    const weakest =
      [...typeStats].sort((a, b) => a.sessions - b.sessions)[0]?.type || "对话训练";

    response.json({
      days,
      totalWords,
      totalSeconds,
      totalSessions,
      averageWords: Math.round(totalWords / days),
      strongest,
      weakest,
      daily,
      typeStats,
    });
  });

  app.post("/api/ai/review", (_request, response) => {
    response.status(501).json({
      code: "AI_REVIEW_NOT_CONFIGURED",
      message: "AI 评价接口已预留，将在第三阶段接入；它只提供问题与训练建议，不直接代改。",
    });
  });

  app.use("/api", createCharacterRouter(db));

  if (staticDir && existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.use((request, response, next) => {
      if (request.path.startsWith("/api/")) return next();
      response.sendFile(resolve(staticDir, "index.html"));
    });
  }

  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(500).json({ message: "服务暂时无法处理请求，请稍后重试。" });
  });

  return { app, db };
}
