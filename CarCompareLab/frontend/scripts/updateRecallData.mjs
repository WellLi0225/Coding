import { readFile, writeFile } from 'node:fs/promises'

const root = new URL('..', import.meta.url)
const dataFile = new URL('src/data/mockVehicles.ts', root)
const sourceName = '자동차리콜센터 리콜현황'
const sourceCheckedAt = '2026-06-04'
const baseUrl = 'https://www.car.go.kr'
const requestDelayMs = 1200
const gracefulStopMs = 13 * 60 * 1000
const startedAt = Date.now()
const { mockVehicles } = await import(dataFile.href)

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const vehicleYearWindow = (year) => ({
  start: new Date(Date.UTC(year - 1, 0, 1)),
  end: new Date(Date.UTC(year, 11, 31)),
})

const decodeHtml = (value) =>
  value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')

const stripTags = (value) =>
  decodeHtml(
    value
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim()

const normalizeText = (value) =>
  value
    .toLowerCase()
    .replace(/the new|all new|new/gi, '')
    .replace(/더\s*뉴|디\s*올\s*뉴|올\s*뉴|뉴/g, '')
    .replace(/하이브리드|hev|phev/g, '')
    .replace(/[^0-9a-z가-힣]/g, '')

const normalizeModelForSearch = (model) =>
  model
    .replace(/^(더 뉴|디 올 뉴|올 뉴|뉴)\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const parseDate = (value) => {
  const match = value
    .replace(/\s+/g, '')
    .match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/)

  if (!match) {
    return null
  }

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

const toIsoDate = (value) => value?.toISOString().slice(0, 10) ?? null

const overlaps = (period, window) =>
  Boolean(period?.start && period?.end && period.start <= window.end && period.end >= window.start)

class BlockedError extends Error {}

const postForm = async (path, params) => {
  await wait(requestDelayMs)

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: {
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'content-type': 'application/x-www-form-urlencoded',
      referer: `${baseUrl}/ri/stat/list.do`,
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36',
    },
    body: new URLSearchParams(params),
  })

  if (response.status === 403 || response.status === 429) {
    throw new BlockedError(`사이트 요청 제한(${response.status})`)
  }

  if (!response.ok) {
    throw new Error(`요청 실패(${response.status}): ${path}`)
  }

  return response.text()
}

const parseRecallList = (html) => {
  const totalMatch = html.match(/count-result[\s\S]*?전체\s*<span[^>]*>([\d,]+)<\/span>/)
  const totalCount = totalMatch ? Number(totalMatch[1].replace(/,/g, '')) : 0
  const items = []
  const itemPattern =
    /detailView\('(\d+)','O'\)[\s\S]*?<strong>([\s\S]*?)<\/strong>[\s\S]*?<ol>[\s\S]*?<li>([\s\S]*?)<\/li>\s*<li>([\s\S]*?)<\/li>/g

  for (const match of html.matchAll(itemPattern)) {
    items.push({
      id: match[1],
      title: stripTags(match[2]).replace(/\s+/g, ' ').trim(),
      agency: stripTags(match[3]).replace(/\s+/g, ' ').trim(),
      remedyStartDate: stripTags(match[4]).replace(/\s+/g, ' ').trim(),
    })
  }

  return { totalCount, items }
}

const searchRecallsByModel = async (model, year) => {
  const searchFromDate = `${year - 1}-01-01`
  const firstHtml = await postForm('/ri/stat/list.do', {
    ctype: '',
    currentPageNo: '1',
    searchFromDate,
    searchProductName: model,
  })
  const firstPage = parseRecallList(firstHtml)
  const pages = Math.ceil(firstPage.totalCount / 5)
  const items = [...firstPage.items]

  for (let page = 2; page <= pages; page += 1) {
    const html = await postForm('/ri/stat/list.do', {
      ctype: '',
      currentPageNo: String(page),
      searchFromDate,
      searchProductName: model,
    })

    items.push(...parseRecallList(html).items)
  }

  return items
}

const extractLabelValue = (plainText, label) => {
  const labels = [
    '제작(수입)사',
    '차명',
    '생산기간',
    '시정기간',
    '대상수량',
    '장치분류',
    '결함내용',
    '시정방법',
  ]
  const otherLabels = labels.filter((item) => item !== label).join('|')
  const match = plainText.match(new RegExp(`${label}\\s*([\\s\\S]*?)(?=${otherLabels}|$)`))

  return match?.[1]?.replace(/\s+/g, ' ').trim() ?? ''
}

const extractTableValue = (html, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = html.match(
    new RegExp(`<th>\\s*${escapedLabel}\\s*<\\/th>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`),
  )

  return match ? stripTags(match[1]).replace(/\s+/g, ' ').trim() : ''
}

const parsePeriodFromText = (value) => {
  const compact = value.replace(/\s+/g, '')
  const match = compact.match(
    /(\d{4}[.-]\d{1,2}[.-]\d{1,2})~(\d{4}[.-]\d{1,2}[.-]\d{1,2})?/,
  )

  if (!match) {
    return null
  }

  const start = parseDate(match[1])
  const end = parseDate(match[2] ?? match[1])

  if (!start || !end) {
    return null
  }

  return { start, end }
}

const parseModelSpecificPeriods = (plainText, model) => {
  const normalizedModel = normalizeText(model)
  const lines = plainText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  return lines
    .filter((line) => normalizeText(line).includes(normalizedModel))
    .map(parsePeriodFromText)
    .filter(Boolean)
}

