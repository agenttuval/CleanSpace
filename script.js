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
    src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/CleanSpace-WORK-Welding.jpg-uCrTLnLFWTgLT44u8oGRNKkdRBMwL3.jpeg",
  },
  {
    model: "CleanSpace CST PRO",
    src: "https://cleanspacetechnology.com/wp-content/uploads/2024/06/CleanSpace-CST-PRO-02.jpg",
  },
  {
    model: "CleanSpace CST ULTRA",
    src: "https://cleanspacetechnology.com/wp-content/uploads/2024/11/CleanSpace-CST-ULTRA-Fire-Investigation-Image-28-scaled.jpg",
  },
  {
    model: "CleanSpace EX",
    src: "https://cleanspacetechnology.com/wp-content/uploads/2021/03/17-CleanSpace-EX-with-Full-Face-Mask-and-Coverall-Filter.jpg",
  },
  {
    model: "CleanSpace HALO",
    src: "https://cleanspacetechnology.com/wp-content/uploads/2024/11/CleanSpace-HALO-for-Healthcare-7.jpg",
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

const languageStorageKey = "tuval-cleanspace-language";
const supportedLanguages = ["sl", "en", "hr"];
const languageLabels = {
  sl: "SL",
  en: "EN",
  hr: "HR",
};

const languageNames = {
  sl: "Slovenščina",
  en: "English",
  hr: "Hrvatski",
};

const languageTranslations = {
  en: {
    common: [
      { selector: ".site-nav a:nth-child(1)", text: "Home" },
      { selector: ".site-nav a:nth-child(2)", text: "Masks" },
      { selector: ".site-nav a:nth-child(3)", text: "Test" },
      { selector: ".site-nav a:nth-child(4)", text: "Contact" },
      { selector: ".menu-toggle", attribute: "aria-label", text: "Open navigation" },
      { selector: ".choice-actions .details", text: "Details", all: true },
      { selector: ".choice-actions .ghost.dark", text: "Contact", all: true },
    ],
    "index.html": [
      { selector: ".hero-content .eyebrow", text: "Respiratory protection for the future" },
      { selector: ".hero-content h1", text: "CleanSpace respirators" },
      {
        selector: ".hero-content .lead",
        text: "Compact powered air-purifying respirators from Tu-Val, designed without belts and hoses for demanding working environments.",
      },
      { selector: ".hero-actions .primary", text: "View masks" },
      { selector: ".hero-actions .ghost", text: "Send inquiry" },
      { selector: ".hero-panel .panel-label", text: "Key benefits" },
      { selector: ".metric-grid div:nth-child(1) span", text: "% filtration" },
      { selector: ".metric-grid div:nth-child(2) span", text: "light unit" },
      { selector: ".metric-grid div:nth-child(3) span", text: "runtime" },
      { selector: ".intro-band .section-copy h2", text: "Engineering partner for a safer workplace" },
      {
        selector: ".intro-band .section-copy > p:not(.eyebrow)",
        text: "Tu-Val is a technical supplier from Domžale combining consulting, distribution, production and after-sales support. The CleanSpace program supports welding, industry, medicine and maintenance with advanced respiratory protection solutions.",
      },
      { selector: ".capability-grid article:nth-child(1) h3", text: "Selection support" },
      {
        selector: ".capability-grid article:nth-child(1) p",
        text: "Respirator, mask and filter selection based on the environment, exposure and type of work.",
      },
      { selector: ".capability-grid article:nth-child(2) h3", text: "Professional use" },
      {
        selector: ".capability-grid article:nth-child(2) p",
        text: "Solutions for welding, dust, pharmaceutical work, laboratories, disinfection and potentially explosive areas.",
      },
      { selector: ".capability-grid article:nth-child(3) h3", text: "After-sales support" },
      {
        selector: ".capability-grid article:nth-child(3) p",
        text: "Contact, accessories, filters, spare parts and help with correct equipment use.",
      },
      { selector: ".products-preview .section-heading .eyebrow", text: "Product range" },
      { selector: ".products-preview .section-heading h2", text: "Short overview of CleanSpace masks" },
      { selector: ".product-card:nth-child(1) .tag", text: "Dust and workshop" },
      {
        selector: ".product-card:nth-child(1) div > p:last-child",
        text: "The lightest industrial powered air-purifying respirator for high-dust environments, woodworking, concrete and welding.",
      },
      { selector: ".product-card:nth-child(2) .tag", text: "Industry" },
      {
        selector: ".product-card:nth-child(2) div > p:last-child",
        text: "A durable connected system for demanding tasks, with Bluetooth connection to the CleanSpace app.",
      },
      { selector: ".product-card:nth-child(3) .tag", text: "Decontamination" },
      {
        selector: ".product-card:nth-child(3) div > p:last-child",
        text: "Advanced powered respiratory protection for environments where IP65 protection, usage data and compliance monitoring matter.",
      },
      { selector: ".product-card:nth-child(4) .tag", text: "Hazardous areas" },
      {
        selector: ".product-card:nth-child(4) div > p:last-child",
        text: "Intrinsically safe powered respiratory protection for explosive atmospheres, chemical handling, petrochemicals, oil and gas.",
      },
      { selector: ".product-card:nth-child(5) .tag", text: "Healthcare" },
      {
        selector: ".product-card:nth-child(5) div > p:last-child",
        text: "For healthcare, pharmaceutical and laboratory environments where comfort and decontamination are critical.",
      },
      { selector: ".center-action .button", text: "Compare models" },
      { selector: ".difference-copy .eyebrow", text: "AirSensit technology" },
      { selector: ".difference-copy h2", text: "Breathing support that responds to the wearer" },
      {
        selector: ".difference-copy > p:not(.eyebrow)",
        text: "CleanSpace systems are positive-pressure powered air-purifying respirators. AirSensit technology responds to the wearer’s breathing and adjusts the flow of fresh filtered air, reducing effort during longer use.",
      },
      { selector: ".check-list li:nth-child(1)", text: "No belts, hoses or battery backpacks." },
      { selector: ".check-list li:nth-child(2)", text: "Audible and visual alarms for safer work." },
      { selector: ".check-list li:nth-child(3)", text: "Half-mask or full-face-mask options on selected models." },
      { selector: ".certification-section .section-heading .eyebrow", text: "Official certifications" },
      { selector: ".certification-section .section-heading h2", text: "Standards and approvals" },
      {
        selector: ".certification-section .section-heading p:not(.eyebrow)",
        text: "CleanSpace lists approvals for different models and configurations. Final selection depends on the mask, filter and work environment.",
      },
      { selector: ".certification-card:nth-child(1) h3", text: "European respiratory standard" },
      {
        selector: ".certification-card:nth-child(1) p",
        text: "EN12942 for powered air-purifying respirators.",
      },
      { selector: ".certification-card:nth-child(2) h3", text: "NIOSH approval" },
      {
        selector: ".certification-card:nth-child(2) p",
        text: "Approved for selected complete respirator assemblies and filters.",
      },
      { selector: ".certification-card:nth-child(3) h3", text: "Australia/New Zealand standard" },
      {
        selector: ".certification-card:nth-child(3) p",
        text: "AS/NZS 1716 for certified CleanSpace respirator systems.",
      },
      { selector: ".certification-card:nth-child(4) h3", text: "IECEx and ATEX" },
      {
        selector: ".certification-card:nth-child(4) p",
        text: "For selected intrinsically safe versions in EX areas.",
      },
      { selector: ".certification-card:nth-child(5) h3", text: "Dust and water protection" },
      {
        selector: ".certification-card:nth-child(5) p",
        text: "IP66 marks equipment protection against dust and powerful water jets.",
      },
      { selector: ".certification-card:nth-child(6) h3", text: "Quality management system" },
      {
        selector: ".certification-card:nth-child(6) p",
        text: "ISO 9001 for development, production and support.",
      },
      { selector: ".certification-note .button", text: "CleanSpace comparison" },
    ],
    "maske.html": [
      { selector: ".page-hero-copy .eyebrow", text: "Choose a model" },
      { selector: ".page-hero-copy h1", text: "Masks" },
      {
        selector: ".page-hero-copy .lead",
        text: "Choose a CleanSpace model and quickly compare which respirator is best suited for each type of use.",
      },
      { selector: ".mask-overview-section .section-heading .eyebrow", text: "Overview" },
      { selector: ".mask-overview-section .section-heading h2", text: "Choose a respirator" },
      { selector: ".mask-choice-card:nth-child(1) .tag", text: "Dust and workshop" },
      {
        selector: ".mask-choice-card:nth-child(1) .mask-summary",
        text: "A light respirator for dust, fumes and particles in workshops, grinding, cutting and welding. Designed for half-mask use and fast filter changes.",
      },
      { selector: ".mask-choice-card:nth-child(2) .tag", text: "Industry" },
      {
        selector: ".mask-choice-card:nth-child(2) .mask-summary",
        text: "A universal industrial model for longer shifts, particulate or combination filters, and use with a half mask or full-face mask.",
      },
      { selector: ".mask-choice-card:nth-child(3) .tag", text: "Decontamination" },
      {
        selector: ".mask-choice-card:nth-child(3) .mask-summary",
        text: "A more robust version for demanding environments where cleaning and reliable operation with CST filters are important.",
      },
      { selector: ".mask-choice-card:nth-child(4) .tag", text: "Hazardous areas" },
      {
        selector: ".mask-choice-card:nth-child(4) .mask-summary",
        text: "A model for explosive atmospheres and industrial processes requiring special EX filters, accessories and a higher level of safety.",
      },
      { selector: ".mask-choice-card:nth-child(5) .tag", text: "Healthcare" },
      {
        selector: ".mask-choice-card:nth-child(5) .mask-summary",
        text: "A respirator for healthcare, laboratories and pharmaceutical work, with half-mask or full-face-mask options and HEPA/Bio filtration.",
      },
    ],
    "kontakt.html": [
      { selector: ".contact-copy .eyebrow", text: "Contact" },
      { selector: ".contact-copy h1", text: "Let’s discuss respiratory protection for your company" },
      {
        selector: ".contact-copy .lead",
        text: "Send an inquiry for CleanSpace respirators, filters, masks or technical support in selecting equipment for your workplace.",
      },
      { selector: ".contact-card p:nth-of-type(1)", text: "Mon. - Fri.: 8:00 - 15:00" },
      { selector: ".contact-card p:nth-of-type(2)", text: "Sat. - Sun.: closed" },
      { selector: ".form-heading .eyebrow", text: "Inquiry" },
      { selector: ".form-heading h2", text: "Send your details" },
      { selector: ".contact-form label:nth-of-type(1)", text: "Full name" },
      { selector: ".contact-form label:nth-of-type(2)", text: "Email" },
      { selector: ".contact-form label:nth-of-type(3)", text: "Company" },
      { selector: ".contact-form label:nth-of-type(4)", text: "I am interested in" },
      { selector: ".contact-form label:nth-of-type(5)", text: "Message" },
      { selector: ".contact-form select option:last-child", text: "I am not sure yet, I need advice" },
      { selector: ".contact-form button", text: "Send inquiry" },
      { selector: ".form-note", text: "When submitted, the details are sent to sales@tu-val.si." },
      { selector: ".location-details h2", text: "Where to find us" },
      {
        selector: ".location-details p",
        text: "Tu-Val is located in Domžale, at Breznikova ulica 26. Please arrange visits, pickup or technical consulting in advance by phone or email.",
      },
      { selector: ".location-details .button", text: "Open map" },
    ],
    "test.html": [
      { selector: ".contact-copy .eyebrow", text: "Test mask request" },
      { selector: ".contact-copy h1", text: "Request a CleanSpace mask for testing" },
      {
        selector: ".contact-copy .lead",
        text: "Fill in the basic details and Tu-Val will help select a suitable CleanSpace respirator for testing in your working environment.",
      },
      { selector: ".contact-card h2", text: "What happens after submission?" },
      { selector: ".contact-card p:nth-of-type(1)", text: "The Tu-Val team receives your test request details." },
      { selector: ".contact-card p:nth-of-type(2)", text: "After submission, the data is automatically sent to sales@tu-val.si." },
      { selector: ".contact-card .button", text: "Call Tu-Val" },
      { selector: ".form-heading .eyebrow", text: "Equipment test" },
      { selector: ".form-heading h2", text: "I want to test a mask" },
      { selector: ".contact-form label:nth-of-type(1)", text: "Full name" },
      { selector: ".contact-form label:nth-of-type(2)", text: "Email" },
      { selector: ".contact-form label:nth-of-type(3)", text: "Phone" },
      { selector: ".contact-form label:nth-of-type(4)", text: "Company" },
      { selector: ".contact-form label:nth-of-type(5)", text: "Which mask would you like to test?" },
      { selector: ".contact-form label:nth-of-type(6)", text: "Preferred testing date" },
      { selector: ".contact-form input[name='preferredDate']", attribute: "placeholder", text: "e.g. next week, morning" },
      { selector: ".contact-form label:nth-of-type(7)", text: "Description of the working environment" },
      {
        selector: ".contact-form textarea[name='message']",
        attribute: "placeholder",
        text: "Where would the mask be used, what dust/gases are present, how many users would like to test it ...",
      },
      { selector: ".contact-form label:nth-of-type(8)", text: "Files" },
      { selector: ".file-upload-button", text: "Add files" },
      { selector: ".file-upload-list", text: "No files selected." },
      { selector: ".contact-form select option:last-child", text: "I am not sure yet, I need advice" },
      { selector: ".contact-form button", text: "Send test request" },
      { selector: ".form-note", text: "When submitted, the details are sent to sales@tu-val.si." },
      { selector: ".test-side-panel .location-details h2", text: "It is easier to choose after a trial" },
      {
        selector: ".test-side-panel .location-details p",
        text: "Testing helps check comfort, mask fit, filter selection and suitability for real company conditions.",
      },
      { selector: ".test-side-panel .location-details .button", text: "View models" },
    ],
    "videi.html": [
      { selector: ".video-hero .eyebrow", text: "Videos" },
      { selector: ".video-hero h1", text: "CleanSpace videos" },
    ],
  },
  hr: {
    common: [
      { selector: ".site-nav a:nth-child(1)", text: "Početna" },
      { selector: ".site-nav a:nth-child(2)", text: "Maske" },
      { selector: ".site-nav a:nth-child(3)", text: "Test" },
      { selector: ".site-nav a:nth-child(4)", text: "Kontakt" },
      { selector: ".menu-toggle", attribute: "aria-label", text: "Otvori navigaciju" },
      { selector: ".choice-actions .details", text: "Detalji", all: true },
      { selector: ".choice-actions .ghost.dark", text: "Kontakt", all: true },
    ],
    "index.html": [
      { selector: ".hero-content .eyebrow", text: "Respiratorna zaštita budućnosti" },
      { selector: ".hero-content h1", text: "CleanSpace respiratori" },
      {
        selector: ".hero-content .lead",
        text: "Kompaktni respiratori s aktivnim dovodom filtriranog zraka pri Tu-Valu, bez pojaseva i cijevi, namijenjeni za zahtjevna radna okruženja.",
      },
      { selector: ".hero-actions .primary", text: "Pogledaj maske" },
      { selector: ".hero-actions .ghost", text: "Upit" },
      { selector: ".hero-panel .panel-label", text: "Ključne prednosti" },
      { selector: ".metric-grid div:nth-child(1) span", text: "% filtracija" },
      { selector: ".metric-grid div:nth-child(2) span", text: "lagana jedinica" },
      { selector: ".metric-grid div:nth-child(3) span", text: "rada" },
      { selector: ".intro-band .section-copy h2", text: "Inženjerski partner za sigurnije radno okruženje" },
      {
        selector: ".intro-band .section-copy > p:not(.eyebrow)",
        text: "Tu-Val je tehnički dobavljač iz Domžala koji povezuje savjetovanje, distribuciju, proizvodnju i podršku nakon kupnje. Program CleanSpace nadopunjuje zavarivanje, industriju, medicinu i održavanje naprednim rješenjima za zaštitu dišnih puteva.",
      },
      { selector: ".capability-grid article:nth-child(1) h3", text: "Savjetovanje pri odabiru" },
      {
        selector: ".capability-grid article:nth-child(1) p",
        text: "Odabir respiratora, maske i filtra prema okruženju, izloženosti i načinu rada.",
      },
      { selector: ".capability-grid article:nth-child(2) h3", text: "Profesionalna uporaba" },
      {
        selector: ".capability-grid article:nth-child(2) p",
        text: "Rješenja za zavarivanje, prašinu, farmaciju, laboratorije, dezinfekciju i eksplozijski ugrožena područja.",
      },
      { selector: ".capability-grid article:nth-child(3) h3", text: "Podrška nakon kupnje" },
      {
        selector: ".capability-grid article:nth-child(3) p",
        text: "Kontakt, dodaci, filtri, rezervni dijelovi i pomoć pri pravilnoj uporabi opreme.",
      },
      { selector: ".products-preview .section-heading .eyebrow", text: "Pregled linije" },
      { selector: ".products-preview .section-heading h2", text: "Kratki pregled CleanSpace maski" },
      { selector: ".product-card:nth-child(1) .tag", text: "Prašina i radionica" },
      {
        selector: ".product-card:nth-child(1) div > p:last-child",
        text: "Najlakši industrijski respirator s aktivnim dovodom zraka za prašnjava okruženja, obradu drva, beton i zavarivanje.",
      },
      { selector: ".product-card:nth-child(2) .tag", text: "Industrija" },
      {
        selector: ".product-card:nth-child(2) div > p:last-child",
        text: "Izdržljiv i povezan sustav za zahtjevne zadatke, s Bluetooth vezom na CleanSpace aplikaciju.",
      },
      { selector: ".product-card:nth-child(3) .tag", text: "Dekontaminacija" },
      {
        selector: ".product-card:nth-child(3) div > p:last-child",
        text: "Napredni respirator s aktivnim dovodom zraka za okruženja gdje su važni IP65 zaštita, podaci o uporabi i nadzor usklađenosti.",
      },
      { selector: ".product-card:nth-child(4) .tag", text: "Opasna područja" },
      {
        selector: ".product-card:nth-child(4) div > p:last-child",
        text: "Intrinzično siguran respirator s aktivnim dovodom zraka za eksplozijski ugrožena područja, kemiju, petrokemiju te naftu i plin.",
      },
      { selector: ".product-card:nth-child(5) .tag", text: "Zdravstvo" },
      {
        selector: ".product-card:nth-child(5) div > p:last-child",
        text: "Za zdravstvena, farmaceutska i laboratorijska okruženja gdje su udobnost i dekontaminacija ključni.",
      },
      { selector: ".center-action .button", text: "Usporedi modele" },
      { selector: ".difference-copy .eyebrow", text: "AirSensit tehnologija" },
      { selector: ".difference-copy h2", text: "Disanje koje sustav prepoznaje i podržava" },
      {
        selector: ".difference-copy > p:not(.eyebrow)",
        text: "CleanSpace sustavi su respiratori s pozitivnim tlakom. AirSensit tehnologija reagira na disanje korisnika i prilagođava protok svježeg filtriranog zraka, što smanjuje napor pri duljoj uporabi.",
      },
      { selector: ".check-list li:nth-child(1)", text: "Bez pojaseva, cijevi i baterijskih naprtnjača." },
      { selector: ".check-list li:nth-child(2)", text: "Zvučna i vizualna upozorenja za sigurniji rad." },
      { selector: ".check-list li:nth-child(3)", text: "Opcije polumaski ili maski za cijelo lice kod odabranih modela." },
      { selector: ".certification-section .section-heading .eyebrow", text: "Službeni certifikati" },
      { selector: ".certification-section .section-heading h2", text: "Standardi i odobrenja" },
      {
        selector: ".certification-section .section-heading p:not(.eyebrow)",
        text: "CleanSpace navodi odobrenja za različite modele i konfiguracije. Konačni odabir ovisi o maski, filtru i radnom okruženju.",
      },
      { selector: ".certification-card:nth-child(1) h3", text: "Europski respiratorni standard" },
      {
        selector: ".certification-card:nth-child(1) p",
        text: "EN12942 za respiratore s aktivnim dovodom filtriranog zraka.",
      },
      { selector: ".certification-card:nth-child(2) h3", text: "NIOSH odobrenje" },
      {
        selector: ".certification-card:nth-child(2) p",
        text: "Odobreno za odabrane kompletne sklopove i filtre.",
      },
      { selector: ".certification-card:nth-child(3) h3", text: "Australski i novozelandski standard" },
      {
        selector: ".certification-card:nth-child(3) p",
        text: "AS/NZS 1716 za certificirane CleanSpace sustave.",
      },
      { selector: ".certification-card:nth-child(4) h3", text: "IECEx i ATEX" },
      {
        selector: ".certification-card:nth-child(4) p",
        text: "Za odabrane intrinzično sigurne izvedbe u EX područjima.",
      },
      { selector: ".certification-card:nth-child(5) h3", text: "Zaštita od prašine i vode" },
      {
        selector: ".certification-card:nth-child(5) p",
        text: "IP66 označuje zaštitu opreme od prašine i jakih mlazova vode.",
      },
      { selector: ".certification-card:nth-child(6) h3", text: "Sustav upravljanja kvalitetom" },
      {
        selector: ".certification-card:nth-child(6) p",
        text: "ISO 9001 za razvoj, proizvodnju i podršku.",
      },
      { selector: ".certification-note .button", text: "CleanSpace usporedba" },
    ],
    "maske.html": [
      { selector: ".page-hero-copy .eyebrow", text: "Odaberi model" },
      { selector: ".page-hero-copy h1", text: "Maske" },
      {
        selector: ".page-hero-copy .lead",
        text: "Odaberite CleanSpace model i brzo usporedite za koju je uporabu pojedini respirator najprikladniji.",
      },
      { selector: ".mask-overview-section .section-heading .eyebrow", text: "Pregled" },
      { selector: ".mask-overview-section .section-heading h2", text: "Odaberite respirator" },
      { selector: ".mask-choice-card:nth-child(1) .tag", text: "Prašina i radionica" },
      {
        selector: ".mask-choice-card:nth-child(1) .mask-summary",
        text: "Lagani respirator za prašinu, dim i čestice u radionicama, pri brušenju, rezanju i zavarivanju. Namijenjen je uporabi s polumaskom i brzoj zamjeni filtra.",
      },
      { selector: ".mask-choice-card:nth-child(2) .tag", text: "Industrija" },
      {
        selector: ".mask-choice-card:nth-child(2) .mask-summary",
        text: "Univerzalni industrijski model za dulje smjene, čestične ili kombinirane filtre te uporabu s polumaskom ili maskom za cijelo lice.",
      },
      { selector: ".mask-choice-card:nth-child(3) .tag", text: "Dekontaminacija" },
      {
        selector: ".mask-choice-card:nth-child(3) .mask-summary",
        text: "Robusnija izvedba za zahtjevnija okruženja gdje su važni čišćenje opreme i pouzdan rad s različitim CST filtrima.",
      },
      { selector: ".mask-choice-card:nth-child(4) .tag", text: "Opasna područja" },
      {
        selector: ".mask-choice-card:nth-child(4) .mask-summary",
        text: "Model za eksplozijski opasna područja i industrijske postupke gdje su potrebni posebni EX filtri, dodaci i viša razina sigurnosti.",
      },
      { selector: ".mask-choice-card:nth-child(5) .tag", text: "Zdravstvo" },
      {
        selector: ".mask-choice-card:nth-child(5) .mask-summary",
        text: "Respirator za zdravstvo, laboratorije i farmaciju, s mogućnošću polumaske ili maske za cijelo lice te HEPA/Bio filtracijom.",
      },
    ],
    "kontakt.html": [
      { selector: ".contact-copy .eyebrow", text: "Kontakt" },
      { selector: ".contact-copy h1", text: "Razgovarajmo o zaštiti dišnih puteva u vašoj tvrtki" },
      {
        selector: ".contact-copy .lead",
        text: "Pošaljite upit za CleanSpace respiratore, filtre, maske ili savjetovanje pri odabiru opreme za vaše radno okruženje.",
      },
      { selector: ".contact-card p:nth-of-type(1)", text: "Pon. - Pet.: 8:00 - 15:00" },
      { selector: ".contact-card p:nth-of-type(2)", text: "Sub. - Ned.: zatvoreno" },
      { selector: ".form-heading .eyebrow", text: "Upit" },
      { selector: ".form-heading h2", text: "Pošaljite osnovne podatke" },
      { selector: ".contact-form label:nth-of-type(1)", text: "Ime i prezime" },
      { selector: ".contact-form label:nth-of-type(2)", text: "E-pošta" },
      { selector: ".contact-form label:nth-of-type(3)", text: "Tvrtka" },
      { selector: ".contact-form label:nth-of-type(4)", text: "Zanimam se za" },
      { selector: ".contact-form label:nth-of-type(5)", text: "Poruka" },
      { selector: ".contact-form select option:last-child", text: "Još ne znam, trebam savjetovanje" },
      { selector: ".contact-form button", text: "Pošalji upit" },
      { selector: ".form-note", text: "Nakon slanja podaci se šalju na sales@tu-val.si." },
      { selector: ".location-details h2", text: "Gdje nas možete naći" },
      {
        selector: ".location-details p",
        text: "Tu-Val se nalazi u Domžalama, na Breznikovoj ulici 26. Za posjet, preuzimanje ili tehničko savjetovanje prethodno se dogovorite telefonom ili e-poštom.",
      },
      { selector: ".location-details .button", text: "Otvori kartu" },
    ],
    "test.html": [
      { selector: ".contact-copy .eyebrow", text: "Narudžba testne maske" },
      { selector: ".contact-copy h1", text: "Naručite CleanSpace masku za testiranje" },
      {
        selector: ".contact-copy .lead",
        text: "Ispunite osnovne podatke i Tu-Val će vam pomoći odabrati odgovarajući CleanSpace respirator za testiranje u vašem radnom okruženju.",
      },
      { selector: ".contact-card h2", text: "Što se događa nakon slanja?" },
      { selector: ".contact-card p:nth-of-type(1)", text: "Tim Tu-Val prima poruku s podacima za test." },
      { selector: ".contact-card p:nth-of-type(2)", text: "Nakon slanja podaci se automatski šalju na sales@tu-val.si." },
      { selector: ".contact-card .button", text: "Nazovi Tu-Val" },
      { selector: ".form-heading .eyebrow", text: "Test opreme" },
      { selector: ".form-heading h2", text: "Naručujem masku za test" },
      { selector: ".contact-form label:nth-of-type(1)", text: "Ime i prezime" },
      { selector: ".contact-form label:nth-of-type(2)", text: "E-pošta" },
      { selector: ".contact-form label:nth-of-type(3)", text: "Telefon" },
      { selector: ".contact-form label:nth-of-type(4)", text: "Tvrtka" },
      { selector: ".contact-form label:nth-of-type(5)", text: "Koju masku želite testirati?" },
      { selector: ".contact-form label:nth-of-type(6)", text: "Željeni termin testiranja" },
      { selector: ".contact-form input[name='preferredDate']", attribute: "placeholder", text: "npr. sljedeći tjedan, prijepodne" },
      { selector: ".contact-form label:nth-of-type(7)", text: "Opis radnog okruženja" },
      {
        selector: ".contact-form textarea[name='message']",
        attribute: "placeholder",
        text: "Gdje biste koristili masku, kakva prašina/plinovi su prisutni, koliko korisnika je želi testirati ...",
      },
      { selector: ".contact-form label:nth-of-type(8)", text: "Datoteke" },
      { selector: ".file-upload-button", text: "Dodaj datoteke" },
      { selector: ".file-upload-list", text: "Nema odabranih datoteka." },
      { selector: ".contact-form select option:last-child", text: "Još ne znam, trebam savjetovanje" },
      { selector: ".contact-form button", text: "Pošalji narudžbu testa" },
      { selector: ".form-note", text: "Nakon slanja podaci se šalju na sales@tu-val.si." },
      { selector: ".test-side-panel .location-details h2", text: "Lakše je odabrati nakon testiranja" },
      {
        selector: ".test-side-panel .location-details p",
        text: "Testiranje pomaže provjeriti udobnost, prianjanje maske, odabir filtra i prikladnost sustava za stvarne uvjete u tvrtki.",
      },
      { selector: ".test-side-panel .location-details .button", text: "Pogledaj modele" },
    ],
    "videi.html": [
      { selector: ".video-hero .eyebrow", text: "Videozapisi" },
      { selector: ".video-hero h1", text: "CleanSpace videozapisi" },
    ],
  },
};

const readStoredLanguage = () => {
  try {
    const savedLanguage = window.localStorage?.getItem(languageStorageKey);
    return supportedLanguages.includes(savedLanguage) ? savedLanguage : "sl";
  } catch (error) {
    return "sl";
  }
};

const writeStoredLanguage = (language) => {
  try {
    window.localStorage?.setItem(languageStorageKey, language);
  } catch (error) {
    // Language choice is still applied for the current page.
  }
};

const originalAttributeDataName = (attribute) =>
  `data-original-${attribute.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

const rememberOriginalValue = (element, attribute) => {
  if (!element) return;

  if (attribute) {
    const dataName = originalAttributeDataName(attribute);
    if (!element.hasAttribute(dataName)) {
      element.setAttribute(dataName, element.getAttribute(attribute) || "");
    }
    return;
  }

  if (!element.dataset?.originalText) {
    element.dataset.originalText = element.textContent || "";
  }
};

const directTextNode = (element) =>
  [...element.childNodes].find((node) => node.nodeType === 3 && node.textContent.trim());

const setTranslatedText = (element, text) => {
  if (!element) return;

  const textNode = element.children.length ? directTextNode(element) : null;
  if (textNode) {
    if (!element.hasAttribute("data-original-direct-text")) {
      element.setAttribute("data-original-direct-text", textNode.textContent);
    }

    const leading = textNode.textContent.match(/^\s*/)?.[0] || "";
    const trailing = textNode.textContent.match(/\s*$/)?.[0] || "";
    textNode.textContent = `${leading}${text}${trailing}`;
    return;
  }

  rememberOriginalValue(element);
  element.textContent = text;
};

const restoreOriginalLanguageText = () => {
  document.querySelectorAll("[data-original-direct-text]").forEach((element) => {
    const textNode = directTextNode(element);
    if (textNode) {
      textNode.textContent = element.getAttribute("data-original-direct-text") || "";
    }
  });

  document.querySelectorAll("[data-original-text]").forEach((element) => {
    element.textContent = element.dataset.originalText || "";
  });

  ["placeholder", "aria-label", "title"].forEach((attribute) => {
    const dataName = originalAttributeDataName(attribute);
    document.querySelectorAll(`[${dataName}]`).forEach((element) => {
      element.setAttribute(attribute, element.getAttribute(dataName) || "");
    });
  });
};

const entriesForLanguage = (language) => {
  const translations = languageTranslations[language] || {};
  const pageName = currentPageName();
  const contentKey = currentContentKey();

  return [
    ...(translations.common || []),
    ...(translations[pageName] || []),
    ...(translations[contentKey] || []),
  ];
};

const applyLanguageEntry = (entry) => {
  if (!entry?.selector || typeof entry.text !== "string") return;

  const elements = entry.all
    ? document.querySelectorAll(entry.selector)
    : [document.querySelector(entry.selector)];

  elements.forEach((element) => {
    if (!element) return;

    if (entry.attribute) {
      rememberOriginalValue(element, entry.attribute);
      element.setAttribute(entry.attribute, entry.text);
      return;
    }

    setTranslatedText(element, entry.text);
  });
};

const updateLanguageButtons = (language) => {
  document.querySelectorAll("[data-language-option]").forEach((button) => {
    const isActive = button.getAttribute("data-language-option") === language;
    toggleClass(button, "is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
};

const applySiteLanguage = (language, persist = true) => {
  const selectedLanguage = supportedLanguages.includes(language) ? language : "sl";
  restoreOriginalLanguageText();
  document.documentElement.lang = selectedLanguage === "hr" ? "hr" : selectedLanguage;

  if (selectedLanguage !== "sl") {
    entriesForLanguage(selectedLanguage).forEach(applyLanguageEntry);
  }

  updateLanguageButtons(selectedLanguage);

  if (persist) {
    writeStoredLanguage(selectedLanguage);
  }
};

const setupLanguageSwitcher = () => {
  if (!nav || nav.querySelector("[data-language-switcher]")) return;

  const switcher = document.createElement("div");
  switcher.className = "language-switcher";
  switcher.setAttribute("data-language-switcher", "");
  switcher.setAttribute("aria-label", "Izbira jezika");

  supportedLanguages.forEach((language) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = languageLabels[language];
    button.setAttribute("data-language-option", language);
    button.setAttribute("aria-label", languageNames[language]);
    button.setAttribute("aria-pressed", "false");

    on(button, "click", () => {
      applySiteLanguage(language);
    });

    switcher.append(button);
  });

  nav.append(switcher);
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

setupLanguageSwitcher();
applySiteLanguage(readStoredLanguage(), false);

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

  on(fileInput, "change", () => {
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
      formNote.textContent = `Izbran model: ${requestedInterest}. Ob oddaji se podatki pošljejo na sales@tu-val.si.`;
    }
  }
}

on(contactForm, "submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(contactForm);
  const submitButton = contactForm.querySelector('button[type="submit"]');
  const originalButtonText = submitButton?.textContent || "";
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
    .filter((file) => typeof File !== "undefined" && file instanceof File && file.name)
    .map((file) => file.name);

  if (formNote) {
    formNote.textContent = "Pošiljam sporočilo...";
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Pošiljam...";
  }

  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formType: isTestRequest ? "test" : "contact",
        name,
        email,
        phone,
        company,
        interest,
        preferredDate,
        message,
        attachments: attachmentNames,
        page: window.location.href,
      }),
    });
    const responseText = await response.text();
    let result = {};

    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
      result = {};
    }

    if (!response.ok || !result.ok) {
      throw new Error(result.message || responseText || "Pošiljanje ni uspelo.");
    }

    contactForm.reset();
    const submitFileList = contactForm.querySelector("[data-file-list]");
    if (submitFileList) {
      submitFileList.textContent = "Ni izbranih datotek.";
    }
    if (formNote) {
      formNote.textContent = "Sporočilo je bilo poslano na sales@tu-val.si.";
    }
  } catch (error) {
    if (formNote) {
      formNote.textContent = `Pošiljanje ni uspelo: ${error.message}`;
    }
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  }
});
