<template>
  <router-link v-if="to" :to="to" class="sidebar-icon-wrapper" :class="{ active }">
    <div v-if="active" class="active-indicator" />
    <component :is="icon" :size="isLogo ? 20 : 20" :stroke-width="active ? 2.2 : 1.8" />
  </router-link>
  <div v-else class="sidebar-icon-wrapper" :class="{ active }">
    <div v-if="active" class="active-indicator" />
    <component :is="icon" :size="20" :stroke-width="active ? 2.2 : 1.8" />
  </div>
  <a-tooltip :content="label" position="right" mini>
    <div />
  </a-tooltip>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  icon: Component
  label: string
  active?: boolean
  to?: string
  isLogo?: boolean
}>()
</script>

<style scoped>
.sidebar-icon-wrapper {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
  text-decoration: none;
}
.sidebar-icon-wrapper:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}
.sidebar-icon-wrapper.active {
  color: #007AFF;
  background: rgba(0, 122, 255, 0.1);
}
.active-indicator {
  position: absolute;
  left: -12px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 16px;
  border-radius: 0 3px 3px 0;
  background: #007AFF;
}
</style>
