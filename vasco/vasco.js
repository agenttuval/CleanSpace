const form = document.querySelector("[data-form]");
const exportButton = document.querySelector("[data-export]");
const clearButton = document.querySelector("[data-clear]");
const statusEl = document.querySelector("[data-status]");
const tableBody = document.querySelector("[data-table-body]");
const orderCountEl = document.querySelector("[data-order-count]");
const itemCountEl = document.querySelector("[data-item-count]");
const totalEl = document.querySelector("[data-total]");
const apiFields = document.querySelector("[data-api-fields]");
const manualFields = document.querySelector("[data-manual-fields]");
const downloadPanel = document.querySelector("[data-download-panel]");
const downloadLink = document.querySelector("[data-download-link]");

let lastOrders = [];
let activeDownloadUrl = "";

const numberFormatter = new Intl.NumberFormat("sl-SI", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("sl-SI");

const setStatus = (message, type = "") => {
  statusEl.textContent = message;
  statusEl.className = `status-pill${type ? ` is-${type}` : ""}`;
};

const clearDownloadLink = () => {
  if (activeDownloadUrl) {
    URL.revokeObjectURL(activeDownloadUrl);
    activeDownloadUrl = "";
  }

  downloadPanel.hidden = true;
  downloadLink.removeAttribute("href");
  downloadLink.removeAttribute("download");
};

const setDownloadLink = (blob, fileName) => {
  clearDownloadLink();
  activeDownloadUrl = URL.createObjectURL(blob);
  downloadLink.href = activeDownloadUrl;
  downloadLink.download = fileName;
  downloadPanel.hidden = false;
};

const setBusy = (busy) => {
  form.querySelectorAll("button, input").forEach((element) => {
    element.disabled = busy;
  });
};

const formPayload = () => {
  const data = new FormData(form);

  return {
    bearerToken: String(data.get("token") || "").trim(),
    filters: {
      partner: String(data.get("partner") || "").trim(),
      stevilkaLeto: String(data.get("stevilkaLeto") || "").trim(),
      datumOd: String(data.get("datumOd") || "").trim(),
      datumDo: String(data.get("datumDo") || "").trim(),
      artikel: String(data.get("artikel") || "").trim(),
      blockSize: String(data.get("blockSize") || "10000").trim(),
      blockIndex: String(data.get("blockIndex") || "0").trim(),
      vrniPostavke: Boolean(data.get("vrniPostavke")),
      vrniOznakoPriloge: Boolean(data.get("vrniOznakoPriloge")),
    },
  };
};

const currentMode = () => form.querySelector('input[name="sourceMode"]:checked')?.value || "api";

const toggleSourceMode = () => {
  const jsonMode = currentMode() === "json";
  apiFields.hidden = jsonMode;
  manualFields.hidden = !jsonMode;
  setStatus("Pripravljen");
};

const findOrderArray = (value) => {
  if (Array.isArray(value)) return value;

  if (!value || typeof value !== "object") {
    throw new Error("JSON mora vsebovati seznam naročil.");
  }

  if (value.openapi && value.paths) {
    throw new Error("To je Swagger/OpenAPI opis. Za Excel prilepi JSON odgovor iz Response body.");
  }

  const arrayKeys = ["orders", "narocila", "data", "items", "value", "result", "results"];
  for (const key of arrayKeys) {
    if (Array.isArray(value[key])) return value[key];
  }

  if ("stevilka" in value || "leto" in value || "partner" in value) {
    return [value];
  }

  throw new Error("V JSON-u ne najdem seznama naročil.");
};

const manualOrders = () => {
  const rawText = form.elements.jsonText.value.trim();
  if (!rawText) {
    throw new Error("Prilepi JSON odgovor ali naloži JSON datoteko.");
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new Error("JSON ni veljaven.");
  }

  return findOrderArray(parsed);
};

const readError = async (response) => {
  const text = await response.text();
  if (!text) return "Zahteva ni uspela.";

  try {
    const parsed = JSON.parse(text);
    return parsed.message || parsed.title || text;
  } catch (error) {
    return text;
  }
};

const postJson = async (url, payload) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json();
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date);
};

const formatMoney = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? numberFormatter.format(number) : "";
};

const countItems = (orders) =>
  orders.reduce((count, order) => count + (Array.isArray(order.postavke) ? order.postavke.length : 0), 0);

