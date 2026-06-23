import { readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { mockVehicles } from '../src/data/mockVehicles.ts'

const imageDir = path.resolve('public', 'vehicle-real-side-images')
const normalizedImageDir = path.resolve('public', 'vehicle-real-side-images-normalized')
const manifestPath = path.resolve('src', 'data', 'vehicleActualSideImages.ts')
const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg'])

const escapeTs = (value) => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")

const vehicleById = new Map(mockVehicles.map((vehicle) => [vehicle.id, vehicle]))
const files = await readdir(imageDir, { withFileTypes: true }).catch(() => [])
const manifestEntries = []

for (const file of files) {
  if (!file.isFile()) continue

  const extension = path.extname(file.name).toLowerCase()
  if (!allowedExtensions.has(extension)) continue

  const vehicleId = path.basename(file.name, extension)
  const vehicle = vehicleById.get(vehicleId)

  if (!vehicle) {
    console.warn(`차량 데이터에 없는 이미지 파일은 건너뜁니다: ${file.name}`)
    continue
  }

  const normalizedFileName = `${vehicleId}.png`
  const hasNormalizedImage = await stat(path.join(normalizedImageDir, normalizedFileName))
    .then((entry) => entry.isFile())
    .catch(() => false)

  manifestEntries.push({
    vehicleId,
    brand: vehicle.brand,
    model: vehicle.model,
    fileName: hasNormalizedImage ? normalizedFileName : file.name,
    imageDirName: hasNormalizedImage
      ? 'vehicle-real-side-images-normalized'
      : 'vehicle-real-side-images',
  })
}

manifestEntries.sort((first, second) =>
  `${first.brand} ${first.model}`.localeCompare(`${second.brand} ${second.model}`, 'ko-KR'),
)

const body =
  manifestEntries.length === 0
    ? '{}'
    : `{\n${manifestEntries
        .map(
          (entry) => `  '${escapeTs(entry.vehicleId)}': {
    imageUrl: '/${entry.imageDirName}/${escapeTs(entry.fileName)}',
    imageAlt: '${escapeTs(`${entry.brand} ${entry.model} 실제 측면 이미지`)}',
    assetType: 'provided-side-profile-image',
    sourceName: '직접 저장한 실제 측면 이미지',
    sourceCheckedAt: null,
  },`,
        )
        .join('\n')}\n}`

const output = `import type { VehicleActualSideImageAsset } from '../types/vehicleSizeImage'\n\nexport const vehicleActualSideImages: Record<string, VehicleActualSideImageAsset> = ${body}\n`

await writeFile(manifestPath, output, 'utf8')

console.log(
  JSON.stringify(
    {
      total: manifestEntries.length,
      imageDir,
      manifestPath,
    },
    null,
    2,
  ),
)
