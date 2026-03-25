import { store } from '../data/store.js'
import { recalcStandings, getTournamentAdvancers } from '../services/groupService.js'
import { generateTournamentBracket } from '../services/tournamentService.js'
import { renderBattleCard } from './BattleCard.js'
import { convertImageUrl } from './ParticipantList.js'

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

  // 以前に登録したリスナーがあれば先に解除（ページ再描画時の重複防止）
  if (container._unsubscribeStore) {
    container._unsubscribeStore()
  }
  container._unsubscribeStore = store.subscribe(render)
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
        ${[...group.battles].sort((a, b) => {
          // 日時未定は末尾へ
          const aHasDate = !!a.scheduledDate
          const bHasDate = !!b.scheduledDate
          if (!aHasDate && !bHasDate) return 0
          if (!aHasDate) return 1
          if (!bHasDate) return -1
          // 日付比較
          if (a.scheduledDate !== b.scheduledDate) {
            return a.scheduledDate < b.scheduledDate ? -1 : 1
          }
          // 同日なら時刻比較（未設定は末尾）
          const aTime = a.scheduledTime || '99:99'
          const bTime = b.scheduledTime || '99:99'
          return aTime < bTime ? -1 : aTime > bTime ? 1 : 0
        }).map(battle => {
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

  const standImgSrc = p.profileImageUrl ? (p.profileImageUrl.startsWith('data:') ? p.profileImageUrl : convertImageUrl(p.profileImageUrl)) : ''
  const avatarHtml = standImgSrc
    ? `<img class="avatar" src="${escHtml(standImgSrc)}" width="24" height="24" alt="${escHtml(p.name)}" style="border-radius:50%;object-fit:cover" onerror="this.style.display='none'" />`
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
  const emptyImgSrc = p.profileImageUrl ? (p.profileImageUrl.startsWith('data:') ? p.profileImageUrl : convertImageUrl(p.profileImageUrl)) : ''
  const avatarHtml = emptyImgSrc
    ? `<img class="avatar" src="${escHtml(emptyImgSrc)}" width="24" height="24" alt="${escHtml(p.name)}" style="border-radius:50%;object-fit:cover" />`
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

  container.querySelectorAll('.btn-edit-schedule').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const battleId = btn.dataset.battleId
      openScheduleEditModal(btn.dataset.date, btn.dataset.time, (newDate, newTime) => {
        store.updateTournament(ct => {
          const newGroups = ct.groups.map(g => {
            const battleIdx = g.battles.findIndex(b => b.id === battleId)
            if (battleIdx === -1) return g
            const newBattles = [...g.battles]
            newBattles[battleIdx] = { ...newBattles[battleIdx], scheduledDate: newDate || null, scheduledTime: newTime }
            return { ...g, battles: newBattles }
          })
          return { groups: newGroups }
        })
        showToast('日時を更新しました', 'success')
      })
    })
  })
}

function openScheduleEditModal(currentDate, currentTime, onSave) {
  const existing = document.getElementById('schedule-edit-modal')
  if (existing) existing.remove()

  const modal = document.createElement('div')
  modal.id = 'schedule-edit-modal'
  modal.className = 'modal-overlay'
  modal.style.cssText = 'display:flex;position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.6);align-items:center;justify-content:center'
  modal.innerHTML = `
    <div class="modal" style="min-width:300px;max-width:380px;width:90%">
      <div class="modal-header">
        <h2 class="modal-title">日時を編集</h2>
        <button class="modal-close" id="sched-modal-close">✕</button>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:12px">
        <div>
          <label class="form-label">日付</label>
          <input class="form-input" id="sched-date-input" type="date" value="${currentDate || ''}" />
        </div>
        <div>
          <label class="form-label">時刻</label>
          <input class="form-input" id="sched-time-input" type="time" value="${currentTime || ''}" />
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
          <button class="btn btn-secondary" id="sched-cancel">キャンセル</button>
          <button class="btn btn-primary" id="sched-save">✅ 保存</button>
        </div>
      </div>
    </div>
  `
  document.body.appendChild(modal)

  const close = () => modal.remove()
  modal.querySelector('#sched-modal-close').addEventListener('click', close)
  modal.querySelector('#sched-cancel').addEventListener('click', close)
  modal.addEventListener('click', (e) => { if (e.target === modal) close() })

  modal.querySelector('#sched-save').addEventListener('click', () => {
    const newDate = modal.querySelector('#sched-date-input').value
    const newTime = modal.querySelector('#sched-time-input').value
    onSave(newDate, newTime)
    close()
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
