<script setup lang="ts">
import type { VehicleCompareItem } from '../types/vehicle'

defineProps<{
  selectedVehicles: VehicleCompareItem[]
  maxCompareCount: number
  isLoadingSpecs: boolean
}>()

defineEmits<{
  openComparison: []
}>()
</script>

<template>
  <aside class="compare-panel" aria-label="선택한 차량">
    <div>
      <p>선택한 차량</p>
      <h2>{{ selectedVehicles.length }}/{{ maxCompareCount }}</h2>
    </div>

    <p v-if="selectedVehicles.length === 0" class="empty">
      비교할 차량을 최대 {{ maxCompareCount }}대까지 선택하세요.
    </p>

    <ul v-else>
      <li v-for="vehicle in selectedVehicles" :key="vehicle.id">
        <span>{{ vehicle.brand }} {{ vehicle.model }}</span>
        <code>{{ vehicle.id }}</code>
      </li>
    </ul>

    <button
      v-if="selectedVehicles.length >= 2"
      type="button"
      class="spec-compare-button"
      :disabled="isLoadingSpecs"
      @click="$emit('openComparison')"
    >
      {{ isLoadingSpecs ? '제원 불러오는 중' : '선택한 차량 비교하기' }}
    </button>
  </aside>
</template>
