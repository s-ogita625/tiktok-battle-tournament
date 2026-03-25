import { store } from '../data/store.js'
import { recordTournamentResult, resetMatchResult, getRoundName } from '../services/tournamentService.js'

export function renderTournamentBracket(container) {
  function render() {
    const ct = store.getState().currentTournament
    if (!ct) return

    const { tournamentBracket, participants } = ct

    if (!tournamentBracket) {
      container.innerHTML = `
        <div class="empty-state" style="margin-top:60px">
          <div class="empty-state-icon">🏆</div>
          <div class="empty-state-title">トーナメント未開始</div>
          <div class="empty-state-desc">グループステージを完了してから進出者を確定してください</div>
        </div>
      `
      return
    }

    const { rounds, winner } = tournamentBracket
    const totalRounds = rounds.length

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">決勝トーナメント</h1>
          <p class="page-subtitle">${Math.pow(2, totalRounds)}強トーナメント</p>
        </div>
      </div>

      ${winner ? renderWinnerBanner(winner, participants) : ''}

      <div class="bracket-scroll-wrap">
        <div class="bracket-table" style="--round-count:${totalRounds}">
          ${rounds.map((round, rIdx) =>
            renderBracketColumn(round, rIdx, totalRounds, participants)
          ).join('')}
        </div>
      </div>

      <!-- スコア入力モーダル -->
      <div class="modal-overlay" id="score-modal" style="display:none">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title" id="score-modal-title">スコアを入力</h2>
            <button class="modal-close" id="score-modal-close">✕</button>
          </div>
          <div id="score-modal-body"></div>
        </div>
      </div>
    `

    attachBracketEvents(container, rounds, participants, totalRounds)
  }

  if (container._unsubscribeStore) {
    container._unsubscribeStore()
  }
  container._unsubscribeStore = store.subscribe(render)
  render()
}

/* ── 優勝バナー ───────────────────────────────────── */
function renderWinnerBanner(winnerId, participants) {
  const p = participants.find(x => x.id === winnerId)
  if (!p) return ''
  const avatarHtml = p.profileImageUrl
    ? `<img src="${escHtml(p.profileImageUrl)}" class="tnmt-winner-avatar" alt="${escHtml(p.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="avatar-initials tnmt-winner-initials" style="display:none">${p.name.slice(0,2)}</div>`
    : `<div class="avatar-initials tnmt-winner-initials">${p.name.slice(0,2)}</div>`
  return `
    <div class="tnmt-winner-banner">
      <div class="tnmt-winner-trophy">🏆</div>
      ${avatarHtml}
      <div>
        <div class="tnmt-winner-label">優勝</div>
        <div class="tnmt-winner-name">${escHtml(p.name)}</div>
      </div>
    </div>
  `
}

/* ── ラウンド列 ────────────────────────────────────── */
function renderBracketColumn(matches, rIdx, totalRounds, participants) {
  const name = getRoundName(rIdx, totalRounds)
  const isFinalRound = rIdx === totalRounds - 1

  return `
    <div class="bracket-col" data-round="${rIdx}">
      <div class="bracket-col-header ${isFinalRound ? 'is-final-header' : ''}">
        ${name}
      </div>
      <div class="bracket-col-matches">
        ${matches.map((match, mIdx) =>
          renderBracketMatchBox(match, rIdx, mIdx, totalRounds, participants)
        ).join('')}
      </div>
    </div>
  `
}

/* ── 対戦ボックス ─────────────────────────────────── */
function renderBracketMatchBox(match, rIdx, mIdx, totalRounds, participants) {
  const p1 = match.player1Id ? participants.find(p => p.id === match.player1Id) : null
  const p2 = match.player2Id ? participants.find(p => p.id === match.player2Id) : null
  const result = match.result
  const winnerId = result?.winnerId
  const isBye    = result?.isBye
  const isDone   = !!result && !isBye
  const isFinal  = rIdx === totalRounds - 1
  const isLast   = rIdx === totalRounds - 1

  // ラウンドが進むほど縦の間隔が広がる
  const spacingMultiplier = Math.pow(2, rIdx)

  const dateStr = match.scheduledDate
    ? `📅 ${match.scheduledDate} ${match.scheduledTime || ''}`
    : ''
  const scheduleArea = (p1 && p2 && !isBye)
    ? `<div class="bracket-match-schedule" style="font-size:0.7rem;color:var(--color-text-dim);padding:2px 6px;display:flex;align-items:center;gap:4px">
        ${dateStr || '<span style="opacity:0.6">日程未定</span>'}
        <button class="btn-edit-schedule bracket-sched-btn" data-match-id="${match.id}" data-date="${match.scheduledDate || ''}" data-time="${match.scheduledTime || ''}" title="日時を編集" style="background:none;border:none;cursor:pointer;padding:0;font-size:0.8rem;opacity:0.7">✏️</button>
       </div>`
    : ''

  return `
    <div class="bracket-match-wrap" style="--spacing:${spacingMultiplier}">
      <div class="bracket-match-box ${isDone ? 'is-done' : ''} ${isBye ? 'is-bye' : ''} ${isFinal ? 'is-final' : ''}"
           data-match-id="${match.id}"
           ${!result && p1 && p2 ? `data-clickable="true"` : ''}>

        ${scheduleArea}
        ${renderBracketPlayer(p1, match.player1Id, winnerId, result?.score1, isBye, 1)}
        <div class="bracket-match-sep"></div>
        ${renderBracketPlayer(p2, match.player2Id, winnerId, result?.score2, isBye, 2)}

        ${isDone ? `<button class="bracket-edit-btn" data-edit-match="${match.id}" title="修正">✏️</button>` : ''}
        ${isBye ? `<div class="bracket-bye-label">BYE</div>` : ''}
      </div>
      ${!isLast ? '<div class="bracket-connector-right"></div>' : ''}
    </div>
  `
}

/* ── プレイヤー行 ─────────────────────────────────── */
function renderBracketPlayer(p, playerId, winnerId, score, isBye, slot) {
  if (!playerId) {
    return `
      <div class="bracket-player bracket-player-tbd">
        <span class="bracket-player-name">-</span>
      </div>
    `
  }

  if (!p) {
    return `
      <div class="bracket-player bracket-player-tbd">
        <span class="bracket-player-name">不明</span>
      </div>
    `
  }

  const isWinner = winnerId === playerId
  const isLoser  = winnerId && winnerId !== playerId && !isBye

  const avatarHtml = p.profileImageUrl
    ? `<img src="${escHtml(p.profileImageUrl)}" class="bracket-player-avatar" alt="${escHtml(p.name)}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
       <div class="avatar-initials bracket-player-avatar-init" style="display:none">${p.name.slice(0,2)}</div>`
    : `<div class="avatar-initials bracket-player-avatar-init">${p.name.slice(0,2)}</div>`

  const link = p.tiktokUrl
    ? `<a href="${escHtml(p.tiktokUrl)}" target="_blank" rel="noopener" class="bracket-player-inner">${avatarHtml}<span class="bracket-player-name ${isWinner ? 'is-winner' : isLoser ? 'is-loser' : ''}">${escHtml(p.name)}</span></a>`
    : `<div class="bracket-player-inner">${avatarHtml}<span class="bracket-player-name ${isWinner ? 'is-winner' : isLoser ? 'is-loser' : ''}">${escHtml(p.name)}</span></div>`

  return `
    <div class="bracket-player ${isWinner ? 'bracket-player-winner' : ''} ${isLoser ? 'bracket-player-loser' : ''}">
      ${link}
      <div class="bracket-player-score-wrap">
        ${isWinner ? '<span class="bracket-crown">👑</span>' : ''}
        ${score !== null && score !== undefined
          ? `<span class="bracket-score ${isWinner ? 'score-win' : isLoser ? 'score-lose' : ''}">${Number(score).toLocaleString()}</span>`
          : ''}
      </div>
    </div>
  `
}

/* ── イベント ─────────────────────────────────────── */
function attachBracketEvents(container, rounds, participants, totalRounds) {
  // 対戦ボックスクリック → スコア入力モーダル
  container.querySelectorAll('[data-clickable="true"]').forEach(box => {
    box.addEventListener('click', (e) => {
      if (e.target.closest('.bracket-edit-btn')) return
      if (e.target.closest('.bracket-sched-btn')) return
      openScoreModal(container, box.dataset.matchId, rounds, participants)
    })
  })

  // 修正ボタン
  container.querySelectorAll('[data-edit-match]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const matchId = btn.dataset.editMatch
      store.updateTournament(ct => ({
        tournamentBracket: resetMatchResult(ct.tournamentBracket, matchId)
      }))
    })
  })

  // 日程編集ボタン（トーナメント）
  container.querySelectorAll('.bracket-sched-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const matchId = btn.dataset.matchId
      openTournamentScheduleModal(btn.dataset.date, btn.dataset.time, (newDate, newTime) => {
        store.updateTournament(ct => {
          const nb = JSON.parse(JSON.stringify(ct.tournamentBracket))
          for (const round of nb.rounds) {
            const match = round.find(m => m.id === matchId)
            if (match) {
              match.scheduledDate = newDate || null
              match.scheduledTime = newTime
              break
            }
          }
          return { tournamentBracket: nb }
        })
        showToast('日時を更新しました', 'success')
      })
    })
  })

  // モーダル閉じる
  container.querySelector('#score-modal-close')?.addEventListener('click', () => {
    container.querySelector('#score-modal').style.display = 'none'
  })
  container.querySelector('#score-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.style.display = 'none'
    }
  })
}

