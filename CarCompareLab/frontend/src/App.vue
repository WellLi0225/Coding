<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import CompareTray from './components/CompareTray.vue'
import VehicleCardList from './components/VehicleCardList.vue'
import VehicleCompareTable from './components/VehicleCompareTable.vue'
import VehicleFilterBar from './components/VehicleFilterBar.vue'
import { MAX_COMPARE_COUNT, useCompareTray } from './composables/useCompareTray'
import {
  priceRangeOptions,
  sortOptions,
  useVehicleFilters,
} from './composables/useVehicleFilters'
import { mockVehicles } from './data/mockVehicles'
import { vehicleActualSideImages } from './data/vehicleActualSideImages'
import { vehicleSizeImages } from './data/vehicleSizeImages'
import type { VehicleCompareItem } from './types/vehicle'
import type { VehicleSizeImageAsset } from './types/vehicleSizeImage'
import type { VehicleSpecItem, VehicleSpecTrim } from './types/vehicleSpec'
import {
  formatCurrency,
  formatNullable,
  formatWon,
} from './utils/vehicleFormatters'

const {
  search,
  selectedBrand,
  selectedYear,
  selectedFuel,
  selectedPriceRange,
  selectedSort,
} = useVehicleFilters()

const currentPage = ref(1)
const vehicles = ref<VehicleCompareItem[]>(mockVehicles)
const { selectedIds, selectedVehicles, toggleVehicle } = useCompareTray(vehicles)
const isLoadingVehicles = ref(false)
const vehicleLoadError = ref<string | null>(null)
const showSpecComparison = ref(false)
const isLoadingSpecs = ref(false)
const specLoadError = ref<string | null>(null)
const vehicleSpecsData = ref<VehicleSpecItem[] | null>(null)
const selectedSpecTrimNames = ref<Record<string, string>>({})

type MainTab = 'home' | 'search' | 'compare' | 'news'

type VehicleListApiResponse = {
  items: VehicleCompareItem[]
}

type VehicleCompareApiResponse = {
  vehicleSpecs?: VehicleSpecItem[]
}

const activeMainTab = ref<MainTab>('home')
const showVehicleWorkspace = computed(() => activeMainTab.value === 'search')
const sizeCompareFirstId = ref(mockVehicles[0]?.id ?? '')
const sizeCompareSecondId = ref(mockVehicles[1]?.id ?? '')

type SizeComparisonItem = {
  vehicle: VehicleCompareItem
  image: VehicleSizeImageAsset | undefined
}

const vehicleSizeImageById = computed(() => {
  const imageMap = new Map(vehicleSizeImages.map((image) => [image.vehicleId, image]))

  Object.entries(vehicleActualSideImages).forEach(([vehicleId, actualImage]) => {
    const baseImage = imageMap.get(vehicleId)

    if (!baseImage) {
      return
    }

    imageMap.set(vehicleId, {
      ...baseImage,
      ...actualImage,
      vehicleId,
      brand: baseImage.brand,
      model: baseImage.model,
      view: 'side',
      lengthMm: baseImage.lengthMm,
      widthMm: baseImage.widthMm,
      heightMm: baseImage.heightMm,
      wheelbaseMm: baseImage.wheelbaseMm,
    })
  })

  return imageMap
})

const sizeCompareOptions = computed(() =>
  vehicles.value.map((vehicle) => ({
    vehicle,
    image: vehicleSizeImageById.value.get(vehicle.id),
  })),
)

const getSizeComparisonItem = (
  vehicleId: string,
): SizeComparisonItem | null => {
  const vehicle = vehicles.value.find((item) => item.id === vehicleId)

  if (!vehicle) {
    return null
  }

  return {
    vehicle,
    image: vehicleSizeImageById.value.get(vehicle.id),
  }
}

const firstSizeComparison = computed(() =>
  getSizeComparisonItem(sizeCompareFirstId.value),
)

