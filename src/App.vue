<template>
  <div class="app-shell">
    <header class="app-header">
      <div>
        <p class="eyebrow">Azure Static Web Apps Demo</p>
        <h1>AI Playground Showcase</h1>
      </div>
      <p class="lede">
        A curated collection of experiments generated with AI assistance. Each project runs inside a
        sandboxed Shadow DOM so styles and behaviour stay self-contained.
      </p>
    </header>

    <div class="app-body">
      <aside class="sidebar">
        <ProjectList
          :projects="filteredProjects"
          :selected-slug="selectedSlug"
          :search-term="searchTerm"
          :total-count="totalProjects"
          :loading="manifestState.loading"
          :has-search="hasSearch"
          @select="handleProjectSelection"
          @update:searchTerm="handleSearchTermChange"
        />
      </aside>

      <main class="workspace">
        <Breadcrumbs :items="breadcrumbs" />
        <section class="project-pane">
          <div v-if="manifestState.loading" class="state-card">
            <div class="spinner" aria-hidden="true"></div>
            <p>Loading manifest...</p>
          </div>

          <div v-else-if="manifestState.error" class="state-card error">
            <p>We could not load the manifest file.</p>
            <code>{{ manifestState.error }}</code>
          </div>

          <div v-else-if="filteredProjects.length === 0 && hasSearch" class="state-card">
            <p>No projects matched "{{ trimmedSearch }}".</p>
            <p class="state-hint">Try another keyword or clear the search field to see everything.</p>
          </div>

          <div v-else-if="projects.length === 0" class="state-card">
            <p>No projects have been published yet.</p>
          </div>

          <div v-else-if="!selectedProject" class="state-card">
            <p>Select a project from the list to preview it here.</p>
          </div>

          <div :class="['project-content', { fullscreen: isFullscreen }]">
            <header class="project-header">
              <div class="project-title">
                <h2>{{ selectedProject?.name ?? '' }}</h2>
                <p>{{ selectedProject?.summary ?? '' }}</p>
              </div>
              <div class="project-actions">
                <span class="status-pill" :data-status="selectedProject?.status ?? 'unknown'">
                  {{ selectedProject?.status ?? 'unknown' }}
                </span>
                <button
                  type="button"
                  class="fullscreen-toggle"
                  :aria-pressed="isFullscreen"
                  @click="toggleFullscreen"
                >
                  {{ isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen' }}
                </button>
              </div>
            </header>

            <div class="agent-cloud" aria-label="AI agents involved in this build">
              <span
                v-for="agent in selectedProject?.agents ?? []"
                :key="agent"
                class="agent-pill"
              >
                {{ agent }}
              </span>
            </div>

            <ProjectSandbox
              v-if="selectedProject"
              :key="selectedProject.slug"
              :project="selectedProject"
              @loading="handleSandboxLoading"
              @loaded="handleSandboxLoaded"
              @error="handleSandboxError"
            />

            <div v-if="sandboxState.status === 'loading'" class="sandbox-status loading">
              <span class="spinner" aria-hidden="true"></span>
              <span>Bootstrapping sandbox assets...</span>
            </div>
            <div v-else-if="sandboxState.status === 'error'" class="sandbox-status error">
              <span aria-hidden="true">!</span>
              <span>{{ sandboxState.errorMessage }}</span>
            </div>
            <button
              v-if="isFullscreen"
              type="button"
              class="fullscreen-close"
              aria-label="Exit fullscreen"
              @click="exitFullscreen"
            >
              X
            </button>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Breadcrumbs from './components/Breadcrumbs.vue'
import ProjectList from './components/ProjectList.vue'
import ProjectSandbox from './components/ProjectSandbox.vue'

const projects = ref([])
const selectedSlug = ref('')
const searchTerm = ref('')
const isFullscreen = ref(false)

const manifestState = reactive({
  loading: false,
  error: '',
})

const sandboxState = reactive({
  status: 'idle',
  errorMessage: '',
})

const activeSandbox = reactive({
  slug: '',
  ticket: null,
})

const totalProjects = computed(() => projects.value.length)

const filteredProjects = computed(() => {
  const tokens = searchTerm.value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.length === 0) {
    return projects.value
  }

  return projects.value.filter((project) => {
    const haystack = [
      project.name,
      project.summary,
      project.slug,
      project.status,
      ...(project.tags ?? []),
      ...(project.agents ?? []),
    ]
      .join(' ')
      .toLowerCase()

    return tokens.every((token) => haystack.includes(token))
  })
})

const selectedProject = computed(() =>
  filteredProjects.value.find((candidate) => candidate.slug === selectedSlug.value) ?? null
)

const hasSearch = computed(() => searchTerm.value.trim().length > 0)
const trimmedSearch = computed(() => searchTerm.value.trim())

const breadcrumbs = computed(() => {
  const base = [{ label: 'Projects' }]
  if (selectedProject.value) {
    base.push({ label: selectedProject.value.name })
  }
  return base
})

const handleProjectSelection = (project) => {
  if (!project || project.slug === selectedSlug.value) {
    return
  }

  isFullscreen.value = false
  activeSandbox.slug = project.slug
  // Don't preset ticket - let the sandbox component set it via the loading event
  activeSandbox.ticket = null
  selectedSlug.value = project.slug
  sandboxState.status = 'loading'
  sandboxState.errorMessage = ''
}

const handleSearchTermChange = (value = '') => {
  searchTerm.value = value
}

const isPayloadForCurrentProject = (payload) => {
  if (!payload) return false
  const slug = payload.slug ?? activeSandbox.slug ?? ''
  return !!slug && slug === selectedSlug.value
}

const handleSandboxLoading = (payload) => {
  if (!isPayloadForCurrentProject(payload)) {
    return
  }

  activeSandbox.slug = payload.slug
  activeSandbox.ticket = payload.ticket ?? 0
  sandboxState.status = 'loading'
  sandboxState.errorMessage = ''
}

const handleSandboxLoaded = (payload) => {
  if (!isPayloadForCurrentProject(payload)) {
    return
  }

  // Only check ticket match if we have a ticket set from the loading event
  if (activeSandbox.ticket !== null && payload.ticket && payload.ticket !== activeSandbox.ticket) {
    return
  }

  sandboxState.status = 'ready'
  sandboxState.errorMessage = ''
}

const handleSandboxError = (payload) => {
  if (!isPayloadForCurrentProject(payload)) {
    return
  }

  // Only check ticket match if we have a ticket set from the loading event
  if (activeSandbox.ticket !== null && payload.ticket && payload.ticket !== activeSandbox.ticket) {
    return
  }

  const message =
    typeof payload.error === 'string'
      ? payload.error
      : payload instanceof Error
        ? payload.message
        : 'Unknown sandbox error.'

  sandboxState.status = 'error'
  sandboxState.errorMessage = message
}

watch(filteredProjects, (next) => {
  if (!Array.isArray(next) || next.length === 0) {
    if (selectedSlug.value) {
      selectedSlug.value = ''
    }
    isFullscreen.value = false
    activeSandbox.slug = ''
    activeSandbox.ticket = null
    if (sandboxState.status !== 'idle') {
      sandboxState.status = 'idle'
      sandboxState.errorMessage = ''
    }
    return
  }

  const alreadySelected = next.some((project) => project.slug === selectedSlug.value)
  if (!alreadySelected) {
    handleProjectSelection(next[0])
  }
}, { immediate: true })

const loadManifest = async () => {
  manifestState.loading = true
  manifestState.error = ''

  try {
    const response = await fetch('/projects/manifest.json', { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(
        `Manifest responded with ${response.status} ${response.statusText || 'Unknown error'}`
      )
    }

    const manifest = await response.json()
    projects.value = manifest
  } catch (error) {
    manifestState.error = error instanceof Error ? error.message : String(error)
  } finally {
    manifestState.loading = false
  }
}

onMounted(() => {
  loadManifest()
})

const handleGlobalKeydown = (event) => {
  if (event.key === 'Escape' && isFullscreen.value) {
    isFullscreen.value = false
  }
}

watch(isFullscreen, (next) => {
  if (typeof document === 'undefined') return
  const { body } = document
  if (!body) return
  if (next) {
    body.dataset.fullscreenLock = 'true'
    body.style.overflow = 'hidden'
  } else {
    if (body.dataset.fullscreenLock) {
      delete body.dataset.fullscreenLock
    }
    body.style.overflow = ''
  }

  if (typeof window !== 'undefined') {
    if (next) {
      window.addEventListener('keydown', handleGlobalKeydown)
    } else {
      window.removeEventListener('keydown', handleGlobalKeydown)
    }
  }
})

const toggleFullscreen = () => {
  if (!selectedProject.value) return
  isFullscreen.value = !isFullscreen.value
}

const exitFullscreen = () => {
  isFullscreen.value = false
}

onBeforeUnmount(() => {
  if (typeof document === 'undefined') return
  const { body } = document
  if (!body) return
  if (body.dataset.fullscreenLock) {
    delete body.dataset.fullscreenLock
  }
  body.style.overflow = ''
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleGlobalKeydown)
  }
})
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  gap: clamp(1.5rem, 2vw, 2.5rem);
  max-width: 1200px;
  margin: 0 auto;
}

