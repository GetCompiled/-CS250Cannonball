# Cannonball local server

This Node process serves the static Cannonball pages from the repo root **and** provides JSON APIs (water data, auth, community posts).

## Start

From the project root:

```powershell
cd server
npm start
```

Then open **http://localhost:3000/** (not a `file://` URL).

Useful URLs:

- App home: `http://localhost:3000/`
- Water data: `http://localhost:3000/api/water-data`
- Health: `http://localhost:3000/health`

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
