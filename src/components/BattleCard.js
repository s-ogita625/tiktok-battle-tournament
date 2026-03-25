import { formatDate } from '../utils/dateUtils.js'
import { convertImageUrl } from './ParticipantList.js'

/**
 * 対戦カードHTMLを生成する
 * @param {object} battle - 対戦情報
 * @param {object} p1 - 参加者1
 * @param {object} p2 - 参加者2
 * @param {boolean} editable - 結果入力可能か
 * @returns {string} HTML文字列
 */
export function renderBattleCard(battle, p1, p2, editable = true) {
  const result = battle.result
  const winnerId = result?.winnerId
  const score1 = result?.score1 ?? ''
  const score2 = result?.score2 ?? ''

  const p1IsWinner = winnerId === p1.id
  const p2IsWinner = winnerId === p2.id

  const dateStr = battle.scheduledDate
    ? `📅 ${formatDate(battle.scheduledDate)} ${battle.scheduledTime || ''}`
    : `<span class="no-date">⚠️ 日程未定</span>`

  const editDateBtn = editable
    ? `<button class="btn-edit-schedule" data-battle-id="${battle.id}" data-date="${battle.scheduledDate || ''}" data-time="${battle.scheduledTime || ''}" title="日時を編集">✏️</button>`
    : ''

  return `
    <div class="battle-card ${result ? 'completed' : ''}" data-battle-id="${battle.id}">
      <div class="battle-card-date" style="display:flex;align-items:center;gap:6px">${dateStr}${editDateBtn}</div>
      <div class="battle-card-players">
        <div class="battle-player">
          ${renderPlayerLink(p1, p1IsWinner, 'left')}
        </div>
        <div class="battle-vs">VS</div>
        <div class="battle-player">
          ${renderPlayerLink(p2, p2IsWinner, 'right')}
        </div>
      </div>

      ${result ? `
        <div class="battle-score-area">
          <div class="battle-score-display">
            <span class="${p1IsWinner ? 'score-winner' : 'score-loser'}">${score1 !== '' ? Number(score1).toLocaleString() : '-'}</span>
            <span class="battle-score-separator">:</span>
            <span class="${p2IsWinner ? 'score-winner' : 'score-loser'}">${score2 !== '' ? Number(score2).toLocaleString() : '-'}</span>
          </div>
          ${editable ? `
            <button class="btn btn-secondary btn-sm edit-result-btn" data-battle-id="${battle.id}">修正</button>
          ` : ''}
        </div>
      ` : editable ? `
        <div class="battle-result-actions">
          <input class="score-input" type="number" placeholder="コイン" min="0" id="score1-${battle.id}" value="${score1}" style="width:80px" />
          <span style="color:var(--color-text-dim);font-weight:700">:</span>
          <input class="score-input" type="number" placeholder="コイン" min="0" id="score2-${battle.id}" value="${score2}" style="width:80px" />
          <button class="btn btn-primary btn-sm save-result-btn" data-battle-id="${battle.id}" data-p1="${p1.id}" data-p2="${p2.id}">
            確定
          </button>
        </div>
      ` : ''}
    </div>
  `
}

function renderPlayerLink(p, isWinner, side) {
  const imgSrc = p.profileImageUrl
    ? (p.profileImageUrl.startsWith('data:') ? p.profileImageUrl : convertImageUrl(p.profileImageUrl))
    : ''
  const avatarHtml = imgSrc
    ? `<img class="battle-player-avatar" src="${escHtml(imgSrc)}" alt="${escHtml(p.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="avatar-initials battle-player-initials" style="display:none">${getInitials(p.name)}</div>`
    : `<div class="avatar-initials battle-player-initials">${getInitials(p.name)}</div>`

  const crownHtml = isWinner ? `<div class="winner-crown">👑</div>` : ''

  return p.tiktokUrl
    ? `<a href="${escHtml(p.tiktokUrl)}" target="_blank" rel="noopener" class="battle-player-link">
        <div class="battle-player-avatar-wrap">
          ${crownHtml}
          ${avatarHtml}
        </div>
        <div class="battle-player-name">${escHtml(p.name)}</div>
      </a>`
    : `<div class="battle-player-link">
        <div class="battle-player-avatar-wrap">
          ${crownHtml}
          ${avatarHtml}
        </div>
        <div class="battle-player-name">${escHtml(p.name)}</div>
      </div>`
}

function getInitials(name) {
  if (!name) return '?'
  return name.slice(0, 2).toUpperCase()
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
