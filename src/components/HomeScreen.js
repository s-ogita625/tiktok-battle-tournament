import { store, defaultTournament } from '../data/store.js'
import { generateId } from '../utils/exportUtils.js'
import { publishTournamentData } from '../utils/publishUtils.js'

export function renderHomeScreen(container, onEnterTournament) {
  function render() {
    const { tournaments } = store.getState()
    const activeTournaments = tournaments.filter(t => !t.archived)
    const pastTournaments = tournaments.filter(t => t.archived)

    container.innerHTML = `
      <div class="home-wrap">
        <div class="home-hero">
          <div class="home-hero-icon">⚔️</div>
          <h1 class="home-hero-title">TikTokバトルトーナメント</h1>
          <p class="home-hero-sub">大会を作成してグループ戦・決勝トーナメントを管理しましょう</p>
          <button class="btn btn-primary btn-lg" id="create-btn">
            ＋ 新しい大会を作成
          </button>
        </div>

        ${activeTournaments.length > 0 ? `
          <div class="home-section">
            <h2 class="home-section-title">🔥 進行中の大会</h2>
            <div class="home-tournament-list">
              ${activeTournaments.map(t => renderTournamentCard(t, false)).join('')}
            </div>
          </div>
        ` : ''}

        ${pastTournaments.length > 0 ? `
          <div class="home-section">
            <h2 class="home-section-title">📋 過去の大会</h2>
            <div class="home-tournament-list">
              ${pastTournaments.slice().reverse().map(t => renderTournamentCard(t, true)).join('')}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- 大会作成モーダル -->
      <div class="modal-overlay" id="create-modal" style="display:none">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">🏆 新しい大会を作成</h2>
            <button class="modal-close" id="modal-close-btn">✕</button>
          </div>
          <form id="create-form">
            <div class="form-group" style="margin-bottom:16px">
              <label class="form-label required">大会タイトル</label>
              <input class="form-input" id="tournament-title" type="text"
                     placeholder="例: 第1回 TikTokバトル大会" maxlength="50" required
                     value="第${tournaments.length + 1}回大会" />
              <span class="form-hint">後から変更することはできません</span>
            </div>
            <div class="form-group" style="margin-bottom:16px">
              <label class="form-label">トーナメント進出人数</label>
              <div class="tournament-size-selector" style="margin-top:6px">
                ${[4, 8, 16].map(size => `
                  <button type="button" class="size-btn ${size === 8 ? 'active' : ''}" data-size="${size}">${size}名</button>
                `).join('')}
              </div>
            </div>
            <div class="form-group" style="margin-bottom:24px">
              <label class="form-label">バトル開始時刻（デフォルト）</label>
              <div id="times-list" style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
                ${['21:00','21:30','22:00','22:30','23:00','23:30'].map(t => `
                <div style="display:flex;gap:8px;align-items:center">
                  <input class="form-input time-entry" type="time" value="${t}" style="width:130px" />
                  <button type="button" class="btn btn-danger btn-sm remove-time" style="padding:6px 10px">✕</button>
                </div>
                `).join('')}
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="add-time" style="margin-top:8px;align-self:flex-start">＋ 時刻を追加</button>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button type="button" class="btn btn-secondary" id="modal-cancel">キャンセル</button>
              <button type="submit" class="btn btn-primary">大会を作成して開始</button>
            </div>
          </form>
        </div>
      </div>
    `

    let selectedSize = 8

    // サイズボタン
    container.querySelectorAll('[data-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('[data-size]').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        selectedSize = Number(btn.dataset.size)
      })
    })

    // 時刻追加
    container.querySelector('#add-time')?.addEventListener('click', () => {
      const list = container.querySelector('#times-list')
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;gap:8px;align-items:center'
      row.innerHTML = `
        <input class="form-input time-entry" type="time" value="21:00" style="width:130px" />
        <button type="button" class="btn btn-danger btn-sm remove-time" style="padding:6px 10px">✕</button>
      `
      list.appendChild(row)
      row.querySelector('.remove-time').addEventListener('click', () => row.remove())
    })

    // 既存の削除ボタン
    container.querySelectorAll('.remove-time').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('div').remove())
    })

    // モーダル開閉
    container.querySelector('#create-btn')?.addEventListener('click', () => {
      container.querySelector('#create-modal').style.display = 'flex'
      container.querySelector('#tournament-title').focus()
    })
    const closeModal = () => { container.querySelector('#create-modal').style.display = 'none' }
    container.querySelector('#modal-close-btn')?.addEventListener('click', closeModal)
    container.querySelector('#modal-cancel')?.addEventListener('click', closeModal)
    container.querySelector('#create-modal')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal()
    })

    // 大会作成フォーム送信（他の進行中イベントは終了させない＝並行進行）
    container.querySelector('#create-form')?.addEventListener('submit', e => {
      e.preventDefault()
      const title = container.querySelector('#tournament-title').value.trim()
      if (!title) return

      const times = [...container.querySelectorAll('.time-entry')]
        .map(i => i.value).filter(Boolean)

      store.createTournament({
        ...defaultTournament,
        id: generateId(),
        title,
        createdAt: new Date().toISOString(),
        settings: {
          tournamentSize: selectedSize,
          defaultBattleTimes: times.length > 0 ? times : ['21:00', '21:30', '22:00', '22:30', '23:00', '23:30']
        }
      })
      onEnterTournament()
    })

    // 大会カードを開く（進行中・過去とも）
    container.querySelectorAll('[data-open-tournament]').forEach(btn => {
      btn.addEventListener('click', () => {
        store.openTournament(btn.dataset.openTournament)
        onEnterTournament()
      })
    })

    // 削除（過去大会のみ）
    container.querySelectorAll('[data-delete-tournament]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.deleteTournament
        const t = store.getState().tournaments.find(x => x.id === id)
        if (!confirm(`「${t?.title}」を削除しますか？この操作は取り消せません。`)) return
        store.deleteTournament(id)
      })
    })

    // 公開/非公開トグル
    container.querySelectorAll('[data-toggle-public]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.togglePublic
        const t = store.getState().tournaments.find(x => x.id === id)
        if (!t) return
        store.setPublic(id, !t.isPublic)
        await autoPublish()
      })
    })

    // 閲覧リンクをコピー
    container.querySelectorAll('[data-copy-link]').forEach(btn => {
      btn.addEventListener('click', () => copyViewerLink(btn.dataset.copyLink))
    })
  }

  /**
   * 公開中の大会を自動的に /api/publish へ送信する
   */
  async function autoPublish() {
    const { tournaments } = store.getState()
    const publicOnes = tournaments.filter(t => t.isPublic === true)

    const result = await publishTournamentData(publicOnes)
    if (result.ok) {
      showHomeToast(`✅ ${publicOnes.length}件の大会を公開しました（Vercel反映まで約1〜2分）`, 'success')
    } else {
      showHomeToast(`⚠️ 公開の更新に失敗: ${result.message}`, 'error')
    }
  }

  store.subscribe(render)
  render()
}

/** 閲覧ページの個別リンクをクリップボードにコピー */
function copyViewerLink(id) {
  const url = `${window.location.origin}/viewer.html?event=${encodeURIComponent(id)}`
  const done = () => showHomeToast('🔗 閲覧リンクをコピーしました', 'success')
  const fallback = () => {
    const ta = document.createElement('textarea')
    ta.value = url
    ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select()
    try { document.execCommand('copy'); done() } catch { prompt('以下のURLをコピーしてください', url) }
    ta.remove()
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(done).catch(fallback)
  } else {
    fallback()
  }
}

/**
 * 大会カード（進行中・過去共通）
 * @param {object} t 大会
 * @param {boolean} isPast 過去大会か
 */
function renderTournamentCard(t, isPast) {
  const date = t.createdAt ? new Date(t.createdAt).toLocaleDateString('ja-JP') : '日付不明'
  const participantCount = (t.participants || []).length
  const isPublic = !!t.isPublic

  const stageLabel = {
    participants: '参加者登録中',
    groups: 'グループステージ進行中',
    tournament: '決勝トーナメント進行中',
    finished: '終了',
    settings: '設定',
    notice: 'お知らせ'
  }[t.stage] || t.stage

  const hasWinner = !!t.tournamentBracket?.winner
  const winnerName = hasWinner
    ? (t.participants || []).find(p => p.id === t.tournamentBracket.winner)?.name || '不明'
    : null

  const icon = isPast ? (hasWinner ? '🏆' : '⚔️') : '🔥'

  const meta = isPast
    ? `${date} ／ ${participantCount}名参加${winnerName ? ` ／ 優勝: <strong style="color:var(--color-secondary)">${escHtml(winnerName)}</strong>` : ''}`
    : `${date} ／ ${participantCount}名参加 ／ <span class="home-active-badge">${escHtml(stageLabel)}</span>`

  return `
    <div class="home-tournament-card ${isPast ? '' : 'home-active-card'}">
      <div class="home-tc-main">
        <div class="home-tc-icon">${icon}</div>
        <div class="home-tc-info">
          <div class="home-tc-title">${escHtml(t.title)}</div>
          <div class="home-tc-meta">${meta}</div>
        </div>
      </div>
      <div class="home-tc-actions">
        <button class="btn btn-sm ${isPublic ? 'btn-teal' : 'btn-secondary'}" data-toggle-public="${t.id}"
                title="${isPublic ? '閲覧ページで公開中（クリックで非公開）' : '非公開（クリックで公開）'}">
          ${isPublic ? '🌐 公開中' : '🔒 非公開'}
        </button>
        <button class="btn btn-secondary btn-sm" data-copy-link="${t.id}" title="この大会の閲覧リンクをコピー">🔗 リンク</button>
        <button class="btn btn-primary btn-sm" data-open-tournament="${t.id}">${isPast ? '👁 開く' : '▶ 開く'}</button>
        ${isPast ? `<button class="btn btn-danger btn-sm" data-delete-tournament="${t.id}" title="削除">🗑</button>` : ''}
      </div>
    </div>
  `
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function showHomeToast(message, type = 'info') {
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
  setTimeout(() => toast.remove(), 4000)
}
