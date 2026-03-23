import { store } from '../data/store.js'
import { formatDate } from '../utils/dateUtils.js'
import { renderParticipantForm } from './ParticipantForm.js'

export function renderParticipantList(container, formContainer) {
  function render() {
    const ct = store.getState().currentTournament
    if (!ct) return

    const { participants, groups } = ct
    const hasGroups = groups.length > 0

    container.innerHTML = `
      <div class="participant-list-header">
        <div>
          <h2 style="font-size:1rem;font-weight:700">参加者一覧</h2>
          <p class="participant-count">${participants.length} 名登録済み</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${hasGroups ? '' : `
            <button id="auto-assign-btn" class="btn btn-teal btn-sm" ${participants.length < 2 ? 'disabled' : ''}>
              ⚡ グループ割り振りを実行
            </button>
          `}
        </div>
      </div>

      ${participants.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">👥</div>
          <div class="empty-state-title">参加者がいません</div>
          <div class="empty-state-desc">左のフォームから参加者を追加してください</div>
        </div>
      ` : `
        <div class="participant-grid">
          ${participants.map(p => renderParticipantCard(p, hasGroups, ct)).join('')}
        </div>
      `}
    `

    container.querySelector('#auto-assign-btn')?.addEventListener('click', () => {
      container.dispatchEvent(new CustomEvent('assign-groups'))
    })

    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.edit
        formContainer.innerHTML = ''
        renderParticipantForm(formContainer, id)
        formContainer.addEventListener('edit-done', () => {
          formContainer.innerHTML = ''
          renderParticipantForm(formContainer, null)
        }, { once: true })
      })
    })

    container.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.delete
        const p = (store.getState().currentTournament?.participants || []).find(x => x.id === id)
        if (!p) return
        if (!confirm(`「${p.name}」を削除しますか？`)) return
        store.updateTournament(ct => ({
          participants: ct.participants.filter(x => x.id !== id)
        }))
      })
    })
  }

  // 以前に登録したリスナーがあれば先に解除（ページ再描画時の重複防止）
  if (container._unsubscribeStore) {
    container._unsubscribeStore()
  }
  container._unsubscribeStore = store.subscribe(render)
  render()
}

function renderParticipantCard(p, hasGroups, ct) {
  const avail = (p.availableDates || []).slice(0, 3)
  const unavail = (p.unavailableDates || []).slice(0, 2)
  const imgSrc = convertImageUrl(p.profileImageUrl || '')
  const avatarHtml = imgSrc
    ? `<img class="avatar" src="${escHtml(imgSrc)}" width="48" height="48" alt="${escHtml(p.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="avatar-initials" style="display:none;width:48px;height:48px;font-size:1rem">${getInitials(p.name)}</div>`
    : `<div class="avatar-initials" style="width:48px;height:48px;font-size:1rem">${getInitials(p.name)}</div>`

  // 所属グループ名を取得
  const groupName = hasGroups
    ? (ct?.groups || []).find(g => g.participantIds.includes(p.id))?.name || ''
    : ''

  return `
    <div class="participant-card">
      <div class="participant-card-header">
        ${avatarHtml}
        <div class="participant-card-info">
          <div class="participant-name">${escHtml(p.name)}</div>
          <div class="participant-sales">¥${Number(p.sales).toLocaleString()}</div>
          ${groupName ? `<span style="font-size:0.72rem;color:var(--color-secondary);font-weight:600">${escHtml(groupName)}</span>` : ''}
          ${p.tiktokUrl ? `<a href="${escHtml(p.tiktokUrl)}" target="_blank" rel="noopener" style="font-size:0.75rem;color:var(--color-secondary)">@TikTok ↗</a>` : ''}
        </div>
        <div class="participant-card-actions">
          <button class="btn btn-secondary btn-sm" data-edit="${p.id}" title="編集">✏️</button>
          ${!hasGroups ? `<button class="btn btn-danger btn-sm" data-delete="${p.id}" title="削除">🗑</button>` : ''}
        </div>
      </div>
      <div class="participant-card-body">
        ${avail.length > 0 ? `
          <div>
            <span style="color:var(--color-success);font-weight:600">✓ 可能:</span>
            <div class="participant-dates" style="margin-top:2px">
              ${avail.map(d => `<span class="date-chip available">${formatDate(d)}</span>`).join('')}
              ${(p.availableDates || []).length > 3 ? `<span class="date-chip available">+${(p.availableDates || []).length - 3}</span>` : ''}
            </div>
          </div>
        ` : '<span style="color:var(--color-text-dim);font-size:0.8rem">日程未設定</span>'}
        ${unavail.length > 0 ? `
          <div>
            <span style="color:var(--color-danger);font-weight:600">✗ 不可:</span>
            <div class="participant-dates" style="margin-top:2px">
              ${unavail.map(d => `<span class="date-chip unavailable">${formatDate(d)}</span>`).join('')}
              ${(p.unavailableDates || []).length > 2 ? `<span class="date-chip unavailable">+${(p.unavailableDates || []).length - 2}</span>` : ''}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `
}

function getInitials(name) {
  if (!name) return '?'
  return name.slice(0, 2).toUpperCase()
}

/**
 * Googleドライブ共有リンクを直接表示用URLに変換する
 * https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 *   → https://drive.google.com/uc?export=view&id=FILE_ID
 * 通常のURLはそのまま返す
 */
export function convertImageUrl(url) {
  if (!url) return ''
  // Googleドライブのfile/d/ID形式
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)
  if (driveMatch) {
    return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`
  }
  // drive.google.com/open?id=ID 形式
  const openMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/)
  if (openMatch) {
    return `https://drive.google.com/uc?export=view&id=${openMatch[1]}`
  }
  return url
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
