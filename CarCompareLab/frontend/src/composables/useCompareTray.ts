import { computed, ref, type Ref } from 'vue'
import type { VehicleCompareItem } from '../types/vehicle'

export const MAX_COMPARE_COUNT = 4

export const useCompareTray = (
  vehicles: Ref<VehicleCompareItem[]>,
  maxCompareCount = MAX_COMPARE_COUNT,
) => {
  const selectedIds = ref<string[]>([])

  const selectedVehicles = computed(() =>
    selectedIds.value
      .map((id) => vehicles.value.find((vehicle) => vehicle.id === id))
      .filter((vehicle): vehicle is VehicleCompareItem => Boolean(vehicle)),
  )

  const toggleVehicle = (vehicleId: string) => {
    if (selectedIds.value.includes(vehicleId)) {
      selectedIds.value = selectedIds.value.filter((id) => id !== vehicleId)
      return
    }

    if (selectedIds.value.length < maxCompareCount) {
      selectedIds.value = [...selectedIds.value, vehicleId]
    }
  }

  return {
    selectedIds,
    selectedVehicles,
    toggleVehicle,
  }
}
