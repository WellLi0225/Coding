<script setup lang="ts">
import type { VehicleCompareItem } from '../types/vehicle'

type EfficiencyParts = {
  valueText: string
  basisText: string | null
}

defineProps<{
  vehicles: VehicleCompareItem[]
  selectedIds: string[]
  filteredCount: number
  visibleStartNumber: number
  visibleEndNumber: number
  currentPage: number
  totalPages: number
  formatModelYear: (vehicle: VehicleCompareItem) => string
  formatCurrency: (value: number | null) => string
  getEfficiencyLabel: (vehicle: VehicleCompareItem) => string
  getDisplayedEfficiencyParts: (vehicle: VehicleCompareItem) => EfficiencyParts
  formatSalesRank: (rank: number | null, volume: number | null) => string
  formatNullable: (value: number | null, suffix?: string) => string
}>()

defineEmits<{
  toggleVehicle: [vehicleId: string]
  goToPage: [page: number]
}>()
</script>

<template>
  <div class="results-column">
    <div class="results-summary" aria-live="polite">
      <span>
        {{ visibleStartNumber }}-{{ visibleEndNumber }} / {{ filteredCount }}대
      </span>
      <span>{{ currentPage }} / {{ totalPages }}페이지</span>
    </div>

    <div class="vehicle-list" aria-label="목 차량 목록">
      <article
        v-for="vehicle in vehicles"
        :key="vehicle.id"
        class="vehicle-card"
        :class="{ selected: selectedIds.includes(vehicle.id) }"
      >
        <div>
          <p>{{ vehicle.brand }}</p>
          <h2>{{ vehicle.model }}</h2>
          <span>{{ formatModelYear(vehicle) }}</span>
        </div>

        <dl>
          <div>
            <dt>권장 소비자가</dt>
            <dd>{{ formatCurrency(vehicle.msrpUsd) }}</dd>
          </div>
          <div>
            <dt>{{ getEfficiencyLabel(vehicle) }}</dt>
            <dd class="efficiency-value">
              <span class="efficiency-number">
                {{ getDisplayedEfficiencyParts(vehicle).valueText }}
              </span>
              <span
                v-if="getDisplayedEfficiencyParts(vehicle).basisText"
                class="efficiency-basis"
              >
                ({{ getDisplayedEfficiencyParts(vehicle).basisText }})
              </span>
            </dd>
          </div>
          <div>
            <dt>국내 판매 순위</dt>
            <dd>
              {{
                formatSalesRank(
                  vehicle.domesticSalesRank,
                  vehicle.domesticSalesVolume,
                )
              }}
            </dd>
          </div>
          <div>
            <dt>리콜</dt>
            <dd>{{ formatNullable(vehicle.recallCount, '건') }}</dd>
          </div>
        </dl>

        <footer>
          <div class="vehicle-card-meta">
            <small>
              {{ vehicle.sourceName }} 기준일 {{ vehicle.sourceCheckedAt }}
            </small>
            <code>{{ vehicle.id }}</code>
          </div>
          <button type="button" @click="$emit('toggleVehicle', vehicle.id)">
            {{ selectedIds.includes(vehicle.id) ? '비교 해제' : '비교하기' }}
          </button>
        </footer>
      </article>
    </div>

    <p v-if="filteredCount === 0" class="empty results-empty">
      조건에 맞는 차량이 없습니다.
    </p>

    <nav
      v-if="totalPages > 1"
      class="pagination"
      aria-label="차량 목록 페이지"
    >
      <button
        type="button"
        :disabled="currentPage === 1"
        @click="$emit('goToPage', currentPage - 1)"
      >
        이전
      </button>
      <span>{{ currentPage }} / {{ totalPages }}</span>
      <button
        type="button"
        :disabled="currentPage === totalPages"
        @click="$emit('goToPage', currentPage + 1)"
      >
        다음
      </button>
    </nav>
  </div>
</template>