function openTournamentScheduleModal(currentDate, currentTime, onSave) {
  const existing = document.getElementById('tournament-schedule-modal')
  if (existing) existing.remove()

  const modal = document.createElement('div')
  modal.id = 'tournament-schedule-modal'
  modal.style.cssText = 'display:flex;position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.6);align-items:center;justify-content:center'
  modal.innerHTML = `
    <div class="modal" style="min-width:300px;max-width:380px;width:90%">
      <div class="modal-header">
        <h2 class="modal-title">日時を編集</h2>
        <button class="modal-close" id="tsched-close">✕</button>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:12px">
        <div>
          <label class="form-label">日付</label>
          <input class="form-input" id="tsched-date" type="date" value="${currentDate || ''}" />
        </div>
        <div>
          <label class="form-label">時刻</label>
          <input class="form-input" id="tsched-time" type="time" value="${currentTime || ''}" />
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
          <button class="btn btn-secondary" id="tsched-cancel">キャンセル</button>
          <button class="btn btn-primary" id="tsched-save">✅ 保存</button>
        </div>
      </div>
    </div>
  `
  document.body.appendChild(modal)

  const close = () => modal.remove()
  modal.querySelector('#tsched-close').addEventListener('click', close)
  modal.querySelector('#tsched-cancel').addEventListener('click', close)
  modal.addEventListener('click', (e) => { if (e.target === modal) close() })

  modal.querySelector('#tsched-save').addEventListener('click', () => {
    const newDate = modal.querySelector('#tsched-date').value
    const newTime = modal.querySelector('#tsched-time').value
    onSave(newDate, newTime)
    close()
  })
}

