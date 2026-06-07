import { readFile, writeFile } from 'node:fs/promises'

const root = new URL('..', import.meta.url)
const vehicleFile = new URL('src/data/mockVehicles.ts', root)
const specFile = new URL('src/data/vehicleSpecs.ts', root)
const sourceName = '다나와 자동차 제원'
const sourceCheckedAt = '2026-06-06'
const baseUrl = 'https://auto.danawa.com'
const requestDelayMs = 650
const gracefulStopMs = 13 * 60 * 1000
const startedAt = Date.now()

const { mockVehicles } = await import(vehicleFile.href)

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const fetchText = async (url) => {
  await wait(requestDelayMs)

  const response = await fetch(url, {
    headers: {
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36',
    },
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    throw new Error(`요청 실패(${response.status})`)
  }

  return response.text()
}

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
      .replace(/<br\s*\/?\s*>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()

const splitCells = (rowHtml, tagName) =>
  [...rowHtml.matchAll(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi'))].map(
    (match) => cleanText(match[1]) || null,
  )

const getDanawaModelId = (vehicleId) => {
  const match = vehicleId.match(/-(\d+)$/)

  return match?.[1] ?? null
}

const findLineupId = async (modelId) => {
  const detailUrl = `${baseUrl}/auto/?Work=model&Model=${modelId}&attributeList=`
  const html = await fetchText(detailUrl)
  const photoMatch = html.match(/photo=['"]\d+\/(\d+)['"]/)

  if (photoMatch) {
    return photoMatch[1]
  }

  const lineupMatch = html.match(/Lineup=(\d+)/)

  return lineupMatch?.[1] ?? null
}

const parseTrimHeaders = (html) => {
  const headerMatch = html.match(
    /<div class='compare__right'>[\s\S]*?<table class='compare__table compare__header'[\s\S]*?<tr>([\s\S]*?)<\/tr>/,
  )

  if (!headerMatch) {
    return []
  }

  return [...headerMatch[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((match) => {
    const trim = cleanText(match[1].match(/<span class='trim'>([\s\S]*?)<\/span>/)?.[1] ?? '')
    const price = cleanText(match[1].match(/<span class='price'>([\s\S]*?)<\/span>/)?.[1] ?? '')

    return {
      trimName: trim || '세부모델',
      price: price || null,
      specs: {},
    }
  })
}

const parseLeftRows = (html) => {
  const leftBodyMatch = html.match(
    /<div class='compare__left'>[\s\S]*?<table class='compare__table compare__body'[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/,
  )

  if (!leftBodyMatch) {
    return { groupByType: new Map(), itemByIndex: new Map() }
  }

  const groupByType = new Map()
  const itemByIndex = new Map()
  const rows = [...leftBodyMatch[1].matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)]

  for (const row of rows) {
    const attrs = row[1]
    const body = row[2]
    const groupMatch = attrs.match(/class='groupType_(\d+) leftTr'/)

    if (!groupMatch) {
      continue
    }

    const groupType = groupMatch[1]
    const th = body.match(/<th\b[^>]*>([\s\S]*?)<\/th>/i)

    if (th) {
      const heading = cleanText(th[1]).replace(/^\[제원\]\s*/, '')

      if (heading && !heading.includes('사양') && !heading.includes('옵션')) {
        groupByType.set(groupType, heading)
      }

      continue
    }

    const idMatch = attrs.match(/id='compareLeft_(\d+)'/)
    const td = body.match(/<td\b[^>]*>([\s\S]*?)<\/td>/i)

    if (idMatch && td) {
      itemByIndex.set(idMatch[1], {
        groupType,
        itemName: cleanText(td[1]),
      })
    }
  }

  return { groupByType, itemByIndex }
}

const parseRightRows = (html) => {
  const rightBodyMatch = html.match(
    /<div class='compare__right'>[\s\S]*?<table class='compare__table compare__body'[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/,
  )

  if (!rightBodyMatch) {
    return []
  }

  return [...rightBodyMatch[1].matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)]
    .map((row) => {
      const idMatch = row[1].match(/id='compareRight_(\d+)'/)

      if (!idMatch) {
        return null
      }

      return {
        index: idMatch[1],
        values: splitCells(row[2], 'td'),
      }
    })
    .filter(Boolean)
}

const parseSpecPage = (html) => {
  const trims = parseTrimHeaders(html)
  const { groupByType, itemByIndex } = parseLeftRows(html)
  const rows = parseRightRows(html)

  for (const row of rows) {
    const item = itemByIndex.get(row.index)

    if (!item) {
      continue
    }

    const category = groupByType.get(item.groupType)

    if (!category || !item.itemName) {
      continue
    }

    row.values.forEach((value, trimIndex) => {
      const trim = trims[trimIndex]

      if (!trim) {
        return
      }

      trim.specs[category] ??= {}
      trim.specs[category][item.itemName] = value
    })
  }

  return trims
}

const readExistingSpecs = async () => {
  const text = await readFile(specFile, 'utf8')
  const jsonText = text
    .replace(/^import type .+?\n\nexport const vehicleSpecs: VehicleSpecItem\[] = /s, '')
    .trim()

  if (jsonText === '[]') {
    return []
  }

  return JSON.parse(jsonText)
}

const writeSpecs = async (specs) => {
  const output = `import type { VehicleSpecItem } from '../types/vehicleSpec'\n\nexport const vehicleSpecs: VehicleSpecItem[] = ${JSON.stringify(
    specs,
    null,
    2,
  )}\n`

  await writeFile(specFile, output, 'utf8')
}

const existingSpecs = await readExistingSpecs()
const specsByVehicleId = new Map(existingSpecs.map((spec) => [spec.vehicleId, spec]))
const candidates = mockVehicles.filter((vehicle) => !specsByVehicleId.has(vehicle.id))

console.log(`제원 미처리 ${candidates.length}대 처리 시작`)

let processed = 0

for (const vehicle of candidates) {
  if (Date.now() - startedAt > gracefulStopMs) {
    console.log('[중단] 실행 시간이 길어져 다음 실행에서 이어서 처리합니다.')
    break
  }

  const danawaModelId = getDanawaModelId(vehicle.id)
  let danawaLineupId = null
  let sourceUrl = null
  let status = null
  let trims = []

  try {
    if (!danawaModelId) {
      throw new Error('다나와 Model ID 없음')
    }

    danawaLineupId = await findLineupId(danawaModelId)

    if (!danawaLineupId) {
      throw new Error('다나와 Lineup ID 없음')
    }

    sourceUrl = `${baseUrl}/auto/modelPopup.php?Type=spec&Lineup=${danawaLineupId}`
    trims = parseSpecPage(await fetchText(sourceUrl))

    if (trims.length === 0) {
      throw new Error('제원 표 없음')
    }

    console.log(`[저장] ${vehicle.brand} ${vehicle.model} ${vehicle.year}: 트림 ${trims.length}개`)
  } catch (error) {
    status = `확인 실패: ${error.message}`
    console.log(`[실패 저장] ${vehicle.brand} ${vehicle.model} ${vehicle.year}: ${error.message}`)
  }

  specsByVehicleId.set(vehicle.id, {
    vehicleId: vehicle.id,
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.year,
    danawaModelId: danawaModelId ?? '',
    danawaLineupId,
    sourceName,
    sourceUrl,
    sourceCheckedAt,
    status,
    trims,
  })

  await writeSpecs([...specsByVehicleId.values()])
  processed += 1
}

console.log(`이번 실행 처리 ${processed}대, 전체 저장 ${specsByVehicleId.size}대`)
