import { intersectDates, filterOutDates, isWeekend, isFriday, compareDates, getDatePart, isBlockedBy } from '../utils/dateUtils.js'

/**
 * 共通の候補日+時刻を選ぶ共通ロジック
 * unavailEntries: NG日エントリ配列（終日 or 時間帯付き）
 */
function pickBestDateAndTime(candidates, allTimes, existingBattles, unavailEntries = []) {
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

  // スコア上位の日付から、時刻がすべてブロックされていない日を選ぶ
  for (const { date } of scored) {
    const usedTimes = existingBattles
      .filter(b => b.scheduledDate === date)
      .map(b => b.scheduledTime)

    const time = allTimes.find(t =>
      !usedTimes.includes(t) &&
      !unavailEntries.some(e => isBlockedBy(e, date, t))
    )
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

  // 終日NG（時間帯なし）の日付のみ候補から除外
  const allUnavail = [...unavail1, ...unavail2]
  const allDayUnavail = allUnavail.filter(e => !e.includes('|'))

  let candidates = intersectDates(avail1, avail2)
  candidates = filterOutDates(candidates, allDayUnavail.map(e => getDatePart(e)))
  candidates.sort(compareDates)

  return pickBestDateAndTime(candidates, allTimes, existingBattles, allUnavail)
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

  let candidates = intersectDates(avail1, avail2)
  candidates = filterOutDates(candidates, allDayUnavail.map(e => getDatePart(e)))
  candidates.sort(compareDates)

  return pickBestDateAndTime(candidates, allTimes, existingBattles, allUnavail)
}
