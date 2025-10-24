# Project Integration Guide - AI Demo Playground

This document provides detailed technical instructions for creating and integrating new projects into the AI Demo Playground sandbox environment.

## Table of Contents
1. [Quick Start](#quick-start)
2. [Directory Structure](#directory-structure)
3. [Project Metadata Configuration](#project-metadata-configuration)
4. [HTML Structure & Requirements](#html-structure--requirements)
5. [JavaScript Execution Context](#javascript-execution-context)
6. [DOM Querying in Shadow DOM](#dom-querying-in-shadow-dom)
7. [Resource Management & Cleanup](#resource-management--cleanup)
8. [CSS Styling Considerations](#css-styling-considerations)
9. [Asset Loading & URL Handling](#asset-loading--url-handling)
10. [Testing & Debugging](#testing--debugging)
11. [Common Pitfalls & Solutions](#common-pitfalls--solutions)

---

## Quick Start

To add a new project:
```bash
# 1. Create project directory
mkdir projects/my-awesome-demo

# 2. Create index.html
touch projects/my-awesome-demo/index.html

# 3. Create metadata file
touch projects/my-awesome-demo/project.yaml

# 4. Restart dev server or save any file to trigger HMR
npm run dev
```

---

## Directory Structure

Each project lives in its own isolated directory under `projects/`:

```
projects/
└── my-awesome-demo/          # Your project slug (used in URLs)
    ├── index.html            # REQUIRED: Main entry point
    ├── project.yaml          # REQUIRED: Metadata config
    ├── styles.css            # Optional: External stylesheet
    ├── script.js             # Optional: External JavaScript
    ├── assets/               # Optional: Images, fonts, etc.
    │   ├── background.png
    │   └── icon.svg
    └── ...                   # Any other project-specific files
```

### Key Points
- **Slug naming**: Use kebab-case (lowercase with hyphens). This becomes your project identifier.
- **All files bundled**: Everything in your project directory is automatically copied to `dist/projects/` during build.
- **No build step**: Projects are served as-is. No transpilation, bundling, or preprocessing occurs.
- **Relative paths work**: Reference assets using relative paths (e.g., `./assets/logo.png`).

---

## Project Metadata Configuration

Create a `project.yaml` file to define your project's metadata:

### Minimal Example
```yaml
name: My Awesome Demo
summary: A brief description of what this project does.
```

### Complete Example
```yaml
name: Quantum Particle Visualizer
summary: Real-time quantum particle simulation with wave-function collapse visualization using WebGL 2.0.
agents:
  - Claude Sonnet 3.5
  - Midjourney
  - Copilot
status: prototype
tags:
  - webgl
  - physics
  - interactive
  - realtime
entry: index.html
order: 10
```

### Field Reference
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | No | Slug (title-cased) | Display name shown in UI |
| `summary` | string | No | Empty | Short description (1-2 sentences) |
| `agents` | array | No | `[]` | AI tools/agents used to create project |
| `status` | string | No | `'unknown'` | Status badge (e.g., `prototype`, `beta`, `stable`) |
| `tags` | array | No | `[]` | Searchable keywords |
| `entry` | string | No | `'index.html'` | Entry point filename |
| `order` | number | No | `999` | Sort order (lower = higher priority) |

### Searchable Fields
The search function indexes: `name`, `summary`, `slug`, `status`, `tags[]`, and `agents[]`.

---

## HTML Structure & Requirements

### Basic Template
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>My Project Title</title>
    <style>
      /* Inline styles or import external CSS */
      :host {
        /* Styles scoped to Shadow DOM host */
        font-family: system-ui, sans-serif;
        color: #e2e8f0;
      }

      body {
        margin: 0;
        padding: 0;
        background: transparent;
      }

      .container {
        padding: 1rem;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Hello Shadow DOM!</h1>
      <canvas id="my-canvas"></canvas>
    </div>

    <script>
      // Your JavaScript code here
      const root = document.currentScript.getRootNode();
      const canvas = root.getElementById('my-canvas');
      
      // Animation loop
      function render() {
        // Your rendering logic
        requestAnimationFrame(render);
      }
      render();
    </script>
  </body>
</html>
```

### Critical Requirements

#### 1. Use `:host` for Shadow DOM Root Styling
```css
:host {
  /* Applies to the Shadow DOM container itself */
  display: block;
  font-family: system-ui;
}
```

#### 2. Set `body` Background to Transparent
```css
body {
  background: transparent; /* Let parent styles show through */
}
```

#### 3. Valid HTML5 Structure
- Include `<!doctype html>`
- Use proper `<html>`, `<head>`, and `<body>` tags
- The sandbox parser extracts `<body>` content for injection

#### 4. External Resources (Optional)
```html
<head>
  <!-- External CSS -->
  <link rel="stylesheet" href="./styles.css">
  
  <!-- External JS -->
  <script src="./script.js"></script>
</head>
```

The sandbox loader will:
1. Fetch external resources
2. Inline them before execution
3. Rewrite URLs to be relative to your project directory

---

## JavaScript Execution Context

### Execution Environment

Your JavaScript runs in an **instrumented scope** with the following injected globals:

```javascript
// Automatically available (no window. prefix needed):
- requestAnimationFrame
- cancelAnimationFrame
- setTimeout
- clearTimeout
- setInterval
- clearInterval
- ResizeObserver
- window        // Proxied with instrumentation
- document      // Proxied with instrumentation
- sandboxRoot   // Your Shadow DOM root
```

### Important Behaviors

#### 1. Timer & Animation Frame APIs Are Intercepted
```javascript
// ✅ WORKS - Bare calls are automatically tracked
requestAnimationFrame(animate);
setTimeout(doSomething, 1000);
setInterval(tick, 100);

// ✅ ALSO WORKS - Explicit window calls
window.requestAnimationFrame(animate);
window.setTimeout(doSomething, 1000);
```

Both styles work because the sandbox injects instrumented versions as function parameters.

#### 2. Automatic Cleanup
All timers, animation frames, event listeners, and observers are **automatically cleaned up** when:
- User navigates to another project
- Sandbox is unmounted
- New project loads

**You don't need to manually cancel timers or remove listeners** - but you can if you want to.

#### 3. Strict Mode Enabled
All scripts run in strict mode:
```javascript
"use strict"; // Automatically prepended
```

This means:
- No implicit global variables
- `this` is `undefined` in functions (not `window`)
- Octal literals are forbidden
- Duplicate parameter names cause errors

---

## DOM Querying in Shadow DOM

### The Golden Rule
**Always query from `sandboxRoot`, never from `document`.**

### ❌ WRONG - Queries the Parent Document
```javascript
const canvas = document.getElementById('my-canvas'); // Returns null!
const buttons = document.querySelectorAll('button'); // Empty!
```

### ✅ CORRECT - Queries Your Shadow DOM
```javascript
const root = document.currentScript.getRootNode();
const canvas = root.getElementById('my-canvas');
const buttons = root.querySelectorAll('button');
```

### Getting the Shadow DOM Root

```javascript
// Method 1: Via document.currentScript (recommended)
const root = document.currentScript.getRootNode();

// Method 2: Via sandboxRoot parameter (also available)
// sandboxRoot is injected as a function parameter

// Method 3: Store reference for later use
const root = document.currentScript.getRootNode();
const state = { root }; // Store for use in other functions

function myHandler() {
  const elem = state.root.querySelector('.target');
  // ...
}
```

### Accessing the Real Document & Window

If you need to access the actual browser document/window:

```javascript
const root = document.currentScript.getRootNode();
const hostDocument = root.host?.ownerDocument || document;
const hostWindow = hostDocument.defaultView || window;

// Example: Listen to real window resize
hostWindow.addEventListener('resize', () => {
  console.log('Browser window resized');
});

// Example: Check document visibility
hostDocument.addEventListener('visibilitychange', () => {
  if (hostDocument.hidden) {
    // Pause animations
  }
});
```

**Note**: Event listeners on `hostWindow` and `hostDocument` are **not** automatically cleaned up. You must manage them manually if needed (or they'll be removed when the page unloads).

---

## Resource Management & Cleanup

### Automatic Cleanup (You Get This for Free)

The sandbox automatically cleans up:

```javascript
// ✅ Automatically cleaned up
const timer = setTimeout(() => { /* ... */ }, 1000);
const interval = setInterval(() => { /* ... */ }, 100);
const frameId = requestAnimationFrame(animate);

// ✅ Automatically cleaned up
window.addEventListener('resize', handleResize);
document.addEventListener('click', handleClick);

// ✅ Automatically cleaned up
const observer = new ResizeObserver(entries => { /* ... */ });
observer.observe(element);
```

### Manual Cleanup (When You Need Fine Control)

```javascript
// Cancel timer early
const timer = setTimeout(callback, 5000);
if (shouldCancel) {
  clearTimeout(timer);
}

// Stop animation loop based on condition
let running = true;
function animate() {
  if (!running) return; // Exit loop
  
  // ... render logic ...
  
  requestAnimationFrame(animate);
}

// Stop manually
running = false;
```

### Custom Cleanup Logic

If you need custom teardown (e.g., closing WebSocket, releasing GPU resources):

```javascript
const root = document.currentScript.getRootNode();

// Store cleanup function
if (!root.__sandboxCleanup) {
  root.__sandboxCleanup = [];
}

root.__sandboxCleanup.push(() => {
  // Your custom cleanup
  myWebSocket.close();
  myWebGLContext.getExtension('WEBGL_lose_context').loseContext();
});
```

**Warning**: This is an internal API and may change. Use sparingly.

---

## CSS Styling Considerations

### Shadow DOM CSS Encapsulation

Styles inside your project are **completely isolated** from the parent app:

```css
/* Your styles */
h1 {
  color: red; /* Only affects YOUR h1 elements */
}
```

### `:host` Selector

Use `:host` to style the Shadow DOM container itself:

```css
:host {
  display: block;
  width: 100%;
  padding: 1rem;
  background: linear-gradient(/* ... */);
}
```

### CSS Custom Properties (Inheritance)

CSS variables **do** inherit through Shadow DOM boundaries:

```css
/* Parent app sets: */
--text-color: #e2e8f0;

/* Your project can use: */
:host {
  color: var(--text-color, #ffffff); /* Fallback if not set */
}
```

Available CSS variables from parent (check `src/style.css` for full list):
- `--background-*`: Background colors
- `--text-*`: Text colors
- `--border-*`: Border colors
- Font family, sizes, etc.

### External Stylesheets

```html
<head>
  <link rel="stylesheet" href="./styles.css">
</head>
```

The sandbox will:
1. Fetch `styles.css` relative to your project directory
2. Inject it into the Shadow DOM
3. Rewrite any `url()` references in CSS

### Inline Styles

Preferred for small projects:

```html
<style>
  /* All your styles here */
  :host { /* ... */ }
  .container { /* ... */ }
</style>
```

---

## Asset Loading & URL Handling

### Relative Paths (Recommended)

```html
<!-- Images -->
<img src="./assets/logo.png" alt="Logo">

<!-- Canvas textures -->
<script>
  const img = new Image();
  img.src = './textures/diffuse.jpg';
</script>

<!-- CSS backgrounds -->
<style>
  .hero {
    background-image: url('./assets/hero.jpg');
  }
</style>
```

### How URL Rewriting Works

The sandbox automatically rewrites URLs to be absolute:

```
Your code:        ./assets/logo.png
Rewritten to:     /projects/your-project/assets/logo.png
```

Supported attributes:
- `<img src="">`
- `<img srcset="">`
- `<source src="">`
- `<link href="">`
- `<script src="">`
- `<a href="">` (internal links)
- `<video poster="">`

### External URLs

External URLs are left unchanged:

```html
<!-- ✅ Works as-is -->
<img src="https://example.com/image.jpg">
<script src="https://cdn.jsdelivr.net/npm/library@1.0.0"></script>
```

### Data URLs

Data URLs work without modification:

```html
<img src="data:image/svg+xml,<svg>...</svg>">
```

### Dynamic Asset Loading

```javascript
const root = document.currentScript.getRootNode();

// Load image dynamically
const img = new Image();
img.onload = () => { /* ... */ };
img.src = './assets/texture.png'; // Relative to your project

// Fetch JSON data
const response = await fetch('./data/config.json');
const config = await response.json();
```

**Note**: The sandbox rewrites `src` attributes during injection, but `fetch()` calls use URLs as-is. Use absolute paths for `fetch()`:

```javascript
// ✅ CORRECT
fetch('/projects/my-project/data/config.json')

// ❌ WRONG - Relative to parent app, not your project
fetch('./data/config.json')
```

Or construct absolute paths:

```javascript
const projectBase = '/projects/my-project/';
fetch(projectBase + 'data/config.json');
```

---

## Testing & Debugging

### Console Logging

```javascript
console.log('[my-project]', 'Initializing...'); // Prefix helps identify source
```

### Sandbox Debug Logs

Enable sandbox debug output (already active by default):

```javascript
// Check browser console for:
[sandbox] inject:start { ticket: 1, base: 'http://...' }
[sandbox] script:run { ticket: 1, index: 0, bytes: 5100 }
[sandbox] inject:done { ticket: 1, scripts: 1 }
```

### Inspecting Shadow DOM

In Chrome DevTools:
1. Select the `<div class="sandbox-host">` element
2. Expand `#shadow-root (open)`
3. Inspect your project's DOM

### Performance Profiling

```javascript
console.time('render');
// ... rendering code ...
console.timeEnd('render');
```

### Error Handling

Uncaught errors in your project:
- Are logged to console
- **Don't crash the parent app**
- Trigger the sandbox error state (shows error message in UI)

```javascript
try {
  riskyOperation();
} catch (error) {
  console.error('[my-project] Error:', error);
  // Optionally notify user via DOM
}
```

### Testing Cleanup

To verify resources are cleaned up:

1. Open DevTools Performance/Memory tab
2. Load your project
3. Start profiling
4. Navigate to another project
5. Check:
   - No timers still firing
   - No animation frames scheduled
   - Memory released (run GC to confirm)

### Development Tips

```javascript
// Add FPS counter
let lastTime = performance.now();
let frames = 0;
let fps = 0;

function render(now) {
  frames++;
  if (now >= lastTime + 1000) {
    fps = Math.round((frames * 1000) / (now - lastTime));
    console.log('FPS:', fps);
    frames = 0;
    lastTime = now;
  }
  
  // ... rendering logic ...
  
  requestAnimationFrame(render);
}
```

---

## Common Pitfalls & Solutions

### 1. ❌ Querying `document` Instead of Shadow Root

**Problem:**
```javascript
const canvas = document.getElementById('my-canvas'); // null!
```

**Solution:**
```javascript
const root = document.currentScript.getRootNode();
const canvas = root.getElementById('my-canvas');
```

---

### 2. ❌ Relying on Global Variables

**Problem:**
```javascript
myGlobalVar = 42; // ReferenceError in strict mode!
```

**Solution:**
```javascript
const myVar = 42; // Use proper declarations
```

---

### 3. ❌ Accessing `this` in Functions

**Problem:**
```javascript
function myFunction() {
  console.log(this); // undefined in strict mode!
}
```

**Solution:**
```javascript
const state = { value: 42 };

function myFunction() {
  console.log(state.value); // Use closures/objects
}
```

---

### 4. ❌ External Scripts Not Loading

**Problem:**
```html
<script src="./script.js"></script> <!-- Not found! -->
```

**Cause:** File doesn't exist or wrong path.

**Solution:**
- Verify file exists: `projects/your-project/script.js`
- Check case sensitivity (Linux/production is case-sensitive)
- Use browser DevTools Network tab to see 404s

---

### 5. ❌ CSS Not Applying

**Problem:**
```css
body { color: red; } /* Doesn't work? */
```

**Solution:**
```css
/* Use :host for Shadow DOM */
:host {
  color: red;
}

/* Or style body explicitly */
body {
  margin: 0;
  color: red;
}
```

---

### 6. ❌ Animation Loops Not Stopping

**Problem:** Old animation loops continue after navigation (before the fix).

**Solution:** This is now handled automatically! But ensure you're using:
```javascript
requestAnimationFrame(animate); // Not window.requestAnimationFrame
```

Both work, but bare calls are guaranteed to be intercepted.

---

### 7. ❌ Race Conditions on Startup

**Problem:**
```javascript
const canvas = root.getElementById('my-canvas');
const ctx = canvas.getContext('2d'); // canvas is null!
```

**Cause:** DOM not fully injected yet.

**Solution:** Script tags run **after** DOM injection - you're safe! But if using external scripts:

```javascript
// Wait for images to load
const img = new Image();
img.onload = () => {
  ctx.drawImage(img, 0, 0);
};
img.src = './texture.png';
```

---

### 8. ❌ Fetch Relative URLs Fail

**Problem:**
```javascript
fetch('./data.json'); // 404 - fetches from parent app root!
```

**Solution:**
```javascript
// Use absolute path to your project
fetch('/projects/your-project/data.json');
```

---

### 9. ❌ CORS Errors with External Resources

**Problem:**
```javascript
fetch('https://api.example.com/data'); // CORS error!
```

**Solution:**
- Ensure the API has proper CORS headers
- Use JSONP or a proxy if needed
- For images, use `crossorigin` attribute:
  ```html
  <img src="https://..." crossorigin="anonymous">
  ```

---

### 10. ❌ WebGL Context Lost on Navigation

**Problem:** WebGL contexts may not release properly.

**Solution:** Explicitly lose context:
```javascript
const root = document.currentScript.getRootNode();
const canvas = root.getElementById('gl-canvas');
const gl = canvas.getContext('webgl2');

// Register cleanup
if (root.__sandboxCleanup) {
  root.__sandboxCleanup.push(() => {
    const loseCtx = gl.getExtension('WEBGL_lose_context');
    if (loseCtx) loseCtx.loseContext();
  });
}
```

---

## Complete Example Project

Here's a complete working example:

### `projects/example-demo/project.yaml`
```yaml
name: Example Demo
summary: A complete example showing best practices for sandbox integration.
agents:
  - Claude Sonnet 4.5
status: stable
tags:
  - example
  - canvas
  - animation
order: 1
```

### `projects/example-demo/index.html`
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Example Demo</title>
    <style>
      :host {
        font-family: system-ui, -apple-system, sans-serif;
        color: #e2e8f0;
      }

      body {
        margin: 0;
        padding: 0;
        background: transparent;
      }

      .container {
        padding: 2rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      h1 {
        margin: 0;
        font-size: 2rem;
        color: #60a5fa;
      }

      canvas {
        width: 100%;
        max-width: 600px;
        height: 400px;
        border: 2px solid #334155;
        border-radius: 0.5rem;
        background: #0f172a;
      }

      .stats {
        font-size: 0.875rem;
        color: #94a3b8;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Example Demo</h1>
      <p>This demonstrates proper sandbox integration.</p>
      
      <canvas id="stage"></canvas>
      
      <div class="stats">
        FPS: <span id="fps">0</span> | 
        Frame: <span id="frame">0</span>
      </div>
    </div>

    <script>
      // Get Shadow DOM root
      const root = document.currentScript.getRootNode();
      
      // Query elements from Shadow DOM
      const canvas = root.getElementById('stage');
      const fpsDisplay = root.getElementById('fps');
      const frameDisplay = root.getElementById('frame');
      const ctx = canvas.getContext('2d');

      // Setup canvas resolution
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      // State
      let frameCount = 0;
      let lastFpsUpdate = performance.now();
      let currentFps = 0;

      // Animation loop
      function animate(now) {
        frameCount++;
        
        // Update FPS every second
        if (now - lastFpsUpdate >= 1000) {
          currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
          fpsDisplay.textContent = currentFps;
          frameCount = 0;
          lastFpsUpdate = now;
        }
        
        // Update frame counter
        frameDisplay.textContent = Math.floor(now / 16);
        
        // Clear canvas
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, rect.width, rect.height);
        
        // Draw animated circle
        const x = rect.width / 2 + Math.cos(now / 1000) * 100;
        const y = rect.height / 2 + Math.sin(now / 1000) * 100;
        
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.fillStyle = '#60a5fa';
        ctx.fill();
        
        // Continue loop (automatically cleaned up on navigation)
        requestAnimationFrame(animate);
      }
      
      // Start animation
      requestAnimationFrame(animate);
      
      // Handle canvas resize
      const observer = new ResizeObserver(() => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      });
      observer.observe(canvas);
      
      console.log('[example-demo] Initialized successfully');
    </script>
  </body>
</html>
```

This example demonstrates:
- ✅ Proper Shadow DOM querying
- ✅ Canvas setup with DPI scaling
- ✅ Animation loop (auto-cleaned up)
- ✅ ResizeObserver usage (auto-cleaned up)
- ✅ FPS counter
- ✅ Clean, maintainable code structure

---

## Summary Checklist

Before submitting your project, verify:

- [ ] `project.yaml` exists with at least `name` and `summary`
- [ ] `index.html` exists and is valid HTML5
- [ ] CSS uses `:host` selector for root styling
- [ ] `body` background is transparent
- [ ] Scripts query `document.currentScript.getRootNode()` not `document`
- [ ] All asset paths are relative (`./ `or `../`)
- [ ] No global variable pollution (strict mode compliant)
- [ ] Animation loops use `requestAnimationFrame()` (bare or `window.`)
- [ ] Project works when navigating to/from other projects
- [ ] No console errors in browser DevTools
- [ ] Project appears in sidebar after dev server restart

---

## Getting Help

If you encounter issues:

1. **Check browser console** for errors and `[sandbox]` logs
2. **Inspect Shadow DOM** in DevTools
3. **Verify file paths** are relative and case-correct
4. **Test navigation** to/from your project multiple times
5. **Review existing projects** in `projects/` for reference
6. **Check `tech-readme.md`** for architecture details

Happy coding! 🚀

