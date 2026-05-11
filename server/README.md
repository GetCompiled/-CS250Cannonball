# Cannonball Proxy Starter

This small Node server provides a browser-safe endpoint for water data.

## Start

From the project root:

```powershell
cd server
npm start
```

Default endpoint:

- `http://localhost:3000/api/water-data`

Health check:

- `http://localhost:3000/health`

## Optional upstream API
If you have a real API URL, run with an environment variable:

```powershell
cd server
$env:UPSTREAM_WATER_DATA_URL = "https://your-api.example.com/water"
npm start
```

Behavior:
1. If upstream is configured and works, proxy returns upstream JSON.
2. If upstream fails (or not configured), proxy returns local `water-data.js` records.
