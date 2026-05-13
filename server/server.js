const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const UPSTREAM_WATER_DATA_URL = process.env.UPSTREAM_WATER_DATA_URL || "";
const STATIC_ROOT = path.join(__dirname, "..");
const DATA_PATH = path.join(__dirname, "data", "app.json");

/** @type {Map<string, { email: string, createdAt: number }>} */
const sessions = new Map();

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
    ".csv": "text/csv; charset=utf-8"
};

function setCors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendJson(res, statusCode, payload) {
    setCors(res);
    res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(payload));
}

function readBody(req, limit = 1_000_000) {
    return new Promise((resolve, reject) => {
        let raw = "";
        req.on("data", (chunk) => {
            raw += chunk.toString();
            if (raw.length > limit) {
                reject(new Error("Payload too large"));
            }
        });
        req.on("end", () => resolve(raw));
        req.on("error", reject);
    });
}

async function readJsonStore() {
    try {
        const text = await fs.readFile(DATA_PATH, "utf8");
        const data = JSON.parse(text);
        return {
            users: Array.isArray(data.users) ? data.users : [],
            posts: Array.isArray(data.posts) ? data.posts : []
        };
    } catch {
        return { users: [], posts: [] };
    }
}

async function writeJsonStore(store) {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(store, null, 2), "utf8");
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return { salt, hash };
}

function verifyPassword(password, salt, storedHash) {
    try {
        const verifyHash = crypto.scryptSync(password, salt, 64).toString("hex");
        return crypto.timingSafeEqual(Buffer.from(storedHash, "hex"), Buffer.from(verifyHash, "hex"));
    } catch {
        return false;
    }
}

function parseBearer(req) {
    const h = req.headers.authorization || "";
    const m = /^Bearer\s+(.+)$/i.exec(h);
    return m ? m[1].trim() : "";
}

function sessionEmail(token) {
    if (!token) return null;
    const row = sessions.get(token);
    return row ? row.email : null;
}

function createSession(email) {
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { email, createdAt: Date.now() });
    return token;
}

function parseWaterBodiesFromFile(fileText) {
    const match = fileText.match(/window\.WATER_BODIES\s*=\s*(\[[\s\S]*\])\s*;?/);
    if (!match) {
        throw new Error("Could not parse WATER_BODIES from water-data.js");
    }
    return JSON.parse(match[1]);
}

async function loadLocalWaterData() {
    const waterDataPath = path.join(__dirname, "..", "water-data.js");
    const fileText = await fs.readFile(waterDataPath, "utf8");
    return parseWaterBodiesFromFile(fileText);
}

async function loadUpstreamWaterData() {
    const response = await fetch(UPSTREAM_WATER_DATA_URL, {
        headers: { Accept: "application/json" }
    });

    if (!response.ok) {
        throw new Error(`Upstream request failed with ${response.status}`);
    }

    return response.json();
}

async function handleWaterDataRequest(res) {
    if (UPSTREAM_WATER_DATA_URL) {
        try {
            const upstreamPayload = await loadUpstreamWaterData();
            sendJson(res, 200, upstreamPayload);
            return;
        } catch (error) {
            console.warn("Upstream fetch failed, falling back to local water-data.js", error.message);
        }
    }

    try {
        const localData = await loadLocalWaterData();
        sendJson(res, 200, localData);
    } catch (error) {
        sendJson(res, 500, {
            error: "Failed to load local fallback data",
            details: error.message
        });
    }
}

async function serveStatic(req, res, urlPath) {
    let rel = urlPath === "/" ? "index.html" : urlPath.slice(1);
    if (rel.includes("..") || path.isAbsolute(rel)) {
        sendJson(res, 403, { error: "Forbidden" });
        return;
    }

    const filePath = path.join(STATIC_ROOT, rel);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(STATIC_ROOT))) {
        sendJson(res, 403, { error: "Forbidden" });
        return;
    }

    try {
        const stat = await fs.stat(resolved);
        if (stat.isDirectory()) {
            const indexPath = path.join(resolved, "index.html");
            try {
                const buf = await fs.readFile(indexPath);
                res.writeHead(200, { "Content-Type": MIME[".html"] });
                res.end(buf);
                return;
            } catch {
                sendJson(res, 403, { error: "Directory listing disabled" });
                return;
            }
        }

        const ext = path.extname(resolved).toLowerCase();
        const mime = MIME[ext] || "application/octet-stream";
        const buf = await fs.readFile(resolved);
        res.writeHead(200, { "Content-Type": mime });
        res.end(buf);
    } catch {
        sendJson(res, 404, { error: "Not found" });
    }
}

