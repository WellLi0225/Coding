<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { mockVehicles } from './data/mockVehicles'
import type { VehicleCompareItem } from './types/vehicle'
import type { VehicleSpecItem, VehicleSpecTrim } from './types/vehicleSpec'

const search = ref('')
const selectedBrand = ref('All')
const selectedFuel = ref('All')
const selectedSort = ref('recommended')
const selectedIds = ref<string[]>([])
const currentPage = ref(1)
const showSpecComparison = ref(false)
const isLoadingSpecs = ref(false)
const specLoadError = ref<string | null>(null)
const vehicleSpecsData = ref<VehicleSpecItem[] | null>(null)
const selectedSpecTrimNames = ref<Record<string, string>>({})

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

const vehiclesPerPage = 6

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredVehicles.value.length / vehiclesPerPage)),
)

const paginatedVehicles = computed(() => {
  const startIndex = (currentPage.value - 1) * vehiclesPerPage

  return filteredVehicles.value.slice(startIndex, startIndex + vehiclesPerPage)
})

const visibleStartNumber = computed(() =>
  filteredVehicles.value.length === 0
    ? 0
    : (currentPage.value - 1) * vehiclesPerPage + 1,
)

const visibleEndNumber = computed(() =>
  Math.min(currentPage.value * vehiclesPerPage, filteredVehicles.value.length),
)

const goToPage = (page: number) => {
  currentPage.value = Math.min(Math.max(page, 1), totalPages.value)
}

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

const selectedSpecComparisons = computed(() =>
  selectedVehicles.value.map((vehicle) => {
    const spec = getStoredVehicleSpec(vehicle)

    return {
      vehicle,
      spec,
      trim: getSelectedSpecTrim(vehicle.id, spec),
    }
  }),
)

const specComparisonGroups = computed(() => {
  const groups: { name: string; rows: string[] }[] = []
  const rowNamesByGroup = new Map<string, Set<string>>()

  selectedSpecComparisons.value.forEach(({ trim }) => {
    Object.entries(trim?.specs ?? {}).forEach(([groupName, rows]) => {
      if (!rowNamesByGroup.has(groupName)) {
        rowNamesByGroup.set(groupName, new Set())
        groups.push({ name: groupName, rows: [] })
      }

      const rowNames = rowNamesByGroup.get(groupName)

      Object.keys(rows).forEach((rowName) => {
        if (!rowNames?.has(rowName)) {
          rowNames?.add(rowName)
          groups.find((group) => group.name === groupName)?.rows.push(rowName)
        }
      })
    })
  })

  return groups
})

const hasSelectedElectricEfficiency = computed(() =>
  selectedVehicles.value.some(
    (vehicle) => getDisplayedEfficiencyOption(vehicle)?.fuelType === '전기',
  ),
)

