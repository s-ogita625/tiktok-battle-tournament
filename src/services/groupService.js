import { generateId } from '../utils/exportUtils.js'
import { scheduleGroupBattles } from './scheduleService.js'

/**
 * グループ数と各グループ進出人数を計算
 */
export function calcGroupStructure(participantCount, tournamentSize) {
  const maxGroups = Math.floor(participantCount / 2)
  let groupCount = Math.min(Math.ceil(tournamentSize / 2), maxGroups)
  if (groupCount < 2 && participantCount >= 4) groupCount = 2
  if (groupCount < 1) groupCount = 1

  const baseAdvance   = Math.floor(tournamentSize / groupCount)
  const extraGroups   = tournamentSize % groupCount
  const advancePerGroup = Array.from({ length: groupCount }, (_, i) =>
    i < extraGroups ? baseAdvance + 1 : baseAdvance
  )

  const basePerGroup      = Math.floor(participantCount / groupCount)
  const extraParticipants = participantCount % groupCount
  const participantsPerGroup = Array.from({ length: groupCount }, (_, i) =>
    i < extraParticipants ? basePerGroup + 1 : basePerGroup
  )

  return { groupCount, advancePerGroup, participantsPerGroup }
}

/**
 * Serpentine Snake Draft でグループ割り振りを実行
 */
export function assignGroups(participants, settings) {
  const { tournamentSize } = settings
  const n = participants.length
  if (n < 2) return []

  const { groupCount, advancePerGroup, participantsPerGroup } = calcGroupStructure(n, tournamentSize)
  const sorted = [...participants].sort((a, b) => b.sales - a.sales)

  const groups = Array.from({ length: groupCount }, (_, i) => ({
    id: generateId(),
    name: `グループ${String.fromCharCode(65 + i)}`,
    participantIds: [],
    advanceCount: advancePerGroup[i],
    battles: [],
    standings: []
  }))

  let direction = 1
  let groupIdx  = 0
  for (const participant of sorted) {
    groups[groupIdx].participantIds.push(participant.id)
    groupIdx += direction
    if (groupIdx >= groupCount) { groupIdx = groupCount - 1; direction = -1 }
    else if (groupIdx < 0)      { groupIdx = 0;              direction = 1  }
  }

  for (const group of groups) {
    group.battles   = generateGroupBattles(group.participantIds, participants, settings)
    group.standings = initStandings(group.participantIds)
  }

  return groups
}

function generateGroupBattles(participantIds, participants, settings) {
  const battles = []
  for (let i = 0; i < participantIds.length; i++) {
    for (let j = i + 1; j < participantIds.length; j++) {
      const p1 = participants.find(p => p.id === participantIds[i])
      const p2 = participants.find(p => p.id === participantIds[j])
      const { date, time } = scheduleGroupBattles(p1, p2, settings, battles)
      battles.push({
        id: generateId(),
        participant1Id: participantIds[i],
        participant2Id: participantIds[j],
        scheduledDate: date,
        scheduledTime: time,
        result: null
      })
    }
  }
  return battles
}

function initStandings(participantIds) {
  return participantIds.map(id => ({
    participantId: id,
    wins: 0, losses: 0, draws: 0,
    totalScore: 0, opponentTotalScore: 0, rank: 0
  }))
}

export function recalcStandings(group, participants = []) {
  const standings = initStandings(group.participantIds)

  for (const battle of group.battles) {
    if (!battle.result) continue
    const { winnerId, score1, score2 } = battle.result
    const s1 = standings.find(s => s.participantId === battle.participant1Id)
    const s2 = standings.find(s => s.participantId === battle.participant2Id)
    if (!s1 || !s2) continue

    s1.totalScore         += (score1 || 0)
    s2.totalScore         += (score2 || 0)
    s1.opponentTotalScore += (score2 || 0)
    s2.opponentTotalScore += (score1 || 0)

    if (winnerId === battle.participant1Id)      { s1.wins++; s2.losses++ }
    else if (winnerId === battle.participant2Id) { s2.wins++; s1.losses++ }
    else                                         { s1.draws++; s2.draws++ }
  }

  const isWithdrawn = id => participants.find(x => x.id === id)?.withdrawn === true
  const active    = standings.filter(s => !isWithdrawn(s.participantId))
  const withdrawn = standings.filter(s =>  isWithdrawn(s.participantId))

  active.sort((a, b) => {
    if (b.wins       !== a.wins)       return b.wins       - a.wins
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
    return a.opponentTotalScore - b.opponentTotalScore
  })
  active.forEach((s, i) => { s.rank = i + 1 })
  withdrawn.forEach(s => { s.rank = 9999 })

  return [...active, ...withdrawn]
}

