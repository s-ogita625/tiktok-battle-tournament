import { store } from '../data/store.js'
import { formatDate } from '../utils/dateUtils.js'
import { getRoundName } from '../services/tournamentService.js'

/**
 * 連絡タブ
 * 参加者を選択 → ステージ（グループ戦 / トーナメント戦）を選択
 * → 対戦日程の案内文を生成してコピーできるようにする
 */
export function renderNoticeBoard(container) {
  function render() {
    const ct = store.getState().currentTournament
    if (!ct) return

    const { participants, groups, tournamentBracket, title } = ct
    const hasGroups      = groups && groups.length > 0
    const hasTournament  = !!tournamentBracket

    if (!hasGroups && !hasTournament) {
      container.innerHTML = `
        <div class="page-header">
          <div>
            <h1 class="page-title">連絡</h1>
            <p class="page-subtitle">参加者への対戦案内文を生成します</p>
          </div>
        </div>
        <div class="empty-state" style="margin-top:60px">
          <div class="empty-state-icon">📢</div>
          <div class="empty-state-title">グループ戦がまだ開始されていません</div>
          <div class="empty-state-desc">グループ割り振りを実行すると案内文を生成できます</div>
        </div>
      `
      return
    }

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">連絡</h1>
          <p class="page-subtitle">参加者への対戦日程案内文を生成します</p>
        </div>
      </div>

      <div class="notice-layout">
        <!-- 左：選択パネル -->
        <div class="notice-select-panel card">
          <div class="form-group">
            <label class="form-label required">参加者を選択</label>
            <select class="form-input" id="notice-participant">
              <option value="">-- 参加者を選んでください --</option>
              ${participants.map(p =>
                `<option value="${escHtml(p.id)}">${escHtml(p.name)}</option>`
              ).join('')}
            </select>
          </div>

          <div class="form-group" id="notice-stage-group" style="display:none">
            <label class="form-label required">ステージを選択</label>
            <div class="notice-stage-btns">
              ${hasGroups ? `
                <button type="button" class="btn btn-secondary notice-stage-btn" data-stage="group">
                  ⚔️ グループ戦
                </button>
              ` : ''}
              ${hasTournament ? `
                <button type="button" class="btn btn-secondary notice-stage-btn" data-stage="tournament">
                  🏆 トーナメント戦
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- 右：案内文パネル -->
        <div class="notice-output-panel" id="notice-output-panel">
          <div class="empty-state" style="margin-top:0;padding:40px 0">
            <div class="empty-state-icon">📋</div>
            <div class="empty-state-desc">参加者とステージを選ぶと<br>案内文が表示されます</div>
          </div>
        </div>
      </div>
    `

    // 参加者選択イベント
    const participantSelect = container.querySelector('#notice-participant')
    participantSelect.addEventListener('change', () => {
      const stageGroup = container.querySelector('#notice-stage-group')
      // ステージ選択をリセット
      container.querySelectorAll('.notice-stage-btn').forEach(b => b.classList.remove('active'))
      clearOutput()
      if (participantSelect.value) {
        stageGroup.style.display = ''
      } else {
        stageGroup.style.display = 'none'
      }
    })

    // ステージ選択イベント
    container.querySelectorAll('.notice-stage-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.notice-stage-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        const participantId = participantSelect.value
        const stage = btn.dataset.stage
        if (participantId) {
          showNotice(participantId, stage, ct)
        }
      })
    })
  }

  function clearOutput() {
    const panel = container.querySelector('#notice-output-panel')
    if (!panel) return
    panel.innerHTML = `
      <div class="empty-state" style="margin-top:0;padding:40px 0">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-desc">参加者とステージを選ぶと<br>案内文が表示されます</div>
      </div>
    `
  }

  function showNotice(participantId, stage, ct) {
    const panel = container.querySelector('#notice-output-panel')
    if (!panel) return

    const participant = ct.participants.find(p => p.id === participantId)
    if (!participant) return

    let noticeText = ''
    let matchRows  = []

    if (stage === 'group') {
      // グループ戦の対戦を抽出
      for (const group of ct.groups) {
        if (!group.participantIds.includes(participantId)) continue
        for (const battle of group.battles) {
          const isP1 = battle.participant1Id === participantId
          const isP2 = battle.participant2Id === participantId
          if (!isP1 && !isP2) continue
          const opponentId = isP1 ? battle.participant2Id : battle.participant1Id
          const opponent = ct.participants.find(p => p.id === opponentId)
          matchRows.push({
            opponent: opponent?.name || '不明',
            date: battle.scheduledDate,
            time: battle.scheduledTime,
            result: battle.result,
            roundLabel: group.name
          })
        }
        break  // 同一グループは1つのみ
      }
      noticeText = buildGroupNoticeText(participant.name, ct.title, matchRows)
    } else {
      // トーナメント戦の対戦を抽出
      const { rounds } = ct.tournamentBracket
      const totalRounds = rounds.length
      for (let rIdx = 0; rIdx < rounds.length; rIdx++) {
        const round = rounds[rIdx]
        for (const match of round) {
          const isP1 = match.player1Id === participantId
          const isP2 = match.player2Id === participantId
          if (!isP1 && !isP2) continue
          const opponentId = isP1 ? match.player2Id : match.player1Id
          const opponent = ct.participants.find(p => p.id === opponentId)
          matchRows.push({
            opponent: opponent?.name || (opponentId ? '不明' : '対戦相手未定'),
            date: match.scheduledDate || null,
            time: match.scheduledTime || null,
            result: match.result,
            roundLabel: getRoundName(rIdx, totalRounds)
          })
        }
      }
      noticeText = buildTournamentNoticeText(participant.name, ct.title, matchRows)
    }

    const stageLabel = stage === 'group' ? 'グループ戦' : 'トーナメント戦'

    panel.innerHTML = `
      <div class="notice-output-card card">
        <div class="notice-output-header">
          <div>
            <div class="notice-output-title">
              ${escHtml(participant.name)} さんへの${stageLabel}案内
            </div>
            <div class="notice-output-meta">${matchRows.length}試合</div>
          </div>
          <button class="btn btn-primary btn-sm" id="copy-notice-btn">📋 コピー</button>
        </div>

        <pre class="notice-text-box" id="notice-text-box">${escHtml(noticeText)}</pre>

        ${matchRows.length > 0 ? `
          <div class="notice-matches">
            <div class="notice-matches-title">対戦一覧</div>
            ${matchRows.map(row => renderMatchRow(row)).join('')}
          </div>
        ` : `
          <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:12px">
            対戦情報がありません
          </p>
        `}
      </div>
    `

    container.querySelector('#copy-notice-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(noticeText).then(() => {
        showToast('案内文をコピーしました', 'success')
      }).catch(() => {
        // フォールバック
        const ta = document.createElement('textarea')
        ta.value = noticeText
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
        showToast('案内文をコピーしました', 'success')
      })
    })
  }

  if (container._unsubscribeStore) {
    container._unsubscribeStore()
  }
  container._unsubscribeStore = store.subscribe(render)
  render()
}

