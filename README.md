# AI Demo Playground

# WARNING THIS IS ALL AI SLOP

A gallery of AI-assisted experiments and UI junk, bundled as a Vue 3 single-page application and ready to ship on Azure Static Web Apps. The main shell handles navigation, breadcrumbs, and sandboxing so each project can live in its own world without leaking styles or scripts.

## Highlights
- Vue 3 + Vite setup with zero TypeScript - plain JavaScript everywhere
- Shadow DOM sandbox loader that embeds standalone HTML/JS projects without iframes
- Fullscreen toggle so each sandbox can take over the viewport when you want a closer look
- Per-project `project.yaml` configs that drive an auto-generated manifest (no manual list to maintain)
- Searchable project catalog with live filtering across names, summaries, tags, and AI agents
- Custom Vite plugin that serves and bundles the `/projects` directory for both dev and production builds
- Azure-ready output (`dist/`) that can be published straight from GitHub

## Quick Start
1. Install dependencies: `npm install`
2. Launch the dev server: `npm run dev`
3. Open the printed local URL and pick a project from the sidebar (use the search field to filter as needed)
4. Build for production when you are ready: `npm run build`

## Project Layout
```text
.
|-- projects/                   # Standalone AI experiment sandboxes
|   |-- particle-playground/    # Canvas-driven particle flow demo
|   |   |-- index.html
|   |   `-- project.yaml        # Metadata consumed by the Vue shell
|   |-- aurora-wavefield/       # Layered ribbon aurora experience\n|   |-- neon-lattice/          # Pulse-responsive laser lattice (HTML + JS)
|   |   |-- index.html
|   |   `-- project.yaml
|   `-- ...                     # Additional projects follow the same pattern
|-- src/
|   |-- App.vue                 # Shell UI, search, breadcrumbs, sandbox orchestration
|   |-- components/             # Breadcrumbs, project list, sandbox loader
|   |-- main.js                 # Vue entry point
|   `-- style.css               # Global theming
|-- vite.config.js              # Vue plugin + custom project asset pipeline
|-- tech-readme.md              # Deep dive into architecture and deployment
`-- todo.md                     # Living checklist for the build
```

## Sandbox Projects
- Each project owns its metadata via `projects/<slug>/project.yaml`; the Vite plugin aggregates every config into `/projects/manifest.json` at runtime.
- Provide at least an `index.html` entry point, any additional assets, and metadata fields such as `name`, `summary`, `agents`, `status`, and `tags`.
- Scripts run inside the Shadow DOM; use `document.currentScript.getRootNode()` (automatically patched) to interact with local nodes.
- Static files are copied into the production build via the custom Vite plugin, so everything under `projects/` ships with the site automatically.

## Deploying to Azure Static Web Apps
- **App location:** `.`
- **Output location:** `dist`
- **Build command:** `npm install && npm run build`
- API location can be left blank (no server code).

See `tech-readme.md` for CI/CD notes, the sandbox architecture, and Azure environment configuration tips.

