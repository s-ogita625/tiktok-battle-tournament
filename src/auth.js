/**
 * auth.js — 管理画面のログインガード
 *
 * ログイン処理: /api/auth に POST して ADMIN_ID/ADMIN_PASSWORD を検証。
 * 成功時に返ってきた ADMIN_SECRET を sessionStorage に保持し、
 * 以降の API リクエスト (publish / upload-image) に X-Admin-Secret ヘッダーで付与する。
 *
 * フォールバック: /api/auth が 503 を返した場合（環境変数未設定）は
 * ソースコード内のパスワードで照合（移行期間・ローカル開発用）。
 */

const SESSION_KEY   = 'tbt_admin_auth'
const SECRET_KEY    = 'tbt_admin_secret'

// フォールバック用（環境変数未設定時のみ使用・移行期間対応）
function fallbackCheckCredentials(id, pass) {
  return id.trim() === 's.ogita@321.inc' && pass === '321inc0926'
}

export function isAuthenticated() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === SESSION_KEY + '_ok'
  } catch {
    return false
  }
}

/** ログイン成功時に /api/auth から受け取った secret を取得 */
export function getAdminSecret() {
  try { return sessionStorage.getItem(SECRET_KEY) || '' } catch { return '' }
}

export function setAuthenticated(secret = '') {
  sessionStorage.setItem(SESSION_KEY, SESSION_KEY + '_ok')
  sessionStorage.setItem(SECRET_KEY, secret)
}

export function clearAuthentication() {
  sessionStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SECRET_KEY)
}

/**
 * 管理画面のルートコンテナにログインガードを適用する
 * 認証済みの場合は onSuccess() を即時コール
 * 未認証の場合はログインフォームを表示する
 */
export function requireAuth(container, onSuccess) {
  if (isAuthenticated()) {
    onSuccess()
    return
  }

  container.innerHTML = `
    <div class="auth-overlay">
      <div class="auth-card">
        <div class="auth-logo">🔒</div>
        <h1 class="auth-title">管理画面ログイン</h1>
        <p class="auth-subtitle">TikTokバトルトーナメント 管理者専用</p>

        <form id="auth-form" class="auth-form">
          <div class="form-group">
            <label class="form-label required">管理者ID（メールアドレス）</label>
            <input class="form-input" id="auth-id" type="email"
                   placeholder="管理者IDを入力" autocomplete="username" required />
          </div>
          <div class="form-group">
            <label class="form-label required">パスワード</label>
            <div style="position:relative">
              <input class="form-input" id="auth-pass" type="password"
                     placeholder="パスワードを入力" autocomplete="current-password" required
                     style="padding-right:44px" />
              <button type="button" id="toggle-pass"
                      style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--color-text-muted)"
                      title="パスワードを表示">👁</button>
            </div>
          </div>

          <div id="auth-error" class="auth-error" style="display:none">
            IDまたはパスワードが正しくありません
          </div>

          <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px">
            ログイン
          </button>
        </form>

        <p class="auth-note">
          ※ このページは管理者専用です。<br>
          大会の閲覧は<a href="/viewer.html" class="auth-viewer-link">こちら</a>から
        </p>
      </div>
    </div>
  `

  const form      = container.querySelector('#auth-form')
  const idInput   = container.querySelector('#auth-id')
  const passInput = container.querySelector('#auth-pass')
  const errorEl   = container.querySelector('#auth-error')
  const toggleBtn = container.querySelector('#toggle-pass')

  idInput.focus()

  toggleBtn.addEventListener('click', () => {
    if (passInput.type === 'password') {
      passInput.type = 'text'
      toggleBtn.textContent = '🙈'
    } else {
      passInput.type = 'password'
      toggleBtn.textContent = '👁'
    }
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const id   = idInput.value
    const pass = passInput.value
    const submitBtn = form.querySelector('[type=submit]')

    submitBtn.disabled = true
    submitBtn.textContent = '認証中...'
    errorEl.style.display = 'none'

    try {
      // サーバー側認証（/api/auth）を試みる
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, pass })
      })
      const data = await res.json().catch(() => ({}))

      if (res.status === 503) {
        // 環境変数未設定（移行期間）→ フォールバック認証
        if (fallbackCheckCredentials(id, pass)) {
          setAuthenticated('')
          container.innerHTML = ''
          onSuccess()
          return
        }
        errorEl.textContent = 'IDまたはパスワードが正しくありません'
        errorEl.style.display = ''
        passInput.value = ''
        passInput.focus()
        submitBtn.disabled = true
        setTimeout(() => { submitBtn.disabled = false; submitBtn.textContent = 'ログイン' }, 2000)
        return
      }

      if (res.ok && data.ok) {
        setAuthenticated(data.secret || '')
        container.innerHTML = ''
        onSuccess()
        return
      }

      // 認証失敗
      errorEl.textContent = 'IDまたはパスワードが正しくありません'
      errorEl.style.display = ''
      passInput.value = ''
      passInput.focus()
      submitBtn.disabled = true
      setTimeout(() => { submitBtn.disabled = false; submitBtn.textContent = 'ログイン' }, 2000)

    } catch {
      // ネットワークエラー → フォールバック認証
      if (fallbackCheckCredentials(id, pass)) {
        setAuthenticated('')
        container.innerHTML = ''
        onSuccess()
        return
      }
      errorEl.textContent = 'IDまたはパスワードが正しくありません'
      errorEl.style.display = ''
      passInput.value = ''
      passInput.focus()
      submitBtn.disabled = true
      setTimeout(() => { submitBtn.disabled = false; submitBtn.textContent = 'ログイン' }, 2000)
    }
  })
}
