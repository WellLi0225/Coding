<script setup lang="ts">
import { computed, ref } from 'vue'
import { mockVehicles } from './data/mockVehicles'
import type { VehicleCompareItem } from './types/vehicle'

const search = ref('')
const selectedBrand = ref('All')
const selectedFuel = ref('All')
const selectedSort = ref('recommended')
const selectedIds = ref<string[]>([])

const sortOptions = [
  { value: 'recommended', label: '추천순' },
  { value: 'salesRank', label: '판매 순위 높은순' },
  { value: 'fuelEconomy', label: '연비 높은순' },
  { value: 'newest', label: '최신 연식순' },
  { value: 'modelName', label: '모델명 가나다순' },
] as const

const brands = computed(() =>
  Array.from(new Set(mockVehicles.map((vehicle) => vehicle.brand))).sort(),
)

const fuelTypes = computed(() =>
  Array.from(
    new Set(
      mockVehicles.flatMap((vehicle) =>
        vehicle.fuelType.split(',').map((fuelType) => fuelType.trim()),
      ),
    ),
  )
    .filter((fuelType) => fuelType && fuelType !== '정보 없음')
    .sort(),
)

const filteredVehicles = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  const vehicles = mockVehicles.filter((vehicle) => {
    const matchesKeyword =
      !keyword ||
      `${vehicle.brand} ${vehicle.model} ${vehicle.trim} ${vehicle.year} ${vehicle.modelYearLabel ?? ''}`
        .toLowerCase()
        .includes(keyword)
    const matchesBrand =
      selectedBrand.value === 'All' || vehicle.brand === selectedBrand.value
    const matchesFuel =
      selectedFuel.value === 'All' ||
      vehicle.fuelType
        .split(',')
        .map((fuelType) => fuelType.trim())
        .includes(selectedFuel.value)

    return matchesKeyword && matchesBrand && matchesFuel
  })

  return [...vehicles].sort((firstVehicle, secondVehicle) => {
    switch (selectedSort.value) {
      case 'salesRank':
        return compareNullableAsc(
          firstVehicle.domesticSalesRank,
          secondVehicle.domesticSalesRank,
        )
      case 'fuelEconomy':
        return compareNullableDesc(
          getDisplayedEfficiencyValue(firstVehicle),
          getDisplayedEfficiencyValue(secondVehicle),
        )
      case 'newest':
        return secondVehicle.year - firstVehicle.year
      case 'modelName':
        return (
          firstVehicle.model.localeCompare(secondVehicle.model, 'ko-KR', {
            numeric: true,
          }) ||
          firstVehicle.brand.localeCompare(
            secondVehicle.brand,
            'ko-KR',
            { numeric: true },
          )
        )
      default:
        return 0
    }
  })
})

const compareNullableAsc = (firstValue: number | null, secondValue: number | null) => {
  if (firstValue === null && secondValue === null) {
    return 0
  }

  if (firstValue === null) {
    return 1
  }

  if (secondValue === null) {
    return -1
  }

  return firstValue - secondValue
}

const compareNullableDesc = (
  firstValue: number | null,
  secondValue: number | null,
) => {
  if (firstValue === null && secondValue === null) {
    return 0
  }

  if (firstValue === null) {
    return 1
  }

  if (secondValue === null) {
    return -1
  }

  return secondValue - firstValue
}

const selectedVehicles = computed(() =>
  selectedIds.value
    .map((id) => mockVehicles.find((vehicle) => vehicle.id === id))
    .filter((vehicle): vehicle is VehicleCompareItem => Boolean(vehicle)),
)

const hasSelectedElectricEfficiency = computed(() =>
  selectedVehicles.value.some(
    (vehicle) => getDisplayedEfficiencyOption(vehicle)?.fuelType === '전기',
  ),
)

const hasSelectedFuelEconomy = computed(() =>
  selectedVehicles.value.some((vehicle) => {
    const option = getDisplayedEfficiencyOption(vehicle)

    return option !== null && option.fuelType !== '전기'
  }),
)

const toggleVehicle = (vehicleId: string) => {
  if (selectedIds.value.includes(vehicleId)) {
    selectedIds.value = selectedIds.value.filter((id) => id !== vehicleId)
    return
  }

  if (selectedIds.value.length < 3) {
    selectedIds.value = [...selectedIds.value, vehicleId]
  }
}

const formatCurrency = (value: number | null) => {
  if (value === null) {
    return '정보 없음'
  }

  return `${new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 0,
  }).format(value)}달러`
}

const formatNullable = (value: number | null, suffix = '') =>
  value === null ? '정보 없음' : `${value}${suffix}`

const formatEfficiency = (value: number | null, unit: string | null) =>
  value === null || unit === null ? '정보 없음' : `${value}${unit}`

const formatModelYear = (vehicle: VehicleCompareItem) =>
  vehicle.modelYearLabel ?? `${vehicle.year}년형`