const totalWithVat = (orders) =>
  orders.reduce((sum, order) => {
    const value = Number(order.znesekZDDV);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

const firstValue = (object, keys) => {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return "";
};

const itemCode = (item) => firstValue(item, ["sifra", "sifraArtikla", "sifra_artikla", "artikel"]);

const itemName = (item) =>
  firstValue(item, ["naziv_artikla", "nazivArtikla", "nazivArt", "naziv", "opisArtikla", "opis_artikla"]);

const itemQuantity = (item) => firstValue(item, ["kolicina", "količina", "kol"]);

const itemPrice = (item) =>
  firstValue(item, ["cena", "prodajnaCena", "prodajna_cena", "prodajnaCenaZDDV", "prodajnaCenaZDdv"]);

const previewRows = (orders) =>
  orders.flatMap((order) => {
    const items = Array.isArray(order.postavke) ? order.postavke : [];
    return items.length ? items.map((item) => ({ order, item })) : [{ order, item: null }];
  });

const addCell = (row, value, className = "") => {
  const cell = document.createElement("td");
  cell.textContent = value ?? "";
  if (className) cell.className = className;
  row.append(cell);
};

const renderTable = (orders) => {
  tableBody.innerHTML = "";

  if (!orders.length) {
    const row = document.createElement("tr");
    addCell(row, "Ni prikazanih podatkov.", "empty");
    row.firstElementChild.colSpan = 12;
    tableBody.append(row);
    return;
  }

  previewRows(orders).slice(0, 150).forEach(({ order, item }) => {
    const row = document.createElement("tr");
    addCell(row, order.stevilka);
    addCell(row, order.leto);
    addCell(row, formatDate(order.datum));
    addCell(row, order.partner);
    addCell(row, itemCode(item));
    addCell(row, itemName(item));
    addCell(row, itemQuantity(item));
    addCell(row, formatMoney(itemPrice(item)));
    addCell(row, order.komercialist);
    addCell(row, formatMoney(order.znesek));
    addCell(row, formatMoney(order.znesekZDDV));
    addCell(row, Array.isArray(order.postavke) ? order.postavke.length : 0);
    tableBody.append(row);
  });
};

const renderMetrics = (orders) => {
  orderCountEl.textContent = String(orders.length);
  itemCountEl.textContent = String(countItems(orders));
  totalEl.textContent = formatMoney(totalWithVat(orders));
};

const loadPreview = async () => {
  clearDownloadLink();
  const mode = currentMode();
  let payload = null;
  let parsedOrders = null;

  try {
    if (mode === "json") {
      parsedOrders = manualOrders();
    } else {
      payload = formPayload();
    }
  } catch (error) {
    setStatus(error.message, "error");
    return;
  }

  setBusy(true);
  setStatus(mode === "json" ? "Berem JSON" : "Pridobivam podatke");

  try {
    if (mode === "json") {
      lastOrders = parsedOrders;
      renderMetrics(lastOrders);
      renderTable(lastOrders);
      setStatus(`${lastOrders.length} naročil iz JSON`, "ok");
      return;
    }

    const data = await postJson("/api/vasco/narocila-kupca", payload);
    lastOrders = data.orders || [];
    renderMetrics(lastOrders);
    renderTable(lastOrders);
    setStatus(`${data.count} naročil`, "ok");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setBusy(false);
  }
};

const downloadExcel = async () => {
  clearDownloadLink();
  const mode = currentMode();
  let endpoint = "/api/vasco/narocila-kupca/excel";
  let body = null;

  try {
    if (mode === "json") {
      endpoint = "/api/vasco/narocila-kupca/excel-json";
      body = { orders: manualOrders() };
    } else {
      body = formPayload();
    }
  } catch (error) {
    setStatus(error.message, "error");
    return;
  }

  setBusy(true);
  setStatus("Pripravljam Excel");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const fileNameMatch = disposition.match(/filename="([^"]+)"/);
    const fileName = fileNameMatch ? fileNameMatch[1] : "vasco-narocila.xlsx";
    setDownloadLink(blob, fileName);
    downloadLink.click();
    setStatus("Excel pripravljen", "ok");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setBusy(false);
  }
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadPreview();
});

exportButton.addEventListener("click", downloadExcel);

clearButton.addEventListener("click", () => {
  const token = form.elements.token.value;
  const mode = currentMode();
  form.reset();
  form.elements.sourceMode.value = mode;
  form.elements.blockSize.value = "10000";
  form.elements.blockIndex.value = "0";
  form.elements.vrniPostavke.checked = true;
  form.elements.token.value = token;
  toggleSourceMode();
  lastOrders = [];
  clearDownloadLink();
  renderMetrics(lastOrders);
  renderTable(lastOrders);
  setStatus("Pripravljen");
});

form.querySelectorAll('input[name="sourceMode"]').forEach((input) => {
  input.addEventListener("change", toggleSourceMode);
});

form.elements.jsonFile.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;

  try {
    form.elements.jsonText.value = await file.text();
    setStatus(`${file.name} naložen`, "ok");
  } catch (error) {
    setStatus("Datoteke ni mogoče prebrati.", "error");
  }
});

toggleSourceMode();
