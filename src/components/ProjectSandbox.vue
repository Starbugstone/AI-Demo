<template>
  <div class="sandbox" :data-fullscreen="props.fullscreen ? 'true' : null">
    <div
      ref="host"
      class="sandbox-host"
      :data-fullscreen="props.fullscreen ? 'true' : null"
    />
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  project: {
    type: Object,
    required: true,
  },
  fullscreen: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['loading', 'loaded', 'error'])

const host = ref(null)
let ticket = 0
let activeController = null
let dprSizer = null

const JS_MIME_TYPES = new Set(['', 'text/javascript', 'application/javascript'])


const dbg = (...args) => { try { console.log('[sandbox]', ...args) } catch {} }
const createEventPayload = (slug, entryPoint, ticketValue, extra = {}) => ({
  slug,
  entryPoint,
  ticket: ticketValue,
  ...extra,
})

const clearShadow = () => {
  const current = host.value
  if (!current?.shadowRoot) return
  
  // Run cleanup functions before removing DOM nodes
  const shadow = current.shadowRoot
  if (Array.isArray(shadow.__sandboxCleanup)) {
    shadow.__sandboxCleanup.forEach((fn) => {
      try {
        fn?.()
      } catch (error) {
        console.error('[sandbox] cleanup failed:', error)
      }
    })
    shadow.__sandboxCleanup.length = 0
  }
  
  // Mark as disposed to prevent new timers/RAF
  if (shadow.__sandboxCleanup) {
    shadow.__sandboxDisposed = true
  }
  
  // Clear DOM
  while (shadow.firstChild) {
    shadow.removeChild(shadow.firstChild)
  }
}

// -- DPR-aware canvas sizer (enabled only in fullscreen) ---------------------
const queryShadowRoot = () => host.value?.shadowRoot ?? null

const updateCanvasResolution = (canvas) => {
  if (!canvas) return
  const dpr = Math.max(1, Math.floor((window.devicePixelRatio || 1) * 100) / 100)
  const rect = canvas.getBoundingClientRect()
  const w = Math.max(1, Math.round(rect.width * dpr))
  const h = Math.max(1, Math.round(rect.height * dpr))
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
}

const enableDprSizer = () => {
  const root = queryShadowRoot()
  if (!root) return
  if (dprSizer) return

  const originals = new Map()

  const captureOriginal = (canvas) => {
    if (originals.has(canvas)) return
    originals.set(canvas, {
      width: canvas.getAttribute('width'),
      height: canvas.getAttribute('height'),
    })
  }

  const canvases = () => Array.from(root.querySelectorAll('canvas'))

  const refreshAll = () => {
    canvases().forEach((c) => updateCanvasResolution(c))
  }

  // Observe host and canvases for size changes
  const ro = new ResizeObserver(() => refreshAll())
  ro.observe(host.value)
  canvases().forEach((c) => ro.observe(c))

  // Track additions/removals of canvas elements
  const mo = new MutationObserver((mutations) => {
    let needsRefresh = false
    for (const m of mutations) {
      m.addedNodes?.forEach((n) => {
        if (n.nodeType === 1) {
          if (n.tagName?.toLowerCase() === 'canvas') {
            captureOriginal(n)
            ro.observe(n)
            needsRefresh = true
          }
          n.querySelectorAll?.('canvas')?.forEach((c) => {
            captureOriginal(c)
            ro.observe(c)
            needsRefresh = true
          })
        }
      })
      m.removedNodes?.forEach((n) => {
        if (n.nodeType === 1) {
          if (n.tagName?.toLowerCase() === 'canvas') {
            ro.unobserve(n)
            originals.delete(n)
          }
          n.querySelectorAll?.('canvas')?.forEach((c) => {
            ro.unobserve(c)
            originals.delete(c)
          })
        }
      })
    }
    if (needsRefresh) refreshAll()
  })
  mo.observe(root, { childList: true, subtree: true })

  const handleResize = () => refreshAll()
  window.addEventListener('resize', handleResize)

  // Capture originals and do an initial set
  canvases().forEach(captureOriginal)
  refreshAll()

  dprSizer = { ro, mo, handleResize, originals }

  // Ensure cleanup with other sandbox resources if possible
  if (Array.isArray(root.__sandboxCleanup)) {
    root.__sandboxCleanup.push(() => disableDprSizer())
  }
}

