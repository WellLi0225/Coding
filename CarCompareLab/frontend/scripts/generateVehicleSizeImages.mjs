import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { mockVehicles } from '../src/data/mockVehicles.ts'
import { vehicleSpecs } from '../src/data/vehicleSpecs.ts'

const outputDir = path.resolve('public', 'vehicle-size-images')
const manifestPath = path.resolve('src', 'data', 'vehicleSizeImages.ts')
const sourceName = '다나와 자동차 제원'

const specGroupName = '제원'
const dimensionKeys = {
  lengthMm: '전장',
  widthMm: '전폭',
  heightMm: '전고',
  wheelbaseMm: '축거',
}

const parseMm = (value) => {
  if (!value) return null

  const numberText = String(value).match(/[\d,]+(?:\.\d+)?/)?.[0]
  if (!numberText) return null

  const parsed = Number(numberText.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^0-9a-z가-힣]+/gi, '-')
    .replace(/^-+|-+$/g, '')

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const findBestTrim = (spec) => {
  if (!spec) return null

  return (
    spec.trims.find((trim) => {
      const dimensions = trim.specs[specGroupName] ?? {}
      return parseMm(dimensions[dimensionKeys.lengthMm]) && parseMm(dimensions[dimensionKeys.heightMm])
    }) ??
    spec.trims.find((trim) => trim.specs[specGroupName]) ??
    null
  )
}

const getDimensions = (spec) => {
  const trim = findBestTrim(spec)
  const dimensions = trim?.specs[specGroupName] ?? {}

  return {
    lengthMm: parseMm(dimensions[dimensionKeys.lengthMm]),
    widthMm: parseMm(dimensions[dimensionKeys.widthMm]),
    heightMm: parseMm(dimensions[dimensionKeys.heightMm]),
    wheelbaseMm: parseMm(dimensions[dimensionKeys.wheelbaseMm]),
  }
}

const includesAny = (value, keywords) =>
  keywords.some((keyword) => value.toLowerCase().includes(keyword.toLowerCase()))

const getVehicleClass = (vehicle, dimensions) => {
  const name = `${vehicle.brand} ${vehicle.model}`
  const length = dimensions.lengthMm ?? 4500
  const height = dimensions.heightMm ?? 1600

  if (
    includesAny(name, [
      '포터',
      '봉고',
      '마이티',
      '파비스',
      '엑시언트',
      '트럭',
      'truck',
      'ranger',
      'gladiator',
    ])
  ) {
    return 'truck'
  }

  if (includesAny(name, ['카니발', '스타리아', 'staria', 'pv5', 'id.buzz', '다니고'])) {
    return 'van'
  }

  if (height >= 1660 || includesAny(name, ['suv', '쏘렌토', '스포티지', '싼타페', '투싼', '팰리세이드', 'ev9', 'gv'])) {
    return 'suv'
  }

  if (height <= 1360 || includesAny(name, ['911', '박스터', '카이맨', 'sl', 'amg gt', 'mx-5'])) {
    return 'sports'
  }

  if (length >= 4950) return 'large-sedan'
  return 'sedan'
}

const paletteByClass = {
  sedan: { body: '#1b765d', glass: '#c7e7ec', line: '#0d3e33', trim: '#dbe5dc', wheel: '#161d1a' },
  'large-sedan': { body: '#1c6f6a', glass: '#c9e7ef', line: '#123f3d', trim: '#dce5e2', wheel: '#161d1a' },
  suv: { body: '#266f52', glass: '#d3e9ef', line: '#123b30', trim: '#dce6da', wheel: '#171d1b' },
  van: { body: '#607565', glass: '#dcebef', line: '#303e34', trim: '#edf2e9', wheel: '#171d1b' },
  truck: { body: '#68715f', glass: '#e0ebec', line: '#30352e', trim: '#eef0e8', wheel: '#171d1b' },
  sports: { body: '#205f72', glass: '#d2e8f2', line: '#123a45', trim: '#dce7eb', wheel: '#171d1b' },
  placeholder: { body: '#c8d1c3', glass: '#eef2ec', line: '#7a8675', trim: '#eef2ec', wheel: '#828b7f' },
}

