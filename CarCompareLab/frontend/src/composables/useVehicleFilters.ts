import { ref } from 'vue'

export const sortOptions = [
  { value: 'recommended', label: '추천순' },
  { value: 'salesRank', label: '판매 순위 높은순' },
  { value: 'fuelEconomy', label: '연비 높은순' },
  { value: 'newest', label: '최신 연식순' },
  { value: 'modelName', label: '모델명 가나다순' },
] as const

export const priceRangeOptions = [
  { value: 'All', label: '전체' },
  { value: 'under3000', label: '3,000만원 미만' },
  { value: '3000to5000', label: '3,000만-5,000만원' },
  { value: '5000to8000', label: '5,000만-8,000만원' },
  { value: 'over8000', label: '8,000만원 이상' },
  { value: 'unknown', label: '가격 정보 없음' },
] as const

export const useVehicleFilters = () => {
  const search = ref('')
  const selectedBrand = ref('All')
  const selectedYear = ref('All')
  const selectedFuel = ref('All')
  const selectedPriceRange = ref('All')
  const selectedSort = ref('recommended')

  return {
    search,
    selectedBrand,
    selectedYear,
    selectedFuel,
    selectedPriceRange,
    selectedSort,
  }
}
