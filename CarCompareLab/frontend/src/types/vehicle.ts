export type VehicleEfficiencyOption = {
  fuelType: string
  drivetrain: string | null
  value: number
  unit: string
  trimName: string
  sourceName: string
  sourceCheckedAt: string
}

export type VehicleRecallItem = {
  id: string
  title: string
  remedyStartDate: string | null
  productionStartDate: string | null
  productionEndDate: string | null
  sourceUrl: string
}

export type VehicleCompareItem = {
  id: string
  brand: string
  model: string
  year: number
  modelYearLabel: string | null
  modelYearSourceName: string | null
  modelYearSourceCheckedAt: string | null
  trim: string
  fuelType: string
  msrpUsd: number | null
  combinedKmPerLiter: number | null
  combinedEfficiencyValue: number | null
  combinedEfficiencyUnit: string | null
  efficiencySourceName: string | null
  efficiencySourceCheckedAt: string | null
  efficiencyStatus: string | null
  efficiencyOptions: VehicleEfficiencyOption[]
  domesticSalesRank: number | null
  domesticSalesVolume: number | null
  salesRankSourceName: string | null
  salesRankCheckedAt: string | null
  recallCount: number | null
  recallItems?: VehicleRecallItem[]
  recallSourceName?: string | null
  recallSourceCheckedAt?: string | null
  recallStatus?: string | null
  sourceName: string
  sourceCheckedAt: string
}