// ──────────────────────────────────────────────
//  案内文テキスト生成
// ──────────────────────────────────────────────

function buildGroupNoticeText(name, tournamentTitle, matches) {
  const lines = []
  lines.push(`【${tournamentTitle} グループ戦 日程のご案内】`)
  lines.push(``)
  lines.push(`${name} さん、お疲れ様です！`)
  lines.push(`グループ戦の対戦日程が確定しましたのでお知らせします。`)
  lines.push(``)

  if (matches.length === 0) {
    lines.push(`※ 現在対戦日程が登録されていません。`)
  } else {
    matches.forEach((m, i) => {
      lines.push(`【対戦 ${i + 1}】${m.roundLabel}`)
      lines.push(`相手: ${m.opponent}`)
      lines.push(`日程: ${m.date ? formatDate(m.date) : '日程未定'}${m.time ? ` ${m.time}〜` : ''}`)
      if (m.result) {
        lines.push(`状態: 結果入力済み`)
      } else {
        lines.push(`状態: 対戦待ち`)
      }
      lines.push(``)
    })
  }

  lines.push(`よろしくお願いいたします。`)
  return lines.join('\n')
}

function buildTournamentNoticeText(name, tournamentTitle, matches) {
  const lines = []
  lines.push(`【${tournamentTitle} 決勝トーナメント 日程のご案内】`)
  lines.push(``)
  lines.push(`${name} さん、グループ戦を勝ち抜き決勝トーナメント進出おめでとうございます！`)
  lines.push(`決勝トーナメントの対戦日程をお知らせします。`)
  lines.push(``)

  if (matches.length === 0) {
    lines.push(`※ 現在対戦日程が登録されていません。`)
  } else {
    matches.forEach((m, i) => {
      lines.push(`【${m.roundLabel}】`)
      lines.push(`相手: ${m.opponent}`)
      lines.push(`日程: ${m.date ? formatDate(m.date) : '日程未定'}${m.time ? ` ${m.time}〜` : ''}`)
      if (m.result && !m.result.isBye) {
        lines.push(`状態: 結果入力済み`)
      } else if (m.result?.isBye) {
        lines.push(`状態: 不戦勝（BYE）`)
      } else {
        lines.push(`状態: 対戦待ち`)
      }
      lines.push(``)
    })
  }

  lines.push(`引き続きよろしくお願いいたします。`)
  return lines.join('\n')
}

// ──────────────────────────────────────────────
//  対戦行 HTML レンダリング
// ──────────────────────────────────────────────

function renderMatchRow(row) {
  let statusBadge = ''
  if (row.result && !row.result.isBye) {
    statusBadge = `<span class="notice-match-badge done">結果入力済み</span>`
  } else if (row.result?.isBye) {
    statusBadge = `<span class="notice-match-badge bye">不戦勝</span>`
  } else {
    statusBadge = `<span class="notice-match-badge pending">対戦待ち</span>`
  }

  return `
    <div class="notice-match-row">
      <div class="notice-match-round">${escHtml(row.roundLabel)}</div>
      <div class="notice-match-info">
        <span class="notice-match-vs">vs ${escHtml(row.opponent)}</span>
        <span class="notice-match-date">
          ${row.date ? formatDate(row.date) : '日程未定'}
          ${row.time ? row.time + '〜' : ''}
        </span>
      </div>
      <div>${statusBadge}</div>
    </div>
  `
}

// ──────────────────────────────────────────────
//  ユーティリティ
// ──────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

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
  setTimeout(() => toast.remove(), 3000)
}
