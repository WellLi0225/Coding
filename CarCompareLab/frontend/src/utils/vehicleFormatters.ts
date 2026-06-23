export const formatCurrency = (value: number | null) => {
  if (value === null) {
    return '정보 없음'
  }

  return `${new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 0,
  }).format(value)}달러`
}

export const formatNullable = (value: number | null, suffix = '') =>
  value === null ? '정보 없음' : `${value}${suffix}`

export const formatWon = (value: number) => {
  if (value >= 10000) {
    return `${new Intl.NumberFormat('ko-KR').format(value / 10000)}만원`
  }

  return `${new Intl.NumberFormat('ko-KR').format(value)}만원`
}
