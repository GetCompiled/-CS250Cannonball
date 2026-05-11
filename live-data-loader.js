(function () {
    var CACHE_KEY = "cannonball.waterData.v1";
    var CACHE_TS_KEY = "cannonball.waterData.ts";
    var CACHE_TTL_MS = 6 * 60 * 60 * 1000;

    function extractRows(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (!payload || typeof payload !== "object") {
        return [];
    }

    if (Array.isArray(payload.data)) {
        return payload.data;
    }

    if (Array.isArray(payload.items)) {
        return payload.items;
    }

    if (Array.isArray(payload.results)) {
        return payload.results;
    }

    return [];
    }

    function normalizeRows(rows) {
    return (rows || [])
        .map(function (row) {
        return {
            location: String(row.location || row.city || row.region || "").trim(),
            waterbody: String(row.waterbody || row.name || row.site || "").trim(),
            swimmability: Number(row.swimmability != null ? row.swimmability : (row.score != null ? row.score : 0)),
            drinkable: String(row.drinkable != null ? row.drinkable : "No").trim(),
            activities: String(row.activities || row.activity || "").trim(),
            sources: String(row.sources || row.source || row.url || "").trim(),
            zipcode: String(row.zipcode || row.zip || row.postalCode || "").trim()
        };
        })
        .filter(function (row) {
        return row.location && row.waterbody;
        });
    }

    function getFreshCache() {
    try {
        var ts = Number(localStorage.getItem(CACHE_TS_KEY));
        var raw = localStorage.getItem(CACHE_KEY);
        if (!raw || !ts) {
        return null;
}

        if (Date.now() - ts > CACHE_TTL_MS) {
        return null;
        }

        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch (_err) {
        return null;
    }
}

    function setCache(data) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
    } catch (_err) {
      // Ignore storage errors.
    }
    }

    async function fetchLiveRows(url) {
    var response = await fetch(url, {
        headers: {
        Accept: "application/json"
        }
    });

    if (!response.ok) {
        throw new Error("Live data request failed: " + response.status);
    }

    var payload = await response.json();
    return extractRows(payload);
    }

    async function loadWaterData() {
    var fallback = Array.isArray(window.WATER_BODIES) ? window.WATER_BODIES : [];
    var liveUrl = window.CANNONBALL_LIVE_DATA_URL || "";

    var cached = getFreshCache();
    if (cached) {
        return {
        data: cached,
        source: "cache",
        updatedAt: Number(localStorage.getItem(CACHE_TS_KEY)) || null,
        liveUrl: liveUrl
        };
    }

    if (liveUrl) {
        try {
        var liveRows = await fetchLiveRows(liveUrl);
        var normalized = normalizeRows(liveRows);
        if (normalized.length > 0) {
            setCache(normalized);
            return {
            data: normalized,
            source: "live",
            updatedAt: Date.now(),
            liveUrl: liveUrl
            };
        }
        } catch (error) {
        console.warn("Live data unavailable. Using local fallback data.", error);
        }
    }

    return {
        data: fallback,
        source: "fallback",
        updatedAt: null,
        liveUrl: liveUrl
    };
    }

    window.loadWaterData = loadWaterData;
})();