const secondSizeComparison = computed(() =>
  getSizeComparisonItem(sizeCompareSecondId.value),
)

const sizeComparisonItems = computed(() =>
  [firstSizeComparison.value, secondSizeComparison.value].filter(
    (item): item is SizeComparisonItem => item !== null,
  ),
)

const largestSizeComparisonLength = computed(() =>
  Math.max(
    ...sizeComparisonItems.value.map(({ image }) => image?.lengthMm ?? 4500),
    1,
  ),
)

const getSizeComparisonLayerStyle = (image: VehicleSizeImageAsset | undefined) => {
  const lengthMm = image?.lengthMm ?? 4500
  const widthPercent = Math.min(
    84,
    Math.max(34, (lengthMm / largestSizeComparisonLength.value) * 76),
  )

  return {
    width: `${widthPercent}%`,
  }
}

const brands = computed(() =>
  Array.from(new Set(vehicles.value.map((vehicle) => vehicle.brand))).sort(),
)

const years = computed(() =>
  Array.from(new Set(vehicles.value.map((vehicle) => vehicle.year))).sort(
    (firstYear, secondYear) => secondYear - firstYear,
  ),
)

const fuelTypes = computed(() =>
  Array.from(
    new Set(
      vehicles.value.flatMap((vehicle) =>
        vehicle.fuelType.split(',').map((fuelType) => fuelType.trim()),
      ),
    ),
  )
    .filter((fuelType) => fuelType && fuelType !== '정보 없음')
    .sort(),
)