const getDesignProfile = (vehicle, vehicleClass) => {
  const name = `${vehicle.brand} ${vehicle.model}`.toLowerCase()

  if (includesAny(name, ['model y'])) return 'fastback-crossover'
  if (includesAny(name, ['쏘렌토', 'ev5', 'ev9', 'telluride'])) return 'upright-suv'
  if (includesAny(name, ['싼타페', '팰리세이드', 'defender', 'g-class'])) return 'boxy-suv'
  if (includesAny(name, ['스포티지', '투싼', '코나', '셀토스', 'xm3', 'arkana'])) return 'compact-swept-suv'
  if (includesAny(name, ['그랜저', 'k8', 'g80', 'eqe', 's-class', '7 series'])) return 'long-sedan'
  if (includesAny(name, ['아반떼', 'k4', 'k3', 'civic', 'corolla'])) return 'compact-sedan'
  if (includesAny(name, ['카니발', '스타리아', 'id.buzz'])) return 'long-mpv'
  if (includesAny(name, ['ioniq 5', '아이오닉 5', 'ev6'])) return 'sharp-ev'
  if (includesAny(name, ['911', 'boxster', 'cayman', 'mx-5', 'amg gt'])) return 'low-sports'

  return vehicleClass
}

const buildProfileGeometry = (profile, baseY, bodyLength, bodyHeight) => {
  const y = (ratio) => Math.round(baseY - bodyHeight * ratio)
  const x = (ratio) => Math.round(bodyLength * ratio)
  const bottom = baseY - Math.max(105, Math.round(bodyHeight * 0.07))
  const nose = Math.max(80, Math.round(bodyLength * 0.025))
  const tail = bodyLength - nose

  if (profile === 'fastback-crossover') {
    return {
      bodyPath: [
        `M ${nose} ${bottom}`,
        `C ${x(0.08)} ${y(0.24)}, ${x(0.2)} ${y(0.38)}, ${x(0.33)} ${y(0.44)}`,
        `C ${x(0.42)} ${y(0.82)}, ${x(0.6)} ${y(0.93)}, ${x(0.77)} ${y(0.58)}`,
        `C ${x(0.89)} ${y(0.46)}, ${x(0.96)} ${y(0.31)}, ${tail} ${bottom}`,
        'Z',
      ].join(' '),
      glassPath: [
        `M ${x(0.31)} ${y(0.5)}`,
        `C ${x(0.43)} ${y(0.79)}, ${x(0.58)} ${y(0.84)}, ${x(0.73)} ${y(0.58)}`,
        `L ${x(0.79)} ${y(0.43)}`,
        `L ${x(0.28)} ${y(0.43)}`,
        'Z',
      ].join(' '),
      hoodLine: `M ${x(0.72)} ${y(0.41)} L ${x(0.91)} ${y(0.32)}`,
      doorLine: `M ${x(0.52)} ${y(0.44)} L ${x(0.52)} ${bottom}`,
      accentPaths: [
        `M ${x(0.16)} ${y(0.25)} C ${x(0.38)} ${y(0.18)}, ${x(0.66)} ${y(0.2)}, ${x(0.88)} ${y(0.25)}`,
      ],
    }
  }

  if (profile === 'upright-suv') {
    return {
      bodyPath: [
        `M ${nose} ${bottom}`,
        `C ${x(0.06)} ${y(0.3)}, ${x(0.13)} ${y(0.44)}, ${x(0.25)} ${y(0.52)}`,
        `L ${x(0.36)} ${y(0.8)}`,
        `C ${x(0.46)} ${y(0.91)}, ${x(0.67)} ${y(0.9)}, ${x(0.78)} ${y(0.67)}`,
        `L ${x(0.91)} ${y(0.56)}`,
        `C ${x(0.96)} ${y(0.46)}, ${x(0.98)} ${y(0.28)}, ${tail} ${bottom}`,
        'Z',
      ].join(' '),
      glassPath: [
        `M ${x(0.31)} ${y(0.57)}`,
        `L ${x(0.42)} ${y(0.77)}`,
        `L ${x(0.68)} ${y(0.77)}`,
        `L ${x(0.8)} ${y(0.57)}`,
        `L ${x(0.74)} ${y(0.49)}`,
        `L ${x(0.33)} ${y(0.49)}`,
        'Z',
      ].join(' '),
      hoodLine: `M ${x(0.74)} ${y(0.49)} L ${x(0.91)} ${y(0.43)}`,
      doorLine: `M ${x(0.55)} ${y(0.56)} L ${x(0.55)} ${bottom}`,
      accentPaths: [
        `M ${x(0.16)} ${y(0.25)} L ${x(0.83)} ${y(0.25)}`,
        `M ${x(0.19)} ${y(0.37)} L ${x(0.31)} ${y(0.41)}`,
      ],
    }
  }

  if (profile === 'boxy-suv') {
    return {
      bodyPath: [
        `M ${nose} ${bottom}`,
        `L ${x(0.08)} ${y(0.34)}`,
        `L ${x(0.27)} ${y(0.52)}`,
        `L ${x(0.35)} ${y(0.84)}`,
        `L ${x(0.73)} ${y(0.84)}`,
        `L ${x(0.9)} ${y(0.58)}`,
        `L ${tail} ${bottom}`,
        'Z',
      ].join(' '),
      glassPath: [
        `M ${x(0.32)} ${y(0.58)}`,
        `L ${x(0.39)} ${y(0.76)}`,
        `L ${x(0.7)} ${y(0.76)}`,
        `L ${x(0.82)} ${y(0.58)}`,
        'Z',
      ].join(' '),
      hoodLine: `M ${x(0.75)} ${y(0.5)} L ${x(0.91)} ${y(0.42)}`,
      doorLine: `M ${x(0.55)} ${y(0.57)} L ${x(0.55)} ${bottom}`,
      accentPaths: [`M ${x(0.12)} ${y(0.2)} L ${x(0.88)} ${y(0.2)}`],
    }
  }

  if (profile === 'compact-swept-suv') {
    return {
      bodyPath: [
        `M ${nose} ${bottom}`,
        `C ${x(0.08)} ${y(0.27)}, ${x(0.17)} ${y(0.39)}, ${x(0.29)} ${y(0.47)}`,
        `L ${x(0.39)} ${y(0.76)}`,
        `C ${x(0.49)} ${y(0.88)}, ${x(0.66)} ${y(0.85)}, ${x(0.78)} ${y(0.56)}`,
        `C ${x(0.9)} ${y(0.5)}, ${x(0.97)} ${y(0.34)}, ${tail} ${bottom}`,
        'Z',
      ].join(' '),
      glassPath: [
        `M ${x(0.34)} ${y(0.53)}`,
        `L ${x(0.43)} ${y(0.72)}`,
        `C ${x(0.52)} ${y(0.78)}, ${x(0.65)} ${y(0.75)}, ${x(0.75)} ${y(0.53)}`,
        'Z',
      ].join(' '),
      hoodLine: `M ${x(0.75)} ${y(0.46)} L ${x(0.91)} ${y(0.36)}`,
      doorLine: `M ${x(0.55)} ${y(0.52)} L ${x(0.55)} ${bottom}`,
      accentPaths: [`M ${x(0.18)} ${y(0.29)} C ${x(0.38)} ${y(0.22)}, ${x(0.65)} ${y(0.23)}, ${x(0.84)} ${y(0.3)}`],
    }
  }

  if (profile === 'long-sedan') {
    return {
      bodyPath: [
        `M ${nose} ${bottom}`,
        `C ${x(0.1)} ${y(0.22)}, ${x(0.22)} ${y(0.33)}, ${x(0.36)} ${y(0.39)}`,
        `C ${x(0.45)} ${y(0.68)}, ${x(0.6)} ${y(0.76)}, ${x(0.73)} ${y(0.53)}`,
        `C ${x(0.84)} ${y(0.45)}, ${x(0.94)} ${y(0.31)}, ${tail} ${bottom}`,
        'Z',
      ].join(' '),
      glassPath: [
        `M ${x(0.37)} ${y(0.45)}`,
        `C ${x(0.46)} ${y(0.66)}, ${x(0.59)} ${y(0.69)}, ${x(0.7)} ${y(0.49)}`,
        `L ${x(0.76)} ${y(0.39)}`,
        `L ${x(0.34)} ${y(0.39)}`,
        'Z',
      ].join(' '),
      hoodLine: `M ${x(0.72)} ${y(0.36)} L ${x(0.91)} ${y(0.27)}`,
      doorLine: `M ${x(0.54)} ${y(0.4)} L ${x(0.54)} ${bottom}`,
      accentPaths: [`M ${x(0.15)} ${y(0.2)} C ${x(0.42)} ${y(0.14)}, ${x(0.68)} ${y(0.16)}, ${x(0.9)} ${y(0.24)}`],
    }
  }

  if (profile === 'long-mpv') {
    return {
      bodyPath: [
        `M ${nose} ${bottom}`,
        `C ${x(0.04)} ${y(0.36)}, ${x(0.08)} ${y(0.52)}, ${x(0.16)} ${y(0.65)}`,
        `C ${x(0.28)} ${y(0.87)}, ${x(0.58)} ${y(0.9)}, ${x(0.82)} ${y(0.72)}`,
        `C ${x(0.93)} ${y(0.6)}, ${x(0.98)} ${y(0.38)}, ${tail} ${bottom}`,
        'Z',
      ].join(' '),
      glassPath: [
        `M ${x(0.18)} ${y(0.58)}`,
        `C ${x(0.3)} ${y(0.76)}, ${x(0.55)} ${y(0.8)}, ${x(0.8)} ${y(0.65)}`,
        `L ${x(0.84)} ${y(0.52)}`,
        `L ${x(0.16)} ${y(0.5)}`,
        'Z',
      ].join(' '),
      hoodLine: `M ${x(0.79)} ${y(0.5)} L ${x(0.94)} ${y(0.38)}`,
      doorLine: `M ${x(0.47)} ${y(0.52)} L ${x(0.47)} ${bottom}`,
      accentPaths: [`M ${x(0.18)} ${y(0.27)} L ${x(0.82)} ${y(0.27)}`],
    }
  }

  if (profile === 'sharp-ev') {
    return {
      bodyPath: [
        `M ${nose} ${bottom}`,
        `L ${x(0.13)} ${y(0.32)}`,
        `L ${x(0.34)} ${y(0.48)}`,
        `L ${x(0.43)} ${y(0.72)}`,
        `L ${x(0.66)} ${y(0.72)}`,
        `L ${x(0.82)} ${y(0.48)}`,
        `L ${tail} ${bottom}`,
        'Z',
      ].join(' '),
      glassPath: [
        `M ${x(0.37)} ${y(0.5)}`,
        `L ${x(0.46)} ${y(0.66)}`,
        `L ${x(0.65)} ${y(0.66)}`,
        `L ${x(0.75)} ${y(0.5)}`,
        'Z',
      ].join(' '),
      hoodLine: `M ${x(0.75)} ${y(0.43)} L ${x(0.9)} ${y(0.34)}`,
      doorLine: `M ${x(0.55)} ${y(0.49)} L ${x(0.55)} ${bottom}`,
      accentPaths: [
        `M ${x(0.15)} ${y(0.2)} L ${x(0.42)} ${y(0.28)} L ${x(0.82)} ${y(0.22)}`,
      ],
    }
  }

  if (profile === 'compact-sedan') {
    return {
      bodyPath: [
        `M ${nose} ${bottom}`,
        `C ${x(0.09)} ${y(0.22)}, ${x(0.2)} ${y(0.33)}, ${x(0.32)} ${y(0.39)}`,
        `C ${x(0.41)} ${y(0.66)}, ${x(0.56)} ${y(0.74)}, ${x(0.69)} ${y(0.53)}`,
        `C ${x(0.82)} ${y(0.46)}, ${x(0.94)} ${y(0.3)}, ${tail} ${bottom}`,
        'Z',
      ].join(' '),
      glassPath: [
        `M ${x(0.35)} ${y(0.44)}`,
        `C ${x(0.44)} ${y(0.63)}, ${x(0.56)} ${y(0.66)}, ${x(0.67)} ${y(0.49)}`,
        `L ${x(0.72)} ${y(0.4)}`,
        `L ${x(0.32)} ${y(0.39)}`,
        'Z',
      ].join(' '),
      hoodLine: `M ${x(0.7)} ${y(0.37)} L ${x(0.9)} ${y(0.28)}`,
      doorLine: `M ${x(0.52)} ${y(0.41)} L ${x(0.52)} ${bottom}`,
      accentPaths: [`M ${x(0.18)} ${y(0.22)} C ${x(0.42)} ${y(0.17)}, ${x(0.65)} ${y(0.18)}, ${x(0.86)} ${y(0.25)}`],
    }
  }

  if (profile === 'truck') {
    return {
      bodyPath: [
        `M ${nose} ${bottom}`,
        `L ${nose} ${y(0.56)}`,
        `L ${x(0.29)} ${y(0.56)}`,
        `L ${x(0.36)} ${y(0.86)}`,
        `L ${x(0.48)} ${y(0.86)}`,
        `L ${x(0.54)} ${y(0.56)}`,
        `L ${tail} ${y(0.56)}`,
        `L ${tail} ${bottom}`,
        'Z',
      ].join(' '),
      glassPath: [
        `M ${x(0.34)} ${y(0.61)}`,
        `L ${x(0.39)} ${y(0.8)}`,
        `L ${x(0.47)} ${y(0.8)}`,
        `L ${x(0.5)} ${y(0.61)}`,
        'Z',
      ].join(' '),
      hoodLine: `M ${x(0.55)} ${y(0.54)} L ${x(0.93)} ${y(0.54)}`,
      doorLine: `M ${x(0.52)} ${y(0.55)} L ${x(0.52)} ${bottom}`,
    }
  }

  if (profile === 'van') {
    return {
      bodyPath: [
        `M ${nose} ${bottom}`,
        `C ${x(0.04)} ${y(0.33)}, ${x(0.08)} ${y(0.47)}, ${x(0.14)} ${y(0.62)}`,
        `C ${x(0.23)} ${y(0.82)}, ${x(0.45)} ${y(0.9)}, ${x(0.73)} ${y(0.86)}`,
        `C ${x(0.88)} ${y(0.78)}, ${x(0.96)} ${y(0.55)}, ${tail} ${bottom}`,
        'Z',
      ].join(' '),
      glassPath: [
        `M ${x(0.18)} ${y(0.58)}`,
        `C ${x(0.27)} ${y(0.76)}, ${x(0.45)} ${y(0.82)}, ${x(0.72)} ${y(0.79)}`,
        `L ${x(0.79)} ${y(0.58)}`,
        `L ${x(0.16)} ${y(0.52)}`,
        'Z',
      ].join(' '),
      hoodLine: `M ${x(0.78)} ${y(0.5)} L ${x(0.94)} ${y(0.36)}`,
      doorLine: `M ${x(0.42)} ${y(0.54)} L ${x(0.42)} ${bottom}`,
    }
  }

  if (profile === 'suv') {
    return {
      bodyPath: [
        `M ${nose} ${bottom}`,
        `C ${x(0.07)} ${y(0.28)}, ${x(0.13)} ${y(0.4)}, ${x(0.24)} ${y(0.48)}`,
        `L ${x(0.34)} ${y(0.78)}`,
        `C ${x(0.46)} ${y(0.9)}, ${x(0.67)} ${y(0.89)}, ${x(0.79)} ${y(0.55)}`,
        `C ${x(0.91)} ${y(0.49)}, ${x(0.97)} ${y(0.34)}, ${tail} ${bottom}`,
        'Z',
      ].join(' '),
      glassPath: [
        `M ${x(0.32)} ${y(0.55)}`,
        `L ${x(0.41)} ${y(0.76)}`,
        `C ${x(0.5)} ${y(0.82)}, ${x(0.65)} ${y(0.81)}, ${x(0.74)} ${y(0.55)}`,
        'Z',
      ].join(' '),
      hoodLine: `M ${x(0.76)} ${y(0.48)} L ${x(0.91)} ${y(0.39)}`,
      doorLine: `M ${x(0.55)} ${y(0.56)} L ${x(0.55)} ${bottom}`,
    }
  }

  if (profile === 'sports' || profile === 'low-sports') {
    return {
      bodyPath: [
        `M ${nose} ${bottom}`,
        `C ${x(0.1)} ${y(0.25)}, ${x(0.22)} ${y(0.34)}, ${x(0.34)} ${y(0.38)}`,
        `C ${x(0.42)} ${y(0.68)}, ${x(0.57)} ${y(0.75)}, ${x(0.69)} ${y(0.43)}`,
        `C ${x(0.83)} ${y(0.38)}, ${x(0.94)} ${y(0.27)}, ${tail} ${bottom}`,
        'Z',
      ].join(' '),
      glassPath: [
        `M ${x(0.39)} ${y(0.43)}`,
        `C ${x(0.47)} ${y(0.64)}, ${x(0.58)} ${y(0.66)}, ${x(0.66)} ${y(0.43)}`,
        'Z',
      ].join(' '),
      hoodLine: `M ${x(0.69)} ${y(0.37)} L ${x(0.91)} ${y(0.27)}`,
      doorLine: `M ${x(0.55)} ${y(0.42)} L ${x(0.55)} ${bottom}`,
    }
  }

  return {
    bodyPath: [
      `M ${nose} ${bottom}`,
      `C ${x(0.08)} ${y(0.23)}, ${x(0.17)} ${y(0.34)}, ${x(0.28)} ${y(0.4)}`,
      `C ${x(0.37)} ${y(0.72)}, ${x(0.51)} ${y(0.84)}, ${x(0.66)} ${y(0.7)}`,
      `C ${x(0.75)} ${y(0.48)}, ${x(0.88)} ${y(0.4)}, ${tail} ${bottom}`,
      'Z',
    ].join(' '),
    glassPath: [
      `M ${x(0.34)} ${y(0.46)}`,
      `C ${x(0.43)} ${y(0.68)}, ${x(0.54)} ${y(0.74)}, ${x(0.64)} ${y(0.58)}`,
      `L ${x(0.71)} ${y(0.44)}`,
      'Z',
    ].join(' '),
    hoodLine: `M ${x(0.69)} ${y(0.39)} L ${x(0.9)} ${y(0.3)}`,
    doorLine: `M ${x(0.52)} ${y(0.45)} L ${x(0.52)} ${bottom}`,
  }
}

