import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { CharactersPage } from "./characters";
import {
  countWords,
  formatDate,
  formatDuration,
  formatNumber,
  formatTimer,
  getExcerpt,
  getGreeting,
  getTodayLabel,
  trainingTypes,
  workCategories,
} from "./utils";

const navItems = [
  { id: "dashboard", label: "今日写作", icon: "⌂" },
  { id: "training", label: "写作训练", icon: "✦" },
  { id: "works", label: "作品管理", icon: "文" },
  { id: "prompts", label: "训练题库", icon: "题" },
  { id: "stats", label: "写作统计", icon: "▥" },
  { id: "characters", label: "人物库", icon: "人" },
];

const futureItems = [
  { label: "世界观设定", icon: "界" },
  { label: "剧情设计", icon: "线" },
];

const typeIcons = {
  场景描写: "景",
  人物描写: "人",
  动作描写: "动",
  战斗描写: "战",
  情绪描写: "情",
  对话训练: "言",
  开篇训练: "始",
  剧情续写: "续",
  设定扩展: "设",
};

function IconButton({ children, label, className = "", ...props }) {
  return (
    <button className={`icon-button ${className}`} aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}

function EmptyState({ title, detail, action }) {
  return (
    <div className="empty-state">
      <div className="empty-mark">墨</div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="loading-block" aria-label="正在加载">
      <span />
      <span />
      <span />
    </div>
  );
}

function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => onNavigate("dashboard")}>
        <span className="brand-seal">砚</span>
        <span>
          <strong>砚习</strong>
          <small>INKSTONE</small>
        </span>
      </button>

      <nav className="side-nav" aria-label="主导航">
        <p className="nav-caption">写作空间</p>
        {navItems.map((item) => (
          <button
            key={item.id}
            className={activePage === item.id ? "active" : ""}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
            {item.id === "training" && <span className="nav-dot" />}
          </button>
        ))}

        <p className="nav-caption future-caption">创作工具 · 第二阶段</p>
        {futureItems.map((item) => (
          <button key={item.label} className="future-nav" disabled>
            <span className="nav-icon">{item.icon}</span>
            {item.label}
            <span className="soon-badge">即将开放</span>
          </button>
        ))}
      </nav>

      <div className="side-quote">
        <span>“</span>
        <p>写作不是等待灵感，<br />而是每天与文字见面。</p>
      </div>

      <div className="local-user">
        <div className="avatar">作</div>
        <span>
          <strong>我的写作空间</strong>
          <small>本地数据 · 安全保存</small>
        </span>
        <span className="more">···</span>
      </div>
    </aside>
  );
}

function MobileNav({ activePage, onNavigate }) {
  return (
    <nav className="mobile-nav" aria-label="移动端主导航">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={activePage === item.id ? "active" : ""}
          onClick={() => onNavigate(item.id)}
        >
          <span>{item.icon}</span>
          <small>{item.label.replace("写作", "")}</small>
        </button>
      ))}
    </nav>
  );
}

function PageTopbar({ title, onNewWork, onSearch }) {
  return (
    <header className="page-topbar">
      <div>
        <p>{getTodayLabel()}</p>
        <h1>{title}</h1>
      </div>
      <div className="top-actions">
        {onSearch && (
          <label className="top-search">
            <span>⌕</span>
            <input aria-label="搜索" placeholder="搜索作品…" onChange={(event) => onSearch(event.target.value)} />
          </label>
        )}
        <IconButton label="通知">◌</IconButton>
        {onNewWork && (
          <button className="primary-button compact" onClick={onNewWork}>
            <span>＋</span> 新建文稿
          </button>
        )}
      </div>
    </header>
  );
}

