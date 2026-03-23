// アプリ状態をJSONファイルとしてダウンロード
export function exportToJson(state) {
  const json = JSON.stringify(state, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  a.href = url
  a.download = `tbt_backup_${dateStr}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// JSONファイルからアプリ状態をインポート
export function importFromJson() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return reject(new Error('ファイルが選択されていません'))
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result)
          resolve(parsed)
        } catch (err) {
          reject(new Error('JSONの解析に失敗しました'))
        }
      }
      reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'))
      reader.readAsText(file)
    }
    input.click()
  })
}

// UUIDv4を生成（crypto.randomUUID対応ブラウザのみ）
export function generateId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}