const disableDprSizer = () => {
  if (!dprSizer) return
  try {
    dprSizer.ro.disconnect()
  } catch {}
  try {
    dprSizer.mo.disconnect()
  } catch {}
  try {
    window.removeEventListener('resize', dprSizer.handleResize)
  } catch {}
  // Restore original width/height attributes
  try {
    for (const [canvas, orig] of dprSizer.originals.entries()) {
      if (!canvas.isConnected) continue
      if (orig.width == null) canvas.removeAttribute('width')
      else canvas.setAttribute('width', String(orig.width))
      if (orig.height == null) canvas.removeAttribute('height')
      else canvas.setAttribute('height', String(orig.height))
    }
  } catch {}
  dprSizer = null
}

watch(
  () => props.fullscreen,
  (next) => {
    if (next) {
      enableDprSizer()
    } else {
      disableDprSizer()
    }
  },
  { immediate: false }
)

const isExternal = (value) =>
  /^([a-z][a-z0-9+\-.]*:|\/\/)/i.test(value) || value.startsWith('data:')

const resolveUrl = (value, baseUrl) => {
  if (!value || value.startsWith('#') || isExternal(value)) {
    return value
  }
  const absolute = new URL(value, baseUrl)
  return absolute.pathname + absolute.search + absolute.hash
}

const normaliseSrcSet = (value, baseUrl) =>
  value
    .split(',')
    .map((candidate) => {
      const parts = candidate.trim().split(/\s+/, 2)
      if (!parts[0]) return ''
      const url = resolveUrl(parts[0], baseUrl)
      return parts[1] ? `${url} ${parts[1]}` : url
    })
    .filter(Boolean)
    .join(', ')

const transferAttributes = (target, source, baseUrl) => {
  for (const { name, value } of Array.from(source.attributes ?? [])) {
    if (name === 'src' || name === 'href' || name === 'xlink:href' || name === 'srcset') {
      continue
    }
    target.setAttribute(name, value)
  }

  const attributeMap = {
    IMG: ['src', 'srcset'],
    SOURCE: ['src', 'srcset'],
    SCRIPT: ['src'],
    LINK: ['href'],
    A: ['href'],
    USE: ['href', 'xlink:href'],
    VIDEO: ['poster'],
    AUDIO: ['src'],
  }

  const candidates = attributeMap[source.tagName]
  if (!candidates) return

  candidates.forEach((attribute) => {
    const rawValue = source.getAttribute(attribute)
    if (!rawValue) return

    if (attribute === 'srcset') {
      target.setAttribute(attribute, normaliseSrcSet(rawValue, baseUrl))
    } else {
      target.setAttribute(attribute, resolveUrl(rawValue, baseUrl))
    }
  })
}

const cloneNodeTree = async (node, baseUrl, scriptsBucket) => {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent ?? '')
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null
  }

  if (node.tagName === 'SCRIPT') {
    const type = (node.getAttribute('type') || '').trim().toLowerCase()
    if (type && !JS_MIME_TYPES.has(type)) {
      return null
    }

    const src = node.getAttribute('src')
    if (src) {
      const response = await fetch(resolveUrl(src, baseUrl))
      if (!response.ok) {
        throw new Error(`Unable to load project script (${response.status})`)
      }
      scriptsBucket.push({ code: await response.text() })
    } else {
      scriptsBucket.push({ code: node.textContent ?? '' })
    }
    return null
  }

  if (node.tagName === 'LINK' && node.getAttribute('rel') === 'stylesheet') {
    const link = document.createElement('link')
    transferAttributes(link, node, baseUrl)
    link.setAttribute('rel', 'stylesheet')
    return link
  }

  const element = document.createElement(node.tagName.toLowerCase())
  transferAttributes(element, node, baseUrl)

  for (const child of Array.from(node.childNodes)) {
    const clonedChild = await cloneNodeTree(child, baseUrl, scriptsBucket)
    if (clonedChild) {
      element.appendChild(clonedChild)
    }
  }

  return element
}

