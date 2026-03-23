/**
 * ViewerApp.js — 閲覧専用（読み取り専用）ページ
 *
 * データ取得の優先順位:
 *   1. /tournament-data.json (GitHub push 済みの共有データ) から fetch
 *   2. 取得できた場合でも tournaments が空なら localStorage をフォールバックとして使用
 *      → 管理者が同じブラウザで閲覧ページを開いたときも即座に確認できる
 *
 * こうすることで:
 *   - 同じPC: GitHub publish 前でも公開フラグが立っていれば見える
 *   - スマホ等別デバイス: GitHub publish 後1〜2分で見える
 */
import { getRoundName } from '../services/tournamentService.js'
import { formatDate } from '../utils/dateUtils.js'
import { convertImageUrl } from './ParticipantList.js'

const LOCAL_STORAGE_KEY = 'tbt_state'

/** localStorage から公開中の大会を取得する（フォールバック用） */
function getLocalPublicTournaments() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return []
    const state = JSON.parse(raw)
    const all = [
      ...(state.currentTournament ? [state.currentTournament] : []),
      ...(state.tournaments || [])
    ]
    return all.filter(t => t.isPublic === true)
  } catch {
    return []
  }
}

export async function renderViewerApp(container) {
  // ローディング表示
  container.innerHTML = `
    <div class="viewer-empty">
      <div class="viewer-empty-icon" style="font-size:2.5rem">⏳</div>
      <div class="viewer-empty-title" style="font-size:1rem;font-weight:600">読み込み中...</div>
    </div>
  `

  let allTournaments = []
  let sourceLabel = ''

  // 1. /tournament-data.json を fetch（キャッシュ回避）
  try {
    const res = await fetch(`/tournament-data.json?t=${Date.now()}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    // isPublic が明示的に true のものだけ表示
    const fromJson = (data.tournaments || []).filter(t => t.isPublic === true)
    if (fromJson.length > 0) {
      allTournaments = fromJson
      sourceLabel = 'json'
    }
  } catch (e) {
    // fetch 失敗時はコンソールに記録してフォールバックへ
    console.warn('[ViewerApp] /tournament-data.json fetch失敗:', e.message)
  }

  // 2. JSON が空 or fetch 失敗の場合 → localStorage フォールバック
  if (allTournaments.length === 0) {
    const fromLocal = getLocalPublicTournaments()
    if (fromLocal.length > 0) {
      allTournaments = fromLocal
      sourceLabel = 'local'
    }
  }

  if (allTournaments.length === 0) {
    container.innerHTML = `
      <div class="viewer-empty">
        <div class="viewer-empty-icon">🏆</div>
        <div class="viewer-empty-title">公開中の大会情報がありません</div>
        <div class="viewer-empty-desc">管理者が大会を「公開中」に設定すると表示されます</div>
      </div>
    `
    return
  }

  container.innerHTML = `
    <div class="viewer-layout">
      <!-- サイドバー：大会一覧 -->
      <aside class="viewer-sidebar">
        <div class="viewer-sidebar-title">大会一覧</div>
        <div class="viewer-sidebar-list">
          ${allTournaments.map((t, i) => `
            <button class="viewer-tournament-btn ${i === 0 ? 'active' : ''}"
                    data-tournament-idx="${i}">
              ${t.stage !== 'finished' ? `<span class="viewer-active-dot"></span>` : ''}
              ${escHtml(t.title || '無題の大会')}
            </button>
          `).join('')}
        </div>
      </aside>

      <!-- メイン：選択された大会の詳細 -->
      <main class="viewer-main" id="viewer-main"></main>
    </div>
  `

  // 最初の大会を表示
  const mainEl = container.querySelector('#viewer-main')
  renderTournamentDetail(mainEl, allTournaments[0])

  // サイドバーの大会ボタン切り替え
  container.querySelectorAll('.viewer-tournament-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.viewer-tournament-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      const idx = Number(btn.dataset.tournamentIdx)
      const main = container.querySelector('#viewer-main')
      if (main) renderTournamentDetail(main, allTournaments[idx])
    })
  })
}

// ──────────────────────────────────────────────────────
//  大会詳細レンダリング（container DOM要素に直接描画）
// ──────────────────────────────────────────────────────

function renderTournamentDetail(container, t) {
  if (!t) { container.innerHTML = ''; return }
  const { title, participants, groups, tournamentBracket } = t
  const isActive = t.stage !== 'finished'

  const tabs = [
    { id: 'participants', label: '👥 参加者', show: true },
    { id: 'groups',       label: '⚔️ グループ戦', show: (groups || []).length > 0 },
    { id: 'tournament',   label: '🏆 トーナメント', show: !!tournamentBracket }
  ].filter(tab => tab.show)

  container.innerHTML = `
    <div class="viewer-detail">
      <div class="viewer-detail-header">
        <h1 class="viewer-detail-title">${escHtml(title || '無題の大会')}</h1>
        <div class="viewer-detail-meta">
          ${isActive
            ? '<span class="viewer-active-badge">🔴 開催中</span>'
            : '<span class="viewer-finished-badge">✅ 終了</span>'}
          <span class="viewer-detail-count">${(participants || []).length}名参加</span>
        </div>
      </div>

      <!-- タブナビゲーション -->
      <div class="viewer-tabs" id="viewer-tabs">
        ${tabs.map((tab, i) =>
          `<button class="viewer-tab ${i === 0 ? 'active' : ''}" data-vtab="${tab.id}">${tab.label}</button>`
        ).join('')}
      </div>

      <!-- タブコンテンツ -->
      <div class="viewer-tab-content" id="vtab-participants">
        ${renderParticipantsView(participants || [])}
      </div>
      <div class="viewer-tab-content" id="vtab-groups" style="display:none">
        ${renderGroupsView(groups || [], participants || [])}
      </div>
      <div class="viewer-tab-content" id="vtab-tournament" style="display:none">
        ${renderBracketView(tournamentBracket, participants || [])}
      </div>
    </div>
  `

  // タブ切り替えイベントをJSで登録（innerHTML内の<script>は実行されないため）
  const tabBtns = container.querySelectorAll('.viewer-tab')
  tabBtns.forEach(tab => {
    tab.addEventListener('click', () => {
      tabBtns.forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      container.querySelectorAll('.viewer-tab-content').forEach(c => c.style.display = 'none')
      const target = container.querySelector('#vtab-' + tab.dataset.vtab)
      if (target) target.style.display = ''
    })
  })
}

// ──────────────────────────────────────────────────────
//  参加者ビュー
// ──────────────────────────────────────────────────────

function renderParticipantsView(participants) {
  if (participants.length === 0) {
    return `<div class="viewer-empty-section">参加者が登録されていません</div>`
  }

  // 名前順（あいうえお順）で表示（売上は非公開）
  const sorted = [...participants].sort((a, b) => a.name.localeCompare(b.name, 'ja'))

  return `
    <div class="viewer-participants-grid">
      ${sorted.map((p) => {
        const imgSrc = convertImageUrl(p.profileImageUrl || '')
        const avatarHtml = imgSrc
          ? `<img class="viewer-avatar" src="${escHtml(imgSrc)}" alt="${escHtml(p.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="avatar-initials viewer-avatar-init" style="display:none">${p.name.slice(0,2)}</div>`
          : `<div class="avatar-initials viewer-avatar-init">${p.name.slice(0,2)}</div>`

        return `
          <div class="viewer-participant-card">
            <div class="viewer-participant-avatar-wrap">${avatarHtml}</div>
            <div class="viewer-participant-info">
              <div class="viewer-participant-name">${escHtml(p.name)}</div>
              ${p.tiktokUrl
                ? `<a href="${escHtml(p.tiktokUrl)}" target="_blank" rel="noopener" class="viewer-tiktok-link">@TikTok ↗</a>`
                : ''}
            </div>
          </div>
        `
      }).join('')}
    </div>
  `
}

// ──────────────────────────────────────────────────────
//  グループ戦ビュー
// ──────────────────────────────────────────────────────

function renderGroupsView(groups, participants) {
  if (groups.length === 0) {
    return `<div class="viewer-empty-section">グループ情報がありません</div>`
  }

  return `
    <div class="viewer-groups-grid">
      ${groups.map(group => renderGroupCard(group, participants)).join('')}
    </div>
  `
}

function renderGroupCard(group, participants) {
  const standings = group.standings || []

  return `
    <div class="viewer-group-card">
      <div class="viewer-group-header">
        <span class="viewer-group-name">${escHtml(group.name)}</span>
        <span class="viewer-group-advance">上位${group.advanceCount || 1}名進出</span>
      </div>

      <!-- 順位表 -->
      <table class="viewer-standings-table">
        <thead>
          <tr><th>順位</th><th>選手</th><th>勝</th><th>負</th><th>スコア</th></tr>
        </thead>
        <tbody>
          ${standings.length > 0
            ? standings.map(s => {
                const p = participants.find(x => x.id === s.participantId)
                const isAdv = s.rank <= (group.advanceCount || 1)
                return `
                  <tr class="${isAdv ? 'viewer-row-advance' : ''}">
                    <td>${s.rank}</td>
                    <td>
                      <div style="display:flex;align-items:center;gap:6px">
                        ${p?.profileImageUrl
                          ? `<img src="${escHtml(convertImageUrl(p.profileImageUrl))}" style="width:22px;height:22px;border-radius:50%;object-fit:cover" onerror="this.style.display='none'" alt="" />`
                          : `<div class="avatar-initials" style="width:22px;height:22px;font-size:0.55rem">${(p?.name||'?').slice(0,2)}</div>`}
                        <span>${escHtml(p?.name || '不明')}</span>
                        ${isAdv ? `<span style="color:var(--color-secondary);font-size:0.7rem">↑進出</span>` : ''}
                      </div>
                    </td>
                    <td style="color:var(--color-success);font-weight:700">${s.wins}</td>
                    <td style="color:var(--color-danger)">${s.losses}</td>
                    <td>${Number(s.totalScore).toLocaleString()}</td>
                  </tr>
                `
              }).join('')
            : group.participantIds.map((id, i) => {
                const p = participants.find(x => x.id === id)
                return `<tr><td>${i+1}</td><td>${escHtml(p?.name || '不明')}</td><td>-</td><td>-</td><td>-</td></tr>`
              }).join('')
          }
        </tbody>
      </table>

      <!-- 対戦カード -->
      <div class="viewer-battles">
        ${group.battles.map(battle => {
          const p1 = participants.find(p => p.id === battle.participant1Id)
          const p2 = participants.find(p => p.id === battle.participant2Id)
          if (!p1 || !p2) return ''
          const isDone = !!battle.result
          const w = battle.result?.winnerId
          return `
            <div class="viewer-battle-card ${isDone ? 'is-done' : ''}">
              <div class="viewer-battle-date">
                ${battle.scheduledDate ? formatDate(battle.scheduledDate) : '日程未定'}
                ${battle.scheduledTime ? battle.scheduledTime + '〜' : ''}
              </div>
              <div class="viewer-battle-players">
                <span class="${w === p1.id ? 'viewer-battle-winner' : w ? 'viewer-battle-loser' : ''}">${escHtml(p1.name)}</span>
                <span class="viewer-battle-score">
                  ${isDone
                    ? `${battle.result.score1 ?? '-'} - ${battle.result.score2 ?? '-'}`
                    : 'vs'}
                </span>
                <span class="${w === p2.id ? 'viewer-battle-winner' : w ? 'viewer-battle-loser' : ''}">${escHtml(p2.name)}</span>
              </div>
            </div>
          `
        }).join('')}
      </div>
    </div>
  `
}

// ──────────────────────────────────────────────────────
//  トーナメントブラケットビュー（読み取り専用）
// ──────────────────────────────────────────────────────

function renderBracketView(bracket, participants) {
  if (!bracket) {
    return `<div class="viewer-empty-section">トーナメントが開始されていません</div>`
  }

  const { rounds, winner } = bracket
  const totalRounds = rounds.length

  return `
    ${winner ? renderViewerWinnerBanner(winner, participants) : ''}

    <div class="bracket-scroll-wrap">
      <div class="bracket-table" style="--round-count:${totalRounds}">
        ${rounds.map((round, rIdx) => renderViewerBracketColumn(round, rIdx, totalRounds, participants)).join('')}
      </div>
    </div>
  `
}

function renderViewerWinnerBanner(winnerId, participants) {
  const p = participants.find(x => x.id === winnerId)
  if (!p) return ''
  const imgSrc = convertImageUrl(p.profileImageUrl || '')
  const avatarHtml = imgSrc
    ? `<img src="${escHtml(imgSrc)}" class="tnmt-winner-avatar" alt="${escHtml(p.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="avatar-initials tnmt-winner-initials" style="display:none">${p.name.slice(0,2)}</div>`
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

function renderViewerBracketColumn(matches, rIdx, totalRounds, participants) {
  const name = getRoundName(rIdx, totalRounds)
  const isFinal = rIdx === totalRounds - 1
  return `
    <div class="bracket-col" data-round="${rIdx}">
      <div class="bracket-col-header ${isFinal ? 'is-final-header' : ''}">${name}</div>
      <div class="bracket-col-matches">
        ${matches.map((match, mIdx) => renderViewerMatchBox(match, rIdx, mIdx, totalRounds, participants)).join('')}
      </div>
    </div>
  `
}

function renderViewerMatchBox(match, rIdx, mIdx, totalRounds, participants) {
  const p1 = match.player1Id ? participants.find(p => p.id === match.player1Id) : null
  const p2 = match.player2Id ? participants.find(p => p.id === match.player2Id) : null
  const result = match.result
  const winnerId = result?.winnerId
  const isBye    = result?.isBye
  const isDone   = !!result && !isBye
  const isFinal  = rIdx === totalRounds - 1
  const spacingMultiplier = Math.pow(2, rIdx)

  const dateLabel = match.scheduledDate
    ? `<div class="viewer-match-date">${formatDate(match.scheduledDate)}${match.scheduledTime ? ' ' + match.scheduledTime + '〜' : ''}</div>`
    : ''

  return `
    <div class="bracket-match-wrap" style="--spacing:${spacingMultiplier}">
      <div class="bracket-match-box ${isDone ? 'is-done' : ''} ${isBye ? 'is-bye' : ''} ${isFinal ? 'is-final' : ''}">
        ${dateLabel}
        ${renderViewerPlayer(p1, match.player1Id, winnerId, result?.score1, isBye)}
        <div class="bracket-match-sep"></div>
        ${renderViewerPlayer(p2, match.player2Id, winnerId, result?.score2, isBye)}
        ${isBye ? `<div class="bracket-bye-label">BYE</div>` : ''}
      </div>
      ${rIdx < totalRounds - 1 ? '<div class="bracket-connector-right"></div>' : ''}
    </div>
  `
}

function renderViewerPlayer(p, playerId, winnerId, score, isBye) {
  if (!playerId) {
    return `<div class="bracket-player bracket-player-tbd"><span class="bracket-player-name">-</span></div>`
  }
  if (!p) {
    return `<div class="bracket-player bracket-player-tbd"><span class="bracket-player-name">不明</span></div>`
  }

  const isWinner = winnerId === playerId
  const isLoser  = winnerId && winnerId !== playerId && !isBye
  const imgSrc   = convertImageUrl(p.profileImageUrl || '')

  const avatarHtml = imgSrc
    ? `<img src="${escHtml(imgSrc)}" class="bracket-player-avatar" alt="${escHtml(p.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="avatar-initials bracket-player-avatar-init" style="display:none">${p.name.slice(0,2)}</div>`
    : `<div class="avatar-initials bracket-player-avatar-init">${p.name.slice(0,2)}</div>`

  const inner = p.tiktokUrl
    ? `<a href="${escHtml(p.tiktokUrl)}" target="_blank" rel="noopener" class="bracket-player-inner">${avatarHtml}<span class="bracket-player-name ${isWinner ? 'is-winner' : isLoser ? 'is-loser' : ''}">${escHtml(p.name)}</span></a>`
    : `<div class="bracket-player-inner">${avatarHtml}<span class="bracket-player-name ${isWinner ? 'is-winner' : isLoser ? 'is-loser' : ''}">${escHtml(p.name)}</span></div>`

  return `
    <div class="bracket-player ${isWinner ? 'bracket-player-winner' : ''} ${isLoser ? 'bracket-player-loser' : ''}">
      ${inner}
      <div class="bracket-player-score-wrap">
        ${isWinner ? '<span class="bracket-crown">👑</span>' : ''}
        ${score !== null && score !== undefined
          ? `<span class="bracket-score ${isWinner ? 'score-win' : isLoser ? 'score-lose' : ''}">${Number(score).toLocaleString()}</span>`
          : ''}
      </div>
    </div>
  `
}

// ──────────────────────────────────────────────────────
//  ユーティリティ
// ──────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
