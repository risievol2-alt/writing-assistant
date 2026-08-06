import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp } from "../src/app.js";
import { createDatabase } from "../src/db.js";

let server;
let baseUrl;
let database;

before(async () => {
  database = createDatabase(":memory:");
  const { app } = createApp({ database });
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  database.close();
  await new Promise((resolve) => server.close(resolve));
});

test("题库能够按类型随机抽题并切换收藏", async () => {
  const randomResponse = await fetch(
    `${baseUrl}/api/prompts/random?type=${encodeURIComponent("场景描写")}`,
  );
  assert.equal(randomResponse.status, 200);
  const prompt = await randomResponse.json();
  assert.equal(prompt.type, "场景描写");
  assert.ok(prompt.requirements.length >= 2);

  const favoriteResponse = await fetch(
    `${baseUrl}/api/prompts/${prompt.id}/favorite`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isFavorite: true }),
    },
  );
  assert.equal(favoriteResponse.status, 200);
  assert.equal((await favoriteResponse.json()).isFavorite, true);
});

test("训练文稿能够创建、自动保存并完成", async () => {
  const prompt = await (
    await fetch(`${baseUrl}/api/prompts/random?type=${encodeURIComponent("对话训练")}`)
  ).json();

  const createResponse = await fetch(`${baseUrl}/api/works`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "测试训练",
      promptId: prompt.id,
      trainingType: prompt.type,
    }),
  });
  assert.equal(createResponse.status, 201);
  const draft = await createResponse.json();

  const updateResponse = await fetch(`${baseUrl}/api/works/${draft.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content: "他问：“钥匙呢？”她把空杯推到桌边。“你昨天见过它。”",
      durationSeconds: 92,
      editCount: 3,
    }),
  });
  const saved = await updateResponse.json();
  assert.ok(saved.wordCount > 10);
  assert.equal(saved.durationSeconds, 92);

  const completeResponse = await fetch(`${baseUrl}/api/works/${draft.id}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ durationSeconds: 120, editCount: 4 }),
  });
  assert.equal(completeResponse.status, 200);
  assert.equal((await completeResponse.json()).status, "completed");
});

test("统计接口汇总完成训练", async () => {
  const response = await fetch(`${baseUrl}/api/stats?days=30`);
  assert.equal(response.status, 200);
  const stats = await response.json();
  assert.equal(stats.daily.length, 30);
  assert.ok(stats.totalWords > 0);
  assert.equal(stats.totalSessions, 1);
});

test("首次安装严格初始化动态人物调查字段", async () => {
  const response = await fetch(`${baseUrl}/api/character-fields`);
  assert.equal(response.status, 200);
  const data = await response.json();

  assert.equal(data.items.length, 99);
  assert.deepEqual(data.categories, [
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
  ]);

  const fields = new Map(data.items.map((field) => [field.fieldName, field]));
  assert.equal(fields.get("姓名").fieldType, "text");
  assert.equal(fields.get("姓名").systemKey, "name");
  assert.equal(fields.get("出生日期").fieldType, "date");
  assert.equal(fields.get("性格特征").fieldType, "tag");
  assert.deepEqual(fields.get("性格特征").options, [
    "开朗",
    "阴暗",
    "幽默",
    "暴力",
    "积极",
    "外向",
    "知性",
    "清洁",
    "表现力",
  ]);
  assert.ok(fields.has("手术史、龋齿、及其他病史"));
  assert.ok(fields.has("幼儿和少年时期的精神体验、相关人物"));
  assert.ok(fields.has("性经验、恋爱经验、性观念、婚姻"));
  assert.ok(fields.has("特长、招式、能力"));
  assert.ok(fields.has("其他特殊信息"));
});

