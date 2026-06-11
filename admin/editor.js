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
  blockList: document.querySelector("[data-block-list]"),
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
  styleBorderWidth: document.querySelector("[data-style-border-width]"),
  styleBorderColor: document.querySelector("[data-style-border-color]"),
  styleBorderRadius: document.querySelector("[data-style-border-radius]"),
  styleRemove: document.querySelector("[data-style-remove]"),
  styleReset: document.querySelector("[data-style-reset]"),
  customColor: document.querySelector("[data-custom-color]"),
  newImageSrc: document.querySelector("[data-new-image-src]"),
  newImageAlt: document.querySelector("[data-new-image-alt]"),
  newImageAdd: document.querySelector("[data-new-image-add]"),
  customImageList: document.querySelector("[data-custom-image-list]"),
  imageLabel: document.querySelector("[data-active-image-label]"),
  imageSrc: document.querySelector("[data-image-src]"),
  imageAlt: document.querySelector("[data-image-alt]"),
  imageWidth: document.querySelector("[data-image-width]"),
  imageX: document.querySelector("[data-image-x]"),
  imageY: document.querySelector("[data-image-y]"),
  imageBorderWidth: document.querySelector("[data-image-border-width]"),
  imageBorderColor: document.querySelector("[data-image-border-color]"),
  imageBorderRadius: document.querySelector("[data-image-border-radius]"),
  imageRemove: document.querySelector("[data-image-remove]"),
  imageReset: document.querySelector("[data-image-reset]"),
  mediaFile: document.querySelector("[data-media-file]"),
  mediaUpload: document.querySelector("[data-media-upload]"),
  mediaType: document.querySelector("[data-media-type]"),
  mediaTitle: document.querySelector("[data-media-title]"),
  mediaUrl: document.querySelector("[data-media-url]"),
  mediaDescription: document.querySelector("[data-media-description]"),
  mediaAdd: document.querySelector("[data-media-add]"),
  pageCss: document.querySelector("[data-page-css]"),
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
let pendingCustomImageId = "";
let pendingMediaBlockId = "";
let blockDragToken = "";

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
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  return normalized.length > length ? `${normalized.slice(0, length - 1)}...` : normalized;
};