async function handleRegister(req, res) {
    let body;
    try {
        body = JSON.parse(await readBody(req));
    } catch {
        sendJson(res, 400, { success: false, message: "Invalid JSON body" });
        return;
    }

    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!isValidEmail(email)) {
        sendJson(res, 400, { success: false, message: "Enter a valid email address." });
        return;
    }
    if (password.length < 8) {
        sendJson(res, 400, { success: false, message: "Password must be at least 8 characters." });
        return;
    }

    const store = await readJsonStore();
    if (store.users.some((u) => u.email === email)) {
        sendJson(res, 409, { success: false, message: "An account with this email already exists." });
        return;
    }

    const { salt, hash } = hashPassword(password);
    store.users.push({ email, salt, hash });
    await writeJsonStore(store);

    const token = createSession(email);
    sendJson(res, 201, {
        success: true,
        message: "Account created",
        token,
        user: { email }
    });
}

async function handleLogin(req, res) {
    let body;
    try {
        body = JSON.parse(await readBody(req));
    } catch {
        sendJson(res, 400, { success: false, message: "Invalid JSON body" });
        return;
    }

    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    const store = await readJsonStore();
    const user = store.users.find((u) => u.email === email);
    if (!user || !verifyPassword(password, user.salt, user.hash)) {
        sendJson(res, 401, { success: false, message: "Invalid email or password." });
        return;
    }

    const token = createSession(email);
    sendJson(res, 200, {
        success: true,
        message: "Login successful",
        token,
        user: { email }
    });
}

async function handleMe(req, res) {
    const token = parseBearer(req);
    const email = sessionEmail(token);
    if (!email) {
        sendJson(res, 401, { success: false, message: "Not authenticated" });
        return;
    }
    sendJson(res, 200, { success: true, user: { email } });
}

async function handleGetPosts(res) {
    const store = await readJsonStore();
    const sorted = [...store.posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    sendJson(res, 200, { success: true, posts: sorted });
}

async function handleCreatePost(req, res) {
    const token = parseBearer(req);
    const email = sessionEmail(token);
    if (!email) {
        sendJson(res, 401, { success: false, message: "Sign in to post." });
        return;
    }

    let body;
    try {
        body = JSON.parse(await readBody(req));
    } catch {
        sendJson(res, 400, { success: false, message: "Invalid JSON body" });
        return;
    }

    const title = String(body.title || "Community post").trim().slice(0, 200);
    const text = String(body.body || "").trim();
    if (!text) {
        sendJson(res, 400, { success: false, message: "Post content cannot be empty." });
        return;
    }
    if (text.length > 8000) {
        sendJson(res, 400, { success: false, message: "Post is too long (max 8000 characters)." });
        return;
    }

    const post = {
        id: crypto.randomUUID(),
        authorEmail: email,
        title,
        body: text,
        createdAt: new Date().toISOString()
    };

    const store = await readJsonStore();
    store.posts.push(post);
    await writeJsonStore(store);

    sendJson(res, 201, { success: true, post });
}

const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
        setCors(res);
        res.writeHead(204);
        res.end();
        return;
    }

    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = requestUrl.pathname;

    if (req.method === "GET" && pathname === "/health") {
        sendJson(res, 200, {
            ok: true,
            upstreamConfigured: Boolean(UPSTREAM_WATER_DATA_URL)
        });
        return;
    }

    if (req.method === "GET" && pathname === "/api/water-data") {
        await handleWaterDataRequest(res);
        return;
    }

    if (req.method === "POST" && pathname === "/api/register") {
        await handleRegister(req, res);
        return;
    }

    if (req.method === "POST" && (pathname === "/api/login" || pathname === "/login")) {
        await handleLogin(req, res);
        return;
    }

    if (req.method === "GET" && pathname === "/api/me") {
        await handleMe(req, res);
        return;
    }

    if (req.method === "GET" && pathname === "/api/posts") {
        await handleGetPosts(res);
        return;
    }

    if (req.method === "POST" && pathname === "/api/posts") {
        await handleCreatePost(req, res);
        return;
    }

    if (req.method === "GET") {
        await serveStatic(req, res, pathname);
        return;
    }

    sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
    console.log(`Cannonball server at http://localhost:${PORT}`);
    console.log(`Open the app: http://localhost:${PORT}/`);
    console.log(`Water data: http://localhost:${PORT}/api/water-data`);
    if (UPSTREAM_WATER_DATA_URL) {
        console.log("Using upstream URL:", UPSTREAM_WATER_DATA_URL);
    } else {
        console.log("No UPSTREAM_WATER_DATA_URL set. Using local water-data.js fallback.");
    }
});
