import { store, defaultTournament } from '../data/store.js'
import { generateId } from '../utils/exportUtils.js'
import { publishTournamentData } from '../utils/publishUtils.js'

export function renderHomeScreen(container, onEnterTournament) {
  function render() {
    const { tournaments, currentTournament } = store.getState()

    // 進行中の大会（まだアーカイブされていないもの）
    const hasActive = !!currentTournament

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

        ${hasActive ? `
          <div class="home-section">
            <h2 class="home-section-title">🔥 進行中の大会</h2>
            <div class="home-tournament-list">
              ${renderActiveTournamentCard(currentTournament)}
            </div>
          </div>
        ` : ''}

        ${tournaments.length > 0 ? `
          <div class="home-section">
            <h2 class="home-section-title">📋 過去の大会</h2>
            <div class="home-tournament-list">
              ${tournaments.slice().reverse().map(t => renderTournamentCard(t)).join('')}
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
                <div style="display:flex;gap:8px;align-items:center">
                  <input class="form-input time-entry" type="time" value="21:00" style="width:130px" />
                  <button type="button" class="btn btn-danger btn-sm remove-time" style="padding:6px 10px">✕</button>
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                  <input class="form-input time-entry" type="time" value="21:30" style="width:130px" />
                  <button type="button" class="btn btn-danger btn-sm remove-time" style="padding:6px 10px">✕</button>
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                  <input class="form-input time-entry" type="time" value="22:00" style="width:130px" />
                  <button type="button" class="btn btn-danger btn-sm remove-time" style="padding:6px 10px">✕</button>
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                  <input class="form-input time-entry" type="time" value="22:30" style="width:130px" />
                  <button type="button" class="btn btn-danger btn-sm remove-time" style="padding:6px 10px">✕</button>
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                  <input class="form-input time-entry" type="time" value="23:00" style="width:130px" />
                  <button type="button" class="btn btn-danger btn-sm remove-time" style="padding:6px 10px">✕</button>
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                  <input class="form-input time-entry" type="time" value="23:30" style="width:130px" />
                  <button type="button" class="btn btn-danger btn-sm remove-time" style="padding:6px 10px">✕</button>
                </div>
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

    // 大会作成フォーム送信
    container.querySelector('#create-form')?.addEventListener('submit', e => {
      e.preventDefault()
      const title = container.querySelector('#tournament-title').value.trim()
      if (!title) return

      const times = [...container.querySelectorAll('.time-entry')]
        .map(i => i.value).filter(Boolean)

      // 進行中の大会がある場合はアーカイブしてから新規作成
      const current = store.getState().currentTournament
      if (current) {
        store.archiveCurrentTournament()
      }

      const newTournament = {
        ...defaultTournament,
        id: generateId(),
        title,
        createdAt: new Date().toISOString(),
        settings: {
          tournamentSize: selectedSize,
          defaultBattleTimes: times.length > 0 ? times : ['21:00', '21:30', '22:00', '22:30', '23:00', '23:30']
        }
      }

      store.update({ currentTournament: newTournament, appStage: 'edit' })
      onEnterTournament()
    })

    // 進行中の大会を再開
    container.querySelector('#resume-active-btn')?.addEventListener('click', () => {
      store.update({ appStage: 'edit' })
      onEnterTournament()
    })

    // 過去大会カードのイベント
    container.querySelectorAll('[data-open-tournament]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.openTournament
        store.openArchivedTournament(id)
        onEnterTournament()
      })
    })

    container.querySelectorAll('[data-delete-tournament]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.deleteTournament
        const t = store.getState().tournaments.find(x => x.id === id)
        if (!confirm(`「${t?.title}」を削除しますか？この操作は取り消せません。`)) return
        store.deleteArchivedTournament(id)
      })
    })

    // 公開/非公開トグル（進行中の大会）
    container.querySelector('#toggle-active-public')?.addEventListener('click', async () => {
      const ct = store.getState().currentTournament
      if (!ct) return
      const newIsPublic = !ct.isPublic
      store.updateTournament({ isPublic: newIsPublic })
      await autoPublish()
    })

    // 公開/非公開トグル（過去大会）
    container.querySelectorAll('[data-toggle-public]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.togglePublic
        const { tournaments } = store.getState()
        const t = tournaments.find(x => x.id === id)
        if (!t) return
        const updated = tournaments.map(x => x.id === id ? { ...x, isPublic: !x.isPublic } : x)
        store.update({ tournaments: updated })
        await autoPublish()
      })
    })
  }

  /**
   * 公開中の大会を自動的に /api/publish へ送信する
   * トークン不要（サーバー側で管理）
   */
  async function autoPublish() {
    const { currentTournament, tournaments } = store.getState()
    const all = [
      ...(currentTournament ? [currentTournament] : []),
      ...tournaments
    ]
    const publicOnes = all.filter(t => t.isPublic === true)

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

function renderActiveTournamentCard(t) {
  const date = t.createdAt ? new Date(t.createdAt).toLocaleDateString('ja-JP') : '日付不明'
  const participantCount = (t.participants || []).length
  const stageLabel = {
    participants: '参加者登録中',
    groups: 'グループステージ進行中',
    tournament: '決勝トーナメント進行中',
    finished: '終了'
  }[t.stage] || t.stage
  const isPublic = !!t.isPublic

  return `
    <div class="home-tournament-card home-active-card">
      <div class="home-tc-main">
        <div class="home-tc-icon">🔥</div>
        <div class="home-tc-info">
          <div class="home-tc-title">${escHtml(t.title)}</div>
          <div class="home-tc-meta">
            ${date} ／ ${participantCount}名参加 ／
            <span class="home-active-badge">${stageLabel}</span>
          </div>
        </div>
      </div>
      <div class="home-tc-actions">
        <button class="btn btn-sm ${isPublic ? 'btn-teal' : 'btn-secondary'}" id="toggle-active-public"
                title="${isPublic ? '閲覧ページで公開中（クリックで非公開）' : '非公開（クリックで公開）'}">
          ${isPublic ? '🌐 公開中' : '🔒 非公開'}
        </button>
        <button class="btn btn-primary btn-sm" id="resume-active-btn">▶ 再開</button>
      </div>
    </div>
  `
}

function renderTournamentCard(t) {
  const date = t.createdAt ? new Date(t.createdAt).toLocaleDateString('ja-JP') : '日付不明'
  const participantCount = (t.participants || []).length
  const hasWinner = !!t.tournamentBracket?.winner
  const winnerName = hasWinner
    ? (t.participants || []).find(p => p.id === t.tournamentBracket.winner)?.name || '不明'
    : null
  const isPublic = !!t.isPublic

  return `
    <div class="home-tournament-card">
      <div class="home-tc-main">
        <div class="home-tc-icon">${hasWinner ? '🏆' : '⚔️'}</div>
        <div class="home-tc-info">
          <div class="home-tc-title">${escHtml(t.title)}</div>
          <div class="home-tc-meta">
            ${date} ／ ${participantCount}名参加
            ${winnerName ? ` ／ 優勝: <strong style="color:var(--color-secondary)">${escHtml(winnerName)}</strong>` : ''}
          </div>
        </div>
      </div>
      <div class="home-tc-actions">
        <button class="btn btn-sm ${isPublic ? 'btn-teal' : 'btn-secondary'}" data-toggle-public="${t.id}"
                title="${isPublic ? '閲覧ページで公開中（クリックで非公開）' : '非公開（クリックで公開）'}">
          ${isPublic ? '🌐 公開中' : '🔒 非公開'}
        </button>
        <button class="btn btn-secondary btn-sm" data-open-tournament="${t.id}">👁 閲覧</button>
        <button class="btn btn-danger btn-sm" data-delete-tournament="${t.id}">🗑</button>
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