const getHighestEfficiencyOption = (
  options: VehicleCompareItem['efficiencyOptions'],
) => [...options].sort((first, second) => second.value - first.value)[0] ?? null

const getDisplayedEfficiencyOption = (vehicle: VehicleCompareItem) => {
  const options = vehicle.efficiencyOptions ?? []

  if (selectedFuel.value !== 'All') {
    return (
      getHighestEfficiencyOption(
        options.filter((option) => option.fuelType === selectedFuel.value),
      ) ?? null
    )
  }

  return (
    getHighestEfficiencyOption(
      options.filter(
        (option) =>
          option.fuelType === '하이브리드' && option.drivetrain === '2WD',
      ),
    ) ??
    getHighestEfficiencyOption(
      options.filter((option) => option.drivetrain === '2WD'),
    ) ??
    getHighestEfficiencyOption(options)
  )
}

const getDisplayedEfficiencyValue = (vehicle: VehicleCompareItem) =>
  getDisplayedEfficiencyOption(vehicle)?.value ?? null

const getEfficiencyStatus = (vehicle: VehicleCompareItem) =>
  vehicle.efficiencyStatus ?? '정보 없음'

const getEfficiencyLabel = (vehicle: VehicleCompareItem) =>
  getDisplayedEfficiencyOption(vehicle)?.fuelType === '전기'
    ? '복합 전비'
    : '복합 연비'

const formatDisplayedEfficiency = (vehicle: VehicleCompareItem) => {
  const option = getDisplayedEfficiencyOption(vehicle)

  if (!option) {
    return getEfficiencyStatus(vehicle)
  }

  return formatEfficiency(option.value, option.unit)
}

const formatEfficiencyForCategory = (
  vehicle: VehicleCompareItem,
  category: 'fuelEconomy' | 'electricEfficiency',
) => {
  const option = getDisplayedEfficiencyOption(vehicle)

  if (!option) {
    return getEfficiencyStatus(vehicle)
  }

  const isElectric = option.fuelType === '전기'

  if (
    (category === 'electricEfficiency' && !isElectric) ||
    (category === 'fuelEconomy' && isElectric)
  ) {
    return '해당 없음'
  }

  return formatEfficiency(option.value, option.unit)
}

const formatSalesRank = (rank: number | null, volume: number | null) => {
  if (rank === null) {
    return '정보 없음'
  }

  const volumeText =
    volume === null
      ? ''
      : ` · ${new Intl.NumberFormat('ko-KR').format(volume)}대`

  return `${rank}위${volumeText}`
}
</script>

<template>
  <main class="page-shell">
    <header class="hero">
      <p>차량 비교 실험실</p>
      <h1>카컴페어랩</h1>
      <span>차량 모델 {{ mockVehicles.length }}대</span>
    </header>

    <section class="filters" aria-label="차량 필터">
      <label>
        검색
        <input
          v-model="search"
          type="search"
          placeholder="브랜드, 모델, 트림"
        />
      </label>

      <label>
        브랜드
        <select v-model="selectedBrand">
          <option value="All">전체</option>
          <option v-for="brand in brands" :key="brand" :value="brand">
            {{ brand }}
          </option>
        </select>
      </label>

      <label>
        연료
        <select v-model="selectedFuel">
          <option value="All">전체</option>
          <option v-for="fuelType in fuelTypes" :key="fuelType" :value="fuelType">
            {{ fuelType }}
          </option>
        </select>
      </label>

      <label>
        정렬 순서
        <select v-model="selectedSort">
          <option
            v-for="sortOption in sortOptions"
            :key="sortOption.value"
            :value="sortOption.value"
          >
            {{ sortOption.label }}
          </option>
        </select>
      </label>
    </section>

    <section class="layout">
      <div class="vehicle-list" aria-label="목 차량 목록">
        <article
          v-for="vehicle in filteredVehicles"
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
              <dd>
                {{ formatDisplayedEfficiency(vehicle) }}
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
            <small>
              {{ vehicle.sourceName }} 기준일 {{ vehicle.sourceCheckedAt }}
            </small>
            <button type="button" @click="toggleVehicle(vehicle.id)">
              {{ selectedIds.includes(vehicle.id) ? '비교 해제' : '비교하기' }}
            </button>
          </footer>
        </article>
      </div>

      <aside class="compare-panel" aria-label="선택한 차량">
        <div>
          <p>선택한 차량</p>
          <h2>{{ selectedVehicles.length }}/3</h2>
        </div>

        <p v-if="selectedVehicles.length === 0" class="empty">
          비교할 차량을 최대 3대까지 선택하세요.
        </p>

        <ul v-else>
          <li v-for="vehicle in selectedVehicles" :key="vehicle.id">
            {{ vehicle.brand }} {{ vehicle.model }}
          </li>
        </ul>
      </aside>
    </section>

    <section class="comparison" aria-label="비교표">
      <h2>비교표</h2>

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
              {{ vehicle.trim }}
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
              {{ formatCurrency(vehicle.msrpUsd) }}
            </td>
          </tr>
          <tr v-if="hasSelectedFuelEconomy">
            <th>복합 연비</th>
            <td v-for="vehicle in selectedVehicles" :key="vehicle.id">
              {{ formatEfficiencyForCategory(vehicle, 'fuelEconomy') }}
            </td>
          </tr>
          <tr v-if="hasSelectedElectricEfficiency">
            <th>복합 전비</th>
            <td v-for="vehicle in selectedVehicles" :key="vehicle.id">
              {{ formatEfficiencyForCategory(vehicle, 'electricEfficiency') }}
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
        </tbody>
      </table>
    </section>
  </main>