const filteredVehicles = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  const filteredItems = vehicles.value.filter((vehicle) => {
    const matchesKeyword =
      !keyword ||
      `${vehicle.brand} ${vehicle.model} ${vehicle.trim} ${vehicle.year} ${vehicle.modelYearLabel ?? ''}`
        .toLowerCase()
        .includes(keyword)
    const matchesBrand =
      selectedBrand.value === 'All' || vehicle.brand === selectedBrand.value
    const matchesYear =
      selectedYear.value === 'All' || vehicle.year === Number(selectedYear.value)
    const matchesFuel =
      selectedFuel.value === 'All' ||
      vehicle.fuelType
        .split(',')
        .map((fuelType) => fuelType.trim())
        .includes(selectedFuel.value)
    const matchesPrice = matchesVehiclePriceRange(vehicle)

    return matchesKeyword && matchesBrand && matchesYear && matchesFuel && matchesPrice
  })

  return [...filteredItems].sort((firstVehicle, secondVehicle) => {
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

const loadVehicles = async () => {
  try {
    isLoadingVehicles.value = true
    vehicleLoadError.value = null

    const response = await fetch('/api/vehicles?pageSize=1000')

    if (!response.ok) {
      throw new Error(`Vehicle API returned ${response.status}`)
    }

    const data = (await response.json()) as VehicleListApiResponse
    vehicles.value = data.items
  } catch {
    vehicles.value = mockVehicles
    vehicleLoadError.value =
      '백엔드 API를 불러오지 못해 임시 데이터를 표시하고 있습니다.'
  } finally {
    isLoadingVehicles.value = false
  }
}

onMounted(() => {
  void loadVehicles()
})

watch(
  vehicles,
  (nextVehicles) => {
    if (nextVehicles.length === 0) {
      sizeCompareFirstId.value = ''
      sizeCompareSecondId.value = ''
      return
    }

    const vehicleIds = new Set(nextVehicles.map((vehicle) => vehicle.id))

    if (!vehicleIds.has(sizeCompareFirstId.value)) {
      sizeCompareFirstId.value = nextVehicles[0]?.id ?? ''
    }

    if (
      !vehicleIds.has(sizeCompareSecondId.value) ||
      sizeCompareSecondId.value === sizeCompareFirstId.value
    ) {
      sizeCompareSecondId.value =
        nextVehicles.find((vehicle) => vehicle.id !== sizeCompareFirstId.value)?.id ??
        sizeCompareFirstId.value
    }
  },
  { immediate: true },
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

const loadVehicleSpecs = async () => {
  const currentSpecs = vehicleSpecsData.value ?? []
  const hasSelectedSpecs = selectedIds.value.every((vehicleId) =>
    currentSpecs.some((spec) => spec.vehicleId === vehicleId),
  )

  if ((vehicleSpecsData.value && hasSelectedSpecs) || isLoadingSpecs.value) {
    return
  }

  try {
    isLoadingSpecs.value = true
    specLoadError.value = null

    const response = await fetch(
      `/api/vehicles/compare?ids=${selectedIds.value
        .map((vehicleId) => encodeURIComponent(vehicleId))
        .join(',')}`,
    )

    if (!response.ok) {
      throw new Error(`Compare API returned ${response.status}`)
    }

    const data = (await response.json()) as VehicleCompareApiResponse

    if (!data.vehicleSpecs) {
      throw new Error('Compare API response has no vehicleSpecs')
    }

    const nextSpecsById = new Map(
      [...currentSpecs, ...data.vehicleSpecs].map((spec) => [
        spec.vehicleId,
        spec,
      ]),
    )
    vehicleSpecsData.value = Array.from(nextSpecsById.values())
  } catch {
    const module = await import('./data/vehicleSpecs')
    vehicleSpecsData.value = module.vehicleSpecs
    specLoadError.value =
      '백엔드 비교 API를 불러오지 못해 저장된 제원 데이터를 표시하고 있습니다.'
  } finally {
    isLoadingSpecs.value = false
  }
}

const loadAllVehicleSpecs = async () => {
  if (vehicleSpecsData.value && vehicleSpecsData.value.length >= vehicles.value.length) {
    return
  }

  try {
    isLoadingSpecs.value = true
    specLoadError.value = null

    const module = await import('./data/vehicleSpecs')
    const currentSpecs = vehicleSpecsData.value ?? []
    const nextSpecsById = new Map(
      [...currentSpecs, ...module.vehicleSpecs].map((spec) => [
        spec.vehicleId,
        spec,
      ]),
    )

    vehicleSpecsData.value = Array.from(nextSpecsById.values())
  } catch {
    specLoadError.value = '저장된 제원 데이터를 불러오지 못했습니다.'
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

const getVehicleStoredPrices = (vehicle: VehicleCompareItem) =>
  getStoredVehicleSpec(vehicle)?.trims
    .map((trim) => parseTrimPrice(trim.price))
    .filter((price): price is number => price !== null) ?? []

const getVehicleMinStoredPrice = (vehicle: VehicleCompareItem) => {
  const prices = getVehicleStoredPrices(vehicle)

  return prices.length > 0 ? Math.min(...prices) : null
}

const matchesVehiclePriceRange = (vehicle: VehicleCompareItem) => {
  if (selectedPriceRange.value === 'All') {
    return true
  }

  const minPrice = getVehicleMinStoredPrice(vehicle)

  if (selectedPriceRange.value === 'unknown') {
    return minPrice === null
  }

  if (minPrice === null) {
    return false
  }

  switch (selectedPriceRange.value) {
    case 'under3000':
      return minPrice < 30000000
    case '3000to5000':
      return minPrice >= 30000000 && minPrice < 50000000
    case '5000to8000':
      return minPrice >= 50000000 && minPrice < 80000000
    case 'over8000':
      return minPrice >= 80000000
    default:
      return true
  }
}

const formatStoredPriceRange = (vehicle: VehicleCompareItem) => {
  if (!vehicleSpecsData.value) {
    return '제원 데이터 불러오는 중'
  }

  const prices = getVehicleStoredPrices(vehicle)

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

watch(
  [search, selectedBrand, selectedYear, selectedFuel, selectedPriceRange, selectedSort],
  () => {
    currentPage.value = 1
  },
)

watch(selectedPriceRange, () => {
  if (selectedPriceRange.value !== 'All') {
    void loadAllVehicleSpecs()
  }
})

watch(vehicles, () => {
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

const formatSizeDimension = (value: number | null) =>
  value === null ? '정보 없음' : `${new Intl.NumberFormat('ko-KR').format(value)}mm`
</script>

<template>
  <main class="page-shell">
    <section class="home-board" aria-label="카컴페어랩 메인">
      <nav class="home-tabs" aria-label="메인 탭">
        <button
          type="button"
          class="home-tab"
          :class="{ active: activeMainTab === 'home' }"
          @click="activeMainTab = 'home'"
        >
          홈
        </button>
        <button
          type="button"
          class="home-tab"
          :class="{ active: activeMainTab === 'search' }"
          @click="activeMainTab = 'search'"
        >
          검색 및 비교
        </button>
        <button
          type="button"
          class="home-tab"
          :class="{ active: activeMainTab === 'compare' }"
          @click="activeMainTab = 'compare'"
        >
          비교
        </button>
        <button
          type="button"
          class="home-tab"
          :class="{ active: activeMainTab === 'news' }"
          @click="activeMainTab = 'news'"
        >
          뉴스
        </button>
      </nav>

      <header class="home-hero">
        <p>차량 비교 실험실</p>
        <h1>카컴페어랩</h1>
        <span>차량 모델 {{ vehicles.length }}대</span>
      </header>

      <section id="news-area" class="home-panels" aria-label="뉴스 영역">
        <article class="home-panel">
          <p>자동차 뉴스</p>
          <h2>업데이트 준비 중</h2>
        </article>
        <article class="home-panel">
          <p>시장 정보</p>
          <h2>콘텐츠 준비 중</h2>
        </article>
      </section>
    </section>

    <template v-if="showVehicleWorkspace">
      <VehicleFilterBar
        id="vehicle-search"
        v-model:search="search"
        v-model:selected-brand="selectedBrand"
        v-model:selected-year="selectedYear"
        v-model:selected-fuel="selectedFuel"
        v-model:selected-price-range="selectedPriceRange"
        v-model:selected-sort="selectedSort"
        :brands="brands"
        :years="years"
        :fuel-types="fuelTypes"
        :price-range-options="priceRangeOptions"
        :sort-options="sortOptions"
      />

      <p v-if="isLoadingVehicles" class="data-status" aria-live="polite">
        백엔드 API에서 차량 데이터를 불러오는 중입니다.
      </p>

      <p v-else-if="vehicleLoadError" class="data-status warning" aria-live="polite">
        {{ vehicleLoadError }}
      </p>

      <section
        v-if="selectedVehicles.length > 0"
        class="mobile-compare-shortcut"
        aria-label="모바일 선택 차량 비교"
      >
        <div>
          <p>선택한 차량</p>
          <strong>{{ selectedVehicles.length }}/{{ MAX_COMPARE_COUNT }}</strong>
        </div>
        <button
          type="button"
          :disabled="selectedVehicles.length < 2 || isLoadingSpecs"
          @click="openSpecComparison"
        >
          {{
            selectedVehicles.length < 2
              ? '1대 더 선택하면 비교표 보기'
              : isLoadingSpecs
                ? '제원 불러오는 중'
                : '비교표 보기'
          }}
        </button>
      </section>

      <section class="layout">
        <VehicleCardList
          :vehicles="paginatedVehicles"
          :selected-ids="selectedIds"
          :filtered-count="filteredVehicles.length"
          :visible-start-number="visibleStartNumber"
          :visible-end-number="visibleEndNumber"
          :current-page="currentPage"
          :total-pages="totalPages"
          :format-model-year="formatModelYear"
          :format-currency="formatCurrency"
          :get-efficiency-label="getEfficiencyLabel"
          :get-displayed-efficiency-parts="getDisplayedEfficiencyParts"
          :format-sales-rank="formatSalesRank"
          :format-nullable="formatNullable"
          @toggle-vehicle="toggleVehicle"
          @go-to-page="goToPage"
        />

        <CompareTray
          :selected-vehicles="selectedVehicles"
          :max-compare-count="MAX_COMPARE_COUNT"
          :is-loading-specs="isLoadingSpecs"
          @open-comparison="openSpecComparison"
        />
      </section>
    </template>

    <section
      v-if="activeMainTab === 'compare'"
      class="size-compare"
      aria-label="2D 실제 크기 비교"
    >
      <div class="size-compare-header">
        <div>
          <p>2D 실제 크기 비교</p>
          <h2>차량 2대 비교</h2>
        </div>
        <span>같은 mm 스케일 기준</span>
      </div>

      <div class="size-compare-controls">
        <label>
          첫 번째 차량
          <select v-model="sizeCompareFirstId">
            <option
              v-for="{ vehicle } in sizeCompareOptions"
              :key="`first-${vehicle.id}`"
              :value="vehicle.id"
              :disabled="vehicle.id === sizeCompareSecondId"
            >
              {{ vehicle.brand }} {{ vehicle.model }}
            </option>
          </select>
        </label>

        <label>
          두 번째 차량
          <select v-model="sizeCompareSecondId">
            <option
              v-for="{ vehicle } in sizeCompareOptions"
              :key="`second-${vehicle.id}`"
              :value="vehicle.id"
              :disabled="vehicle.id === sizeCompareFirstId"
            >
              {{ vehicle.brand }} {{ vehicle.model }}
            </option>
          </select>
        </label>
      </div>

      <div class="size-overlay-stage" aria-label="차량 실제 크기 겹쳐 보기">
        <div class="size-overlay-grid" aria-hidden="true"></div>
        <template
          v-for="({ vehicle, image }, index) in sizeComparisonItems"
          :key="vehicle.id"
        >
          <div
            v-if="image"
            class="size-overlay-layer"
            :class="[
              `layer-${index + 1}`,
              `asset-${image.assetType}`,
              { placeholder: image.assetType === 'missing-dimensions-placeholder' },
            ]"
            :style="getSizeComparisonLayerStyle(image)"
          >
            <img
              class="size-overlay-image"
              :src="image.imageUrl"
              :alt="image.imageAlt"
              loading="lazy"
            />
          </div>
        </template>
      </div>

      <div class="size-compare-legend">
        <article
          v-for="({ vehicle, image }, index) in sizeComparisonItems"
          :key="`legend-${vehicle.id}`"
          class="size-vehicle-summary"
        >
          <header>
            <span :class="`legend-dot layer-${index + 1}`"></span>
            <div>
              <p>{{ vehicle.brand }}</p>
              <h3>{{ vehicle.model }}</h3>
            </div>
          </header>
          <dl>
            <div>
              <dt>전장</dt>
              <dd>{{ formatSizeDimension(image?.lengthMm ?? null) }}</dd>
            </div>
            <div>
              <dt>전폭</dt>
              <dd>{{ formatSizeDimension(image?.widthMm ?? null) }}</dd>
            </div>
            <div>
              <dt>전고</dt>
              <dd>{{ formatSizeDimension(image?.heightMm ?? null) }}</dd>
            </div>
            <div>
              <dt>축거</dt>
              <dd>{{ formatSizeDimension(image?.wheelbaseMm ?? null) }}</dd>
            </div>
          </dl>
        </article>
      </div>

      <p class="size-compare-note">
        두 차량은 같은 mm 스케일과 같은 지면 기준선에 맞춰 겹쳐 표시됩니다.
      </p>
    </section>

    <VehicleCompareTable
      :show="showSpecComparison"
      :selected-vehicles="selectedVehicles"
      :is-loading-specs="isLoadingSpecs"
      :vehicle-specs-data="vehicleSpecsData"
      :selected-spec-comparisons="selectedSpecComparisons"
      :spec-comparison-groups="specComparisonGroups"
      :has-selected-fuel-economy="hasSelectedFuelEconomy"
      :has-selected-electric-efficiency="hasSelectedElectricEfficiency"
      :format-model-year="formatModelYear"
      :get-comparison-trim-names="getComparisonTrimNames"
      :format-stored-price-range="formatStoredPriceRange"
      :get-efficiency-parts-for-category="getEfficiencyPartsForCategory"
      :format-sales-rank="formatSalesRank"
      :format-nullable="formatNullable"
      :get-stored-spec-status="getStoredSpecStatus"
      :get-spec-value="getSpecValue"
      @close="closeSpecComparison"
    />
  </main>
</template>

<style>
* {
  box-sizing: border-box;
}

body {
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
  width: min(1280px, calc(100vw - clamp(28px, 6vw, 80px)));
  margin: 0 auto;
  padding: clamp(16px, 2.4vh, 28px) 0 clamp(36px, 6vh, 56px);
}

.home-board {
  display: grid;
  grid-template-columns: clamp(140px, 12vw, 176px) minmax(0, 1fr);
  grid-template-rows: minmax(260px, 42vh) minmax(150px, 28vh);
  gap: clamp(12px, 1.8vw, 18px);
  min-height: min(760px, calc(100vh - clamp(32px, 5vh, 56px)));
  margin-bottom: clamp(14px, 2vh, 20px);
}

.home-tabs {
  display: grid;
  gap: clamp(10px, 1.4vh, 14px);
  align-self: stretch;
  grid-row: 1 / -1;
  grid-template-rows: repeat(4, minmax(0, 1fr));
  padding: clamp(10px, 1.4vw, 16px);
  border: 1px solid #dbe4d7;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: rgba(32, 46, 39, 0.08) 0 12px 28px;
}

.home-tab {
  display: grid;
  width: 100%;
  place-items: center;
  min-width: 0;
  padding: 0 clamp(12px, 1.5vw, 18px);
  border: 0;
  border-radius: 6px;
  color: #526159;
  background: #f4f8f1;
  font-size: clamp(15px, 1.1vw, 17px);
  font-weight: 900;
  text-decoration: none;
}

.home-tab.active {
  color: #ffffff;
  background: #176b52;
}

.home-hero {
  display: grid;
  gap: clamp(10px, 1.8vh, 14px);
  min-height: 0;
  align-content: center;
  justify-items: center;
  padding: clamp(22px, 4vw, 40px);
  border-radius: 8px;
  color: #ffffff;
  text-align: center;
  box-shadow: rgba(32, 46, 39, 0.12) 0 18px 42px;
  background:
    linear-gradient(90deg, rgba(14, 23, 19, 0.9), rgba(14, 23, 19, 0.38)),
    url("https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1800&q=80")
      center / cover;
}

.home-hero p,
.home-panel p,
.compare-panel p {
  margin: 0;
  color: #d4f26a;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.home-hero h1 {
  margin: 0;
  font-size: clamp(46px, 7vw, 92px);
  line-height: 0.95;
}

.home-hero span {
  color: #e8eee9;
  font-weight: 700;
}

.home-panels {
  grid-column: 2;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(12px, 1.8vw, 18px);
  min-height: 0;
}

.home-panel {
  display: grid;
  min-height: 0;
  align-content: end;
  gap: 10px;
  padding: clamp(18px, 3vw, 28px);
  border: 1px solid #dbe4d7;
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(244, 248, 241, 0.96), rgba(255, 255, 255, 0.96)),
    #ffffff;
  box-shadow: rgba(32, 46, 39, 0.08) 0 12px 28px;
}

.home-panel h2 {
  margin: 0;
  font-size: clamp(24px, 3vw, 38px);
  line-height: 1.1;
}

.filters,
.compare-panel,
.comparison,
.spec-comparison,
.size-compare,
.vehicle-card {
  border: 1px solid #dbe4d7;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: rgba(32, 46, 39, 0.08) 0 12px 28px;
}

.filters {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 150px 130px 150px 180px 180px;
  gap: 12px;
  margin: 18px 0;
  padding: 16px;
}

.size-compare {
  display: grid;
  gap: 18px;
  margin-top: 18px;
  padding: clamp(18px, 2.5vw, 26px);
}

.size-compare-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 14px;
}

.size-compare-header p,
.size-vehicle-summary header p {
  margin: 0;
  color: #176b52;
  font-size: 13px;
  font-weight: 900;
}

.size-compare-header h2,
.size-vehicle-summary h3 {
  margin: 4px 0 0;
  line-height: 1.1;
}

.size-compare-header h2 {
  font-size: clamp(28px, 4vw, 44px);
}

.size-compare-header span,
.size-compare-note {
  color: #66736a;
  font-size: 13px;
  font-weight: 800;
}

.size-compare-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.size-overlay-stage {
  position: relative;
  min-height: clamp(250px, 42vh, 520px);
  overflow: hidden;
  border: 1px solid #dbe4d7;
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(238, 246, 234, 0.86)),
    #f4f8f1;
}

.size-overlay-stage::after {
  position: absolute;
  right: 3%;
  bottom: 11.4%;
  left: 3%;
  height: 3px;
  border-radius: 999px;
  background: rgba(23, 107, 82, 0.24);
  content: '';
}

.size-overlay-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(23, 107, 82, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(23, 107, 82, 0.06) 1px, transparent 1px);
  background-size: 10% 25%, 10% 25%;
}

.size-overlay-layer {
  position: absolute;
  bottom: 11.4%;
  left: 50%;
  z-index: 2;
  display: block;
  max-width: 90%;
  mix-blend-mode: multiply;
  transform: translateX(-50%) translateZ(0);
  transform-origin: center bottom;
}

.size-overlay-layer.layer-1 {
  opacity: 0.84;
  filter: drop-shadow(0 12px 17px rgba(16, 35, 28, 0.18));
}

.size-overlay-layer.layer-2 {
  z-index: 3;
  opacity: 0.56;
  filter:
    drop-shadow(0 0 2px rgba(21, 125, 147, 0.78))
    drop-shadow(0 8px 13px rgba(18, 46, 60, 0.18));
}

.size-overlay-layer.asset-provided-side-profile-image {
  mix-blend-mode: normal;
  opacity: 0.84;
  filter: drop-shadow(0 12px 18px rgba(16, 35, 28, 0.18));
}

.size-overlay-layer.asset-provided-side-profile-image.layer-2 {
  opacity: 0.52;
  filter:
    drop-shadow(0 0 2px rgba(21, 125, 147, 0.82))
    drop-shadow(0 8px 14px rgba(18, 46, 60, 0.2));
}

.size-overlay-layer.placeholder {
  opacity: 0.44;
  filter: grayscale(1);
}

.size-overlay-image {
  display: block;
  width: 100%;
  height: auto;
  max-height: clamp(180px, 32vh, 390px);
  object-fit: contain;
  object-position: center bottom;
}

.size-compare-legend {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.size-vehicle-summary {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border: 1px solid #dbe4d7;
  border-radius: 8px;
  background: #fbfdf9;
}

.size-vehicle-summary header {
  display: flex;
  gap: 10px;
  align-items: start;
  min-width: 0;
}

.size-vehicle-summary h3 {
  overflow-wrap: anywhere;
  font-size: clamp(20px, 2.4vw, 28px);
}

.legend-dot {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  margin-top: 3px;
  border-radius: 999px;
  box-shadow: 0 0 0 4px rgba(23, 107, 82, 0.1);
}

.legend-dot.layer-1 {
  background: #1b765d;
}

.legend-dot.layer-2 {
  background: #276ea0;
}

.size-vehicle-summary dl {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.size-vehicle-summary dl div {
  min-width: 0;
  padding: 10px;
  border-radius: 8px;
  background: #f2f7ef;
}

.size-compare-note {
  margin: 0;
  line-height: 1.5;
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

.vehicle-card-meta,
.compare-panel li {
  min-width: 0;
}

.vehicle-card-meta {
  display: grid;
  gap: 4px;
}

.vehicle-card code,
.compare-panel code {
  display: block;
  width: fit-content;
  max-width: 100%;
  padding: 4px 6px;
  overflow: hidden;
  border-radius: 5px;
  color: #176b52;
  background: #edf4e8;
  font-size: 11px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

small,
.empty {
  color: #66736a;
  line-height: 1.45;
}

.data-status {
  margin: 16px 0;
  padding: 12px 14px;
  border: 1px solid #dbe4d7;
  border-radius: 8px;
  background: #ffffff;
  color: #526159;
  font-weight: 700;
}

.data-status.warning {
  border-color: #efe1b3;
  background: #fff9e6;
  color: #725a12;
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
  display: grid;
  gap: 5px;
  padding: 10px;
  border-radius: 6px;
  background: #edf4e8;
  font-weight: 800;
}

.compare-panel li code {
  background: #ffffff;
}

.spec-compare-button {
  width: 100%;
}

.mobile-compare-shortcut {
  display: none;
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
  transition: opacity 220ms ease-out;
}

.modal-fade-leave-active {
  transition: opacity 140ms ease-in;
}

.modal-fade-enter-active .comparison-dialog {
  transition:
    opacity 240ms ease-out,
    transform 240ms ease-out;
}

.modal-fade-leave-active .comparison-dialog {
  transition:
    opacity 120ms ease-in,
    transform 120ms ease-in;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .comparison-dialog,
.modal-fade-leave-to .comparison-dialog {
  opacity: 0;
  transform: translate3d(0, 10px, 0);
}

.modal-fade-enter-to .comparison-dialog,
.modal-fade-leave-from .comparison-dialog {
  opacity: 1;
  transform: translate3d(0, 0, 0);
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
  .home-board {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(260px, 40vh) repeat(2, minmax(140px, 22vh));
    gap: 14px;
    min-height: auto;
  }

  .home-tabs {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    grid-row: auto;
    grid-template-rows: none;
    padding: 10px;
  }

  .home-tab {
    min-height: 46px;
    padding: 0 8px;
    font-size: 13px;
  }

  .home-hero {
    min-height: 0;
  }

  .home-panels {
    grid-column: auto;
    grid-template-columns: 1fr;
  }

  .home-panel {
    min-height: 0;
  }

  .filters,
  .layout {
    grid-template-columns: 1fr;
  }

  .size-compare-header {
    display: grid;
  }

  .size-compare-controls,
  .size-compare-legend {
    grid-template-columns: 1fr;
  }

  .size-overlay-stage {
    min-height: clamp(230px, 42vh, 360px);
  }

  .size-vehicle-summary dl {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mobile-compare-shortcut {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    margin: -2px 0 18px;
    padding: 14px;
    border: 1px solid #dbe4d7;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: rgba(32, 46, 39, 0.08) 0 12px 28px;
  }

  .mobile-compare-shortcut p,
  .mobile-compare-shortcut strong {
    margin: 0;
  }

  .mobile-compare-shortcut p {
    color: #176b52;
    font-size: 12px;
    font-weight: 800;
  }

  .mobile-compare-shortcut strong {
    display: block;
    margin-top: 2px;
    font-size: 22px;
  }

  .mobile-compare-shortcut button {
    min-width: 154px;
    padding: 0 14px;
  }

  .compare-panel {
    position: static;
  }
}
</style>