const normalizeEditableText = (text = "") =>
  String(text || "")
    .replace(/\r/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const cleanText = (text = "") => normalizeEditableText(text).replace(/\n+/g, " ").trim();

const applyTextWithLineBreaks = (target, text = "") => {
  if (!target) return;
  target.textContent = text;
  target.style.whiteSpace = text.includes("\n") ? "pre-line" : "";
};

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
  content
    ? [...(content.common || []), ...(content[selectedPage.key] || []), ...customBlockEntries(), ...customMediaEntries()]
    : [];

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

const customImageEntries = () => imageEntries().filter((entry) => entry.customImage);

const selectorForCustomImage = (id) => `[data-custom-image="${id}"] img`;

const mediaBlocksForPage = () => {
  if (!content) return [];
  content.mediaBlocks =
    content.mediaBlocks && typeof content.mediaBlocks === "object" && !Array.isArray(content.mediaBlocks)
      ? content.mediaBlocks
      : {};
  content.mediaBlocks[selectedPage.key] = Array.isArray(content.mediaBlocks[selectedPage.key])
    ? content.mediaBlocks[selectedPage.key]
    : [];
  return content.mediaBlocks[selectedPage.key];
};

const ensureMediaBlockId = (block) => {
  const current = String(block?.id || "");
  if (/^[a-zA-Z0-9_-]+$/.test(current)) return current;
  block.id = makeCustomBlockId();
  return block.id;
};

const findMediaBlock = (id) => mediaBlocksForPage().find((block) => block.id === id);

const mediaSelector = (id, field) => `[data-custom-media="${id}"] ${field === "description" ? "p" : "h3"}`;

const customMediaEntries = () =>
  mediaBlocksForPage().flatMap((block, index) => {
    const id = ensureMediaBlockId(block);
    const labelBase = `Medij ${index + 1}`;

    return [
      {
        label: `${labelBase} - naslov`,
        selector: mediaSelector(id, "title"),
        text: block.title || "",
        mediaBlockId: id,
        mediaBlockField: "title",
        mediaBlockStyleField: "titleStyle",
        style: block.titleStyle,
      },
      {
        label: `${labelBase} - opis`,
        selector: mediaSelector(id, "description"),
        text: block.description || "",
        mediaBlockId: id,
        mediaBlockField: "description",
        mediaBlockStyleField: "descriptionStyle",
        style: block.descriptionStyle,
      },
    ];
  });

const pageCssForCurrentPage = () => {
  if (!content) return "";
  content.customCss =
    content.customCss && typeof content.customCss === "object" && !Array.isArray(content.customCss)
      ? content.customCss
      : {};
  if (typeof content.customCss[selectedPage.key] !== "string") {
    content.customCss[selectedPage.key] = "";
  }
  return content.customCss[selectedPage.key];
};

const setPageCssForCurrentPage = (value) => {
  if (!content) return;
  content.customCss =
    content.customCss && typeof content.customCss === "object" && !Array.isArray(content.customCss)
      ? content.customCss
      : {};
  content.customCss[selectedPage.key] = value;
};

const blockToken = (type, id) => `${type}:${id}`;

const parseBlockToken = (token) => {
  const [type, ...rest] = String(token || "").split(":");
  return { type, id: rest.join(":") };
};

const ensureBlockOrder = () => {
  if (!content) return [];

  content.blockOrder =
    content.blockOrder && typeof content.blockOrder === "object" && !Array.isArray(content.blockOrder)
      ? content.blockOrder
      : {};

  const tokens = [
    ...customBlocksForPage().map((block) => blockToken("text", ensureCustomBlockId(block))),
    ...customImageEntries().map((entry) => blockToken("image", entry.id || (entry.id = makeCustomBlockId()))),
    ...mediaBlocksForPage().map((block) => blockToken("media", ensureMediaBlockId(block))),
  ];
  const valid = new Set(tokens);
  const existing = Array.isArray(content.blockOrder[selectedPage.key]) ? content.blockOrder[selectedPage.key] : [];
  const normalized = [];

  existing.forEach((item) => {
    const token =
      typeof item === "string" ? item : item?.type && item?.id ? blockToken(item.type, item.id) : "";
    if (token && valid.has(token) && !normalized.includes(token)) {
      normalized.push(token);
    }
  });

  tokens.forEach((token) => {
    if (!normalized.includes(token)) normalized.push(token);
  });

  content.blockOrder[selectedPage.key] = normalized;
  return normalized;
};

const removeFromBlockOrder = (type, id) => {
  if (!content?.blockOrder?.[selectedPage.key]) return;
  const token = blockToken(type, id);
  content.blockOrder[selectedPage.key] = content.blockOrder[selectedPage.key].filter((entry) => entry !== token);
};

const orderedBlockItems = () => {
  const textMap = new Map(
    customBlocksForPage().map((block, index) => {
      const id = ensureCustomBlockId(block);
      return [
        blockToken("text", id),
        {
          type: "text",
          id,
          title: block.title || `Okvir ${index + 1}`,
          description: truncate(block.text || "Brez besedila.", 72),
          raw: block,
        },
      ];
    })
  );
  const imageMap = new Map(
    customImageEntries().map((entry, index) => [
      blockToken("image", entry.id || (entry.id = makeCustomBlockId())),
      {
        type: "image",
        id: entry.id,
        title: entry.alt || `Slika ${index + 1}`,
        description: truncate(entry.src || "", 72),
        raw: entry,
      },
    ])
  );
  const mediaMap = new Map(
    mediaBlocksForPage().map((block, index) => {
      const id = ensureMediaBlockId(block);
      return [
        blockToken("media", id),
        {
          type: "media",
          id,
          title: block.title || `Medij ${index + 1}`,
          description: truncate(block.description || block.url || "", 72),
          mediaType: block.type || "document",
          raw: block,
        },
      ];
    })
  );
  const all = new Map([...textMap, ...imageMap, ...mediaMap]);
  return ensureBlockOrder()
    .map((token) => ({ token, ...all.get(token) }))
    .filter((item) => item?.type);
};

const normalizeVideoUrl = (value = "") => {
  const iframeMatch = value.match(/src=["']([^"']+)["']/i);
  return (iframeMatch ? iframeMatch[1] : value).trim();
};

const mediaEmbedInfo = (type = "document", rawUrl = "") => {
  const normalizedUrl = normalizeVideoUrl(rawUrl);
  const mediaType = type || "document";

  try {
    const url = new URL(normalizedUrl, window.location.origin);
    const host = url.hostname.replace(/^www\./, "");

    if (mediaType === "image") return { type: "image", src: url.href };
    if (mediaType === "audio") return { type: "audio", src: url.href };

    if (mediaType === "video") {
      if (host === "youtu.be") {
        return { type: "iframe", src: `https://www.youtube.com/embed/${url.pathname.replace("/", "")}` };
      }

      if (host.includes("youtube.com")) {
        const videoId = url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop();
        if (videoId) return { type: "iframe", src: `https://www.youtube.com/embed/${videoId}` };
      }

      if (host.includes("vimeo.com")) {
        const videoId = url.pathname.split("/").filter(Boolean).pop();
        if (videoId) return { type: "iframe", src: `https://player.vimeo.com/video/${videoId}` };
      }

      if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url.pathname)) {
        return { type: "video", src: url.href };
      }
    }

    return { type: "link", src: url.href };
  } catch (error) {
    if (mediaType === "image") return { type: "image", src: normalizedUrl };
    if (mediaType === "audio") return { type: "audio", src: normalizedUrl };
    if (mediaType === "video") return { type: "video", src: normalizedUrl };
    return { type: "link", src: normalizedUrl };
  }
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

const renderCustomImageManager = () => {
  if (!elements.customImageList || !content) return;

  const images = customImageEntries();
  elements.customImageList.textContent = "";

  if (!images.length) {
    const empty = document.createElement("p");
    empty.className = "custom-admin-empty";
    empty.textContent = "Na tej strani še ni dodanih slik.";
    elements.customImageList.append(empty);
    return;
  }

  images.forEach((image) => {
    const item = document.createElement("div");
    item.className = "custom-admin-item";

    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = image.alt || "Dodana slika";
    const url = document.createElement("span");
    url.textContent = truncate(image.src || "", 58);
    copy.append(title, url);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "secondary light";
    deleteButton.textContent = "Odstrani";
    deleteButton.addEventListener("click", () => {
      const index = imageEntries().indexOf(image);
      if (index >= 0) imageEntries().splice(index, 1);
      removeFromBlockOrder("image", image.id);
      activeImageKey = "";
      markDirty();
      renderBlockList();
      renderCustomImageManager();
      loadPreview();
    });

    item.append(copy, deleteButton);
    elements.customImageList.append(item);
  });
};