const hasRecallModelName = (recall, model) => {
  const normalizedModel = normalizeText(model)
  const rawPrimaryText = `${recall.title} ${recall.vehicleNames}`
  const modelVariants = [
    model,
    normalizeModelForSearch(model),
    model.replace(/^(The New|All New|New)\s+/i, '').trim(),
    model.replace(/^(더 뉴|디 올 뉴|올 뉴|뉴)\s+/g, '').trim(),
  ].filter(Boolean)

  const hasExactToken = [...new Set(modelVariants)].some((variant) => {
    const pattern = new RegExp(
      `(^|[^0-9A-Za-z가-힣])${escapeRegExp(variant)}([^0-9A-Za-z가-힣]|$)`,
      'i',
    )

    return pattern.test(rawPrimaryText)
  })

  if (hasExactToken) {
    return true
  }

  if (normalizedModel.length < 4) {
    return false
  }

  const primaryText = normalizeText(rawPrimaryText)

  return primaryText.includes(normalizedModel)
}

const parseRecallDetail = async (recall) => {
  const html = await postForm('/ri/stat/detail.do', {
    ctype: 'O',
    recallId: recall.id,
  })
  const plainText = stripTags(html)
  const vehicleNames = extractTableValue(html, '차명')
  const productionPeriod = parsePeriodFromText(
    extractTableValue(html, '생산기간'),
  )

  return {
    ...recall,
    vehicleNames,
    productionPeriod,
    plainText,
    sourceUrl: `${baseUrl}/ri/stat/detail.do?ctype=O&recallId=${recall.id}`,
  }
}

const getMatchedRecalls = async (vehicle, summaryCache, detailCache) => {
  const model = normalizeModelForSearch(vehicle.model)
  const window = vehicleYearWindow(vehicle.year)

  const summaryKey = `${model}-${vehicle.year}`

  if (!summaryCache.has(summaryKey)) {
    summaryCache.set(summaryKey, await searchRecallsByModel(model, vehicle.year))
  }

  const summaries = summaryCache.get(summaryKey) ?? []
  const matchedRecalls = []

  for (const summary of summaries) {
    if (!detailCache.has(summary.id)) {
      detailCache.set(summary.id, await parseRecallDetail(summary))
    }

    const recall = detailCache.get(summary.id)
    if (!hasRecallModelName(recall, model)) {
      continue
    }

    const modelPeriods = parseModelSpecificPeriods(recall.plainText, model)
    const periods = modelPeriods.length > 0 ? modelPeriods : [recall.productionPeriod]
    const matchedPeriod = periods.filter(Boolean).find((period) => overlaps(period, window))

    if (!matchedPeriod) {
      continue
    }

    matchedRecalls.push({
      id: recall.id,
      title: recall.title,
      remedyStartDate: recall.remedyStartDate || null,
      productionStartDate: toIsoDate(matchedPeriod.start),
      productionEndDate: toIsoDate(matchedPeriod.end),
      sourceUrl: recall.sourceUrl,
    })
  }

  return [...new Map(matchedRecalls.map((recall) => [recall.id, recall])).values()]
}

const writeVehicles = async (vehicles) => {
  const original = await readFile(dataFile, 'utf8')
  const prefix =
    original.match(/^import type .+?\n\n/s)?.[0] ??
    "import type { VehicleCompareItem } from '../types/vehicle'\n\n"
  const output = `${prefix}export const mockVehicles: VehicleCompareItem[] = ${JSON.stringify(
    vehicles,
    null,
    2,
  )}\n`

  await writeFile(dataFile, output, 'utf8')
}

const summaryCache = new Map()
const detailCache = new Map()
const vehicles = [...mockVehicles]
const candidates = vehicles
  .map((vehicle, index) => ({ vehicle, index }))
  .filter(({ vehicle }) => !vehicle.recallSourceName)

console.log(`미처리 차량 ${candidates.length}대 처리 시작`)

let processed = 0
let matchedVehicleCount = 0

for (const { vehicle, index } of candidates) {
  if (Date.now() - startedAt > gracefulStopMs) {
    console.log('[중단] 실행 시간이 길어져 다음 실행에서 이어서 처리합니다.')
    break
  }

  try {
    const matchedRecalls = await getMatchedRecalls(vehicle, summaryCache, detailCache)
    vehicles[index] = {
      ...vehicle,
      recallCount: matchedRecalls.length,
      recallItems: matchedRecalls,
      recallSourceName: sourceName,
      recallSourceCheckedAt: sourceCheckedAt,
      recallStatus: null,
    }

    await writeVehicles(vehicles)

    processed += 1

    if (matchedRecalls.length > 0) {
      matchedVehicleCount += 1
    }

    console.log(
      `[저장] ${vehicle.brand} ${vehicle.model} ${vehicle.year}: 리콜 ${matchedRecalls.length}건`,
    )
  } catch (error) {
    if (error instanceof BlockedError) {
      console.log(`[중단] ${vehicle.brand} ${vehicle.model}: ${error.message}`)
      break
    }

    vehicles[index] = {
      ...vehicle,
      recallCount: null,
      recallItems: [],
      recallSourceName: sourceName,
      recallSourceCheckedAt: sourceCheckedAt,
      recallStatus: `확인 실패: ${error.message}`,
    }
    await writeVehicles(vehicles)
    processed += 1
    console.log(`[실패 저장] ${vehicle.brand} ${vehicle.model}: ${error.message}`)
  }
}

console.log(`이번 실행 처리 ${processed}대, 리콜 있음 ${matchedVehicleCount}대`)
