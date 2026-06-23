<script setup lang="ts">
import type { VehicleCompareItem } from '../types/vehicle'
import type { VehicleSpecItem, VehicleSpecTrim } from '../types/vehicleSpec'

type EfficiencyParts = {
  valueText: string
  basisText: string | null
}

type SpecComparison = {
  vehicle: VehicleCompareItem
  spec: VehicleSpecItem | undefined
  trim: VehicleSpecTrim | null
}

defineProps<{
  show: boolean
  selectedVehicles: VehicleCompareItem[]
  isLoadingSpecs: boolean
  vehicleSpecsData: VehicleSpecItem[] | null
  selectedSpecComparisons: SpecComparison[]
  specComparisonGroups: { name: string; rows: string[] }[]
  hasSelectedFuelEconomy: boolean
  hasSelectedElectricEfficiency: boolean
  formatModelYear: (vehicle: VehicleCompareItem) => string
  getComparisonTrimNames: (vehicle: VehicleCompareItem) => string[]
  formatStoredPriceRange: (vehicle: VehicleCompareItem) => string
  getEfficiencyPartsForCategory: (
    vehicle: VehicleCompareItem,
    category: 'fuelEconomy' | 'electricEfficiency',
  ) => EfficiencyParts
  formatSalesRank: (rank: number | null, volume: number | null) => string
  formatNullable: (value: number | null, suffix?: string) => string
  getStoredSpecStatus: (vehicle: VehicleCompareItem) => string
  getSpecValue: (
    trim: VehicleSpecTrim | null,
    groupName: string,
    rowName: string,
  ) => string
}>()

defineEmits<{
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="show"
        class="comparison-modal"
        role="dialog"
        aria-modal="true"
        aria-label="선택 차량 비교표"
        @click.self="$emit('close')"
      >
        <section class="comparison comparison-dialog" aria-label="비교표">
          <div class="comparison-dialog-header">
            <div>
              <p>선택 차량</p>
              <h2>비교표</h2>
            </div>
            <button
              type="button"
              class="modal-close-button"
              aria-label="비교표 닫기"
              @click="$emit('close')"
            >
              닫기
            </button>
          </div>

          <p v-if="selectedVehicles.length < 2" class="empty">
            차량을 2대 이상 선택하면 비교표가 표시됩니다.
          </p>

          <table v-else>
            <thead>
              <tr>
                <th>항목</th>
                <th v-for="vehicle in selectedVehicles" :key="vehicle.id">
                  {{ vehicle.brand }} {{ vehicle.model }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>연식</th>
                <td v-for="vehicle in selectedVehicles" :key="vehicle.id">
                  {{ formatModelYear(vehicle) }}
                </td>
              </tr>
              <tr>
                <th>트림</th>
                <td v-for="vehicle in selectedVehicles" :key="vehicle.id">
                  <span
                    v-for="trimName in getComparisonTrimNames(vehicle)"
                    :key="trimName"
                    class="comparison-value-line"
                  >
                    {{ trimName }}
                  </span>
                </td>
              </tr>
              <tr>
                <th>연료</th>
                <td v-for="vehicle in selectedVehicles" :key="vehicle.id">
                  {{ vehicle.fuelType }}
                </td>
              </tr>
              <tr>
                <th>권장 소비자가</th>
                <td v-for="vehicle in selectedVehicles" :key="vehicle.id">
                  {{ formatStoredPriceRange(vehicle) }}
                </td>
              </tr>
              <tr v-if="hasSelectedFuelEconomy">
                <th>복합 연비</th>
                <td
                  v-for="vehicle in selectedVehicles"
                  :key="vehicle.id"
                  class="efficiency-value"
                >
                  <span class="efficiency-number">
                    {{ getEfficiencyPartsForCategory(vehicle, 'fuelEconomy').valueText }}
                  </span>
                  <span
                    v-if="getEfficiencyPartsForCategory(vehicle, 'fuelEconomy').basisText"
                    class="efficiency-basis"
                  >
                    ({{ getEfficiencyPartsForCategory(vehicle, 'fuelEconomy').basisText }})
                  </span>
                </td>
              </tr>
              <tr v-if="hasSelectedElectricEfficiency">
                <th>복합 전비</th>
                <td
                  v-for="vehicle in selectedVehicles"
                  :key="vehicle.id"
                  class="efficiency-value"
                >
                  <span class="efficiency-number">
                    {{
                      getEfficiencyPartsForCategory(vehicle, 'electricEfficiency')
                        .valueText
                    }}
                  </span>
                  <span
                    v-if="
                      getEfficiencyPartsForCategory(vehicle, 'electricEfficiency')
                        .basisText
                    "
                    class="efficiency-basis"
                  >
                    ({{
                      getEfficiencyPartsForCategory(vehicle, 'electricEfficiency')
                        .basisText
                    }})
                  </span>
                </td>
              </tr>
              <tr>
                <th>국내 판매 순위</th>
                <td v-for="vehicle in selectedVehicles" :key="vehicle.id">
                  {{
                    formatSalesRank(
                      vehicle.domesticSalesRank,
                      vehicle.domesticSalesVolume,
                    )
                  }}
                </td>
              </tr>
              <tr>
                <th>리콜 건수</th>
                <td v-for="vehicle in selectedVehicles" :key="vehicle.id">
                  {{ formatNullable(vehicle.recallCount, '건') }}
                </td>
              </tr>
              <tr v-if="isLoadingSpecs" class="spec-group-row">
                <th :colspan="selectedVehicles.length + 1">제원</th>
              </tr>
              <tr v-if="isLoadingSpecs">
                <th>상태</th>
                <td v-for="vehicle in selectedVehicles" :key="vehicle.id">
                  {{ getStoredSpecStatus(vehicle) }}
                </td>
              </tr>
              <template v-else-if="specComparisonGroups.length > 0">
                <template v-for="group in specComparisonGroups" :key="group.name">
                  <tr class="spec-group-row">
                    <th :colspan="selectedVehicles.length + 1">
                      제원 - {{ group.name }}
                    </th>
                  </tr>
                  <tr
                    v-for="rowName in group.rows"
                    :key="`comparison-${group.name}-${rowName}`"
                  >
                    <th>{{ rowName }}</th>
                    <td
                      v-for="{ vehicle, trim } in selectedSpecComparisons"
                      :key="`comparison-${vehicle.id}-${group.name}-${rowName}`"
                    >
                      {{ getSpecValue(trim, group.name, rowName) }}
                    </td>
                  </tr>
                </template>
              </template>
              <tr v-else-if="vehicleSpecsData">
                <th>제원</th>
                <td v-for="vehicle in selectedVehicles" :key="vehicle.id">
                  {{ getStoredSpecStatus(vehicle) }}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
