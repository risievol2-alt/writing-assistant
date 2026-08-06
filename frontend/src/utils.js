export const trainingTypes = [
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

export const workCategories = [
  "全部",
  "练习作品",
  "小说章节",
  "人物资料",
  "世界观资料",
  "废稿",
];

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

export function formatNumber(value = 0) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export function formatDuration(seconds = 0) {
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  return `${hours}小时${minutes % 60 ? `${minutes % 60}分` : ""}`;
}

export function formatTimer(seconds = 0) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function formatDate(value, withYear = false) {
  if (!value) return "刚刚";
  const date = new Date(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z"));
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(date);
}

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return "夜深了";
  if (hour < 12) return "早上好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

export function getTodayLabel() {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

export function getExcerpt(content = "", limit = 62) {
  const text = content.replace(/[#*_>`~]/g, "").replace(/\s+/g, " ").trim();
  if (!text) return "还没有正文，点击继续写作。";
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}
