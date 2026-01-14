'use client'

import { useState, useEffect } from 'react'
import GachaCore from '@/components/GachaCore'
import WordEmitter from '@/components/WordEmitter'
import { loadDepthState, saveDepthState, calculateDepth, shouldTriggerBPattern } from '@/lib/depth'

type Phase = 'idle' | 'pressing' | 'released' | 'wordAppearing' | 'brokenOnAppear' | 'wordVisible' | 'readingDetected' | 'wordDegrading' | 'symbolized' | 'resetToCircle'

const THRESHOLD = 1500 // 1500ms
const MAX_HESITATION = 5000 // 5000ms

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [pressStart, setPressStart] = useState<number | null>(null)
  const [hesitationTime, setHesitationTime] = useState<number>(0)
  const [depth, setDepth] = useState<number>(0)
  const [pullCount, setPullCount] = useState<number>(0)
  const [isBPattern, setIsBPattern] = useState<boolean>(false)

  // 初期化時に深度状態を読み込む
  useEffect(() => {
    const state = loadDepthState()
    setPullCount(state.pullCount)
    setDepth(state.depth)
  }, [])

  const handlePointerDown = () => {
    setPressStart(Date.now())
    setPhase('pressing')
    
    // バイブレーション開始（スマートフォンの場合）
    if ('vibrate' in navigator) {
      // 長押し中は継続的に弱い振動（パターン: 振動10ms、休止20msを繰り返し）
      navigator.vibrate([10, 20, 10, 20, 10, 20, 10, 20, 10, 20, 10, 20, 10, 20, 10, 20, 10, 20, 10, 20])
    }
  }

  const handlePointerUp = () => {
    if (pressStart === null) return

    // バイブレーション停止
    if ('vibrate' in navigator) {
      navigator.vibrate(0)
    }

    const duration = Date.now() - pressStart
    const calculatedHesitation = clamp(duration - THRESHOLD, 0, MAX_HESITATION)
    
    // pullCountを増やす
    const newPullCount = pullCount + 1
    setPullCount(newPullCount)
    
    // 深度を再計算
    const newDepth = calculateDepth(newPullCount, calculatedHesitation)
    setDepth(newDepth)
    
    // 深度状態を保存
    saveDepthState({ depth: newDepth, pullCount: newPullCount })
    
    // Bパターン発動判定
    const shouldB = shouldTriggerBPattern(newDepth)
    setIsBPattern(shouldB)
    
    setHesitationTime(calculatedHesitation)
    setPressStart(null)
    setPhase('released')
  }

  useEffect(() => {
    if (phase === 'released') {
      // Bパターンの場合はbrokenOnAppear、そうでなければwordAppearing
      const timer = setTimeout(() => {
        setPhase(isBPattern ? 'brokenOnAppear' : 'wordAppearing')
      }, 100)

      return () => clearTimeout(timer)
    }
    
    // pressingフェーズ中は継続的にバイブレーション
    if (phase === 'pressing' && 'vibrate' in navigator) {
      const vibrationInterval = setInterval(() => {
        // 弱い振動パターンを繰り返し
        navigator.vibrate([10, 20, 10, 20, 10, 20, 10, 20, 10, 20])
      }, 600) // 600msごとに繰り返し
      
      return () => {
        clearInterval(vibrationInterval)
        navigator.vibrate(0) // クリーンアップ時に停止
      }
    }
  }, [phase, isBPattern])

  const handleDecayComplete = () => {
    setPhase('idle')
    setHesitationTime(0)
    setIsBPattern(false)
  }

  const handleBrokenOnAppear = () => {
    // brokenOnAppearからsymbolizedに直接遷移
    setPhase('symbolized')
  }

  const handleReadingDetected = () => {
    setPhase('readingDetected')
  }

  const handleWordDegrading = () => {
    setPhase('wordDegrading')
  }

  const handleSymbolized = () => {
    setPhase('symbolized')
  }

  const handleResetToCircle = () => {
    setPhase('resetToCircle')
  }

  return (
    <main
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <GachaCore
        phase={phase}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      />
      <WordEmitter 
        phase={phase} 
        depth={depth}
        isBPattern={isBPattern}
        hesitationTime={hesitationTime}
        onDecayComplete={handleDecayComplete}
        onWordVisible={() => setPhase('wordVisible')}
        onBrokenOnAppear={handleBrokenOnAppear}
        onReadingDetected={handleReadingDetected}
        onWordDegrading={handleWordDegrading}
        onSymbolized={handleSymbolized}
        onResetToCircle={handleResetToCircle}
      />
    </main>
  )
}

