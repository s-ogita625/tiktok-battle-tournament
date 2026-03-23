import { generateId } from '../utils/exportUtils.js'
import { scheduleTournamentBattle } from './scheduleService.js'

/**
 * 決勝トーナメントのブラケットを生成する
 * @param {string[]} advancerIds - 進出者IDの配列（総合順位順）
 * @param {number}   tournamentSize - トーナメント規模（4/8/16）
 * @param {object[]} participants   - 参加者オブジェクト配列（日程情報取得用）
 * @param {object}   settings       - アプリ設定（defaultBattleTimes など）
 */
export function generateTournamentBracket(advancerIds, tournamentSize, participants = [], settings = {}) {
  const slots = [...advancerIds]
  while (slots.length < tournamentSize) slots.push(null)

  const numRounds = calcRounds(tournamentSize)
  const bracket = { rounds: [], winner: null }

  // 1回戦: シード順（1位 vs 最下位、2位 vs (最下位-1)…）
  // 日程も同時に自動割り当て
  const firstRoundMatches = []
  const scheduledSoFar = []   // 同日重複回避用
  for (let i = 0; i < slots.length / 2; i++) {
    const p1Id = slots[i]
    const p2Id = slots[slots.length - 1 - i]
    const p1 = participants.find(p => p.id === p1Id) || null
    const p2 = participants.find(p => p.id === p2Id) || null

    let scheduledDate = null
    let scheduledTime = (settings.defaultBattleTimes || ['19:00'])[0]

    if (p1 && p2) {
      const sched = scheduleTournamentBattle(p1, p2, settings, scheduledSoFar)
      scheduledDate = sched.date
      scheduledTime = sched.time
    }

    const match = {
      id: generateId(),
      player1Id: p1Id,
      player2Id: p2Id,
      scheduledDate,
      scheduledTime,
      result: null,
      roundIndex: 0,
      matchIndex: i
    }
    firstRoundMatches.push(match)
    if (scheduledDate) scheduledSoFar.push(match)
  }

  // BYE 自動処理
  for (const match of firstRoundMatches) {
    if (match.player1Id === null && match.player2Id !== null) {
      match.result = { winnerId: match.player2Id, score1: null, score2: null, isBye: true }
    } else if (match.player2Id === null && match.player1Id !== null) {
      match.result = { winnerId: match.player1Id, score1: null, score2: null, isBye: true }
    } else if (match.player1Id === null && match.player2Id === null) {
      match.result = { winnerId: null, score1: null, score2: null, isBye: true }
    }
  }

  bracket.rounds.push(firstRoundMatches)

  // 2回戦以降: 前ラウンドの勝者を player として配置
  for (let r = 1; r < numRounds; r++) {
    const prevRound = bracket.rounds[r - 1]
    const matches = []
    for (let i = 0; i < prevRound.length / 2; i++) {
      const match1 = prevRound[i * 2]
      const match2 = prevRound[i * 2 + 1]
      const p1 = match1?.result?.winnerId ?? null
      const p2 = match2?.result?.winnerId ?? null
      const newMatch = {
        id: generateId(),
        player1Id: p1,
        player2Id: p2,
        result: null,
        roundIndex: r,
        matchIndex: i,
        fromMatch1Id: match1?.id,
        fromMatch2Id: match2?.id
      }
      // BYE 自動処理
      if (p1 === null && p2 !== null) {
        newMatch.result = { winnerId: p2, score1: null, score2: null, isBye: true }
      } else if (p2 === null && p1 !== null) {
        newMatch.result = { winnerId: p1, score1: null, score2: null, isBye: true }
      }
      matches.push(newMatch)
    }
    bracket.rounds.push(matches)
  }

  return bracket
}

/**
 * 対戦結果を記録し、次ラウンドへ勝者を伝播させる
 */
export function recordTournamentResult(bracket, matchId, winnerId, score1, score2) {
  const nb = JSON.parse(JSON.stringify(bracket))

  for (let r = 0; r < nb.rounds.length; r++) {
    for (let m = 0; m < nb.rounds[r].length; m++) {
      const match = nb.rounds[r][m]
      if (match.id !== matchId) continue

      match.result = { winnerId, score1, score2, isBye: false }

      const isFinal = (r + 1 >= nb.rounds.length)
      if (isFinal) {
        nb.winner = winnerId
      } else {
        const nextMatchIdx = Math.floor(m / 2)
        const nextMatch = nb.rounds[r + 1][nextMatchIdx]
        if (nextMatch) {
          // 次マッチの結果をリセットして勝者を反映
          nextMatch.result = null
          if (m % 2 === 0) {
            nextMatch.player1Id = winnerId
          } else {
            nextMatch.player2Id = winnerId
          }

          // BYE チェック: 対応するもう一方の試合（前ラウンド）がまだ未確定の場合は
          // 「相手待ち」なので BYE にしない。
          // 元々のブラケット生成時点で null だった（出場者が足りない）枠のみ BYE 扱い。
          const np1 = nextMatch.player1Id
          const np2 = nextMatch.player2Id
          const siblingMatchIdx = m % 2 === 0 ? m + 1 : m - 1
          const siblingMatch = nb.rounds[r][siblingMatchIdx]
          const siblingDone = siblingMatch?.result != null

          if (siblingDone) {
            // 兄弟試合も確定済み → 片方が null なら本当に BYE
            if (np1 === null && np2 !== null) {
              nextMatch.result = { winnerId: np2, score1: null, score2: null, isBye: true }
            } else if (np2 === null && np1 !== null) {
              nextMatch.result = { winnerId: np1, score1: null, score2: null, isBye: true }
            }
          }
          // 兄弟試合が未確定の場合は result = null のまま → スコア入力待ち
        }
      }

      return nb
    }
  }
  return nb
}

/**
 * 特定マッチの結果をリセットし、以降ラウンドへの影響も消去する
 */
export function resetMatchResult(bracket, matchId) {
  const nb = JSON.parse(JSON.stringify(bracket))
  nb.winner = null

  for (let r = 0; r < nb.rounds.length; r++) {
    for (let m = 0; m < nb.rounds[r].length; m++) {
      const match = nb.rounds[r][m]
      if (match.id !== matchId) continue
      match.result = null
      clearDownstream(nb, r, m)
      return nb
    }
  }
  return nb
}

/**
 * 下流（次ラウンド以降）のマッチをプレイヤー参照ごとリセット
 */
function clearDownstream(bracket, r, m) {
  if (r + 1 >= bracket.rounds.length) return

  const nextMatchIdx = Math.floor(m / 2)
  const nextMatch = bracket.rounds[r + 1][nextMatchIdx]
  if (!nextMatch) return

  if (m % 2 === 0) {
    nextMatch.player1Id = null
  } else {
    nextMatch.player2Id = null
  }
  nextMatch.result = null

  clearDownstream(bracket, r + 1, nextMatchIdx)
}

function calcRounds(size) {
  return Math.log2(size)
}

export function getRoundName(roundIndex, totalRounds) {
  const remaining = totalRounds - roundIndex
  if (remaining === 1) return '決勝'
  if (remaining === 2) return '準決勝'
  if (remaining === 3) return '準々決勝'
  return `${Math.pow(2, remaining)}強`
}
