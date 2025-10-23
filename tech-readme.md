# Technical Reference - AI Demo Playground

This document captures how the Vue shell, isolated project sandboxes, and Azure Static Web Apps deployment pieces fit together.

## 1. High-Level Architecture
- **Vue SPA Shell**: Provides navigation, search, fullscreen toggle, breadcrumbs, and wraps the sandbox renderer. Everything lives in `src/` and uses the Composition API with plain JavaScript.
- **Per-Project Configs**: Every sandbox ships a `project.yaml` file that describes its metadata (name, summary, agents, tags, status, optional order). The build tooling aggregates these configs into a JSON manifest at `/projects/manifest.json`.
- **Shadow DOM Sandbox**: `ProjectSandbox.vue` fetches the referenced `index.html`, rewrites relevant asset URLs, executes scripts inside a wrapped scope, and injects the markup into a Shadow DOM root so styles and behaviour stay self-contained.
- **Asset Pipeline Plugin**: `vite.config.js` registers a custom plugin that (a) serves `/projects` files plus the generated manifest during `npm run dev` and (b) emits them into `dist/projects/` during `npm run build`.

```
+----------------------+  read project.yaml  +--------------------------+
| projects/<slug>/*    | ------------------> | project-asset-pipeline   |
+----------------------+                     +------------+-------------+
                                                         |
                                                         | manifest
                                                         v
                                             Vue shell (ProjectList + search)
                                                         |
                                                         v
                                                 Shadow DOM sandbox
```

## 2. Repository Structure (Expanded)
- `projects/` - source-of-truth for embedded experiments.
  - Each directory contains a self-sufficient `index.html` (with inline or referenced JS/CSS) and a `project.yaml` metadata file.
  - Sample entries today: `particle-playground`, `aurora-wavefield`.
- `src/components/`
  - `ProjectList.vue` - renders the navigation panel, search input, result counts, and status/tag chips.
  - `Breadcrumbs.vue` - simple breadcrumb trail aware of the active project.
  - `ProjectSandbox.vue` - Shadow DOM loader with fetch, DOM rewriting, and script sandboxing logic.
- `src/App.vue` - orchestrates manifest loading, search filtering, fullscreen state, selection, sandbox events, and UI chrome.
- `vite.config.js` - Vue plugin plus `project-asset-pipeline` (see section 4).

## 3. Shadow DOM Loader Details
`ProjectSandbox.vue` performs the following steps whenever `project.entryPoint` changes:
1. Emits a `loading` event to the parent shell.
2. Fetches the target HTML file with `cache: 'no-store'` to avoid stale content during development.
3. Parses the HTML, recreates elements recursively, and rewrites relative URLs (`src`, `href`, `srcset`, etc.) so they resolve inside `/projects/<slug>/`.
4. Recreates `<script>` tags as inline scripts. If a script used `src`, the loader fetches the file and inlines its content before execution, replacing references to `document.currentScript` with a sandbox-safe alias.
5. Injects the transformed nodes into a dedicated Shadow DOM root, wiping previous content to prevent leaks when switching projects.
6. Emits either `loaded` or `error` back to the parent for UI feedback.

Considerations:
- Only HTML/JS/CSS assets are handled today. Additional mimetypes can be whitelisted in `mimeLookup` inside the plugin if projects require them.
- Inline scripts should rely on `document.currentScript.getRootNode()` (already patched by the loader) instead of `document.querySelector` to remain encapsulated.

## 4. Vite Project Asset Plugin
Located in `vite.config.js`, the `project-asset-pipeline` plugin now:
- **Config Aggregation**: Scans each project directory for `project.yaml`, `project.yml`, or `project.json`, parses the metadata with the `yaml` package, validates defaults, and emits a consolidated `projects/manifest.json` asset for dev and build.
- **Dev Server**: Hooks into Vite middleware to serve both the generated manifest and any `/projects/...` path directly from disk. Directory traversal is prevented by whitelisting the `projects/` root.
- **Watching**: Registers every file in `projects/` with `this.addWatchFile`, so edits to configs or HTML trigger HMR/full reloads.
- **Build Output**: Recursively walks `projects/`, adds each file to Rollup via `emitFile`, and mirrors the structure inside `dist/projects/` while also emitting the generated manifest.

The plugin uses Node 18+ `fs/promises` APIs and the `yaml` package for parsing; no other runtime dependencies are required.

## 5. Manifest Schema
The aggregated `/projects/manifest.json` exposes the following fields per entry:
- `slug` - unique identifier used for routing/selection (defaults to the folder name).
- `name` - human-friendly display name (defaults to a start-cased slug).
- `summary` - short description shown in the sidebar and header.
- `agents` - array of AI tools or agents involved in creating the asset.
- `entryPoint` - path to the HTML entry (e.g. `/projects/particle-playground/index.html`).
- `status` - free-form status badge (`prototype`, `beta`, etc.).
- `tags` - optional array of strings displayed as chips.
- `order` - optional numeric ordering hint (lower numbers surface first).

To add a new project:
1. Create `projects/<slug>/`.
2. Add an `index.html` (plus any supporting assets).
3. Add `project.yaml` with metadata. Example:
   ```yaml
   name: Neon Flux Trails
   summary: Long-exposure vector field rendered in WebGL.
   agents:
     - Codex GPT-5
     - Shader Crafter
   status: prototype
   tags: [webgl, interactive]
   entry: index.html
   order: 60
   ```
4. Restart the dev server (or save the config) to see it appear automatically in the UI and manifest.

## 6. Local Development Workflow
```bash
npm install          # install dependencies
npm run dev          # start Vite dev server (serves /projects via plugin)
npm run build        # produce dist/ with embedded sandboxes
npm run preview      # serve the production build locally
```

## 7. Azure Static Web Apps Deployment
- Build command: `npm install && npm run build`
- Output path: `dist`
- App directory: project root (`.`)
- API directory: leave empty (no backend)

### GitHub Actions (Sample)
If you scaffold a Static Web Apps workflow, configure the job similar to:
```yaml
app_location: "."
api_location: ""
output_location: "dist"
```
The build will automatically include the `projects/` payload because of the custom Vite plugin.

## 8. Future Enhancements (Ideas)
- Provide a CLI helper to scaffold new `projects/<slug>/` directories with starter configs.
- Add automated smoke tests that mount each sandbox in isolation to ensure they boot without console errors.
- Expand mimetype support in the plugin for binary assets (audio, video, 3D models).
- Surface additional manifest metadata (e.g. external links, categories) in the UI.

For a live status of planned work, refer to `todo.md`.
