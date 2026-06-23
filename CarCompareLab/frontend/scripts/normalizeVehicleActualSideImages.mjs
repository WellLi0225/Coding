import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const sourceDir = path.resolve('public', 'vehicle-real-side-images')
const outputDir = path.resolve('public', 'vehicle-real-side-images-normalized')
const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp'])

await mkdir(outputDir, { recursive: true })

const files = await readdir(sourceDir, { withFileTypes: true }).catch(() => [])
let normalized = 0
let skipped = 0

for (const file of files) {
  if (!file.isFile()) continue

  const extension = path.extname(file.name).toLowerCase()
  if (!allowedExtensions.has(extension)) {
    skipped += 1
    continue
  }

  const sourcePath = path.join(sourceDir, file.name)
  const outputPath = path.join(outputDir, `${path.basename(file.name, extension)}.png`)

  await sharp(sourcePath)
    .ensureAlpha()
    .trim({
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      threshold: 12,
    })
    .png()
    .toFile(outputPath)

  normalized += 1
}

console.log(
  JSON.stringify(
    {
      normalized,
      skipped,
      sourceDir,
      outputDir,
    },
    null,
    2,
  ),
)