function openScoreModal(container, matchId, rounds, participants) {
  let match = null
  for (const round of rounds) {
    match = round.find(m => m.id === matchId)
    if (match) break
  }
  if (!match) return

  const p1 = participants.find(p => p.id === match.player1Id)
  const p2 = participants.find(p => p.id === match.player2Id)
  if (!p1 || !p2) return

  const modal = container.querySelector('#score-modal')
  const title = container.querySelector('#score-modal-title')
  const body  = container.querySelector('#score-modal-body')

  title.textContent = `${p1.name} vs ${p2.name}`

  const av1 = p1.profileImageUrl
    ? `<img src="${escHtml(p1.profileImageUrl)}" class="modal-player-avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="avatar-initials modal-player-avatar" style="display:none">${p1.name.slice(0,2)}</div>`
    : `<div class="avatar-initials modal-player-avatar">${p1.name.slice(0,2)}</div>`
  const av2 = p2.profileImageUrl
    ? `<img src="${escHtml(p2.profileImageUrl)}" class="modal-player-avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="avatar-initials modal-player-avatar" style="display:none">${p2.name.slice(0,2)}</div>`
    : `<div class="avatar-initials modal-player-avatar">${p2.name.slice(0,2)}</div>`

  body.innerHTML = `
    <div class="score-modal-players">
      <div class="score-modal-player">
        ${av1}
        <span class="score-modal-name">${escHtml(p1.name)}</span>
        <input class="form-input score-modal-input" id="sm-score1" type="number" min="0" placeholder="コイン数" />
      </div>
      <div class="score-modal-vs">VS</div>
      <div class="score-modal-player">
        ${av2}
        <span class="score-modal-name">${escHtml(p2.name)}</span>
        <input class="form-input score-modal-input" id="sm-score2" type="number" min="0" placeholder="コイン数" />
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-secondary" id="sm-cancel">キャンセル</button>
      <button class="btn btn-primary" id="sm-save">✅ 結果を確定</button>
    </div>
    <p class="form-hint" style="margin-top:8px;text-align:right">同点の場合は選手1（${escHtml(p1.name)}）を勝者とします</p>
  `

  modal.style.display = 'flex'
  body.querySelector('#sm-score1').focus()

  body.querySelector('#sm-cancel').addEventListener('click', () => {
    modal.style.display = 'none'
  })

  body.querySelector('#sm-save').addEventListener('click', () => {
    const s1Val = body.querySelector('#sm-score1').value
    const s2Val = body.querySelector('#sm-score2').value

    if (s1Val === '' || s2Val === '') {
      showToast('両方のコイン数を入力してください', 'error')
      return
    }

    const score1 = Number(s1Val)
    const score2 = Number(s2Val)

    if (isNaN(score1) || isNaN(score2)) {
      showToast('数値を入力してください', 'error')
      return
    }

    const winnerId = score1 >= score2 ? match.player1Id : match.player2Id

    store.updateTournament(ct => ({
      tournamentBracket: recordTournamentResult(ct.tournamentBracket, matchId, winnerId, score1, score2)
    }))

    if (score1 === score2) {
      showToast(`同点のため ${p1.name} を勝者としました`, 'info')
    }

    modal.style.display = 'none'
  })
}

/* ── ユーティリティ ────────────────────────────────── */
function showToast(message, type = 'info') {
  let tc = document.querySelector('.toast-container')
  if (!tc) {
    tc = document.createElement('div')
    tc.className = 'toast-container'
    document.body.appendChild(tc)
  }
  const toast = document.createElement('div')
  toast.className = `toast ${type}`
  toast.textContent = message
  tc.appendChild(toast)
  setTimeout(() => toast.remove(), 3500)
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
