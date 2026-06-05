const loadContentTexts = () => {
  const sources = ["/api/content", "content/site.json"];

  for (const source of sources) {
    try {
      const request = new XMLHttpRequest();
      request.open("GET", `${source}?updated=${Date.now()}`, false);
      request.send(null);

      if (request.status >= 200 && request.status < 300) {
        return JSON.parse(request.responseText.replace(/^\uFEFF/, ""));
      }
    } catch (error) {
      // Fall back to the next source.
    }
  }

  return null;
};

const mergeTextEntries = (fallbackEntries = [], contentEntries = []) => {
  const merged = new Map();
  const fallbackList = Array.isArray(fallbackEntries) ? fallbackEntries : [];
  const contentList = Array.isArray(contentEntries) ? contentEntries : [];

  [...fallbackList, ...contentList].forEach((entry) => {
    if (!entry?.selector) return;
    const key = `${entry.selector}|${entry.attribute || ""}|${entry.all || ""}`;
    merged.set(key, entry);
  });

  return [...merged.values()];
};

const mergeTextGroups = (fallbackTexts = {}, contentTexts = {}) => {
  const pageNames = new Set([...Object.keys(fallbackTexts), ...Object.keys(contentTexts)]);

  return [...pageNames].reduce((groups, pageName) => {
    groups[pageName] = mergeTextEntries(fallbackTexts[pageName], contentTexts[pageName]);
    return groups;
  }, {});
};

const contentPageNames = {
  "index.html": "index",
  "maske.html": "maske",
  "videi.html": "videi",
  "kontakt.html": "kontakt",
  "test.html": "test",
  "cleanspace-work.html": "cleanspace_work",
  "cleanspace-cst-pro.html": "cleanspace_cst_pro",
  "cleanspace-cst-ultra.html": "cleanspace_cst_ultra",
  "cleanspace-ex.html": "cleanspace_ex",
  "cleanspace-halo.html": "cleanspace_halo",
};

const siteContent = loadContentTexts() || {};

const currentPageName = () => window.location.pathname.split("/").pop() || "index.html";

const currentContentKey = () => contentPageNames[currentPageName()] || currentPageName();

const applyEditableStyle = (element, style = {}) => {
  if (!element || !style) return;

  if (style.color) {
    element.style.color = style.color;
  }

  if (style.fontSize) {
    element.style.fontSize = `${style.fontSize}px`;
  }

  if (style.fontFamily) {
    element.style.fontFamily = style.fontFamily;
  }

  if (style.x || style.y) {
    element.style.position = element.style.position || "relative";
    element.style.left = `${Number(style.x) || 0}px`;
    element.style.top = `${Number(style.y) || 0}px`;
  }
};

const customBlocksForCurrentPage = (content = {}) => {
  const groups = content.customBlocks || {};
  if (!groups || typeof groups !== "object" || Array.isArray(groups)) return [];

  const groupFor = (key) => (Array.isArray(groups[key]) ? groups[key] : []);
  return [...groupFor(currentPageName()), ...groupFor(currentContentKey())];
};

const renderCustomBlocks = (content = {}) => {
  const blocks = customBlocksForCurrentPage(content);
  const main = document.querySelector("main");
  if (!main || !blocks.length) return;

  const section = document.createElement("section");
  section.setAttribute("class", "section custom-content-section");
  section.setAttribute("data-custom-blocks", "");

  const grid = document.createElement("div");
  grid.setAttribute("class", "custom-content-grid");

  blocks.forEach((block, index) => {
    const article = document.createElement("article");
    article.setAttribute("class", "custom-text-card reveal");
    article.setAttribute("data-custom-block", block.id || `custom-block-${index + 1}`);

    const title = document.createElement("h2");
    title.textContent = block.title || "Dodaten opis";
    applyEditableStyle(title, block.titleStyle);

    const text = document.createElement("p");
    text.textContent = block.text || "Dodajte besedilo za ta okvir.";
    applyEditableStyle(text, block.textStyle);

    article.append(title, text);
    grid.append(article);
  });

  section.append(grid);
  main.append(section);
};

