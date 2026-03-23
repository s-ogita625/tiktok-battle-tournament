// YYYY-MM-DD 形式で今日の日付を返す
export function today() {
  return new Date().toISOString().split('T')[0]
}

// YYYY-MM-DD を "MM/DD (曜日)" 形式にフォーマット
export function formatDate(dateStr) {
  if (!dateStr) return '日程未定'
  const date = new Date(dateStr + 'T00:00:00')
  const days = ['日', '月', '火', '水', '木', '金', '土']
  const month = date.getMonth() + 1
  const day = date.getDate()
  const dow = days[date.getDay()]
  return `${month}/${day} (${dow})`
}

// YYYY-MM-DD の配列から重複を除いてソートして返す
export function uniqueSortedDates(dates) {
  return [...new Set(dates)].sort()
}

// 2つの日付配列の共通要素（両者が可能な日）を返す
export function intersectDates(dates1, dates2) {
  const set2 = new Set(dates2)
  return dates1.filter(d => set2.has(d))
}

// 除外リストを適用した候補日を返す
export function filterOutDates(candidates, excludes) {
  const excludeSet = new Set(excludes)
  return candidates.filter(d => !excludeSet.has(d))
}

// 日付が週末（土日）かどうか
export function isWeekend(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  const dow = date.getDay()
  return dow === 0 || dow === 6
}

// 日付が金曜日かどうか
export function isFriday(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.getDay() === 5
}

// 2つの日付文字列を比較（ソート用）
export function compareDates(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}
