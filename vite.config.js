import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { parse as parseYaml } from 'yaml'

const PROJECT_DIRECTORY = path.resolve(__dirname, 'projects')
const CONFIG_FILENAMES = ['project.yaml', 'project.yml', 'project.json']
const MANIFEST_FILENAME = 'manifest.json'
const MANIFEST_ROUTE = `/projects/${MANIFEST_FILENAME}`

const mimeLookup = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

const toDisplayName = (value) =>
  value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())

const ensureString = (value, fallback = '') => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : fallback
  }
  return fallback
}

const ensureArrayOfStrings = (value) => {
  if (value == null) return []
  const candidate = Array.isArray(value) ? value : [value]
  const cleaned = candidate
    .map((item) => ensureString(item))
    .filter(Boolean)
  return Array.from(new Set(cleaned))
}

const ensureOrder = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? value : Number.POSITIVE_INFINITY

const resolveEntryPoint = (slug, entry) => {
  const raw = ensureString(entry, 'index.html')
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:')) {
    return raw
  }
  if (raw.startsWith('/')) {
    return raw
  }
  return `/projects/${slug}/${raw}`
}

const contentTypeFor = (filePath) =>
  mimeLookup[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'

const pathWithinProjects = (targetPath) => {
  const resolved = path.resolve(PROJECT_DIRECTORY, targetPath)
  if (!resolved.startsWith(PROJECT_DIRECTORY)) {
    throw Object.assign(new Error('Forbidden path'), { code: 'FORBIDDEN' })
  }
  return resolved
}

const directoryExists = async (targetPath) => {
  try {
    const stats = await fs.stat(targetPath)
    return stats.isDirectory()
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

const collectFiles = async (rootDir) => {
  const entries = await fs.readdir(rootDir, { withFileTypes: true })
  const output = []

  for (const entry of entries) {
    const absolute = path.resolve(rootDir, entry.name)
    if (entry.isDirectory()) {
      output.push(...(await collectFiles(absolute)))
    } else {
      output.push({
        absolute,
        relative: path.relative(PROJECT_DIRECTORY, absolute),
      })
    }
  }

  return output
}

const readProjectConfig = async (projectDir, slug) => {
  for (const candidate of CONFIG_FILENAMES) {
    const candidatePath = path.resolve(projectDir, candidate)
    try {
      const raw = await fs.readFile(candidatePath, 'utf8')
      if (candidate.endsWith('.json')) {
        try {
          return JSON.parse(raw)
        } catch (parseError) {
          throw Object.assign(
            new Error(`Invalid JSON in ${candidate} for project "${slug}": ${parseError.message}`),
            { cause: parseError }
          )
        }
      }
      return parseYaml(raw)
    } catch (error) {
      if (error.code === 'ENOENT') continue
      throw Object.assign(
        new Error(`Unable to read configuration for project "${slug}": ${error.message}`),
        { cause: error }
      )
    }
  }
  return null
}

const verifyEntryAsset = async (slug, entryPoint) => {
  if (!entryPoint.startsWith('/projects/')) return
  const relative = entryPoint.replace(/^\/projects\//, '')
  try {
    await fs.stat(pathWithinProjects(relative))
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(
        `[project-asset-pipeline] Entry point "${entryPoint}" missing for project "${slug}".`
      )
      return
    }
    throw error
  }
}

const loadProjectManifest = async () => {
  if (!(await directoryExists(PROJECT_DIRECTORY))) return []

  const entries = await fs.readdir(PROJECT_DIRECTORY, { withFileTypes: true })
  const manifest = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const slugFromDir = entry.name
    const projectDir = path.resolve(PROJECT_DIRECTORY, slugFromDir)
    const config = await readProjectConfig(projectDir, slugFromDir)

    if (!config) {
      console.warn(
        `[project-asset-pipeline] Skipping project "${slugFromDir}" (no project config found).`
      )
      continue
    }

    const slug = ensureString(config.slug, slugFromDir) || slugFromDir
    const entryPoint = resolveEntryPoint(slugFromDir, config.entry ?? config.entryPoint)
    await verifyEntryAsset(slugFromDir, entryPoint)

    manifest.push({
      slug,
      name: ensureString(config.name, toDisplayName(slug)),
      summary: ensureString(config.summary),
      entryPoint,
      status: ensureString(config.status, 'prototype'),
      tags: ensureArrayOfStrings(config.tags),
      agents: ensureArrayOfStrings(config.agents),
      order: ensureOrder(config.order),
    })
  }

  return manifest
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map(({ order, ...rest }) => rest)
}

const manifestAsJSON = async () => JSON.stringify(await loadProjectManifest(), null, 2)

const projectAssetPlugin = () => ({
  name: 'project-asset-pipeline',
  async configureServer(server) {
    if (!(await directoryExists(PROJECT_DIRECTORY))) return

    server.middlewares.use(async (req, res, next) => {
      const rawUrl = req.url?.split('?')[0]
      if (!rawUrl || !rawUrl.startsWith('/projects/')) {
        return next()
      }

      if (rawUrl === MANIFEST_ROUTE) {
        try {
          const body = await manifestAsJSON()
          res.setHeader('Content-Type', 'application/json; charset=UTF-8')
          res.end(body)
        } catch (error) {
          server.ssrFixStacktrace?.(error)
          res.statusCode = 500
          res.end(`Failed to build manifest: ${error.message}`)
        }
        return
      }

      const relativePath = decodeURIComponent(rawUrl.replace(/^\/projects\//, ''))

      try {
        const filePath = pathWithinProjects(relativePath)
        const stats = await fs.stat(filePath)
        if (stats.isDirectory()) {
          res.statusCode = 403
          res.end('Directory access is not permitted.')
          return
        }

        const buffer = await fs.readFile(filePath)
        res.setHeader('Content-Type', contentTypeFor(filePath))
        res.end(buffer)
      } catch (error) {
        if (error.code === 'ENOENT') return next()
        if (error.code === 'FORBIDDEN') {
          res.statusCode = 403
          res.end('Forbidden.')
          return
        }
        next(error)
      }
    })
  },
  async buildStart() {
    if (!(await directoryExists(PROJECT_DIRECTORY))) return

    const files = await collectFiles(PROJECT_DIRECTORY)
    files.forEach((file) => {
      this.addWatchFile(file.absolute)
    })

    try {
      await loadProjectManifest()
    } catch (error) {
      this.error(error)
    }
  },
  async generateBundle() {
    if (!(await directoryExists(PROJECT_DIRECTORY))) return

    const files = await collectFiles(PROJECT_DIRECTORY)
    await Promise.all(
      files.map(async (file) => {
        const source = await fs.readFile(file.absolute)
        this.emitFile({
          type: 'asset',
          fileName: `projects/${file.relative.replace(/\\/g, '/')}`,
          source,
        })
      })
    )

    const manifest = await loadProjectManifest()
    this.emitFile({
      type: 'asset',
      fileName: `projects/${MANIFEST_FILENAME}`,
      source: JSON.stringify(manifest, null, 2),
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), projectAssetPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: false,
  },
})
