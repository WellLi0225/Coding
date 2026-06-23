import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const PORT = Number(process.env.PORT ?? 8080)
const ROOT_DIR = path.resolve(import.meta.dirname, '..', '..')
const FRONTEND_SRC_DIR = path.join(ROOT_DIR, 'frontend', 'src')
const DATA_DIR = path.resolve(import.meta.dirname, '..', 'data')
const RAW_PAYLOAD_DIR = path.join(DATA_DIR, 'raw-payloads')
const RUNS_FILE = path.join(DATA_DIR, 'source-runs.json')

const SOURCE_CHECKED_AT = '2026-06-22'

const loadExportedArray = async (filePath, exportName) => {
  const source = await readFile(filePath, 'utf8')
  const executableSource = source
    .replace(/^import type .*?\r?\n/gm, '')
    .replace(
      new RegExp(`export const ${exportName}: [^=]+ =`),
      `const ${exportName} =`,
    )

  const sandbox = {}
  vm.runInNewContext(
    `${executableSource}\nthis.result = ${exportName};`,
    sandbox,
    { filename: filePath },
  )

  return sandbox.result
}

const loadVehicles = () =>
  loadExportedArray(
    path.join(FRONTEND_SRC_DIR, 'data', 'mockVehicles.ts'),
    'mockVehicles',
  )

const loadVehicleSpecs = () =>
  loadExportedArray(
    path.join(FRONTEND_SRC_DIR, 'data', 'vehicleSpecs.ts'),
    'vehicleSpecs',
  )

const normalize = (value) => String(value ?? '').trim().toLowerCase()

const includesFuelType = (vehicle, fuelType) =>
  vehicle.fuelType
    .split(',')
    .map((item) => item.trim())
    .includes(fuelType)

const compareNullableAsc = (firstValue, secondValue) => {
  if (firstValue === null && secondValue === null) return 0
  if (firstValue === null) return 1
  if (secondValue === null) return -1
  return firstValue - secondValue
}

const compareNullableDesc = (firstValue, secondValue) => {
  if (firstValue === null && secondValue === null) return 0
  if (firstValue === null) return 1
  if (secondValue === null) return -1
  return secondValue - firstValue
}

const getDisplayedEfficiencyValue = (vehicle) =>
  vehicle.combinedEfficiencyValue ?? vehicle.combinedKmPerLiter

const filterAndSortVehicles = (vehicles, searchParams) => {
  const search = normalize(searchParams.get('search'))
  const brand = searchParams.get('brand') ?? 'All'
  const fuelType = searchParams.get('fuelType') ?? 'All'
  const sort = searchParams.get('sort') ?? 'recommended'

  const filteredVehicles = vehicles.filter((vehicle) => {
    const keywordTarget = normalize(
      `${vehicle.brand} ${vehicle.model} ${vehicle.trim} ${vehicle.year} ${vehicle.modelYearLabel ?? ''}`,
    )
    const matchesSearch = !search || keywordTarget.includes(search)
    const matchesBrand = brand === 'All' || vehicle.brand === brand
    const matchesFuel = fuelType === 'All' || includesFuelType(vehicle, fuelType)

    return matchesSearch && matchesBrand && matchesFuel
  })

  return [...filteredVehicles].sort((firstVehicle, secondVehicle) => {
    switch (sort) {
      case 'salesRank':
        return compareNullableAsc(
          firstVehicle.domesticSalesRank,
          secondVehicle.domesticSalesRank,
        )
      case 'fuelEconomy':
        return compareNullableDesc(
          getDisplayedEfficiencyValue(firstVehicle),
          getDisplayedEfficiencyValue(secondVehicle),
        )
      case 'newest':
        return secondVehicle.year - firstVehicle.year
      case 'modelName':
        return (
          firstVehicle.model.localeCompare(secondVehicle.model, 'ko-KR', {
            numeric: true,
          }) ||
          firstVehicle.brand.localeCompare(secondVehicle.brand, 'ko-KR', {
            numeric: true,
          })
        )
      default:
        return 0
    }
  })
}

const toDisplayValue = (value) => {
  if (value === null || value === undefined || value === '') return '정보 없음'
  if (Array.isArray(value)) return value.length ? `${value.length}개` : '정보 없음'
  return String(value)
}

const createCompareRows = (vehicles) => {
  const rowDefinitions = [
    ['brand', '브랜드', (vehicle) => vehicle.brand],
    ['model', '모델', (vehicle) => vehicle.model],
    ['year', '연식', (vehicle) => vehicle.modelYearLabel ?? `${vehicle.year}년형`],
    ['trim', '트림', (vehicle) => vehicle.trim],
    ['fuelType', '연료', (vehicle) => vehicle.fuelType],
    [
      'price',
      '권장 소비자가',
      (vehicle) =>
        vehicle.msrpUsd === null ? null : `$${vehicle.msrpUsd.toLocaleString()}`,
    ],
    [
      'efficiency',
      '복합 연비/전비',
      (vehicle) => {
        const value = getDisplayedEfficiencyValue(vehicle)
        const unit = vehicle.combinedEfficiencyUnit ?? 'km/L'
        return value === null || value === undefined ? null : `${value}${unit}`
      },
    ],
    [
      'salesRank',
      '국내 판매 순위',
      (vehicle) =>
        vehicle.domesticSalesRank === null
          ? null
          : `${vehicle.domesticSalesRank}위 · ${vehicle.domesticSalesVolume?.toLocaleString() ?? 0}대`,
    ],
    ['recallCount', '리콜', (vehicle) => `${vehicle.recallCount ?? 0}건`],
  ]

  return rowDefinitions.map(([key, label, getValue]) => ({
    key,
    label,
    values: Object.fromEntries(
      vehicles.map((vehicle) => [vehicle.id, toDisplayValue(getValue(vehicle))]),
    ),
  }))
}

