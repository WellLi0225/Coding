import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { mockVehicles } from '../src/data/mockVehicles.ts'

const outputPath = path.resolve('..', 'docs', 'vehicle-image-file-names.md')

const rows = mockVehicles
  .map((vehicle) => ({
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.modelYearLabel ?? `${vehicle.year}년형`,
    id: vehicle.id,
    png: `${vehicle.id}.png`,
    webp: `${vehicle.id}.webp`,
  }))
  .sort((first, second) =>
    `${first.brand} ${first.model}`.localeCompare(`${second.brand} ${second.model}`, 'ko-KR'),
  )

const output = `# 차량 실제 측면 이미지 파일명 목록

이미지를 \`frontend/public/vehicle-real-side-images\` 폴더에 넣을 때 아래 파일명 중 하나로 저장하면 됩니다.

예: \`기아-쏘렌토-4563.png\`

| 브랜드 | 모델 | 연식 | 차량 ID | PNG 파일명 | WEBP 파일명 |
| --- | --- | --- | --- | --- | --- |
${rows
  .map(
    (row) =>
      `| ${row.brand} | ${row.model} | ${row.year} | \`${row.id}\` | \`${row.png}\` | \`${row.webp}\` |`,
  )
  .join('\n')}
`

await writeFile(outputPath, output, 'utf8')

console.log(
  JSON.stringify(
    {
      total: rows.length,
      outputPath,
    },
    null,
    2,
  ),
)
