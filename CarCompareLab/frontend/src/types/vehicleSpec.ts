export type VehicleSpecTrim = {
  trimName: string
  price: string | null
  specs: Record<string, Record<string, string | null>>
}

export type VehicleSpecItem = {
  vehicleId: string
  brand: string
  model: string
  year: number
  danawaModelId: string
  danawaLineupId: string | null
  sourceName: string
  sourceUrl: string | null
  sourceCheckedAt: string
  status: string | null
  trims: VehicleSpecTrim[]
}
