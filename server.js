const crypto = require("node:crypto");
const fsSync = require("node:fs");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const nodemailer = require("nodemailer");

const root = __dirname;

const loadDotEnvFile = (envPath) => {
  if (!fsSync.existsSync(envPath)) return;

  const lines = fsSync.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return;

    const [key, ...valueParts] = trimmed.split("=");
    const cleanKey = key.trim();
    if (!cleanKey || process.env[cleanKey] !== undefined) return;

    const rawValue = valueParts.join("=").trim();
    process.env[cleanKey] = rawValue.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  });
};

const loadDotEnv = () => {
  loadDotEnvFile(path.join(root, ".env"));
  loadDotEnvFile(path.join(root, "vasco", ".env"));
};

loadDotEnv();

const port = Number(process.env.PORT || 4173);
const repo = process.env.GITHUB_REPO || "agenttuval/CleanSpace";
const branch = process.env.GITHUB_BRANCH || "main";
const contentPath = "content/site.json";
let runtimeContent = null;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".ogg": "video/ogg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const send = (res, status, body, headers = {}) => {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": typeof body === "object" && !Buffer.isBuffer(body) ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
    ...headers,
  });
  res.end(payload);
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 12_000_000) {
        req.destroy();
        reject(new Error("Zahteva je prevelika."));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });

const normalizeContent = (content) => {
  if (!content || typeof content !== "object" || Array.isArray(content)) return null;
  return {
    ...content,
    common: Array.isArray(content.common) ? content.common : [],
    customBlocks: content.customBlocks && typeof content.customBlocks === "object" && !Array.isArray(content.customBlocks)
      ? content.customBlocks
      : {},
    images: content.images && typeof content.images === "object" && !Array.isArray(content.images)
      ? content.images
      : {},
    videos: Array.isArray(content.videos) ? content.videos : [],
  };
};

const readLocalContent = async () => {
  if (runtimeContent) return runtimeContent;

  const raw = await fs.readFile(path.join(root, contentPath), "utf8");
  runtimeContent = normalizeContent(JSON.parse(raw.replace(/^\uFEFF/, "")));
  return runtimeContent;
};

const persistRuntimeContent = async (content) => {
  runtimeContent = normalizeContent(content);
  const updatedJson = `${JSON.stringify(runtimeContent, null, 2)}\n`;

  try {
    await fs.writeFile(path.join(root, contentPath), updatedJson, "utf8");
  } catch (error) {
    console.warn(`Runtime content was not written to disk: ${error.message}`);
  }

  return updatedJson;
};

const parseCookies = (cookieHeader = "") =>
  cookieHeader.split(";").reduce((cookies, part) => {
    const [name, ...valueParts] = part.trim().split("=");
    if (name) cookies[name] = decodeURIComponent(valueParts.join("="));
    return cookies;
  }, {});

const sessionSecret = () => process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "local-dev-secret";

const sign = (payload) =>
  crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");

const makeSession = (username) => {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      exp: Date.now() + 1000 * 60 * 60 * 8,
    })
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
};

const verifySession = (req) => {
  try {
    const token = parseCookies(req.headers.cookie).tuval_admin;
    if (!token || !token.includes(".")) return null;

    const [payload, signature] = token.split(".");
    const expected = sign(payload);
    if (signature.length !== expected.length) return null;

    const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) return null;

    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.exp || session.exp < Date.now()) return null;
    return session;
  } catch (error) {
    return null;
  }
};

