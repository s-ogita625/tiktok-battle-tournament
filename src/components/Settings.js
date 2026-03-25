import { store } from '../data/store.js'
import { exportToJson, importFromJson } from '../utils/exportUtils.js'
import { publishTournamentData } from '../utils/publishUtils.js'

export function renderSettings(container) {
  function render() {
    const ct = store.getState().currentTournament
    if (!ct) return

    const { settings, participants, groups } = ct

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">設定</h1>
          <p class="page-subtitle">トーナメント設定・データ管理</p>
        </div>
      </div>

      <div class="settings-grid">
        <div class="settings-section">
          <h2 class="settings-section-title">🏆 トーナメント設定</h2>

          <div class="settings-row">
            <div>
              <div class="settings-label">決勝トーナメント進出人数</div>
              <div class="settings-desc">グループステージを通過する人数</div>
            </div>
            <div class="tournament-size-selector">
              ${[4, 8, 16].map(size => `
                <button class="size-btn ${settings.tournamentSize === size ? 'active' : ''}" data-size="${size}">${size}名</button>
              `).join('')}
            </div>
          </div>

          <div class="settings-row">
            <div>
              <div class="settings-label">デフォルトバトル開始時刻</div>
              <div class="settings-desc">対戦日程の自動割り振りで使用される時刻</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;padding-bottom:10px">
            ${(settings.defaultBattleTimes || []).map((t, i) => `
              <div style="display:flex;align-items:center;gap:8px">
                <input class="form-input time-input" type="time" value="${t}" data-time-idx="${i}" style="width:130px" />
                <button class="btn btn-danger btn-sm remove-time-btn" data-time-idx="${i}" ${settings.defaultBattleTimes.length <= 1 ? 'disabled' : ''}>✕</button>
              </div>
            `).join('')}
            <button class="btn btn-secondary btn-sm" id="add-time-btn" style="align-self:flex-start">+ 時刻を追加</button>
          </div>
        </div>

        <div class="settings-section">
          <h2 class="settings-section-title">📊 現在の状態</h2>
          <div class="settings-row">
            <span class="settings-label">大会タイトル</span>
            <span class="badge badge-muted">${escHtml(ct.title || '未設定')}</span>
          </div>
          <div class="settings-row">
            <span class="settings-label">参加者数</span>
            <span class="badge badge-muted">${participants.length} 名</span>
          </div>
          <div class="settings-row">
            <span class="settings-label">グループ数</span>
            <span class="badge badge-muted">${groups.length} グループ</span>
          </div>
          <div class="settings-row">
            <span class="settings-label">グループステージ進捗</span>
            <span class="badge badge-muted">${calcGroupProgress(groups)}</span>
          </div>
        </div>

        <div class="settings-section">
          <h2 class="settings-section-title">🌐 閲覧ページへ公開</h2>
          <p style="font-size:0.8rem;color:var(--color-text-muted);margin-bottom:12px;line-height:1.6">
            「公開中」に設定した大会を閲覧ページ（スマホ等）に即座に反映します。<br>
            ホーム画面の <strong style="color:var(--color-text)">🌐 公開中 / 🔒 非公開</strong> ボタンで大会ごとに公開設定を切り替えてください。<br>
            <span style="color:var(--color-text-dim);font-size:0.75rem">
              ※ GitHub Gist 経由で配信されます。デプロイ不要・即時反映されます。
            </span>
          </p>
          ${renderPublishStatus(ct)}
          <div class="data-actions">
            <button class="btn btn-primary" id="publish-btn">🚀 閲覧ページに反映する</button>
          </div>
          <div id="publish-result" style="display:none;margin-top:10px;padding:10px 14px;border-radius:8px;font-size:0.82rem;line-height:1.6;white-space:pre-line"></div>
        </div>

        <div class="settings-section">
          <h2 class="settings-section-title">💾 データ管理</h2>
          <div class="data-actions">
            <button class="btn btn-secondary" id="export-btn">⬇️ データをエクスポート (JSON)</button>
            <button class="btn btn-secondary" id="import-btn">⬆️ データをインポート (JSON)</button>
          </div>
        </div>

        <div class="settings-section danger-zone">
          <h2 class="settings-section-title">⚠️ 危険ゾーン</h2>
          <div class="data-actions">
            <button class="btn btn-danger" id="reset-all-btn">🗑️ 全データをリセット</button>
          </div>
          <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:8px">
            この操作は取り消せません。事前にエクスポートしてバックアップを取ることをお勧めします。
          </p>
        </div>
      </div>
    `

    // トーナメントサイズ変更
    container.querySelectorAll('[data-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        const size = Number(btn.dataset.size)
        store.updateTournament(ct => ({ settings: { ...ct.settings, tournamentSize: size } }))
        showToast(`トーナメント進出人数を${size}名に変更しました`, 'info')
      })
    })

    // 時刻変更
    container.querySelectorAll('.time-input').forEach(input => {
      input.addEventListener('change', () => {
        const idx = Number(input.dataset.timeIdx)
        const times = [...(store.getState().currentTournament?.settings.defaultBattleTimes || [])]
        times[idx] = input.value
        store.updateTournament(ct => ({ settings: { ...ct.settings, defaultBattleTimes: times } }))
      })
    })

    // 時刻削除
    container.querySelectorAll('.remove-time-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.timeIdx)
        const times = [...(store.getState().currentTournament?.settings.defaultBattleTimes || [])]
        times.splice(idx, 1)
        store.updateTournament(ct => ({ settings: { ...ct.settings, defaultBattleTimes: times } }))
      })
    })

    // 時刻追加
    container.querySelector('#add-time-btn')?.addEventListener('click', () => {
      const times = [...(store.getState().currentTournament?.settings.defaultBattleTimes || []), '21:00']
      store.updateTournament(ct => ({ settings: { ...ct.settings, defaultBattleTimes: times } }))
    })

    // 公開データ更新
    container.querySelector('#publish-btn')?.addEventListener('click', async () => {
      const { currentTournament, tournaments } = store.getState()
      const all = [
        ...(currentTournament ? [currentTournament] : []),
        ...tournaments
      ]
      const publicOnes = all.filter(t => t.isPublic === true)

      const btn = container.querySelector('#publish-btn')
      const resultEl = container.querySelector('#publish-result')
      btn.disabled = true
      btn.textContent = '⏳ 更新中...'
      resultEl.style.display = ''
      resultEl.style.background = 'rgba(255,255,255,0.05)'
      resultEl.style.border = '1px solid var(--color-border)'
      resultEl.style.color = 'var(--color-text-muted)'
      resultEl.textContent = '⏳ 準備中...'

      const result = await publishTournamentData(publicOnes, (msg) => {
        resultEl.textContent = msg
      })

      btn.disabled = false
      btn.textContent = '🚀 閲覧ページに反映する'
      resultEl.style.background = result.ok ? 'rgba(76,175,80,0.1)' : 'rgba(244,67,54,0.1)'
      resultEl.style.border = result.ok ? '1px solid rgba(76,175,80,0.3)' : '1px solid rgba(244,67,54,0.3)'
      resultEl.style.color = result.ok ? 'var(--color-success)' : 'var(--color-danger)'
      resultEl.textContent = result.message
    })

    // エクスポート
    container.querySelector('#export-btn')?.addEventListener('click', () => {
      exportToJson(store.getState())
      showToast('データをエクスポートしました', 'success')
    })

    // インポート
    container.querySelector('#import-btn')?.addEventListener('click', async () => {
      try {
        const imported = await importFromJson()
        if (!confirm('現在のデータを上書きしてインポートしますか？')) return
        store.importState(imported)
        showToast('データをインポートしました', 'success')
      } catch (e) {
        showToast(e.message || 'インポートに失敗しました', 'error')
      }
    })

    // リセット
    container.querySelector('#reset-all-btn')?.addEventListener('click', () => {
      if (!confirm('全データを削除します。この操作は取り消せません。続けますか？')) return
      if (!confirm('本当によろしいですか？')) return
      store.reset()
      showToast('全データをリセットしました', 'info')
    })
  }

  if (container._unsubscribeStore) {
    container._unsubscribeStore()
  }
  container._unsubscribeStore = store.subscribe(render)
  render()
}

function renderPublishStatus(currentTournament) {
  const { tournaments } = store.getState()
  const all = [...(currentTournament ? [currentTournament] : []), ...tournaments]
  const publicOnes = all.filter(t => t.isPublic)
  if (publicOnes.length === 0) {
    return `<div style="padding:10px 14px;border-radius:8px;font-size:0.82rem;margin-bottom:10px;background:rgba(255,193,7,0.1);border:1px solid rgba(255,193,7,0.3);color:#c68000">
      ⚠️ 現在「公開中」の大会がありません。<br>
      ホーム画面で大会の「🔒 非公開」ボタンをクリックして公開設定にしてください。
    </div>`
  }
  return `<div style="padding:8px 14px;border-radius:8px;font-size:0.82rem;margin-bottom:10px;background:rgba(76,175,80,0.1);border:1px solid rgba(76,175,80,0.3);color:var(--color-success)">
    ✅ 公開対象: ${publicOnes.map(t => `「${escHtml(t.title)}」`).join('・')} （${publicOnes.length}件）
  </div>`
}

function calcGroupProgress(groups) {
  if (groups.length === 0) return '未開始'
  const totalBattles = groups.reduce((sum, g) => sum + g.battles.length, 0)
  const doneBattles = groups.reduce((sum, g) => sum + g.battles.filter(b => b.result).length, 0)
  if (totalBattles === 0) return '0 / 0'
  return `${doneBattles} / ${totalBattles} 試合`
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
