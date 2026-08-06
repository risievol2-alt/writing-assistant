import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { formatDate } from "./utils";

const fieldTypeLabels = {
  text: "单行文本",
  number: "数字",
  date: "日期",
  textarea: "多行文本",
  tag: "标签",
  select: "下拉选择",
  multiple: "多选",
  image: "图片",
};

function CharacterTopbar({ mode, onModeChange, onNew }) {
  return (
    <header className="page-topbar character-topbar">
      <div>
        <p>人物身份调查档案</p>
        <h1>人物库</h1>
      </div>
      <div className="top-actions">
        <div className="segmented-control character-tabs">
          <button
            className={mode === "library" ? "active" : ""}
            onClick={() => onModeChange("library")}
          >
            人物档案
          </button>
          <button
            className={mode === "fields" ? "active" : ""}
            onClick={() => onModeChange("fields")}
          >
            字段管理
          </button>
        </div>
        {mode === "library" && (
          <button className="primary-button compact" onClick={onNew}>
            <span>＋</span> 新建人物
          </button>
        )}
      </div>
    </header>
  );
}

function CharacterAvatar({ avatar, name, size = "normal" }) {
  return avatar ? (
    <img
      className={`character-avatar ${size}`}
      src={avatar}
      alt={`${name || "人物"}头像`}
    />
  ) : (
    <div className={`character-avatar fallback ${size}`}>
      {(name || "人").slice(0, 1)}
    </div>
  );
}