const injectHtml = async (html, baseUrl, currentTicket) => {
  const container = host.value
  if (!container) return

  const parser = new DOMParser()
  const documentFragment = parser.parseFromString(html, 'text/html')
  const target = container.shadowRoot ?? container.attachShadow({ mode: 'open' })

  dbg('inject:start', { ticket: currentTicket, base: String(baseUrl) })

  // Run cleanup for previous project
  if (Array.isArray(target.__sandboxCleanup)) {
    target.__sandboxCleanup.forEach((fn) => {
      try {
        fn?.()
      } catch (error) {
        console.error('[sandbox] cleanup failed:', error)
      }
    })
    target.__sandboxCleanup.length = 0
  } else {
    target.__sandboxCleanup = []
  }

  // Clear DOM
  while (target.firstChild) {
    target.firstChild.remove()
  }

  // Reset disposed flag for new project
  target.__sandboxDisposed = false

  // Ensure a small default stylesheet exists for fullscreen sizing
  // This only affects styles when the shadow host has data-fullscreen="true"
  const defaultStyle = document.createElement('style')
  defaultStyle.textContent = `
    :host([data-fullscreen="true"]) {
      width: 100%;
      height: 100%;
      display: block;
    }
    :host([data-fullscreen="true"]) body {
      margin: 0;
      min-height: 100%;
    }
    /* Expand canvases in fullscreen to fill the sandbox host */
    :host([data-fullscreen="true"]) canvas {
      width: 100% !important;
      height: 100% !important;
      max-width: 100% !important;
      max-height: 100% !important;
      display: block;
    }
  `
  target.appendChild(defaultStyle)

  const scriptsBucket = []
  const nodes = Array.from(documentFragment.body.childNodes)

  for (const child of nodes) {
    if (ticket !== currentTicket) return
    const cloned = await cloneNodeTree(child, baseUrl, scriptsBucket)
    if (cloned) {
      target.appendChild(cloned)
    }
  }

  if (ticket !== currentTicket) return

  const baseDocument = target.ownerDocument ?? document
  const baseWindow = baseDocument.defaultView ?? window
  const cleanupList = target.__sandboxCleanup

  const instrumentedDocument = new Proxy(baseDocument, {
    get(targetDocument, prop) {
      if (prop === 'addEventListener') {
        return (type, listener, options) => {
          targetDocument.addEventListener(type, listener, options)
          cleanupList.push(() =>
            targetDocument.removeEventListener(type, listener, options)
          )
        }
      }
      if (prop === 'removeEventListener') {
        return (type, listener, options) =>
          targetDocument.removeEventListener(type, listener, options)
      }
      const value = targetDocument[prop]
      return typeof value === 'function' ? value.bind(targetDocument) : value
    },
    set(targetDocument, prop, value) {
      targetDocument[prop] = value
      return true
    },
  })

  const instrumentedWindow = new Proxy(baseWindow, {
    get(targetWindow, prop) {
      if (prop === 'document') {
        return instrumentedDocument
      }
      if (prop === 'requestAnimationFrame') {
        return (callback) => {
          // Don't schedule if disposed
          if (target.__sandboxDisposed) {
            return -1
          }
          const handle = targetWindow.requestAnimationFrame((...args) => {
            // Check again before executing callback
            if (!target.__sandboxDisposed) {
              callback(...args)
            }
          })
          cleanupList.push(() => targetWindow.cancelAnimationFrame(handle))
          return handle
        }
      }
      if (prop === 'setTimeout') {
        return (callback, delay, ...args) => {
          // Don't schedule if disposed
          if (target.__sandboxDisposed) {
            return -1
          }
          const handle = targetWindow.setTimeout((...cbArgs) => {
            // Check before executing callback
            if (!target.__sandboxDisposed) {
              callback(...cbArgs)
            }
          }, delay, ...args)
          cleanupList.push(() => targetWindow.clearTimeout(handle))
          return handle
        }
      }
      if (prop === 'setInterval') {
        return (callback, delay, ...args) => {
          // Don't schedule if disposed
          if (target.__sandboxDisposed) {
            return -1
          }
          const handle = targetWindow.setInterval((...cbArgs) => {
            // Check before executing callback
            if (!target.__sandboxDisposed) {
              callback(...cbArgs)
            }
          }, delay, ...args)
          cleanupList.push(() => targetWindow.clearInterval(handle))
          return handle
        }
      }
      if (prop === 'addEventListener') {
        return (type, listener, options) => {
          targetWindow.addEventListener(type, listener, options)
          cleanupList.push(() => targetWindow.removeEventListener(type, listener, options))
        }
      }
      if (prop === 'removeEventListener') {
        return (type, listener, options) => targetWindow.removeEventListener(type, listener, options)
      }
      if (prop === 'ResizeObserver' && typeof targetWindow.ResizeObserver === 'function') {
        return class WrappedResizeObserver extends targetWindow.ResizeObserver {
          constructor(callback) {
            super(callback)
            cleanupList.push(() => {
              try {
                super.disconnect()
              } catch (error) {
                console.error('[sandbox] resize observer cleanup failed:', error)
              }
            })
          }
        }
      }
      const value = targetWindow[prop]
      return typeof value === 'function' ? value.bind(targetWindow) : value
    },
    set(targetWindow, prop, value) {
      targetWindow[prop] = value
      return true
    },
  })

  scriptsBucket.forEach((entry, i) => {
    if (ticket !== currentTicket) return

    const preparedCode =
      (entry.code ?? '').replace(/document\.currentScript\.getRootNode\(\)/g, 'sandboxRoot')

    let runner = entry.runner
    if (!runner) {
      // Pass instrumented globals as function parameters to intercept bare calls
      runner = new Function(
        'sandboxRoot',
        'window',
        'document',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'ResizeObserver',
        '"use strict";\n' + preparedCode
      )
      entry.runner = runner
    }

    try {
      dbg('script:run', { ticket: currentTicket, index: i, bytes: preparedCode.length })
      runner.call(
        target,
        target,
        instrumentedWindow,
        instrumentedDocument,
        instrumentedWindow.requestAnimationFrame,
        instrumentedWindow.cancelAnimationFrame,
        instrumentedWindow.setTimeout,
        instrumentedWindow.clearTimeout,
        instrumentedWindow.setInterval,
        instrumentedWindow.clearInterval,
        instrumentedWindow.ResizeObserver
      )
    } catch (error) {
      console.error('[sandbox] script execution failed:', error)
    }
  })

  dbg('inject:done', { ticket: currentTicket, scripts: scriptsBucket.length })

  // After injection, (re)apply DPR sizer if fullscreen is active
  if (props.fullscreen) {
    try {
      enableDprSizer()
    } catch (e) {
      console.warn('[sandbox] dpr sizer enable failed:', e)
    }
  }
}