const createWheel = ({ cx, cy, radius, palette }) => `<g>
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${palette.wheel}"/>
    <circle cx="${cx}" cy="${cy}" r="${radius * 0.72}" fill="#27312d"/>
    <circle cx="${cx}" cy="${cy}" r="${radius * 0.38}" fill="${palette.trim}"/>
    <circle cx="${cx}" cy="${cy}" r="${radius * 0.15}" fill="${palette.line}"/>
  </g>`

const createSvg = ({ vehicle, dimensions, hasCoreDimensions }) => {
  const width = 940
  const height = 360
  const viewBoxWidth = 9400
  const viewBoxHeight = 3600
  const baseY = 3000
  const paddingX = 300
  const lengthForDrawing = hasCoreDimensions ? dimensions.lengthMm : 4500
  const heightForDrawing = hasCoreDimensions ? dimensions.heightMm : 1600
  const bodyLength = lengthForDrawing
  const bodyHeight = heightForDrawing
  const vehicleClass = getVehicleClass(vehicle, dimensions)
  const designProfile = getDesignProfile(vehicle, vehicleClass)
  const palette = hasCoreDimensions ? paletteByClass[vehicleClass] : paletteByClass.placeholder
  const wheelbaseRatio =
    hasCoreDimensions && dimensions.wheelbaseMm && dimensions.lengthMm
      ? dimensions.wheelbaseMm / dimensions.lengthMm
      : 0.59
  const frontWheelX = Math.round(bodyLength * (0.5 + wheelbaseRatio / 2))
  const rearWheelX = Math.round(bodyLength * (0.5 - wheelbaseRatio / 2))
  const wheelRadius = Math.max(155, Math.min(325, bodyHeight * 0.16))
  const geometry = buildProfileGeometry(designProfile, baseY, bodyLength, bodyHeight)
  const label = `${vehicle.brand} ${vehicle.model}`
  const dimensionsText = hasCoreDimensions
    ? `${dimensions.lengthMm} x ${dimensions.widthMm ?? '?'} x ${dimensions.heightMm} mm`
    : '치수 정보 없음'

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(label)} 측면 실제 크기 비교 이미지</title>
  <desc id="desc">${escapeXml(dimensionsText)}</desc>
  <g transform="translate(${paddingX}, 0)">
    <ellipse cx="${bodyLength * 0.5}" cy="${baseY + wheelRadius * 0.86}" rx="${bodyLength * 0.47}" ry="95" fill="#10231c" opacity="0.16"/>
    <path d="${geometry.bodyPath}" fill="${palette.body}" stroke="${palette.line}" stroke-width="46" stroke-linejoin="round"/>
    <path d="${geometry.bodyPath}" fill="url(#paint)" opacity="0.28"/>
    <path d="${geometry.glassPath}" fill="${palette.glass}" stroke="${palette.line}" stroke-width="34" stroke-linejoin="round"/>
    <path d="${geometry.hoodLine}" fill="none" stroke="${palette.line}" stroke-width="28" stroke-linecap="round" opacity="0.65"/>
    <path d="${geometry.doorLine}" fill="none" stroke="${palette.line}" stroke-width="24" stroke-linecap="round" opacity="0.55"/>
    ${(geometry.accentPaths ?? [])
      .map(
        (accentPath) =>
          `<path d="${accentPath}" fill="none" stroke="${palette.line}" stroke-width="22" stroke-linecap="round" opacity="0.28"/>`,
      )
      .join('\n    ')}
    <path d="M ${bodyLength * 0.18} ${baseY - bodyHeight * 0.12} L ${bodyLength * 0.84} ${baseY - bodyHeight * 0.12}" fill="none" stroke="${palette.trim}" stroke-width="30" stroke-linecap="round" opacity="0.7"/>
    <rect x="${bodyLength * 0.035}" y="${baseY - bodyHeight * 0.23}" width="${bodyLength * 0.045}" height="${bodyHeight * 0.075}" rx="16" fill="#d64d37" opacity="0.9"/>
    <rect x="${bodyLength * 0.91}" y="${baseY - bodyHeight * 0.25}" width="${bodyLength * 0.05}" height="${bodyHeight * 0.07}" rx="16" fill="#f1e6b0" opacity="0.95"/>
    ${createWheel({ cx: rearWheelX, cy: baseY, radius: wheelRadius, palette })}
    ${createWheel({ cx: frontWheelX, cy: baseY, radius: wheelRadius, palette })}
    <path d="M ${rearWheelX - wheelRadius * 1.4} ${baseY - wheelRadius * 0.12} C ${rearWheelX - wheelRadius} ${baseY - wheelRadius * 1.22}, ${rearWheelX + wheelRadius} ${baseY - wheelRadius * 1.22}, ${rearWheelX + wheelRadius * 1.4} ${baseY - wheelRadius * 0.12}" fill="none" stroke="${palette.line}" stroke-width="34" stroke-linecap="round"/>
    <path d="M ${frontWheelX - wheelRadius * 1.4} ${baseY - wheelRadius * 0.12} C ${frontWheelX - wheelRadius} ${baseY - wheelRadius * 1.22}, ${frontWheelX + wheelRadius} ${baseY - wheelRadius * 1.22}, ${frontWheelX + wheelRadius * 1.4} ${baseY - wheelRadius * 0.12}" fill="none" stroke="${palette.line}" stroke-width="34" stroke-linecap="round"/>
  </g>
  <defs>
    <linearGradient id="paint" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.52" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.26"/>
    </linearGradient>
  </defs>
