const preferredBrandOrder: string[] = [
  '현대',
  '기아',
  '제네시스',
  '르노코리아',
  'KGM',
  '쉐보레',
  'BMW',
  '벤츠',
  '테슬라',
  '렉서스',
  '볼보',
  '아우디',
  'BYD',
  '토요타',
  '폭스바겐',
  '미니',
  '포르쉐',
  '랜드로버',
  '폴스타',
  'GMC',
  '푸조',
  '지프',
  '포드',
  '벤틀리',
  '캐딜락',
  '혼다',
  '지커',
  '램',
  '페라리',
  '링컨',
  '마세라티',
  '람보르기니',
  '로터스',
  '롤스로이스',
  '쏠테로',
  '동풍',
  '루시드',
  '애스턴마틴',
  '모빌리티네트웍스',
  '코닉세그',
  '이네오스',
  '대창모터스',
  '맥라렌',
  '빈패스트',
  '디피코',
  '이스즈',
  '리비안',
  'EVKMC',
  '제이스모빌리티',
  '피스커',
  'SMART EV',
  '쎄보모빌리티',
  '마이브',
  '이비온',
  '마스타전기차',
  '에스에스라이트',
  '자일자동차',
  '리막',
  '이베코',
  '시트로엥',
  '재규어',
  'DS',
]

const brandOrderMap = new Map(
  preferredBrandOrder.map((brand, index) => [brand, index]),
)

export const compareBrandsByPreferredOrder = (
  firstBrand: string,
  secondBrand: string,
) => {
  const firstOrder = brandOrderMap.get(firstBrand)
  const secondOrder = brandOrderMap.get(secondBrand)

  if (firstOrder !== undefined && secondOrder !== undefined) {
    return firstOrder - secondOrder
  }

  if (firstOrder !== undefined) {
    return -1
  }

  if (secondOrder !== undefined) {
    return 1
  }

  return firstBrand.localeCompare(secondBrand, 'ko-KR', { numeric: true })
}
