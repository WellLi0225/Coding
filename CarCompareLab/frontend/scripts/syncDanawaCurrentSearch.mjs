import { writeFile } from 'node:fs/promises'
import { mockVehicles } from '../src/data/mockVehicles.ts'

const today = '2026-06-22'
const baseUrl = 'https://auto.danawa.com'
const vehiclePath = new URL('../src/data/mockVehicles.ts', import.meta.url)
const knownBrandNames = [...new Set(mockVehicles.map((vehicle) => vehicle.brand))].sort(
  (firstBrand, secondBrand) => secondBrand.length - firstBrand.length,
)

const decodeHtml = (value) =>
  value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#40;/g, '(')
    .replace(/&#41;/g, ')')

const cleanText = (value) =>
  decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?\s*>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()

const getAttr = (tag, name) =>
  tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? ''

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^0-9a-z가-힣]+/gi, '-')
    .replace(/^-+|-+$/g, '')

const getDanawaModelId = (vehicle) => vehicle.id.match(/-(\d+)$/)?.[1] ?? null

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const fetchText = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36',
      ...(options.headers ?? {}),
    },
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    throw new Error(`요청 실패(${response.status}) ${url}`)
  }

  return response.text()
}

const parseBrandModel = (title, chunk) => {
  const imgAlts = [...chunk.matchAll(/alt="([^"]+)"/g)]
    .map((match) => cleanText(match[1]))
    .filter(Boolean)
  const source = cleanText(title) || imgAlts[0] || cleanText(chunk)
  let brand = knownBrandNames.find((item) => source === item || source.startsWith(`${item} `))

  if (!brand && imgAlts[1] && knownBrandNames.includes(imgAlts[1])) {
    brand = imgAlts[1]
  }

  if (!brand) {
    brand = source.split(' ')[0] ?? '정보 없음'
  }

  const model =
    source
      .replace(new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`), '')
      .trim() || source.trim()

  return { brand, model }
}

const parseYear = (text) =>
  Number(
    text.match(/(\d{4})\.\d{2}\.\s*출시/)?.[1] ??
      text.match(/(\d{4})\.\d{2}\.\s*출시예정/)?.[1] ??
      text.match(/(\d{4})\.00\.\s*출시예정/)?.[1] ??
      '2026',
  )

const parseFuelType = (text) => {
  const fuels = []

  if (text.includes('하이브리드')) fuels.push('하이브리드')
  if (text.includes('가솔린')) fuels.push('가솔린')
  if (text.includes('디젤')) fuels.push('디젤')
  if (text.includes('LPG')) fuels.push('LPG')
  if (text.includes('전기')) fuels.push('전기')
  if (text.includes('수소')) fuels.push('수소')

  return fuels.length ? [...new Set(fuels)].join(', ') : '정보 없음'
}

const parseMaxNumber = (match) => {
  if (!match) return null

  const values = match
    .slice(1)
    .filter(Boolean)
    .map(Number)
    .filter((value) => Number.isFinite(value))

  return values.length ? Math.max(...values) : null
}

const parseEfficiency = (text, fuelType) => {
  const isElectricOnly =
    fuelType === '전기' || (fuelType.includes('전기') && !fuelType.includes('가솔린'))
  const electricMatch = text.match(/복합전비\s*([\d.]+)(?:\s*~\s*([\d.]+))?\s*㎞\/kWh/)
  const fuelMatch = text.match(/복합연비\s*([\d.]+)(?:\s*~\s*([\d.]+))?\s*㎞\/ℓ/)
  const hasPending =
    text.includes('인증中') || text.includes('인증중') || text.includes('인증 中')

  if (isElectricOnly && electricMatch) {
    return { value: parseMaxNumber(electricMatch), unit: 'km/kWh', status: null }
  }

  if (!isElectricOnly && fuelMatch) {
    return { value: parseMaxNumber(fuelMatch), unit: 'km/L', status: null }
  }

  if (electricMatch) {
    return { value: parseMaxNumber(electricMatch), unit: 'km/kWh', status: null }
  }

  if (fuelMatch) {
    return { value: parseMaxNumber(fuelMatch), unit: 'km/L', status: null }
  }

  return { value: null, unit: null, status: hasPending ? '인증 중' : null }
}

const fetchModelYearLabel = async (modelId, fallbackYear) => {
  await wait(250)

  try {
    const html = await fetchText(`${baseUrl}/auto/?Work=model&Model=${modelId}&attributeList=`)
    const modelYearLabel = html.match(/\d{4}년형/)?.[0]

    return {
      label: modelYearLabel ?? `${fallbackYear}년형`,
      sourceName: modelYearLabel ? '다나와 자동차 상세 페이지' : '다나와 자동차 신차검색',
    }
  } catch {
    return { label: `${fallbackYear}년형`, sourceName: '다나와 자동차 신차검색' }
  }
}

const params = new URLSearchParams({
  listSortType: '1',
  tab: 'all',
  rangeMinPrice: '',
  rangeMaxPrice: '',
  searchKeyword: '',
  listCount: '1000',
  page: '1',
  brandList: '',
  segmentList: '',
  attributeList: '',
})

const html = await fetchText(`${baseUrl}/newcar/searchAjax.php`, {
  method: 'POST',
  headers: {
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'x-requested-with': 'XMLHttpRequest',
    referer: `${baseUrl}/newcar/?Work=search`,
  },
  body: params,
})

const inputMatches = [...html.matchAll(/<input[^>]*name="compItemCk"[^>]*>/g)]
const currentItems = []

for (const match of inputMatches) {
  const tag = match[0]
  const modelId = getAttr(tag, 'value').match(/newcar_(\d+)/)?.[1]

  if (!modelId) continue

  const start = Math.max(0, html.lastIndexOf('<li', match.index - 1))
  const end = html.indexOf('</li>', match.index)
  const chunk = html.slice(start, end + 5)
  const title = getAttr(tag, 'title')
  const { brand, model } = parseBrandModel(title, chunk)
  const text = cleanText(chunk)

  currentItems.push({ modelId, brand, model, text })
}

const vehiclesByDanawaId = new Map(
  mockVehicles.map((vehicle) => [getDanawaModelId(vehicle), vehicle]).filter(([id]) => id),
)
const outputVehicles = []
const added = []

for (const item of currentItems) {
  const existing = vehiclesByDanawaId.get(item.modelId)

  if (existing) {
    outputVehicles.push(existing)
    continue
  }

  const year = parseYear(item.text)
  const fuelType = parseFuelType(item.text)
  const efficiency = parseEfficiency(item.text, fuelType)
  const modelYear = await fetchModelYearLabel(item.modelId, year)
  const vehicleId = `${slugify(item.brand)}-${slugify(item.model)}-${item.modelId}`
  const primaryFuelType =
    fuelType.includes('전기') && !fuelType.includes('가솔린') && !fuelType.includes('디젤')
      ? '전기'
      : fuelType.split(', ')[0]

  outputVehicles.push({
    id: vehicleId,
    brand: item.brand,
    model: item.model,
    year,
    trim: '대표 모델',
    fuelType,
    msrpUsd: null,
    combinedKmPerLiter: efficiency.unit === 'km/L' ? efficiency.value : null,
    domesticSalesRank: null,
    domesticSalesVolume: null,
    salesRankSourceName: null,
    salesRankCheckedAt: null,
    recallCount: 0,
    sourceName: '다나와 자동차 신차검색',
    sourceCheckedAt: today,
    combinedEfficiencyValue: efficiency.value,
    combinedEfficiencyUnit: efficiency.unit,
    efficiencySourceName: '다나와 자동차 신차검색',
    efficiencySourceCheckedAt: today,
    modelYearLabel: modelYear.label,
    modelYearSourceName: modelYear.sourceName,
    modelYearSourceCheckedAt: today,
    efficiencyOptions:
      efficiency.value === null
        ? []
        : [
            {
              fuelType: primaryFuelType,
              drivetrain: null,
              value: efficiency.value,
              unit: efficiency.unit,
              trimName: '다나와 모델 요약 복합 효율',
              sourceName: '다나와 자동차 신차검색',
              sourceCheckedAt: today,
            },
          ],
    efficiencyStatus: efficiency.status,
    recallItems: [],
    recallSourceName: '자동차리콜센터 리콜현황',
    recallSourceCheckedAt: '2026-06-04',
    recallStatus: null,
  })

  added.push(`${item.brand} ${item.model} (${item.modelId})`)
}

const currentModelIds = new Set(currentItems.map((item) => item.modelId))
const removed = mockVehicles
  .filter((vehicle) => !currentModelIds.has(getDanawaModelId(vehicle)))
  .map((vehicle) => `${vehicle.brand} ${vehicle.model} (${getDanawaModelId(vehicle)})`)

const output = `import type { VehicleCompareItem } from '../types/vehicle'\n\nexport const mockVehicles: VehicleCompareItem[] = ${JSON.stringify(
  outputVehicles,
  null,
  2,
)}\n`

await writeFile(vehiclePath, output, 'utf8')

console.log(
  JSON.stringify(
    {
      currentCount: currentItems.length,
      outputCount: outputVehicles.length,
      addedCount: added.length,
      removedCount: removed.length,
      added,
      removed,
    },
    null,
    2,
  ),
)