const addCustomImage = () => {
  if (!content) return;

  const src = elements.newImageSrc.value.trim();
  if (!src) {
    setStatus("Najprej vpiši URL slike.", "error");
    return;
  }

  const alt = elements.newImageAlt.value.trim() || "Dodana slika";
  const id = makeCustomBlockId();

  imageEntries().push({
    id,
    customImage: true,
    label: `Dodana slika - ${truncate(alt, 36)}`,
    selector: selectorForCustomImage(id),
    src,
    alt,
    style: {
      width: 520,
    },
  });

  elements.newImageSrc.value = "";
  elements.newImageAlt.value = "";
  activeImageKey = "";
  pendingCustomImageId = id;
  markDirty();
  ensureBlockOrder();
  renderBlockList();
  renderCustomImageManager();
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
      removeFromBlockOrder("text", ensureCustomBlockId(block));
      activeKey = "";
      markDirty();
      renderBlockList();
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
  ensureBlockOrder();
  renderBlockList();
  renderCustomBlockManager();
  loadPreview();
};

const addMediaBlock = () => {
  if (!content) return;

  const url = normalizeVideoUrl(elements.mediaUrl.value.trim());
  if (!url) {
    setStatus("Za medij dodaj URL ali najprej naloži datoteko.", "error");
    return;
  }

  const id = makeCustomBlockId();
  mediaBlocksForPage().push({
    id,
    type: elements.mediaType.value || "document",
    title: elements.mediaTitle.value.trim() || "Nov medijski blok",
    description: elements.mediaDescription.value.trim() || "",
    url,
  });

  elements.mediaTitle.value = "";
  elements.mediaUrl.value = "";
  elements.mediaDescription.value = "";
  pendingMediaBlockId = id;
  markDirty();
  ensureBlockOrder();
  renderBlockList();
  loadPreview();
};

const moveBlockToken = (token, direction) => {
  const order = ensureBlockOrder();
  const index = order.indexOf(token);
  if (index < 0) return;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= order.length) return;

  const [entry] = order.splice(index, 1);
  order.splice(targetIndex, 0, entry);
  content.blockOrder[selectedPage.key] = order;
  markDirty();
  renderBlockList();
  loadPreview();
};

const removeBlockItem = (item) => {
  if (!item) return;

  if (item.type === "text") {
    const blocks = customBlocksForPage();
    const index = blocks.findIndex((block) => ensureCustomBlockId(block) === item.id);
    if (index >= 0) blocks.splice(index, 1);
  }

  if (item.type === "image") {
    const images = imageEntries();
    const index = images.findIndex((entry) => entry.id === item.id);
    if (index >= 0) images.splice(index, 1);
  }

  if (item.type === "media") {
    const media = mediaBlocksForPage();
    const index = media.findIndex((entry) => ensureMediaBlockId(entry) === item.id);
    if (index >= 0) media.splice(index, 1);
  }

  removeFromBlockOrder(item.type, item.id);
  activeKey = "";
  activeImageKey = "";
  markDirty();
  renderBlockList();
  renderCustomBlockManager();
  renderCustomImageManager();
  loadPreview();
};

const focusBlockItem = (item) => {
  if (!item) return;
  const doc = elements.preview.contentDocument;
  if (!doc) return;

  if (item.type === "text") {
    const block = doc.querySelector(`[data-custom-block="${CSS.escape(item.id)}"] h2`);
    if (block?.dataset.editorKey) {
      focusEditable(block.dataset.editorKey);
    }
    return;
  }

  if (item.type === "image") {
    const image = doc.querySelector(`[data-custom-image="${CSS.escape(item.id)}"] img`);
    if (image?.dataset.imageKey) {
      focusImage(image.dataset.imageKey);
    }
    return;
  }

  if (item.type === "media") {
    const heading = doc.querySelector(`[data-custom-media="${CSS.escape(item.id)}"] h3`);
    if (heading?.dataset.editorKey) {
      focusEditable(heading.dataset.editorKey);
    }
  }
};

