const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const nodemailer = require("nodemailer");

const root = __dirname;
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
      if (body.length > 1_500_000) {
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

const handleContact = async (req, res) => {
  const body = JSON.parse(await readBody(req));
  const { name, email, subject, message } = body;

  if (!name || !email || !subject || !message) {
    send(res, 400, { ok: false, message: "Vsa polja so obvezna (name, email, subject, message)." });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    send(res, 400, { ok: false, message: "Neveljaven format e-poštnega naslova." });
    return;
  }

  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT) || 587;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  if (!host || !user || !pass) {
    send(res, 500, { ok: false, message: "E-poštna konfiguracija ni nastavljena." });
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: user,
      to: user,
      replyTo: email,
      subject: `New Inquiry: ${subject}`,
      text: `New inquiry received via the contact form.\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`,
    });

    send(res, 200, { ok: true, message: "Sporočilo je bilo uspešno poslano." });
  } catch (error) {
    console.error("Email send error:", error.message);
    send(res, 500, { ok: false, message: "Napaka pri pošiljanju e-pošte. Prosim poskusite ponovno." });
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
      await handleContact(req, res);
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    send(res, 500, { ok: false, message: error.message || "Napaka serverja." });
  }
});

server.listen(port, () => {
  console.log(`Tu-Val CleanSpace site running on port ${port}`);
});