const cookieOptions = () => {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 8}${secure}`;
};

const requireAdmin = (req, res) => {
  const session = verifySession(req);
  if (!session) {
    send(res, 401, { ok: false, message: "Najprej se prijavi kot admin." });
    return null;
  }
  return session;
};

const handleLogin = async (req, res) => {
  const body = JSON.parse(await readBody(req));
  const expectedUsername = process.env.ADMIN_USERNAME || "admin";
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedPassword) {
    send(res, 500, {
      ok: false,
      message: "Na Railway manjka ADMIN_PASSWORD.",
    });
    return;
  }

  if (body.username !== expectedUsername || body.password !== expectedPassword) {
    send(res, 401, { ok: false, message: "Napačno uporabniško ime ali geslo." });
    return;
  }

  send(res, 200, { ok: true, username: expectedUsername }, {
    "Set-Cookie": `tuval_admin=${encodeURIComponent(makeSession(expectedUsername))}; ${cookieOptions()}`,
    "Content-Type": "application/json; charset=utf-8",
  });
};

const handleContentSave = async (req, res) => {
  console.log("[handleContentSave] PUT /api/content request received");

  try {
    const session = requireAdmin(req, res);
    if (!session) {
      console.log("[handleContentSave] Authentication failed — no valid session");
      return;
    }
    console.log(`[handleContentSave] Admin authenticated: ${session.username}`);

    const body = JSON.parse(await readBody(req));
    const content = normalizeContent(body.content);
    console.log("[handleContentSave] Content received:", {
      bodyKeys: body ? Object.keys(body) : null,
      contentKeys: content ? Object.keys(content) : null,
      contentValid: content !== null && typeof content === "object",
    });

    if (!content || typeof content !== "object") {
      console.log("[handleContentSave] Validation failed — content missing or invalid");
      send(res, 400, { ok: false, message: "Manjka vsebina za shranjevanje." });
      return;
    }

    const githubToken = process.env.GITHUB_TOKEN;
    console.log(`[handleContentSave] GITHUB_TOKEN present: ${Boolean(githubToken)}, repo: ${repo}, branch: ${branch}`);

    if (!githubToken) {
      console.log("[handleContentSave] Saving to local runtime (no GITHUB_TOKEN)");
      await persistRuntimeContent(content);
      console.log("[handleContentSave] Content saved successfully (local runtime only)");
      send(res, 200, {
        ok: true,
        persistent: false,
        message:
          "Shranjeno na trenutno Railway instanco. Za trajno shranjevanje po ponovnem zagonu dodaj GITHUB_TOKEN.",
      });
      return;
    }

    const apiUrl = `https://api.github.com/repos/${repo}/contents/${contentPath}`;
    console.log(`[handleContentSave] Attempting to read current file from GitHub: GET ${apiUrl}?ref=${branch}`);
    const currentResponse = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "tuval-cleanspace-admin",
      },
    });
    console.log(`[handleContentSave] GitHub GET response status: ${currentResponse.status}`);

    if (!currentResponse.ok) {
      const errorBody = await currentResponse.text();
      console.log(`[handleContentSave] GitHub GET failed — status: ${currentResponse.status}, body: ${errorBody}`);
      send(res, currentResponse.status, {
        ok: false,
        message: "GitHub datoteke ni bilo mogoče prebrati. Preveri GITHUB_TOKEN.",
      });
      return;
    }

    const currentFile = await currentResponse.json();
    console.log(`[handleContentSave] GitHub file read OK — sha: ${currentFile.sha}`);

    const updatedJson = `${JSON.stringify(content, null, 2)}\n`;
    console.log(`[handleContentSave] Attempting to save to GitHub: PUT ${apiUrl} (branch: ${branch})`);
    const updateResponse = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "tuval-cleanspace-admin",
      },
      body: JSON.stringify({
        message: `Update website text content (${session.username})`,
        content: Buffer.from(updatedJson, "utf8").toString("base64"),
        sha: currentFile.sha,
        branch,
      }),
    });
    console.log(`[handleContentSave] GitHub PUT response status: ${updateResponse.status}`);

    if (!updateResponse.ok) {
      const errorBody = await updateResponse.text();
      console.log(`[handleContentSave] GitHub PUT failed — status: ${updateResponse.status}, body: ${errorBody}`);
      send(res, updateResponse.status, {
        ok: false,
        message: "Shranjevanje na GitHub ni uspelo.",
      });
      return;
    }

    const updateResult = await updateResponse.json();
    console.log(`[handleContentSave] GitHub PUT succeeded — commit sha: ${updateResult?.commit?.sha}`);

    console.log("[handleContentSave] Saving to local runtime cache");
    await persistRuntimeContent(content);

    console.log("[handleContentSave] Content saved successfully (GitHub + local runtime)");
    send(res, 200, { ok: true, persistent: true, message: "Shranjeno na GitHub in osveženo na Railwayu." });
  } catch (error) {
    console.error("[handleContentSave] Unexpected error:", error.message);
    console.error("[handleContentSave] Stack trace:", error.stack);
    throw error;
  }
};

const handleContentRead = async (res) => {
  const content = await readLocalContent();
  send(res, 200, content, {
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "application/json; charset=utf-8",
  });
};

const parseJsonBody = async (req) => {
  const raw = await readBody(req);
  if (!raw.trim()) return {};

  try {
    return JSON.parse(raw);
  } catch (error) {
    const invalidJson = new Error("Zahteva nima veljavnega JSON telesa.");
    invalidJson.status = 400;
    throw invalidJson;
  }
};

