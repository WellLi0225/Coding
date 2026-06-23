export type VehicleSizeImageAsset = {
  vehicleId: string
  brand: string
  model: string
  imageUrl: string
  imageAlt: string
  view: 'side'
  assetType:
    | 'provided-side-profile-image'
    | 'generated-2d-scale-svg'
    | 'missing-dimensions-placeholder'
  lengthMm: number | null
  widthMm: number | null
  heightMm: number | null
  wheelbaseMm: number | null
  sourceName: string
  sourceCheckedAt: string | null
}

export type VehicleActualSideImageAsset = {
  imageUrl: string
  imageAlt: string
  assetType: 'provided-side-profile-image'
  sourceName: string
  sourceCheckedAt: string | null
}