const createSpecGroups = (vehicles, specs) => {
  const specsByVehicleId = new Map(specs.map((spec) => [spec.vehicleId, spec]))

  return vehicles.map((vehicle) => {
    const spec = specsByVehicleId.get(vehicle.id)
    const firstTrim = spec?.trims?.[0] ?? null

    return {
      vehicleId: vehicle.id,
      status: spec?.status ?? 'not_found',
      sourceName: spec?.sourceName ?? null,
      sourceCheckedAt: spec?.sourceCheckedAt ?? null,
      trimName: firstTrim?.trimName ?? null,
      specs: firstTrim?.specs ?? {},
      missingReason: firstTrim ? null : '저장된 제원 데이터가 없습니다.',
    }
  })
}

const ensureDataFiles = async () => {
  await mkdir(RAW_PAYLOAD_DIR, { recursive: true })
  if (!existsSync(RUNS_FILE)) {
    await writeFile(RUNS_FILE, '[]\n', 'utf8')
  }
}

const readRuns = async () => {
  await ensureDataFiles()
  return JSON.parse(await readFile(RUNS_FILE, 'utf8'))
}

const writeRuns = async (runs) => {
  await ensureDataFiles()
  await writeFile(RUNS_FILE, `${JSON.stringify(runs, null, 2)}\n`, 'utf8')
}

const readJsonBody = async (request) =>
  new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
    })
    request.on('end', () => {
      if (!body.trim()) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(error)
      }
    })
  })

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload, null, 2))
}

const routeRequest = async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host}`)

  if (request.method === 'OPTIONS') {
    sendJson(response, 200, { ok: true })
    return
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/health') {
    sendJson(response, 200, {
      status: 'ok',
      service: 'CarCompareLab backend',
      checkedAt: new Date().toISOString(),
    })
    return
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/vehicles') {
    const vehicles = await loadVehicles()
    const sortedVehicles = filterAndSortVehicles(vehicles, requestUrl.searchParams)
    const page = Math.max(1, Number(requestUrl.searchParams.get('page') ?? 1))
    const pageSize = Math.min(
      1000,
      Math.max(1, Number(requestUrl.searchParams.get('pageSize') ?? 24)),
    )
    const startIndex = (page - 1) * pageSize
    const items = sortedVehicles.slice(startIndex, startIndex + pageSize)

    sendJson(response, 200, {
      items,
      total: sortedVehicles.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(sortedVehicles.length / pageSize)),
      sourceName: 'CarCompareLab local data API',
      sourceCheckedAt: SOURCE_CHECKED_AT,
    })
    return
  }

  if (
    request.method === 'GET' &&
    requestUrl.pathname === '/api/vehicles/compare'
  ) {
    const ids = (requestUrl.searchParams.get('ids') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
    const vehicles = (await loadVehicles()).filter((vehicle) =>
      ids.includes(vehicle.id),
    )
    const specs = await loadVehicleSpecs()
    const selectedSpecs = specs.filter((spec) => ids.includes(spec.vehicleId))

    sendJson(response, 200, {
      columns: vehicles.map((vehicle) => ({
        id: vehicle.id,
        title: `${vehicle.brand} ${vehicle.model}`,
        year: vehicle.year,
      })),
      rows: createCompareRows(vehicles),
      specs: createSpecGroups(vehicles, specs),
      vehicleSpecs: selectedSpecs,
      missingReason:
        vehicles.length === ids.length ? null : '일부 차량 ID를 찾지 못했습니다.',
      sourceCheckedAt: SOURCE_CHECKED_AT,
    })
    return
  }

  if (
    request.method === 'POST' &&
    requestUrl.pathname === '/api/admin/ingestion/run'
  ) {
    const body = await readJsonBody(request)
    const vehicles = await loadVehicles()
    const now = new Date().toISOString()
    const run = {
      id: `run-${Date.now()}`,
      source: body.source ?? 'LOCAL_FRONTEND_SEED',
      year: body.year ?? null,
      make: body.make ?? null,
      startedAt: now,
      finishedAt: now,
      status: 'completed',
      savedCount: vehicles.length,
      failedCount: 0,
      errorSummary: null,
    }
    const runs = [run, ...(await readRuns())]
    await writeRuns(runs)
    await writeFile(
      path.join(RAW_PAYLOAD_DIR, `${run.id}.json`),
      `${JSON.stringify(
        {
          request: body,
          savedVehicleIds: vehicles.map((vehicle) => vehicle.id),
          capturedAt: now,
        },
        null,
        2,
      )}\n`,
      'utf8',
    )

    sendJson(response, 201, run)
    return
  }

  if (
    request.method === 'GET' &&
    requestUrl.pathname === '/api/admin/ingestion/runs'
  ) {
    sendJson(response, 200, { items: await readRuns() })
    return
  }

  sendJson(response, 404, {
    error: 'not_found',
    message: '요청한 API 경로를 찾을 수 없습니다.',
  })
}

const server = createServer((request, response) => {
  routeRequest(request, response).catch((error) => {
    console.error(error)
    sendJson(response, 500, {
      error: 'internal_server_error',
      message: error.message,
    })
  })
})

await ensureDataFiles()

server.listen(PORT, () => {
  console.log(`CarCompareLab backend listening on http://localhost:${PORT}`)
})
