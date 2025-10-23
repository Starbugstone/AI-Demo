<template>
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <ol>
      <li v-for="(item, index) in items" :key="`${item.label}-${index}`">
        <template v-if="item.to">
          <a :href="item.to">{{ item.label }}</a>
        </template>
        <template v-else>
          <span aria-current="page">{{ item.label }}</span>
        </template>
        <span v-if="index !== lastIndex" class="separator">/</span>
      </li>
    </ol>
  </nav>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
})

const lastIndex = computed(() => Math.max(props.items.length - 1, 0))
</script>

<style scoped>
.breadcrumbs {
  font-size: 0.85rem;
  color: rgba(148, 163, 184, 0.95);
  margin-bottom: 0.75rem;
}

.breadcrumbs ol {
  list-style: none;
  display: flex;
  padding: 0;
  margin: 0;
  gap: 0.35rem;
  align-items: center;
}

.breadcrumbs a {
  color: inherit;
  text-decoration: none;
  transition: color 140ms ease;
}

.breadcrumbs a:hover {
  color: #60a5fa;
}

.breadcrumbs span[aria-current='page'] {
  color: #f1f5f9;
  font-weight: 500;
}

.separator {
  opacity: 0.35;
}
</style>