const createHttpError = (status, message, details) => {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
};

const vascoBaseUrl = () => (process.env.VASCO_API_BASE_URL || "http://192.168.0.5:8101").replace(/\/+$/, "");

const cleanValue = (value) => (typeof value === "string" ? value.trim() : value);

const normalizeDateTime = (value) => {
  const date = cleanValue(value);
  if (!date) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00` : date;
};

const bearerTokenFrom = (body) => {
  const providedToken = cleanValue(body.bearerToken || body.token || "");
  const envToken = cleanValue(process.env.VASCO_API_TOKEN || "");
  const token = providedToken || envToken;
  return token ? token.replace(/^Bearer\s+/i, "") : "";
};

const vascoFiltersFrom = (body) => {
  const filters = body.filters && typeof body.filters === "object" ? body.filters : body;

  return {
    StevilkaLeto: cleanValue(filters.stevilkaLeto || filters.StevilkaLeto || ""),
    DatumOd: normalizeDateTime(filters.datumOd || filters.DatumOd || ""),
    DatumDo: normalizeDateTime(filters.datumDo || filters.DatumDo || ""),
    Partner: cleanValue(filters.partner || filters.Partner || ""),
    VrniPostavke: filters.vrniPostavke === false || filters.VrniPostavke === 0 || filters.VrniPostavke === "0" ? 0 : 1,
    Artikel: cleanValue(filters.artikel || filters.Artikel || ""),
    VrniOznakoPriloge: filters.vrniOznakoPriloge || filters.VrniOznakoPriloge ? 1 : "",
    BlockSize: cleanValue(filters.blockSize || filters.BlockSize || "10000"),
    BlockIndex: cleanValue(filters.blockIndex || filters.BlockIndex || "0"),
    DodatnaPolja: cleanValue(filters.dodatnaPolja || filters.DodatnaPolja || ""),
    DodatnaPoljaPostavke: cleanValue(filters.dodatnaPoljaPostavke || filters.DodatnaPoljaPostavke || ""),
  };
};

const assertUsefulVascoFilter = (filters, body) => {
  const allowAll = Boolean(body.allowAll || body.filters?.allowAll);
  const hasFilter = ["StevilkaLeto", "DatumOd", "DatumDo", "Partner", "Artikel"].some((key) => Boolean(filters[key]));

  if (!hasFilter && !allowAll) {
    throw createHttpError(400, "Vnesi partnerja, datum, številko naročila ali artikel.");
  }
};

const buildVascoOrdersUrl = (filters) => {
  const url = new URL(`${vascoBaseUrl()}/api/v1/FA/narociloKupca`);

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
};

const fetchVascoOrders = async (body) => {
  const token = bearerTokenFrom(body);
  if (!token) {
    throw createHttpError(400, "Manjka Vasco bearer token. Nastavi VASCO_API_TOKEN ali ga vnesi v obrazec.");
  }

  const filters = vascoFiltersFrom(body);
  assertUsefulVascoFilter(filters, body);

  const url = buildVascoOrdersUrl(filters);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": "tuval-vasco-excel",
    },
  });

  const responseText = await response.text();
  let payload = null;
  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch (error) {
    payload = responseText;
  }

  if (!response.ok) {
    const message = payload?.title || payload?.message || payload?.detail || "Vasco API ni vrnil uspešnega odgovora.";
    throw createHttpError(response.status, message, payload);
  }

  if (!Array.isArray(payload)) {
    throw createHttpError(502, "Vasco API je vrnil nepričakovano obliko podatkov.", payload);
  }

  return {
    filters,
    orders: payload,
    source: `${url.origin}${url.pathname}`,
  };
};

const asNumber = (value) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const formatDate = (value) => {
  if (!value) return "";
  const text = String(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : text;
};

const formatExtraFields = (fields) => {
  if (!Array.isArray(fields) || !fields.length) return "";
  return fields
    .map((field) => {
      if (!field || typeof field !== "object") return String(field ?? "");
      const name = field.naziv || field.name || "";
      const value = field.vrednost ?? field.value ?? "";
      return name ? `${name}: ${value}` : String(value);
    })
    .filter(Boolean)
    .join("; ");
};

const firstValue = (object, keys) => {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return "";
};

const orderRowsForExcel = (orders) =>
  orders.map((order) => ({
    stevilka: order.stevilka,
    leto: order.leto,
    datum: formatDate(order.datum),
    partner: order.partner,
    komercialist: order.komercialist,
    znesek: order.znesek,
    znesekZDDV: order.znesekZDDV,
    rabat1: order.rabat1,
    skladisce: order.skladisce,
    besedilo: order.besedilo,
    popravljaDokument: order.popravljaDokument,
    priloge: Array.isArray(order.dokIdPriloge) ? order.dokIdPriloge.length : 0,
    dodatnaPolja: formatExtraFields(order.dodatnaPolja),
  }));

const itemRowsForExcel = (orders) =>
  orders.flatMap((order) =>
    (Array.isArray(order.postavke) ? order.postavke : []).map((item) => ({
      narocilo: order.stevilka,
      leto: order.leto,
      datum: formatDate(order.datum),
      partner: order.partner,
      zs: item.zs,
      sifra: firstValue(item, ["sifra", "sifraArtikla", "sifra_artikla", "artikel"]),
      nazivArtikla: firstValue(item, ["naziv_artikla", "nazivArtikla", "nazivArt", "naziv", "opisArtikla", "opis_artikla"]),
      kolicina: firstValue(item, ["kolicina", "količina", "kol"]),
      cena: firstValue(item, ["cena", "prodajnaCena", "prodajna_cena", "prodajnaCenaZDDV", "prodajnaCenaZDdv"]),
      rabat1: item.rabat1,
      zaprto: item.zaprto,
      zaprtoPos: item.zaprtoPos,
      datumVeljavnosti: formatDate(item.datumVeljavnosti),
      dodatnaPolja: formatExtraFields(item.dodatnaPolja),
    }))
  );

const summaryRowsForExcel = (orders) => {
  const byPartner = new Map();

  orders.forEach((order) => {
    const key = String(order.partner ?? "");
    const current = byPartner.get(key) || {
      partner: key,
      stNarocil: 0,
      stPostavk: 0,
      znesek: 0,
      znesekZDDV: 0,
    };

    current.stNarocil += 1;
    current.stPostavk += Array.isArray(order.postavke) ? order.postavke.length : 0;
    current.znesek += asNumber(order.znesek);
    current.znesekZDDV += asNumber(order.znesekZDDV);
    byPartner.set(key, current);
  });

  const rows = Array.from(byPartner.values()).sort((a, b) => a.partner.localeCompare(b.partner, "sl"));
  rows.push({
    partner: "SKUPAJ",
    stNarocil: orders.length,
    stPostavk: rows.reduce((sum, row) => sum + row.stPostavk, 0),
    znesek: rows.reduce((sum, row) => sum + row.znesek, 0),
    znesekZDDV: rows.reduce((sum, row) => sum + row.znesekZDDV, 0),
  });

  return rows;
};

const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const columnName = (index) => {
  let name = "";
  let current = index + 1;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }

  return name;
};

const worksheetXml = ({ headers, rows, widths }) => {
  const allRows = [headers.map((header) => header.label), ...rows.map((row) => headers.map((header) => row[header.key]))];

  const rowXml = allRows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
          const isHeader = rowIndex === 0;
          const style = isHeader ? ' s="1"' : "";

          if (typeof value === "number" && Number.isFinite(value)) {
            return `<c r="${ref}"${style}><v>${value}</v></c>`;
          }

          return `<c r="${ref}" t="inlineStr"${style}><is><t>${escapeXml(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  const lastRef = `${columnName(headers.length - 1)}${Math.max(allRows.length, 1)}`;
  const cols = widths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <cols>${cols}</cols>
  <sheetData>${rowXml}</sheetData>
  <autoFilter ref="A1:${lastRef}"/>
</worksheet>`;
};

const workbookXml = (sheets) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}
  </sheets>
</workbook>`;

const workbookRelsXml = (sheets) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets.map((sheet, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const contentTypesXml = (sheets) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheets.map((sheet, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
</Types>`;

const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF01457E"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFDDE5EC"/></left><right style="thin"><color rgb="FFDDE5EC"/></right><top style="thin"><color rgb="FFDDE5EC"/></top><bottom style="thin"><color rgb="FFDDE5EC"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const dosDateTime = (date = new Date()) => {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
};

const zipFiles = (files) => {
  const localParts = [];
  const centralParts = [];
  const { dosTime, dosDate } = dosDateTime();
  let offset = 0;

  files.forEach((file) => {
    const name = Buffer.from(file.name, "utf8");
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, "utf8");
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + data.length;
  });

  const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
};

const createOrdersWorkbook = (orders) => {
  const orderHeaders = [
    { key: "stevilka", label: "Številka" },
    { key: "leto", label: "Leto" },
    { key: "datum", label: "Datum" },
    { key: "partner", label: "Partner" },
    { key: "komercialist", label: "Komercialist" },
    { key: "znesek", label: "Znesek brez DDV" },
    { key: "znesekZDDV", label: "Znesek z DDV" },
    { key: "rabat1", label: "Rabat 1" },
    { key: "skladisce", label: "Skladišče" },
    { key: "besedilo", label: "Besedilo" },
    { key: "popravljaDokument", label: "Popravlja dokument" },
    { key: "priloge", label: "Št. prilog" },
    { key: "dodatnaPolja", label: "Dodatna polja" },
  ];

  const itemHeaders = [
    { key: "narocilo", label: "Naročilo" },
    { key: "leto", label: "Leto" },
    { key: "datum", label: "Datum" },
    { key: "partner", label: "Partner" },
    { key: "zs", label: "ZS" },
    { key: "sifra", label: "Šifra" },
    { key: "nazivArtikla", label: "Naziv artikla" },
    { key: "kolicina", label: "Količina" },
    { key: "cena", label: "Cena" },
    { key: "rabat1", label: "Rabat 1" },
    { key: "zaprto", label: "Zaprto" },
    { key: "zaprtoPos", label: "Zaprto POS" },
    { key: "datumVeljavnosti", label: "Datum veljavnosti" },
    { key: "dodatnaPolja", label: "Dodatna polja" },
  ];

  const summaryHeaders = [
    { key: "partner", label: "Partner" },
    { key: "stNarocil", label: "Št. naročil" },
    { key: "stPostavk", label: "Št. postavk" },
    { key: "znesek", label: "Znesek brez DDV" },
    { key: "znesekZDDV", label: "Znesek z DDV" },
  ];

  const sheets = [
    {
      name: "Naročila",
      headers: orderHeaders,
      rows: orderRowsForExcel(orders),
      widths: [14, 9, 13, 12, 14, 18, 16, 11, 11, 36, 22, 11, 42],
    },
    {
      name: "Postavke",
      headers: itemHeaders,
      rows: itemRowsForExcel(orders),
      widths: [14, 9, 13, 12, 10, 16, 34, 12, 14, 11, 10, 12, 18, 42],
    },
    {
      name: "Povzetek",
      headers: summaryHeaders,
      rows: summaryRowsForExcel(orders),
      widths: [14, 12, 13, 18, 16],
    },
  ];

  return zipFiles([
    { name: "[Content_Types].xml", data: contentTypesXml(sheets) },
    { name: "_rels/.rels", data: rootRelsXml },
    { name: "xl/workbook.xml", data: workbookXml(sheets) },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRelsXml(sheets) },
    { name: "xl/styles.xml", data: stylesXml },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: worksheetXml(sheet),
    })),
  ]);
};

const countOrderItems = (orders) =>
  orders.reduce((count, order) => count + (Array.isArray(order.postavke) ? order.postavke.length : 0), 0);

const handleVascoOrdersRead = async (req, res) => {
  const body = await parseJsonBody(req);
  const result = await fetchVascoOrders(body);

  send(res, 200, {
    ok: true,
    count: result.orders.length,
    itemCount: countOrderItems(result.orders),
    source: result.source,
    orders: result.orders,
  }, {
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "application/json; charset=utf-8",
  });
};

const handleVascoOrdersExcel = async (req, res) => {
  const body = await parseJsonBody(req);
  const result = await fetchVascoOrders(body);
  const workbook = createOrdersWorkbook(result.orders);
  const filters = body.filters && typeof body.filters === "object" ? body.filters : body;
  const partner = cleanValue(filters.partner || filters.Partner || "vsi") || "vsi";
  const safePartner = String(partner).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 32);
  const fileName = `vasco-narocila-${safePartner}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  send(res, 200, workbook, {
    "Cache-Control": "no-store, max-age=0",
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
};

const ordersFromBody = (body) => {
  const orders = Array.isArray(body.orders) ? body.orders : null;

  if (!orders) {
    throw createHttpError(400, "Manjka seznam naročil za Excel.");
  }

  return orders;
};

const handleVascoOrdersJsonExcel = async (req, res) => {
  const body = await parseJsonBody(req);
  const orders = ordersFromBody(body);
  const workbook = createOrdersWorkbook(orders);
  const fileName = `vasco-narocila-json-${new Date().toISOString().slice(0, 10)}.xlsx`;

  send(res, 200, workbook, {
    "Cache-Control": "no-store, max-age=0",
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
};

const createSmtpTransport = () =>
  nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 465),
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

const handleContactForm = async (req, res) => {
  const body = await parseJsonBody(req);

  const name = (body.name || "").toString().trim();
  const email = (body.email || "").toString().trim();
  const phone = (body.phone || "").toString().trim();
  const company = (body.company || "").toString().trim();
  const interest = (body.interest || "").toString().trim();
  const preferredDate = (body.preferredDate || "").toString().trim();
  const message = (body.message || "").toString().trim();
  const isTestRequest = body.isTestRequest === true || body.isTestRequest === "true";

  if (!name || !email) {
    send(res, 400, { ok: false, message: "Ime in e-pošta sta obvezna." });
    return;
  }

  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    send(res, 500, { ok: false, message: "E-poštni strežnik ni konfiguriran (manjkajo EMAIL_HOST, EMAIL_USER ali EMAIL_PASSWORD)." });
    return;
  }

  const bodyLines = [
    `Ime: ${name}`,
    `E-pošta: ${email}`,
    phone ? `Telefon: ${phone}` : null,
    `Podjetje: ${company || "-"}`,
    `Zanimanje: ${interest}`,
    preferredDate ? `Želeni termin testiranja: ${preferredDate}` : null,
    "",
    message,
  ].filter((line) => line !== null);

  const subject = `${isTestRequest ? "Naročilo maske na test" : "Povpraševanje CleanSpace"} - ${interest}`;
  const text = bodyLines.join("\n");

  try {
    const transporter = createSmtpTransport();
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: "sales@tu-val.si",
      replyTo: email,
      subject,
      text,
    });

    console.log(`[handleContactForm] Email sent via SiOL SMTP: ${subject} (from ${email})`);
    send(res, 200, { ok: true, message: "Sporočilo je bilo uspešno poslano." });
  } catch (error) {
    console.error(`[handleContactForm] SMTP error: ${error.message}`);
    send(res, 500, { ok: false, message: "Pošiljanje sporočila ni uspelo. Prosimo, poskusite znova." });
  }
};

const serveStatic = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const cleanPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const fullPath = path.resolve(root, `.${cleanPath}`);

  if (!fullPath.startsWith(root)) {
    send(res, 403, "Forbidden");
    return;
  }

  let filePath = fullPath;
  const stat = await fs.stat(filePath).catch(() => null);

  if (stat?.isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  const file = await fs.readFile(filePath).catch(() => null);
  if (!file) {
    send(res, 404, "Not found");
    return;
  }

  send(res, 200, file, {
    "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
  });
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && (url.pathname === "/vasco.html" || url.pathname === "/vasco")) {
      send(res, 302, "Redirecting to Vasco app.", {
        Location: "/vasco/",
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      await handleLogin(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/logout") {
      send(res, 200, { ok: true }, {
        "Set-Cookie": "tuval_admin=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
        "Content-Type": "application/json; charset=utf-8",
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/session") {
      const session = verifySession(req);
      send(res, 200, { ok: true, authenticated: Boolean(session), username: session?.username || null });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/content") {
      await handleContentRead(res);
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/content") {
      await handleContentSave(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/vasco/narocila-kupca") {
      await handleVascoOrdersRead(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/vasco/narocila-kupca/excel") {
      await handleVascoOrdersExcel(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/vasco/narocila-kupca/excel-json") {
      await handleVascoOrdersJsonExcel(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/contact") {
      await handleContactForm(req, res);
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    send(res, error.status || 500, {
      ok: false,
      message: error.message || "Napaka serverja.",
      details: error.details,
    });
  }
});

server.listen(port, () => {
  console.log(`Tu-Val CleanSpace site running on port ${port}`);
});

const env = (key, fallback = "") =>
  (process.env[key] || fallback).toString().trim().replace(/^["']|["']$/g, "");

const createSmtpTransport = () => {
  const emailPort = Number(env("EMAIL_PORT", "465"));

  return nodemailer.createTransport({
    host: env("EMAIL_HOST"),
    port: emailPort,
    secure: emailPort === 465,
    requireTLS: emailPort === 587,
    auth: {
      user: env("EMAIL_USER"),
      pass: env("EMAIL_PASSWORD"),
    },
  });
};
