<template>
  <div class="sandbox">
    <div ref="host" class="sandbox-host" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  project: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['loading', 'loaded', 'error'])

const host = ref(null)
let ticket = 0
let activeController = null

const JS_MIME_TYPES = new Set(['', 'text/javascript', 'application/javascript'])

const createEventPayload = (slug, entryPoint, ticketValue, extra = {}) => ({
  slug,
  entryPoint,
  ticket: ticketValue,
  ...extra,
})

const clearShadow = () => {
  const current = host.value
  if (!current?.shadowRoot) return
  while (current.shadowRoot.firstChild) {
    current.shadowRoot.removeChild(current.shadowRoot.firstChild)
  }
}

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

  while (target.firstChild) {
    target.firstChild.remove()
  }

  const nodes = Array.from(documentFragment.body.childNodes)
  const scriptsBucket = []

  for (const child of nodes) {
    if (ticket !== currentTicket) return
    const cloned = await cloneNodeTree(child, baseUrl, scriptsBucket)
    if (cloned) {
      target.appendChild(cloned)
    }
  }

  if (ticket !== currentTicket) return

  const boundDocument = target.ownerDocument ?? document
  const boundWindow = boundDocument.defaultView ?? window

  scriptsBucket.forEach((entry) => {
    if (ticket !== currentTicket) return

    const preparedCode = (entry.code ?? '').replace(
      /document\.currentScript\.getRootNode\(\)/g,
      'sandboxRoot'
    )

    let runner = entry.runner
    if (!runner) {
      runner = new Function('sandboxRoot', 'window', 'document', '"use strict";\n' + preparedCode)
      entry.runner = runner
    }
    try {
      runner.call(target, target, boundWindow, boundDocument)
    } catch (error) {
      console.error('[sandbox] script execution failed:', error)
    }
  })
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
</style>
