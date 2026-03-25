import { store } from '../data/store.js'
import { generateId } from '../utils/exportUtils.js'
import { today, formatDate, getDatePart, getTimePart, makeUnavailEntry } from '../utils/dateUtils.js'
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
        <button type="button" class="date-picker-nav" id="${prefix}-prev">‹</button>
        <span class="date-picker-month">${year}年${mth + 1}月</span>
        <button type="button" class="date-picker-nav" id="${prefix}-next">›</button>
      </div>
      <div class="date-picker-grid">
        ${dayLabels.map(d => `<div class="date-picker-day-label">${d}</div>`).join('')}
    `
    for (let i = 0; i < firstDay; i++) html += `<div class="date-picker-day empty"></div>`
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(mth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const isPast   = dateStr < todayStr
      const isAvail  = formData[availField].includes(dateStr)
      // unavailField は終日NG or 時間帯NG の両方を含む
      const unavailEntry = formData[unavailField].find(e => getDatePart(e) === dateStr)
      const isUnavail    = !!unavailEntry
      const isTimeUnavail = isUnavail && !!getTimePart(unavailEntry) // 時間帯指定あり
      let cls = 'date-picker-day'
      if (isPast)         cls += ' past'
      if (isAvail)        cls += ' available'
      if (isUnavail && !isTimeUnavail) cls += ' unavailable'
      if (isTimeUnavail)  cls += ' unavailable-partial'
      html += `<div class="${cls}" data-date="${dateStr}" data-avail="${availField}" data-unavail="${unavailField}">${d}</div>`
    }
    html += `</div>
      <div class="date-picker-legend">
        <div class="legend-item"><div class="legend-dot available"></div>バトル可能</div>
        <div class="legend-item"><div class="legend-dot unavailable"></div>終日NG</div>
        <div class="legend-item"><div class="legend-dot unavailable-partial"></div>時間帯NG</div>
      </div>`
    return html
  }

  function renderPreview(availField, unavailField, previewId) {
    const el = container.querySelector(`#${previewId}`)
    if (!el) return
    const all = [
      ...formData[availField].map(d => ({ d, type: 'available', label: formatDate(d) })),
      ...formData[unavailField].map(entry => {
        const datePart = getDatePart(entry)
        const timePart = getTimePart(entry)
        const label = timePart ? `${formatDate(datePart)} ${timePart}NG` : formatDate(datePart)
        return { d: entry, type: timePart ? 'unavailable-partial' : 'unavailable', label }
      })
    ].sort((a, b) => getDatePart(a.d).localeCompare(getDatePart(b.d)))
    el.innerHTML = all.map(({ d, type, label }) =>
      `<span class="date-chip ${type}" style="${type === 'unavailable-partial' ? 'background:rgba(255,150,0,0.18);color:#ffa040;border-color:#ffa040' : ''}">${label}</span>`
    ).join('')
  }

  // 右クリック時のNG種別選択ポップアップ
  function showUnavailPopup(e, date, unavailField, availField, calId, monthRef, previewId) {
    e.preventDefault()
    // 既存ポップアップ削除
    document.querySelectorAll('.unavail-popup').forEach(p => p.remove())

    const popup = document.createElement('div')
    popup.className = 'unavail-popup'
    popup.style.cssText = `
      position:fixed;z-index:2000;
      background:var(--color-surface2);border:1px solid var(--color-border);
      border-radius:8px;padding:6px;
      box-shadow:0 4px 16px rgba(0,0,0,0.4);
      display:flex;flex-direction:column;gap:4px;min-width:160px;
    `
    popup.style.left = `${Math.min(e.clientX, window.innerWidth - 180)}px`
    popup.style.top  = `${Math.min(e.clientY, window.innerHeight - 120)}px`

    popup.innerHTML = `
      <div style="font-size:0.72rem;color:var(--color-text-muted);padding:2px 6px 4px">NGを設定</div>
      <button class="btn btn-sm" id="pop-allday" style="text-align:left;padding:5px 10px">🚫 終日NG</button>
      <button class="btn btn-sm" id="pop-time" style="text-align:left;padding:5px 10px">⏰ 時間帯NG...</button>
      <button class="btn btn-sm btn-danger" id="pop-clear" style="text-align:left;padding:5px 10px">🗑️ クリア</button>
    `
    document.body.appendChild(popup)

    const closePopup = () => popup.remove()
    setTimeout(() => document.addEventListener('click', closePopup, { once: true }), 0)

    popup.querySelector('#pop-allday').addEventListener('click', (ev) => {
      ev.stopPropagation()
      // 同じ日の既存NG削除（時間帯含む）→ 終日NGを追加
      formData[unavailField] = formData[unavailField].filter(en => getDatePart(en) !== date)
      formData[availField]   = formData[availField].filter(d => d !== date)
      formData[unavailField].push(date)
      refreshCalendar()
      closePopup()
    })

    popup.querySelector('#pop-time').addEventListener('click', (ev) => {
      ev.stopPropagation()
      closePopup()
      showTimeRangeModal(date, unavailField, availField, refreshCalendar)
    })

    popup.querySelector('#pop-clear').addEventListener('click', (ev) => {
      ev.stopPropagation()
      formData[unavailField] = formData[unavailField].filter(en => getDatePart(en) !== date)
      formData[availField]   = formData[availField].filter(d => d !== date)
      refreshCalendar()
      closePopup()
    })

    function refreshCalendar() {
      const calEl = container.querySelector(`#${calId}`)
      if (!calEl) return
      calEl.innerHTML = renderCalendar(monthRef, availField, unavailField, prefix)
      attachCalendarEvents(calId, availField, unavailField, prefix, monthRef, previewId)
      renderPreview(availField, unavailField, previewId)
    }
  }

  // 時間帯NGモーダル
  function showTimeRangeModal(date, unavailField, availField, onSave) {
    const existing = document.getElementById('time-range-modal')
    if (existing) existing.remove()

    // バトル時刻リストをsettingsから取得してセレクト候補にする
    const battleTimes = store.getState().currentTournament?.settings?.defaultBattleTimes || ['21:00','21:30','22:00','22:30','23:00','23:30']
    // 候補: battleTimes ＋ 汎用0〜24時（30分刻み）からユニーク
    const allSlots = [...new Set([
      ...battleTimes,
      ...Array.from({length:48}, (_, i) => {
        const h = String(Math.floor(i/2)).padStart(2,'0')
        const m = i % 2 === 0 ? '00' : '30'
        return `${h}:${m}`
      })
    ])].sort()

    const makeOptions = (selected) => allSlots.map(t =>
      `<option value="${t}" ${t === selected ? 'selected' : ''}>${t}</option>`
    ).join('')

    const modal = document.createElement('div')
    modal.id = 'time-range-modal'
    modal.style.cssText = 'display:flex;position:fixed;inset:0;z-index:2100;background:rgba(0,0,0,0.6);align-items:center;justify-content:center'
    modal.innerHTML = `
      <div class="modal" style="min-width:300px;max-width:360px;width:90%">
        <div class="modal-header">
          <h2 class="modal-title">⏰ 時間帯NGを設定</h2>
          <button class="modal-close" id="tr-close">✕</button>
        </div>
        <div style="padding:16px;display:flex;flex-direction:column;gap:12px">
          <div style="font-size:0.82rem;color:var(--color-text-muted)">${formatDate(date)}</div>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="flex:1">
              <label class="form-label">開始</label>
              <select class="form-input" id="tr-start">${makeOptions('21:00')}</select>
            </div>
            <div style="padding-top:22px;color:var(--color-text-dim)">〜</div>
            <div style="flex:1">
              <label class="form-label">終了</label>
              <select class="form-input" id="tr-end">${makeOptions('23:30')}</select>
            </div>
          </div>
          <div style="font-size:0.75rem;color:var(--color-text-muted)">指定した時間帯はバトル時刻の自動割り当てで除外されます</div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn-secondary" id="tr-cancel">キャンセル</button>
            <button class="btn btn-primary" id="tr-save">✅ 追加</button>
          </div>
        </div>
      </div>
    `
    document.body.appendChild(modal)

    const close = () => modal.remove()
    modal.querySelector('#tr-close').addEventListener('click', close)
    modal.querySelector('#tr-cancel').addEventListener('click', close)
    modal.addEventListener('click', (e) => { if (e.target === modal) close() })

    modal.querySelector('#tr-save').addEventListener('click', () => {
      const startVal = modal.querySelector('#tr-start').value
      const endVal   = modal.querySelector('#tr-end').value
      if (startVal >= endVal) {
        showToast('終了時刻は開始時刻より後にしてください', 'error')
        return
      }
      // 同じ日の既存NG削除
      formData[unavailField] = formData[unavailField].filter(en => getDatePart(en) !== date)
      formData[availField]   = formData[availField].filter(d => d !== date)
      formData[unavailField].push(makeUnavailEntry(date, `${startVal}-${endVal}`))
      onSave()
      close()
      showToast(`${formatDate(date)} ${startVal}〜${endVal} をNGに設定しました`, 'success')
    })
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
        // unavailField に同じ日があるかチェック（日付部分のみ比較）
        const hasUnavail = unArr.some(e => getDatePart(e) === date)
        if (avArr.includes(date)) {
          formData[availField] = avArr.filter(d => d !== date)
        } else if (hasUnavail) {
          formData[unavailField] = unArr.filter(e => getDatePart(e) !== date)
        } else {
          formData[availField].push(date)
        }
        calEl.innerHTML = renderCalendar(monthRef, availField, unavailField, prefix)
        attachCalendarEvents(calId, availField, unavailField, prefix, monthRef, previewId)
        renderPreview(availField, unavailField, previewId)
      })
      el.addEventListener('contextmenu', (e) => {
        showUnavailPopup(e, el.dataset.date, unavailField, availField, calId, monthRef, previewId)
      })
    })
  }

  // render() の中にすべてのイベント登録をまとめる
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
            <label class="form-label">プロフィール画像</label>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
              <button type="button" class="btn btn-secondary btn-sm" id="upload-img-btn" style="white-space:nowrap">📁 画像をアップロード</button>
              <span style="font-size:0.75rem;color:var(--color-text-muted)">または↓にURLを貼り付け</span>
            </div>
            <input type="file" id="f-img-file" accept="image/*" style="display:none" />
            <input class="form-input" id="f-img" type="text" placeholder="https://... (画像の直リンクURL)" value="${escHtml(formData.profileImageUrl && !formData.profileImageUrl.startsWith('data:') ? formData.profileImageUrl : '')}" />
            <span class="form-hint">JPG・PNG・GIF対応。ファイルアップロード推奨（URLはCORS制限で表示されない場合があります）</span>
            <div id="img-preview-wrap" style="margin-top:8px;display:flex;align-items:center;gap:10px">
              ${formData.profileImageUrl ? `<img id="img-preview" src="${escHtml(formData.profileImageUrl.startsWith('data:') ? formData.profileImageUrl : convertImageUrl(formData.profileImageUrl))}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid var(--color-border)" onerror="this.style.display='none'" alt="プレビュー" />` : ''}
              ${formData.profileImageUrl ? `<span id="img-status" style="font-size:0.75rem;color:var(--color-text-muted)">${formData.profileImageUrl.startsWith('data:') ? '✅ アップロード済み' : 'URL設定済み'}</span>` : '<span id="img-status" style="font-size:0.75rem;color:var(--color-text-muted)">未設定</span>'}
            </div>
          </div>

          <!-- グループ戦日程 -->
          <div class="form-group">
            <label class="form-label" style="color:var(--color-secondary)">⚔️ グループ戦 バトル日程</label>
            <div class="date-picker-container">
              <div id="cal-group">${renderCalendar(currentGroupMonth, 'availableDates', 'unavailableDates', 'grp')}</div>
            </div>
            <div style="margin-top:6px;font-size:0.75rem;color:var(--color-text-muted);line-height:1.7">
              左クリック: バトル可能 ／ 右クリック: 終日NG or 時間帯NG を選択 ／ 再クリック: クリア
            </div>
            <div id="preview-group" style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap"></div>
          </div>

          <!-- トーナメント戦日程 -->
          <div class="form-group">
            <label class="form-label" style="color:#ffd700">🏆 トーナメント戦 バトル日程</label>
            <div class="date-picker-container">
              <div id="cal-tournament">${renderCalendar(currentTournamentMonth, 'tournamentAvailableDates', 'tournamentUnavailableDates', 'trn')}</div>
            </div>
            <div style="margin-top:6px;font-size:0.75rem;color:var(--color-text-muted);line-height:1.7">
              左クリック: バトル可能 ／ 右クリック: 終日NG or 時間帯NG を選択 ／ 再クリック: クリア
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

    // 画像アップロードボタン → hidden file input をトリガー
    container.querySelector('#upload-img-btn')?.addEventListener('click', () => {
      container.querySelector('#f-img-file')?.click()
    })

    // ファイル選択 → Base64変換してプレビュー＆formDataに保存
    container.querySelector('#f-img-file')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (file.size > 2 * 1024 * 1024) {
        showToast('画像は2MB以下にしてください', 'error')
        return
      }
      const reader = new FileReader()
      reader.onload = (ev) => {
        const base64 = ev.target.result
        formData.profileImageUrl = base64
        // URLフィールドをクリア（アップロード優先）
        const urlInput = container.querySelector('#f-img')
        if (urlInput) urlInput.value = ''
        // プレビュー更新
        updateImgPreview(base64, `✅ ${file.name}`)
        showToast('画像をアップロードしました', 'success')
      }
      reader.readAsDataURL(file)
    })

    // 画像URLのリアルタイムプレビュー
    container.querySelector('#f-img')?.addEventListener('input', (e) => {
      const raw = e.target.value.trim()
      const src = convertImageUrl(raw)
      if (src) {
        formData.profileImageUrl = src
        updateImgPreview(src, 'URL設定済み')
      } else {
        // URLが空になったらBase64も持ってなければ未設定
        if (!formData.profileImageUrl?.startsWith('data:')) {
          formData.profileImageUrl = ''
        }
        updateImgPreview('', '未設定')
      }
    })

    function updateImgPreview(src, statusText) {
      const wrap = container.querySelector('#img-preview-wrap')
      if (!wrap) return
      let img = wrap.querySelector('#img-preview')
      let statusEl = wrap.querySelector('#img-status')
      if (src) {
        if (!img) {
          img = document.createElement('img')
          img.id = 'img-preview'
          img.style.cssText = 'width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid var(--color-border)'
          img.alt = 'プレビュー'
          img.onerror = () => { img.style.display = 'none' }
          wrap.insertBefore(img, wrap.firstChild)
        }
        img.style.display = ''
        img.src = src
      } else {
        if (img) img.style.display = 'none'
      }
      if (statusEl) statusEl.textContent = statusText
    }

    // フォーム送信
    const form = container.querySelector('#participant-form')
    form.addEventListener('submit', (e) => {
      e.preventDefault()

      const nameVal  = container.querySelector('#f-name').value.trim()
      const salesVal = Number(container.querySelector('#f-sales').value)
      if (!nameVal || isNaN(salesVal)) return

      formData.name      = nameVal
      formData.sales     = salesVal
      formData.tiktokUrl = container.querySelector('#f-tiktok').value.trim()
      // Base64アップロード済みの場合はformDataのまま使用。URLが入力されている場合は変換する
      const urlInputVal = container.querySelector('#f-img').value.trim()
      if (urlInputVal) {
        formData.profileImageUrl = convertImageUrl(urlInputVal)
      }
      // formData.profileImageUrl はファイルアップロード時にすでにBase64がセットされている

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
        // storeを更新（これによりParticipantListのrenderが走る）
        store.updateTournament(ct => ({ participants: [...ct.participants, participant] }))
        showToast(`${formData.name} を追加しました`, 'success')

        // formDataをリセットしてフォームを再描画
        formData = {
          name: '', sales: '', tiktokUrl: '', profileImageUrl: '',
          availableDates: [], unavailableDates: [],
          tournamentAvailableDates: [], tournamentUnavailableDates: []
        }
        render()
      }
    })

    // キャンセルボタン
    container.querySelector('#cancel-edit-btn')?.addEventListener('click', () => {
      container.dispatchEvent(new CustomEvent('edit-done'))
    })
  }

  render()
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
