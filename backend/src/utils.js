export function countWords(text = "") {
  const plainText = String(text)
    .replace(/[#*_>`~[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plainText) return 0;

  const cjkCount = (plainText.match(/[\u3400-\u9fff]/g) || []).length;
  const latinCount = (
    plainText
      .replace(/[\u3400-\u9fff]/g, " ")
      .match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []
  ).length;

  return cjkCount + latinCount;
}

export function safeJsonParse(value, fallback = []) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function toLocalDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function calculateStreak(dateKeys, today = new Date()) {
  const completed = new Set(dateKeys);
  const cursor = new Date(today);
  let streak = 0;

  while (completed.has(toLocalDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