test("人物支持新建、编辑、姓名搜索与性格标签筛选", async () => {
  const fields = (await (await fetch(`${baseUrl}/api/character-fields`)).json()).items;
  const byName = new Map(fields.map((field) => [field.fieldName, field]));
  const values = {
    [byName.get("姓名").id]: "林雾",
    [byName.get("年龄").id]: "27",
    [byName.get("出生地").id]: "临江市",
    [byName.get("性格特征").id]: ["阴暗", "知性"],
    [byName.get("口头禅").id]: "“先别急着下结论。”",
  };

  const createResponse = await fetch(`${baseUrl}/api/characters`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ values }),
  });
  assert.equal(createResponse.status, 201);
  const character = await createResponse.json();
  assert.equal(character.name, "林雾");
  assert.deepEqual(character.personalityTags, ["阴暗", "知性"]);

  const searchResult = await (
    await fetch(`${baseUrl}/api/characters?search=${encodeURIComponent("林")}`)
  ).json();
  assert.equal(searchResult.total, 1);
  assert.equal(searchResult.items[0].name, "林雾");

  const tagResult = await (
    await fetch(`${baseUrl}/api/characters?tags=${encodeURIComponent("知性")}`)
  ).json();
  assert.equal(tagResult.total, 1);

  values[byName.get("姓名").id] = "林雾川";
  values[byName.get("性格特征").id] = ["幽默", "知性"];
  const updateResponse = await fetch(`${baseUrl}/api/characters/${character.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ values }),
  });
  assert.equal(updateResponse.status, 200);
  const updated = await updateResponse.json();
  assert.equal(updated.name, "林雾川");
  assert.deepEqual(updated.values[String(byName.get("性格特征").id)], ["幽默", "知性"]);

  const oldTagResult = await (
    await fetch(`${baseUrl}/api/characters?tags=${encodeURIComponent("阴暗")}`)
  ).json();
  assert.equal(oldTagResult.total, 0);
});

test("自定义字段支持新增、修改、排序与保留数据的软删除", async () => {
  const createFieldResponse = await fetch(`${baseUrl}/api/character-fields`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fieldName: "喜欢的武器",
      fieldType: "text",
      category: "兴趣习惯",
      description: "人物最偏爱的武器。",
    }),
  });
  assert.equal(createFieldResponse.status, 201);
  const field = await createFieldResponse.json();
  assert.equal(field.isDefault, false);

  const character = (
    await (await fetch(`${baseUrl}/api/characters?search=${encodeURIComponent("林雾川")}`)).json()
  ).items[0];
  const current = await (await fetch(`${baseUrl}/api/characters/${character.id}`)).json();
  current.values[String(field.id)] = "折叠刀";
  const saveResponse = await fetch(`${baseUrl}/api/characters/${character.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ values: current.values }),
  });
  assert.equal(saveResponse.status, 200);

  const updateFieldResponse = await fetch(`${baseUrl}/api/character-fields/${field.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fieldName: "惯用武器",
      category: "能力特长",
      description: "最常使用的武器。",
      sortOrder: 15,
    }),
  });
  const updatedField = await updateFieldResponse.json();
  assert.equal(updatedField.fieldName, "惯用武器");
  assert.equal(updatedField.category, "能力特长");

  const reorderResponse = await fetch(`${baseUrl}/api/character-fields/reorder`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items: [{ id: field.id, sortOrder: 5 }] }),
  });
  assert.equal(reorderResponse.status, 200);

  const deleteResponse = await fetch(`${baseUrl}/api/character-fields/${field.id}`, {
    method: "DELETE",
  });
  assert.equal(deleteResponse.status, 204);

  const hiddenFields = await (
    await fetch(`${baseUrl}/api/character-fields?includeDeleted=true`)
  ).json();
  const deleted = hiddenFields.items.find((item) => item.id === field.id);
  assert.equal(deleted.isDeleted, true);
  assert.equal(deleted.valueCount, 1);

  const preserved = database.prepare(`
    SELECT value FROM "Character_Value"
    WHERE character_id = ? AND field_id = ?
  `).get(character.id, field.id);
  assert.equal(preserved.value, "折叠刀");

  const deleteCharacterResponse = await fetch(
    `${baseUrl}/api/characters/${character.id}`,
    { method: "DELETE" },
  );
  assert.equal(deleteCharacterResponse.status, 204);
});