const loadProject = async (slug, entryPoint, currentTicket) => {
  if (activeController) {
    activeController.abort()
  }
  activeController = new AbortController()
  const { signal } = activeController

  const payloadBase = createEventPayload(slug, entryPoint, currentTicket)
  emit('loading', payloadBase)
  try {
    const response = await fetch(entryPoint, { cache: 'no-store', signal })
    if (!response.ok) {
      throw new Error(`Unable to load project asset (${response.status})`)
    }

    const html = await response.text()
    const baseUrl = new URL(entryPoint, window.location.origin)
    await injectHtml(html, baseUrl, currentTicket)
    if (ticket === currentTicket) {
      emit('loaded', payloadBase)
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      return
    }
    if (ticket === currentTicket) {
      clearShadow()
      const message = error instanceof Error ? error.message : String(error)
      emit('error', createEventPayload(slug, entryPoint, currentTicket, { error: message }))
    }
  }
}

watch(
  () => [props.project?.slug ?? '', props.project?.entryPoint ?? ''],
  ([slug, entryPoint]) => {
    const currentTicket = ++ticket
    if (!slug) {
      clearShadow()
      emit(
        'error',
        createEventPayload(slug, entryPoint, currentTicket, {
          error: 'Sandbox slug is missing. Cannot load project.',
        })
      )
      return
    }

    if (!entryPoint) {
      clearShadow()
      emit('loaded', createEventPayload(slug, entryPoint, currentTicket, { empty: true }))
      return
    }

    loadProject(slug, entryPoint, currentTicket)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  ticket += 1
  clearShadow()
  if (activeController) {
    activeController.abort()
    activeController = null
  }
  // Ensure DPR sizer is torn down
  try { disableDprSizer() } catch {}
})
</script>

<style scoped>
.sandbox {
  width: 100%;
  min-height: 360px;
  border-radius: 1.5rem;
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.35);
  padding: clamp(1rem, 2vw, 1.75rem);
  position: relative;
  overflow: hidden;
  box-shadow: inset 0 0 60px rgba(8, 47, 73, 0.4);
}

.sandbox-host {
  width: 100%;
  height: 100%;
  display: block;
}

/* Fullscreen overrides: remove card chrome and padding so the host can truly fill */
.sandbox[data-fullscreen='true'] {
  border-radius: 0;
  background: transparent;
  border: 0;
  padding: 0;
  box-shadow: none;
  width: 100%;
  height: 100%;
}

.sandbox[data-fullscreen='true'] .sandbox-host {
  width: 100%;
  height: 100%;
}
</style>