const renderBlockList = () => {
  if (!elements.blockList || !content) return;

  const items = orderedBlockItems();
  elements.blockList.textContent = "";

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "custom-admin-empty";
    empty.textContent = "Na tej strani še ni dodanih blokov ali medijev.";
    elements.blockList.append(empty);
    return;
  }

  items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "block-card";
    row.draggable = true;
    row.dataset.blockToken = item.token;

    const top = document.createElement("div");
    top.className = "block-card-top";

    const drag = document.createElement("button");
    drag.type = "button";
    drag.className = "drag-handle";
    drag.textContent = "Premakni";
    drag.title = "Povleci kartico za premik";

    const badge = document.createElement("span");
    badge.className = "block-badge";
    badge.textContent =
      item.type === "text" ? "Besedilo" : item.type === "image" ? "Slika" : "Medij";

    const order = document.createElement("span");
    order.className = "block-order";
    order.textContent = `${index + 1}. element`;

    top.append(drag, badge, order);

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "block-card-copy";
    copy.innerHTML = `<strong>${item.title}</strong><span>${item.type === "media" ? `${item.mediaType || "medij"} - ` : ""}${item.description || "Brez opisa."}</span>`;
    copy.addEventListener("click", () => focusBlockItem(item));

    const actions = document.createElement("div");
    actions.className = "block-card-actions";

    const open = document.createElement("button");
    open.type = "button";
    open.className = "secondary light block-mini";
    open.textContent = "Odpri";
    open.addEventListener("click", () => focusBlockItem(item));

    const up = document.createElement("button");
    up.type = "button";
    up.className = "secondary light block-mini";
    up.textContent = "Gor";
    up.disabled = index === 0;
    up.addEventListener("click", () => moveBlockToken(item.token, "up"));

    const down = document.createElement("button");
    down.type = "button";
    down.className = "secondary light block-mini";
    down.textContent = "Dol";
    down.disabled = index === items.length - 1;
    down.addEventListener("click", () => moveBlockToken(item.token, "down"));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary danger block-mini";
    remove.textContent = "Izbriši";
    remove.addEventListener("click", () => removeBlockItem(item));

    actions.append(open, up, down, remove);
    row.append(top, copy, actions);

    row.addEventListener("dragstart", () => {
      blockDragToken = item.token;
      row.classList.add("is-dragging");
    });
    row.addEventListener("dragend", () => {
      blockDragToken = "";
      row.classList.remove("is-dragging");
      elements.blockList.querySelectorAll(".is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
    });
    row.addEventListener("dragover", (event) => {
      event.preventDefault();
      row.classList.add("is-drop-target");
    });
    row.addEventListener("dragleave", () => row.classList.remove("is-drop-target"));
    row.addEventListener("drop", (event) => {
      event.preventDefault();
      row.classList.remove("is-drop-target");
      if (!blockDragToken || blockDragToken === item.token) return;

      const order = ensureBlockOrder().filter((token) => token !== blockDragToken);
      const targetIndex = order.indexOf(item.token);
      if (targetIndex < 0) return;
      order.splice(targetIndex, 0, blockDragToken);
      content.blockOrder[selectedPage.key] = order;
      markDirty();
      renderBlockList();
      loadPreview();
    });

    elements.blockList.append(row);
  });
};

