const crypto = require("node:crypto");
const fsSync = require("node:fs");
const fs = require("node:fs/promises");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const tls = require("node:tls");

const root = __dirname;
const localVascoRoot = path.join(root, "vasco");
const siblingVascoRoot = path.join(path.dirname(root), "vasco");

const vascoAppRoot = () => (fsSync.existsSync(localVascoRoot) ? localVascoRoot : siblingVascoRoot);

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
  loadDotEnvFile(path.join(path.dirname(root), "vasco", ".env"));
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
  const session = requireAdmin(req, res);
  if (!session) return;

  const body = JSON.parse(await readBody(req));
  const content = normalizeContent(body.content);

  if (!content || typeof content !== "object") {
    send(res, 400, { ok: false, message: "Manjka vsebina za shranjevanje." });
    return;
  }

  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    await persistRuntimeContent(content);
    send(res, 200, {
      ok: true,
      persistent: false,
      message:
        "Shranjeno na trenutno Railway instanco. Za trajno shranjevanje po ponovnem zagonu dodaj GITHUB_TOKEN.",
    });
    return;
  }

  const apiUrl = `https://api.github.com/repos/${repo}/contents/${contentPath}`;
  const currentResponse = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "tuval-cleanspace-admin",
    },
  });

  if (!currentResponse.ok) {
    send(res, currentResponse.status, {
      ok: false,
      message: "GitHub datoteke ni bilo mogoče prebrati. Preveri GITHUB_TOKEN.",
    });
    return;
  }

  const currentFile = await currentResponse.json();
  const updatedJson = `${JSON.stringify(content, null, 2)}\n`;
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

  if (!updateResponse.ok) {
    send(res, updateResponse.status, {
      ok: false,
      message: "Shranjevanje na GitHub ni uspelo.",
    });
    return;
  }

  await persistRuntimeContent(content);

  send(res, 200, { ok: true, persistent: true, message: "Shranjeno na GitHub in osveženo na Railwayu." });
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

const smtpEnvValue = (...keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }

  return "";
};

const smtpBoolean = (value, fallback) => {
  if (value === undefined || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
};

const defaultMailUser = "agenttuval@gmail.com";
const defaultMailRecipient = "sales@tu-val.si";

const resolveMailRecipient = () => {
  const configuredRecipient = smtpEnvValue("MAIL_TO", "EMAIL_TO", "SMTP_TO", "CONTACT_EMAIL_TO");
  return configuredRecipient && configuredRecipient !== defaultMailUser ? configuredRecipient : defaultMailRecipient;
};

const smtpConfig = () => {
  const host = smtpEnvValue("SMTP_HOST", "EMAIL_HOST", "MAIL_HOST") || "smtp.gmail.com";
  const port = Number(smtpEnvValue("SMTP_PORT", "EMAIL_PORT", "MAIL_PORT") || 587);
  const user =
    smtpEnvValue("SMTP_USER", "EMAIL_USER", "MAIL_USER", "GMAIL_USER", "GMAIL_EMAIL") ||
    defaultMailUser;
  const pass = smtpEnvValue(
    "SMTP_PASS",
    "SMTP_PASSWORD",
    "EMAIL_PASS",
    "EMAIL_PASSWORD",
    "MAIL_PASS",
    "MAIL_PASSWORD",
    "GMAIL_APP_PASSWORD",
    "GMAIL_PASSWORD"
  );
  const secure = smtpBoolean(smtpEnvValue("SMTP_SECURE", "EMAIL_SECURE", "MAIL_SECURE"), port === 465);
  const timeoutMs = Number(smtpEnvValue("SMTP_TIMEOUT_MS", "EMAIL_TIMEOUT_MS", "MAIL_TIMEOUT_MS") || 15000);

  return {
    host,
    port,
    secure,
    starttls: smtpBoolean(smtpEnvValue("SMTP_STARTTLS", "EMAIL_STARTTLS", "MAIL_STARTTLS"), !secure),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs >= 5000 ? timeoutMs : 15000,
    user,
    pass,
    from: smtpEnvValue("MAIL_FROM", "EMAIL_FROM", "SMTP_FROM") || defaultMailUser,
    to: resolveMailRecipient(),
  };
};

const mailWebhookConfig = () => ({
  url: smtpEnvValue("MAIL_WEBHOOK_URL", "EMAIL_WEBHOOK_URL", "GOOGLE_SCRIPT_WEBHOOK_URL", "GOOGLE_APPS_SCRIPT_URL"),
  secret: smtpEnvValue("MAIL_WEBHOOK_SECRET", "EMAIL_WEBHOOK_SECRET", "GOOGLE_SCRIPT_SECRET"),
});

const sanitizeHeader = (value = "") => String(value).replace(/[\r\n]+/g, " ").trim();

const extractEmailAddress = (value = "") => {
  const text = sanitizeHeader(value);
  const match = text.match(/<([^>]+)>/);
  return (match ? match[1] : text).trim();
};

const formatAddress = (name, email) => {
  const cleanEmail = extractEmailAddress(email);
  const cleanName = sanitizeHeader(name);
  if (!cleanName) return cleanEmail;
  return `"${cleanName.replace(/"/g, "'")}" <${cleanEmail}>`;
};

const encodeMailHeader = (value = "") =>
  /^[\x00-\x7F]*$/.test(value)
    ? sanitizeHeader(value)
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;

const readSmtpResponse = (socket) =>
  new Promise((resolve, reject) => {
    let response = "";
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("SMTP strežnik se ni odzval pravočasno."));
    }, 20000);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const onClose = () => {
      cleanup();
      reject(new Error("SMTP povezava se je zaprla pred odgovorom."));
    };

    const onData = (chunk) => {
      response += chunk.toString("utf8");
      const lines = response.split(/\r?\n/).filter(Boolean);
      const lastLine = lines[lines.length - 1] || "";

      if (/^\d{3} /.test(lastLine)) {
        cleanup();
        resolve({
          code: Number(lastLine.slice(0, 3)),
          message: lines.join("\n"),
        });
      }
    };

    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
  });

