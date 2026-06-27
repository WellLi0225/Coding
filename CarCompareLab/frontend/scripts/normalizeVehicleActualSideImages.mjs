import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const sourceDir = path.resolve('public', 'vehicle-real-side-images')
const outputDir = path.resolve('public', 'vehicle-real-side-images-normalized')
const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const minOutputWidth = 1400

await mkdir(outputDir, { recursive: true })

const isBackgroundWhite = (buffer, offset) => {
  const red = buffer[offset]
  const green = buffer[offset + 1]
  const blue = buffer[offset + 2]
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)

  return red >= 242 && green >= 242 && blue >= 242 && max - min <= 14
}

const isWhiteHalo = (buffer, offset) => {
  const red = buffer[offset]
  const green = buffer[offset + 1]
  const blue = buffer[offset + 2]
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)

  return red >= 232 && green >= 232 && blue >= 232 && max - min <= 18
}

const hasTransparentNeighbor = (buffer, width, height, channels, x, y) => {
  for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
    for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
      if (offsetX === 0 && offsetY === 0) continue

      const nextX = x + offsetX
      const nextY = y + offsetY

      if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue

      const neighborOffset = (nextY * width + nextX) * channels

      if (buffer[neighborOffset + 3] < 12) {
        return true
      }
    }
  }

  return false
}

const removeConnectedWhiteBackground = async (sourcePath) => {
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const visited = new Uint8Array(width * height)
  const queue = []

  const enqueue = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return

    const index = y * width + x
    if (visited[index]) return

    const offset = index * channels
    if (!isBackgroundWhite(data, offset)) return

    visited[index] = 1
    queue.push(index)
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0)
    enqueue(x, height - 1)
  }

  for (let y = 0; y < height; y += 1) {
    enqueue(0, y)
    enqueue(width - 1, y)
  }

  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]
    const x = index % width
    const y = Math.floor(index / width)
    const offset = index * channels

    data[offset + 3] = 0

    enqueue(x + 1, y)
    enqueue(x - 1, y)
    enqueue(x, y + 1)
    enqueue(x, y - 1)
  }

  const alphaCleanup = new Uint8Array(width * height)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      const offset = index * channels

      if (
        data[offset + 3] > 0 &&
        isWhiteHalo(data, offset) &&
        hasTransparentNeighbor(data, width, height, channels, x, y)
      ) {
        alphaCleanup[index] = 1
      }
    }
  }

  for (let index = 0; index < alphaCleanup.length; index += 1) {
    if (!alphaCleanup[index]) continue

    data[index * channels + 3] = 0
  }

  return sharp(data, {
    raw: {
      width,
      height,
      channels,
    },
  })
}

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

  const trimmed = (await removeConnectedWhiteBackground(sourcePath)).trim({
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      threshold: 12,
    })

  const metadata = await trimmed.clone().metadata()
  const shouldUpscale = metadata.width && metadata.width < minOutputWidth

  let output = trimmed

  if (shouldUpscale) {
    output = output
      .resize({
        width: minOutputWidth,
        withoutEnlargement: false,
        kernel: sharp.kernel.lanczos3,
      })
      .sharpen({ sigma: 0.7, m1: 0.7, m2: 1.4 })
  }

  await output.png().toFile(outputPath)

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