function CharacterLibrary({ onOpen, onNew, showToast, refreshKey }) {
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [activeFieldCount, setActiveFieldCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.characters({
        ...(search ? { search } : {}),
        ...(selectedTags.length ? { tags: selectedTags.join(",") } : {}),
      });
      setCharacters(result.items);
      setActiveFieldCount(result.activeFieldCount);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  }, [search, selectedTags, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(load, search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, refreshKey, search]);

  useEffect(() => {
    api.characterTags()
      .then((result) => setAvailableTags(result.items))
      .catch((error) => showToast(error.message, "error"));
  }, [refreshKey, showToast]);

  const toggleTag = (tag) => {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
  };

  return (
    <>
      <section className="character-hero">
        <div>
          <p className="eyebrow light">IDENTITY INVESTIGATION</p>
          <h2>人物不是设定的集合，<br />而是选择背后的原因。</h2>
          <p>
            用完整调查档案记录身体、经历、关系、性格和生活细节，
            让人物在进入故事前先成为一个人。
          </p>
        </div>
        <div className="character-hero-stat">
          <span>动态调查字段</span>
          <strong>{activeFieldCount}</strong>
          <small>新增字段会自动进入所有人物档案</small>
        </div>
      </section>

      <section className="character-tools">
        <label className="character-search">
          <span>⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="按姓名搜索人物…"
            aria-label="按姓名搜索人物"
          />
        </label>
        <div className="character-tag-filter">
          <span>性格筛选</span>
          {availableTags.length ? (
            availableTags.map((tag) => (
              <button
                key={tag}
                className={selectedTags.includes(tag) ? "active" : ""}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))
          ) : (
            <small>创建人物并填写性格标签后，可在此筛选。</small>
          )}
          {selectedTags.length > 0 && (
            <button className="clear-tags" onClick={() => setSelectedTags([])}>
              清空
            </button>
          )}
        </div>
      </section>

      <div className="character-result-line">
        <span>共 {characters.length} 份人物档案</span>
        <button onClick={onNew}>＋ 建立新档案</button>
      </div>

      {loading ? (
        <div className="character-loading">正在整理人物档案…</div>
      ) : characters.length ? (
        <section className="character-grid">
          {characters.map((character, index) => (
            <article className="character-card" key={character.id}>
              <div className="character-card-index">
                {String(index + 1).padStart(2, "0")}
              </div>
              <CharacterAvatar
                avatar={character.avatar}
                name={character.name}
                size="card"
              />
              <div className="character-card-copy">
                <span>IDENTITY FILE · C{String(character.id).padStart(3, "0")}</span>
                <h3>{character.name}</h3>
                <div className="character-card-tags">
                  {character.personalityTags.length ? (
                    character.personalityTags.slice(0, 4).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))
                  ) : (
                    <em>尚未填写性格标签</em>
                  )}
                </div>
              </div>
              <div className="character-card-progress">
                <div>
                  <span
                    style={{
                      width: `${Math.min(
                        100,
                        (character.filledCount / Math.max(1, activeFieldCount)) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <small>
                  已填写 {character.filledCount}/{activeFieldCount} 项
                </small>
              </div>
              <footer>
                <time>更新于 {formatDate(character.updatedTime)}</time>
                <button onClick={() => onOpen(character.id)}>
                  查看调查档案 →
                </button>
              </footer>
            </article>
          ))}
          <button className="character-new-card" onClick={onNew}>
            <span>＋</span>
            <strong>新建人物调查档案</strong>
            <small>从姓名和第一条线索开始</small>
          </button>
        </section>
      ) : (
        <div className="character-empty">
          <span>人</span>
          <h3>{search || selectedTags.length ? "没有符合条件的人物" : "人物库还是空的"}</h3>
          <p>
            {search || selectedTags.length
              ? "调整姓名关键词或性格标签后再试。"
              : "建立第一份人物身份调查档案，为故事留下可追踪的线索。"}
          </p>
          {!search && !selectedTags.length && (
            <button className="primary-button compact" onClick={onNew}>
              新建人物
            </button>
          )}
        </div>
      )}
    </>
  );
}

function TagEditor({ value, options = [], onChange, disabled, label }) {
  const tags = Array.isArray(value) ? value : [];
  const [draft, setDraft] = useState("");

  const addTag = (tag) => {
    const next = String(tag || "").trim();
    if (!next || tags.includes(next) || disabled) return;
    onChange([...tags, next]);
    setDraft("");
  };

  const removeTag = (tag) => {
    if (disabled) return;
    onChange(tags.filter((item) => item !== tag));
  };

  return (
    <div className={`tag-editor ${disabled ? "disabled" : ""}`}>
      <div className="tag-editor-values">
        {tags.map((tag) => (
          <span key={tag}>
            {tag}
            {!disabled && (
              <button
                type="button"
                aria-label={`删除标签${tag}`}
                onClick={() => removeTag(tag)}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!tags.length && disabled && <em>未填写</em>}
      </div>
      {!disabled && (
        <>
          <div className="tag-entry">
            <input
              value={draft}
              aria-label={`${label}新增标签`}
              placeholder="输入后按 Enter 添加"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag(draft);
                }
              }}
            />
            <button type="button" onClick={() => addTag(draft)}>
              添加
            </button>
          </div>
          {options.length > 0 && (
            <div className="tag-suggestions">
              {options
                .filter((option) => !tags.includes(option))
                .map((option) => (
                  <button
                    type="button"
                    key={option}
                    onClick={() => addTag(option)}
                  >
                    ＋ {option}
                  </button>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DynamicField({ field, value, onChange, disabled, showToast }) {
  const common = {
    id: `character-field-${field.id}`,
    value: value ?? "",
    disabled,
    onChange: (event) => onChange(event.target.value),
  };

  let control;
  switch (field.fieldType) {
    case "number":
      control = <input {...common} type="number" />;
      break;
    case "date":
      control = <input {...common} type="date" />;
      break;
    case "textarea":
      control = <textarea {...common} rows="5" />;
      break;
    case "select":
      control = (
        <select {...common}>
          <option value="">请选择</option>
          {field.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
      break;
    case "tag":
    case "multiple":
      control = (
        <TagEditor
          value={value}
          options={field.options}
          onChange={onChange}
          disabled={disabled}
          label={field.fieldName}
        />
      );
      break;
    case "image":
      control = (
        <div className="image-field">
          {value ? (
            <img src={value} alt={`${field.fieldName}预览`} />
          ) : (
            <span>暂无图片</span>
          )}
          {!disabled && (
            <label>
              选择图片
              <input
                id={`character-field-${field.id}`}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > 1.5 * 1024 * 1024) {
                    showToast("头像请控制在 1.5MB 以内。", "error");
                    event.target.value = "";
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => onChange(String(reader.result || ""));
                  reader.readAsDataURL(file);
                }}
              />
            </label>
          )}
          {!disabled && value && (
            <button type="button" onClick={() => onChange("")}>移除图片</button>
          )}
        </div>
      );
      break;
    default:
      control = <input {...common} type="text" />;
  }

  return (
    <div
      className={`dynamic-field ${
        ["textarea", "tag", "multiple", "image"].includes(field.fieldType)
          ? "wide"
          : ""
      }`}
    >
      <label htmlFor={`character-field-${field.id}`}>
        {field.fieldName}
        {field.isRequired && <span>必填</span>}
      </label>
      {field.description && <p>{field.description}</p>}
      {control}
    </div>
  );
}

function CategorySection({
  category,
  fields,
  values,
  onValueChange,
  disabled,
  showToast,
  defaultOpen,
  sectionNumber,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const filled = fields.filter((field) => {
    const value = values[String(field.id)];
    return Array.isArray(value)
      ? value.length > 0
      : value != null && String(value).trim() !== "";
  }).length;

  return (
    <section className={`profile-section ${open ? "open" : ""}`}>
      <button
        type="button"
        className="profile-section-heading"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="profile-section-mark">
          {String(sectionNumber).padStart(2, "0")}
        </span>
        <span>
          <strong>{category}</strong>
          <small>{filled}/{fields.length} 项已填写</small>
        </span>
        <span className="profile-section-toggle">{open ? "−" : "＋"}</span>
      </button>
      {open && (
        <div className="profile-fields">
          {fields.map((field) => (
            <DynamicField
              key={field.id}
              field={field}
              value={values[String(field.id)]}
              onChange={(value) => onValueChange(field.id, value)}
              disabled={disabled}
              showToast={showToast}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CharacterProfile({
  characterId,
  onBack,
  onCreated,
  onDeleted,
  showToast,
}) {
  const [fields, setFields] = useState([]);
  const [categories, setCategories] = useState([]);
  const [character, setCharacter] = useState(null);
  const [values, setValues] = useState({});
  const [editing, setEditing] = useState(!characterId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fieldResult = await api.characterFields();
      setFields(fieldResult.items);
      setCategories(fieldResult.categories);
      if (characterId) {
        const record = await api.character(characterId);
        setCharacter(record);
        setValues(record.values || {});
      } else {
        setCharacter(null);
        setValues({});
      }
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  }, [characterId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const nameField = fields.find((field) => field.systemKey === "name");
  const avatarField = fields.find((field) => field.systemKey === "avatar");
  const displayName =
    String(values[String(nameField?.id)] || character?.name || "").trim() ||
    "未命名人物";
  const avatar =
    String(values[String(avatarField?.id)] || character?.avatar || "");

  const groupedFields = useMemo(
    () =>
      categories
        .map((category) => ({
          category,
          fields: fields.filter((field) => field.category === category),
        }))
        .filter((group) => group.fields.length),
    [categories, fields],
  );

  const updateValue = (fieldId, value) => {
    setValues((current) => ({ ...current, [String(fieldId)]: value }));
  };

  const save = async () => {
    if (!String(values[String(nameField?.id)] || "").trim()) {
      showToast("请先填写人物姓名。", "error");
      return;
    }
    setSaving(true);
    try {
      const saved = characterId
        ? await api.saveCharacter(characterId, { values })
        : await api.createCharacter({ values });
      setCharacter(saved);
      setValues(saved.values || values);
      setEditing(false);
      showToast(characterId ? "人物档案已保存。" : "人物档案已创建。");
      if (!characterId) onCreated(saved.id);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    if (!characterId) {
      onBack();
      return;
    }
    setValues(character?.values || {});
    setEditing(false);
  };

  const remove = async () => {
    if (!window.confirm(`确定删除人物“${displayName}”吗？此操作无法撤销。`)) return;
    try {
      await api.deleteCharacter(characterId);
      showToast("人物档案已删除。");
      onDeleted();
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  if (loading) {
    return <div className="character-loading full">正在展开身份调查档案…</div>;
  }

  return (
    <div className="character-profile-page">
      <header className="profile-topbar">
        <button className="back-button" onClick={onBack}>← 返回人物库</button>
        <div>
          <span>人物身份调查档案</span>
          <strong>
            {characterId ? `C${String(characterId).padStart(3, "0")}` : "NEW FILE"}
          </strong>
        </div>
        <div>
          {characterId && !editing && (
            <button className="secondary-button" onClick={remove}>删除</button>
          )}
          {editing ? (
            <>
              <button className="secondary-button" onClick={cancelEdit}>取消</button>
              <button
                className="primary-button compact"
                onClick={save}
                disabled={saving}
              >
                {saving ? "保存中…" : "保存档案"}
              </button>
            </>
          ) : (
            <button
              className="primary-button compact"
              onClick={() => setEditing(true)}
            >
              编辑档案
            </button>
          )}
        </div>
      </header>

      <section className="profile-identity-banner">
        <CharacterAvatar avatar={avatar} name={displayName} size="profile" />
        <div>
          <p className="eyebrow">IDENTITY INVESTIGATION</p>
          <h1>{displayName}</h1>
          <p>
            {characterId
              ? `建立于 ${formatDate(character?.createdTime, true)} · 最近更新 ${formatDate(character?.updatedTime)}`
              : "填写姓名并从任意调查项目开始。所有字段都由字段定义表动态生成。"}
          </p>
        </div>
        <div className="profile-completion">
          <strong>
            {
              Object.values(values).filter((value) =>
                Array.isArray(value)
                  ? value.length
                  : value != null && String(value).trim(),
              ).length
            }
          </strong>
          <span>/ {fields.length}</span>
          <small>已填写项目</small>
        </div>
      </section>

      <section className="profile-notice">
        <span>动态档案</span>
        本页完全由 Character_Field 生成。字段管理中新建、排序或隐藏字段后，
        所有人物档案会自动同步结构。
      </section>

      <div className="profile-sections">
        {groupedFields.map((group, index) => (
          <CategorySection
            key={group.category}
            category={group.category}
            fields={group.fields}
            values={values}
            onValueChange={updateValue}
            disabled={!editing}
            showToast={showToast}
            defaultOpen={index === 0}
            sectionNumber={index + 1}
          />
        ))}
      </div>

      {editing && (
        <div className="profile-save-footer">
          <span>共 {fields.length} 个动态调查字段</span>
          <div>
            <button className="secondary-button" onClick={cancelEdit}>取消</button>
            <button
              className="primary-button"
              onClick={save}
              disabled={saving}
            >
              {saving ? "正在保存…" : "保存人物身份调查档案"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldDialog({ field, categories, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    fieldName: field?.fieldName || "",
    fieldType: field?.fieldType || "text",
    category: field?.category || categories[0] || "身份信息",
    description: field?.description || "",
    sortOrder: field?.sortOrder ?? "",
    isRequired: field?.isRequired || false,
    options: (field?.options || []).join("，"),
  });
  const supportsOptions = ["select", "tag", "multiple"].includes(form.fieldType);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = (event) => {
    event.preventDefault();
    onSave({
      ...form,
      sortOrder: form.sortOrder === "" ? undefined : Number(form.sortOrder),
      options: supportsOptions
        ? form.options
            .split(/[，,]/)
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    });
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <form className="field-dialog" role="dialog" aria-modal="true" onSubmit={submit}>
        <header>
          <div>
            <p>{field ? "修改动态字段" : "新增调查项目"}</p>
            <h3>{field ? field.fieldName : "创建新字段"}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">×</button>
        </header>
        <div className="field-dialog-grid">
          <label>
            字段名称
            <input
              required
              value={form.fieldName}
              onChange={(event) => update("fieldName", event.target.value)}
              placeholder="例如：喜欢的武器"
            />
          </label>
          <label>
            字段类型
            <select
              value={form.fieldType}
              disabled={Boolean(field?.valueCount)}
              onChange={(event) => update("fieldType", event.target.value)}
            >
              {Object.entries(fieldTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {Boolean(field?.valueCount) && (
              <small>已有数据时锁定类型，避免旧值失真。</small>
            )}
          </label>
          <label>
            所属分类
            <select
              value={form.category}
              onChange={(event) => update("category", event.target.value)}
            >
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            排序
            <input
              type="number"
              value={form.sortOrder}
              onChange={(event) => update("sortOrder", event.target.value)}
              placeholder="留空则排在分类末尾"
            />
          </label>
          <label className="wide">
            字段描述
            <textarea
              rows="3"
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="说明这个调查项目应该记录什么。"
            />
          </label>
          {supportsOptions && (
            <label className="wide">
              可选项
              <input
                value={form.options}
                onChange={(event) => update("options", event.target.value)}
                placeholder="使用逗号分隔，例如：是，否，偶尔"
              />
              <small>标签类型仍允许人物档案中新增自定义标签。</small>
            </label>
          )}
          <label className="field-required-check">
            <input
              type="checkbox"
              checked={form.isRequired}
              onChange={(event) => update("isRequired", event.target.checked)}
            />
            设为必填字段
          </label>
        </div>
        <footer>
          <button type="button" className="secondary-button" onClick={onClose}>
            取消
          </button>
          <button className="primary-button compact" disabled={saving}>
            {saving ? "保存中…" : "保存字段"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function FieldManagement({ showToast, onChanged }) {
  const [fields, setFields] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("全部");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialogField, setDialogField] = useState(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggedId, setDraggedId] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await api.characterFields(showDeleted);
      setFields(result.items);
      setCategories(result.categories);
    } catch (error) {
      showToast(error.message, "error");
    }
  }, [showDeleted, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleFields = fields.filter(
    (field) => category === "全部" || field.category === category,
  );

  const saveField = async (body) => {
    setSaving(true);
    try {
      if (dialogField) {
        await api.saveCharacterField(dialogField.id, body);
        showToast("字段设置已更新。");
      } else {
        await api.createCharacterField(body);
        showToast("新字段已加入所有人物档案。");
      }
      setDialogOpen(false);
      setDialogField(undefined);
      await load();
      onChanged();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const removeField = async (field) => {
    const detail = field.valueCount
      ? `已有 ${field.valueCount} 个人物填写过该字段。隐藏后数据仍会保留。`
      : "隐藏后默认不再显示，但可以在“显示已隐藏”中查看。";
    if (!window.confirm(`确定隐藏字段“${field.fieldName}”吗？\n${detail}`)) return;
    try {
      await api.deleteCharacterField(field.id);
      showToast("字段已软删除，已有数据保留。");
      await load();
      onChanged();
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  const reorder = async (ordered) => {
    const items = ordered.map((field, index) => ({
      id: field.id,
      sortOrder: (index + 1) * 10,
    }));
    try {
      await api.reorderCharacterFields(items);
      await load();
      onChanged();
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  const moveField = (field, direction) => {
    const siblings = fields.filter(
      (item) => item.category === field.category && !item.isDeleted,
    );
    const index = siblings.findIndex((item) => item.id === field.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= siblings.length) return;
    const ordered = [...siblings];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    reorder(ordered);
  };

  const dropField = (targetField) => {
    if (!draggedId || category === "全部") return;
    const siblings = fields.filter(
      (field) => field.category === targetField.category && !field.isDeleted,
    );
    const fromIndex = siblings.findIndex((field) => field.id === draggedId);
    const toIndex = siblings.findIndex((field) => field.id === targetField.id);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const ordered = [...siblings];
    const [moved] = ordered.splice(fromIndex, 1);
    ordered.splice(toIndex, 0, moved);
    setDraggedId(null);
    reorder(ordered);
  };

  return (
    <>
      <section className="field-manager-heading">
        <div>
          <p className="eyebrow">DYNAMIC FIELD SYSTEM</p>
          <h2>人物调查字段管理</h2>
          <p>
            修改字段定义会自动影响所有人物档案。删除采用软删除，已有数据不会丢失。
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => {
            setDialogField(undefined);
            setDialogOpen(true);
          }}
        >
          ＋ 新增字段
        </button>
      </section>

      <section className="field-manager-tools">
        <div className="filter-row">
          {["全部", ...categories].map((item) => (
            <button
              key={item}
              className={category === item ? "active" : ""}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="show-deleted-toggle">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(event) => setShowDeleted(event.target.checked)}
          />
          显示已隐藏字段
        </label>
      </section>

      {category === "全部" && (
        <p className="drag-hint">选择一个分类后，可拖动字段调整该分类内的顺序。</p>
      )}

      <section className="field-table-wrap">
        <table className="field-table">
          <thead>
            <tr>
              <th aria-label="拖动排序" />
              <th>字段名称</th>
              <th>所属分类</th>
              <th>字段类型</th>
              <th>排序</th>
              <th>状态</th>
              <th>已有数据</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {visibleFields.map((field) => (
              <tr
                key={field.id}
                className={field.isDeleted ? "deleted" : ""}
                draggable={category !== "全部" && !field.isDeleted}
                onDragStart={() => setDraggedId(field.id)}
                onDragOver={(event) => {
                  if (category !== "全部") event.preventDefault();
                }}
                onDrop={() => dropField(field)}
              >
                <td className="drag-handle" title="拖动排序">⋮⋮</td>
                <td>
                  <strong>{field.fieldName}</strong>
                  <small>{field.description || "暂无描述"}</small>
                </td>
                <td>{field.category}</td>
                <td><span className="field-type-badge">{fieldTypeLabels[field.fieldType]}</span></td>
                <td>{field.sortOrder}</td>
                <td>
                  <span className={`field-status ${field.isDeleted ? "hidden" : "active"}`}>
                    {field.isDeleted ? "已隐藏" : field.isDefault ? "默认" : "自定义"}
                  </span>
                </td>
                <td>{field.valueCount} 人</td>
                <td>
                  {!field.isDeleted && (
                    <div className="field-row-actions">
                      <button
                        title="上移"
                        aria-label={`${field.fieldName}上移`}
                        onClick={() => moveField(field, -1)}
                      >
                        ↑
                      </button>
                      <button
                        title="下移"
                        aria-label={`${field.fieldName}下移`}
                        onClick={() => moveField(field, 1)}
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => {
                          setDialogField(field);
                          setDialogOpen(true);
                        }}
                      >
                        编辑
                      </button>
                      <button className="danger" onClick={() => removeField(field)}>
                        隐藏
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visibleFields.length && (
          <div className="field-table-empty">当前筛选下没有字段。</div>
        )}
      </section>

      {dialogOpen && (
        <FieldDialog
          field={dialogField}
          categories={categories}
          onClose={() => {
            setDialogOpen(false);
            setDialogField(undefined);
          }}
          onSave={saveField}
          saving={saving}
        />
      )}
    </>
  );
}

export function CharactersPage({ showToast, refreshKey, onChanged }) {
  const [mode, setMode] = useState("library");
  const [characterId, setCharacterId] = useState(null);

  if (mode === "profile") {
    return (
      <CharacterProfile
        characterId={characterId}
        onBack={() => {
          setMode("library");
          setCharacterId(null);
        }}
        onCreated={(id) => {
          setCharacterId(id);
          onChanged();
        }}
        onDeleted={() => {
          setMode("library");
          setCharacterId(null);
          onChanged();
        }}
        showToast={showToast}
      />
    );
  }

  return (
    <>
      <CharacterTopbar
        mode={mode}
        onModeChange={setMode}
        onNew={() => {
          setCharacterId(null);
          setMode("profile");
        }}
      />
      {mode === "fields" ? (
        <FieldManagement showToast={showToast} onChanged={onChanged} />
      ) : (
        <CharacterLibrary
          onOpen={(id) => {
            setCharacterId(id);
            setMode("profile");
          }}
          onNew={() => {
            setCharacterId(null);
            setMode("profile");
          }}
          showToast={showToast}
          refreshKey={refreshKey}
        />
      )}
    </>
  );
}
