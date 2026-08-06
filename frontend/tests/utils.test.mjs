import assert from "node:assert/strict";
import test from "node:test";
import {
  countWords,
  formatDuration,
  formatNumber,
  getExcerpt,
} from "../src/utils.js";

test("中文字数与英文单词能够合并统计", () => {
  assert.equal(countWords("雨落在 glass window 上"), 6);
  assert.equal(countWords("**加粗文字**\n\n第二段"), 7);
  assert.equal(countWords(""), 0);
});

test("展示工具输出适合写作统计", () => {
  assert.equal(formatDuration(65), "1分钟");
  assert.equal(formatDuration(3660), "1小时1分");
  assert.equal(formatNumber(35600), "35,600");
  assert.equal(getExcerpt("# 标题\n这是一段文字", 6), "标题 这是一…");
});
