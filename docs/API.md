# 写作助手 API

基础地址：`http://127.0.0.1:8787/api`

## 健康检查

- `GET /health`

## Dashboard

- `GET /dashboard`
- 返回连续天数、总字数、写作时长、完成数、今日题目与最近作品。

## 题库

- `GET /prompts`
  - 查询参数：`type`、`favorite=true`、`completed=true`
- `GET /prompts/random`
  - 可选查询参数：`type`
- `PATCH /prompts/:id/favorite`
  - 请求：`{ "isFavorite": true }`

## 作品

- `GET /works`
  - 查询参数：`category`、`search`
- `GET /works/:id`
- `POST /works`
- `PUT /works/:id`
- `POST /works/:id/complete`
- `DELETE /works/:id`

创建作品示例：

```json
{
  "title": "雨夜等待",
  "category": "练习作品",
  "promptId": 2,
  "trainingType": "场景描写",
  "content": ""
}
```

保存作品示例：

```json
{
  "title": "雨夜等待",
  "content": "正文……",
  "durationSeconds": 320,
  "editCount": 8
}
```

## 统计

- `GET /stats?days=30`
- `days` 允许 7–90，返回每日统计、训练类型分布、最常训练与薄弱类型。

## 人物库

### 人物

- `GET /characters`
  - 查询参数：`search`（姓名）、`tags`（逗号分隔的性格标签）。
- `GET /characters/:id`
- `POST /characters`
- `PUT /characters/:id`
- `DELETE /characters/:id`
- `GET /character-tags`

创建或保存人物时，`values` 使用“字段 ID → 字段值”的映射。标签和多选字段使用数组：

```json
{
  "name": "红战士",
  "avatar": "",
  "values": {
    "1": "红战士",
    "2": "",
    "3": 25,
    "44": ["开朗", "外向"]
  }
}
```

### 动态字段

- `GET /character-fields`
  - 查询参数：`includeDeleted=true` 可包含已软删除字段。
- `POST /character-fields`
- `PUT /character-fields/:id`
- `PUT /character-fields/reorder`
- `DELETE /character-fields/:id`
  - 仅设置 `is_deleted=1`，不会删除 `Character_Value`。

新增字段示例：

```json
{
  "fieldName": "喜欢的武器",
  "fieldType": "text",
  "category": "兴趣习惯",
  "description": "人物最常使用或最偏爱的武器。",
  "sortOrder": 320,
  "isRequired": false,
  "options": []
}
```

支持的 `fieldType`：`text`、`number`、`date`、`textarea`、`tag`、`select`、`multiple`、`image`。

字段排序请求示例：

```json
{
  "category": "身份信息",
  "fieldIds": [1, 3, 4, 5, 6, 7, 8, 2]
}
```

## AI 预留

- `POST /ai/review`
- 第一阶段固定返回 `501 AI_REVIEW_NOT_CONFIGURED`。

未来请求契约：

```json
{
  "article": "用户文章",
  "mode": "training_review",
  "focus": ["人物目标", "环境描写", "冲突节奏"]
}
```

未来响应只提供问题、证据位置、思考问题和训练建议，不返回整篇代改稿。