const writeSmtp = (socket, value) =>
  new Promise((resolve, reject) => {
    socket.write(value, "utf8", (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

const smtpCommand = async (socket, command, expectedCodes, label = command.split(" ")[0]) => {
  await writeSmtp(socket, `${command}\r\n`);
  const response = await readSmtpResponse(socket);

  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP napaka pri ukazu ${label}: ${response.message}`);
  }

  return response;
};

const connectSmtpSocket = (config) =>
  new Promise((resolve, reject) => {
    const options = {
      host: config.host,
      port: config.port,
      servername: config.host,
    };
    let settled = false;
    const cleanup = () => {
      socket.off("error", onError);
      socket.off("timeout", onTimeout);
    };
    const onError = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      error.smtpStage = "connect";
      reject(error);
    };
    const onTimeout = () => {
      const error = new Error(`SMTP povezava do ${config.host}:${config.port} se ni odprla pravočasno.`);
      error.code = "SMTP_CONNECT_TIMEOUT";
      error.smtpStage = "connect";
      onError(error);
      socket.destroy();
    };
    const onConnect = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(socket);
    };
    const socket = config.secure ? tls.connect(options, onConnect) : net.connect(options, onConnect);

    socket.once("error", onError);
    socket.once("timeout", onTimeout);
    socket.setTimeout(config.timeoutMs);
  });

const upgradeToTls = (socket, config) =>
  new Promise((resolve, reject) => {
    socket.removeAllListeners("data");
    socket.removeAllListeners("error");
    socket.removeAllListeners("close");

    const secureSocket = tls.connect(
      {
        socket,
        servername: config.host,
      },
      () => resolve(secureSocket)
    );

    secureSocket.once("error", reject);
  });

const sendSmtpMailWithConfig = async (config, { subject, text, replyTo }) => {
  let socket = await connectSmtpSocket(config);

  try {
    await readSmtpResponse(socket);
    await smtpCommand(socket, "EHLO tu-val.si", [250]);

    if (!config.secure && config.starttls) {
      await smtpCommand(socket, "STARTTLS", [220]);
      socket = await upgradeToTls(socket, config);
      await smtpCommand(socket, "EHLO tu-val.si", [250]);
    }

    await smtpCommand(socket, "AUTH LOGIN", [334]);
    await smtpCommand(socket, Buffer.from(config.user, "utf8").toString("base64"), [334], "SMTP uporabnik");
    await smtpCommand(socket, Buffer.from(config.pass, "utf8").toString("base64"), [235], "SMTP geslo");

    await smtpCommand(socket, `MAIL FROM:<${extractEmailAddress(config.from)}>`, [250]);
    await smtpCommand(socket, `RCPT TO:<${extractEmailAddress(config.to)}>`, [250, 251]);
    await smtpCommand(socket, "DATA", [354]);

    const message = [
      `From: ${formatAddress("Tu-Val CleanSpace", config.from)}`,
      `To: ${formatAddress("Tu-Val Sales", config.to)}`,
      replyTo ? `Reply-To: ${formatAddress("Stranka", replyTo)}` : null,
      `Subject: ${encodeMailHeader(subject)}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@tu-val.si>`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      text,
    ]
      .filter(Boolean)
      .join("\r\n")
      .replace(/^\./gm, "..");

    await writeSmtp(socket, `${message}\r\n.\r\n`);
    const dataResponse = await readSmtpResponse(socket);
    if (dataResponse.code !== 250) {
      throw new Error(`SMTP napaka pri pošiljanju sporočila: ${dataResponse.message}`);
    }

    await smtpCommand(socket, "QUIT", [221]);
  } finally {
    socket.end();
  }
};

const sendMailWebhook = async (webhookConfig, mailConfig, { subject, text, replyTo }) => {
  const response = await fetch(webhookConfig.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      secret: webhookConfig.secret,
      from: extractEmailAddress(mailConfig.from),
      to: extractEmailAddress(mailConfig.to),
      subject,
      text,
      replyTo: extractEmailAddress(replyTo || ""),
    }),
  });

  const rawResult = await response.text();
  let result = null;

  try {
    result = rawResult ? JSON.parse(rawResult) : null;
  } catch (error) {
    result = null;
  }

  if (!response.ok || result?.ok === false) {
    const message = result?.message || rawResult || `HTTP ${response.status}`;
    throw new Error(`Pošiljanje prek Google webhooka ni uspelo: ${message}`);
  }
};

const shouldRetrySmtpOn587 = (config, error) => {
  const host = String(config.host || "").toLowerCase();
  const retryableCodes = new Set(["ETIMEDOUT", "SMTP_CONNECT_TIMEOUT", "ECONNRESET", "EHOSTUNREACH"]);
  const isTlsModeMismatch = String(error?.code || "").startsWith("ERR_SSL");
  const needsGmailStartTlsMode = config.port !== 587 || config.secure || !config.starttls;
  return (
    host.includes("gmail") &&
    needsGmailStartTlsMode &&
    error?.smtpStage === "connect" &&
    (retryableCodes.has(error.code) || isTlsModeMismatch)
  );
};

const smtpFriendlyError = (error, config) => {
  if (["ETIMEDOUT", "SMTP_CONNECT_TIMEOUT", "EHOSTUNREACH"].includes(error?.code)) {
    return new Error(
      `SMTP povezava do ${config.host}:${config.port} se ni odprla. Railway na tem planu blokira SMTP, zato dodaj MAIL_WEBHOOK_URL za pošiljanje prek HTTPS.`
    );
  }

  return error;
};

const sendSmtpMail = async ({ subject, text, replyTo }) => {
  const config = smtpConfig();
  const webhookConfig = mailWebhookConfig();

  if (webhookConfig.url) {
    await sendMailWebhook(webhookConfig, config, { subject, text, replyTo });
    return;
  }

  if (!config.pass) {
    throw new Error(
      "Manjka nastavitev za pošiljanje. Dodaj MAIL_WEBHOOK_URL ali SMTP/Gmail app geslo."
    );
  }

  try {
    await sendSmtpMailWithConfig(config, { subject, text, replyTo });
    return;
  } catch (error) {
    if (!shouldRetrySmtpOn587(config, error)) {
      throw smtpFriendlyError(error, config);
    }
  }

  const fallbackConfig = {
    ...config,
    port: 587,
    secure: false,
    starttls: true,
  };

  try {
    await sendSmtpMailWithConfig(fallbackConfig, { subject, text, replyTo });
  } catch (error) {
    throw smtpFriendlyError(error, fallbackConfig);
  }
};

const handleMailStatus = (res) => {
  const mailConfig = smtpConfig();
  const webhookConfig = mailWebhookConfig();
  const mode = webhookConfig.url ? "webhook" : mailConfig.pass ? "smtp" : "not_configured";

  send(res, 200, {
    ok: true,
    mode,
    hasWebhookUrl: Boolean(webhookConfig.url),
    hasWebhookSecret: Boolean(webhookConfig.secret),
    hasSmtpPassword: Boolean(mailConfig.pass),
    from: mailConfig.from,
    to: mailConfig.to,
    smtpHost: mailConfig.host,
    smtpPort: mailConfig.port,
    smtpSecure: mailConfig.secure,
    smtpStarttls: mailConfig.starttls,
  }, {
    "Cache-Control": "no-store, max-age=0",
  });
};

const handleContactEmail = async (req, res) => {
  const body = await parseJsonBody(req);
  const isTestRequest = body.formType === "test";
  const name = cleanValue(body.name || "");
  const email = cleanValue(body.email || "");
  const phone = cleanValue(body.phone || "");
  const company = cleanValue(body.company || "");
  const interest = cleanValue(body.interest || "");
  const preferredDate = cleanValue(body.preferredDate || "");
  const message = cleanValue(body.message || "");
  const page = cleanValue(body.page || "");
  const attachmentNames = Array.isArray(body.attachments)
    ? body.attachments.map((value) => cleanValue(value)).filter(Boolean)
    : [];

  if (!name || !email || !message) {
    send(res, 400, {
      ok: false,
      message: "Manjkajo obvezni podatki: ime, e-pošta ali sporočilo.",
    });
    return;
  }

  const subject = `${isTestRequest ? "Naročilo maske na test" : "Povpraševanje CleanSpace"}${
    interest ? ` - ${interest}` : ""
  }`;
  const text = [
    "Novo sporočilo s spletne strani Tu-Val CleanSpace",
    "",
    `Tip obrazca: ${isTestRequest ? "Naročilo testne maske" : "Povpraševanje"}`,
    `Datum oddaje: ${new Date().toLocaleString("sl-SI", { timeZone: "Europe/Ljubljana" })}`,
    page ? `Stran: ${page}` : null,
    "",
    "Podatki stranke:",
    `Ime in priimek: ${name}`,
    `E-pošta: ${email}`,
    phone ? `Telefon: ${phone}` : null,
    `Podjetje: ${company || "-"}`,
    `Zanimanje: ${interest || "-"}`,
    preferredDate ? `Želeni termin testiranja: ${preferredDate}` : null,
    attachmentNames.length ? `Izbrane datoteke v obrazcu: ${attachmentNames.join(", ")}` : null,
    attachmentNames.length
      ? "Opomba: datoteke zaradi varnosti niso samodejno pripete. Stranko kontaktirajte za pošiljanje prilog."
      : null,
    "",
    "Sporočilo:",
    message,
  ]
    .filter((line) => line !== null)
    .join("\n");

  await sendSmtpMail({
    subject,
    text,
    replyTo: email,
  });

  send(res, 200, {
    ok: true,
    message: "Sporočilo je bilo poslano.",
  });
};

const createHttpError = (status, message, details) => {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
};

const vascoBaseUrl = () => (process.env.VASCO_API_BASE_URL || "http://192.168.0.5:8101").replace(/\/+$/, "");

const vascoTimeoutMs = () => {
  const configured = Number(process.env.VASCO_API_TIMEOUT_MS || 20000);
  return Number.isFinite(configured) && configured >= 1000 ? configured : 20000;
};

const cleanValue = (value) => (typeof value === "string" ? value.trim() : value);

const normalizeDateTime = (value) => {
  const date = cleanValue(value);
  if (!date) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00` : date;
};

const explicitBearerTokenFrom = (body) => {
  const providedToken = cleanValue(body.bearerToken || body.token || "");
  return providedToken ? providedToken.replace(/^Bearer\s+/i, "") : "";
};

const envBearerToken = () => {
  const envToken = cleanValue(process.env.VASCO_API_TOKEN || "");
  return envToken ? envToken.replace(/^Bearer\s+/i, "") : "";
};

const vascoLoginFrom = (body = {}) => {
  const login = body.vascoLogin && typeof body.vascoLogin === "object" ? body.vascoLogin : {};
  const filters = body.filters && typeof body.filters === "object" ? body.filters : {};
  const username = cleanValue(login.username || body.vascoUsername || filters.vascoUsername || process.env.VASCO_API_USERNAME || "");
  const password = cleanValue(login.password || body.vascoPassword || filters.vascoPassword || process.env.VASCO_API_PASSWORD || "");
  const taxNumber = cleanValue(login.taxNumber || body.taxNumber || filters.taxNumber || process.env.VASCO_API_TAX_NUMBER || "");
  const year = cleanValue(login.year ?? body.year ?? filters.year ?? process.env.VASCO_API_YEAR ?? "0");

  if (!username || !password || !taxNumber) return null;

  return {
    username,
    password,
    taxNumber,
    year: Number.isFinite(Number(year)) ? Number(year) : 0,
  };
};

const vascoTokenCache = new Map();

const jwtExpirationMs = (token) => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return 0;

    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const exp = Number(decoded.exp);
    return Number.isFinite(exp) ? exp * 1000 : 0;
  } catch (error) {
    return 0;
  }
};

const fetchVascoLoginToken = async (credentials) => {
  const cacheKey = [vascoBaseUrl(), credentials.username, credentials.taxNumber, credentials.year].join("|");
  const cached = vascoTokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const timeoutMs = vascoTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;

  try {
    response = await fetch(`${vascoBaseUrl()}/api/v1/Avtentikacija`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "tuval-vasco-excel",
      },
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password,
        taxNumber: credentials.taxNumber,
        year: credentials.year,
        returnPastYears: false,
      }),
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw createHttpError(504, `Vasco prijava se ni odzvala v ${Math.round(timeoutMs / 1000)} sekundah.`);
    }

    throw createHttpError(502, `Vasco prijava ni dosegljiva: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }

  const responseText = await response.text();
  let payload = null;
  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch (error) {
    payload = responseText;
  }

  if (!response.ok) {
    const message = payload?.title || payload?.message || payload?.detail || "Vasco prijava ni uspela.";
    throw createHttpError(response.status, message, payload);
  }

  const token = cleanValue(payload?.apiKey || payload?.ApiKey || payload?.apikey || "");
  if (!token) {
    throw createHttpError(502, "Vasco prijava ni vrnila apiKey.", payload);
  }

  const jwtExpiresAt = jwtExpirationMs(token);
  const fallbackExpiresAt = Date.now() + 29 * 60 * 1000;
  vascoTokenCache.set(cacheKey, {
    token,
    expiresAt: jwtExpiresAt ? Math.min(jwtExpiresAt, fallbackExpiresAt) : fallbackExpiresAt,
  });

  return token;
};

const resolveVascoToken = async (body) => {
  const explicitToken = explicitBearerTokenFrom(body);
  if (explicitToken) return explicitToken;

  const credentials = vascoLoginFrom(body);
  if (credentials) return fetchVascoLoginToken(credentials);

  const envToken = envBearerToken();
  if (envToken) return envToken;

  return "";
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

const fetchVascoJson = async (url, token, fallbackMessage) => {
  const timeoutMs = vascoTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;

  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent": "tuval-vasco-excel",
      },
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw createHttpError(504, `Vasco API se ni odzval v ${Math.round(timeoutMs / 1000)} sekundah. Preveri povezavo do Vasca ali token.`);
    }

    throw createHttpError(502, `Vasco API ni dosegljiv: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }

  const responseText = await response.text();
  let payload = null;
  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch (error) {
    payload = responseText;
  }

  if (!response.ok) {
    const message = payload?.title || payload?.message || payload?.detail || fallbackMessage;
    throw createHttpError(response.status, message, payload);
  }

  return payload;
};