const applyEditableTexts = (content = {}) => {
  const textGroups = mergeTextGroups(window.TUVAL_TEXTS || {}, content);
  if (!Object.keys(textGroups).length) return;

  const pageName = currentPageName();
  const pageEntries = mergeTextEntries(
    textGroups[pageName] || [],
    textGroups[contentPageNames[pageName]] || []
  );
  const entries = [...(textGroups.common || []), ...pageEntries];

  entries.forEach((entry) => {
    if (!entry?.selector || typeof entry.text !== "string") return;

    const elements = entry.all
      ? document.querySelectorAll(entry.selector)
      : [document.querySelector(entry.selector)];

    elements.forEach((element) => {
      if (!element) return;

      if (entry.attribute) {
        element.setAttribute(entry.attribute, entry.text);
        return;
      }

      element.textContent = entry.text;
      applyEditableStyle(element, entry.style);
    });
  });
};

const applyEditableImages = (content = {}) => {
  const imageGroups = content.images || {};
  if (!imageGroups || typeof imageGroups !== "object") return;

  const pageName = currentPageName();
  const imageGroup = (key) => (Array.isArray(imageGroups[key]) ? imageGroups[key] : []);
  const entries = [
    ...imageGroup("common"),
    ...imageGroup(pageName),
    ...imageGroup(contentPageNames[pageName]),
  ];

  entries.forEach((entry) => {
    if (!entry?.selector || !entry.src) return;

    const image = document.querySelector(entry.selector);
    if (!image) return;

    image.src = entry.src;
    image.setAttribute("src", entry.src);

    if (typeof entry.alt === "string") {
      image.alt = entry.alt;
      image.setAttribute("alt", entry.alt);
    }
  });
};

renderCustomBlocks(siteContent);
applyEditableTexts(siteContent);
applyEditableImages(siteContent);

const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const nav = document.querySelector("[data-nav]");
const revealItems = document.querySelectorAll(".reveal");
const contactForm = document.querySelector("[data-contact-form]");
const formNote = document.querySelector("[data-form-note]");
const heroRotator = document.querySelector("[data-hero-rotator]");
const videoPage = document.querySelector("[data-video-page]");

const heroRotatorSlides = [
  {
    model: "CleanSpace WORK",
    src: "https://cleanspacetechnology.com/wp-content/uploads/2024/11/CleanSpace-WORK-USA-Side.jpg",
  },
  {
    model: "CleanSpace CST PRO",
    src: "https://cleanspacetechnology.com/wp-content/uploads/2024/11/CleanSpace-CST-PRO-USA-Stack-00-1.png",
  },
  {
    model: "CleanSpace CST ULTRA",
    src: "https://cleanspacetechnology.com/wp-content/uploads/2024/11/CleanSpace-CST-ULTRA-USA-Stack-00.png",
  },
  {
    model: "CleanSpace EX",
    src: "https://cleanspacetechnology.com/wp-content/uploads/2024/06/CleanSpace-EX-Stack-00.png",
  },
  {
    model: "CleanSpace HALO",
    src: "https://cleanspacetechnology.com/wp-content/uploads/2024/11/CleanSpace-HALO-USA-Stack-00.png",
  },
];

const partImageFallback =
  "https://cleanspacetechnology.com/wp-content/uploads/2024/11/CleanSpace-CST-PRO-USA-Stack-05-1.png";