const renderFields = () => {
  elements.fieldList.textContent = "";

  pageEntries().forEach((entry, index) => {
    if (entry.hidden) return;
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
  if (entry.mediaBlockId) {
    const block = findMediaBlock(entry.mediaBlockId);
    return block?.[entry.mediaBlockStyleField] || {};
  }
  if (!entry.customBlockId) return entry.style || {};

  const block = findCustomBlock(entry.customBlockId);
  return block?.[entry.customBlockStyleField] || {};
};

const ensureEntryStyle = (entry) => {
  if (!entry) return {};
  if (entry.mediaBlockId) {
    const block = findMediaBlock(entry.mediaBlockId);
    if (!block) return {};
    block[entry.mediaBlockStyleField] = block[entry.mediaBlockStyleField] || {};
    entry.style = block[entry.mediaBlockStyleField];
    return block[entry.mediaBlockStyleField];
  }
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

  if (entry.mediaBlockId) {
    const block = findMediaBlock(entry.mediaBlockId);
    if (block) delete block[entry.mediaBlockStyleField];
    delete entry.style;
    return;
  }

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

  if (entry.mediaBlockId) {
    const block = findMediaBlock(entry.mediaBlockId);
    if (block) block[entry.mediaBlockField] = text;
  }

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

  applyImageStyleToTarget(target, entry.style);
};

const applyImageStyleToTarget = (target, style = {}) => {
  if (!target) return;

  const width = Number(style?.width) || 0;
  const x = Number(style?.x) || 0;
  const y = Number(style?.y) || 0;
  const borderWidth = Number(style?.borderWidth) || 0;
  const borderRadius = Number(style?.borderRadius) || 0;

  target.style.width = width ? `${width}px` : "";
  target.style.maxWidth = width ? "100%" : "";
  target.style.left = x ? `${x}px` : "";
  target.style.top = y ? `${y}px` : "";
  target.style.border = borderWidth ? `${borderWidth}px solid ${style?.borderColor || "#01457e"}` : "";
  target.style.borderRadius = borderRadius ? `${borderRadius}px` : "";

  if (x || y) {
    target.style.position = "relative";
  } else {
    target.style.position = "";
  }
};

const updateImageControls = () => {
  const entry = activeImageEntry();
  const disabled = !entry;

  [
    elements.imageSrc,
    elements.imageAlt,
    elements.imageWidth,
    elements.imageX,
    elements.imageY,
    elements.imageBorderWidth,
    elements.imageBorderColor,
    elements.imageBorderRadius,
    elements.imageReset,
    elements.imageRemove,
  ].forEach((control) => {
    if (control) control.disabled = disabled;
  });

  elements.imageLabel.textContent = entry
    ? entry.label || truncate(entry.alt || entry.src || "", 44)
    : "Najprej klikni sliko v predogledu.";
  elements.imageSrc.value = entry?.src || "";
  elements.imageAlt.value = entry?.alt || "";
  elements.imageWidth.value = entry?.style?.width || "";
  elements.imageX.value = entry?.style?.x ?? "";
  elements.imageY.value = entry?.style?.y ?? "";
  elements.imageBorderWidth.value = entry?.style?.borderWidth || "";
  elements.imageBorderColor.value = entry?.style?.borderColor || "#01457e";
  elements.imageBorderRadius.value = entry?.style?.borderRadius || "";
};

const setImageEntryValue = (property, value) => {
  const entry = activeImageEntry();
  if (!entry) return;

  entry[property] = value.trim();
  applyImageEntryToTarget(activeImage(), entry);
  markDirty();
  updateImageControls();
};

const setImageStyleValue = (property, value) => {
  const entry = activeImageEntry();
  if (!entry) return;

  entry.style = entry.style && typeof entry.style === "object" ? entry.style : {};

  if (value === "") {
    delete entry.style[property];
  } else {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return;
    entry.style[property] = numericValue;
  }

  if (!Object.keys(entry.style).length) {
    delete entry.style;
  }

  applyImageEntryToTarget(activeImage(), entry);
  markDirty();
  updateImageControls();
};

const removeActiveEntry = () => {
  const entry = activeEntry();
  if (!entry) return;

  if (entry.customBlockId) {
    const blocks = customBlocksForPage();
    const index = blocks.findIndex((block) => ensureCustomBlockId(block) === entry.customBlockId);
    if (index >= 0) blocks.splice(index, 1);
    removeFromBlockOrder("text", entry.customBlockId);
  } else if (entry.mediaBlockId) {
    const blocks = mediaBlocksForPage();
    const index = blocks.findIndex((block) => ensureMediaBlockId(block) === entry.mediaBlockId);
    if (index >= 0) blocks.splice(index, 1);
    removeFromBlockOrder("media", entry.mediaBlockId);
  } else {
    entry.text = "";
    entry.hidden = true;
  }

  activeKey = "";
  markDirty();
  renderFields();
  renderBlockList();
  renderCustomBlockManager();
  loadPreview();
};

const removeActiveImage = () => {
  const entry = activeImageEntry();
  if (!entry) return;

  if (entry.customImage) {
    const images = imageEntries();
    const index = images.findIndex((image) => image.id === entry.id);
    if (index >= 0) images.splice(index, 1);
    removeFromBlockOrder("image", entry.id);
  } else {
    entry.hidden = true;
  }

  activeImageKey = "";
  markDirty();
  renderBlockList();
  renderCustomImageManager();
  loadPreview();
};

const dragEdgeSize = 18;

const isPointerOnElementEdge = (event, target) => {
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;

  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const edge = Math.min(dragEdgeSize, Math.max(10, Math.min(rect.width, rect.height) / 3));

  return x <= edge || y <= edge || rect.width - x <= edge || rect.height - y <= edge;
};

const setEntryDragPosition = (key, target, x, y) => {
  const entry = findEntryByKey(key);
  if (!entry) return;

  const style = ensureEntryStyle(entry);
  style.x = x;
  style.y = y;
  applyEntryStyleToTarget(target, getEntryStyle(entry));
  elements.styleX.value = x;
  elements.styleY.value = y;
};

const setImageDragPosition = (key, target, x, y) => {
  const entry = findImageEntryByKey(key);
  if (!entry) return;

  entry.style = entry.style && typeof entry.style === "object" ? entry.style : {};
  entry.style.x = x;
  entry.style.y = y;
  applyImageEntryToTarget(target, entry);
  elements.imageX.value = x;
  elements.imageY.value = y;
};

const startEdgeDrag = (event, target, type, key) => {
  if (event.button !== 0 || !isPointerOnElementEdge(event, target)) return false;

  const doc = target.ownerDocument;
  const entry = type === "image" ? findImageEntryByKey(key) : findEntryByKey(key);
  if (!entry) return false;

  const style = type === "image" ? entry.style || {} : getEntryStyle(entry);
  const startPointerX = event.clientX;
  const startPointerY = event.clientY;
  const startX = Number(style.x) || 0;
  const startY = Number(style.y) || 0;
  let moved = false;

  event.preventDefault();
  event.stopPropagation();
  target.classList.add("editor-dragging");

  const onMove = (moveEvent) => {
    const nextX = Math.round(startX + moveEvent.clientX - startPointerX);
    const nextY = Math.round(startY + moveEvent.clientY - startPointerY);
    moved = true;

    if (type === "image") {
      setImageDragPosition(key, target, nextX, nextY);
    } else {
      setEntryDragPosition(key, target, nextX, nextY);
    }
  };

  const onEnd = () => {
    doc.removeEventListener("pointermove", onMove, true);
    doc.removeEventListener("pointerup", onEnd, true);
    doc.removeEventListener("pointercancel", onEnd, true);
    target.classList.remove("editor-dragging");

    if (moved) {
      markDirty();
      updateStyleControls();
      updateImageControls();
    }
  };

  doc.addEventListener("pointermove", onMove, true);
  doc.addEventListener("pointerup", onEnd, true);
  doc.addEventListener("pointercancel", onEnd, true);
  return true;
};

const applyEntryStyleToTarget = (target, style = {}) => {
  if (!target) return;

  target.style.color = style.color || "";
  target.style.fontSize = style.fontSize ? `${Number(style.fontSize)}px` : "";
  target.style.fontFamily = style.fontFamily || "";
  target.style.border = style.borderWidth
    ? `${Number(style.borderWidth)}px solid ${style.borderColor || "#01457e"}`
    : "";
  target.style.borderRadius = style.borderRadius ? `${Number(style.borderRadius)}px` : "";
  target.style.padding =
    style.borderWidth || style.borderRadius ? "0.35em 0.5em" : "";

  const hasMove = style.x !== undefined || style.y !== undefined;
  const x = Number(style.x) || 0;
  const y = Number(style.y) || 0;

  target.style.left = hasMove && x ? `${x}px` : "";
  target.style.top = hasMove && y ? `${y}px` : "";

  if (hasMove && (x || y)) {
    target.style.position = "relative";
  } else if (target.style.position === "relative") {
    target.style.position = "";
  }
};

const updateStyleControls = () => {
  const entry = activeEntry();
  const style = getEntryStyle(entry);
  const disabled = !entry;

  [
    elements.styleColor,
    elements.styleFontSize,
    elements.styleFontFamily,
    elements.styleX,
    elements.styleY,
    elements.styleBorderWidth,
    elements.styleBorderColor,
    elements.styleBorderRadius,
    elements.styleRemove,
    elements.styleReset,
  ].forEach((control) => {
    if (control) control.disabled = disabled;
  });

  elements.styleLabel.textContent = entry
    ? entry.label || truncate(entry.text || "", 44)
    : "Najprej klikni besedilo v predogledu.";
  elements.styleColor.value = style.color || "#01457e";
  elements.styleFontSize.value = style.fontSize || "";
  elements.styleFontFamily.value = style.fontFamily || "";
  elements.styleX.value = style.x ?? "";
  elements.styleY.value = style.y ?? "";
  elements.styleBorderWidth.value = style.borderWidth || "";
  elements.styleBorderColor.value = style.borderColor || "#01457e";
  elements.styleBorderRadius.value = style.borderRadius || "";
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
  const nextText = normalizeEditableText(value);
  if (entry.text === nextText) return;
  setEntryText(entry, nextText);
  markDirty();
  renderFields();
  renderBlockList();
};

const syncPreviewTexts = () => {
  const doc = elements.preview.contentDocument;
  if (!doc) return;

  let changed = false;

  doc.querySelectorAll("[data-editor-key]").forEach((editable) => {
    const entry = findEntryByKey(editable.dataset.editorKey || "");
    if (!entry) return;

    const nextText = normalizeEditableText(editable.innerText || editable.textContent || "");
    if (entry.text === nextText) return;

    setEntryText(entry, nextText);
    changed = true;
  });

  if (changed) {
    dirty = true;
    renderFields();
    renderBlockList();
  }
};

const injectEditorStyles = (doc) => {
  const style = doc.createElement("style");
  style.textContent = `
    [data-editor-key] {
      outline: 3px solid rgba(1, 69, 126, 0.55) !important;
      outline-offset: 4px !important;
      cursor: text !important;
      touch-action: none !important;
    }
    [data-editor-key]:hover,
    [data-editor-key].editor-active {
      outline-color: rgba(220, 165, 95, 0.95) !important;
      box-shadow: 0 0 0 6px rgba(220, 165, 95, 0.16) !important;
    }
    [data-image-key] {
      outline: 3px solid rgba(6, 79, 62, 0.62) !important;
      outline-offset: 4px !important;
      cursor: move !important;
      touch-action: none !important;
    }
    [data-image-key]:hover,
    [data-image-key].editor-active-image {
      outline-color: rgba(220, 165, 95, 0.95) !important;
      box-shadow: 0 0 0 6px rgba(220, 165, 95, 0.18) !important;
    }
    [data-editor-key].editor-dragging,
    [data-image-key].editor-dragging {
      cursor: grabbing !important;
      opacity: 0.92 !important;
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
    updateStyleControls();
    updateImageControls();
  }
};

const injectCustomContentIntoPreview = (doc) => {
  const main = doc.querySelector("main");
  if (!main) return;

  doc.querySelectorAll("[data-custom-blocks], [data-custom-images], [data-custom-content]").forEach((node) => node.remove());

  const items = orderedBlockItems();
  if (!items.length) return;

  const section = doc.createElement("section");
  section.className = "section custom-content-section";
  section.setAttribute("data-custom-content", "");

  const grid = doc.createElement("div");
  grid.className = "custom-content-grid";

  items.forEach((item, index) => {
    if (item.type === "text") {
      const article = doc.createElement("article");
      article.className = "custom-text-card reveal is-visible";
      article.setAttribute("data-custom-block", item.id);

      const title = doc.createElement("h2");
      const text = doc.createElement("p");
      applyTextWithLineBreaks(title, item.raw.title || `Okvir ${index + 1}`);
      applyTextWithLineBreaks(text, item.raw.text || "Vpiši dodatno besedilo za ta okvir.");
      applyEntryStyleToTarget(title, item.raw.titleStyle);
      applyEntryStyleToTarget(text, item.raw.textStyle);
      article.append(title, text);
      grid.append(article);
      return;
    }

    if (item.type === "image") {
      const figure = doc.createElement("figure");
      figure.className = "custom-image-item reveal is-visible";
      figure.setAttribute("data-custom-image", item.id);

      const image = doc.createElement("img");
      applyImageEntryToTarget(image, item.raw);
      figure.append(image);

      if (item.raw.alt) {
        const caption = doc.createElement("figcaption");
        applyTextWithLineBreaks(caption, item.raw.alt);
        figure.append(caption);
      }

      grid.append(figure);
      return;
    }

    const article = doc.createElement("article");
    article.className = "custom-media-card reveal is-visible";
    article.setAttribute("data-custom-media", item.id);

    const mediaWrap = doc.createElement("div");
    mediaWrap.className = "custom-media-surface";
    const embed = mediaEmbedInfo(item.raw.type, item.raw.url);

    if (embed.type === "image") {
      const image = doc.createElement("img");
      image.src = embed.src;
      image.alt = item.raw.title || "Dodani medij";
      mediaWrap.append(image);
    } else if (embed.type === "iframe") {
      const iframe = doc.createElement("iframe");
      iframe.src = embed.src;
      iframe.title = item.raw.title || "Dodani video";
      iframe.loading = "lazy";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      mediaWrap.append(iframe);
    } else if (embed.type === "video") {
      const video = doc.createElement("video");
      video.src = embed.src;
      video.controls = true;
      video.preload = "metadata";
      mediaWrap.append(video);
    } else if (embed.type === "audio") {
      const audio = doc.createElement("audio");
      audio.src = embed.src;
      audio.controls = true;
      mediaWrap.append(audio);
    } else {
      const link = doc.createElement("a");
      link.href = embed.src;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.className = "button secondary";
      link.textContent = "Odpri dokument";
      mediaWrap.append(link);
    }

    const title = doc.createElement("h3");
    const description = doc.createElement("p");
    applyTextWithLineBreaks(title, item.raw.title || "Nov medijski blok");
    applyTextWithLineBreaks(description, item.raw.description || "Dodaj opis za ta medij.");
    applyEntryStyleToTarget(title, item.raw.titleStyle);
    applyEntryStyleToTarget(description, item.raw.descriptionStyle);

    article.append(mediaWrap, title, description);
    grid.append(article);
  });

  section.append(grid);
  main.append(section);
};

const applyPageCssToPreview = (doc) => {
  const styleId = "tuval-custom-page-css";
  doc.getElementById(styleId)?.remove();

  const css = pageCssForCurrentPage();
  if (!css.trim()) return;

  const style = doc.createElement("style");
  style.id = styleId;
  style.textContent = css;
  doc.head.append(style);
};

const preparePreview = () => {
  const doc = elements.preview.contentDocument;
  if (!doc || !content) return;

  injectCustomContentIntoPreview(doc);
  applyPageCssToPreview(doc);
  injectEditorStyles(doc);
  preventPreviewNavigation(doc);
  discoverEditableTexts(doc);
  discoverEditableImages(doc);
  renderFields();
  renderBlockList();

  pageEntries().forEach((entry, index) => {
    if (!entry.selector || typeof entry.text !== "string" || entry.attribute) return;
    const key = `${entry.selector}|${index}`;
    const target = doc.querySelector(entry.selector);
    if (!target) return;

    target.dataset.editorKey = key;
    target.contentEditable = "true";
    target.spellcheck = true;
    target.hidden = Boolean(entry.hidden);
    applyTextWithLineBreaks(target, entry.text);
    applyEntryStyleToTarget(target, getEntryStyle(entry));

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
    target.addEventListener(
      "pointerdown",
      (event) => {
        startEdgeDrag(event, target, "text", key);
      },
      true
    );
    target.addEventListener("click", activateTarget, true);

    target.addEventListener("blur", () => {
      target.classList.remove("editor-active");
      updateEntryText(key, target.innerText || target.textContent);
      updateStyleControls();
    });
  });

  imageEntries().forEach((entry, index) => {
    if (!entry.selector || typeof entry.src !== "string") return;
    const key = `${entry.selector}|${index}`;
    const target = doc.querySelector(entry.selector);
    if (!target) return;

    target.dataset.imageKey = key;
    target.tabIndex = 0;
    target.hidden = Boolean(entry.hidden);
    applyImageEntryToTarget(target, entry);

    target.addEventListener(
      "pointerdown",
      (event) => {
        activeImageKey = key;
        activeKey = "";
        doc
          .querySelectorAll(".editor-active-image")
          .forEach((node) => node.classList.remove("editor-active-image"));
        doc.querySelectorAll(".editor-active").forEach((node) => node.classList.remove("editor-active"));
        target.classList.add("editor-active-image");
        renderFields();
        updateStyleControls();
        updateImageControls();
        startEdgeDrag(event, target, "image", key);
      },
      true
    );

    target.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      focusImage(key);
    });
  });

  if (pendingCustomImageId) {
    const image = doc.querySelector(`[data-custom-image="${CSS.escape(pendingCustomImageId)}"] img`);
    const key = image?.dataset.imageKey;

    if (image) {
      image.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    if (key) {
      focusImage(key);
    }

    pendingCustomImageId = "";
  }

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

  if (pendingMediaBlockId) {
    const block = doc.querySelector(`[data-custom-media="${CSS.escape(pendingMediaBlockId)}"]`);
    const title = block?.querySelector("h3");

    if (block) {
      block.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    if (title?.dataset.editorKey) {
      focusEditable(title.dataset.editorKey);
    }

    pendingMediaBlockId = "";
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
  if (elements.pageCss) {
    elements.pageCss.value = pageCssForCurrentPage();
  }
  renderBlockList();
  renderCustomBlockManager();
  renderCustomImageManager();
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
  content.mediaBlocks =
    content.mediaBlocks && typeof content.mediaBlocks === "object" && !Array.isArray(content.mediaBlocks)
      ? content.mediaBlocks
      : {};
  content.blockOrder =
    content.blockOrder && typeof content.blockOrder === "object" && !Array.isArray(content.blockOrder)
      ? content.blockOrder
      : {};
  content.customCss =
    content.customCss && typeof content.customCss === "object" && !Array.isArray(content.customCss)
      ? content.customCss
      : {};
  content.videos = Array.isArray(content.videos) ? content.videos : [];
  pageMap.forEach((page) => {
    content[page.key] = content[page.key] || [];
    content.customBlocks[page.key] = Array.isArray(content.customBlocks[page.key])
      ? content.customBlocks[page.key]
      : [];
    content.images[page.key] = Array.isArray(content.images[page.key])
      ? content.images[page.key]
      : [];
    content.mediaBlocks[page.key] = Array.isArray(content.mediaBlocks[page.key])
      ? content.mediaBlocks[page.key]
      : [];
    content.blockOrder[page.key] = Array.isArray(content.blockOrder[page.key])
      ? content.blockOrder[page.key]
      : [];
    content.customCss[page.key] = typeof content.customCss[page.key] === "string" ? content.customCss[page.key] : "";
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

const uploadMediaFile = async () => {
  const file = elements.mediaFile?.files?.[0];
  if (!file) {
    setStatus("Najprej izberi datoteko za nalaganje.", "error");
    return;
  }

  if (!authenticated) {
    setStatus("Najprej se prijavi z admin računom.", "error");
    return;
  }

  setStatus("Nalagam datoteko na strežnik...");

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Datoteke ni bilo mogoče prebrati."));
    reader.readAsDataURL(file);
  });

  const response = await fetch("../api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      dataUrl,
    }),
  });
  const result = await response.json();

  if (!response.ok) {
    setStatus(result.message || "Nalaganje ni uspelo.", "error");
    return;
  }

  elements.mediaUrl.value = result.url || "";
  if ((result.mimeType || "").startsWith("image/")) {
    elements.mediaType.value = "image";
    elements.newImageSrc.value = result.url || "";
    if (!elements.newImageAlt.value.trim()) {
      elements.newImageAlt.value = file.name.replace(/\.[^.]+$/, "");
    }
  } else if ((result.mimeType || "").startsWith("video/")) {
    elements.mediaType.value = "video";
  } else if ((result.mimeType || "").startsWith("audio/")) {
    elements.mediaType.value = "audio";
  } else {
    elements.mediaType.value = "document";
  }

  if (!elements.mediaTitle.value.trim()) {
    elements.mediaTitle.value = file.name.replace(/\.[^.]+$/, "");
  }

  setStatus("Datoteka je naložena. Zdaj jo lahko dodaš kot blok ali sliko.", "success");
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
  elements.newImageAdd.addEventListener("click", addCustomImage);
  elements.mediaAdd.addEventListener("click", addMediaBlock);
  elements.mediaUpload.addEventListener("click", uploadMediaFile);
  elements.styleColor.addEventListener("input", () => setEntryStyleValue("color", elements.styleColor.value));
  elements.styleBorderWidth.addEventListener("input", () =>
    setEntryStyleValue("borderWidth", elements.styleBorderWidth.value)
  );
  elements.styleBorderColor.addEventListener("input", () =>
    setEntryStyleValue("borderColor", elements.styleBorderColor.value)
  );
  elements.styleBorderRadius.addEventListener("input", () =>
    setEntryStyleValue("borderRadius", elements.styleBorderRadius.value)
  );
  elements.imageSrc.addEventListener("input", () => setImageEntryValue("src", elements.imageSrc.value));
  elements.imageAlt.addEventListener("input", () => setImageEntryValue("alt", elements.imageAlt.value));
  elements.imageWidth.addEventListener("input", () => setImageStyleValue("width", elements.imageWidth.value));
  elements.imageX.addEventListener("input", () => setImageStyleValue("x", elements.imageX.value));
  elements.imageY.addEventListener("input", () => setImageStyleValue("y", elements.imageY.value));
  elements.imageBorderWidth.addEventListener("input", () =>
    setImageStyleValue("borderWidth", elements.imageBorderWidth.value)
  );
  elements.imageBorderColor.addEventListener("input", () =>
    setImageStyleValue("borderColor", elements.imageBorderColor.value)
  );
  elements.imageBorderRadius.addEventListener("input", () =>
    setImageStyleValue("borderRadius", elements.imageBorderRadius.value)
  );
  elements.imageRemove.addEventListener("click", removeActiveImage);
  elements.imageReset.addEventListener("click", () => {
    if (!activeImageKey) return;
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
  elements.styleRemove.addEventListener("click", removeActiveEntry);
  elements.styleReset.addEventListener("click", () => {
    const entry = activeEntry();
    if (!entry) return;
    clearEntryStyle(entry);
    applyEntryStyleToTarget(activeEditable(), {});
    markDirty();
    updateStyleControls();
  });
  if (elements.pageCss) {
    elements.pageCss.addEventListener("input", () => {
      setPageCssForCurrentPage(elements.pageCss.value);
      markDirty();
      if (elements.preview.contentDocument) {
        applyPageCssToPreview(elements.preview.contentDocument);
      }
    });
  }
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