.app-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(71, 85, 105, 0.4);
  border-radius: 1.5rem;
  padding: clamp(1.5rem, 3vw, 2.75rem);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.45);
}

.eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.28em;
  font-size: 0.75rem;
  color: rgba(165, 180, 252, 0.9);
}

.app-header h1 {
  margin: 0;
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  color: #f8fafc;
}

.lede {
  margin: 0;
  max-width: 48rem;
  font-size: 1rem;
  line-height: 1.7;
  color: rgba(226, 232, 240, 0.8);
}

.app-body {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  gap: clamp(1.5rem, 3vw, 2.5rem);
  align-items: flex-start;
}

.sidebar {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(71, 85, 105, 0.45);
  border-radius: 1.5rem;
  padding: clamp(1.25rem, 2vw, 2rem);
  position: sticky;
  top: clamp(1rem, 3vw, 2rem);
}

.workspace {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.project-pane {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.state-card {
  border-radius: 1.25rem;
  border: 1px dashed rgba(96, 165, 250, 0.4);
  background: rgba(15, 23, 42, 0.55);
  padding: clamp(1.5rem, 3vw, 2.5rem);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: flex-start;
  color: rgba(191, 219, 254, 0.9);
}

.state-card.error {
  border-color: rgba(248, 113, 113, 0.45);
  color: #fecaca;
}

.state-hint {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(148, 163, 184, 0.85);
}

.state-card code {
  font-size: 0.85rem;
  background: rgba(30, 41, 59, 0.7);
  padding: 0.4rem 0.6rem;
  border-radius: 0.6rem;
}

.spinner {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  border: 2px solid rgba(148, 163, 184, 0.35);
  border-top-color: rgba(96, 165, 250, 0.9);
  animation: spin 0.75s linear infinite;
}

.project-content {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.project-header {
  display: flex;
  justify-content: space-between;
  gap: 1.2rem;
  flex-wrap: wrap;
  align-items: stretch;
}

.project-title {
  flex: 1 1 60%;
}

.project-header h2 {
  margin: 0;
  font-size: clamp(1.4rem, 2.5vw, 2rem);
}

.project-header p {
  margin: 0.35rem 0 0;
  max-width: 48ch;
  color: rgba(203, 213, 225, 0.85);
}

.project-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.6rem;
}

.status-pill {
  align-self: center;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.7rem;
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.5);
  color: rgba(165, 180, 252, 0.9);
  background: rgba(88, 28, 135, 0.2);
}

.status-pill[data-status='prototype'] {
  border-color: rgba(59, 130, 246, 0.6);
  background: rgba(37, 99, 235, 0.25);
  color: rgba(191, 219, 254, 0.95);
}

.fullscreen-toggle {
  border: 1px solid rgba(96, 165, 250, 0.6);
  border-radius: 999px;
  padding: 0.45rem 0.9rem;
  background: rgba(30, 64, 175, 0.25);
  color: rgba(191, 219, 254, 0.96);
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
}

.fullscreen-toggle:hover {
  background: rgba(59, 130, 246, 0.25);
  border-color: rgba(148, 163, 184, 0.85);
  transform: translateY(-1px);
}

.agent-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.agent-pill {
  font-size: 0.75rem;
  padding: 0.35rem 0.7rem;
  border-radius: 0.75rem;
  background: rgba(30, 64, 175, 0.3);
  border: 1px solid rgba(30, 64, 175, 0.5);
  color: rgba(191, 219, 254, 0.95);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sandbox-status {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  padding: 0.4rem 0;
  color: rgba(148, 163, 184, 0.95);
}

.sandbox-status.error {
  color: #fecaca;
}

.project-content.fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: linear-gradient(180deg, rgba(2, 6, 23, 0.95), rgba(8, 28, 58, 0.9));
  margin: 0;
  padding: clamp(1.5rem, 4vw, 3rem);
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 1.25rem;
  overflow: hidden;
}

.project-content.fullscreen .agent-cloud {
  justify-content: flex-start;
}

.project-content.fullscreen .sandbox {
  min-height: unset;
  height: 100%;
  display: flex;
}

.project-content.fullscreen .sandbox-host {
  flex: 1;
}

.project-content.fullscreen .sandbox-status {
  justify-content: flex-start;
}

.fullscreen-close {
  position: fixed;
  top: clamp(1rem, 4vw, 2.5rem);
  right: clamp(1rem, 4vw, 2.5rem);
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: rgba(15, 23, 42, 0.85);
  color: rgba(241, 245, 249, 0.95);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  z-index: 1300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.fullscreen-close:hover {
  border-color: rgba(248, 250, 252, 0.7);
  background: rgba(30, 41, 59, 0.9);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 960px) {
  .app-body {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
  }

  .project-actions {
    flex-direction: row;
    align-items: center;
  }
}
</style>
