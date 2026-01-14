// 深度管理ユーティリティ（localStorageで永続化）

const STORAGE_KEY = 'not_today_depth'
const PULL_COUNT_KEY = 'not_today_pull_count'

export interface DepthState {
  depth: number // 0, 1, 2, 3
  pullCount: number
}

// 深度状態を読み込む
export function loadDepthState(): DepthState {
  if (typeof window === 'undefined') {
    return { depth: 0, pullCount: 0 }
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const pullCountStored = localStorage.getItem(PULL_COUNT_KEY)
    
    if (stored && pullCountStored) {
      return {
        depth: parseInt(stored, 10),
        pullCount: parseInt(pullCountStored, 10),
      }
    }
  } catch (e) {
    // localStorageが使えない場合は無視
  }

  return { depth: 0, pullCount: 0 }
}

// 深度状態を保存
export function saveDepthState(state: DepthState): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, state.depth.toString())
    localStorage.setItem(PULL_COUNT_KEY, state.pullCount.toString())
  } catch (e) {
    // localStorageが使えない場合は無視
  }
}

// 深度を計算（pullCountとhesitationTimeから）
export function calculateDepth(pullCount: number, hesitationTime: number): number {
  let depth = 0

  // pullCountベースの深度
  if (pullCount < 5) {
    depth = 0
  } else if (pullCount < 12) {
    depth = 1
  } else if (pullCount < 20) {
    depth = 2
  } else {
    depth = 3
  }

  // hesitationTimeが4.5秒以上なら深度+1（加速装置）
  if (hesitationTime > 4500) {
    depth += 1
  }

  // 最大3に制限
  return Math.min(depth, 3)
}

// Bパターン発動確率を計算
export function getBPatternProbability(depth: number): number {
  if (depth < 2) return 0
  
  if (depth === 2) return 0.25
  if (depth === 3) return 0.6
  
  return 0
}

// Bパターンが発動するか判定
export function shouldTriggerBPattern(depth: number): boolean {
  if (depth < 2) return false
  
  const probability = getBPatternProbability(depth)
  return Math.random() < probability
}

