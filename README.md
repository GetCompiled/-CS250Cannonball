# -CS250Cannonball
Project Cannonball

Cannonball is a webpage-based application designed to help users search for and view information about local bodies of water in San Diego County, intended to provide live information via the EPA.

Current Project State

At the time of handoff, the project includes:
•	a landing page (index.html)
•	a results page (search-results.html)
•	image/logo assets in the Cannonball Assets folder
•	a working search flow between the two pages

The current version is a static HTML/CSS/JavaScript front end. A **local Node server** (`server/`) adds APIs, serves the same pages on `http://localhost:3000`, and supports registration, login, and community posts.

Current Functionality

The current build allows the user to:
•	enter either a zip code or a location name on the landing page
•	navigate to the results page using that search term
•	search across the shared water body dataset
•	view matching results with:
•	location
•	zip code
•	swimmability
•	drinkability
•	activities
•	source link

The search currently matches against:
•	location
•	waterbody name
•	activities
•	zip code

Data Implementation

At this stage, the water body data is centralized in water-data.js and loaded by both index.html and search-results.html.

This keeps the prototype static while removing duplicated data sources and improving maintainability.

Intended next steps:

After that, the long-term goal would be to replace or supplement static data with live API calls for up-to-date water quality information.

Run locally (recommended)

The Node server in `server/` serves the whole site (HTML, assets, and APIs) so login, registration, and community posts work on one origin.

1. Install [Node.js](https://nodejs.org/) if you do not already have it.
2. In a terminal: `cd server` then `npm start`
3. Open **http://localhost:3000/** in your browser (use this URL rather than opening `index.html` as a file, so APIs and water data load correctly).

Accounts and posts are stored in `server/data/app.json` (created on first registration). Signing out clears the session in the browser; after a server restart you need to sign in again (sessions are kept in memory).

APIs (same host as the app when using port 3000)

- `GET /api/water-data` — water bodies (or upstream if configured)
- `POST /api/register` — create account (email + password, min 8 characters)
- `POST /api/login` — sign in; returns a bearer token stored in the browser
- `GET /api/me` — current user (requires `Authorization: Bearer <token>`)
- `GET /api/posts` — list community posts
- `POST /api/posts` — add a post (requires bearer token)
- `GET /health` — health check

GitHub Pages deploys only static files (`server/` is excluded), so **accounts and community posts are for local use** unless you host this server elsewhere.

Optional upstream setup (PowerShell):
1. cd server
2. $env:UPSTREAM_WATER_DATA_URL = "https://your-api.example.com/water"
3. npm start

Current frontend behavior:
1. With the server on port 3000, `search-results.html` loads water data from `/api/water-data` (same origin).
2. If upstream is configured and reachable, the server returns upstream data.
3. Otherwise the server falls back to local `water-data.js`.

Long-Term Goals / Planned Features

The intended long-term direction for Cannonball includes:
•	integration with live EPA waterway data through API calls
•	replacing hardcoded data with a dedicated JS data structure 
•	an interactive map for searching and exploring waterways geographically
•	a user login system
•	a commenting/posting system so users can share updates, experiences, or warnings

Notes for the Next Team
•	The current search flow is stable and should be used as the functional baseline.
•	index.html currently handles initial input and basic zip-code validation.
•	search-results.html handles searching and result rendering.
•	water-data.js is the canonical dataset used by both pages.
•	The code currently favors readability and stability over modularity.
•	The next strong step is replacing static data with live API integration.

File Overview
•	index.html — Landing page and search entry point
•	search-results.html — Search logic and result rendering
•	login.html — Sign in and create account
•	community.html — Community posts (list and create when signed in)
•	auth-nav.js — Shared helpers for API base URL and session token in the browser
•	water-data.js — Canonical shared water body dataset
•	Cannonball Assets/ — Logos, icons, and visual assets used by the pages

⸻

