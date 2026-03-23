import { store } from '../data/store.js'
import { generateId } from '../utils/exportUtils.js'
import { today, formatDate } from '../utils/dateUtils.js'
import { convertImageUrl } from './ParticipantList.js'

export function renderParticipantForm(container, editingId = null) {
  const ct = store.getState().currentTournament
  const editing = editingId ? (ct?.participants || []).find(p => p.id === editingId) : null

  let currentGroupMonth = new Date()
  currentGroupMonth.setDate(1)
  let currentTournamentMonth = new Date()
  currentTournamentMonth.setDate(1)

  // グループ戦用 / トーナメント戦用 それぞれ管理
  let formData = editing ? {
    name: editing.name,
    sales: editing.sales,
    tiktokUrl: editing.tiktokUrl || '',
    profileImageUrl: editing.profileImageUrl || '',
    // グループ戦日程
    availableDates:   [...(editing.availableDates   || [])],
    unavailableDates: [...(editing.unavailableDates || [])],
    // トーナメント戦日程
    tournamentAvailableDates:   [...(editing.tournamentAvailableDates   || [])],
    tournamentUnavailableDates: [...(editing.tournamentUnavailableDates || [])]
  } : {
    name: '',
    sales: '',
    tiktokUrl: '',
    profileImageUrl: '',
    availableDates: [],
    unavailableDates: [],
    tournamentAvailableDates: [],
    tournamentUnavailableDates: []
  }

  // ----- カレンダー生成ヘルパー -----
  function renderCalendar(month, availField, unavailField, prefix) {
    const year  = month.getFullYear()
    const mth   = month.getMonth()
    const firstDay   = new Date(year, mth, 1).getDay()
    const daysInMonth = new Date(year, mth + 1, 0).getDate()
    const todayStr = today()
    const dayLabels = ['日','月','火','水','木','金','土']

    let html = `
      <div class="date-picker-header">
        <button class="date-picker-nav" id="${prefix}-prev">‹</button>
        <span class="date-picker-month">${year}年${mth + 1}月</span>
        <button class="date-picker-nav" id="${prefix}-next">›</button>
      </div>
      <div class="date-picker-grid">
        ${dayLabels.map(d => `<div class="date-picker-day-label">${d}</div>`).join('')}
    `
    for (let i = 0; i < firstDay; i++) html += `<div class="date-picker-day empty"></div>`
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(mth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const isPast   = dateStr < todayStr
      const isAvail  = formData[availField].includes(dateStr)
      const isUnavail = formData[unavailField].includes(dateStr)
      let cls = 'date-picker-day'
      if (isPast)    cls += ' past'
      if (isAvail)   cls += ' available'
      if (isUnavail) cls += ' unavailable'
      html += `<div class="${cls}" data-date="${dateStr}" data-avail="${availField}" data-unavail="${unavailField}">${d}</div>`
    }
    html += `</div>
      <div class="date-picker-legend">
        <div class="legend-item"><div class="legend-dot available"></div>バトル可能</div>
        <div class="legend-item"><div class="legend-dot unavailable"></div>バトル不可</div>
      </div>`
    return html
  }

  function render() {
    container.innerHTML = `
      <div class="participant-form-card">
        <h2 class="card-title" style="margin-bottom:20px">${editing ? '参加者を編集' : '参加者を追加'}</h2>
        <form id="participant-form" class="form-grid">

          <div class="form-group">
            <label class="form-label required">名前</label>
            <input class="form-input" id="f-name" type="text" placeholder="例: 山田太郎" value="${escHtml(formData.name)}" maxlength="30" required />
          </div>

          <div class="form-group">
            <label class="form-label required">売上（パワーバランス）</label>
            <input class="form-input" id="f-sales" type="number" placeholder="例: 1500000" value="${formData.sales}" min="0" required />
          </div>

          <div class="form-group">
            <label class="form-label">TikTokアカウントURL</label>
            <input class="form-input" id="f-tiktok" type="url" placeholder="https://www.tiktok.com/@username" value="${escHtml(formData.tiktokUrl)}" />
          </div>

          <div class="form-group">
            <label class="form-label">プロフィール画像URL</label>
            <input class="form-input" id="f-img" type="text" placeholder="https://... またはGoogleドライブ共有リンク" value="${escHtml(formData.profileImageUrl)}" />
            <span class="form-hint">TikTokのURLまたはGoogleドライブの共有リンクを貼り付けてください</span>
            <div id="img-preview-wrap" style="margin-top:8px;display:flex;align-items:center;gap:10px">
              ${formData.profileImageUrl ? `<img id="img-preview" src="${escHtml(convertImageUrl(formData.profileImageUrl))}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid var(--color-border)" onerror="this.style.display='none'" alt="プレビュー" />` : ''}
            </div>
          </div>

          <!-- グループ戦日程 -->
          <div class="form-group">
            <label class="form-label" style="color:var(--color-secondary)">⚔️ グループ戦 バトル日程</label>
            <div class="date-picker-container">
              <div id="cal-group">${renderCalendar(currentGroupMonth, 'availableDates', 'unavailableDates', 'grp')}</div>
            </div>
            <div style="display:flex;gap:12px;margin-top:6px;font-size:0.75rem;color:var(--color-text-muted)">
              <span>左クリック: 可能 / 右クリック: 不可 / 再クリック: クリア</span>
            </div>
            <div id="preview-group" style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap"></div>
          </div>

          <!-- トーナメント戦日程 -->
          <div class="form-group">
            <label class="form-label" style="color:#ffd700">🏆 トーナメント戦 バトル日程</label>
            <div class="date-picker-container">
              <div id="cal-tournament">${renderCalendar(currentTournamentMonth, 'tournamentAvailableDates', 'tournamentUnavailableDates', 'trn')}</div>
            </div>
            <div style="display:flex;gap:12px;margin-top:6px;font-size:0.75rem;color:var(--color-text-muted)">
              <span>左クリック: 可能 / 右クリック: 不可 / 再クリック: クリア</span>
            </div>
            <div id="preview-tournament" style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap"></div>
          </div>

          <div style="display:flex;gap:8px;padding-top:4px">
            ${editing ? `<button type="button" id="cancel-edit-btn" class="btn btn-secondary" style="flex:1">キャンセル</button>` : ''}
            <button type="submit" class="btn btn-primary" style="flex:2">${editing ? '保存する' : '追加する'}</button>
          </div>
        </form>
      </div>
    `

    attachCalendarEvents('cal-group', 'availableDates', 'unavailableDates', 'grp', currentGroupMonth, 'preview-group')
    attachCalendarEvents('cal-tournament', 'tournamentAvailableDates', 'tournamentUnavailableDates', 'trn', currentTournamentMonth, 'preview-tournament')
    renderPreview('availableDates', 'unavailableDates', 'preview-group')
    renderPreview('tournamentAvailableDates', 'tournamentUnavailableDates', 'preview-tournament')
  }

  function renderPreview(availField, unavailField, previewId) {
    const el = container.querySelector(`#${previewId}`)
    if (!el) return
    const all = [
      ...formData[availField].map(d => ({ d, type: 'available' })),
      ...formData[unavailField].map(d => ({ d, type: 'unavailable' }))
    ].sort((a, b) => a.d.localeCompare(b.d))
    el.innerHTML = all.map(({ d, type }) =>
      `<span class="date-chip ${type}">${formatDate(d)}</span>`
    ).join('')
  }

  function attachCalendarEvents(calId, availField, unavailField, prefix, monthRef, previewId) {
    const calEl = container.querySelector(`#${calId}`)
    if (!calEl) return

    container.querySelector(`#${prefix}-prev`)?.addEventListener('click', () => {
      monthRef.setMonth(monthRef.getMonth() - 1)
      calEl.innerHTML = renderCalendar(monthRef, availField, unavailField, prefix)
      attachCalendarEvents(calId, availField, unavailField, prefix, monthRef, previewId)
    })
    container.querySelector(`#${prefix}-next`)?.addEventListener('click', () => {
      monthRef.setMonth(monthRef.getMonth() + 1)
      calEl.innerHTML = renderCalendar(monthRef, availField, unavailField, prefix)
      attachCalendarEvents(calId, availField, unavailField, prefix, monthRef, previewId)
    })

    calEl.querySelectorAll('.date-picker-day[data-date]').forEach(el => {
      if (el.classList.contains('past')) return
      el.addEventListener('click', () => {
        const date = el.dataset.date
        const avArr  = formData[availField]
        const unArr  = formData[unavailField]
        if (avArr.includes(date)) {
          formData[availField] = avArr.filter(d => d !== date)
        } else if (unArr.includes(date)) {
          formData[unavailField] = unArr.filter(d => d !== date)
        } else {
          formData[availField].push(date)
        }
        calEl.innerHTML = renderCalendar(monthRef, availField, unavailField, prefix)
        attachCalendarEvents(calId, availField, unavailField, prefix, monthRef, previewId)
        renderPreview(availField, unavailField, previewId)
      })
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        const date = el.dataset.date
        const avArr  = formData[availField]
        const unArr  = formData[unavailField]
        if (unArr.includes(date)) {
          formData[unavailField] = unArr.filter(d => d !== date)
        } else if (avArr.includes(date)) {
          formData[availField] = avArr.filter(d => d !== date)
          formData[unavailField].push(date)
        } else {
          formData[unavailField].push(date)
        }
        calEl.innerHTML = renderCalendar(monthRef, availField, unavailField, prefix)
        attachCalendarEvents(calId, availField, unavailField, prefix, monthRef, previewId)
        renderPreview(availField, unavailField, previewId)
      })
    })
  }

  render()

  // 画像URLの入力に応じてプレビューをリアルタイム更新
  container.querySelector('#f-img')?.addEventListener('input', (e) => {
    const wrap = container.querySelector('#img-preview-wrap')
    if (!wrap) return
    const raw = e.target.value.trim()
    const src = convertImageUrl(raw)
    if (src) {
      let img = wrap.querySelector('#img-preview')
      if (!img) {
        img = document.createElement('img')
        img.id = 'img-preview'
        img.style.cssText = 'width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid var(--color-border)'
        img.alt = 'プレビュー'
        img.onerror = () => { img.style.display = 'none' }
        wrap.appendChild(img)
      }
      img.style.display = ''
      img.src = src
    } else {
      const img = wrap.querySelector('#img-preview')
      if (img) img.style.display = 'none'
    }
  })

  const form = container.querySelector('#participant-form')
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    formData.name = container.querySelector('#f-name').value.trim()
    formData.sales = Number(container.querySelector('#f-sales').value)
    formData.tiktokUrl = container.querySelector('#f-tiktok').value.trim()
    // Googleドライブ共有リンクを自動変換して保存
    formData.profileImageUrl = convertImageUrl(container.querySelector('#f-img').value.trim())

    if (!formData.name || isNaN(formData.sales)) return

    if (editing) {
      store.updateTournament(ct => ({
        participants: ct.participants.map(p =>
          p.id === editingId ? { ...p, ...formData } : p
        )
      }))
      showToast('参加者を更新しました', 'success')
      container.dispatchEvent(new CustomEvent('edit-done'))
    } else {
      const participant = {
        id: generateId(),
        ...formData,
        groupId: null,
        createdAt: new Date().toISOString()
      }
      store.updateTournament(ct => ({ participants: [...ct.participants, participant] }))
      showToast(`${formData.name} を追加しました`, 'success')
      formData = {
        name: '', sales: '', tiktokUrl: '', profileImageUrl: '',
        availableDates: [], unavailableDates: [],
        tournamentAvailableDates: [], tournamentUnavailableDates: []
      }
      render()
    }
  })

  container.querySelector('#cancel-edit-btn')?.addEventListener('click', () => {
    container.dispatchEvent(new CustomEvent('edit-done'))
  })
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
function showToast(message, type = 'info') {
  let c = document.querySelector('.toast-container')
  if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c) }
  const t = document.createElement('div')
  t.className = `toast ${type}`; t.textContent = message; c.appendChild(t)
  setTimeout(() => t.remove(), 3000)
}
