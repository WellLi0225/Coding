<script setup lang="ts">
type SelectOption = {
  value: string
  label: string
}

defineProps<{
  search: string
  selectedBrand: string
  selectedYear: string
  selectedFuel: string
  selectedPriceRange: string
  selectedSort: string
  brands: string[]
  years: number[]
  fuelTypes: string[]
  priceRangeOptions: readonly SelectOption[]
  sortOptions: readonly SelectOption[]
}>()

defineEmits<{
  'update:search': [value: string]
  'update:selectedBrand': [value: string]
  'update:selectedYear': [value: string]
  'update:selectedFuel': [value: string]
  'update:selectedPriceRange': [value: string]
  'update:selectedSort': [value: string]
}>()
</script>

<template>
  <section class="filters" aria-label="차량 필터">
    <label>
      검색
      <input
        :value="search"
        type="search"
        placeholder="브랜드, 모델, 트림"
        @input="$emit('update:search', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <label>
      브랜드
      <select
        :value="selectedBrand"
        @change="$emit('update:selectedBrand', ($event.target as HTMLSelectElement).value)"
      >
        <option value="All">전체</option>
        <option v-for="brand in brands" :key="brand" :value="brand">
          {{ brand }}
        </option>
      </select>
    </label>

    <label>
      연식
      <select
        :value="selectedYear"
        @change="$emit('update:selectedYear', ($event.target as HTMLSelectElement).value)"
      >
        <option value="All">전체</option>
        <option v-for="year in years" :key="year" :value="String(year)">
          {{ year }}년형
        </option>
      </select>
    </label>

    <label>
      연료
      <select
        :value="selectedFuel"
        @change="$emit('update:selectedFuel', ($event.target as HTMLSelectElement).value)"
      >
        <option value="All">전체</option>
        <option v-for="fuelType in fuelTypes" :key="fuelType" :value="fuelType">
          {{ fuelType }}
        </option>
      </select>
    </label>

    <label>
      가격
      <select
        :value="selectedPriceRange"
        @change="$emit('update:selectedPriceRange', ($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="priceRangeOption in priceRangeOptions"
          :key="priceRangeOption.value"
          :value="priceRangeOption.value"
        >
          {{ priceRangeOption.label }}
        </option>
      </select>
    </label>

    <label>
      정렬 순서
      <select
        :value="selectedSort"
        @change="$emit('update:selectedSort', ($event.target as HTMLSelectElement).value)"
      >
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
</template>
