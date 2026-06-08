const contentPath = "content/site.json";

const pageMap = [
  { key: "index", file: "index.html", label: "Domov" },
  { key: "maske", file: "maske.html", label: "Maske" },
  { key: "videi", file: "videi.html", label: "Videi" },
  { key: "test", file: "test.html", label: "Naroči test" },
  { key: "kontakt", file: "kontakt.html", label: "Kontakt" },
  { key: "cleanspace_work", file: "cleanspace-work.html", label: "CleanSpace WORK" },
  { key: "cleanspace_cst_pro", file: "cleanspace-cst-pro.html", label: "CleanSpace CST PRO" },
  { key: "cleanspace_cst_ultra", file: "cleanspace-cst-ultra.html", label: "CleanSpace CST ULTRA" },
  { key: "cleanspace_ex", file: "cleanspace-ex.html", label: "CleanSpace EX" },
  { key: "cleanspace_halo", file: "cleanspace-halo.html", label: "CleanSpace HALO" },
];

const elements = {
  loginForm: document.querySelector("[data-login-form]"),
  username: document.querySelector("[data-username]"),
  password: document.querySelector("[data-password]"),
  logout: document.querySelector("[data-logout]"),
  saveGithub: document.querySelector("[data-save-github]"),
  pageSelect: document.querySelector("[data-page-select]"),
  customTitle: document.querySelector("[data-custom-title]"),
  customText: document.querySelector("[data-custom-text]"),
  customAdd: document.querySelector("[data-custom-add]"),
  customList: document.querySelector("[data-custom-list]"),
  fieldList: document.querySelector("[data-field-list]"),
  preview: document.querySelector("[data-preview]"),
  status: document.querySelector("[data-status]"),
  currentPage: document.querySelector("[data-current-page]"),
  styleLabel: document.querySelector("[data-active-style-label]"),
  styleColor: document.querySelector("[data-style-color]"),
  styleFontSize: document.querySelector("[data-style-font-size]"),
  styleFontFamily: document.querySelector("[data-style-font-family]"),
  styleX: document.querySelector("[data-style-x]"),
  styleY: document.querySelector("[data-style-y]"),
  styleReset: document.querySelector("[data-style-reset]"),
  customColor: document.querySelector("[data-custom-color]"),
  imageLabel: document.querySelector("[data-active-image-label]"),
  imageSrc: document.querySelector("[data-image-src]"),
  imageAlt: document.querySelector("[data-image-alt]"),
  imageReset: document.querySelector("[data-image-reset]"),
  videoManager: document.querySelector("[data-video-manager]"),
  videoMask: document.querySelector("[data-video-mask]"),
  videoTitle: document.querySelector("[data-video-title]"),
  videoUrl: document.querySelector("[data-video-url]"),
  videoDescription: document.querySelector("[data-video-description]"),
  videoAdd: document.querySelector("[data-video-add]"),
  videoList: document.querySelector("[data-video-list]"),
};

let content = null;
let selectedPage = pageMap[0];
let dirty = false;
let activeKey = "";
let activeImageKey = "";
let authenticated = false;
let pendingCustomBlockId = "";

const videoMasks = [
  { value: "work", label: "CleanSpace WORK" },
  { value: "cst-pro", label: "CleanSpace CST PRO" },
  { value: "cst-ultra", label: "CleanSpace CST ULTRA" },
  { value: "ex", label: "CleanSpace EX" },
  { value: "halo", label: "CleanSpace HALO" },
];

const setStatus = (message, type = "") => {
  elements.status.textContent = message;
  elements.status.className = `status${type ? ` is-${type}` : ""}`;
};

const truncate = (text, length = 92) => {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > length ? `${normalized.slice(0, length - 1)}...` : normalized;
};

const cleanText = (text = "") => text.replace(/\s+/g, " ").trim();

