(() => {
  "use strict";

  const STORAGE_KEY = "yuji-ledger-v1";
  const MAX_CENTS = 9999999999; // ¥99,999,999.99
  const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  const CATEGORIES = [
    { id: "food", name: "餐饮", color: "#d67145", bg: "#f9e8dd" },
    { id: "transport", name: "交通", color: "#4f7fc4", bg: "#e6eef9" },
    { id: "shopping", name: "购物", color: "#ce6791", bg: "#fae7ef" },
    { id: "fun", name: "娱乐", color: "#8b6cc8", bg: "#eee8fa" },
    { id: "home", name: "居住", color: "#3f8f73", bg: "#e2f1ea" },
    { id: "health", name: "医疗", color: "#cb5b5b", bg: "#fbe7e4" },
    { id: "study", name: "学习", color: "#b4872f", bg: "#f8eeda" },
    { id: "other", name: "其他", color: "#78817b", bg: "#ebeeea" }
  ];

  const CATEGORY_MAP = new Map(CATEGORIES.map((category) => [category.id, category]));
  const els = {};
  const state = {
    initialCents: null,
    expenses: [],
    createdAt: null
  };

  let storageAvailable = true;
  let storageChecked = false;
  let activeView = "ledger";
  let statsCursor = startOfMonth(new Date());
  let selectedCategory = "food";
  let activeSheet = null;
  let sheetTrigger = null;
  let sheetHideTimer = 0;
  let welcomeOpen = false;
  let editingExpenseId = null;
  let deleteArmed = false;
  let deleteArmTimer = 0;
  let toastTimer = 0;
  let previousRemaining = null;
  let balanceAnimation = 0;
  let exportLabelTimer = 0;
  let lastFocusedBeforeWelcome = null;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const moneyFormatter = new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  init();

  function init() {
    cacheElements();
    loadState();
    buildCategoryGrid();
    bindEvents();
    fillExpenseTime();
    renderAll();
    setupWelcome();
    checkStorage();
    registerServiceWorker();
  }

  function cacheElements() {
    const byId = (id) => document.getElementById(id);
    Object.assign(els, {
      app: byId("app"),
      main: byId("main"),
      welcomeLayer: byId("welcomeLayer"),
      welcomeCard: document.querySelector(".welcome-card"),
      welcomeForm: byId("welcomeForm"),
      welcomeAmount: byId("welcomeAmount"),
      welcomeError: byId("welcomeError"),
      welcomeStart: byId("welcomeStart"),
      settingsBtn: byId("settingsBtn"),
      ledgerView: byId("ledgerView"),
      statsView: byId("statsView"),
      balanceCard: byId("balanceCard"),
      balanceAmount: byId("balanceAmount"),
      balanceCurrency: byId("balanceCurrency"),
      balanceValue: byId("balanceValue"),
      balanceStatus: byId("balanceStatus"),
      balanceCaption: byId("balanceCaption"),
      usedPercent: byId("usedPercent"),
      budgetBar: byId("budgetBar"),
      initialAmount: byId("initialAmount"),
      totalSpent: byId("totalSpent"),
      addExpenseBtn: byId("addExpenseBtn"),
      emptyAddBtn: byId("emptyAddBtn"),
      recordSummary: byId("recordSummary"),
      expenseList: byId("expenseList"),
      emptyState: byId("emptyState"),
      tabs: Array.from(document.querySelectorAll(".tab")),
      statsMonthTitle: byId("statsMonthTitle"),
      prevMonthBtn: byId("prevMonthBtn"),
      nextMonthBtn: byId("nextMonthBtn"),
      statsContent: byId("statsContent"),
      monthSpentLabel: byId("monthSpentLabel"),
      monthSpent: byId("monthSpent"),
      monthCount: byId("monthCount"),
      monthDaily: byId("monthDaily"),
      topCategory: byId("topCategory"),
      donut: byId("donut"),
      donutCount: byId("donutCount"),
      donutPeriodLabel: byId("donutPeriodLabel"),
      legend: byId("legend"),
      trendTitle: byId("trendTitle"),
      trendTotal: byId("trendTotal"),
      trendChart: byId("trendChart"),
      statsEmpty: byId("statsEmpty"),
      statsAddBtn: byId("statsAddBtn"),
      sheetLayer: byId("sheetLayer"),
      addSheet: byId("addSheet"),
      expenseForm: byId("expenseForm"),
      expenseAmount: byId("expenseAmount"),
      expenseNote: byId("expenseNote"),
      expenseTime: byId("expenseTime"),
      amountPreview: byId("amountPreview"),
      categoryGrid: byId("categoryGrid"),
      saveExpenseBtn: byId("saveExpenseBtn"),
      detailSheet: byId("detailSheet"),
      detailIcon: byId("detailIcon"),
      detailCategory: byId("detailCategory"),
      detailAmount: byId("detailAmount"),
      detailDate: byId("detailDate"),
      detailNote: byId("detailNote"),
      detailBalance: byId("detailBalance"),
      deleteExpenseBtn: byId("deleteExpenseBtn"),
      settingsSheet: byId("settingsSheet"),
      initialRow: byId("initialRow"),
      initialEditor: byId("initialEditor"),
      settingsAmount: byId("settingsAmount"),
      settingsError: byId("settingsError"),
      settingsInitial: byId("settingsInitial"),
      cancelInitialBtn: byId("cancelInitialBtn"),
      saveInitialBtn: byId("saveInitialBtn"),
      exportBtn: byId("exportBtn"),
      clearRow: byId("clearRow"),
      clearConfirm: byId("clearConfirm"),
      clearCount: byId("clearCount"),
      cancelClearBtn: byId("cancelClearBtn"),
      confirmClearBtn: byId("confirmClearBtn"),
      toast: byId("toast"),
      toastTitle: byId("toastTitle"),
      toastBody: byId("toastBody"),
      toastClose: byId("toastClose")
    });
  }

  function bindEvents() {
    els.tabs.forEach((tab) => {
      tab.addEventListener("click", () => switchView(tab.dataset.view));
    });

    els.settingsBtn.addEventListener("click", (event) => openSettings(event.currentTarget));
    els.addExpenseBtn.addEventListener("click", (event) => openAddSheet(event.currentTarget));
    els.emptyAddBtn.addEventListener("click", (event) => openAddSheet(event.currentTarget));
    els.statsAddBtn.addEventListener("click", (event) => openAddSheet(event.currentTarget));

    els.welcomeForm.addEventListener("submit", handleWelcomeSubmit);
    els.welcomeAmount.addEventListener("input", handleWelcomeInput);
    document.querySelectorAll("[data-quick]").forEach((button) => {
      button.addEventListener("click", () => {
        els.welcomeAmount.value = Number(button.dataset.quick).toFixed(2);
        applyQuickSelection();
        validateWelcome(false);
        els.welcomeAmount.focus({ preventScroll: true });
      });
    });

    els.expenseForm.addEventListener("submit", handleExpenseSubmit);
    els.expenseAmount.addEventListener("input", handleExpenseAmountInput);
    els.expenseAmount.addEventListener("blur", handleExpenseAmountBlur);
    els.categoryGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (!button) return;
      selectCategory(button.dataset.category);
    });

    els.expenseList.addEventListener("click", (event) => {
      const item = event.target.closest(".expense-item");
      if (!item) return;
      openDetail(item.dataset.id, item);
    });

    document.querySelectorAll("[data-close-sheet]").forEach((element) => {
      element.addEventListener("click", () => closeSheet());
    });

    els.deleteExpenseBtn.addEventListener("click", handleDeleteExpense);
    els.initialRow.addEventListener("click", () => toggleInitialEditor());
    els.cancelInitialBtn.addEventListener("click", () => toggleInitialEditor(false));
    els.saveInitialBtn.addEventListener("click", saveInitialAmount);
    els.settingsAmount.addEventListener("input", handleSettingsAmountInput);
    els.settingsAmount.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveInitialAmount();
      }
    });
    els.exportBtn.addEventListener("click", exportCsv);
    els.clearRow.addEventListener("click", toggleClearConfirm);
    els.cancelClearBtn.addEventListener("click", () => toggleClearConfirm(false));
    els.confirmClearBtn.addEventListener("click", clearAllExpenses);

    els.prevMonthBtn.addEventListener("click", () => changeStatsMonth(-1));
    els.nextMonthBtn.addEventListener("click", () => changeStatsMonth(1));
    els.toastClose.addEventListener("click", hideToast);

    document.addEventListener("keydown", handleGlobalKeydown);
  }

  function buildCategoryGrid() {
    const fragment = document.createDocumentFragment();
    CATEGORIES.forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "category-btn";
      button.dataset.category = category.id;
      button.setAttribute("aria-pressed", category.id === selectedCategory ? "true" : "false");
      button.append(makeCategoryIcon(category), document.createTextNode(category.name));
      fragment.append(button);
    });
    els.categoryGrid.append(fragment);
  }

  function makeCategoryIcon(category) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#cat-${category.id}`);
    svg.append(use);
    return svg;
  }

  function setCategoryIcon(container, category) {
    container.replaceChildren(makeCategoryIcon(category));
    container.style.setProperty("--cat-color", category.color);
    container.style.setProperty("--cat-bg", category.bg);
  }

  /* Storage -------------------------------------------------------------- */

  function checkStorage() {
    if (storageChecked) return storageAvailable;
    storageChecked = true;
    try {
      const probe = "__yuji_storage_probe__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      storageAvailable = true;
    } catch (error) {
      storageAvailable = false;
    }
    return storageAvailable;
  }

  function loadState() {
    checkStorage();
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      storageAvailable = false;
    }
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return;
      if (Number.isInteger(data.initialCents) && data.initialCents >= 0 && data.initialCents <= MAX_CENTS) {
        state.initialCents = data.initialCents;
      }
      if (typeof data.createdAt === "string" && !Number.isNaN(new Date(data.createdAt).getTime())) {
        state.createdAt = data.createdAt;
      }
      if (Array.isArray(data.expenses)) {
        const seen = new Set();
        state.expenses = data.expenses
          .map(normalizeExpense)
          .filter((expense) => {
            if (!expense || seen.has(expense.id)) return false;
            seen.add(expense.id);
            return true;
          });
      }
    } catch (error) {
      // A malformed local record should never stop the app from opening.
      state.expenses = [];
    }
  }

  function normalizeExpense(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (!Number.isInteger(raw.amountCents) || raw.amountCents <= 0 || raw.amountCents > MAX_CENTS) return null;
    const occurred = raw.occurredAt ? new Date(raw.occurredAt) : null;
    if (!occurred || Number.isNaN(occurred.getTime())) return null;
    const created = raw.createdAt ? new Date(raw.createdAt) : occurred;
    const category = CATEGORY_MAP.has(raw.category) ? raw.category : "other";
    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : makeId(),
      amountCents: raw.amountCents,
      category,
      note: typeof raw.note === "string" ? raw.note.slice(0, 30) : "",
      occurredAt: occurred.toISOString(),
      createdAt: Number.isNaN(created.getTime()) ? occurred.toISOString() : created.toISOString()
    };
  }

  function persist() {
    if (!storageAvailable) return false;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          initialCents: state.initialCents,
          expenses: state.expenses,
          createdAt: state.createdAt,
          updatedAt: new Date().toISOString()
        })
      );
      return true;
    } catch (error) {
      storageAvailable = false;
      return false;
    }
  }

  /* Welcome -------------------------------------------------------------- */

  function setupWelcome() {
    els.welcomeCard.tabIndex = -1;
    if (state.initialCents === null) {
      welcomeOpen = true;
      lastFocusedBeforeWelcome = document.activeElement;
      els.welcomeLayer.classList.add("is-open");
      els.welcomeLayer.removeAttribute("inert");
      els.welcomeLayer.setAttribute("aria-hidden", "false");
      els.app.inert = true;
      els.welcomeStart.disabled = true;
      window.setTimeout(() => {
        if (welcomeOpen) els.welcomeCard.focus({ preventScroll: true });
      }, 120);
    } else {
      dismissWelcome(false);
    }
  }

  function handleWelcomeInput() {
    const result = sanitizeAmountInput(els.welcomeAmount.value);
    if (els.welcomeAmount.value !== result.text) {
      els.welcomeAmount.value = result.text;
    }
    validateWelcome(false);
    applyQuickSelection();
  }

  function validateWelcome(showError) {
    const cents = parseAmountToCents(els.welcomeAmount.value);
    const valid = cents !== null;
    els.welcomeStart.disabled = !valid;
    if (showError && !valid) {
      els.welcomeError.textContent = "请输入大于 0 的初始金额，最多两位小数。";
    } else if (valid) {
      els.welcomeError.textContent = "";
    }
    return cents;
  }

  function applyQuickSelection() {
    const current = parseAmountToCents(els.welcomeAmount.value);
    document.querySelectorAll("[data-quick]").forEach((button) => {
      const quickCents = Number(button.dataset.quick) * 100;
      button.classList.toggle("is-selected", current !== null && current === quickCents);
    });
  }

  function handleWelcomeSubmit(event) {
    event.preventDefault();
    const cents = validateWelcome(true);
    if (cents === null) {
      els.welcomeAmount.focus({ preventScroll: true });
      return;
    }
    state.initialCents = cents;
    state.createdAt = new Date().toISOString();
    const saved = persist();
    dismissWelcome(true);
    renderAll();
    showToast(
      `初始金额 ${formatMoney(cents)}`,
      saved ? `现在可用余额为 ${formatMoney(cents)}` : "浏览器未允许保存，刷新后可能丢失"
    );
  }

  function dismissWelcome(moveFocus) {
    welcomeOpen = false;
    els.welcomeLayer.classList.remove("is-open");
    els.welcomeLayer.setAttribute("aria-hidden", "true");
    els.welcomeLayer.setAttribute("inert", "");
    els.app.inert = false;
    if (moveFocus) {
      window.setTimeout(() => els.main.focus({ preventScroll: true }), 80);
    } else if (lastFocusedBeforeWelcome instanceof HTMLElement) {
      lastFocusedBeforeWelcome = null;
    }
  }

  /* Money helpers -------------------------------------------------------- */

  function parseAmountToCents(raw) {
    let text = String(raw == null ? "" : raw)
      .replace(/[,\s¥￥]/g, "")
      .replace(/[。．]/g, ".")
      .trim();
    if (!text || !/\d/.test(text) || !/^\d*(?:\.\d{0,2})?$/.test(text)) return null;
    const [whole = "0", fraction = ""] = text.split(".");
    const cents = Number(whole || "0") * 100 + Number((fraction + "00").slice(0, 2));
    if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_CENTS) return null;
    return cents;
  }

  function sanitizeAmountInput(raw) {
    let value = String(raw == null ? "" : raw)
      .replace(/[，,\s¥￥]/g, "")
      .replace(/[。．]/g, ".")
      .replace(/[^\d.]/g, "");
    const dotIndex = value.indexOf(".");
    if (dotIndex !== -1) {
      value = value.slice(0, dotIndex + 1) + value.slice(dotIndex + 1).replace(/\./g, "");
    }
    const hasDot = value.includes(".");
    let [whole = "", fraction = ""] = value.split(".");
    whole = whole.replace(/^0+(?=\d)/, "").slice(0, 8);
    fraction = fraction.slice(0, 2);
    let text;
    if (hasDot) {
      text = `${whole || "0"}.${fraction}`;
    } else {
      text = whole;
    }
    return { text, cents: parseAmountToCents(text) };
  }

  function formatNumber(cents) {
    return moneyFormatter.format(Math.abs(cents) / 100);
  }

  function formatMoney(cents) {
    return `${cents < 0 ? "-" : ""}¥${formatNumber(cents)}`;
  }

  function totals() {
    const spent = state.expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
    const initial = state.initialCents || 0;
    return { spent, initial, remaining: initial - spent };
  }

  function setMoneyParts(cents) {
    const negative = cents < 0;
    const text = formatNumber(cents);
    els.balanceCurrency.textContent = negative ? "−¥" : "¥";
    els.balanceValue.textContent = text;
    els.balanceAmount.classList.toggle("is-negative", negative);
    els.balanceAmount.classList.toggle("is-long", text.length > 9);
  }

  function renderBalance(cents, animate) {
    const shouldAnimate =
      animate &&
      previousRemaining !== null &&
      previousRemaining !== cents &&
      !reducedMotion.matches;
    window.cancelAnimationFrame(balanceAnimation);
    if (!shouldAnimate) {
      setMoneyParts(cents);
      previousRemaining = cents;
      return;
    }

    const from = previousRemaining;
    const to = cents;
    const startedAt = performance.now();
    const duration = 430;
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setMoneyParts(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        balanceAnimation = window.requestAnimationFrame(tick);
      } else {
        setMoneyParts(to);
        previousRemaining = to;
      }
    };
    balanceAnimation = window.requestAnimationFrame(tick);
  }

  /* Rendering ------------------------------------------------------------ */

  function renderAll() {
    renderLedger();
    renderStats();
  }

  function renderLedger() {
    const { initial, spent, remaining } = totals();
    const hasInitial = state.initialCents !== null;
    const hasSpent = spent > 0;
    const ratio = initial > 0 ? spent / initial : 0;

    renderBalance(remaining, true);
    els.initialAmount.textContent = formatMoney(initial);
    els.totalSpent.textContent = formatMoney(spent);

    let statusClass = "status--good";
    let statusText = "预算充足";
    if (!hasInitial) {
      statusText = "待设置";
    } else if (remaining < 0) {
      statusClass = "status--over";
      statusText = "已超支";
    } else if (hasSpent && remaining === 0) {
      statusClass = "status--tight";
      statusText = "预算用尽";
    } else if (ratio >= 0.8) {
      statusClass = "status--tight";
      statusText = "预算偏紧";
    }
    els.balanceStatus.className = `status-pill ${statusClass}`;
    els.balanceStatus.querySelector("span").textContent = statusText;

    if (!hasInitial) {
      els.balanceCaption.textContent = "设置初始金额，开始记录第一笔";
    } else if (!hasSpent) {
      els.balanceCaption.textContent = `初始 ${formatMoney(initial)}，还没有支出`;
    } else if (remaining < 0) {
      els.balanceCaption.textContent = `已超出初始金额 ${formatMoney(-remaining)}`;
    } else {
      els.balanceCaption.textContent = `初始 ${formatMoney(initial)} − 支出 ${formatMoney(spent)}`;
    }

    const percent = ratio * 100;
    els.usedPercent.textContent = percent > 999 ? "999%+" : `${Math.max(0, Math.round(percent))}%`;
    els.budgetBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    els.budgetBar.classList.toggle("is-over", remaining < 0);

    const monthTotal = currentMonthExpenses().reduce((sum, expense) => sum + expense.amountCents, 0);
    els.recordSummary.textContent = state.expenses.length
      ? `共 ${state.expenses.length} 笔 · 本月 ${formatMoney(monthTotal)}`
      : "还没有支出记录";

    renderExpenseList();
  }

  function renderExpenseList() {
    const sorted = [...state.expenses].sort((a, b) => {
      const byDate = new Date(b.occurredAt) - new Date(a.occurredAt);
      if (byDate !== 0) return byDate;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const groups = new Map();
    sorted.forEach((expense) => {
      const date = new Date(expense.occurredAt);
      const key = dateKey(date);
      if (!groups.has(key)) groups.set(key, { date, expenses: [] });
      groups.get(key).expenses.push(expense);
    });

    const fragment = document.createDocumentFragment();
    groups.forEach((group) => {
      const section = document.createElement("section");
      section.className = "day-group";

      const head = document.createElement("div");
      head.className = "day-head";
      const label = document.createElement("span");
      label.textContent = relativeDateLabel(group.date);
      const subtotal = document.createElement("strong");
      subtotal.textContent = `-${formatMoney(
        group.expenses.reduce((sum, expense) => sum + expense.amountCents, 0)
      )}`;
      head.append(label, subtotal);

      const items = document.createElement("div");
      items.className = "day-items";
      group.expenses.forEach((expense) => items.append(createExpenseItem(expense)));

      section.append(head, items);
      fragment.append(section);
    });

    els.expenseList.replaceChildren(fragment);
    const isEmpty = state.expenses.length === 0;
    els.emptyState.hidden = !isEmpty;
    els.expenseList.hidden = isEmpty;
  }

  function createExpenseItem(expense) {
    const category = CATEGORY_MAP.get(expense.category) || CATEGORY_MAP.get("other");
    const occurred = new Date(expense.occurredAt);
    const time = `${pad2(occurred.getHours())}:${pad2(occurred.getMinutes())}`;
    const note = expense.note.trim();

    const button = document.createElement("button");
    button.type = "button";
    button.className = "expense-item";
    button.dataset.id = expense.id;
    button.setAttribute(
      "aria-label",
      `${category.name}，${formatMoney(expense.amountCents)}，${note || "无备注"}，${fullDateLabel(occurred)} ${time}`
    );

    const icon = document.createElement("span");
    icon.className = "expense-icon";
    icon.setAttribute("aria-hidden", "true");
    setCategoryIcon(icon, category);

    const copy = document.createElement("span");
    copy.className = "expense-copy";
    const title = document.createElement("span");
    title.className = "expense-title";
    title.textContent = note || category.name;
    const meta = document.createElement("span");
    meta.className = "expense-meta";
    meta.append(document.createTextNode(note ? category.name : "支出"));
    const dot = document.createElement("i");
    dot.setAttribute("aria-hidden", "true");
    meta.append(dot, document.createTextNode(time));

    const amount = document.createElement("span");
    amount.className = "expense-amount";
    amount.textContent = `-${formatMoney(expense.amountCents)}`;

    copy.append(title, meta);
    button.append(icon, copy, amount);
    return button;
  }

  function renderStats() {
    const year = statsCursor.getFullYear();
    const month = statsCursor.getMonth();
    els.statsMonthTitle.textContent = `${year}年${month + 1}月`;

    const now = new Date();
    const viewingCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    els.nextMonthBtn.disabled = viewingCurrentMonth;
    const periodLabel = viewingCurrentMonth ? "本月支出" : `${month + 1}月支出`;
    els.monthSpentLabel.textContent = periodLabel;
    els.donutPeriodLabel.textContent = periodLabel;

    const monthExpenses = state.expenses.filter((expense) => {
      const date = new Date(expense.occurredAt);
      return date.getFullYear() === year && date.getMonth() === month;
    });

    if (monthExpenses.length === 0) {
      els.statsContent.hidden = true;
      els.statsEmpty.hidden = false;
      return;
    }

    els.statsContent.hidden = false;
    els.statsEmpty.hidden = true;

    const total = monthExpenses.reduce((sum, expense) => sum + expense.amountCents, 0);
    const daysInPeriod = viewingCurrentMonth ? now.getDate() : new Date(year, month + 1, 0).getDate();
    const dailyAverage = Math.round(total / Math.max(1, daysInPeriod));

    els.monthSpent.textContent = formatMoney(total);
    els.monthSpent.classList.toggle("is-long", formatNumber(total).length > 9);
    els.monthCount.textContent = `${monthExpenses.length} 笔支出`;
    els.monthDaily.textContent = `日均 ${formatMoney(dailyAverage)}`;

    const totalsByCategory = new Map(CATEGORIES.map((category) => [category.id, 0]));
    monthExpenses.forEach((expense) => {
      const categoryId = CATEGORY_MAP.has(expense.category) ? expense.category : "other";
      totalsByCategory.set(categoryId, (totalsByCategory.get(categoryId) || 0) + expense.amountCents);
    });

    const rows = CATEGORIES.map((category) => ({
      ...category,
      total: totalsByCategory.get(category.id) || 0
    }))
      .filter((category) => category.total > 0)
      .sort((a, b) => b.total - a.total);

    const top = rows[0];
    els.topCategory.textContent = `占比最高 · ${top.name} ${formatSharePercent(top.total, total)}`;
    els.donutCount.textContent = `${monthExpenses.length} 笔`;

    let offset = 0;
    const stops = rows.map((category) => {
      const start = offset;
      offset += (category.total / total) * 100;
      return `${category.color} ${start.toFixed(2)}% ${offset.toFixed(2)}%`;
    });
    els.donut.style.background = `conic-gradient(${stops.join(", ")})`;
    els.donut.setAttribute(
      "aria-label",
      `支出分类：${rows
        .map((category) => `${category.name} ${formatSharePercent(category.total, total)}`)
        .join("，")}`
    );

    const legendFragment = document.createDocumentFragment();
    rows.forEach((category) => {
      const row = document.createElement("div");
      row.className = "legend-row";

      const dot = document.createElement("span");
      dot.className = "legend-dot";
      dot.style.background = category.color;

      const name = document.createElement("span");
      name.className = "legend-name";
      name.textContent = category.name;
      const percent = document.createElement("em");
      percent.textContent = formatSharePercent(category.total, total);
      name.append(percent);

      const amount = document.createElement("span");
      amount.className = "legend-amount";
      amount.textContent = formatMoneyCompact(category.total);

      row.append(dot, name, amount);
      legendFragment.append(row);
    });
    els.legend.replaceChildren(legendFragment);

    renderTrend(viewingCurrentMonth, monthExpenses);
  }

  function renderTrend(viewingCurrentMonth, monthExpenses) {
    els.trendTitle.textContent = viewingCurrentMonth ? "近 7 天" : "月末 7 天";
    const now = new Date();
    const end = viewingCurrentMonth
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : new Date(statsCursor.getFullYear(), statsCursor.getMonth() + 1, 0);

    const byDay = new Map();
    state.expenses.forEach((expense) => {
      const date = new Date(expense.occurredAt);
      const key = dateKey(date);
      byDay.set(key, (byDay.get(key) || 0) + expense.amountCents);
    });

    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(end);
      date.setDate(end.getDate() - i);
      days.push({ date, total: byDay.get(dateKey(date)) || 0 });
    }

    const max = Math.max(...days.map((day) => day.total));
    const weekTotal = days.reduce((sum, day) => sum + day.total, 0);
    els.trendTotal.textContent = `合计 ${formatMoney(weekTotal)}`;

    const fragment = document.createDocumentFragment();
    days.forEach((day) => {
      const item = document.createElement("div");
      item.className = `trend-item${day.total === 0 ? " is-zero" : ""}`;
      item.title = `${day.date.getMonth() + 1}月${day.date.getDate()}日 ${formatMoney(day.total)}`;
      item.setAttribute("role", "img");
      item.setAttribute(
        "aria-label",
        `${day.date.getMonth() + 1}月${day.date.getDate()}日，支出 ${formatMoney(day.total)}`
      );

      const barWrap = document.createElement("div");
      barWrap.className = "trend-bar-wrap";
      const bar = document.createElement("div");
      bar.className = "trend-bar";
      if (day.total > 0 && max > 0) {
        bar.style.height = `${Math.max(7, Math.round((day.total / max) * 100))}%`;
      }
      barWrap.append(bar);

      const weekday = document.createElement("span");
      weekday.className = "trend-day";
      weekday.textContent = `周${"日一二三四五六"[day.date.getDay()]}`;
      const date = document.createElement("span");
      date.className = "trend-date";
      date.textContent = String(day.date.getDate());

      item.append(barWrap, weekday, date);
      fragment.append(item);
    });

    els.trendChart.replaceChildren(fragment);
  }

  /* Views and navigation ------------------------------------------------- */

  function switchView(view) {
    if (view !== "ledger" && view !== "stats") return;
    activeView = view;
    const showingStats = view === "stats";
    els.ledgerView.hidden = showingStats;
    els.statsView.hidden = !showingStats;
    els.tabs.forEach((tab) => {
      const active = tab.dataset.view === view;
      tab.classList.toggle("is-active", active);
      if (active) {
        tab.setAttribute("aria-current", "page");
      } else {
        tab.removeAttribute("aria-current");
      }
    });
    els.main.scrollTop = 0;
    if (showingStats) renderStats();
  }

  function changeStatsMonth(delta) {
    const next = new Date(statsCursor.getFullYear(), statsCursor.getMonth() + delta, 1);
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    if (next > currentMonth) return;
    statsCursor = next;
    renderStats();
  }

  /* Add expense ---------------------------------------------------------- */

  function openAddSheet(trigger) {
    if (state.initialCents === null) {
      setupWelcome();
      return;
    }
    resetAddForm();
    openSheet(els.addSheet, trigger);
    window.setTimeout(() => {
      if (activeSheet === els.addSheet) {
        els.expenseAmount.focus({ preventScroll: true });
      }
    }, 340);
  }

  function resetAddForm() {
    els.expenseAmount.value = "";
    els.expenseNote.value = "";
    fillExpenseTime();
    selectCategory("food");
    els.saveExpenseBtn.disabled = true;
    const remaining = totals().remaining;
    els.amountPreview.className = "amount-preview";
    els.amountPreview.textContent = `记完后剩余可用 ${formatMoney(remaining)}`;
  }

  function fillExpenseTime() {
    if (!els.expenseTime) return;
    els.expenseTime.value = toDateTimeInput(new Date());
  }

  function selectCategory(categoryId) {
    if (!CATEGORY_MAP.has(categoryId)) return;
    selectedCategory = categoryId;
    els.categoryGrid.querySelectorAll("[data-category]").forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.category === categoryId ? "true" : "false");
    });
  }

  function handleExpenseAmountInput() {
    const result = sanitizeAmountInput(els.expenseAmount.value);
    if (els.expenseAmount.value !== result.text) {
      els.expenseAmount.value = result.text;
    }
    updateAmountPreview(result.cents);
  }

  function handleExpenseAmountBlur() {
    const cents = parseAmountToCents(els.expenseAmount.value);
    if (cents !== null) {
      els.expenseAmount.value = (cents / 100).toFixed(2);
      updateAmountPreview(cents);
    }
  }

  function updateAmountPreview(cents) {
    const valid = cents !== null;
    els.saveExpenseBtn.disabled = !valid;

    if (!els.expenseAmount.value) {
      els.amountPreview.className = "amount-preview";
      const remaining = totals().remaining;
      els.amountPreview.textContent = `记完后剩余可用 ${formatMoney(remaining)}`;
      return;
    }
    if (!valid) {
      els.amountPreview.className = "amount-preview is-over";
      els.amountPreview.textContent = "请输入大于 0 的金额，最多两位小数";
      return;
    }

    const after = totals().remaining - cents;
    if (after < 0) {
      els.amountPreview.className = "amount-preview is-over";
      els.amountPreview.textContent = `这笔会超出可用余额 ${formatMoney(-after)}`;
    } else {
      els.amountPreview.className = "amount-preview is-good";
      els.amountPreview.textContent = `记完后剩余可用 ${formatMoney(after)}`;
    }
  }

  function handleExpenseSubmit(event) {
    event.preventDefault();
    const cents = parseAmountToCents(els.expenseAmount.value);
    if (cents === null) {
      els.amountPreview.className = "amount-preview is-over";
      els.amountPreview.textContent = "请输入大于 0 的金额，最多两位小数";
      els.expenseAmount.focus({ preventScroll: true });
      return;
    }

    const parsedTime = els.expenseTime.value ? new Date(els.expenseTime.value) : new Date();
    const occurred = Number.isNaN(parsedTime.getTime()) ? new Date() : parsedTime;
    const note = els.expenseNote.value.trim().slice(0, 30);

    state.expenses.push({
      id: makeId(),
      amountCents: cents,
      category: selectedCategory,
      note,
      occurredAt: occurred.toISOString(),
      createdAt: new Date().toISOString()
    });

    const saved = persist();
    closeSheet();
    renderAll();
    const remaining = totals().remaining;
    showToast(
      "余额已更新",
      saved
        ? `支出 ${formatMoney(cents)} · 剩余可用 ${formatMoney(remaining)}`
        : `支出 ${formatMoney(cents)} · 未能保存，刷新后可能丢失`
    );
    if (!saved) storageAvailable = false;
  }

  /* Detail and delete ---------------------------------------------------- */

  function openDetail(id, trigger) {
    const expense = state.expenses.find((item) => item.id === id);
    if (!expense) return;
    const category = CATEGORY_MAP.get(expense.category) || CATEGORY_MAP.get("other");
    const occurred = new Date(expense.occurredAt);

    editingExpenseId = id;
    setCategoryIcon(els.detailIcon, category);
    els.detailCategory.textContent = category.name;
    els.detailAmount.textContent = `-${formatMoney(expense.amountCents)}`;
    els.detailDate.textContent = fullDateLabel(occurred) + ` ${pad2(occurred.getHours())}:${pad2(occurred.getMinutes())}`;
    els.detailNote.textContent = expense.note.trim() || "无备注";
    els.detailBalance.textContent = `可用余额将恢复至 ${formatMoney(
      totals().remaining + expense.amountCents
    )}`;
    resetDeleteButton();
    openSheet(els.detailSheet, trigger);
  }

  function handleDeleteExpense() {
    if (!editingExpenseId) return;
    if (!deleteArmed) {
      deleteArmed = true;
      els.deleteExpenseBtn.classList.add("is-confirming");
      els.deleteExpenseBtn.querySelector("span").textContent = "再点一次，确认删除";
      window.clearTimeout(deleteArmTimer);
      deleteArmTimer = window.setTimeout(resetDeleteButton, 4000);
      return;
    }

    const expense = state.expenses.find((item) => item.id === editingExpenseId);
    if (!expense) return;
    const amount = expense.amountCents;
    state.expenses = state.expenses.filter((item) => item.id !== editingExpenseId);
    const saved = persist();
    editingExpenseId = null;
    resetDeleteButton();
    closeSheet({ restoreFocus: false });
    renderAll();
    const remaining = totals().remaining;
    showToast(
      `已删除 ${formatMoney(amount)}`,
      saved ? `可用余额恢复至 ${formatMoney(remaining)}` : "未能保存，刷新后可能恢复"
    );
    window.setTimeout(() => els.main.focus({ preventScroll: true }), 80);
  }

  function resetDeleteButton() {
    deleteArmed = false;
    window.clearTimeout(deleteArmTimer);
    if (!els.deleteExpenseBtn) return;
    els.deleteExpenseBtn.classList.remove("is-confirming");
    els.deleteExpenseBtn.querySelector("span").textContent = "删除这笔支出";
  }

  /* Settings ------------------------------------------------------------- */

  function openSettings(trigger) {
    const { initial } = totals();
    els.settingsInitial.textContent = formatMoney(initial);
    els.clearCount.textContent = state.expenses.length ? `${state.expenses.length} 笔` : "暂无";
    els.clearRow.disabled = state.expenses.length === 0;
    els.exportBtn.disabled = state.expenses.length === 0;
    toggleInitialEditor(false);
    toggleClearConfirm(false);
    els.settingsError.textContent = "";
    els.exportBtn.querySelector(".setting-copy small").textContent = "下载 CSV，可用表格软件打开";
    openSheet(els.settingsSheet, trigger);
  }

  function toggleInitialEditor(force) {
    const shouldOpen = typeof force === "boolean" ? force : els.initialEditor.hidden;
    if (shouldOpen && state.initialCents !== null) {
      els.settingsAmount.value = (state.initialCents / 100).toFixed(2);
      els.settingsError.textContent = "";
      els.initialEditor.hidden = false;
      els.initialRow.setAttribute("aria-expanded", "true");
      window.setTimeout(() => {
        els.settingsAmount.focus({ preventScroll: true });
        els.settingsAmount.select();
      }, 60);
    } else {
      els.initialEditor.hidden = true;
      els.initialRow.setAttribute("aria-expanded", "false");
      els.settingsError.textContent = "";
    }
  }

  function handleSettingsAmountInput() {
    const result = sanitizeAmountInput(els.settingsAmount.value);
    if (els.settingsAmount.value !== result.text) {
      els.settingsAmount.value = result.text;
    }
    if (result.cents !== null) els.settingsError.textContent = "";
  }

  function saveInitialAmount() {
    const cents = parseAmountToCents(els.settingsAmount.value);
    if (cents === null) {
      els.settingsError.textContent = "请输入大于 0 的有效金额。";
      els.settingsAmount.focus({ preventScroll: true });
      return;
    }
    state.initialCents = cents;
    if (!state.createdAt) state.createdAt = new Date().toISOString();
    const saved = persist();
    closeSheet();
    renderAll();
    const remaining = totals().remaining;
    showToast(
      `初始金额已更新为 ${formatMoney(cents)}`,
      saved
        ? remaining < 0
          ? `当前已超支 ${formatMoney(-remaining)}`
          : `当前剩余可用 ${formatMoney(remaining)}`
        : "浏览器未允许保存，刷新后可能丢失"
    );
  }

  function toggleClearConfirm(force) {
    if (state.expenses.length === 0 && force !== false) {
      return;
    }
    const shouldOpen = typeof force === "boolean" ? force : els.clearConfirm.hidden;
    els.clearConfirm.hidden = !shouldOpen;
    els.clearRow.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
    if (shouldOpen) {
      window.setTimeout(() => els.cancelClearBtn.focus({ preventScroll: true }), 60);
      els.clearConfirm.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function clearAllExpenses() {
    const count = state.expenses.length;
    if (!count) return;
    state.expenses = [];
    const saved = persist();
    closeSheet();
    renderAll();
    showToast(
      "支出记录已清空",
      saved ? `${count} 笔记录已删除，初始金额保留` : "未能写入本机存储，刷新后可能恢复"
    );
  }

  function exportCsv() {
    if (!state.expenses.length) return;
    const sorted = [...state.expenses].sort(
      (a, b) => new Date(a.occurredAt) - new Date(b.occurredAt)
    );
    let running = state.initialCents || 0;
    const rows = [["时间", "分类", "备注", "金额（元）", "记账后余额（元）"]];
    sorted.forEach((expense) => {
      running -= expense.amountCents;
      const date = new Date(expense.occurredAt);
      const category = CATEGORY_MAP.get(expense.category) || CATEGORY_MAP.get("other");
      rows.push([
        `${dateKey(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
        category.name,
        expense.note,
        (expense.amountCents / 100).toFixed(2),
        (running / 100).toFixed(2)
      ]);
    });

    const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `余记账单_${dateKey(new Date())}.csv`;
    anchor.style.display = "none";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);

    const small = els.exportBtn.querySelector(".setting-copy small");
    const original = "下载 CSV，可用表格软件打开";
    small.textContent = `已导出 ${sorted.length} 笔，请查看下载`;
    window.clearTimeout(exportLabelTimer);
    exportLabelTimer = window.setTimeout(() => {
      small.textContent = original;
    }, 3200);
  }

  function csvCell(value) {
    let text = String(value == null ? "" : value);
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  /* Sheet management ----------------------------------------------------- */

  function openSheet(sheet, trigger) {
    if (!sheet) return;
    window.clearTimeout(sheetHideTimer);
    if (activeSheet && activeSheet !== sheet) {
      activeSheet.hidden = true;
      activeSheet.classList.remove("is-active");
    }
    sheetTrigger = trigger || document.activeElement;
    activeSheet = sheet;
    sheet.hidden = false;
    sheet.tabIndex = -1;
    sheet.scrollTop = 0;
    sheet.classList.remove("is-active");
    els.sheetLayer.classList.add("is-open");
    els.sheetLayer.removeAttribute("inert");
    els.sheetLayer.setAttribute("aria-hidden", "false");
    els.app.inert = true;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (activeSheet === sheet) sheet.classList.add("is-active");
      });
    });
    window.setTimeout(() => {
      if (activeSheet === sheet) sheet.focus({ preventScroll: true });
    }, 90);
  }

  function closeSheet(options = {}) {
    if (!activeSheet) return;
    const closing = activeSheet;
    const restoreFocus = options.restoreFocus !== false;
    activeSheet = null;
    editingExpenseId = null;
    resetDeleteButton();
    closing.classList.remove("is-active");
    els.sheetLayer.classList.remove("is-open");
    els.sheetLayer.setAttribute("aria-hidden", "true");
    els.sheetLayer.setAttribute("inert", "");
    els.app.inert = false;
    window.clearTimeout(sheetHideTimer);
    sheetHideTimer = window.setTimeout(() => {
      if (activeSheet !== closing) closing.hidden = true;
    }, 340);
    const trigger = sheetTrigger;
    sheetTrigger = null;
    if (restoreFocus && trigger instanceof HTMLElement && trigger.isConnected) {
      window.setTimeout(() => trigger.focus({ preventScroll: true }), 60);
    }
  }

  function handleGlobalKeydown(event) {
    if (event.key === "Escape") {
      if (activeSheet) {
        event.preventDefault();
        closeSheet();
      }
      return;
    }
    if (event.key !== "Tab") return;
    if (activeSheet) {
      trapFocus(event, activeSheet);
    } else if (welcomeOpen) {
      trapFocus(event, els.welcomeCard);
    }
  }

  function trapFocus(event, container) {
    const focusable = Array.from(
      container.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => element.getClientRects().length > 0 || element === document.activeElement);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey) {
      if (document.activeElement === first || document.activeElement === container) {
        event.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* Feedback ------------------------------------------------------------- */

  function showToast(title, body) {
    window.clearTimeout(toastTimer);
    els.toastTitle.textContent = title;
    els.toastBody.textContent = body || "";
    els.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(hideToast, 4600);
  }

  function hideToast() {
    window.clearTimeout(toastTimer);
    els.toast.classList.remove("is-visible");
  }

  /* Date and format helpers --------------------------------------------- */

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function currentMonthExpenses() {
    const now = new Date();
    return state.expenses.filter((expense) => {
      const date = new Date(expense.occurredAt);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function toDateTimeInput(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(
      date.getHours()
    )}:${pad2(date.getMinutes())}`;
  }

  function relativeDateLabel(date) {
    const now = new Date();
    const key = dateKey(date);
    if (key === dateKey(now)) return `今天 · ${date.getMonth() + 1}月${date.getDate()}日`;
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (key === dateKey(yesterday)) return `昨天 · ${date.getMonth() + 1}月${date.getDate()}日`;
    const yearPrefix = date.getFullYear() === now.getFullYear() ? "" : `${date.getFullYear()}年`;
    return `${yearPrefix}${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`;
  }

  function fullDateLabel(date) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${
      WEEKDAYS[date.getDay()]
    }`;
  }

  function formatMoneyCompact(cents) {
    const yuan = cents / 100;
    if (yuan >= 100000000) return `¥${(yuan / 100000000).toFixed(1).replace(/\.0$/, "")}亿`;
    if (yuan >= 10000) {
      const value = yuan / 10000;
      return `¥${value >= 100 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, "")}万`;
    }
    return `¥${moneyFormatter.format(yuan)}`;
  }

  function formatSharePercent(amount, total) {
    if (!total) return "0%";
    const percent = (amount / total) * 100;
    if (percent > 0 && percent < 1) return "<1%";
    if (percent >= 10) return `${Math.round(percent)}%`;
    return `${percent.toFixed(1).replace(/\.0$/, "")}%`;
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "http:" && location.protocol !== "https:") return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // Offline support is optional; the ledger remains fully usable.
      });
    });
  }
})();