const partImageRules = [
  {
    match: ["CS3002WORK"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2024/07/CleanSpace-WORK-CS3002WORK-Particulate-Standard-TM3-P3-Filter-01.jpg",
    label: "CleanSpace WORK filter",
  },
  {
    match: ["PAF-1043"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2024/12/CleanSpace-PAF-1043-Half-Mask-Quantitative-Fit-Testing-Kit-Image-1200x718.png",
    label: "Half Mask Fit Testing Kit",
  },
  {
    match: ["KOMPLET WORK"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2024/06/CleanSpace-Halo-WORK-Stack-03.png",
    label: "CleanSpace WORK komplet",
  },
  {
    match: ["CST1005"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2025/06/CleanSpace-CST1005-Particulate-Filter-TM3PRSL-P3-3pk-Image-01-1200x1200.jpg",
    label: "CST1005 delčni filter",
  },
  {
    match: ["CST1004"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2025/06/CleanSpace-CST1004-High-Capacity-Particulate-Filter-TM3PRSL-P3-3pk-Image-01-1200x1200.jpg",
    label: "CST1004 visoko zmogljiv filter",
  },
  {
    match: ["CST1028", "CST1008", "CST1027", "CST1006"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2024/11/CleanSpace-CST-PRO-USA-Stack-05-1.png",
    label: "CST kombinirani filtri",
  },
  {
    match: ["PAF-0058"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2024/11/CleanSpace-CST-PRO-USA-Stack-05-1.png",
    label: "Pred-filter in zaščitna prevleka",
  },
  {
    match: ["CST1000"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2024/11/CleanSpace-CST-PRO-USA-Stack-00-1.png",
    label: "CST PRO pogonska enota",
  },
  {
    match: ["CST1010"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2024/11/CleanSpace-CST-ULTRA-USA-Stack-00.png",
    label: "CST ULTRA pogonska enota",
  },
  {
    match: ["CST1019", "CST1020", "CST1037", "CST1038", "CST1024"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2024/06/CleanSpace-CST-PRO-Stack-03.png",
    label: "CST opore in trakovi",
  },
  {
    match: ["CS3014"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2020/12/CS3014-CleanSpace-Docking-Station-Charging-Storage-Case.jpg",
    label: "CleanSpace polnilna postaja",
  },
  {
    match: ["PAF-1101", "PAF-1024"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2020/12/CleanSpace-PAF-1101-Universial-Battery-Charger-Image-01-1.png",
    label: "CleanSpace polnilnik",
  },
  {
    match: ["PAF-1018", "PAF-1026", "PAF-1017"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2024/11/CleanSpace-CST-ULTRA-USA-Stack-05.png",
    label: "Dodatki za celoobrazno masko",
  },
  {
    match: ["PAF-0035"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2024/09/CleanSpace-PAF-0035-Particulate-Filter-Image-02-1200x1200.jpg",
    label: "PAF-0035 delčni filter",
  },
  {
    match: ["PAF-0036"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2024/06/CleanSpace-EX-Stack-03.png",
    label: "CleanSpace pred-filter",
  },
  {
    match: ["PAF-0037"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2020/12/PAF-0037-CleanSpace-High-Capacity-HI-CAP-Particulate-P3-TM3-P-SL-R-Filter.jpg",
    label: "PAF-0037 visoko zmogljiv filter",
  },
  {
    match: ["PAF-0078", "PAF-0038"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2020/12/PAF-0038-CleanSpace-Filter-Adaptor.jpg",
    label: "CleanSpace filter adapter",
  },
  {
    match: ["PAF-0050", "PAF-0077", "PAF-0051", "PAF-0052", "PAF-0087"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2024/06/CleanSpace-EX-Stack-04.png",
    label: "CleanSpace kombinirani filtri",
  },
  {
    match: ["PAF-0057"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2020/12/PAF-0057-Particulate-Pre-Filter-Covers-for-Large-Case-Filters-pk-20.jpg",
    label: "Pred-filter za velike filtre",
  },
  {
    match: ["PAF-0049"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2021/03/17-CleanSpace-EX-with-Full-Face-Mask-and-Coverall-Filter.jpg",
    label: "CleanSpace zaščitna prevleka filtra",
  },
  {
    match: ["PAF-0060"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2024/09/PAF-_0060-CleanSpace-EX.jpg",
    label: "CleanSpace EX pogonska enota",
  },
  {
    match: ["PAF-1030", "PAF-1028", "PAF-1012", "PAF-1013"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2024/06/CleanSpace-EX-Stack-02.png",
    label: "EX opore in naglavni trak",
  },
  {
    match: ["CS3002"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2024/11/CleanSpace-HALO-USA-Stack-05.png",
    label: "HALO HEPA filter",
  },
  {
    match: ["CS3025"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2020/12/CS3025-CleanSpace-HALO-Bio-P3-TM3-Particulate-Filter-P-SL-R.jpg",
    label: "HALO Bio filter",
  },
  {
    match: ["CS3038", "CS3039"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2024/11/CleanSpace-HALO-USA-Stack-05.png",
    label: "Steri-Plus izdihovalni filter",
  },
  {
    match: ["CS3027"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2021/02/CS3027-CleanSpace-HALO-BIO-Exhalation-Filter-95-Pk-15.jpg",
    label: "HALO BIO izdihovalni filter",
  },
  {
    match: ["HALO POWER SYSTEM"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2024/11/CleanSpace-HALO-USA-Stack-00.png",
    label: "HALO pogonska enota",
  },
  {
    match: ["CS3008"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2020/12/CS3008-CleanSpace-HALO-Head-Harness.jpg",
    label: "HALO naglavni trak",
  },
  {
    match: ["CS3011"],
    image:
      "https://cleanspacetechnology.com/wp-content/uploads/2024/11/CleanSpace-HALO-USA-Stack-05.png",
    label: "HALO čistilni in shranjevalni čep",
  },
];

const hasClass = (element, className) =>
  Boolean(element?.classList?.contains?.(className)) ||
  ` ${element?.className || ""} `.includes(` ${className} `);

const addClass = (element, className) => {
  if (!element) return;

  if (element.classList?.add) {
    element.classList.add(className);
    return;
  }

  if (className === "is-visible" && element.style) {
    element.style.opacity = "1";
    element.style.transform = "none";
  }

  try {
    if (!hasClass(element, className)) {
      element.className = `${element.className || ""} ${className}`.trim();
    }
  } catch (error) {
    // Some embedded preview browsers expose read-only className/classList.
  }
};

const removeClass = (element, className) => {
  if (!element) return;

  if (element.classList?.remove) {
    element.classList.remove(className);
    return;
  }

  try {
    element.className = ` ${element.className || ""} `.replace(` ${className} `, " ").trim();
  } catch (error) {
    // Non-critical visual state only.
  }
};

const toggleClass = (element, className, force) => {
  if (!element) return;

  if (element.classList?.toggle) {
    element.classList.toggle(className, force);
    return;
  }

  const shouldAdd = typeof force === "boolean" ? force : !hasClass(element, className);
  if (shouldAdd) {
    addClass(element, className);
  } else {
    removeClass(element, className);
  }
};

const on = (target, eventName, handler, options) => {
  if (typeof target?.addEventListener === "function") {
    target.addEventListener(eventName, handler, options);
  }
};

const setDataValue = (element, key, value) => {
  if (!element) return;

  try {
    if (element.dataset) {
      element.dataset[key] = value;
      return;
    }
  } catch (error) {
    // Some preview environments expose read-only dataset objects.
  }

  try {
    element.setAttribute?.(`data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value);
  } catch (error) {
    // Non-critical enhancement only.
  }
};

const setHeaderState = () => {
  if (!header) return;
  toggleClass(header, "is-scrolled", window.scrollY > 24);
};

setHeaderState();
on(window, "scroll", setHeaderState, { passive: true });

on(menuToggle, "click", () => {
  toggleClass(document.body, "nav-open");
});

on(nav, "click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    removeClass(document.body, "nav-open");
  }
});

if (heroRotator) {
  let heroSlideIndex = 0;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (typeof Image === "function") {
    heroRotatorSlides.forEach((slide) => {
      const image = new Image();
      image.src = slide.src;
    });
  }

  setDataValue(heroRotator, "currentModel", heroRotatorSlides[heroSlideIndex].model);

  if (
    !prefersReducedMotion &&
    typeof window.setInterval === "function" &&
    typeof window.setTimeout === "function"
  ) {
    window.setInterval(() => {
      heroSlideIndex = (heroSlideIndex + 1) % heroRotatorSlides.length;
      const nextSlide = heroRotatorSlides[heroSlideIndex];

      addClass(heroRotator, "is-changing");

      window.setTimeout(() => {
        heroRotator.src = nextSlide.src;
        setDataValue(heroRotator, "currentModel", nextSlide.model);
        removeClass(heroRotator, "is-changing");
      }, 320);
    }, 5000);
  }
}

document.querySelectorAll("[data-card-link]").forEach((card) => {
  const openCardLink = () => {
    const target = card.dataset.cardLink;
    if (target) {
      window.location.href = target;
    }
  };

  on(card, "click", (event) => {
    if (event.target instanceof Element && event.target.closest("a, button")) return;
    openCardLink();
  });

  on(card, "keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target instanceof Element && event.target.closest("a, button")) return;
    event.preventDefault();
    openCardLink();
  });
});

let revealObserver = null;

const revealVisibleItems = () => {
  revealItems.forEach((item) => {
    if (hasClass(item, "is-visible")) return;

    const rect = item.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.94 && rect.bottom > 0) {
      addClass(item, "is-visible");
      revealObserver?.unobserve(item);
    }
  });
};

if ("IntersectionObserver" in window) {
  addClass(document.body, "reveal-ready");

  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          addClass(entry.target, "is-visible");
          revealObserver?.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.04 }
  );

  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index * 45, 240)}ms`;
    revealObserver.observe(item);
  });
} else {
  revealItems.forEach((item) => addClass(item, "is-visible"));
}

on(window, "load", revealVisibleItems);
on(window, "resize", revealVisibleItems);
if (typeof window.setTimeout === "function") {
  window.setTimeout(revealVisibleItems, 350);
} else {
  revealVisibleItems();
}

document.querySelectorAll(".detail-block").forEach((block) => {
  const heading = block.querySelector("h4")?.textContent?.trim().toLowerCase() || "";
  if (!heading.includes("filtri") && !heading.includes("pripomo")) return;

  addClass(block.querySelector("ul"), "visual-parts");

  block.querySelectorAll("li").forEach((item) => {
    if (item.querySelector("img")) return;

    const text = item.textContent.trim();
    const normalized = text.toUpperCase();
    const rule = partImageRules.find((candidate) =>
      candidate.match.some((code) => normalized.includes(code))
    );

    const image = document.createElement("img");
    image.className = "part-thumb";
    image.src = rule?.image || partImageFallback;
    image.alt = rule?.label || text.split(" - ")[0] || "CleanSpace izdelek";
    image.loading = "eager";

    const copy = document.createElement("span");
    copy.className = "part-copy";
    copy.textContent = text;

    item.textContent = "";
    addClass(item, "part-card");
    item.append(image, copy);
  });
});

applyEditableImages();

const videoMaskLabels = {
  work: "CleanSpace WORK",
  "cst-pro": "CleanSpace CST PRO",
  "cst-ultra": "CleanSpace CST ULTRA",
  ex: "CleanSpace EX",
  halo: "CleanSpace HALO",
};

const normalizeVideoUrl = (value = "") => {
  const iframeMatch = value.match(/src=["']([^"']+)["']/i);
  return (iframeMatch ? iframeMatch[1] : value).trim();
};

const videoEmbed = (rawUrl = "") => {
  const normalizedUrl = normalizeVideoUrl(rawUrl);

  try {
    const url = new URL(normalizedUrl, window.location.href);
    const host = url.hostname.replace(/^www\./, "");
    const isHttp = url.protocol === "http:" || url.protocol === "https:";
    if (!isHttp) {
      return { type: "link", src: "#" };
    }

    if (host === "youtu.be") {
      return {
        type: "iframe",
        src: `https://www.youtube.com/embed/${url.pathname.replace("/", "")}`,
      };
    }

    if (host.includes("youtube.com")) {
      const videoId = url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop();
      if (videoId) {
        return { type: "iframe", src: `https://www.youtube.com/embed/${videoId}` };
      }
    }

    if (host.includes("vimeo.com")) {
      const videoId = url.pathname.split("/").filter(Boolean).pop();
      if (videoId) {
        return { type: "iframe", src: `https://player.vimeo.com/video/${videoId}` };
      }
    }

    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url.pathname)) {
      return { type: "video", src: url.href };
    }

    return { type: "link", src: url.href };
  } catch (error) {
    return { type: "link", src: normalizedUrl };
  }
};

const renderVideoPage = () => {
  if (!videoPage) return;

  const content = siteContent || {};
  const videos = Array.isArray(content.videos) ? content.videos : [];
  const params = new URLSearchParams(window.location.search);
  const selectedMask = params.get("mask") || "";
  const maskLabel = videoMaskLabels[selectedMask] || "";
  const filteredVideos = selectedMask
    ? videos.filter((video) => video.mask === selectedMask)
    : videos;

  const title = document.querySelector("[data-video-page-title]");
  const filterLabel = document.querySelector("[data-video-filter-label]");
  const sectionTitle = document.querySelector("[data-video-section-title]");
  const count = document.querySelector("[data-video-count]");
  const grid = document.querySelector("[data-video-grid]");
  const empty = document.querySelector("[data-video-empty]");

  if (title && maskLabel) {
    title.textContent = `Videi za ${maskLabel}`;
  }

  if (filterLabel && maskLabel) {
    filterLabel.textContent = maskLabel;
  }

  if (sectionTitle) {
    sectionTitle.textContent = filteredVideos.length
      ? "Dodani video posnetki"
      : "Video galerija je trenutno prazna";
  }

  if (count) {
    count.textContent = filteredVideos.length
      ? `${filteredVideos.length} ${filteredVideos.length === 1 ? "video" : "videi"}`
      : "Video galerija je pripravljena.";
  }

  if (!grid || !empty) return;

  grid.textContent = "";
  empty.hidden = filteredVideos.length > 0;

  filteredVideos.forEach((video) => {
    const card = document.createElement("article");
    card.className = "stored-video-card";

    const embed = videoEmbed(video.url);
    const media = document.createElement("div");
    media.className = "stored-video-media";

    if (embed.type === "iframe") {
      const iframe = document.createElement("iframe");
      iframe.src = embed.src;
      iframe.title = video.title || "CleanSpace video";
      iframe.loading = "lazy";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      media.append(iframe);
    } else if (embed.type === "video") {
      const videoElement = document.createElement("video");
      videoElement.src = embed.src;
      videoElement.controls = true;
      videoElement.preload = "metadata";
      media.append(videoElement);
    } else {
      const link = document.createElement("a");
      link.href = embed.src;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Odpri video";
      media.append(link);
    }

    const copy = document.createElement("div");
    copy.className = "stored-video-copy";

    const tag = document.createElement("p");
    tag.className = "tag";
    tag.textContent = videoMaskLabels[video.mask] || "CleanSpace";

    const heading = document.createElement("h3");
    heading.textContent = video.title || "CleanSpace video";

    const description = document.createElement("p");
    description.textContent = video.description || "Dodani video za prikaz izdelka, uporabe ali navodil.";

    copy.append(tag, heading, description);
    card.append(media, copy);
    grid.append(card);
  });
};

renderVideoPage();

if (contactForm) {
  const params = new URLSearchParams(window.location.search);
  const requestedInterest = params.get("interest") || params.get("model");
  const interestSelect = contactForm.elements.namedItem("interest");
  const messageField = contactForm.elements.namedItem("message");
  const isTestRequest = contactForm.dataset.formType === "test";
  const fileInput = contactForm.querySelector("[data-file-input]");
  const fileList = contactForm.querySelector("[data-file-list]");

  fileInput?.addEventListener("change", () => {
    const names = [...fileInput.files].map((file) => file.name);
    if (fileList) {
      fileList.textContent = names.length ? names.join(", ") : "Ni izbranih datotek.";
    }
  });

  if (requestedInterest && interestSelect instanceof HTMLSelectElement) {
    const matchingOption = [...interestSelect.options].find(
      (option) => option.textContent?.trim() === requestedInterest.trim()
    );

    if (matchingOption) {
      interestSelect.value = matchingOption.value;
    }

    if (messageField instanceof HTMLTextAreaElement && !messageField.value) {
      messageField.value = isTestRequest
        ? `Pozdravljeni, masko ${requestedInterest} bi radi naročili na test. Prosim za dogovor glede termina in pogojev preizkusa.`
        : `Pozdravljeni, zanimam se za ${requestedInterest}. Prosim za dodatne informacije in ponudbo.`;
    }

    if (formNote) {
      formNote.textContent = `Izbran model: ${requestedInterest}. Ob oddaji se pripravi e-poštno sporočilo na sales@tu-val.si, pošiljanje pa potrdite v svojem e-poštnem programu.`;
    }
  }
}

contactForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = contactForm.querySelector("button[type=submit], button:not([type])");
  if (submitButton) submitButton.disabled = true;

  const formData = new FormData(contactForm);
  const name = formData.get("name")?.toString().trim() || "";
  const email = formData.get("email")?.toString().trim() || "";
  const phone = formData.get("phone")?.toString().trim() || "";
  const company = formData.get("company")?.toString().trim() || "";
  const interest = formData.get("interest")?.toString().trim() || "";
  const preferredDate = formData.get("preferredDate")?.toString().trim() || "";
  const message = formData.get("message")?.toString().trim() || "";
  const isTestRequest = contactForm.dataset.formType === "test";
  const attachmentNames = formData
    .getAll("attachments")
    .filter((file) => file instanceof File && file.name)
    .map((file) => file.name);

  if (formNote) {
    formNote.textContent = "Pošiljanje sporočila …";
  }

  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        phone,
        company,
        interest,
        preferredDate,
        message,
        isTestRequest,
        attachmentNames,
      }),
    });

    const result = await response.json();

    if (formNote) {
      if (result.ok) {
        formNote.textContent = attachmentNames.length
          ? "Sporočilo je bilo poslano. Priponke pošljite ločeno na sales@tu-val.si."
          : "Sporočilo je bilo uspešno poslano. Kmalu se vam oglasimo.";
      } else {
        formNote.textContent = result.message || "Pošiljanje ni uspelo. Prosimo, poskusite znova ali nas kontaktirajte po telefonu.";
      }
    }

    if (result.ok) {
      contactForm.reset();
    }
  } catch (error) {
    if (formNote) {
      formNote.textContent = "Napaka pri pošiljanju. Preverite internetno povezavo ali nas kontaktirajte po telefonu.";
    }
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});