function DashboardPage({ onStartPrompt, onNavigate, refreshKey }) {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api.dashboard(), api.stats(30)])
      .then(([dashboard, nextStats]) => {
        if (active) {
          setData(dashboard);
          setStats(nextStats);
        }
      })
      .catch((nextError) => active && setError(nextError.message));
    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (!data) {
    return error ? <EmptyState title="暂时无法读取数据" detail={error} /> : <LoadingBlock />;
  }

  const prompt = data.todayPrompt;
  const goalProgress = Math.min(100, Math.round((data.totalWords % 5000) / 50));
  const weekly = stats?.daily.slice(-7) || [];
  const maxWords = Math.max(500, ...weekly.map((item) => item.words));

  return (
    <>
      <PageTopbar title={`${getGreeting()}，继续写吧`} onNewWork={() => onNavigate("new-work")} />

      <section className="dashboard-intro">
        <div>
          <p className="eyebrow">你的写作仪表盘</p>
          <h2>今天，也写下一点。</h2>
          <p>稳定的小步，比偶尔的爆发更接近一本完成的小说。</p>
        </div>
        <div className="day-chip">
          <span>{new Date().getDate()}</span>
          <small>{new Intl.DateTimeFormat("zh-CN", { month: "short" }).format(new Date())}</small>
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card accent-rust">
          <div className="metric-icon">火</div>
          <div>
            <p>连续写作</p>
            <strong>{data.streak}<small>天</small></strong>
            <span>{data.streak ? "习惯正在生长" : "从今天开始连击"}</span>
          </div>
        </article>
        <article className="metric-card accent-ink">
          <div className="metric-icon">字</div>
          <div>
            <p>累计字数</p>
            <strong>{formatNumber(data.totalWords)}<small>字</small></strong>
            <span>每一字都算数</span>
          </div>
        </article>
        <article className="metric-card accent-gold">
          <div className="metric-icon">✓</div>
          <div>
            <p>完成训练</p>
            <strong>{data.completedCount}<small>次</small></strong>
            <span>训练留下了痕迹</span>
          </div>
        </article>
        <article className="metric-card accent-sage">
          <div className="metric-icon">时</div>
          <div>
            <p>专注写作</p>
            <strong>{Math.floor(data.totalSeconds / 3600)}<small>小时</small></strong>
            <span>{formatDuration(data.totalSeconds)}</span>
          </div>
        </article>
      </section>

      <section className="dashboard-main-grid">
        <article className="today-card">
          <div className="today-card-top">
            <div>
              <span className="live-dot" />
              今日训练
            </div>
            <span>{prompt?.difficulty || "进阶"}</span>
          </div>
          <div className="today-copy">
            <span className="vertical-label">DAILY PRACTICE</span>
            <div>
              <p>{prompt?.type}</p>
              <h3>{prompt?.title}</h3>
              <blockquote>{prompt?.description}</blockquote>
            </div>
          </div>
          <ul className="requirement-preview">
            {prompt?.requirements.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
          </ul>
          <div className="today-card-footer">
            <div>
              <span>◷ {prompt?.durationMinutes} 分钟</span>
              <span>约 {prompt?.wordLimit} 字</span>
            </div>
            <button onClick={() => onStartPrompt(prompt)}>开始今日训练 <span>→</span></button>
          </div>
        </article>

        <article className="weekly-card panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">近七天</p>
              <h3>写作节奏</h3>
            </div>
            <button onClick={() => onNavigate("stats")}>查看统计 →</button>
          </div>
          <div className="weekly-bars">
            {weekly.map((item, index) => (
              <div className="bar-column" key={item.date}>
                <div className="bar-track">
                  <span
                    className={index === weekly.length - 1 ? "today" : ""}
                    style={{ height: `${Math.max(5, (item.words / maxWords) * 100)}%` }}
                    title={`${item.words} 字`}
                  />
                </div>
                <small>{new Intl.DateTimeFormat("zh-CN", { weekday: "narrow" }).format(new Date(`${item.date}T12:00:00`))}</small>
              </div>
            ))}
          </div>
          <div className="weekly-summary">
            <span>
              本周共写
              <strong>{formatNumber(weekly.reduce((sum, item) => sum + item.words, 0))}</strong>
              字
            </span>
            <em>平均 {formatNumber(Math.round(weekly.reduce((sum, item) => sum + item.words, 0) / 7))} 字/天</em>
          </div>
        </article>
      </section>

      <section className="dashboard-bottom-grid">
        <article className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">继续写</p>
              <h3>最近作品</h3>
            </div>
            <button onClick={() => onNavigate("works")}>全部作品 →</button>
          </div>
          {data.recentWorks.length ? (
            <div className="recent-list">
              {data.recentWorks.slice(0, 3).map((work) => (
                <button key={work.id} onClick={() => onNavigate("edit-work", work.id)}>
                  <span className="work-paper">{work.category === "练习作品" ? "练" : "稿"}</span>
                  <span className="recent-copy">
                    <strong>{work.title}</strong>
                    <small>{getExcerpt(work.content, 42)}</small>
                  </span>
                  <span className="recent-meta">
                    <strong>{formatNumber(work.wordCount)} 字</strong>
                    <small>{formatDate(work.updatedAt)}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="第一篇还在等你"
              detail="完成一次训练，作品会自动出现在这里。"
              action={<button className="text-button" onClick={() => onStartPrompt(prompt)}>开始写作 →</button>}
            />
          )}
        </article>

        <article className="panel goal-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">成长刻度</p>
              <h3>下一枚里程碑</h3>
            </div>
            <span className="goal-label">5,000 字</span>
          </div>
          <div className="goal-content">
            <div className="goal-ring" style={{ "--progress": `${goalProgress * 3.6}deg` }}>
              <span><strong>{goalProgress}</strong>%</span>
            </div>
            <div>
              <p>每积累 5,000 字，回看一次最早的作品。</p>
              <strong>还差 {formatNumber(5000 - (data.totalWords % 5000 || 0))} 字</strong>
              <small>保持现在的节奏，你正在变得更稳定。</small>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}

function PromptDetails({ prompt, onFavorite }) {
  if (!prompt) return null;
  return (
    <article className="prompt-sheet">
      <div className="prompt-sheet-header">
        <div className="prompt-type-icon">{typeIcons[prompt.type] || "题"}</div>
        <div>
          <span>{prompt.type} · {prompt.difficulty}</span>
          <h2>{prompt.title}</h2>
        </div>
        <IconButton
          label={prompt.isFavorite ? "取消收藏" : "收藏题目"}
          className={prompt.isFavorite ? "favorite active" : "favorite"}
          onClick={onFavorite}
        >
          {prompt.isFavorite ? "★" : "☆"}
        </IconButton>
      </div>
      <blockquote>{prompt.description}</blockquote>
      <div className="prompt-requirements">
        <p>本次训练要求</p>
        <ol>
          {prompt.requirements.map((item, index) => (
            <li key={item}><span>{index + 1}</span>{item}</li>
          ))}
        </ol>
      </div>
      <div className="prompt-limits">
        <span><small>建议时间</small><strong>{prompt.durationMinutes} 分钟</strong></span>
        <span><small>字数上限</small><strong>{prompt.wordLimit} 字</strong></span>
        <span><small>训练难度</small><strong>{prompt.difficulty}</strong></span>
      </div>
    </article>
  );
}

function TrainingPage({ initialPrompt, onClearInitial, onComplete, showToast }) {
  const [selectedType, setSelectedType] = useState(initialPrompt?.type || "场景描写");
  const [prompt, setPrompt] = useState(initialPrompt || null);
  const [loading, setLoading] = useState(!initialPrompt);
  const [work, setWork] = useState(null);

  const loadRandom = useCallback(async (type = selectedType) => {
    setLoading(true);
    try {
      const nextPrompt = await api.randomPrompt(type);
      setPrompt(nextPrompt);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  }, [selectedType, showToast]);

  useEffect(() => {
    if (initialPrompt) {
      setSelectedType(initialPrompt.type);
      setPrompt(initialPrompt);
      onClearInitial();
    } else if (!prompt) {
      loadRandom("场景描写");
    }
  }, [initialPrompt, loadRandom, onClearInitial, prompt]);

  const chooseType = (type) => {
    setSelectedType(type);
    loadRandom(type);
  };

  const toggleFavorite = async () => {
    try {
      setPrompt(await api.toggleFavorite(prompt.id, !prompt.isFavorite));
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  const startTraining = async () => {
    try {
      const created = await api.createWork({
        title: prompt.title,
        promptId: prompt.id,
        trainingType: prompt.type,
        category: "练习作品",
      });
      setWork(created);
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  if (work) {
    return (
      <WritingEditor
        initialWork={work}
        prompt={prompt}
        onComplete={(completed) => {
          showToast("训练完成，作品已收入成长记录。");
          onComplete(completed);
        }}
        onExit={() => setWork(null)}
        showToast={showToast}
      />
    );
  }

  return (
    <>
      <PageTopbar title="写作训练" />
      <section className="page-heading-row">
        <div>
          <p className="eyebrow">刻意练习</p>
          <h2>选择今天要磨炼的能力</h2>
          <p>每次只练一个重点，完成比完美更重要。</p>
        </div>
        <button className="secondary-button" onClick={() => loadRandom(selectedType)}>↻ 换一道题</button>
      </section>

      <div className="type-scroller" role="tablist" aria-label="训练类型">
        {trainingTypes.map((type) => (
          <button
            key={type}
            className={selectedType === type ? "active" : ""}
            onClick={() => chooseType(type)}
          >
            <span>{typeIcons[type]}</span>
            {type}
          </button>
        ))}
      </div>

      <section className="training-layout">
        {loading ? <LoadingBlock /> : <PromptDetails prompt={prompt} onFavorite={toggleFavorite} />}
        <aside className="start-panel">
          <span className="start-seal">始</span>
          <p className="eyebrow">准备好了吗</p>
          <h3>把注意力留给这一次练习</h3>
          <p>开始后会自动计时，并每隔片刻保存你的文稿。你随时可以暂停。</p>
          <div className="focus-note">
            <span>小提示</span>
            <p>先完成第一稿，再回头修改。写作时不要同时扮演苛刻的编辑。</p>
          </div>
          <button className="primary-button large" onClick={startTraining}>
            开始 {prompt?.durationMinutes} 分钟训练 <span>→</span>
          </button>
          <small>文稿将保存到「练习作品」</small>
        </aside>
      </section>
    </>
  );
}

function insertMarkdown(textarea, content, setContent, before, after = before, placeholder = "文字") {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = content.slice(start, end) || placeholder;
  const next = `${content.slice(0, start)}${before}${selected}${after}${content.slice(end)}`;
  setContent(next);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(
      start + before.length,
      start + before.length + selected.length,
    );
  });
}

function WritingEditor({ initialWork, prompt, onComplete, onExit, showToast }) {
  const [title, setTitle] = useState(initialWork.title || "未命名片段");
  const [content, setContent] = useState(initialWork.content || "");
  const [seconds, setSeconds] = useState(initialWork.durationSeconds || 0);
  const [editCount, setEditCount] = useState(initialWork.editCount || 0);
  const [running, setRunning] = useState(true);
  const [saveState, setSaveState] = useState("已保存");
  const [completing, setCompleting] = useState(false);
  const textareaRef = useRef(null);
  const hasMounted = useRef(false);
  const words = useMemo(() => countWords(content), [content]);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return undefined;
    }

    setSaveState("保存中…");
    const timer = window.setTimeout(async () => {
      try {
        await api.saveWork(initialWork.id, {
          title,
          content,
          durationSeconds: seconds,
          editCount,
          trainingType: initialWork.trainingType || prompt?.type,
          category: initialWork.category,
        });
        setSaveState("已自动保存");
      } catch {
        setSaveState("保存失败");
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [content, editCount, initialWork, prompt?.type, seconds, title]);

  const changeContent = (event) => {
    setContent(event.target.value);
    setEditCount((value) => value + 1);
  };

  const saveNow = async () => {
    try {
      setSaveState("保存中…");
      const saved = await api.saveWork(initialWork.id, {
        title,
        content,
        durationSeconds: seconds,
        editCount,
        category: initialWork.category,
        trainingType: initialWork.trainingType || prompt?.type,
      });
      setSaveState("已保存");
      showToast("文稿已保存。");
      return saved;
    } catch (error) {
      setSaveState("保存失败");
      showToast(error.message, "error");
      return null;
    }
  };

  const finish = async () => {
    setCompleting(true);
    try {
      const completed = await api.completeWork(initialWork.id, {
        title,
        content,
        durationSeconds: seconds,
        editCount,
      });
      setRunning(false);
      onComplete(completed);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setCompleting(false);
    }
  };

  const exitEditor = async () => {
    await saveNow();
    onExit();
  };

  return (
    <section className="editor-page">
      <header className="editor-header">
        <button className="back-button" onClick={exitEditor}>← 返回</button>
        <div className="editor-document-meta">
          <span className="document-dot" />
          <span>{saveState}</span>
          <small>本地 SQLite</small>
        </div>
        <div className="editor-actions">
          <button className="secondary-button" onClick={saveNow}>保存</button>
          <button className="primary-button compact" onClick={finish} disabled={completing}>
            {completing ? "正在完成…" : "完成训练"}
          </button>
        </div>
      </header>

      {prompt && (
        <details className="editor-prompt-strip">
          <summary>
            <span>{prompt.type}</span>
            <strong>{prompt.title}</strong>
            <small>{prompt.requirements.length} 项要求 · {prompt.wordLimit} 字以内</small>
          </summary>
          <div>
            <p>{prompt.description}</p>
            <ul>{prompt.requirements.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </details>
      )}

      <div className="editor-layout">
        <main className="editor-paper">
          <input
            className="editor-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="文稿标题"
          />
          <div className="editor-toolbar" role="toolbar" aria-label="Markdown 格式工具">
            <button onClick={() => insertMarkdown(textareaRef.current, content, setContent, "# ", "", "标题")}>H1</button>
            <button onClick={() => insertMarkdown(textareaRef.current, content, setContent, "## ", "", "小标题")}>H2</button>
            <span />
            <button className="bold-tool" onClick={() => insertMarkdown(textareaRef.current, content, setContent, "**", "**", "加粗文字")}>B</button>
            <button className="italic-tool" onClick={() => insertMarkdown(textareaRef.current, content, setContent, "*", "*", "强调文字")}>I</button>
            <button onClick={() => insertMarkdown(textareaRef.current, content, setContent, "> ", "", "引用")}>“ ”</button>
            <span />
            <button onClick={() => insertMarkdown(textareaRef.current, content, setContent, "\n\n", "", "")}>¶ 分段</button>
          </div>
          <textarea
            ref={textareaRef}
            className="writing-area"
            value={content}
            onChange={changeContent}
            placeholder="从第一句开始。不要等它完美，先让故事发生……"
            spellCheck="true"
            autoFocus
          />
          <footer className="paper-footer">
            <span>Markdown</span>
            <span>{words} 字 · {content.split(/\n+/).filter(Boolean).length || 0} 段</span>
          </footer>
        </main>

        <aside className="editor-inspector">
          <div className="timer-card">
            <div className="timer-label">
              <span className={running ? "live-dot" : ""} />
              写作时间
            </div>
            <strong>{formatTimer(seconds)}</strong>
            <button onClick={() => setRunning((value) => !value)}>
              {running ? "Ⅱ 暂停计时" : "▶ 继续计时"}
            </button>
          </div>
          <div className="inspector-stats">
            <div><span>当前字数</span><strong>{formatNumber(words)}</strong></div>
            <div><span>修改次数</span><strong>{editCount}</strong></div>
            <div><span>目标字数</span><strong>{prompt?.wordLimit || "—"}</strong></div>
          </div>
          {prompt && (
            <div className="progress-block">
              <div>
                <span>字数进度</span>
                <strong>{Math.min(100, Math.round((words / prompt.wordLimit) * 100))}%</strong>
              </div>
              <div className="progress-track">
                <span style={{ width: `${Math.min(100, (words / prompt.wordLimit) * 100)}%` }} />
              </div>
              <small>{words > prompt.wordLimit ? `已超出 ${words - prompt.wordLimit} 字` : `还可写 ${prompt.wordLimit - words} 字`}</small>
            </div>
          )}
          <div className="editor-tip">
            <span>今日编辑提示</span>
            <p>写完这一段之前，先不要回头修改上一句。</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function WorksPage({ onEdit, onCreate, showToast, refreshKey }) {
  const [category, setCategory] = useState("全部");
  const [search, setSearch] = useState("");
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadWorks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.works({
        ...(category !== "全部" ? { category } : {}),
        ...(search ? { search } : {}),
      });
      setWorks(result.items);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  }, [category, search, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(loadWorks, search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadWorks, refreshKey, search]);

  const removeWork = async (work) => {
    if (!window.confirm(`确定删除《${work.title}》吗？此操作无法撤销。`)) return;
    try {
      await api.deleteWork(work.id);
      showToast("作品已删除。");
      loadWorks();
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  return (
    <>
      <PageTopbar title="作品管理" onNewWork={onCreate} onSearch={setSearch} />
      <section className="page-heading-row">
        <div>
          <p className="eyebrow">你的文字档案</p>
          <h2>所有写下的，都值得被好好保存</h2>
          <p>练习、章节与废稿都留在这里，方便未来回看成长。</p>
        </div>
        <div className="works-count"><strong>{works.length}</strong><span>篇文稿</span></div>
      </section>

      <div className="filter-row">
        {workCategories.map((item) => (
          <button
            key={item}
            className={category === item ? "active" : ""}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : works.length ? (
        <section className="works-grid">
          {works.map((work) => (
            <article className="work-card" key={work.id}>
              <div className="work-card-top">
                <span className={`status-badge ${work.status}`}>
                  {work.status === "completed" ? "已完成" : "草稿"}
                </span>
                <div className="work-menu">
                  <IconButton label="编辑作品" onClick={() => onEdit(work.id)}>✎</IconButton>
                  <IconButton label="删除作品" onClick={() => removeWork(work)}>×</IconButton>
                </div>
              </div>
              <button className="work-card-main" onClick={() => onEdit(work.id)}>
                <span className="work-type">{work.trainingType || work.category}</span>
                <h3>{work.title}</h3>
                <p>{getExcerpt(work.content, 92)}</p>
              </button>
              <div className="tag-row">
                {(work.tags.length ? work.tags : [work.category]).slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}
              </div>
              <footer>
                <span>{formatNumber(work.wordCount)} 字</span>
                <span>{formatDuration(work.durationSeconds)}</span>
                <time>{formatDate(work.updatedAt)}</time>
              </footer>
            </article>
          ))}
          <button className="new-work-card" onClick={onCreate}>
            <span>＋</span>
            <strong>新建一篇文稿</strong>
            <small>从空白页开始自由写作</small>
          </button>
        </section>
      ) : (
        <EmptyState
          title={search ? "没有找到匹配的作品" : "这个分类还是空的"}
          detail={search ? "换个关键词，或清空搜索后再试。" : "新建文稿，或者从一次写作训练开始。"}
          action={<button className="primary-button compact" onClick={onCreate}>新建文稿</button>}
        />
      )}
    </>
  );
}

function PromptLibraryPage({ onUsePrompt, showToast, refreshKey }) {
  const [type, setType] = useState("全部");
  const [mode, setMode] = useState("all");
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.prompts({
        ...(type !== "全部" ? { type } : {}),
        ...(mode === "favorite" ? { favorite: "true" } : {}),
        ...(mode === "completed" ? { completed: "true" } : {}),
      }));
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  }, [mode, showToast, type]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const favorite = async (prompt) => {
    try {
      await api.toggleFavorite(prompt.id, !prompt.isFavorite);
      load();
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  const random = async () => {
    try {
      const prompt = await api.randomPrompt(type === "全部" ? undefined : type);
      onUsePrompt(prompt);
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  return (
    <>
      <PageTopbar title="训练题库" />
      <section className="library-hero">
        <div>
          <p className="eyebrow light">灵感不必等待</p>
          <h2>从一个明确的限制开始写</h2>
          <p>限制不是束缚，而是让注意力聚焦的训练器。</p>
        </div>
        <button onClick={random}><span>✦</span> 随机抽一道题</button>
      </section>

      <div className="library-controls">
        <div className="filter-row">
          {["全部", ...trainingTypes].map((item) => (
            <button key={item} className={type === item ? "active" : ""} onClick={() => setType(item)}>{item}</button>
          ))}
        </div>
        <div className="segmented-control">
          <button className={mode === "all" ? "active" : ""} onClick={() => setMode("all")}>全部</button>
          <button className={mode === "favorite" ? "active" : ""} onClick={() => setMode("favorite")}>收藏</button>
          <button className={mode === "completed" ? "active" : ""} onClick={() => setMode("completed")}>已完成</button>
        </div>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : data.items.length ? (
        <>
          <p className="result-count">共 {data.total} 道训练题</p>
          <section className="prompt-grid">
            {data.items.map((prompt, index) => (
              <article className="prompt-card" key={prompt.id}>
                <div className="prompt-card-top">
                  <span className="prompt-number">{String(index + 1).padStart(2, "0")}</span>
                  <IconButton
                    label={prompt.isFavorite ? "取消收藏" : "收藏题目"}
                    className={prompt.isFavorite ? "favorite active" : "favorite"}
                    onClick={() => favorite(prompt)}
                  >
                    {prompt.isFavorite ? "★" : "☆"}
                  </IconButton>
                </div>
                <div className="prompt-card-tags">
                  <span>{prompt.type}</span>
                  <span>{prompt.difficulty}</span>
                  {prompt.isCompleted && <span className="done">已完成</span>}
                </div>
                <h3>{prompt.title}</h3>
                <p>{prompt.description}</p>
                <ul>
                  {prompt.requirements.slice(0, 2).map((item) => <li key={item}>{item}</li>)}
                </ul>
                <footer>
                  <span>◷ {prompt.durationMinutes} 分钟</span>
                  <span>{prompt.wordLimit} 字以内</span>
                  <button onClick={() => onUsePrompt(prompt)}>开始训练 →</button>
                </footer>
              </article>
            ))}
          </section>
        </>
      ) : (
        <EmptyState title="这里还没有题目" detail="换一个分类或筛选条件试试。" />
      )}
    </>
  );
}

function StatsPage({ refreshKey }) {
  const [stats, setStats] = useState(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    api.stats(days).then(setStats);
  }, [days, refreshKey]);

  if (!stats) return <LoadingBlock />;
  const visibleDaily = days === 7 ? stats.daily : stats.daily.filter((_, index) => index % 2 === 0 || index === stats.daily.length - 1);
  const maxWords = Math.max(500, ...visibleDaily.map((item) => item.words));
  const totalTypeSessions = Math.max(1, stats.typeStats.reduce((sum, item) => sum + item.sessions, 0));

  return (
    <>
      <PageTopbar title="写作统计" />
      <section className="page-heading-row">
        <div>
          <p className="eyebrow">复盘成长</p>
          <h2>看见积累，也看见下一步</h2>
          <p>数据不是为了催促你，而是帮助你找到最需要练习的地方。</p>
        </div>
        <div className="segmented-control">
          {[7, 30, 90].map((value) => (
            <button key={value} className={days === value ? "active" : ""} onClick={() => setDays(value)}>
              {value} 天
            </button>
          ))}
        </div>
      </section>

      <section className="stat-summary-grid">
        <article><span>统计期写作</span><strong>{formatNumber(stats.totalWords)}<small>字</small></strong><p>完成 {stats.totalSessions} 次训练</p></article>
        <article><span>平均每天</span><strong>{formatNumber(stats.averageWords)}<small>字</small></strong><p>稳定比峰值更重要</p></article>
        <article><span>投入时间</span><strong>{Math.round(stats.totalSeconds / 3600 * 10) / 10}<small>小时</small></strong><p>{formatDuration(stats.totalSeconds)}</p></article>
        <article><span>最常训练</span><strong className="text-stat">{stats.strongest}</strong><p>你的当前优势</p></article>
      </section>

      <section className="stats-main-grid">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">每日字数</p><h3>写作趋势</h3></div>
            <span className="chart-legend"><i /> 完成字数</span>
          </div>
          <div className="trend-chart">
            {visibleDaily.map((item) => (
              <div className="trend-bar" key={item.date}>
                <span className="bar-value">{item.words ? formatNumber(item.words) : ""}</span>
                <div><i style={{ height: `${Math.max(2, (item.words / maxWords) * 100)}%` }} /></div>
                <small>{new Date(`${item.date}T12:00:00`).getDate()}</small>
              </div>
            ))}
          </div>
          <p className="axis-label">{days === 7 ? "过去一周" : `过去 ${days} 天`} · 日期</p>
        </article>

        <article className="panel practice-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">能力分布</p><h3>训练类型</h3></div>
          </div>
          <div className="type-stat-list">
            {stats.typeStats.slice(0, 6).map((item) => (
              <div key={item.type}>
                <span>{item.type}</span>
                <div><i style={{ width: `${Math.max(2, item.sessions / totalTypeSessions * 100)}%` }} /></div>
                <strong>{item.sessions} 次</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="insight-card">
        <div className="insight-mark">析</div>
        <div>
          <p className="eyebrow">本期训练观察</p>
          <h3>下一次，试试「{stats.weakest}」</h3>
          <p>
            你在这类能力上的练习次数相对较少。下一次训练不必追求高分，
            只需完成一篇，并记录一个自己最不满意的地方。
          </p>
        </div>
        <span className="ai-reserved">AI 深度分析 · 第三阶段</span>
      </section>
    </>
  );
}

function EditWorkPage({ workId, onExit, showToast, onChanged }) {
  const [work, setWork] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.work(workId).then(setWork).catch((nextError) => setError(nextError.message));
  }, [workId]);

  if (!work) return error ? <EmptyState title="无法打开文稿" detail={error} /> : <LoadingBlock />;
  return (
    <WritingEditor
      initialWork={work}
      onComplete={(completed) => {
        showToast("文稿已标记为完成。");
        onChanged(completed);
      }}
      onExit={onExit}
      showToast={showToast}
    />
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [editWorkId, setEditWorkId] = useState(null);
  const [initialPrompt, setInitialPrompt] = useState(null);
  const [toast, setToast] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    window.clearTimeout(window.__inkstoneToast);
    window.__inkstoneToast = window.setTimeout(() => setToast(null), 2800);
  }, []);

  const navigate = useCallback((page, payload) => {
    if (page === "edit-work") {
      setEditWorkId(payload);
      setActivePage("edit-work");
      return;
    }
    if (page === "new-work") {
      api.createWork({ title: "未命名片段", category: "小说章节" })
        .then((work) => {
          setEditWorkId(work.id);
          setActivePage("edit-work");
          setRefreshKey((value) => value + 1);
        })
        .catch((error) => showToast(error.message, "error"));
      return;
    }
    setActivePage(page);
  }, [showToast]);

  const usePrompt = useCallback((prompt) => {
    setInitialPrompt(prompt);
    setActivePage("training");
  }, []);

  const content = {
    dashboard: (
      <DashboardPage
        onStartPrompt={usePrompt}
        onNavigate={navigate}
        refreshKey={refreshKey}
      />
    ),
    training: (
      <TrainingPage
        initialPrompt={initialPrompt}
        onClearInitial={() => setInitialPrompt(null)}
        onComplete={() => {
          setRefreshKey((value) => value + 1);
          setActivePage("dashboard");
        }}
        showToast={showToast}
      />
    ),
    works: (
      <WorksPage
        onEdit={(id) => navigate("edit-work", id)}
        onCreate={() => navigate("new-work")}
        showToast={showToast}
        refreshKey={refreshKey}
      />
    ),
    prompts: (
      <PromptLibraryPage
        onUsePrompt={usePrompt}
        showToast={showToast}
        refreshKey={refreshKey}
      />
    ),
    stats: <StatsPage refreshKey={refreshKey} />,
    characters: (
      <CharactersPage
        showToast={showToast}
        refreshKey={refreshKey}
        onChanged={() => setRefreshKey((value) => value + 1)}
      />
    ),
    "edit-work": (
      <EditWorkPage
        workId={editWorkId}
        onExit={() => {
          setRefreshKey((value) => value + 1);
          setActivePage("works");
        }}
        onChanged={() => {
          setRefreshKey((value) => value + 1);
          setActivePage("works");
        }}
        showToast={showToast}
      />
    ),
  }[activePage];

  const isEditor = activePage === "edit-work";

  return (
    <div className={`app-shell ${isEditor ? "editor-mode" : ""}`}>
      {!isEditor && <Sidebar activePage={activePage} onNavigate={navigate} />}
      <main className={isEditor ? "app-content editor-content" : "app-content"}>
        {content}
      </main>
      {!isEditor && <MobileNav activePage={activePage} onNavigate={navigate} />}
      {toast && (
        <div className={`toast ${toast.type}`} role="status">
          <span>{toast.type === "error" ? "!" : "✓"}</span>
          {toast.message}
        </div>
      )}
    </div>
  );
}