/**
 * グループ順位表から決勝トーナメント進出者を取得
 *
 * 全グループの進出者を「総合スコア（勝利数 → 獲得スコア → 失点少）」で
 * ランキングし、1位vs最下位・2位vs(最下位-1)位…のシード配置にする。
 * 辞退者は除外し、進出枠が足りない場合は他グループの次順位から補欠進出。
 */
export function getTournamentAdvancers(groups, participants = []) {
  const totalSlots = groups.reduce((sum, g) => sum + (g.advanceCount || 1), 0)
  const isWithdrawn = id => participants.find(x => x.id === id)?.withdrawn === true

  // 正規進出者を収集（rank <= advanceCount かつ非辞退）
  const raw = []
  const maxAdvance = Math.max(...groups.map(g => g.advanceCount || 1))
  for (let rank = 1; rank <= maxAdvance; rank++) {
    for (const group of groups) {
      if (rank <= (group.advanceCount || 1)) {
        const standing = (group.standings || []).find(s => s.rank === rank)
        if (!standing) continue
        if (isWithdrawn(standing.participantId)) continue
        raw.push({
          participantId: standing.participantId,
          groupRank:     standing.rank,
          wins:          standing.wins,
          totalScore:    standing.totalScore,
          opponentScore: standing.opponentTotalScore,
          groupName:     group.name
        })
      }
    }
  }

  // 進出枠が足りない場合、補欠進出（他グループの次順位から成績順）
  if (raw.length < totalSlots) {
    const needed = totalSlots - raw.length
    const alreadyIn = new Set(raw.map(r => r.participantId))
    const candidates = []

    for (const group of groups) {
      for (const standing of (group.standings || [])) {
        if (alreadyIn.has(standing.participantId)) continue
        if (isWithdrawn(standing.participantId)) continue
        if (standing.rank > (group.advanceCount || 1) && standing.rank < 9999) {
          candidates.push({
            participantId: standing.participantId,
            groupRank:     standing.rank,
            wins:          standing.wins,
            totalScore:    standing.totalScore,
            opponentScore: standing.opponentTotalScore,
            groupName:     group.name
          })
        }
      }
    }

    candidates.sort((a, b) => {
      if (b.wins        !== a.wins)        return b.wins        - a.wins
      if (b.totalScore  !== a.totalScore)  return b.totalScore  - a.totalScore
      return a.opponentScore - b.opponentScore
    })
    raw.push(...candidates.slice(0, needed))
  }

  // 総合順位でソート（勝利数→スコア→失点少）
  raw.sort((a, b) => {
    if (b.wins        !== a.wins)        return b.wins        - a.wins
    if (b.totalScore  !== a.totalScore)  return b.totalScore  - a.totalScore
    return a.opponentScore - b.opponentScore
  })

  return raw.map(r => r.participantId)
}

/**
 * 参加者の辞退処理
 * 辞退者との未実施バトルを不戦勝（相手10万pt）で埋めて groups を返す。
 * standings の再計算は呼び出し側で行うこと。
 */
export function withdrawParticipant(groups, participantId) {
  return groups.map(group => {
    if (!group.participantIds.includes(participantId)) return group

    const newBattles = group.battles.map(b => {
      if (b.result !== null) return b
      const isP1 = b.participant1Id === participantId
      const isP2 = b.participant2Id === participantId
      if (!isP1 && !isP2) return b

      return {
        ...b,
        result: {
          winnerId: isP1 ? b.participant2Id : b.participant1Id,
          score1:   isP1 ? 0 : 100000,
          score2:   isP2 ? 0 : 100000
        }
      }
    })
    return { ...group, battles: newBattles }
  })
}
