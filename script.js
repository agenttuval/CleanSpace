const loadContentTexts = () => {
  try {
    const request = new XMLHttpRequest();
    request.open("GET", `content/site.json?updated=${Date.now()}`, false);
    request.send(null);

    if (request.status >= 200 && request.status < 300) {
      return JSON.parse(request.responseText);
    }
  } catch (error) {
    return null;
  }

  return null;
};

const mergeTextEntries = (fallbackEntries = [], contentEntries = []) => {
  const merged = new Map();

  [...fallbackEntries, ...contentEntries].forEach((entry) => {
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

const applyEditableTexts = () => {
  const textGroups = mergeTextGroups(window.TUVAL_TEXTS || {}, loadContentTexts() || {});
  if (!Object.keys(textGroups).length) return;

  const pageName = window.location.pathname.split("/").pop() || "index.html";
  const contentPageNames = {
    "index.html": "index",
    "maske.html": "maske",
    "kontakt.html": "kontakt",
    "test.html": "test",
    "cleanspace-work.html": "cleanspace_work",
    "cleanspace-cst-pro.html": "cleanspace_cst_pro",
    "cleanspace-cst-ultra.html": "cleanspace_cst_ultra",
    "cleanspace-ex.html": "cleanspace_ex",
    "cleanspace-halo.html": "cleanspace_halo",
  };
  const pageEntries = mergeTextEntries(
    textGroups[pageName] || [],
    textGroups[contentPageNames[pageName]] || []
  );
  const entries = [...(textGroups.common || []), ...pageEntries];

  entries.forEach((entry) => {
    if (!entry?.selector || typeof entry.text !== "string" || !entry.text.trim()) return;

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
    });
  });
};

applyEditableTexts();

const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const nav = document.querySelector("[data-nav]");
const revealItems = document.querySelectorAll(".reveal");
const contactForm = document.querySelector("[data-contact-form]");
const formNote = document.querySelector("[data-form-note]");
const heroRotator = document.querySelector("[data-hero-rotator]");

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

const setHeaderState = () => {
  if (!header) return;
  header.classList.toggle("is-scrolled", window.scrollY > 24);
};

setHeaderState();
window.addEventListener("scroll", setHeaderState, { passive: true });

menuToggle?.addEventListener("click", () => {
  document.body.classList.toggle("nav-open");
});

nav?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    document.body.classList.remove("nav-open");
  }
});

if (heroRotator) {
  let heroSlideIndex = 0;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  heroRotatorSlides.forEach((slide) => {
    const image = new Image();
    image.src = slide.src;
  });

  heroRotator.dataset.currentModel = heroRotatorSlides[heroSlideIndex].model;

  if (!prefersReducedMotion) {
    window.setInterval(() => {
      heroSlideIndex = (heroSlideIndex + 1) % heroRotatorSlides.length;
      const nextSlide = heroRotatorSlides[heroSlideIndex];

      heroRotator.classList.add("is-changing");

      window.setTimeout(() => {
        heroRotator.src = nextSlide.src;
        heroRotator.dataset.currentModel = nextSlide.model;
        heroRotator.classList.remove("is-changing");
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

  card.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a, button")) return;
    openCardLink();
  });

  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target instanceof Element && event.target.closest("a, button")) return;
    event.preventDefault();
    openCardLink();
  });
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { rootMargin: "0px 0px -6% 0px", threshold: 0.04 }
);

revealItems.forEach((item, index) => {
  item.style.transitionDelay = `${Math.min(index * 45, 240)}ms`;
  revealObserver.observe(item);
});

const revealVisibleItems = () => {
  revealItems.forEach((item) => {
    if (item.classList.contains("is-visible")) return;

    const rect = item.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.94 && rect.bottom > 0) {
      item.classList.add("is-visible");
      revealObserver.unobserve(item);
    }
  });
};

window.addEventListener("load", revealVisibleItems);
window.addEventListener("resize", revealVisibleItems);
setTimeout(revealVisibleItems, 350);

document.querySelectorAll(".detail-block").forEach((block) => {
  const heading = block.querySelector("h4")?.textContent?.trim().toLowerCase() || "";
  if (!heading.includes("filtri") && !heading.includes("pripomo")) return;

  block.querySelector("ul")?.classList.add("visual-parts");

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
    item.classList.add("part-card");
    item.append(image, copy);
  });
});

if (contactForm) {
  const params = new URLSearchParams(window.location.search);
  const requestedInterest = params.get("interest") || params.get("model");
  const interestSelect = contactForm.elements.namedItem("interest");
  const messageField = contactForm.elements.namedItem("message");
  const isTestRequest = contactForm.dataset.formType === "test";

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

contactForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(contactForm);
  const name = formData.get("name")?.toString().trim() || "";
  const email = formData.get("email")?.toString().trim() || "";
  const phone = formData.get("phone")?.toString().trim() || "";
  const company = formData.get("company")?.toString().trim() || "";
  const interest = formData.get("interest")?.toString().trim() || "";
  const preferredDate = formData.get("preferredDate")?.toString().trim() || "";
  const message = formData.get("message")?.toString().trim() || "";
  const isTestRequest = contactForm.dataset.formType === "test";
  const attachment = formData.get("attachment");
  const attachmentName = attachment instanceof File && attachment.name ? attachment.name : "";

   const bodyLines = [
    `Ime: ${name}`,
     `E-pošta: ${email}`,
     phone ? `Telefon: ${phone}` : null,
    `Podjetje: ${company || "-"}`,
    `Zanimanje: ${interest}`,
     preferredDate ? `Želeni termin testiranja: ${preferredDate}` : null,
     attachmentName ? `Priponka za dodati: ${attachmentName}` : null,
     "",
     message,
    ].filter((line) => line !== null);

  const body = bodyLines.join("\n");

  const mailto = new URL("mailto:sales@tu-val.si");
  mailto.searchParams.set(
    "subject",
    `${isTestRequest ? "Naročilo maske na test" : "Povpraševanje CleanSpace"} - ${interest}`
  );
  mailto.searchParams.set("body", body);

  window.location.href = mailto.toString();

  if (formNote) {
    formNote.textContent = "E-poštno sporočilo je pripravljeno. Za dejansko pošiljanje kliknite Pošlji v svojem e-poštnem programu.";
  }
  const attachmentInput = document.querySelector("#attachment");
const fileName = document.querySelector("#fileName");

if (attachmentInput && fileName) {
  attachmentInput.addEventListener("change", () => {
    fileName.textContent = attachmentInput.files.length
      ? attachmentInput.files[0].name
      : "Datoteka ni izbrana";
  });
}