</svg>
`
}

await mkdir(outputDir, { recursive: true })

const specsByVehicleId = new Map(vehicleSpecs.map((spec) => [spec.vehicleId, spec]))
const manifest = []
let generatedWithDimensions = 0
let placeholders = 0

for (const vehicle of mockVehicles) {
  const spec = specsByVehicleId.get(vehicle.id)
  const dimensions = getDimensions(spec)
  const hasCoreDimensions = Boolean(dimensions.lengthMm && dimensions.heightMm)
  const fileName = `${slugify(vehicle.id)}.svg`
  const svg = createSvg({ vehicle, dimensions, hasCoreDimensions })

  await writeFile(path.join(outputDir, fileName), svg, 'utf8')

  if (hasCoreDimensions) generatedWithDimensions += 1
  else placeholders += 1

  manifest.push({
    vehicleId: vehicle.id,
    brand: vehicle.brand,
    model: vehicle.model,
    imageUrl: `/vehicle-size-images/${fileName}`,
    imageAlt: `${vehicle.brand} ${vehicle.model} 측면 크기 비교 이미지`,
    view: 'side',
    assetType: hasCoreDimensions
      ? 'generated-2d-scale-svg'
      : 'missing-dimensions-placeholder',
    lengthMm: dimensions.lengthMm,
    widthMm: dimensions.widthMm,
    heightMm: dimensions.heightMm,
    wheelbaseMm: dimensions.wheelbaseMm,
    sourceName: spec?.sourceName ?? sourceName,
    sourceCheckedAt: spec?.sourceCheckedAt ?? null,
  })
}

const output = `import type { VehicleSizeImageAsset } from '../types/vehicleSizeImage'\n\nexport const vehicleSizeImages: VehicleSizeImageAsset[] = ${JSON.stringify(
  manifest,
  null,
  2,
)}\n`

await writeFile(manifestPath, output, 'utf8')

console.log(
  JSON.stringify(
    {
      total: manifest.length,
      generatedWithDimensions,
      placeholders,
      outputDir,
      manifestPath,
    },
    null,
    2,
  ),
)
