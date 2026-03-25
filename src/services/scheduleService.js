import { intersectDates, filterOutDates, isWeekend, isFriday, compareDates, getDatePart, isBlockedBy, isAllowedBy, getTimePart } from '../utils/dateUtils.js'

/**
 * 共通の候補日+時刻を選ぶ共通ロジック
 * availEntries: 可能日エントリ配列（終日 or 時間帯付き）
 * unavailEntries: NG日エントリ配列（終日 or 時間帯付き）
 *
 * 優先ルール：
 * 1. 両者の可能日に日付が一致
 * 2. その日のNG時間帯を除外
 * 3. 可能日に時間帯指定があれば、その時間帯のみOK（両者の和集合）
 */
function pickBestDateAndTime(candidates, allTimes, existingBattles, unavailEntries = [], availEntries1 = [], availEntries2 = []) {
  if (candidates.length === 0) {
    return { date: null, time: allTimes[0] }
  }

  const scored = candidates.map(date => {
    let score = 1.0
    if (isWeekend(date)) score += 0.3
    if (isFriday(date))  score += 0.2
    const idx = candidates.indexOf(date)
    score += (candidates.length - idx) * 0.05
    const battlesOnDate = existingBattles.filter(b => b.scheduledDate === date)
    score -= battlesOnDate.length * 0.2
    return { date, score }
  })

  scored.sort((a, b) => b.score - a.score)

  for (const { date } of scored) {
    const usedTimes = existingBattles
      .filter(b => b.scheduledDate === date)
      .map(b => b.scheduledTime)

    // 可能日エントリのうちこの日付のもの
    const dayAvail1 = availEntries1.filter(e => getDatePart(e) === date)
    const dayAvail2 = availEntries2.filter(e => getDatePart(e) === date)

    // どちらかが時間帯指定の可能日を持つかチェック
    const hasTimedAvail1 = dayAvail1.some(e => !!getTimePart(e))
    const hasTimedAvail2 = dayAvail2.some(e => !!getTimePart(e))

    const time = allTimes.find(t => {
      if (usedTimes.includes(t)) return false
      if (unavailEntries.some(e => isBlockedBy(e, date, t))) return false
      // p1 が時間帯指定の可能日を持つ場合、その時間帯内でないとNG
      if (hasTimedAvail1 && !dayAvail1.some(e => isAllowedBy(e, date, t))) return false
      // p2 が時間帯指定の可能日を持つ場合、その時間帯内でないとNG
      if (hasTimedAvail2 && !dayAvail2.some(e => isAllowedBy(e, date, t))) return false
      return true
    })
    if (time !== undefined) return { date, time }
  }

  // フォールバック：最初の候補日・最後の時刻
  const bestDate = scored[0].date
  const usedTimes = existingBattles
    .filter(b => b.scheduledDate === bestDate)
    .map(b => b.scheduledTime)
  const time = allTimes.find(t => !usedTimes.includes(t)) || allTimes[allTimes.length - 1]
  return { date: bestDate, time }
}

/**
 * 2人の参加者の対戦日程を自動で決定する（グループ戦用）
 * @param {object} p1 - 参加者1
 * @param {object} p2 - 参加者2
 * @param {object} settings - アプリ設定
 * @param {Array} existingBattles - 同グループ内の既存バトル（重複を避けるため）
 * @returns {{ date: string|null, time: string }}
 */
export function scheduleGroupBattles(p1, p2, settings, existingBattles = []) {
  const avail1   = p1.availableDates   || []
  const avail2   = p2.availableDates   || []
  const unavail1 = p1.unavailableDates || []
  const unavail2 = p2.unavailableDates || []
  const allTimes = settings.defaultBattleTimes || ['21:00', '21:30', '22:00', '22:30', '23:00', '23:30']

  // 終日NG or 時間帯NG
  const allUnavail = [...unavail1, ...unavail2]
  // 終日NG の日付は候補から完全除外
  const allDayUnavail = allUnavail.filter(e => !e.includes('|'))

  // 可能日：日付部分のみで共通候補を作る（時間帯指定も含む）
  const avail1Dates = avail1.map(e => getDatePart(e))
  const avail2Dates = avail2.map(e => getDatePart(e))
  let candidates = intersectDates(avail1Dates, avail2Dates)
  candidates = filterOutDates(candidates, allDayUnavail.map(e => getDatePart(e)))
  candidates = [...new Set(candidates)].sort(compareDates)

  return pickBestDateAndTime(candidates, allTimes, existingBattles, allUnavail, avail1, avail2)
}

/**
 * 2人の参加者のトーナメント対戦日程を自動で決定する
 * tournamentAvailableDates / tournamentUnavailableDates を使用する。
 * 未設定の場合は availableDates / unavailableDates にフォールバック。
 *
 * @param {object} p1 - 参加者1
 * @param {object} p2 - 参加者2
 * @param {object} settings - アプリ設定
 * @param {Array} existingBattles - 既存バトル（重複を避けるため）
 * @returns {{ date: string|null, time: string }}
 */
export function scheduleTournamentBattle(p1, p2, settings, existingBattles = []) {
  const avail1   = (p1.tournamentAvailableDates   && p1.tournamentAvailableDates.length > 0)
    ? p1.tournamentAvailableDates   : (p1.availableDates   || [])
  const avail2   = (p2.tournamentAvailableDates   && p2.tournamentAvailableDates.length > 0)
    ? p2.tournamentAvailableDates   : (p2.availableDates   || [])
  const unavail1 = (p1.tournamentUnavailableDates && p1.tournamentUnavailableDates.length > 0)
    ? p1.tournamentUnavailableDates : (p1.unavailableDates || [])
  const unavail2 = (p2.tournamentUnavailableDates && p2.tournamentUnavailableDates.length > 0)
    ? p2.tournamentUnavailableDates : (p2.unavailableDates || [])
  const allTimes = settings.defaultBattleTimes || ['21:00', '21:30', '22:00', '22:30', '23:00', '23:30']

  const allUnavail = [...unavail1, ...unavail2]
  const allDayUnavail = allUnavail.filter(e => !e.includes('|'))

  const avail1Dates = avail1.map(e => getDatePart(e))
  const avail2Dates = avail2.map(e => getDatePart(e))
  let candidates = intersectDates(avail1Dates, avail2Dates)
  candidates = filterOutDates(candidates, allDayUnavail.map(e => getDatePart(e)))
  candidates = [...new Set(candidates)].sort(compareDates)

  return pickBestDateAndTime(candidates, allTimes, existingBattles, allUnavail, avail1, avail2)
}