</template>

<style scoped>
:global(*) {
  box-sizing: border-box;
}

:global(body) {
  min-width: 320px;
  margin: 0;
  color: #18211d;
  background: #f5f7f3;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;
}

button,
input,
select {
  font: inherit;
}

.page-shell {
  width: min(1280px, calc(100% - 32px));
  margin: 0 auto;
  padding: 28px 0 56px;
}

.hero {
  display: grid;
  gap: 12px;
  min-height: 240px;
  align-content: end;
  padding: 28px;
  border-radius: 8px;
  color: #ffffff;
  background:
    linear-gradient(90deg, rgba(14, 23, 19, 0.92), rgba(14, 23, 19, 0.42)),
    url("https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1800&q=80")
      center / cover;
}

.hero p,
.compare-panel p {
  margin: 0;
  color: #d4f26a;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.hero h1 {
  margin: 0;
  font-size: clamp(44px, 7vw, 86px);
  line-height: 0.95;
}

.hero span {
  color: #e8eee9;
  font-weight: 700;
}

.filters,
.compare-panel,
.comparison,
.vehicle-card {
  border: 1px solid #dbe4d7;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: rgba(32, 46, 39, 0.08) 0 12px 28px;
}

.filters {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) 180px 180px 200px;
  gap: 12px;
  margin: 18px 0;
  padding: 16px;
}

label {
  display: grid;
  gap: 7px;
  color: #58655d;
  font-size: 13px;
  font-weight: 800;
}

input,
select {
  min-height: 42px;
  border: 1px solid #cbd8c6;
  border-radius: 6px;
  color: #18211d;
  background: #fbfdf9;
  outline: none;
}

input {
  padding: 0 13px;
}

select {
  padding: 0 12px;
}

input:focus,
select:focus {
  border-color: #176b52;
  box-shadow: 0 0 0 3px rgba(23, 107, 82, 0.14);
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 18px;
  align-items: start;
}

.vehicle-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}

.vehicle-card {
  display: grid;
  gap: 16px;
  padding: 16px;
}

.vehicle-card.selected {
  border-color: #176b52;
  box-shadow:
    rgba(23, 107, 82, 0.16) 0 14px 30px,
    inset 0 0 0 2px #176b52;
}

.vehicle-card p,
.vehicle-card h2,
.vehicle-card dl,
.comparison h2,
.compare-panel h2 {
  margin: 0;
}

.vehicle-card p {
  color: #176b52;
  font-size: 13px;
  font-weight: 800;
}

.vehicle-card h2,
.comparison h2,
.compare-panel h2 {
  font-size: 24px;
  line-height: 1.1;
}

.vehicle-card span {
  display: block;
  margin-top: 6px;
  color: #657269;
}

.vehicle-card dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.vehicle-card dl div {
  min-width: 0;
  padding: 10px;
  border-radius: 8px;
  background: #f2f7ef;
}

dt {
  color: #66736a;
  font-size: 12px;
}

dd {
  margin: 3px 0 0;
  font-weight: 800;
}

.vehicle-card footer {
  display: grid;
  gap: 10px;
}

small,
.empty {
  color: #66736a;
  line-height: 1.45;
}

button {
  min-height: 42px;
  border: 0;
  border-radius: 6px;
  color: #ffffff;
  background: #176b52;
  font-weight: 800;
  cursor: pointer;
}

.compare-panel {
  position: sticky;
  top: 16px;
  display: grid;
  gap: 14px;
  padding: 18px;
}

.compare-panel ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.compare-panel li {
  padding: 10px;
  border-radius: 6px;
  background: #edf4e8;
  font-weight: 800;
}

.comparison {
  margin-top: 18px;
  padding: 18px;
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 680px;
  margin-top: 14px;
  border-collapse: collapse;
}

th,
td {
  padding: 13px;
  border-bottom: 1px solid #e2e9de;
  text-align: left;
}

th {
  color: #40523c;
  font-size: 13px;
}

td {
  font-weight: 700;
}

@media (max-width: 860px) {
  .filters,
  .layout {
    grid-template-columns: 1fr;
  }

  .compare-panel {
    position: static;
  }
}
</style>