const postVascoJson = async (url, token, payload, fallbackMessage) => {
  const timeoutMs = vascoTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;

  try {
    response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "tuval-vasco-excel",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw createHttpError(504, `Vasco API se ni odzval v ${Math.round(timeoutMs / 1000)} sekundah. Preveri povezavo do Vasca ali token.`);
    }

    throw createHttpError(502, `Vasco API ni dosegljiv: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }

  const responseText = await response.text();
  let responsePayload = null;
  try {
    responsePayload = responseText ? JSON.parse(responseText) : {};
  } catch (error) {
    responsePayload = responseText;
  }

  if (!response.ok) {
    const message = responsePayload?.title || responsePayload?.message || responsePayload?.detail || fallbackMessage;
    throw createHttpError(response.status, message, responsePayload);
  }

  return responsePayload;
};

const shouldEnrichCatalogs = (body) => {
  const filters = body.filters && typeof body.filters === "object" ? body.filters : body;
  const value = filters.dopolniNazive ?? filters.DopolniNazive ?? body.dopolniNazive;
  if (value === undefined || value === null || value === "") return true;

  const normalized = String(value).trim().toLocaleLowerCase("sl-SI");
  return !["0", "false", "ne", "no"].includes(normalized);
};

const fetchVascoOrders = async (body) => {
  const token = await resolveVascoToken(body);
  if (!token) {
    throw createHttpError(400, "Manjka Vasco prijava. Vnesi bearer token, vpiši Vasco uporabnika/geslo ali nastavi VASCO_API_USERNAME, VASCO_API_PASSWORD in VASCO_API_TAX_NUMBER.");
  }

  const filters = vascoFiltersFrom(body);
  assertUsefulVascoFilter(filters, body);

  const url = buildVascoOrdersUrl(filters);
  const payload = await fetchVascoJson(url, token, "Vasco API ni vrnil uspešnega odgovora.");

  if (!Array.isArray(payload)) {
    throw createHttpError(502, "Vasco API je vrnil nepričakovano obliko podatkov.", payload);
  }

  const warnings = shouldEnrichCatalogs(body) ? await enrichOrdersFromCatalogs(payload, token) : [];
  await fetchOrderStatesForOrders(payload, token, warnings);
  const planningData = await fetchVascoPlanningData(payload, token, body, warnings);

  return {
    filters,
    orders: payload,
    source: `${url.origin}${url.pathname}`,
    warnings,
    planningData,
  };
};

const fetchVascoOrderItemFields = async (body) => {
  const token = await resolveVascoToken(body);
  if (!token) {
    throw createHttpError(400, "Manjka Vasco prijava. Vnesi bearer token, vpiši Vasco uporabnika/geslo ali nastavi VASCO_API_USERNAME, VASCO_API_PASSWORD in VASCO_API_TAX_NUMBER.");
  }

  const url = new URL(`${vascoBaseUrl()}/api/v1/FA/narociloKupca/postavke/polja`);
  const payload = await fetchVascoJson(url, token, "Vasco API ni vrnil seznama polj.");

  if (!Array.isArray(payload)) {
    throw createHttpError(502, "Vasco API je vrnil nepričakovano obliko seznama polj.", payload);
  }

  return payload;
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

const normalizeKey = (value) =>
  String(value ?? "")
    .trim()
    .toLocaleLowerCase("sl-SI");

const firstValue = (object, keys) => {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return "";
};

const extraFieldNamesFrom = (body, orders = []) => {
  const bodyNames = Array.isArray(body.extraFieldNames)
    ? body.extraFieldNames
    : String(body.filters?.dodatnaPoljaPostavke || body.filters?.DodatnaPoljaPostavke || body.dodatnaPoljaPostavke || "")
        .split(",");

  const names = bodyNames.map((name) => String(name || "").trim()).filter(Boolean);

  orders.forEach((order) => {
    (Array.isArray(order.postavke) ? order.postavke : []).forEach((item) => {
      (Array.isArray(item.dodatnaPolja) ? item.dodatnaPolja : []).forEach((field) => {
        const name = field?.naziv || field?.name;
        if (name && !names.some((existing) => normalizeKey(existing) === normalizeKey(name))) {
          names.push(String(name));
        }
      });
    });
  });

  return names;
};

const extraFieldValue = (fields, name) => {
  if (!Array.isArray(fields) || !name) return "";
  const target = normalizeKey(name);
  const field = fields.find((entry) => normalizeKey(entry?.naziv || entry?.name) === target);
  return field?.vrednost ?? field?.value ?? "";
};

const objectFieldValue = (object, name) => {
  if (!object || typeof object !== "object" || !name) return "";
  const target = normalizeKey(name);
  const match = Object.entries(object).find(([key, value]) => normalizeKey(key) === target && value !== undefined && value !== null && value !== "");
  return match ? match[1] : "";
};

const itemFieldValue = (item, name) => {
  const extraValue = extraFieldValue(item?.dodatnaPolja, name);
  if (extraValue !== "") return extraValue;
  return objectFieldValue(item, name);
};

const objectValueByNames = (object, names) => {
  for (const name of names) {
    const value = objectFieldValue(object, name);
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return "";
};

const itemValueByNames = (item, names) => {
  for (const name of names) {
    const value = itemFieldValue(item, name);
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return "";
};

const canonicalItemExtraFields = new Set(
  [
    "sifra",
    "SIFRA",
    "KOLICINA",
    "CENA",
    "CENA_Z_DDV",
    "PRODAJNA_CENA",
    "PRODAJNA_CENA_Z_DDV",
    "PREDVID_DOBAVA",
    "PROSTO_D1",
  ].map(normalizeKey)
);

const displayExtraFieldNames = (names = []) => {
  const seen = new Set();
  return names.filter((name) => {
    const key = normalizeKey(name);
    if (!key || canonicalItemExtraFields.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const orderCustomerNameFrom = (order) =>
  objectValueByNames(order, ["nazivKupca", "nazivPartnerja", "nazivPartner", "partnerNaziv", "kupecNaziv"]);

const itemCodeFrom = (item) =>
  itemValueByNames(item, ["sifra", "SIFRA", "sifraArtikla", "sifra_artikla", "artikel", "Artikel"]);

const itemArticleNameFrom = (item) =>
  itemValueByNames(item, [
    "nazivArtikla",
    "naziv_artikla",
    "NAZIV_ARTIKLA",
    "nazivArt",
    "naziv",
    "opisArtikla",
    "opis_artikla",
  ]);

const itemNameFrom = (item) => itemArticleNameFrom(item) || itemValueByNames(item, ["OPIS"]);

const itemQuantityFrom = (item) =>
  itemValueByNames(item, ["kolicina", "količina", "kol", "KOLICINA", "kolicinaNarocena"]);

const itemPriceFrom = (item) =>
  itemValueByNames(item, [
    "cena",
    "CENA",
    "prodajnaCena",
    "prodajna_cena",
    "PRODAJNA_CENA",
    "cenaZDDV",
    "CENA_Z_DDV",
    "prodajnaCenaZDDV",
    "prodajnaCenaZDdv",
    "PRODAJNA_CENA_Z_DDV",
  ]);

const itemDeliveryFrom = (item) =>
  itemValueByNames(item, [
    "predvidenaDobava",
    "predvidDobava",
    "PREDVID_DOBAVA",
    "potrjenaDobava",
    "PROSTO_D1",
    "datumDobave",
    "datumVeljavnosti",
  ]);

const orderDeliveriesFrom = (order) => (Array.isArray(order?.dobave) ? order.dobave : []);

const deliveryDocumentFrom = (delivery) => {
  if (!delivery || typeof delivery !== "object") return "";
  const documentType = objectValueByNames(delivery, ["dokument", "Dokument"]);
  const number = [objectValueByNames(delivery, ["stevilka", "Stevilka"]), objectValueByNames(delivery, ["leto", "Leto"])]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .join(".");
  const date = formatDate(objectValueByNames(delivery, ["datum", "Datum"]));

  return [documentType, number, date].filter(Boolean).join(" ");
};

const orderDeliveriesTextFrom = (order) => orderDeliveriesFrom(order).map(deliveryDocumentFrom).filter(Boolean).join("; ");

const itemStockFrom = (item) =>
  itemValueByNames(item, [
    "zaloga",
    "ZALOGA",
    "prostaZaloga",
    "PROSTA_ZALOGA",
    "razpolozljivaZaloga",
    "zalogaRazpolozljiva",
    "STANJE_ZALOGE",
  ]);

const parseDecimal = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === undefined || value === null || value === "") return 0;

  const text = String(value).trim().replace(/\s+/g, "");
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
};

const dateKeyFrom = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const sl = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (sl) return `${sl[3]}-${sl[2].padStart(2, "0")}-${sl[1].padStart(2, "0")}`;

  return text;
};

const formatQuantity = (value) => {
  const number = parseDecimal(value);
  return Number.isFinite(number) ? Math.round(number * 1000) / 1000 : 0;
};

const itemPriceWithoutVatFrom = (item) =>
  itemValueByNames(item, ["prodajnaCena", "prodajna_cena", "PRODAJNA_CENA", "cena", "CENA"]);

const itemPriceWithVatFrom = (item) =>
  itemValueByNames(item, ["prodajnaCenaZDDV", "prodajnaCenaZDdv", "cenaZDDV", "CENA_Z_DDV", "PRODAJNA_CENA_Z_DDV"]);

const compactObject = (object) =>
  Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== "" && value !== undefined && value !== null && !(Array.isArray(value) && !value.length))
  );

const optionalNumber = (value) => {
  if (value === "" || value === undefined || value === null) return "";
  return parseDecimal(value);
};

const requiredInteger = (value, label) => {
  const number = Number(value);
  if (!Number.isInteger(number)) {
    throw createHttpError(400, `${label} mora biti celo število.`);
  }
  return number;
};

const todayDateTime = () => `${new Date().toISOString().slice(0, 10)}T00:00:00`;

const sourceOrderLabelFrom = (order) =>
  [objectValueByNames(order, ["stevilka", "Stevilka"]), objectValueByNames(order, ["leto", "Leto"])]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .join(".");

const selectedDeliveryRowsFrom = (body) => {
  const rows = Array.isArray(body.rows) ? body.rows : Array.isArray(body.deliveryRows) ? body.deliveryRows : [];

  if (!rows.length) {
    throw createHttpError(400, "Izberi vsaj eno postavko za dobavnico.");
  }

  return rows.map((row) => ({
    order: row?.order && typeof row.order === "object" ? row.order : {},
    item: row?.item && typeof row.item === "object" ? row.item : row?.postavka && typeof row.postavka === "object" ? row.postavka : {},
  }));
};

const deliveryLineFrom = ({ order, item }, index) => {
  const sifra = cleanValue(itemCodeFrom(item));
  const quantity = formatQuantity(itemQuantityFrom(item));

  if (!sifra) {
    throw createHttpError(400, `Postavka ${index + 1} nima šifre artikla.`);
  }

  if (!quantity || quantity <= 0) {
    throw createHttpError(400, `Postavka ${sifra} nima veljavne količine.`);
  }

  return compactObject({
    sifra,
    kolicina: quantity,
    prodajnaCena: optionalNumber(itemPriceWithoutVatFrom(item)),
    prodajnaCenaZDdv: optionalNumber(itemPriceWithVatFrom(item)),
    rabat1: optionalNumber(objectValueByNames(item, ["rabat1", "Rabat1", "rabat"])),
    stopnjaDdv: optionalNumber(objectValueByNames(item, ["stopnjaDdv", "stopnjaDDV", "StopnjaDdv", "StopnjaDDV"])),
    _sourceOrder: sourceOrderLabelFrom(order),
    _articleName: itemNameFrom(item),
  });
};

const deliveryGroupKeyFrom = (order) =>
  [
    objectValueByNames(order, ["partner", "Partner"]),
    objectValueByNames(order, ["skladisce", "skladišče", "Skladisce", "SkladisceZaloge"]),
    objectValueByNames(order, ["prodajalna", "Prodajalna"]),
    objectValueByNames(order, ["komercialist", "Komercialist"]),
    objectValueByNames(order, ["potnik", "Potnik"]),
    objectValueByNames(order, ["komisionar", "Komisionar"]),
  ]
    .map((value) => String(value ?? "").trim())
    .join("|");

const deliveryDocumentsFromRows = (rows, body = {}) => {
  const date = normalizeDateTime(body.deliveryDate || body.datum || body.datumDobavnice || todayDateTime());
  const groups = new Map();

  rows.forEach((row, index) => {
    const partnerRaw = objectValueByNames(row.order, ["partner", "Partner"]);
    const partner = requiredInteger(partnerRaw, "Partner");
    const key = deliveryGroupKeyFrom(row.order);
    const current = groups.get(key) || {
      order: row.order,
      partner,
      postavke: [],
      sourceOrders: new Set(),
      sourceCustomers: new Set(),
    };

    const line = deliveryLineFrom(row, index);
    if (line._sourceOrder) current.sourceOrders.add(line._sourceOrder);
    const customer = orderCustomerNameFrom(row.order);
    if (customer) current.sourceCustomers.add(customer);
    current.postavke.push(line);
    groups.set(key, current);
  });

  return Array.from(groups.values()).map((group) => {
    const order = group.order;
    const request = compactObject({
      datum: date,
      partner: group.partner,
      prodajalna: optionalNumber(objectValueByNames(order, ["prodajalna", "Prodajalna"])),
      komercialist: cleanValue(objectValueByNames(order, ["komercialist", "Komercialist"])),
      potnik: cleanValue(objectValueByNames(order, ["potnik", "Potnik"])),
      komisionar: cleanValue(objectValueByNames(order, ["komisionar", "Komisionar"])),
      skladisce: optionalNumber(objectValueByNames(order, ["skladisce", "skladišče", "Skladisce", "SkladisceZaloge"])),
      rabat1: optionalNumber(objectValueByNames(order, ["rabat1", "Rabat1", "rabat"])),
      postavke: group.postavke.map(({ _sourceOrder, _articleName, ...line }) => line),
    });

    return {
      request,
      summary: {
        partner: group.partner,
        nazivKupca: Array.from(group.sourceCustomers).join("; "),
        sourceOrders: Array.from(group.sourceOrders).join(", "),
        itemCount: request.postavke.length,
        quantity: formatQuantity(request.postavke.reduce((sum, item) => sum + parseDecimal(item.kolicina), 0)),
      },
    };
  });
};

const createVascoDeliveryNotes = async (body) => {
  const rows = selectedDeliveryRowsFrom(body);
  const documents = deliveryDocumentsFromRows(rows, body);

  if (body.dryRun) {
    return {
      ok: true,
      dryRun: true,
      count: documents.length,
      documents,
    };
  }

  const token = await resolveVascoToken(body);
  if (!token) {
    throw createHttpError(400, "Manjka Vasco prijava. Vnesi bearer token, vpiši Vasco uporabnika/geslo ali nastavi VASCO_API_USERNAME, VASCO_API_PASSWORD in VASCO_API_TAX_NUMBER.");
  }

  const url = new URL(`${vascoBaseUrl()}/api/v1/FA/dobavnica`);
  const created = [];

  for (const document of documents) {
    const response = await postVascoJson(url, token, document.request, "Dobavnice ni bilo mogoče ustvariti.");
    created.push({
      ...document.summary,
      response,
      stevilka: response?.stevilka || response?.Stevilka || "",
      leto: response?.leto || response?.Leto || "",
    });
  }

  return {
    ok: true,
    count: created.length,
    created,
  };
};

const selectedSupplierOrderRowsFrom = (body) => {
  const rows = Array.isArray(body.rows) ? body.rows : Array.isArray(body.stockRows) ? body.stockRows : [];

  if (!rows.length) {
    throw createHttpError(400, "Označi vsaj eno vrstico v Planu naročanja.");
  }

  return rows.filter((row) => row && typeof row === "object");
};

const supplierFromStockRow = (row) =>
  cleanValue(objectValueByNames(row, ["sifraDobavitelja", "dobavitelj", "partnerDobavitelj", "partner"]));

const quantityToOrderFromStockRow = (row) => {
  const preferred = objectValueByNames(row, ["kolicinaZaNarociti", "kolicinaNarocila", "zaNarociti", "zaPripravo", "manjkaZaNarociti"]);
  if (preferred !== "") return formatQuantity(preferred);
  return formatQuantity(objectValueByNames(row, ["seDobaviti", "potrebnaKolicina", "kolicina"]));
};

const singleWarehouseFrom = (value) => {
  const parts = String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length === 1 ? optionalNumber(parts[0]) : "";
};

const supplierOrderDocumentsFromRows = (rows, body = {}) => {
  const date = normalizeDateTime(body.orderDate || body.datum || body.datumNarocila || todayDateTime());
  const missingSupplier = [];
  const invalidQuantity = [];
  const groups = new Map();

  rows.forEach((row) => {
    const sifra = cleanValue(objectValueByNames(row, ["sifra", "Sifra"]));
    const supplier = supplierFromStockRow(row);
    const quantity = quantityToOrderFromStockRow(row);

    if (!sifra) return;
    if (!supplier || !isSingleIntegerText(supplier)) {
      missingSupplier.push([sifra, objectValueByNames(row, ["nazivArtikla", "naziv"])].filter(Boolean).join(" - "));
      return;
    }

    if (!quantity || quantity <= 0) {
      invalidQuantity.push(sifra);
      return;
    }

    const warehouse = singleWarehouseFrom(objectValueByNames(row, ["skladisce", "skladisceZaloge", "skladisca"]));
    const key = [supplier, warehouse].join("|");
    const current = groups.get(key) || {
      supplier,
      warehouse,
      rows: [],
      postavke: [],
    };

    current.rows.push(row);
    current.postavke.push(
      compactObject({
        sifra,
        naziv: cleanValue(objectValueByNames(row, ["nazivArtikla", "naziv"])),
        enota: cleanValue(objectValueByNames(row, ["enota", "Enota"])),
        kolicina: quantity,
        nabavnaCena: optionalNumber(objectValueByNames(row, ["nabavnaCena", "NabavnaCena"])),
      })
    );
    groups.set(key, current);
  });

  if (missingSupplier.length) {
    throw createHttpError(400, `Za te artikle manjka šifra dobavitelja: ${missingSupplier.slice(0, 8).join("; ")}${missingSupplier.length > 8 ? " ..." : ""}`);
  }

  if (invalidQuantity.length) {
    throw createHttpError(400, `Te vrstice nimajo količine za naročiti: ${invalidQuantity.slice(0, 8).join(", ")}${invalidQuantity.length > 8 ? " ..." : ""}`);
  }

  const documents = Array.from(groups.values()).map((group) => ({
    request: compactObject({
      tipStevilcenja: 0,
      datum: date,
      partner: requiredInteger(group.supplier, "Dobavitelj"),
      skladisce: group.warehouse,
      postavke: group.postavke,
    }),
    summary: {
      partner: requiredInteger(group.supplier, "Dobavitelj"),
      skladisce: group.warehouse,
      itemCount: group.postavke.length,
      quantity: formatQuantity(group.postavke.reduce((sum, item) => sum + parseDecimal(item.kolicina), 0)),
      articles: group.postavke.map((item) => item.sifra).join(", "),
    },
  }));

  if (!documents.length) {
    throw createHttpError(400, "Ni veljavnih vrstic za naročilo dobavitelju.");
  }

  return documents;
};

const createVascoSupplierOrders = async (body) => {
  const rows = selectedSupplierOrderRowsFrom(body);
  const documents = supplierOrderDocumentsFromRows(rows, body);

  if (body.dryRun) {
    return {
      ok: true,
      dryRun: true,
      count: documents.length,
      documents,
    };
  }

  const token = await resolveVascoToken(body);
  if (!token) {
    throw createHttpError(400, "Manjka Vasco prijava. Vnesi bearer token, vpiši Vasco uporabnika/geslo ali nastavi VASCO_API_USERNAME, VASCO_API_PASSWORD in VASCO_API_TAX_NUMBER.");
  }

  const url = new URL(`${vascoBaseUrl()}/api/v1/FA/narociloDobavitelju`);
  const created = [];

  for (const document of documents) {
    const response = await postVascoJson(url, token, document.request, "Naročila dobavitelju ni bilo mogoče ustvariti.");
    created.push({
      ...document.summary,
      response,
      stevilka: response?.stevilka || response?.Stevilka || "",
      leto: response?.leto || response?.Leto || "",
    });
  }

  return {
    ok: true,
    count: created.length,
    created,
  };
};

const planningEntryFor = (planningData, groupName, articleKey) => {
  const group = planningData?.[groupName];
  if (!group || !articleKey) return null;
  if (group instanceof Map) return group.get(articleKey) || null;
  return group[articleKey] || null;
};

const stockPlanRowsFromGroups = (groups, stockByArticle = new Map(), planningData = {}) => {
  const rows = Array.from(groups.values()).sort((a, b) => {
    const articleSort = a.sifra.localeCompare(b.sifra, "sl", { numeric: true });
    if (articleSort) return articleSort;
    return (a.datumDobave || "9999-99-99").localeCompare(b.datumDobave || "9999-99-99");
  });

  const cumulativeByArticle = new Map();
  return rows.map((row) => {
    const neededQuantity = row.seDobaviti !== undefined ? row.seDobaviti : row.potrebnaKolicina;
    const cumulative = formatQuantity((cumulativeByArticle.get(row.articleKey) || 0) + neededQuantity);
    cumulativeByArticle.set(row.articleKey, cumulative);

    const hasStock = stockByArticle.has(row.articleKey);
    const stockEntry = planningEntryFor(planningData, "stockByArticle", row.articleKey) || (hasStock ? stockByArticle.get(row.articleKey) : null);
    const supplierEntry = planningEntryFor(planningData, "supplierByArticle", row.articleKey);
    const articleEntry = planningEntryFor(planningData, "articleByArticle", row.articleKey);
    const hasVascoStock = Boolean(stockEntry);
    const stock = hasVascoStock ? parseDecimal(stockEntry.zaloga) : "";
    const reserved = hasVascoStock && stockEntry.rezervirano !== "" ? parseDecimal(stockEntry.rezervirano) : "";
    const vascoCustomers = hasVascoStock && stockEntry.narKupKolicina !== "" ? parseDecimal(stockEntry.narKupKolicina) : "";
    const supplierOrdered = supplierEntry ? parseDecimal(supplierEntry.narocenoDobaviteljem) : 0;
    const optimalStock = articleEntry?.optimalnaZaloga !== undefined && articleEntry?.optimalnaZaloga !== ""
      ? parseDecimal(articleEntry.optimalnaZaloga)
      : 0;
    const stockForCalculation = hasVascoStock ? stock : 0;
    const targetQuantity = formatQuantity(cumulative + optimalStock);
    const zaPripravo = hasVascoStock || supplierOrdered || optimalStock
      ? Math.max(0, formatQuantity(targetQuantity - stockForCalculation - supplierOrdered))
      : cumulative;
    const status = hasVascoStock || supplierOrdered || optimalStock
      ? (zaPripravo > 0 ? "Treba naročiti" : "Zaloga/naročeno zadostuje")
      : "Preveri zalogo";

    return {
      oznaciNabavo: "",
      sifra: row.sifra,
      nazivArtikla: row.nazivArtikla,
      datumDobave: formatDate(row.datumDobave),
      potrebnaKolicina: formatQuantity(row.potrebnaKolicina),
      seDobaviti: formatQuantity(neededQuantity),
      kumulativnaPotreba: cumulative,
      optimalnaZaloga: optimalStock ? formatQuantity(optimalStock) : "",
      zaloga: hasVascoStock ? formatQuantity(stock) : "",
      zalogaOst: row.zalogaOst !== undefined && row.zalogaOst !== null && row.zalogaOst !== "" ? formatQuantity(row.zalogaOst) : "",
      rezervirano: reserved === "" ? "" : formatQuantity(reserved),
      vascoKupci: vascoCustomers === "" ? "" : formatQuantity(vascoCustomers),
      narocenoDobaviteljem: supplierOrdered ? formatQuantity(supplierOrdered) : "",
      zaPripravo: formatQuantity(zaPripravo),
      status,
      sifraDobavitelja: articleEntry?.dobavitelj || "",
      enota: articleEntry?.enota || "",
      nabavnaCena: articleEntry?.nabavnaCena || "",
      pakiranje: articleEntry?.pakiranje !== undefined && articleEntry?.pakiranje !== "" ? formatQuantity(articleEntry.pakiranje) : "",
      skladisca: stockEntry?.skladisca || "",
      narocila: Array.from(row.narocila).join(", "),
      narocilaDobaviteljem: supplierEntry?.narocilaDobaviteljem || "",
      kupci: Array.from(row.kupci).join("; "),
      stPostavk: row.stPostavk,
    };
  });
};

const openCustomerOrderCodeFrom = (entry) => objectValueByNames(entry, ["sifra", "Sifra"]);

const openCustomerOrderNameFrom = (entry) =>
  joinedName(
    objectValueByNames(entry, ["naziv", "Naziv", "nazivArtikla"]),
    objectValueByNames(entry, ["naziv2", "Naziv2"])
  );

const openCustomerOrderQuantityFrom = (entry) => {
  const openQuantity = objectValueByNames(entry, ["seDobaviti", "SeDobaviti"]);
  if (openQuantity !== "") return parseDecimal(openQuantity);

  return Math.max(
    0,
    parseDecimal(objectValueByNames(entry, ["naroceno", "Naroceno"])) -
      parseDecimal(objectValueByNames(entry, ["dobavljeno", "Dobavljeno"]))
  );
};

const openCustomerOrderNumberFrom = (entry) => {
  const orderNumber = [
    objectValueByNames(entry, ["stevilka", "Stevilka"]),
    objectValueByNames(entry, ["leto", "Leto"]),
  ]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .join(".");
  const customerNumber = objectValueByNames(entry, ["stevilkaNarocila", "StevilkaNarocila"]);

  return customerNumber && orderNumber ? `${orderNumber} (${customerNumber})` : orderNumber || customerNumber;
};

const stockPlanRowsFromOpenCustomerOrders = (openCustomerOrders, planningData = {}) => {
  const groups = new Map();
  const stockByArticle = new Map();
  const customerLabel = planningData.openCustomerPartnerLabel || planningData.openCustomerPartner || "";

  openCustomerOrders.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;

    const sifra = String(openCustomerOrderCodeFrom(entry) || "BREZ ŠIFRE").trim();
    const articleKey = normalizeKey(sifra);
    const deliveryKey = dateKeyFrom(objectValueByNames(entry, ["predvidenaDobava", "PredvidenaDobava", "datum", "Datum"]));
    const quantity = openCustomerOrderQuantityFrom(entry);
    if (!quantity) return;

    const stockRaw = objectValueByNames(entry, ["zaloga", "Zaloga"]);
    if (stockRaw !== "" && !stockByArticle.has(articleKey)) {
      stockByArticle.set(articleKey, {
        zaloga: parseDecimal(stockRaw),
        narKupKolicina: "",
        rezervirano: "",
        skladisca: "",
      });
    }

    const stockLeftRaw = objectValueByNames(entry, ["zalogaOst", "ZalogaOst"]);
    const stockLeft = stockLeftRaw === "" ? null : parseDecimal(stockLeftRaw);
    const groupKey = `${articleKey}||${deliveryKey || "brez-datuma"}`;
    const current = groups.get(groupKey) || {
      articleKey,
      sifra,
      nazivArtikla: openCustomerOrderNameFrom(entry),
      datumDobave: deliveryKey,
      potrebnaKolicina: 0,
      seDobaviti: 0,
      zalogaOst: stockLeft,
      narocila: new Set(),
      kupci: new Set(),
      stPostavk: 0,
    };

    current.nazivArtikla = current.nazivArtikla || openCustomerOrderNameFrom(entry);
    current.potrebnaKolicina += parseDecimal(objectValueByNames(entry, ["naroceno", "Naroceno"])) || quantity;
    current.seDobaviti += quantity;
    current.stPostavk += 1;
    if (stockLeft !== null) current.zalogaOst = current.zalogaOst === null ? stockLeft : Math.min(current.zalogaOst, stockLeft);
    const orderNumber = openCustomerOrderNumberFrom(entry);
    if (orderNumber) current.narocila.add(orderNumber);
    if (customerLabel) current.kupci.add(customerLabel);
    groups.set(groupKey, current);
  });

  return stockPlanRowsFromGroups(groups, stockByArticle, planningData);
};

const stockPlanRowsForExcel = (orders, planningData = {}) => {
  const openCustomerOrders = Array.isArray(planningData.openCustomerOrders) ? planningData.openCustomerOrders : [];
  if (openCustomerOrders.length) {
    return stockPlanRowsFromOpenCustomerOrders(openCustomerOrders, planningData);
  }

  const groups = new Map();
  const stockByArticle = new Map();

  orders.forEach((order) => {
    (Array.isArray(order.postavke) ? order.postavke : []).forEach((item) => {
      const sifra = String(itemCodeFrom(item) || "BREZ ŠIFRE").trim();
      const articleKey = normalizeKey(sifra);
      const deliveryRaw = itemDeliveryFrom(item) || order.datum;
      const deliveryKey = dateKeyFrom(deliveryRaw);
      const quantity = parseDecimal(itemQuantityFrom(item));
      if (!quantity) return;

      const stockRaw = itemStockFrom(item);
      if (stockRaw !== "" && !stockByArticle.has(articleKey)) {
        stockByArticle.set(articleKey, {
          zaloga: parseDecimal(stockRaw),
          narKupKolicina: "",
          rezervirano: "",
          skladisca: "",
        });
      }

      const groupKey = `${articleKey}||${deliveryKey || "brez-datuma"}`;
      const current = groups.get(groupKey) || {
        articleKey,
        sifra,
        nazivArtikla: itemNameFrom(item),
        datumDobave: deliveryKey,
        potrebnaKolicina: 0,
        narocila: new Set(),
        kupci: new Set(),
        stPostavk: 0,
      };

      current.nazivArtikla = current.nazivArtikla || itemNameFrom(item);
      current.potrebnaKolicina += quantity;
      current.stPostavk += 1;
      if (order.stevilka) current.narocila.add([order.stevilka, order.leto].filter(Boolean).join("."));
      if (order.partner) current.kupci.add([order.partner, orderCustomerNameFrom(order)].filter(Boolean).join(" - "));
      groups.set(groupKey, current);
    });
  });

  return stockPlanRowsFromGroups(groups, stockByArticle, planningData);
};

const uniqueCleanValues = (values) => {
  const seen = new Set();
  const unique = [];

  values.forEach((value) => {
    const clean = String(value ?? "").trim();
    const key = normalizeKey(clean);
    if (!clean || seen.has(key)) return;
    seen.add(key);
    unique.push(clean);
  });

  return unique;
};

const chunkValues = (values, size = 100) => {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

const arrayFromVascoPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return null;

  for (const key of ["data", "items", "value", "result", "results"]) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  return null;
};

const joinedName = (...values) => {
  const parts = uniqueCleanValues(values);
  return parts.join(" ");
};

const articleNameFrom = (article) =>
  joinedName(
    objectValueByNames(article, ["naziv", "Naziv", "nazivArtikla", "opis"]),
    objectValueByNames(article, ["naziv2", "Naziv2"])
  );

const objectOrExtraValueByNames = (object, names) => {
  const directValue = objectValueByNames(object, names);
  if (directValue !== "") return directValue;

  for (const name of names) {
    const extraValue = extraFieldValue(object?.dodatnaPolja, name);
    if (extraValue !== "") return extraValue;
  }

  return "";
};

const monthFieldNames = (baseNames) => {
  const month = new Date().getMonth() + 1;
  const monthText = String(month);
  const monthPadded = monthText.padStart(2, "0");
  const suffixes = [monthText, monthPadded, `M${monthText}`, `M${monthPadded}`, `MESEC${monthText}`, `MESEC${monthPadded}`];

  return baseNames.flatMap((name) => [
    name,
    ...suffixes.flatMap((suffix) => [`${name}${suffix}`, `${name}_${suffix}`, `${suffix}_${name}`]),
  ]);
};

const articleOptimalStockFrom = (article) =>
  objectOrExtraValueByNames(
    article,
    monthFieldNames([
      "optimalnaZaloga",
      "optimalna_zaloga",
      "OPTIMALNA_ZALOGA",
      "optZaloga",
      "OPT_ZALOGA",
      "zalogaOptimalna",
      "ZALOGA_OPTIMALNA",
      "ciljnaZaloga",
      "CILJNA_ZALOGA",
      "mesecnaZaloga",
      "MESECNA_ZALOGA",
      "minZaloga",
      "MIN_ZALOGA",
      "minimalnaZaloga",
      "MINIMALNA_ZALOGA",
    ])
  );

const articlePackSizeFrom = (article) =>
  objectOrExtraValueByNames(article, [
    "pakiranje",
    "Pakiranje",
    "PAKIRANJE",
    "kolicinaPakiranja",
    "količinaPakiranja",
    "KOLICINA_PAKIRANJA",
    "pakirnaKolicina",
    "PAKIRNA_KOLICINA",
    "narocilnaKolicina",
    "NAROCILNA_KOLICINA",
    "minimalnoNarocilo",
    "MINIMALNO_NAROCILO",
    "minimalnaKolicinaNarocila",
    "MIN_KOL_NAROCILA",
  ]);

const partnerNameFrom = (partner) =>
  joinedName(
    objectValueByNames(partner, ["naziv", "Naziv"]),
    objectValueByNames(partner, ["naziv2", "Naziv2"])
  );

const catalogKeyFrom = (entry) => objectValueByNames(entry, ["sifra", "Sifra", "code", "id"]);

const fetchCatalogMap = async ({ token, pathName, codes, valueFrom, label }) => {
  const map = new Map();
  const batches = chunkValues(uniqueCleanValues(codes), 100);

  for (const batch of batches) {
    const url = new URL(`${vascoBaseUrl()}${pathName}`);
    url.searchParams.set("Sifra", batch.join(","));
    const payload = await fetchVascoJson(url, token, `${label} ni bilo mogoče prebrati.`);
    const entries = arrayFromVascoPayload(payload);

    if (!entries) {
      throw createHttpError(502, `${label} je vrnil nepričakovano obliko podatkov.`, payload);
    }

    entries.forEach((entry) => {
      const key = catalogKeyFrom(entry);
      const value = valueFrom(entry);
      if (key !== "" && value !== "") {
        map.set(normalizeKey(key), value);
      }
    });
  }

  return map;
};

const fetchArticleMap = (token, codes) =>
  fetchCatalogMap({
    token,
    pathName: "/api/v1/FASifranti/artikel",
    codes,
    valueFrom: articleNameFrom,
    label: "Šifrant artiklov",
  });

const fetchArticleDetailsByArticle = async (token, codes) => {
  const map = new Map();
  const batches = chunkValues(uniqueCleanValues(codes), 100);

  for (const batch of batches) {
    const url = new URL(`${vascoBaseUrl()}/api/v1/FASifranti/artikel`);
    url.searchParams.set("Sifra", batch.join(","));
    const payload = await fetchVascoJson(url, token, "Šifranta artiklov ni bilo mogoče prebrati.");
    const entries = arrayFromVascoPayload(payload);

    if (!entries) {
      throw createHttpError(502, "Šifrant artiklov je vrnil nepričakovano obliko podatkov.", payload);
    }

    entries.forEach((entry) => {
      const code = catalogKeyFrom(entry);
      if (!code) return;

      map.set(normalizeKey(code), {
        sifra: code,
        nazivArtikla: articleNameFrom(entry),
        dobavitelj: objectValueByNames(entry, ["dobavitelj", "Dobavitelj", "sifraDobavitelja", "SifraDobavitelja"]),
        enota: objectValueByNames(entry, ["enota", "Enota", "em"]),
        nabavnaCena: objectValueByNames(entry, ["nabavnaCena", "NabavnaCena", "NABAVNA_CENA"]),
        optimalnaZaloga: articleOptimalStockFrom(entry),
        pakiranje: articlePackSizeFrom(entry),
      });
    });
  }

  return map;
};

const fetchPartnerMap = (token, codes) =>
  fetchCatalogMap({
    token,
    pathName: "/api/v1/SkupniSifranti/partner",
    codes,
    valueFrom: partnerNameFrom,
    label: "Šifrant partnerjev",
  });

const mapToPlainObject = (map) =>
  Object.fromEntries(Array.from(map.entries()).map(([key, value]) => [key, value]));

const planningOptionsFrom = (body) => {
  const filters = body.filters && typeof body.filters === "object" ? body.filters : body;

  return {
    skladisceZaloge: cleanValue(filters.skladisceZaloge || filters.SkladisceZaloge || ""),
    datumDobaviteljaOd: normalizeDateTime(filters.datumDobaviteljaOd || filters.DatumDobaviteljaOd || filters.datumOd || filters.DatumOd || ""),
    datumDobaviteljaDo: normalizeDateTime(filters.datumDobaviteljaDo || filters.DatumDobaviteljaDo || filters.datumDo || filters.DatumDo || ""),
  };
};

const fetchStockByArticle = async (token, codes, options = {}) => {
  const map = new Map();
  const batches = chunkValues(uniqueCleanValues(codes), 100);

  for (const batch of batches) {
    const url = new URL(`${vascoBaseUrl()}/api/v1/FASifranti/zaloga`);
    url.searchParams.set("Sifra", batch.join(","));
    if (options.skladisceZaloge) url.searchParams.set("Skladisce", options.skladisceZaloge);

    const payload = await fetchVascoJson(url, token, "Zaloge artiklov ni bilo mogoče prebrati.");
    const entries = arrayFromVascoPayload(payload);
    if (!entries) {
      throw createHttpError(502, "Zaloga artiklov je vrnila nepričakovano obliko podatkov.", payload);
    }

    entries.forEach((entry) => {
      const code = objectValueByNames(entry, ["sifra", "Sifra"]);
      if (!code) return;

      const key = normalizeKey(code);
      const current = map.get(key) || {
        zaloga: 0,
        narKupKolicina: 0,
        rezervirano: 0,
        skladisca: new Set(),
      };

      current.zaloga += parseDecimal(objectValueByNames(entry, ["zaloga", "Zaloga"]));
      current.narKupKolicina += parseDecimal(objectValueByNames(entry, ["narKupKolicina", "NarKupKolicina"]));
      current.rezervirano += parseDecimal(objectValueByNames(entry, ["rezervirano", "Rezervirano"]));
      const skladisce = objectValueByNames(entry, ["skladisce", "Skladisce"]);
      if (skladisce !== "") current.skladisca.add(String(skladisce));
      map.set(key, current);
    });
  }

  map.forEach((value) => {
    value.zaloga = formatQuantity(value.zaloga);
    value.narKupKolicina = formatQuantity(value.narKupKolicina);
    value.rezervirano = formatQuantity(value.rezervirano);
    value.skladisca = Array.from(value.skladisca).join(",");
  });

  return map;
};

const fetchSupplierOrdersByArticle = async (token, codes, options = {}) => {
  const map = new Map();
  if (!options.datumDobaviteljaOd && !options.datumDobaviteljaDo) {
    return map;
  }

  const wanted = new Set(uniqueCleanValues(codes).map(normalizeKey));
  const url = new URL(`${vascoBaseUrl()}/api/v1/FA/narociloDobavitelju`);
  if (options.datumDobaviteljaOd) url.searchParams.set("DatumOd", options.datumDobaviteljaOd);
  if (options.datumDobaviteljaDo) url.searchParams.set("DatumDo", options.datumDobaviteljaDo);
  url.searchParams.set("VrniPostavke", "1");

  const payload = await fetchVascoJson(url, token, "Naročil dobaviteljem ni bilo mogoče prebrati.");
  const orders = arrayFromVascoPayload(payload);
  if (!orders) {
    throw createHttpError(502, "Naročila dobaviteljem so vrnila nepričakovano obliko podatkov.", payload);
  }

  orders.forEach((order) => {
    (Array.isArray(order.postavke) ? order.postavke : []).forEach((item) => {
      const code = itemCodeFrom(item);
      const key = normalizeKey(code);
      if (!key || !wanted.has(key)) return;

      const current = map.get(key) || {
        narocenoDobaviteljem: 0,
        narocilaDobaviteljem: new Set(),
      };

      current.narocenoDobaviteljem += parseDecimal(itemQuantityFrom(item));
      if (order.stevilka) current.narocilaDobaviteljem.add([order.stevilka, order.leto].filter(Boolean).join("."));
      map.set(key, current);
    });
  });

  map.forEach((value) => {
    value.narocenoDobaviteljem = formatQuantity(value.narocenoDobaviteljem);
    value.narocilaDobaviteljem = Array.from(value.narocilaDobaviteljem).join(", ");
  });

  return map;
};

const openCustomerOptionsFrom = (body) => {
  const filters = body.filters && typeof body.filters === "object" ? body.filters : body;
  const partner = cleanValue(filters.partner || filters.Partner || "");

  return {
    partner,
    prodajalna: cleanValue(filters.prodajalna || filters.Prodajalna || ""),
  };
};

const isSingleIntegerText = (value) => /^\d+$/.test(String(value ?? "").trim());

const fetchOpenCustomerOrders = async (token, body, warnings = []) => {
  const options = openCustomerOptionsFrom(body);
  if (!options.partner) return [];

  if (!isSingleIntegerText(options.partner)) {
    return [];
  }

  const buildUrl = (includeStore = true) => {
    const url = new URL(`${vascoBaseUrl()}/api/v1/FA/odpritaNarocilaKupca`);
    url.searchParams.set("Partner", String(options.partner));
    if (includeStore && options.prodajalna !== "") url.searchParams.set("Prodajalna", String(options.prodajalna));
    return url;
  };

  let payload;
  try {
    payload = await fetchVascoJson(buildUrl(true), token, "Odprtih naročil kupca ni bilo mogoče prebrati.");
  } catch (error) {
    if (!options.prodajalna) throw error;
    payload = await fetchVascoJson(buildUrl(false), token, "Odprtih naročil kupca ni bilo mogoče prebrati.");
  }
  const rows = arrayFromVascoPayload(payload);
  if (!rows) {
    throw createHttpError(502, "Odprta naročila kupca so vrnila nepričakovano obliko podatkov.", payload);
  }

  return rows;
};

const fetchOrderStatesForOrders = async (orders, token, warnings = []) => {
  const candidates = orders.filter((order) => order?.stevilka && order?.leto);
  const maxRequests = 80;
  let failedCount = 0;
  let firstError = "";

  const fetchOneState = async (order) => {
    const url = new URL(
      `${vascoBaseUrl()}/api/v1/FA/narociloKupca/stanje/${encodeURIComponent(order.stevilka)}/${encodeURIComponent(order.leto)}`
    );

    try {
      const payload = await fetchVascoJson(url, token, "Stanja naročila kupca ni bilo mogoče prebrati.");
      const stateRows = arrayFromVascoPayload(payload) || (payload && typeof payload === "object" ? [payload] : null);
      if (!stateRows) {
        throw createHttpError(502, "Stanje naročila kupca je vrnilo nepričakovano obliko podatkov.", payload);
      }

      order.stanjeNarocila = stateRows;
      order.dobave = stateRows.flatMap((state) => (Array.isArray(state?.dobava) ? state.dobava : []));
    } catch (error) {
      failedCount += 1;
      if (!firstError) firstError = error.message;
    }
  };

  for (const batch of chunkValues(candidates.slice(0, maxRequests), 6)) {
    await Promise.all(batch.map(fetchOneState));
  }

  if (candidates.length > maxRequests) {
    warnings.push(`Stanje naročila je dopolnjeno za prvih ${maxRequests} naročil od ${candidates.length}.`);
  }

  if (failedCount) {
    warnings.push(`Stanja ${failedCount} naročil ni bilo mogoče dopolniti: ${firstError}`);
  }
};

const fetchVascoPlanningData = async (orders, token, body, warnings = []) => {
  const planningData = {
    stockByArticle: {},
    supplierByArticle: {},
    articleByArticle: {},
    openCustomerOrders: [],
  };

  try {
    planningData.openCustomerOrders = await fetchOpenCustomerOrders(token, body, warnings);
  } catch (error) {
    planningData.openCustomerOrders = [];
    planningData.openCustomerOrdersWarning = error.message;
  }

  const openCustomerOptions = openCustomerOptionsFrom(body);
  planningData.openCustomerPartner = openCustomerOptions.partner;
  const matchingOrder = orders.find((order) => normalizeKey(order.partner) === normalizeKey(openCustomerOptions.partner));
  const customerName = matchingOrder ? orderCustomerNameFrom(matchingOrder) : "";
  planningData.openCustomerPartnerLabel = [openCustomerOptions.partner, customerName].filter(Boolean).join(" - ");

  const articleCodes = uniqueCleanValues([
    ...orders.flatMap((order) => (Array.isArray(order.postavke) ? order.postavke : []).map(itemCodeFrom)),
    ...planningData.openCustomerOrders.map(openCustomerOrderCodeFrom),
  ]);

  if (!articleCodes.length) return planningData;

  const options = planningOptionsFrom(body);

  try {
    planningData.stockByArticle = mapToPlainObject(await fetchStockByArticle(token, articleCodes, options));
  } catch (error) {
    warnings.push(`Zaloge iz Vasca ni bilo mogoče dopolniti: ${error.message}`);
  }

  try {
    planningData.supplierByArticle = mapToPlainObject(await fetchSupplierOrdersByArticle(token, articleCodes, options));
    if (!options.datumDobaviteljaOd && !options.datumDobaviteljaDo) {
      warnings.push("Naročila dobaviteljem niso vključena, ker ni vnesen datum od/do.");
    }
  } catch (error) {
    warnings.push(`Naročil dobaviteljem ni bilo mogoče dopolniti: ${error.message}`);
  }

  try {
    planningData.articleByArticle = mapToPlainObject(await fetchArticleDetailsByArticle(token, articleCodes));
  } catch (error) {
    warnings.push(`Dobaviteljev artiklov ni bilo mogoče dopolniti: ${error.message}`);
  }

  return planningData;
};

const enrichOrdersFromCatalogs = async (orders, token) => {
  const warnings = [];
  const partnerCodes = uniqueCleanValues(orders.map((order) => order.partner));
  const articleCodes = uniqueCleanValues(
    orders.flatMap((order) => (Array.isArray(order.postavke) ? order.postavke : []).map(itemCodeFrom))
  );

  let partnerMap = new Map();
  let articleMap = new Map();

  if (partnerCodes.length) {
    try {
      partnerMap = await fetchPartnerMap(token, partnerCodes);
    } catch (error) {
      warnings.push(`Nazivov kupcev ni bilo mogoče dopolniti: ${error.message}`);
    }
  }

  if (articleCodes.length) {
    try {
      articleMap = await fetchArticleMap(token, articleCodes);
    } catch (error) {
      warnings.push(`Nazivov artiklov ni bilo mogoče dopolniti: ${error.message}`);
    }
  }

  orders.forEach((order) => {
    const partnerName = partnerMap.get(normalizeKey(order.partner));
    if (!orderCustomerNameFrom(order) && partnerName) {
      order.nazivKupca = partnerName;
    }

    (Array.isArray(order.postavke) ? order.postavke : []).forEach((item) => {
      const articleName = articleMap.get(normalizeKey(itemCodeFrom(item)));
      if (!itemArticleNameFrom(item) && articleName) {
        item.nazivArtikla = articleName;
      }
    });
  });

  return warnings;
};

const orderRowsForExcel = (orders) =>
  orders.map((order) => ({
    stevilka: order.stevilka,
    leto: order.leto,
    datum: formatDate(order.datum),
    partner: order.partner,
    nazivKupca: orderCustomerNameFrom(order),
    komercialist: order.komercialist,
    znesek: order.znesek,
    znesekZDDV: order.znesekZDDV,
    rabat1: order.rabat1,
    skladisce: order.skladisce,
    besedilo: order.besedilo,
    popravljaDokument: order.popravljaDokument,
    priloge: Array.isArray(order.dokIdPriloge) ? order.dokIdPriloge.length : 0,
    stDobav: orderDeliveriesFrom(order).length,
    dobave: orderDeliveriesTextFrom(order),
    dodatnaPolja: formatExtraFields(order.dodatnaPolja),
  }));

const itemRowsForExcel = (orders, extraFieldNames = []) =>
  orders.flatMap((order) =>
    (Array.isArray(order.postavke) ? order.postavke : []).map((item) => {
      const row = {
        narocilo: order.stevilka,
        leto: order.leto,
        datum: formatDate(order.datum),
        partner: order.partner,
        nazivKupca: orderCustomerNameFrom(order),
        zs: item.zs,
        sifra: itemCodeFrom(item),
        nazivArtikla: itemNameFrom(item),
        kolicina: itemQuantityFrom(item),
        cena: itemPriceFrom(item),
        predvidenaDobava: formatDate(itemDeliveryFrom(item)),
        rabat1: item.rabat1,
        zaprto: item.zaprto,
        zaprtoPos: item.zaprtoPos,
        datumVeljavnosti: formatDate(item.datumVeljavnosti),
        dodatnaPolja: formatExtraFields(item.dodatnaPolja),
      };

      extraFieldNames.forEach((name, index) => {
        row[`extra_${index}`] = itemFieldValue(item, name);
      });

      return row;
    })
  );

const summaryRowsForExcel = (orders) => {
  const byPartner = new Map();

  orders.forEach((order) => {
    const key = String(order.partner ?? "");
    const current = byPartner.get(key) || {
      partner: key,
      nazivKupca: "",
      stNarocil: 0,
      stPostavk: 0,
      znesek: 0,
      znesekZDDV: 0,
    };

    current.nazivKupca = current.nazivKupca || orderCustomerNameFrom(order);
    current.stNarocil += 1;
    current.stPostavk += Array.isArray(order.postavke) ? order.postavke.length : 0;
    current.znesek += asNumber(order.znesek);
    current.znesekZDDV += asNumber(order.znesekZDDV);
    byPartner.set(key, current);
  });

  const rows = Array.from(byPartner.values()).sort((a, b) => a.partner.localeCompare(b.partner, "sl"));
  rows.push({
    partner: "SKUPAJ",
    nazivKupca: "",
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

const createOrdersWorkbook = (orders, options = {}) => {
  const extraFieldNames = displayExtraFieldNames(Array.isArray(options.extraFieldNames) ? options.extraFieldNames : []);
  const planningData = options.planningData || {};
  const orderHeaders = [
    { key: "stevilka", label: "Številka" },
    { key: "leto", label: "Leto" },
    { key: "datum", label: "Datum" },
    { key: "partner", label: "Partner" },
    { key: "nazivKupca", label: "Naziv kupca" },
    { key: "komercialist", label: "Komercialist" },
    { key: "znesek", label: "Znesek brez DDV" },
    { key: "znesekZDDV", label: "Znesek z DDV" },
    { key: "rabat1", label: "Rabat 1" },
    { key: "skladisce", label: "Skladišče" },
    { key: "besedilo", label: "Besedilo" },
    { key: "popravljaDokument", label: "Popravlja dokument" },
    { key: "priloge", label: "Št. prilog" },
    { key: "stDobav", label: "Št. dobav" },
    { key: "dobave", label: "Dobave" },
    { key: "dodatnaPolja", label: "Dodatna polja" },
  ];

  const itemHeaders = [
    { key: "narocilo", label: "Naročilo" },
    { key: "leto", label: "Leto" },
    { key: "datum", label: "Datum" },
    { key: "partner", label: "Partner" },
    { key: "nazivKupca", label: "Naziv kupca" },
    { key: "zs", label: "ZS" },
    { key: "sifra", label: "Šifra" },
    { key: "nazivArtikla", label: "Naziv artikla" },
    { key: "kolicina", label: "Količina" },
    { key: "cena", label: "Cena" },
    { key: "predvidenaDobava", label: "Predvidena dobava" },
    { key: "rabat1", label: "Rabat 1" },
    { key: "zaprto", label: "Zaprto" },
    { key: "zaprtoPos", label: "Zaprto POS" },
    { key: "datumVeljavnosti", label: "Datum veljavnosti" },
    ...extraFieldNames.map((name, index) => ({ key: `extra_${index}`, label: name })),
    { key: "dodatnaPolja", label: "Dodatna polja" },
  ];

  const summaryHeaders = [
    { key: "partner", label: "Partner" },
    { key: "nazivKupca", label: "Naziv kupca" },
    { key: "stNarocil", label: "Št. naročil" },
    { key: "stPostavk", label: "Št. postavk" },
    { key: "znesek", label: "Znesek brez DDV" },
    { key: "znesekZDDV", label: "Znesek z DDV" },
  ];

  const stockPlanHeaders = [
    { key: "oznaciNabavo", label: "Označi" },
    { key: "sifra", label: "Šifra" },
    { key: "nazivArtikla", label: "Naziv artikla" },
    { key: "datumDobave", label: "Potrebno do" },
    { key: "potrebnaKolicina", label: "Naročeno kupcem" },
    { key: "seDobaviti", label: "Še dobaviti" },
    { key: "kumulativnaPotreba", label: "Kumulativno" },
    { key: "optimalnaZaloga", label: "Optimalna zaloga" },
    { key: "zaloga", label: "Zaloga" },
    { key: "zalogaOst", label: "Zaloga po dobavi" },
    { key: "rezervirano", label: "Rezervirano" },
    { key: "vascoKupci", label: "Odprto pri kupcih" },
    { key: "narocenoDobaviteljem", label: "Naročeno dobaviteljem" },
    { key: "zaPripravo", label: "Manjka za naročiti" },
    { key: "sifraDobavitelja", label: "Dobavitelj" },
    { key: "pakiranje", label: "Pakiranje" },
    { key: "status", label: "Status" },
    { key: "narocila", label: "Naročila" },
    { key: "narocilaDobaviteljem", label: "Naročila dobaviteljem" },
    { key: "kupci", label: "Kupci" },
    { key: "stPostavk", label: "Št. postavk" },
  ];

  const sheets = [
    {
      name: "Naročila",
      headers: orderHeaders,
      rows: orderRowsForExcel(orders),
      widths: [14, 9, 13, 12, 30, 14, 18, 16, 11, 11, 36, 22, 11, 10, 34, 42],
    },
    {
      name: "Postavke",
      headers: itemHeaders,
      rows: itemRowsForExcel(orders, extraFieldNames),
      widths: [14, 9, 13, 12, 30, 10, 16, 34, 12, 14, 18, 11, 10, 12, 18, ...extraFieldNames.map(() => 18), 42],
    },
    {
      name: "Plan zaloge",
      headers: stockPlanHeaders,
      rows: stockPlanRowsForExcel(orders, planningData),
      widths: [10, 16, 34, 14, 18, 14, 21, 16, 12, 13, 14, 16, 22, 20, 14, 12, 22, 28, 30, 42, 12],
    },
    {
      name: "Povzetek",
      headers: summaryHeaders,
      rows: summaryRowsForExcel(orders),
      widths: [14, 30, 12, 13, 18, 16],
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

const workbookDownloads = new Map();
const workbookDownloadTtlMs = 10 * 60 * 1000;

const safeWorkbookFileName = (fileName) => {
  const cleanName = path.basename(String(fileName || "vasco-narocila.xlsx"))
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return cleanName || "vasco-narocila.xlsx";
};

const uniqueWorkbookPath = async (dir, fileName) => {
  const safeName = safeWorkbookFileName(fileName);
  const extension = path.extname(safeName);
  const stem = safeName.slice(0, safeName.length - extension.length) || "vasco-narocila";

  for (let index = 0; index < 200; index += 1) {
    const suffix = index === 0 ? "" : `-${index + 1}`;
    const candidate = path.join(dir, `${stem}${suffix}${extension || ".xlsx"}`);

    try {
      await fs.access(candidate);
    } catch (error) {
      return candidate;
    }
  }

  return path.join(dir, `${stem}-${Date.now()}${extension || ".xlsx"}`);
};

const saveWorkbookLocalFile = async (workbook, fileName) => {
  const dir = path.join(vascoAppRoot(), "prenosi");
  await fs.mkdir(dir, { recursive: true });

  const filePath = await uniqueWorkbookPath(dir, fileName);
  await fs.writeFile(filePath, workbook);
  return filePath;
};

const saveWorkbookDownload = async (workbook, fileName, options = {}) => {
  const id = crypto.randomUUID();
  workbookDownloads.set(id, {
    workbook,
    fileName,
    expiresAt: Date.now() + workbookDownloadTtlMs,
  });

  const cleanup = setTimeout(() => workbookDownloads.delete(id), workbookDownloadTtlMs);
  if (typeof cleanup.unref === "function") cleanup.unref();

  const result = {
    ok: true,
    fileName,
    downloadUrl: `/api/vasco/download/${id}`,
  };

  if (options.saveLocal) {
    try {
      result.savedPath = await saveWorkbookLocalFile(workbook, fileName);
    } catch (error) {
      result.saveWarning = `Excel je pripravljen, vendar ga ni bilo mogoče shraniti v mapo prenosi: ${error.message}`;
    }
  }

  return result;
};

const sendWorkbook = async (res, workbook, fileName, body = {}) => {
  if (body.returnLink) {
    send(res, 200, await saveWorkbookDownload(workbook, fileName, { saveLocal: true }), {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json; charset=utf-8",
    });
    return;
  }

  send(res, 200, workbook, {
    "Cache-Control": "no-store, max-age=0",
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
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
    warnings: result.warnings,
    stockPlan: stockPlanRowsForExcel(result.orders, result.planningData),
    orders: result.orders,
  }, {
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "application/json; charset=utf-8",
  });
};

const handleVascoOrdersExcel = async (req, res) => {
  const body = await parseJsonBody(req);
  const result = await fetchVascoOrders(body);
  const workbook = createOrdersWorkbook(result.orders, {
    extraFieldNames: extraFieldNamesFrom(body, result.orders),
    planningData: result.planningData,
  });
  const filters = body.filters && typeof body.filters === "object" ? body.filters : body;
  const partner = cleanValue(filters.partner || filters.Partner || "vsi") || "vsi";
  const safePartner = String(partner).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 32);
  const fileName = `vasco-narocila-${safePartner}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  await sendWorkbook(res, workbook, fileName, body);
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
  const workbook = createOrdersWorkbook(orders, {
    extraFieldNames: extraFieldNamesFrom(body, orders),
  });
  const fileName = `vasco-narocila-json-${new Date().toISOString().slice(0, 10)}.xlsx`;

  await sendWorkbook(res, workbook, fileName, body);
};

const handleVascoWorkbookDownload = async (url, res) => {
  const id = decodeURIComponent(url.pathname.replace(/^\/api\/vasco\/download\//, ""));
  const download = /^[a-f0-9-]{36}$/i.test(id) ? workbookDownloads.get(id) : null;

  if (!download || download.expiresAt < Date.now()) {
    if (download) workbookDownloads.delete(id);
    send(res, 404, "Excel povezava je potekla. Klikni Excel še enkrat.");
    return;
  }

  send(res, 200, download.workbook, {
    "Cache-Control": "no-store, max-age=0",
    "Content-Disposition": `attachment; filename="${download.fileName}"`,
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
};

const handleVascoOrderItemFieldsRead = async (req, res) => {
  const body = await parseJsonBody(req);
  const fields = await fetchVascoOrderItemFields(body);

  send(res, 200, {
    ok: true,
    count: fields.length,
    fields,
  }, {
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "application/json; charset=utf-8",
  });
};

const handleVascoDeliveryNotesCreate = async (req, res) => {
  const body = await parseJsonBody(req);
  const result = await createVascoDeliveryNotes(body);

  send(res, 200, result, {
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "application/json; charset=utf-8",
  });
};

const handleVascoSupplierOrdersCreate = async (req, res) => {
  const body = await parseJsonBody(req);
  const result = await createVascoSupplierOrders(body);

  send(res, 200, result, {
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "application/json; charset=utf-8",
  });
};

const serveVascoStatic = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const baseRoot = path.resolve(vascoAppRoot());
  const relativePath = decodeURIComponent(url.pathname.replace(/^\/vasco\/?/, "/") || "/index.html");
  const cleanPath = relativePath === "/" ? "/index.html" : relativePath;
  const fullPath = path.resolve(baseRoot, `.${cleanPath}`);

  if (!fullPath.startsWith(baseRoot)) {
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

    if (req.method === "POST" && url.pathname === "/api/contact") {
      await handleContactEmail(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/mail-status") {
      handleMailStatus(res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/vasco/narocila-kupca") {
      await handleVascoOrdersRead(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/vasco/narocila-kupca/postavke/polja") {
      await handleVascoOrderItemFieldsRead(req, res);
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

    if (req.method === "POST" && url.pathname === "/api/vasco/dobavnica") {
      await handleVascoDeliveryNotesCreate(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/vasco/narocilo-dobavitelju") {
      await handleVascoSupplierOrdersCreate(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/vasco/download/")) {
      await handleVascoWorkbookDownload(url, res);
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/vasco/")) {
      await serveVascoStatic(req, res);
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.url}`, error);
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
