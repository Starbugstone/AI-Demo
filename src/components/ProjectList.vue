<template>
  <div class="project-list">
    <div class="list-header">
      <h2>Projects</h2>
      <p>Each sandbox is isolated. Pick one to explore.</p>
    </div>
    <div class="search-row">
      <label class="search-label">
        <span class="sr-only">Search projects</span>
        <input
          type="search"
          :value="searchTerm"
          :disabled="loading && totalCount === 0"
          placeholder="Search projects..."
          autocomplete="off"
          @input="$emit('update:searchTerm', $event.target.value)"
          @keydown.escape="$emit('update:searchTerm', '')"
        />
      </label>
      <span class="result-count" aria-live="polite">
        {{ projects.length }} / {{ totalCount || 0 }}
      </span>
    </div>
    <ul v-if="projects.length">
      <li
        v-for="project in projects"
        :key="project.slug"
        :class="{ active: project.slug === selectedSlug }"
      >
        <button type="button" @click="$emit('select', project)">
          <div class="row">
            <span class="name">{{ project.name }}</span>
            <span class="status" :data-status="project.status">{{ project.status }}</span>
          </div>
          <p class="summary">{{ project.summary }}</p>
          <div v-if="project.tags?.length" class="tags">
            <span v-for="tag in project.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
          <div class="agents">
            <span v-for="agent in project.agents" :key="agent" class="agent">
              {{ agent }}
            </span>
          </div>
        </button>
      </li>
    </ul>
    <div v-else class="empty-state">
      <span v-if="loading">Loading projects...</span>
      <span v-else-if="totalCount === 0">No projects published yet.</span>
      <span v-else-if="hasSearch">No matches for the current search.</span>
      <span v-else>Select a project to get started.</span>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  projects: {
    type: Array,
    default: () => [],
  },
  selectedSlug: {
    type: String,
    default: '',
  },
  searchTerm: {
    type: String,
    default: '',
  },
  totalCount: {
    type: Number,
    default: 0,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  hasSearch: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['select', 'update:searchTerm'])
</script>

<style scoped>
.project-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.list-header h2 {
  margin: 0;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(226, 232, 240, 0.85);
}

.list-header p {
  margin: 0.4rem 0 0;
  font-size: 0.85rem;
  line-height: 1.5;
  color: rgba(148, 163, 184, 0.85);
}

.search-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(71, 85, 105, 0.55);
  border-radius: 0.85rem;
  padding: 0.55rem 0.75rem;
}

.search-label {
  flex: 1;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

input[type='search'] {
  width: 100%;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 0.3rem 0.2rem;
  outline: none;
}

input[type='search']::placeholder {
  color: rgba(148, 163, 184, 0.6);
}

input[type='search']:disabled {
  opacity: 0.6;
}

.result-count {
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(148, 163, 184, 0.75);
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

li {
  margin: 0;
}

button {
  width: 100%;
  border: 1px solid rgba(51, 65, 85, 0.6);
  border-radius: 1rem;
  padding: 1rem 1.1rem;
  background: rgba(15, 23, 42, 0.55);
  color: inherit;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  cursor: pointer;
  transition: border-color 160ms ease, transform 160ms ease, background 160ms ease;
}

li.active button {
  border-color: rgba(96, 165, 250, 0.9);
  background: rgba(30, 64, 175, 0.35);
}

button:hover {
  transform: translateY(-2px);
  border-color: rgba(148, 163, 184, 0.9);
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.name {
  font-weight: 600;
  color: #f8fafc;
}

.status {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.12rem 0.5rem;
  border-radius: 999px;
  border: 1px solid currentColor;
  color: rgba(148, 163, 184, 0.8);
}

.status[data-status='prototype'] {
  color: #38bdf8;
}

.summary {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(226, 232, 240, 0.86);
  line-height: 1.5;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.tag {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.2);
  color: rgba(191, 219, 254, 0.95);
}

.agents {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: rgba(165, 180, 252, 0.9);
}

.agent {
  padding: 0.25rem 0.5rem;
  border-radius: 0.45rem;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.35);
}

.empty-state {
  font-size: 0.85rem;
  color: rgba(148, 163, 184, 0.85);
  padding: 0.6rem 0.2rem;
}
</style>