const hasSelectedFuelEconomy = computed(() =>
  selectedVehicles.value.some((vehicle) => {
    const option = getDisplayedEfficiencyOption(vehicle)

    return (
      (option !== null && option.fuelType !== '전기') ||
      (option === null && hasHybridFuel(vehicle))
    )
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

const loadVehicleSpecs = async () => {
  if (vehicleSpecsData.value || isLoadingSpecs.value) {
    return
  }

  try {
    isLoadingSpecs.value = true
    specLoadError.value = null

    const module = await import('./data/vehicleSpecs')
    vehicleSpecsData.value = module.vehicleSpecs
  } catch {
    specLoadError.value = '제원 데이터를 불러오지 못했습니다.'
  } finally {
    isLoadingSpecs.value = false
  }
}

const openSpecComparison = async () => {
  if (selectedVehicles.value.length < 2) {
    return
  }

  showSpecComparison.value = true
  await loadVehicleSpecs()
  ensureSpecTrimSelections()
  await nextTick()
}

const closeSpecComparison = () => {
  showSpecComparison.value = false
}

const ensureSpecTrimSelections = () => {
  const nextTrimNames: Record<string, string> = {}

  selectedVehicles.value.forEach((vehicle) => {
    const spec = vehicleSpecsData.value?.find(
      (item) => item.vehicleId === vehicle.id,
    )
    const currentTrimName = selectedSpecTrimNames.value[vehicle.id]
    const hasCurrentTrim = spec?.trims.some(
      (trim) => trim.trimName === currentTrimName,
    )

    if (hasCurrentTrim && currentTrimName) {
      nextTrimNames[vehicle.id] = currentTrimName
      return
    }

    if (spec?.trims[0]) {
      nextTrimNames[vehicle.id] = spec.trims[0].trimName
    }
  })

  selectedSpecTrimNames.value = nextTrimNames
}

const setSelectedSpecTrim = (vehicleId: string, trimName: string) => {
  selectedSpecTrimNames.value = {
    ...selectedSpecTrimNames.value,
    [vehicleId]: trimName,
  }
}

const getSelectedSpecTrim = (
  vehicleId: string,
  spec: VehicleSpecItem | undefined,
) =>
  spec?.trims.find(
    (trim) => trim.trimName === selectedSpecTrimNames.value[vehicleId],
  ) ??
  spec?.trims[0] ??
  null

const getSpecValue = (
  trim: VehicleSpecTrim | null,
  groupName: string,
  rowName: string,
) => trim?.specs[groupName]?.[rowName] ?? '정보 없음'

const getStoredVehicleSpec = (vehicle: VehicleCompareItem) =>
  vehicleSpecsData.value?.find((item) => item.vehicleId === vehicle.id)

const getStoredSpecStatus = (vehicle: VehicleCompareItem) => {
  if (!vehicleSpecsData.value) {
    return '제원 데이터 불러오는 중'
  }

  const spec = getStoredVehicleSpec(vehicle)

  return spec?.status ?? '제원 데이터 없음'
}

const normalizeTrimName = (trimName: string) =>
  trimName
    .replace(/\s*\(\d+인승\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const splitTrimName = (trimName: string) => {
  const normalizedTrimName = normalizeTrimName(trimName)
  const transmissionMatch = normalizedTrimName.match(/\(([^)]*)\)\s*$/)
  const transmission = transmissionMatch?.[1] ?? null
  const withoutTransmission = transmissionMatch
    ? normalizedTrimName.slice(0, transmissionMatch.index).trim()
    : normalizedTrimName
  const drivetrainMatch = withoutTransmission.match(/\b(2WD|4WD)\b/i)
  const drivetrain = drivetrainMatch?.[1]?.toUpperCase() ?? null
  const baseName = withoutTransmission
    .replace(/\b(2WD|4WD)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    baseName,
    drivetrain,
    transmission,
    fallbackName: normalizedTrimName,
  }
}

const formatGroupedTrimName = (
  baseName: string,
  transmissions: Set<string>,
  drivetrains: Set<string>,
  fallbackName: string,
) => {
  const hasTwoWheelDrive = drivetrains.has('2WD')
  const hasFourWheelDrive = drivetrains.has('4WD')
  const transmissionLabel =
    transmissions.size === 1 ? [...transmissions][0] : null

  if (hasTwoWheelDrive && hasFourWheelDrive) {
    const detailLabels = ['4WD 포함']

    if (transmissionLabel) {
      detailLabels.push(transmissionLabel)
    }

    return `${baseName} (${detailLabels.join(', ')})`
  }

  if (baseName && transmissionLabel && drivetrains.size === 0) {
    return `${baseName} (${transmissionLabel})`
  }

  return fallbackName
}

const getDisplayTrimNames = (trimNames: string[]) => {
  const groups = new Map<
    string,
    {
      baseName: string
      transmissions: Set<string>
      drivetrains: Set<string>
      fallbackName: string
    }
  >()

  trimNames.forEach((trimName) => {
    const parsedTrim = splitTrimName(trimName)
    const key = `${parsedTrim.baseName}|${parsedTrim.transmission ?? ''}`

    if (!groups.has(key)) {
      groups.set(key, {
        baseName: parsedTrim.baseName,
        transmissions: new Set(),
        drivetrains: new Set(),
        fallbackName: parsedTrim.fallbackName,
      })
    }

    const group = groups.get(key)

    if (!group) {
      return
    }

    if (parsedTrim.transmission) {
      group.transmissions.add(parsedTrim.transmission)
    }

    if (parsedTrim.drivetrain) {
      group.drivetrains.add(parsedTrim.drivetrain)
    }
  })

  return Array.from(
    new Set(
      [...groups.values()].map((group) =>
        formatGroupedTrimName(
          group.baseName,
          group.transmissions,
          group.drivetrains,
          group.fallbackName,
        ),
      ),
    ),
  )
}

const getComparisonTrimNames = (vehicle: VehicleCompareItem) => {
  if (!vehicleSpecsData.value) {
    return ['제원 데이터 불러오는 중']
  }

  const spec = getStoredVehicleSpec(vehicle)

  if (!spec) {
    return ['제원 데이터 없음']
  }

  if (spec.trims.length === 0) {
    return [spec.status ?? '트림 데이터 없음']
  }

  return getDisplayTrimNames(spec.trims.map((trim) => trim.trimName))
}

const getSpecTrimOptions = (spec: VehicleSpecItem) => {
  const groups = new Map<
    string,
    {
      value: string
      baseName: string
      transmissions: Set<string>
      drivetrains: Set<string>
      fallbackName: string
    }
  >()

  spec.trims.forEach((trim) => {
    const parsedTrim = splitTrimName(trim.trimName)
    const key = `${parsedTrim.baseName}|${parsedTrim.transmission ?? ''}`

    if (!groups.has(key)) {
      groups.set(key, {
        value: trim.trimName,
        baseName: parsedTrim.baseName,
        transmissions: new Set(),
        drivetrains: new Set(),
        fallbackName: parsedTrim.fallbackName,
      })
    }

    const group = groups.get(key)

    if (!group) {
      return
    }

    if (parsedTrim.transmission) {
      group.transmissions.add(parsedTrim.transmission)
    }

    if (parsedTrim.drivetrain) {
      group.drivetrains.add(parsedTrim.drivetrain)
    }
  })

  return [...groups.values()].map((group) => ({
    value: group.value,
    label: formatGroupedTrimName(
      group.baseName,
      group.transmissions,
      group.drivetrains,
      group.fallbackName,
    ),
  }))
}

const parseTrimPrice = (price: string | null) => {
  if (!price) {
    return null
  }

  const value = Number(price.replace(/[^\d]/g, ''))

  return Number.isFinite(value) && value > 0 ? value : null
}

const formatWon = (value: number) => {
  if (value >= 10000) {
    return `${new Intl.NumberFormat('ko-KR').format(value / 10000)}만원`
  }

  return `${new Intl.NumberFormat('ko-KR').format(value)}원`
}

const formatStoredPriceRange = (vehicle: VehicleCompareItem) => {
  if (!vehicleSpecsData.value) {
    return '제원 데이터 불러오는 중'
  }

  const spec = getStoredVehicleSpec(vehicle)
  const prices =
    spec?.trims
      .map((trim) => parseTrimPrice(trim.price))
      .filter((price): price is number => price !== null) ?? []

  if (prices.length === 0) {
    return '가격 정보 없음'
  }

  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)

  if (minPrice === maxPrice) {
    return formatWon(minPrice)
  }

  return `${formatWon(minPrice)} ~ ${formatWon(maxPrice)}`
}

watch(selectedVehicles, () => {
  ensureSpecTrimSelections()

  if (selectedVehicles.value.length < 2) {
    showSpecComparison.value = false
    return
  }

  void loadVehicleSpecs().then(() => {
    ensureSpecTrimSelections()
  })
})

watch([search, selectedBrand, selectedFuel, selectedSort], () => {
  currentPage.value = 1
})

watch(totalPages, () => {
  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value
  }
})

watch(vehicleSpecsData, () => {
  if (selectedVehicles.value.length >= 2) {
    ensureSpecTrimSelections()
  }
})

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

const getEfficiencyBasisLabel = (
  option: VehicleCompareItem['efficiencyOptions'][number] | null,
) => {
  if (!option) {
    return null
  }

  return `${option.fuelType} 기준`
}

const formatModelYear = (vehicle: VehicleCompareItem) =>
  vehicle.modelYearLabel ?? `${vehicle.year}년형`

const getHighestEfficiencyOption = (
  options: VehicleCompareItem['efficiencyOptions'],
) => [...options].sort((first, second) => second.value - first.value)[0] ?? null

const hasHybridFuel = (vehicle: VehicleCompareItem) =>
  vehicle.fuelType.split(',').some((fuelType) => fuelType.trim() === '하이브리드')

const isHybridEfficiencyOption = (
  option: VehicleCompareItem['efficiencyOptions'][number],
) => option.fuelType === '하이브리드'

const getDisplayedEfficiencyOption = (vehicle: VehicleCompareItem) => {
  const options = vehicle.efficiencyOptions ?? []

  if (selectedFuel.value !== 'All') {
    return (
      getHighestEfficiencyOption(
        options.filter((option) => option.fuelType === selectedFuel.value),
      ) ?? null
    )
  }

  const hybridOption = getHighestEfficiencyOption(
    options.filter(isHybridEfficiencyOption),
  )

  if (hybridOption) {
    return hybridOption
  }

  return (
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

const getMissingEfficiencyBasisLabel = (vehicle: VehicleCompareItem) => {
  if (selectedFuel.value !== 'All') {
    return `${selectedFuel.value} 기준`
  }

  if (hasHybridFuel(vehicle)) {
    return '하이브리드 기준'
  }

  return null
}

const formatDisplayedEfficiency = (vehicle: VehicleCompareItem) => {
  const option = getDisplayedEfficiencyOption(vehicle)

  if (!option) {
    const basisLabel = getMissingEfficiencyBasisLabel(vehicle)
    const status = getEfficiencyStatus(vehicle)

    return basisLabel ? `${status}\n(${basisLabel})` : status
  }

  const basisLabel = getEfficiencyBasisLabel(option)
  const efficiency = formatEfficiency(option.value, option.unit)

  return basisLabel ? `${efficiency}\n(${basisLabel})` : efficiency
}

const formatEfficiencyForCategory = (
  vehicle: VehicleCompareItem,
  category: 'fuelEconomy' | 'electricEfficiency',
) => {
  const option = getDisplayedEfficiencyOption(vehicle)

  if (!option) {
    const basisLabel = getMissingEfficiencyBasisLabel(vehicle)
    const status = getEfficiencyStatus(vehicle)

    return basisLabel ? `${status}\n(${basisLabel})` : status
  }

  const isElectric = option.fuelType === '전기'

  if (
    (category === 'electricEfficiency' && !isElectric) ||
    (category === 'fuelEconomy' && isElectric)
  ) {
    return '해당 없음'
  }

  const basisLabel = getEfficiencyBasisLabel(option)
  const efficiency = formatEfficiency(option.value, option.unit)

  return basisLabel ? `${efficiency}\n(${basisLabel})` : efficiency
}

const getDisplayedEfficiencyParts = (vehicle: VehicleCompareItem) => {
  const option = getDisplayedEfficiencyOption(vehicle)

  if (!option) {
    return {
      valueText: getEfficiencyStatus(vehicle),
      basisText: getMissingEfficiencyBasisLabel(vehicle),
    }
  }

  return {
    valueText: formatEfficiency(option.value, option.unit),
    basisText: getEfficiencyBasisLabel(option),
  }
}

const getEfficiencyPartsForCategory = (
  vehicle: VehicleCompareItem,
  category: 'fuelEconomy' | 'electricEfficiency',
) => {
  const option = getDisplayedEfficiencyOption(vehicle)

  if (!option) {
    return {
      valueText: getEfficiencyStatus(vehicle),
      basisText: getMissingEfficiencyBasisLabel(vehicle),
    }
  }

  const isElectric = option.fuelType === '전기'

  if (
    (category === 'electricEfficiency' && !isElectric) ||
    (category === 'fuelEconomy' && isElectric)
  ) {
    return {
      valueText: '해당 없음',
      basisText: null,
    }
  }

  return {
    valueText: formatEfficiency(option.value, option.unit),
    basisText: getEfficiencyBasisLabel(option),
  }
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
      <div class="results-column">
        <div class="results-summary" aria-live="polite">
          <span>
            {{ visibleStartNumber }}-{{ visibleEndNumber }} / {{ filteredVehicles.length }}대
          </span>
          <span>{{ currentPage }} / {{ totalPages }}페이지</span>
        </div>

        <div class="vehicle-list" aria-label="목 차량 목록">
          <article
            v-for="vehicle in paginatedVehicles"
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
            <small>
              {{ vehicle.sourceName }} 기준일 {{ vehicle.sourceCheckedAt }}
            </small>
            <button type="button" @click="toggleVehicle(vehicle.id)">
              {{ selectedIds.includes(vehicle.id) ? '비교 해제' : '비교하기' }}
            </button>
          </footer>
          </article>
        </div>

        <p v-if="filteredVehicles.length === 0" class="empty results-empty">
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
            @click="goToPage(currentPage - 1)"
          >
            이전
          </button>
          <span>{{ currentPage }} / {{ totalPages }}</span>
          <button
            type="button"
            :disabled="currentPage === totalPages"
            @click="goToPage(currentPage + 1)"
          >
            다음
          </button>
        </nav>
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

        <button
          v-if="selectedVehicles.length >= 2"
          type="button"
          class="spec-compare-button"
          :disabled="isLoadingSpecs"
          @click="openSpecComparison"
        >
          {{ isLoadingSpecs ? '제원 불러오는 중' : '선택한 차량 비교하기' }}
        </button>
      </aside>
    </section>

    <Teleport to="body">
      <Transition name="modal-fade">
        <div
          v-if="showSpecComparison"
          class="comparison-modal"
          role="dialog"
          aria-modal="true"
          aria-label="선택 차량 비교표"
          @click.self="closeSpecComparison"
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
              @click="closeSpecComparison"
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
.spec-comparison,
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

.results-column {
  display: grid;
  gap: 12px;
}

.results-summary,
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #58655d;
  font-size: 13px;
  font-weight: 800;
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
.spec-comparison h2,
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
.spec-comparison h2,
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

button:disabled {
  cursor: wait;
  opacity: 0.72;
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

.spec-compare-button {
  width: 100%;
}

.comparison-modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  align-items: start;
  justify-items: center;
  padding: 32px 18px;
  background: rgba(11, 20, 16, 0.62);
  overflow-y: auto;
  backdrop-filter: blur(2px);
}

.comparison-dialog {
  width: min(1120px, 100%);
  max-height: calc(100vh - 64px);
  margin: 0;
  overflow: auto;
  transform-origin: top center;
  will-change: opacity, transform;
}

.modal-fade-enter-active {
  transition:
    opacity 320ms cubic-bezier(0.16, 1, 0.3, 1),
    backdrop-filter 320ms cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-fade-leave-active {
  transition:
    opacity 180ms ease-in,
    backdrop-filter 180ms ease-in;
}

.modal-fade-enter-active .comparison-dialog {
  transition:
    opacity 340ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 340ms cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-fade-leave-active .comparison-dialog {
  transition:
    opacity 180ms ease-in,
    transform 180ms ease-in;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  backdrop-filter: blur(0);
}

.modal-fade-enter-from .comparison-dialog,
.modal-fade-leave-to .comparison-dialog {
  opacity: 0;
  transform: translateY(28px) scale(0.965);
}

.modal-fade-enter-to .comparison-dialog,
.modal-fade-leave-from .comparison-dialog {
  opacity: 1;
  transform: translateY(0) scale(1);
}

@media (prefers-reduced-motion: reduce) {
  .modal-fade-enter-active,
  .modal-fade-leave-active,
  .modal-fade-enter-active .comparison-dialog,
  .modal-fade-leave-active .comparison-dialog {
    transition: none;
  }
}

.comparison-dialog-header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: -18px -18px 14px;
  padding: 18px;
  border-bottom: 1px solid #e2e9de;
  background: #ffffff;
}

.comparison-dialog-header p,
.comparison-dialog-header h2 {
  margin: 0;
}

.comparison-dialog-header p {
  color: #176b52;
  font-size: 12px;
  font-weight: 800;
}

.modal-close-button {
  min-width: 76px;
  padding: 0 16px;
  color: #176b52;
  border: 1px solid #cbd8c6;
  background: #f7fbf4;
}

.results-empty {
  margin: 0;
}

.pagination {
  justify-content: center;
}

.pagination button {
  min-width: 82px;
}

.pagination span {
  min-width: 88px;
  text-align: center;
}

.comparison,
.spec-comparison {
  margin-top: 18px;
  padding: 18px;
  overflow-x: auto;
}

.section-heading {
  display: grid;
  gap: 5px;
}

.section-heading p {
  margin: 0;
  color: #176b52;
  font-size: 12px;
  font-weight: 800;
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

.comparison-value-line {
  display: block;
  line-height: 1.45;
}

.efficiency-value {
  word-break: keep-all;
}

.efficiency-number,
.efficiency-basis {
  display: block;
  line-height: 1.35;
  white-space: nowrap;
}

.efficiency-basis {
  font-size: 0.95em;
}

.comparison-value-line + .comparison-value-line {
  margin-top: 4px;
}

.spec-comparison table {
  min-width: 860px;
}

.spec-comparison thead th {
  vertical-align: top;
}

.spec-vehicle-name,
.spec-status {
  display: block;
}

.spec-vehicle-name {
  margin-bottom: 8px;
  font-size: 14px;
}

.spec-status {
  color: #66736a;
  font-weight: 700;
}

.spec-comparison select {
  width: 100%;
  min-width: 190px;
}

.spec-group-row th {
  color: #176b52;
  background: #edf4e8;
  font-size: 14px;
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
