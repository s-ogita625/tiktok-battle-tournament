import { store } from '../data/store.js'
import { recalcStandings, getTournamentAdvancers } from '../services/groupService.js'
import { generateTournamentBracket } from '../services/tournamentService.js'
import { renderBattleCard } from './BattleCard.js'

export function renderGroupStage(container) {
  function render() {
    const ct = store.getState().currentTournament
    if (!ct) return

    const { groups, participants, settings } = ct

    if (groups.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="margin-top:60px">
          <div class="empty-state-icon">⚡</div>
          <div class="empty-state-title">グループ未割り振り</div>
          <div class="empty-state-desc">参加者タブで「グループ割り振りを実行」ボタンを押してください</div>
        </div>
      `
      return
    }

    const allBattlesDone = groups.every(g =>
      g.battles.every(b => b.result !== null)
    )

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">グループステージ</h1>
          <p class="page-subtitle">${groups.length} グループ / ${participants.length} 名参加</p>
        </div>
        <div class="page-actions">
          <button id="reset-groups-btn" class="btn btn-secondary btn-sm">グループをリセット</button>
          ${allBattlesDone ? `
            <button id="advance-btn" class="btn btn-teal">🏆 決勝トーナメントへ進出</button>
          ` : ''}
        </div>
      </div>
      <div class="groups-container" id="groups-container"></div>
    `

    const groupsContainer = container.querySelector('#groups-container')
    groupsContainer.innerHTML = groups.map(group => renderGroupCard(group, participants, settings)).join('')

    attachGroupEvents(groupsContainer, groups, participants)

    container.querySelector('#reset-groups-btn')?.addEventListener('click', () => {
      if (!confirm('グループをリセットすると全ての対戦結果も削除されます。続けますか？')) return
      store.updateTournament({ groups: [], tournamentBracket: null, stage: 'participants' })
    })

    container.querySelector('#advance-btn')?.addEventListener('click', () => {
      const ct2 = store.getState().currentTournament
      const advancers = getTournamentAdvancers(ct2.groups)
      const bracket = generateTournamentBracket(
        advancers,
        ct2.settings.tournamentSize,
        ct2.participants,
        ct2.settings
      )
      store.updateTournament({ tournamentBracket: bracket, stage: 'tournament' })
      showToast(`${advancers.length}名が決勝トーナメントへ進出しました！`, 'success')
    })
  }

  store.subscribe(render)
  render()
}

function renderGroupCard(group, participants, settings) {
  const standings = group.standings || []

  return `
    <div class="group-card">
      <div class="group-card-header">
        <span class="group-name">${escHtml(group.name)}</span>
        <span class="group-advance-badge">上位${group.advanceCount || 1}名が進出</span>
      </div>

      <div class="group-standings">
        <table class="standings-table">
          <thead>
            <tr>
              <th>選手</th>
              <th>勝</th>
              <th>負</th>
              <th>スコア</th>
            </tr>
          </thead>
          <tbody>
            ${standings.length > 0
              ? standings.map(s => renderStandingRow(s, group, participants)).join('')
              : group.participantIds.map((id, i) => {
                  const p = participants.find(x => x.id === id)
                  return renderEmptyStandingRow(p, i + 1)
                }).join('')
            }
          </tbody>
        </table>
      </div>

      <div class="group-battles" data-group-id="${group.id}">
        ${group.battles.map(battle => {
          const p1 = participants.find(p => p.id === battle.participant1Id)
          const p2 = participants.find(p => p.id === battle.participant2Id)
          if (!p1 || !p2) return ''
          return renderBattleCard(battle, p1, p2, true)
        }).join('')}
      </div>
    </div>
  `
}

function renderStandingRow(standing, group, participants) {
  const p = participants.find(x => x.id === standing.participantId)
  if (!p) return ''
  const isAdvancer = standing.rank <= (group.advanceCount || 1)
  const advanceMarker = isAdvancer ? `<span class="advance-indicator" title="進出確定"></span>` : ''
  const rankClass = standing.rank <= 3 ? `rank-${standing.rank}` : 'rank-other'

  const avatarHtml = p.profileImageUrl
    ? `<img class="avatar" src="${escHtml(p.profileImageUrl)}" width="24" height="24" alt="${escHtml(p.name)}" style="border-radius:50%;object-fit:cover" onerror="this.style.display='none'" />`
    : `<div class="avatar-initials" style="width:24px;height:24px;font-size:0.6rem">${p.name.slice(0, 2)}</div>`

  return `
    <tr>
      <td>
        <div class="standing-player">
          <div class="standing-rank ${rankClass}">${standing.rank}</div>
          ${avatarHtml}
          <span style="font-size:0.82rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px">${escHtml(p.name)}</span>
          ${advanceMarker}
        </div>
      </td>
      <td style="color:var(--color-success);font-weight:700">${standing.wins}</td>
      <td style="color:var(--color-danger)">${standing.losses}</td>
      <td style="font-weight:600">${Number(standing.totalScore).toLocaleString()}</td>
    </tr>
  `
}

function renderEmptyStandingRow(p, rank) {
  if (!p) return ''
  const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other'
  const avatarHtml = p.profileImageUrl
    ? `<img class="avatar" src="${escHtml(p.profileImageUrl)}" width="24" height="24" alt="${escHtml(p.name)}" style="border-radius:50%;object-fit:cover" />`
    : `<div class="avatar-initials" style="width:24px;height:24px;font-size:0.6rem">${p.name.slice(0, 2)}</div>`

  return `
    <tr>
      <td>
        <div class="standing-player">
          <div class="standing-rank ${rankClass}">${rank}</div>
          ${avatarHtml}
          <span style="font-size:0.82rem;font-weight:600">${escHtml(p.name)}</span>
        </div>
      </td>
      <td>-</td><td>-</td><td>-</td>
    </tr>
  `
}

function attachGroupEvents(container, groups, participants) {
  container.querySelectorAll('.save-result-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const battleId = btn.dataset.battleId
      const p1Id = btn.dataset.p1
      const p2Id = btn.dataset.p2

      const score1 = Number(container.querySelector(`#score1-${battleId}`)?.value ?? 0)
      const score2 = Number(container.querySelector(`#score2-${battleId}`)?.value ?? 0)

      if (isNaN(score1) || isNaN(score2)) {
        showToast('スコアを入力してください', 'error')
        return
      }

      const winnerId = score1 > score2 ? p1Id : score2 > score1 ? p2Id : null

      store.updateTournament(ct => {
        const newGroups = ct.groups.map(g => {
          const battleIdx = g.battles.findIndex(b => b.id === battleId)
          if (battleIdx === -1) return g
          const newBattles = [...g.battles]
          newBattles[battleIdx] = { ...newBattles[battleIdx], result: { winnerId, score1, score2 } }
          const newGroup = { ...g, battles: newBattles }
          newGroup.standings = recalcStandings(newGroup)
          return newGroup
        })
        return { groups: newGroups }
      })
    })
  })

  container.querySelectorAll('.edit-result-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const battleId = btn.dataset.battleId
      store.updateTournament(ct => {
        const newGroups = ct.groups.map(g => {
          const battleIdx = g.battles.findIndex(b => b.id === battleId)
          if (battleIdx === -1) return g
          const newBattles = [...g.battles]
          newBattles[battleIdx] = { ...newBattles[battleIdx], result: null }
          const newGroup = { ...g, battles: newBattles }
          newGroup.standings = recalcStandings(newGroup)
          return newGroup
        })
        return { groups: newGroups }
      })
    })
  })
}

function showToast(message, type = 'info') {
  let toastContainer = document.querySelector('.toast-container')
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.className = 'toast-container'
    document.body.appendChild(toastContainer)
  }
  const toast = document.createElement('div')
  toast.className = `toast ${type}`
  toast.textContent = message
  toastContainer.appendChild(toast)
  setTimeout(() => toast.remove(), 3000)
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
