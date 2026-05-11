const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const UPSTREAM_WATER_DATA_URL = process.env.UPSTREAM_WATER_DATA_URL || "";

function setCors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, statusCode, payload) {
    setCors(res);
    res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(payload));
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

const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
    }

    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(res, 200, {
        ok: true,
        upstreamConfigured: Boolean(UPSTREAM_WATER_DATA_URL)
    });
    return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/water-data") {
    await handleWaterDataRequest(res);
    return;
    }

    sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
    console.log(`Cannonball proxy running at http://localhost:${PORT}`);
    console.log(`Water data endpoint: http://localhost:${PORT}/api/water-data`);
    if (UPSTREAM_WATER_DATA_URL) {
    console.log("Using upstream URL:", UPSTREAM_WATER_DATA_URL);
    } else {
    console.log("No UPSTREAM_WATER_DATA_URL set. Using local water-data.js fallback.");
    }
});
