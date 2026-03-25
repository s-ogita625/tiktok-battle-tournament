import { store } from '../data/store.js'
import { generateId } from '../utils/exportUtils.js'
import { today, formatDate, getDatePart, getTimePart, makeUnavailEntry, makeAvailEntry, getTimeRanges } from '../utils/dateUtils.js'
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

  // バトル時刻スロット（設定から取得）
  function getBattleTimes() {
    return store.getState().currentTournament?.settings?.defaultBattleTimes || ['21:00','21:30','22:00','22:30','23:00','23:30']
  }

  // ----- カレンダー表示ステータス判定 -----
  // 'none' / 'available-full' / 'available-partial' / 'unavailable-full' / 'mixed'
  function getDayStatus(dateStr, availField, unavailField) {
    const availEntries = formData[availField].filter(e => getDatePart(e) === dateStr)
    const unavailEntries = formData[unavailField].filter(e => getDatePart(e) === dateStr)

    const hasAvail = availEntries.length > 0
    const hasUnavail = unavailEntries.length > 0

    if (!hasAvail && !hasUnavail) return 'none'

    // 終日NGがあれば他に関係なく終日NG
    const hasFullUnavail = unavailEntries.some(e => !getTimePart(e))
    if (hasFullUnavail) return 'unavailable-full'

    // 終日可能（時間帯指定なし）
    const hasFullAvail = availEntries.some(e => !getTimePart(e))

    if (hasAvail && !hasUnavail) {
      return hasFullAvail ? 'available-full' : 'available-partial'
    }
    if (!hasAvail && hasUnavail) {
      return 'unavailable-partial'
    }
    // 両方ある（混在）
    return 'mixed'
  }

  // ----- カレンダー生成 -----
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
      const isPast  = dateStr < todayStr
      const status  = getDayStatus(dateStr, availField, unavailField)

      let cls = 'date-picker-day'
      if (isPast)                       cls += ' past'
      if (status === 'available-full')  cls += ' available'
      if (status === 'available-partial') cls += ' available-partial'
      if (status === 'unavailable-full')  cls += ' unavailable'
      if (status === 'unavailable-partial') cls += ' unavailable-partial'
      if (status === 'mixed')             cls += ' day-mixed'

      html += `<div class="${cls}" data-date="${dateStr}">${d}</div>`
    }
    html += `</div>
      <div class="date-picker-legend">
        <div class="legend-item"><div class="legend-dot available"></div>終日可</div>
        <div class="legend-item"><div class="legend-dot available-partial"></div>時間帯可</div>
        <div class="legend-item"><div class="legend-dot unavailable"></div>終日NG</div>
        <div class="legend-item"><div class="legend-dot unavailable-partial"></div>時間帯NG</div>
        <div class="legend-item"><div class="legend-dot day-mixed"></div>混在</div>
      </div>`
    return html
  }

  // ----- プレビュー表示 -----
  function renderPreview(availField, unavailField, previewId) {
    const el = container.querySelector(`#${previewId}`)
    if (!el) return

    // 日付ごとに集約
    const allDates = new Set([
      ...formData[availField].map(e => getDatePart(e)),
      ...formData[unavailField].map(e => getDatePart(e))
    ])

    const chips = []
    for (const dateStr of [...allDates].sort()) {
      const availEntries  = formData[availField].filter(e => getDatePart(e) === dateStr)
      const unavailEntries = formData[unavailField].filter(e => getDatePart(e) === dateStr)

      const hasFullUnavail = unavailEntries.some(e => !getTimePart(e))
      if (hasFullUnavail) {
        chips.push(`<span class="date-chip unavailable">${formatDate(dateStr)} 終日NG</span>`)
        continue
      }

      const hasFullAvail = availEntries.some(e => !getTimePart(e))
      if (hasFullAvail && unavailEntries.length === 0) {
        chips.push(`<span class="date-chip available">${formatDate(dateStr)}</span>`)
        continue
      }

      // 時間帯チップをまとめて表示
      for (const e of availEntries) {
        const tp = getTimePart(e)
        if (tp) {
          tp.split(',').forEach(r => {
            chips.push(`<span class="date-chip available-partial">${formatDate(dateStr)} ${r}可</span>`)
          })
        } else {
          chips.push(`<span class="date-chip available">${formatDate(dateStr)} 終日可</span>`)
        }
      }
      for (const e of unavailEntries) {
        const tp = getTimePart(e)
        if (tp) {
          tp.split(',').forEach(r => {
            chips.push(`<span class="date-chip unavailable-partial">${formatDate(dateStr)} ${r}NG</span>`)
          })
        }
      }
    }
    el.innerHTML = chips.join('')
  }

  // ----- 日付クリック → 時間帯設定モーダル -----
  function openDayModal(date, availField, unavailField, onSave) {
    const existing = document.getElementById('day-schedule-modal')
    if (existing) existing.remove()

    const battleTimes = getBattleTimes()
    // 全スロット（設定のバトル時刻 + 汎用0〜24時30分刻み）
    const allSlots = [...new Set([
      ...battleTimes,
      ...Array.from({length: 49}, (_, i) => {
        const h = String(Math.floor(i / 2)).padStart(2, '0')
        const m = i % 2 === 0 ? '00' : '30'
        return `${h}:${m}`
      })
    ])].sort().filter(t => t <= '24:00')

    // 現在のこの日の設定を読み込む
    const currentAvailEntries  = formData[availField].filter(e => getDatePart(e) === date)
    const currentUnavailEntries = formData[unavailField].filter(e => getDatePart(e) === date)

    const hasFullAvail   = currentAvailEntries.some(e => !getTimePart(e))
    const hasFullUnavail = currentUnavailEntries.some(e => !getTimePart(e))

    // 各スロットのステータスを計算
    // 'available' | 'unavailable' | 'none'
    function slotStatus(t) {
      if (hasFullUnavail) return 'unavailable'
      if (hasFullAvail)   return 'available'
      const inAvail = currentAvailEntries.some(e => {
        const tp = getTimePart(e)
        if (!tp) return true
        return tp.split(',').some(r => { const [s, en] = r.split('-'); return t >= s && t < en })
      })
      const inUnavail = currentUnavailEntries.some(e => {
        const tp = getTimePart(e)
        if (!tp) return true
        return tp.split(',').some(r => { const [s, en] = r.split('-'); return t >= s && t < en })
      })
      if (inAvail)   return 'available'
      if (inUnavail) return 'unavailable'
      return 'none'
    }

    // スロット行を生成（隣接スロットを「時間帯」として表示：例 21:00〜21:30 の帯）
    // allSlots[i] 〜 allSlots[i+1] の帯として扱う
    const ranges = []
    for (let i = 0; i < allSlots.length - 1; i++) {
      ranges.push({ start: allSlots[i], end: allSlots[i + 1] })
    }

    // 初期状態：各帯のステータス
    // 'available' | 'unavailable' | 'none'
    const rangeState = ranges.map(r => slotStatus(r.start))

    const modal = document.createElement('div')
    modal.id = 'day-schedule-modal'
    modal.style.cssText = 'display:flex;position:fixed;inset:0;z-index:2100;background:rgba(0,0,0,0.65);align-items:center;justify-content:center;padding:16px'

    const renderSlots = () => ranges.map((r, i) => {
      const st = rangeState[i]
      const isBattle = battleTimes.includes(r.start)
      const bg = st === 'available'   ? 'background:rgba(56,201,122,0.25);border-color:#38c97a;color:#38c97a'
               : st === 'unavailable' ? 'background:rgba(239,68,68,0.25);border-color:#ef4444;color:#ef4444'
               : 'background:transparent;border-color:var(--color-border);color:var(--color-text-dim)'
      const icon = st === 'available'   ? '✅'
                 : st === 'unavailable' ? '🚫'
                 : '　'
      return `<button type="button" class="slot-btn" data-idx="${i}" style="
        display:flex;align-items:center;justify-content:space-between;
        padding:7px 12px;border-radius:6px;border:1px solid;cursor:pointer;
        font-size:0.82rem;text-align:left;width:100%;
        transition:all 0.12s;${bg}
      ">
        <span>${r.start}〜${r.end}</span>
        <span style="display:flex;gap:6px;align-items:center">
          ${isBattle ? '<span style="font-size:0.65rem;background:rgba(255,200,0,0.2);color:#ffd700;padding:1px 5px;border-radius:4px;border:1px solid rgba(255,200,0,0.4)">バトル時刻</span>' : ''}
          <span>${icon}</span>
        </span>
      </button>`
    }).join('')

    modal.innerHTML = `
      <div class="modal" style="min-width:340px;max-width:420px;width:94%;max-height:92vh;display:flex;flex-direction:column">
        <div class="modal-header" style="flex-shrink:0">
          <h2 class="modal-title">📅 ${formatDate(date)} の設定</h2>
          <button class="modal-close" id="dsm-close">✕</button>
        </div>
        <div style="padding:12px 16px 8px;flex-shrink:0;border-bottom:1px solid var(--color-border)">
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button type="button" id="dsm-all-avail" class="btn btn-sm" style="background:rgba(56,201,122,0.2);border:1px solid #38c97a;color:#38c97a">✅ 終日可能</button>
            <button type="button" id="dsm-all-unavail" class="btn btn-sm" style="background:rgba(239,68,68,0.2);border:1px solid #ef4444;color:#ef4444">🚫 終日NG</button>
            <button type="button" id="dsm-clear" class="btn btn-sm btn-secondary">🗑️ クリア</button>
          </div>
          <div style="margin-top:8px;font-size:0.72rem;color:var(--color-text-muted)">
            各帯をクリックして切り替え: なし → 可能 → NG → なし
          </div>
        </div>
        <div id="dsm-slots" style="overflow-y:auto;padding:10px 16px;display:flex;flex-direction:column;gap:4px;flex:1">
          ${renderSlots()}
        </div>
        <div style="padding:12px 16px;display:flex;gap:8px;justify-content:flex-end;flex-shrink:0;border-top:1px solid var(--color-border)">
          <button type="button" class="btn btn-secondary" id="dsm-cancel">キャンセル</button>
          <button type="button" class="btn btn-primary" id="dsm-save">✅ 保存</button>
        </div>
      </div>
    `
    document.body.appendChild(modal)

    const close = () => modal.remove()
    modal.querySelector('#dsm-close').addEventListener('click', close)
    modal.querySelector('#dsm-cancel').addEventListener('click', close)
    modal.addEventListener('click', e => { if (e.target === modal) close() })

    // 一括ボタン
    modal.querySelector('#dsm-all-avail').addEventListener('click', () => {
      rangeState.fill('available')
      modal.querySelector('#dsm-slots').innerHTML = renderSlots()
      reattachSlotEvents()
    })
    modal.querySelector('#dsm-all-unavail').addEventListener('click', () => {
      rangeState.fill('unavailable')
      modal.querySelector('#dsm-slots').innerHTML = renderSlots()
      reattachSlotEvents()
    })
    modal.querySelector('#dsm-clear').addEventListener('click', () => {
      rangeState.fill('none')
      modal.querySelector('#dsm-slots').innerHTML = renderSlots()
      reattachSlotEvents()
    })

    function reattachSlotEvents() {
      modal.querySelectorAll('.slot-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.idx)
          // none → available → unavailable → none
          const cycle = { 'none': 'available', 'available': 'unavailable', 'unavailable': 'none' }
          rangeState[idx] = cycle[rangeState[idx]]
          modal.querySelector('#dsm-slots').innerHTML = renderSlots()
          reattachSlotEvents()
        })
      })
    }
    reattachSlotEvents()

    // 保存
    modal.querySelector('#dsm-save').addEventListener('click', () => {
      // この日の既存エントリをすべて削除
      formData[availField]   = formData[availField].filter(e => getDatePart(e) !== date)
      formData[unavailField] = formData[unavailField].filter(e => getDatePart(e) !== date)

      // rangeState から連続した同ステータスの帯をまとめて時間帯に変換
      const availRanges   = []
      const unavailRanges = []

      let i = 0
      while (i < ranges.length) {
        const st = rangeState[i]
        if (st === 'none') { i++; continue }
        // 同じステータスが続く限り結合
        let j = i
        while (j < ranges.length && rangeState[j] === st) j++
        const rangeStr = `${ranges[i].start}-${ranges[j - 1].end}`
        if (st === 'available')   availRanges.push(rangeStr)
        if (st === 'unavailable') unavailRanges.push(rangeStr)
        i = j
      }

      // availRanges が全スロットをカバーしていれば終日可能として記録
      const allAvail = availRanges.length > 0 && unavailRanges.length === 0
      const isFullDay = allAvail && availRanges.length === 1 &&
        availRanges[0] === `${ranges[0].start}-${ranges[ranges.length - 1].end}`

      if (availRanges.length > 0) {
        if (isFullDay) {
          formData[availField].push(date) // 終日可能
        } else {
          formData[availField].push(makeAvailEntry(date, availRanges.join(',')))
        }
      }
      if (unavailRanges.length > 0) {
        if (unavailRanges.length === 1 && availRanges.length === 0) {
          // NG しかない場合：1帯なら時間帯NG、全帯なら終日NG
          const allUnavail = unavailRanges.length === 1 &&
            unavailRanges[0] === `${ranges[0].start}-${ranges[ranges.length - 1].end}`
          if (allUnavail) {
            formData[unavailField].push(date) // 終日NG
          } else {
            formData[unavailField].push(makeUnavailEntry(date, unavailRanges[0]))
          }
        } else {
          // 複数NG帯
          formData[unavailField].push(makeUnavailEntry(date, unavailRanges.join(',')))
        }
      }

      onSave()
      close()

      // トースト
      const availStr   = availRanges.length   > 0 ? `可: ${availRanges.join(', ')}` : ''
      const unavailStr = unavailRanges.length  > 0 ? `NG: ${unavailRanges.join(', ')}` : ''
      const msg = [availStr, unavailStr].filter(Boolean).join(' / ')
      showToast(msg ? `${formatDate(date)} ${msg}` : `${formatDate(date)} の設定をクリアしました`, 'success')
    })
  }

  // ----- カレンダーイベント -----
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
        openDayModal(date, availField, unavailField, () => {
          calEl.innerHTML = renderCalendar(monthRef, availField, unavailField, prefix)
          attachCalendarEvents(calId, availField, unavailField, prefix, monthRef, previewId)
          renderPreview(availField, unavailField, previewId)
        })
      })
    })
  }

  // render()
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
              日付をクリック → 時間帯ごとに「可能」「NG」を設定
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
              日付をクリック → 時間帯ごとに「可能」「NG」を設定
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

    // ファイル選択 → Base64変換
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
        const urlInput = container.querySelector('#f-img')
        if (urlInput) urlInput.value = ''
        updateImgPreview(base64, `✅ ${file.name}`)
        showToast('画像をアップロードしました', 'success')
      }
      reader.readAsDataURL(file)
    })

    // 画像URLリアルタイムプレビュー
    container.querySelector('#f-img')?.addEventListener('input', (e) => {
      const raw = e.target.value.trim()
      const src = convertImageUrl(raw)
      if (src) {
        formData.profileImageUrl = src
        updateImgPreview(src, 'URL設定済み')
      } else {
        if (!formData.profileImageUrl?.startsWith('data:')) formData.profileImageUrl = ''
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
      const urlInputVal  = container.querySelector('#f-img').value.trim()
      if (urlInputVal) formData.profileImageUrl = convertImageUrl(urlInputVal)

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