const makeCustomBlockId = () =>
  `block-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const ensureCustomBlockId = (block) => {
  const current = String(block.id || "");
  if (/^[a-zA-Z0-9_-]+$/.test(current)) return current;
  block.id = makeCustomBlockId();
  return block.id;
};

const customBlocksForPage = () => {
  if (!content) return [];
  content.customBlocks =
    content.customBlocks && typeof content.customBlocks === "object" && !Array.isArray(content.customBlocks)
      ? content.customBlocks
      : {};
  content.customBlocks[selectedPage.key] = Array.isArray(content.customBlocks[selectedPage.key])
    ? content.customBlocks[selectedPage.key]
    : [];
  return content.customBlocks[selectedPage.key];
};

const findCustomBlock = (id) => customBlocksForPage().find((block) => block.id === id);

const customBlockEntries = () =>
  customBlocksForPage().flatMap((block, index) => {
    const id = ensureCustomBlockId(block);
    const labelBase = `Okvir ${index + 1}`;

    return [
      {
        label: `${labelBase} - naslov`,
        selector: `[data-custom-block="${id}"] h2`,
        text: block.title || "",
        style: block.titleStyle,
        customBlockId: id,
        customBlockField: "title",
        customBlockStyleField: "titleStyle",
      },
      {
        label: `${labelBase} - besedilo`,
        selector: `[data-custom-block="${id}"] p`,
        text: block.text || "",
        style: block.textStyle,
        customBlockId: id,
        customBlockField: "text",
        customBlockStyleField: "textStyle",
      },
    ];
  });

const pageEntries = () =>
  content ? [...(content.common || []), ...(content[selectedPage.key] || []), ...customBlockEntries()] : [];

const getPageSpecificEntries = () => {
  if (!content) return [];
  content[selectedPage.key] = content[selectedPage.key] || [];
  return content[selectedPage.key];
};

const videoEntries = () => {
  if (!content) return [];
  content.videos = Array.isArray(content.videos) ? content.videos : [];
  return content.videos;
};

const imageEntries = () => {
  if (!content) return [];
  content.images = content.images && typeof content.images === "object" ? content.images : {};
  content.images[selectedPage.key] = Array.isArray(content.images[selectedPage.key])
    ? content.images[selectedPage.key]
    : [];
  return content.images[selectedPage.key];
};

const normalizeVideoUrl = (value = "") => {
  const iframeMatch = value.match(/src=["']([^"']+)["']/i);
  return (iframeMatch ? iframeMatch[1] : value).trim();
};

const videoMaskLabel = (value) =>
  videoMasks.find((mask) => mask.value === value)?.label || "CleanSpace";

const editableTextSelectors = [
  "header .site-nav a",
  "main h1",
  "main h2",
  "main h3",
  "main h4",
  "main p",
  "main a",
  "main button",
  "main li",
  "main figcaption",
  "main .tag",
  "main .pill",
  "main .button",
  "main .panel-label",
  "footer strong",
  "footer p",
  "footer a",
];

const selectorClassBlocklist = new Set([
  "reveal",
  "is-visible",
  "editor-active",
  "button",
  "primary",
  "ghost",
  "yes",
  "no",
]);

const escapeCss = (value) => {
  if (window.CSS?.escape) return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
};

const selectorForElement = (element) => {
  const parts = [];
  let node = element;

  while (node && node.nodeType === 1 && node.tagName.toLowerCase() !== "body") {
    const tag = node.tagName.toLowerCase();
    const parent = node.parentElement;
    if (!parent) break;

    const usefulClasses = [...node.classList]
      .filter((className) => !selectorClassBlocklist.has(className))
      .slice(0, 2);
    const classPart = usefulClasses.length
      ? `.${usefulClasses.map((className) => escapeCss(className)).join(".")}`
      : "";
    const sameTagSiblings = [...parent.children].filter((child) => child.tagName === node.tagName);
    const nthPart =
      sameTagSiblings.length > 1 ? `:nth-of-type(${sameTagSiblings.indexOf(node) + 1})` : "";

    parts.unshift(`${tag}${classPart}${nthPart}`);

    if (["header", "main", "footer"].includes(tag)) break;
    node = parent;
  }

  return parts.join(" > ");
};

const isVisibleTextElement = (element) => {
  const text = cleanText(element.textContent || "");
  if (!text || text.length > 720) return false;
  if (element.closest("script, style, noscript, template")) return false;
  if (element.querySelector("input, textarea, select, iframe, video")) return false;

  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
};

const discoverEditableTexts = (doc) => {
  const managedElements = new Set(
    pageEntries()
      .filter((entry) => entry.selector && !entry.attribute)
      .map((entry) => doc.querySelector(entry.selector))
      .filter(Boolean)
  );
  const entries = getPageSpecificEntries();

  doc.querySelectorAll(editableTextSelectors.join(",")).forEach((element) => {
    if (managedElements.has(element) || !isVisibleTextElement(element)) return;

    const selector = selectorForElement(element);
    if (!selector || doc.querySelector(selector) !== element) return;

    const text = cleanText(element.textContent || "");
    entries.push({
      label: `Besedilo - ${truncate(text, 42)}`,
      selector,
      text,
    });
    managedElements.add(element);
  });
};

const isVisibleImageElement = (element) => {
  if (!element.getAttribute("src")) return false;
  if (element.closest("script, style, noscript, template")) return false;

  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
};

const discoverEditableImages = (doc) => {
  const managedElements = new Set(
    imageEntries()
      .filter((entry) => entry.selector)
      .map((entry) => doc.querySelector(entry.selector))
      .filter(Boolean)
  );
  const entries = imageEntries();

  doc.querySelectorAll("header img, main img, footer img").forEach((element) => {
    if (managedElements.has(element) || !isVisibleImageElement(element)) return;

    const selector = selectorForElement(element);
    if (!selector || doc.querySelector(selector) !== element) return;

    const src = element.getAttribute("src") || "";
    const alt = element.getAttribute("alt") || "";
    entries.push({
      label: `Slika - ${truncate(alt || src, 42)}`,
      selector,
      src,
      alt,
    });
    managedElements.add(element);
  });
};

const markDirty = () => {
  dirty = true;
  setStatus("Sprememba je pripravljena. Ko končaš, klikni Shrani spremembe.");
};

const renderVideoManager = () => {
  if (!elements.videoManager || !elements.videoList || !content) return;

  const isVideoPage = selectedPage.key === "videi";
  elements.videoManager.hidden = !isVideoPage;
  if (!isVideoPage) return;

  const videos = videoEntries();
  elements.videoList.textContent = "";

  if (!videos.length) {
    const empty = document.createElement("p");
    empty.className = "video-admin-empty";
    empty.textContent = "Ni dodanih videov.";
    elements.videoList.append(empty);
    return;
  }

  videos.forEach((video, index) => {
    const item = document.createElement("div");
    item.className = "video-admin-item";

    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = video.title || "Video brez naslova";
    const meta = document.createElement("span");
    meta.textContent = `${videoMaskLabel(video.mask)} - ${truncate(video.url || "", 52)}`;
    copy.append(title, meta);

    const deleteButton = document.createElement("button");
    deleteButton.className = "secondary light";
    deleteButton.type = "button";
    deleteButton.textContent = "Izbriši";
    deleteButton.addEventListener("click", () => {
      videos.splice(index, 1);
      markDirty();
      renderVideoManager();
      loadPreview();
    });

    item.append(copy, deleteButton);
    elements.videoList.append(item);
  });
};

const addVideo = () => {
  if (!content) return;

  const url = normalizeVideoUrl(elements.videoUrl.value);
  if (!url) {
    setStatus("Dodaj video link ali embed kodo.", "error");
    return;
  }

  videoEntries().push({
    id: window.crypto?.randomUUID?.() || `video-${Date.now()}`,
    mask: elements.videoMask.value,
    title: elements.videoTitle.value.trim() || videoMaskLabel(elements.videoMask.value),
    description: elements.videoDescription.value.trim(),
    url,
  });

  elements.videoTitle.value = "";
  elements.videoUrl.value = "";
  elements.videoDescription.value = "";
  markDirty();
  renderVideoManager();
  loadPreview();
};

const renderCustomBlockManager = () => {
  if (!elements.customList || !content) return;

  const blocks = customBlocksForPage();
  elements.customList.textContent = "";

  if (!blocks.length) {
    const empty = document.createElement("p");
    empty.className = "custom-admin-empty";
    empty.textContent = "Na tej strani še ni dodatnih okvirjev.";
    elements.customList.append(empty);
    return;
  }

  blocks.forEach((block, index) => {
    const item = document.createElement("div");
    item.className = "custom-admin-item";

    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = block.title || `Okvir ${index + 1}`;
    const text = document.createElement("span");
    text.textContent = truncate(block.text || "Brez besedila.", 58);
    copy.append(title, text);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "secondary light";
    deleteButton.textContent = "Odstrani";
    deleteButton.addEventListener("click", () => {
      blocks.splice(index, 1);
      activeKey = "";
      markDirty();
      renderCustomBlockManager();
      loadPreview();
    });

    item.append(copy, deleteButton);
    elements.customList.append(item);
  });
};

const addCustomBlock = () => {
  if (!content) return;

  const title = elements.customTitle.value.trim() || "Nov besedilni okvir";
  const text = elements.customText.value.trim() || "Vpiši dodatno besedilo za ta okvir.";
  const color = elements.customColor.value || "#01457e";
  const id = makeCustomBlockId();

  customBlocksForPage().push({
    id,
    title,
    text,
    titleStyle: { color },
    textStyle: { color },
  });

  elements.customTitle.value = "";
  elements.customText.value = "";
  activeKey = "";
  pendingCustomBlockId = id;
  markDirty();
  renderCustomBlockManager();
  loadPreview();
};

const renderFields = () => {
  elements.fieldList.textContent = "";

  pageEntries().forEach((entry, index) => {
    const key = `${entry.selector}|${index}`;
    const card = document.createElement("button");
    card.type = "button";
    card.className = `field-card${activeKey === key ? " is-active" : ""}`;
    card.innerHTML = `<strong>${entry.label || "Besedilo"}</strong><span>${truncate(entry.text || "")}</span>`;
    card.addEventListener("click", () => focusEditable(key));
    elements.fieldList.append(card);
  });
};

const findEntryByKey = (key) => {
  if (!key) return null;
  const entries = pageEntries();
  const indexText = key.split("|").pop();
  if (indexText === "") return null;
  const index = Number(indexText);
  if (Number.isNaN(index)) return null;
  return entries[index] || null;
};

const getEntryStyle = (entry) => {
  if (!entry) return {};
  if (!entry.customBlockId) return entry.style || {};

  const block = findCustomBlock(entry.customBlockId);
  return block?.[entry.customBlockStyleField] || {};
};

const ensureEntryStyle = (entry) => {
  if (!entry) return {};
  if (!entry.customBlockId) {
    entry.style = entry.style || {};
    return entry.style;
  }

  const block = findCustomBlock(entry.customBlockId);
  if (!block) return {};
  block[entry.customBlockStyleField] = block[entry.customBlockStyleField] || {};
  entry.style = block[entry.customBlockStyleField];
  return block[entry.customBlockStyleField];
};

const clearEntryStyle = (entry) => {
  if (!entry) return;

  if (entry.customBlockId) {
    const block = findCustomBlock(entry.customBlockId);
    if (block) delete block[entry.customBlockStyleField];
    delete entry.style;
    return;
  }

  delete entry.style;
};

const setEntryText = (entry, text) => {
  if (!entry) return;

  if (entry.customBlockId) {
    const block = findCustomBlock(entry.customBlockId);
    if (block) block[entry.customBlockField] = text;
  }

  entry.text = text;
};

const activeEntry = () => findEntryByKey(activeKey);

const activeEditable = () => {
  const doc = elements.preview.contentDocument;
  if (!doc || !activeKey) return null;
  return doc.querySelector(`[data-editor-key="${CSS.escape(activeKey)}"]`);
};

const findImageEntryByKey = (key) => {
  if (!key) return null;
  const indexText = key.split("|").pop();
  if (indexText === "") return null;
  const index = Number(indexText);
  if (Number.isNaN(index)) return null;
  return imageEntries()[index] || null;
};

const activeImageEntry = () => findImageEntryByKey(activeImageKey);

const activeImage = () => {
  const doc = elements.preview.contentDocument;
  if (!doc || !activeImageKey) return null;
  return doc.querySelector(`[data-image-key="${CSS.escape(activeImageKey)}"]`);
};

const applyImageEntryToTarget = (target, entry = {}) => {
  if (!target) return;

  if (entry.src) {
    target.src = entry.src;
    target.setAttribute("src", entry.src);
  }

  if (typeof entry.alt === "string") {
    target.alt = entry.alt;
    target.setAttribute("alt", entry.alt);
  }
};

const updateImageControls = () => {
  const entry = activeImageEntry();
  const disabled = !entry;

  [elements.imageSrc, elements.imageAlt, elements.imageReset].forEach((control) => {
    control.disabled = disabled;
  });

  elements.imageLabel.textContent = entry
    ? entry.label || truncate(entry.alt || entry.src || "", 44)
    : "Najprej klikni sliko v predogledu.";
  elements.imageSrc.value = entry?.src || "";
  elements.imageAlt.value = entry?.alt || "";
};

const setImageEntryValue = (property, value) => {
  const entry = activeImageEntry();
  if (!entry) return;

  entry[property] = value.trim();
  applyImageEntryToTarget(activeImage(), entry);
  markDirty();
  updateImageControls();
};

const applyEntryStyleToTarget = (target, style = {}) => {
  if (!target) return;

  target.style.color = style.color || "";
  target.style.fontSize = style.fontSize ? `${Number(style.fontSize)}px` : "";
  target.style.fontFamily = style.fontFamily || "";

  const hasMove = style.x !== undefined || style.y !== undefined;
  const x = Number(style.x) || 0;
  const y = Number(style.y) || 0;

  target.style.left = hasMove && x ? `${x}px` : "";
  target.style.top = hasMove && y ? `${y}px` : "";

  if (hasMove && (x || y)) {
    target.style.position = "relative";
  }
};

const updateStyleControls = () => {
  const entry = activeEntry();
  const style = getEntryStyle(entry);
  const disabled = !entry;

  [elements.styleColor, elements.styleFontSize, elements.styleFontFamily, elements.styleX, elements.styleY, elements.styleReset].forEach(
    (control) => {
      control.disabled = disabled;
    }
  );

  elements.styleLabel.textContent = entry
    ? entry.label || truncate(entry.text || "", 44)
    : "Najprej klikni besedilo v predogledu.";
  elements.styleColor.value = style.color || "#01457e";
  elements.styleFontSize.value = style.fontSize || "";
  elements.styleFontFamily.value = style.fontFamily || "";
  elements.styleX.value = style.x ?? "";
  elements.styleY.value = style.y ?? "";
};

const setEntryStyleValue = (property, value) => {
  const entry = activeEntry();
  if (!entry) return;

  const style = ensureEntryStyle(entry);

  if (value === "") {
    delete style[property];
  } else if (property === "fontFamily" || property === "color") {
    style[property] = value;
  } else {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return;
    style[property] = numericValue;
  }

  if (!Object.keys(style).length) {
    clearEntryStyle(entry);
  }

  applyEntryStyleToTarget(activeEditable(), getEntryStyle(entry));
  markDirty();
  updateStyleControls();
};

const updateEntryText = (key, value) => {
  const entry = findEntryByKey(key);
  if (!entry) return;
  const nextText = cleanText(value);
  if (entry.text === nextText) return;
  setEntryText(entry, nextText);
  markDirty();
  renderFields();
};

const syncPreviewTexts = () => {
  const doc = elements.preview.contentDocument;
  if (!doc) return;

  let changed = false;

  doc.querySelectorAll("[data-editor-key]").forEach((editable) => {
    const entry = findEntryByKey(editable.dataset.editorKey || "");
    if (!entry) return;

    const nextText = cleanText(editable.textContent || "");
    if (entry.text === nextText) return;

    setEntryText(entry, nextText);
    changed = true;
  });

  if (changed) {
    dirty = true;
    renderFields();
  }
};

const injectEditorStyles = (doc) => {
  const style = doc.createElement("style");
  style.textContent = `
    [data-editor-key] {
      outline: 3px solid rgba(1, 69, 126, 0.55) !important;
      outline-offset: 4px !important;
      cursor: text !important;
    }
    [data-editor-key]:hover,
    [data-editor-key].editor-active {
      outline-color: rgba(220, 165, 95, 0.95) !important;
      box-shadow: 0 0 0 6px rgba(220, 165, 95, 0.16) !important;
    }
    [data-image-key] {
      outline: 3px solid rgba(6, 79, 62, 0.62) !important;
      outline-offset: 4px !important;
      cursor: pointer !important;
    }
    [data-image-key]:hover,
    [data-image-key].editor-active-image {
      outline-color: rgba(220, 165, 95, 0.95) !important;
      box-shadow: 0 0 0 6px rgba(220, 165, 95, 0.18) !important;
    }
  `;
  doc.head.append(style);
};

const preventPreviewNavigation = (doc) => {
  doc.addEventListener(
    "click",
    (event) => {
      const image = event.target.closest("[data-image-key]");
      const editable = event.target.closest("[data-editor-key]");
      const interactive = event.target.closest("a, button, [data-card-link]");

      if (image) {
        event.preventDefault();
        event.stopPropagation();
        focusImage(image.dataset.imageKey || "");
        return;
      }

      if (editable) {
        event.preventDefault();
        event.stopPropagation();
        focusEditable(editable.dataset.editorKey || "");
        return;
      }

      if (interactive) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );
};

const focusImage = (key) => {
  const doc = elements.preview.contentDocument;
  if (!doc) return;

  doc
    .querySelectorAll(".editor-active-image")
    .forEach((node) => node.classList.remove("editor-active-image"));
  const image = doc.querySelector(`[data-image-key="${CSS.escape(key)}"]`);

  if (image) {
    activeImageKey = key;
    activeKey = "";
    image.classList.add("editor-active-image");
    image.scrollIntoView({ block: "center", behavior: "smooth" });
    renderFields();
    updateStyleControls();
    updateImageControls();
  }
};

const focusEditable = (key) => {
  const doc = elements.preview.contentDocument;
  if (!doc) return;

  doc.querySelectorAll(".editor-active").forEach((node) => node.classList.remove("editor-active"));
  doc
    .querySelectorAll(".editor-active-image")
    .forEach((node) => node.classList.remove("editor-active-image"));
  const editable = doc.querySelector(`[data-editor-key="${CSS.escape(key)}"]`);

  if (editable) {
    activeKey = key;
    activeImageKey = "";
    editable.classList.add("editor-active");
    editable.scrollIntoView({ block: "center", behavior: "smooth" });
    editable.focus();
    renderFields();
    updateImageControls();
  }
};

const injectCustomBlocksIntoPreview = (doc) => {
  const main = doc.querySelector("main");
  if (!main) return;

  const blocks = customBlocksForPage();
  const validIds = new Set(blocks.map((block) => ensureCustomBlockId(block)));

  doc.querySelectorAll("[data-custom-block]").forEach((blockElement) => {
    if (!validIds.has(blockElement.getAttribute("data-custom-block") || "")) {
      blockElement.remove();
    }
  });

  let section = doc.querySelector("[data-custom-blocks]");
  if (!blocks.length) {
    section?.remove();
    return;
  }

  if (!section) {
    section = doc.createElement("section");
    section.className = "section custom-content-section";
    section.setAttribute("data-custom-blocks", "");
    main.append(section);
  }

  let grid = section.querySelector(".custom-content-grid");
  if (!grid) {
    grid = doc.createElement("div");
    grid.className = "custom-content-grid";
    section.append(grid);
  }

  blocks.forEach((block, index) => {
    const id = ensureCustomBlockId(block);
    let article = doc.querySelector(`[data-custom-block="${id}"]`);

    if (!article) {
      article = doc.createElement("article");
      article.className = "custom-text-card reveal is-visible";
      article.setAttribute("data-custom-block", id);
      grid.append(article);
    }

    let title = article.querySelector("h2");
    if (!title) {
      title = doc.createElement("h2");
      article.prepend(title);
    }

    let text = article.querySelector("p");
    if (!text) {
      text = doc.createElement("p");
      article.append(text);
    }

    title.textContent = block.title || `Okvir ${index + 1}`;
    text.textContent = block.text || "Vpiši dodatno besedilo za ta okvir.";
    applyEntryStyleToTarget(title, block.titleStyle);
    applyEntryStyleToTarget(text, block.textStyle);
  });
};

const preparePreview = () => {
  const doc = elements.preview.contentDocument;
  if (!doc || !content) return;

  injectCustomBlocksIntoPreview(doc);
  injectEditorStyles(doc);
  preventPreviewNavigation(doc);
  discoverEditableTexts(doc);
  discoverEditableImages(doc);
  renderFields();

  pageEntries().forEach((entry, index) => {
    if (!entry.selector || typeof entry.text !== "string" || entry.attribute) return;
    const key = `${entry.selector}|${index}`;
    const target = doc.querySelector(entry.selector);
    if (!target) return;

    target.dataset.editorKey = key;
    target.contentEditable = "true";
    target.spellcheck = true;
    applyEntryStyleToTarget(target, entry.style);

    const activateTarget = () => {
      activeKey = key;
      activeImageKey = "";
      doc.querySelectorAll(".editor-active").forEach((node) => node.classList.remove("editor-active"));
      doc
        .querySelectorAll(".editor-active-image")
        .forEach((node) => node.classList.remove("editor-active-image"));
      target.classList.add("editor-active");
      renderFields();
      updateStyleControls();
      updateImageControls();
    };

    target.addEventListener("focus", () => {
      activateTarget();
    });

    target.addEventListener("pointerdown", activateTarget, true);
    target.addEventListener("click", activateTarget, true);

    target.addEventListener("blur", () => {
      target.classList.remove("editor-active");
      updateEntryText(key, target.textContent);
      updateStyleControls();
    });

    target.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        target.blur();
      }
    });
  });

  imageEntries().forEach((entry, index) => {
    if (!entry.selector || typeof entry.src !== "string") return;
    const key = `${entry.selector}|${index}`;
    const target = doc.querySelector(entry.selector);
    if (!target) return;

    target.dataset.imageKey = key;
    target.tabIndex = 0;
    applyImageEntryToTarget(target, entry);

    target.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      focusImage(key);
    });
  });

  if (pendingCustomBlockId) {
    const block = doc.querySelector(`[data-custom-block="${CSS.escape(pendingCustomBlockId)}"]`);
    const title = block?.querySelector("h2");

    if (block) {
      block.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    if (title?.dataset.editorKey) {
      focusEditable(title.dataset.editorKey);
    }

    pendingCustomBlockId = "";
  }

  updateStyleControls();
  updateImageControls();
};

const loadPreview = () => {
  elements.currentPage.textContent = selectedPage.label;
  activeKey = "";
  activeImageKey = "";
  renderFields();
  updateStyleControls();
  updateImageControls();
  renderCustomBlockManager();
  renderVideoManager();
  elements.preview.src = `../${selectedPage.file}?editor=${Date.now()}`;
};

const loadContent = async () => {
  const sources = [`../api/content?updated=${Date.now()}`, `../${contentPath}?updated=${Date.now()}`];
  let loadedContent = null;

  for (const source of sources) {
    try {
      const response = await fetch(source);
      if (!response.ok) continue;
      loadedContent = JSON.parse((await response.text()).replace(/^\uFEFF/, ""));
      break;
    } catch (error) {
      // Fall back to the next source.
    }
  }

  if (!loadedContent) throw new Error("Ne morem naložiti vsebine strani.");
  content = loadedContent;
  content.common = content.common || [];
  content.customBlocks =
    content.customBlocks && typeof content.customBlocks === "object" && !Array.isArray(content.customBlocks)
      ? content.customBlocks
      : {};
  content.images = content.images && typeof content.images === "object" ? content.images : {};
  content.videos = Array.isArray(content.videos) ? content.videos : [];
  pageMap.forEach((page) => {
    content[page.key] = content[page.key] || [];
    content.customBlocks[page.key] = Array.isArray(content.customBlocks[page.key])
      ? content.customBlocks[page.key]
      : [];
    content.images[page.key] = Array.isArray(content.images[page.key])
      ? content.images[page.key]
      : [];
  });
};

const setAuthenticated = (isAuthenticated, username = "") => {
  authenticated = isAuthenticated;
  document.body.classList.toggle("is-authenticated", authenticated);

  if (authenticated) {
    setStatus(`Prijavljen kot ${username || "admin"}. Klikni besedilo v predogledu in ga popravi.`);
  } else {
    setStatus("Za urejanje se prijavi z admin računom.", "error");
  }
};

const checkSession = async () => {
  const response = await fetch("../api/session");
  const session = await response.json();
  setAuthenticated(Boolean(session.authenticated), session.username);
  return Boolean(session.authenticated);
};

const login = async () => {
  const response = await fetch("../api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: elements.username.value.trim(),
      password: elements.password.value,
    }),
  });
  const result = await response.json();

  if (!response.ok) {
    setStatus(result.message || "Prijava ni uspela.", "error");
    return false;
  }

  elements.password.value = "";
  setAuthenticated(true, result.username);

  if (!content) {
    await loadContent();
    loadPreview();
  }

  return true;
};

const logout = async () => {
  await fetch("../api/logout", { method: "POST" });
  setAuthenticated(false);
};

const saveToGithub = async () => {
  syncPreviewTexts();

  if (!authenticated) {
    setStatus("Najprej se prijavi z admin računom.", "error");
    return;
  }

  setStatus("Shranjujem spremembe...");

  const response = await fetch("../api/content", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const result = await response.json();

  if (!response.ok) {
    setStatus(result.message || "Shranjevanje ni uspelo.", "error");
    return;
  }

  dirty = false;
  setStatus(result.message || "Shranjeno. Stran je osvežena.", "success");
};

const init = async () => {
  const initialParams = new URLSearchParams(window.location.search);
  const requestedPage = initialParams.get("page");
  const requestedMask = initialParams.get("mask");

  pageMap.forEach((page) => {
    const option = document.createElement("option");
    option.value = page.key;
    option.textContent = page.label;
    elements.pageSelect.append(option);
  });

  videoMasks.forEach((mask) => {
    const option = document.createElement("option");
    option.value = mask.value;
    option.textContent = mask.label;
    elements.videoMask.append(option);
  });

  selectedPage = pageMap.find((page) => page.key === requestedPage) || selectedPage;
  elements.pageSelect.value = selectedPage.key;
  if (requestedMask && videoMasks.some((mask) => mask.value === requestedMask)) {
    elements.videoMask.value = requestedMask;
  }

  elements.pageSelect.addEventListener("change", () => {
    selectedPage = pageMap.find((page) => page.key === elements.pageSelect.value) || pageMap[0];
    loadPreview();
  });

  elements.preview.addEventListener("load", () => {
    window.setTimeout(preparePreview, 600);
  });

  elements.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await login();
  });

  elements.logout.addEventListener("click", logout);
  elements.saveGithub.addEventListener("click", saveToGithub);
  elements.videoAdd.addEventListener("click", addVideo);
  elements.customAdd.addEventListener("click", addCustomBlock);
  elements.styleColor.addEventListener("input", () => setEntryStyleValue("color", elements.styleColor.value));
  elements.imageSrc.addEventListener("input", () => setImageEntryValue("src", elements.imageSrc.value));
  elements.imageAlt.addEventListener("input", () => setImageEntryValue("alt", elements.imageAlt.value));
  elements.imageReset.addEventListener("click", () => {
    const indexText = activeImageKey.split("|").pop();
    const index = Number(indexText);
    if (Number.isNaN(index)) return;

    imageEntries().splice(index, 1);
    activeImageKey = "";
    markDirty();
    loadPreview();
    updateImageControls();
  });
  elements.styleFontSize.addEventListener("input", () =>
    setEntryStyleValue("fontSize", elements.styleFontSize.value)
  );
  elements.styleFontFamily.addEventListener("change", () =>
    setEntryStyleValue("fontFamily", elements.styleFontFamily.value)
  );
  elements.styleX.addEventListener("input", () => setEntryStyleValue("x", elements.styleX.value));
  elements.styleY.addEventListener("input", () => setEntryStyleValue("y", elements.styleY.value));
  elements.styleReset.addEventListener("click", () => {
    const entry = activeEntry();
    if (!entry) return;
    clearEntryStyle(entry);
    applyEntryStyleToTarget(activeEditable(), {});
    markDirty();
    updateStyleControls();
  });
  updateStyleControls();
  updateImageControls();

  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  try {
    const hasSession = await checkSession();

    if (hasSession) {
      await loadContent();
      selectedPage = pageMap.find((page) => page.key === requestedPage) || selectedPage;
      elements.pageSelect.value = selectedPage.key;
      loadPreview();
      setStatus("Klikni besedilo v predogledu, ga popravi in klikni Shrani spremembe.");
    }
  } catch (error) {
    setStatus(error.message || "Urejevalnika ni bilo mogoče zagnati.", "error");
  }
};

init();
