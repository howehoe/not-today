'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState, useRef, useMemo } from 'react'
import { words } from '@/lib/words'

type Phase = 'idle' | 'pressing' | 'released' | 'wordAppearing' | 'brokenOnAppear' | 'wordVisible' | 'readingDetected' | 'wordDegrading' | 'symbolized' | 'resetToCircle'

interface WordEmitterProps {
  phase: Phase
  depth: number
  isBPattern: boolean
  hesitationTime: number
  onDecayComplete: () => void
  onWordVisible: () => void
  onBrokenOnAppear?: () => void
  onReadingDetected?: () => void
  onWordDegrading?: () => void
  onSymbolized?: () => void
  onResetToCircle?: () => void
}

const SYMBOLS = ['·', '-', '_', '/', '|', '#', '%', '@', '*']

// Bパターン用：最初から一部を記号に変換
function applyBPatternInitial(word: string, depth: number, seed: number): string[] {
  const symbolRate = depth === 2 ? 0.3 : 0.5
  const chars = word.split('')
  
  // シードベースの擬似乱数
  let seedValue = seed
  const random = () => {
    seedValue = (seedValue * 9301 + 49297) % 233280
    return seedValue / 233280
  }
  
  return chars.map((char, i) => {
    if (char === ' ') return ' '
    if (random() < symbolRate) {
      return SYMBOLS[Math.floor(random() * SYMBOLS.length)]
    }
    return char
  })
}

// 文字を記号に変換（徐々に、再現可能にするためシード使用）
function toSymbol(
  char: string, 
  progress: number, 
  index: number, 
  totalLength: number,
  tailLength: number,
  seed: number
): string {
  // スペースはそのまま
  if (char === ' ') return ' '
  
  // 後ろのtailLength文字は最後まで残す（depth 3では1文字になることもある）
  const isTail = index >= totalLength - tailLength
  
  if (isTail && progress < 0.95) {
    return char
  }
  
  // シードベースの擬似乱数（再現可能にする）
  const seedValue = seed + index
  const random = () => {
    return ((seedValue * 9301 + 49297) % 233280) / 233280
  }
  
  // 進捗に応じて変換確率を上げる（前から順に変換）
  const positionFactor = index / totalLength
  const conversionChance = progress * (0.7 + positionFactor * 0.3)
  
  if (random() < conversionChance) {
    const symbolIndex = Math.floor(random() * SYMBOLS.length)
    return SYMBOLS[symbolIndex]
  }
  
  return char
}

export default function WordEmitter({ 
  phase, 
  depth,
  isBPattern,
  hesitationTime,
  onDecayComplete, 
  onWordVisible,
  onBrokenOnAppear,
  onReadingDetected,
  onWordDegrading,
  onSymbolized,
  onResetToCircle,
}: WordEmitterProps) {
  const [word, setWord] = useState<string | null>(null)
  const [wordVisibleTime, setWordVisibleTime] = useState<number | null>(null)
  const [degradingProgress, setDegradingProgress] = useState(0)
  const [symbolizingProgress, setSymbolizingProgress] = useState(0)
  const [tailLength, setTailLength] = useState(0)
  const degradationStartTime = useRef<number | null>(null)
  const symbolizingStartTime = useRef<number | null>(null)
  const positionSeedRef = useRef<number>(0)

  // depthに応じたtailLengthを計算（depth 3では1文字になることもある）
  const calculateTailLength = (depth: number): number => {
    if (depth === 3) {
      return Math.random() < 0.5 ? 1 : Math.floor(Math.random() * 3) + 1
    }
    return Math.floor(Math.random() * 5) + 1
  }

  // 左右上下のバリエーションを持つ位置パターン（シードベースで再現可能に）
  const getRandomPosition = (seed: number): { 
    top: string
    left: string
    transform: string
    initialX?: number
    initialY?: number
    animationType?: 'slide' | 'fade'
  } => {
    const positions = [
      // 固定位置パターン
      { top: '35%', left: '30%', transform: 'translate(-50%, -50%)', animationType: 'fade' as const }, // 左上
      { top: '35%', left: '50%', transform: 'translate(-50%, -50%)', animationType: 'fade' as const }, // 上中央
      { top: '35%', left: '70%', transform: 'translate(-50%, -50%)', animationType: 'fade' as const }, // 右上
      { top: '50%', left: '25%', transform: 'translate(-50%, -50%)', animationType: 'fade' as const }, // 左中央
      { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', animationType: 'fade' as const }, // 中央
      { top: '50%', left: '75%', transform: 'translate(-50%, -50%)', animationType: 'fade' as const }, // 右中央
      { top: '65%', left: '30%', transform: 'translate(-50%, -50%)', animationType: 'fade' as const }, // 左下
      { top: '65%', left: '50%', transform: 'translate(-50%, -50%)', animationType: 'fade' as const }, // 下中央
      { top: '65%', left: '70%', transform: 'translate(-50%, -50%)', animationType: 'fade' as const }, // 右下
      
      // 左側からスライドイン
      { top: '40%', left: '50%', transform: 'translate(-50%, -50%)', initialX: -200, animationType: 'slide' as const }, // 左から中央
      { top: '50%', left: '30%', transform: 'translate(-50%, -50%)', initialX: -200, animationType: 'slide' as const }, // 左から左側
      { top: '60%', left: '50%', transform: 'translate(-50%, -50%)', initialX: -200, animationType: 'slide' as const }, // 左から中央下
      
      // 右側からスライドイン
      { top: '40%', left: '50%', transform: 'translate(-50%, -50%)', initialX: 200, animationType: 'slide' as const }, // 右から中央
      { top: '50%', left: '70%', transform: 'translate(-50%, -50%)', initialX: 200, animationType: 'slide' as const }, // 右から右側
      { top: '60%', left: '50%', transform: 'translate(-50%, -50%)', initialX: 200, animationType: 'slide' as const }, // 右から中央下
      
      // 上から降りてくる
      { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', initialY: -200, animationType: 'slide' as const }, // 上から中央
      { top: '50%', left: '30%', transform: 'translate(-50%, -50%)', initialY: -200, animationType: 'slide' as const }, // 上から左
      { top: '50%', left: '70%', transform: 'translate(-50%, -50%)', initialY: -200, animationType: 'slide' as const }, // 上から右
      
      // 下から浮き上がる
      { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', initialY: 200, animationType: 'slide' as const }, // 下から中央
      { top: '50%', left: '30%', transform: 'translate(-50%, -50%)', initialY: 200, animationType: 'slide' as const }, // 下から左
      { top: '50%', left: '70%', transform: 'translate(-50%, -50%)', initialY: 200, animationType: 'slide' as const }, // 下から右
    ]
    // シードベースの擬似乱数
    const randomValue = ((seed * 9301 + 49297) % 233280) / 233280
    return positions[Math.floor(randomValue * positions.length)]
  }

  // wordが変わるたびに位置を再計算（wordとpositionSeedRefの両方に依存）
  const [position, setPosition] = useState<{ 
    top: string
    left: string
    transform: string
    initialX?: number
    initialY?: number
    animationType?: 'slide' | 'fade'
  }>({
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -55%)',
    animationType: 'fade',
  })

  // wordが変わるたびに位置を更新（毎回異なる位置になるように）
  useEffect(() => {
    if (word) {
      // 毎回新しいシードを生成して位置を決定
      const seed = Date.now() + word.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
      const newPosition = getRandomPosition(seed)
      setPosition(newPosition)
    }
  }, [word])

  // 文字を配列に分解
  const chars = useMemo(() => {
    if (!word) return []
    
    // Bパターンの場合は最初から一部を記号に変換
    if (isBPattern && phase === 'brokenOnAppear') {
      const seed = word.length * 1000 + depth * 100
      return applyBPatternInitial(word, depth, seed)
    }
    
    return word.split('')
  }, [word, isBPattern, phase, depth])

  // 記号変換された文字列を生成
  const symbolChars = useMemo(() => {
    if (!word || symbolizingProgress === 0) return chars
    const seed = word.length * 1000 + Math.floor(symbolizingProgress * 100)
    return chars.map((char, i) => toSymbol(char, symbolizingProgress, i, chars.length, tailLength, seed))
  }, [word, chars, symbolizingProgress, tailLength])

  // depthに応じたアニメーション速度を計算
  const getDegradingDuration = (depth: number): number => {
    if (depth === 0) return 3200
    if (depth === 1) return 2800
    if (depth === 2) return 2400
    return 2000 // depth 3
  }

  useEffect(() => {
    if (phase === 'released') {
      // すぐに単語を選択（wordAppearingに遷移する前に設定）
      const randomWord = words[Math.floor(Math.random() * words.length)]
      // 位置のシードを更新（毎回異なる位置になるように）
      positionSeedRef.current = Date.now()
      setWord(randomWord)
      setWordVisibleTime(null)
      setDegradingProgress(0)
      setSymbolizingProgress(0)
      setTailLength(calculateTailLength(depth))
      degradationStartTime.current = null
      symbolizingStartTime.current = null
    } else if (phase === 'wordAppearing') {
      // 単語が設定されていることを確認
      if (!word) {
        const randomWord = words[Math.floor(Math.random() * words.length)]
        positionSeedRef.current = Date.now()
        setWord(randomWord)
        setTailLength(calculateTailLength(depth))
      }
      
      // 出現アニメーション完了後にwordVisibleに遷移
      const timer = setTimeout(() => {
        setWordVisibleTime(Date.now())
        onWordVisible()
      }, 1400)

      return () => clearTimeout(timer)
    } else if (phase === 'brokenOnAppear') {
      // Bパターン：最初から壊れた状態で現れる
      if (!word) {
        const randomWord = words[Math.floor(Math.random() * words.length)]
        positionSeedRef.current = Date.now()
        setWord(randomWord)
        setTailLength(calculateTailLength(depth))
      }
      
      // 少し遅いフェードイン（delay: 0.4, duration: 1.6）
      const timer = setTimeout(() => {
        // brokenOnAppearから直接symbolizedに遷移
        onBrokenOnAppear?.()
      }, 2000) // delay + duration

      return () => clearTimeout(timer)
    } else if (phase === 'wordVisible') {
      // depthに応じて読む時間を調整（depthが高いほど短い）
      const readingTime = depth === 0 ? 800 : depth === 1 ? 700 : depth === 2 ? 600 : 500
      
      const timer = setTimeout(() => {
        onReadingDetected?.()
      }, readingTime)

      return () => clearTimeout(timer)
    } else if (phase === 'readingDetected') {
      // すぐにwordDegradingに遷移
      onWordDegrading?.()
    } else if (phase === 'wordDegrading') {
      if (!word) return

      // 壊れ始めのアニメーション（depthに応じて速度が変わる）
      if (!degradationStartTime.current) {
        degradationStartTime.current = Date.now()
      }

      const duration = getDegradingDuration(depth)

      const interval = setInterval(() => {
        const elapsed = Date.now() - (degradationStartTime.current || Date.now())
        const progress = Math.min(elapsed / duration, 1)

        setDegradingProgress(progress)

        if (progress >= 1) {
          clearInterval(interval)
          onSymbolized?.()
        }
      }, 50)

      return () => clearInterval(interval)
    } else if (phase === 'symbolized') {
      if (!word) return

      // 記号変換のアニメーション（depthに応じて速度が変わる）
      if (!symbolizingStartTime.current) {
        symbolizingStartTime.current = Date.now()
      }

      const duration = depth === 0 ? 2000 : depth === 1 ? 1800 : depth === 2 ? 1600 : 1400

      const interval = setInterval(() => {
        const elapsed = Date.now() - (symbolizingStartTime.current || Date.now())
        const progress = Math.min(elapsed / duration, 1)

        setSymbolizingProgress(progress)

        if (progress >= 1) {
          clearInterval(interval)
          // 最後の余韻を表示してからresetToCircleに遷移
          setTimeout(() => {
            onResetToCircle?.()
          }, 1000)
        }
      }, 50)

      return () => clearInterval(interval)
    } else if (phase === 'resetToCircle') {
      // リセット処理
      const timer = setTimeout(() => {
        setWord(null)
        setWordVisibleTime(null)
        setDegradingProgress(0)
        setSymbolizingProgress(0)
        degradationStartTime.current = null
        symbolizingStartTime.current = null
        onDecayComplete()
      }, 2000)

      return () => clearTimeout(timer)
    } else if (phase === 'idle') {
      // リセット
      setWord(null)
      setWordVisibleTime(null)
      setDegradingProgress(0)
      setSymbolizingProgress(0)
      degradationStartTime.current = null
      symbolizingStartTime.current = null
    }
  }, [phase, word, depth, isBPattern, onDecayComplete, onWordVisible, onBrokenOnAppear, onReadingDetected, onWordDegrading, onSymbolized, onResetToCircle])

  const isAppearing = phase === 'wordAppearing'
  const isBrokenOnAppear = phase === 'brokenOnAppear'
  const isVisible = phase === 'wordVisible'
  const isDegrading = phase === 'wordDegrading'
  const isSymbolized = phase === 'symbolized' || phase === 'resetToCircle'
  const shouldShow = isAppearing || isBrokenOnAppear || isVisible || isDegrading || isSymbolized

  // depthに応じた揺れの強さ
  const getShakeIntensity = (depth: number): number => {
    if (depth === 0) return 1
    if (depth === 1) return 1.5
    if (depth === 2) return 2
    return 2.5 // depth 3
  }

  const shakeIntensity = getShakeIntensity(depth)

  return (
    <AnimatePresence>
      {shouldShow && word && chars.length > 0 && (
        <motion.div
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            transform: position.transform,
            fontSize: 'clamp(20px, 5vw, 42px)',
            fontWeight: 400,
            letterSpacing: '0.04em',
            color: 'rgba(255, 255, 255, 0.85)',
            textAlign: 'center',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            padding: '0 20px',
            maxWidth: '90vw',
            overflow: 'hidden',
            zIndex: 3,
            fontFamily: 'var(--font-recursive), monospace',
          }}
          initial={
            isBrokenOnAppear
              ? {
                  opacity: 0.85,
                  filter: 'blur(2px)',
                  y: position.initialY ?? 6,
                  x: position.initialX ?? 0,
                  scale: 0.98,
                }
              : position.animationType === 'slide'
              ? {
                  opacity: 0,
                  filter: 'blur(6px)',
                  y: position.initialY ?? 0,
                  x: position.initialX ?? 0,
                  scale: 0.98,
                }
              : {
                  opacity: 0,
                  filter: 'blur(6px)',
                  y: 6,
                  x: 0,
                  scale: 0.98,
                }
          }
          animate={
            isAppearing
              ? position.animationType === 'slide'
              ? {
                  opacity: [0, 0.6, 1],
                  filter: ['blur(8px)', 'blur(2px)', 'blur(0px)'],
                  y: position.initialY !== undefined 
                    ? [position.initialY, position.initialY * 0.3, 0]
                    : [6, 2, 0],
                  x: position.initialX !== undefined 
                    ? [position.initialX, position.initialX * 0.3, 0]
                    : [0, 0, 0],
                  scale: [0.98, 0.99, 1],
                }
              : {
                  opacity: [0, 0.6, 1],
                  filter: ['blur(8px)', 'blur(2px)', 'blur(0px)'],
                  y: [6, 2, 0],
                  scale: [0.98, 0.99, 1],
                }
              : isBrokenOnAppear
              ? {
                  filter: ['blur(2px)', 'blur(3.5px)'],
                  opacity: [0.85, 0.8],
                  x: [0, -0.5 * shakeIntensity, 0.5 * shakeIntensity, 0],
                }
              : isDegrading
              ? {
                  filter: ['blur(0px)', 'blur(1.5px)', 'blur(3px)'],
                  opacity: [1, 0.95, 0.9],
                  x: [0, -1 * shakeIntensity, 1 * shakeIntensity, 0],
                }
              : isSymbolized
              ? {
                  opacity: [0.9, 0.7],
                  filter: ['blur(2px)', 'blur(4px)'],
                }
              : {
                  opacity: 1,
                  filter: 'blur(0px)',
                  y: 0,
                  scale: 1,
                }
          }
          exit={{ opacity: 0 }}
          transition={
            isAppearing
              ? {
                  duration: 1.4,
                  ease: [0.22, 1, 0.36, 1],
                  times: [0, 0.4, 1],
                }
              : isBrokenOnAppear
              ? {
                  delay: 0.4,
                  duration: 1.6,
                  ease: [0.22, 1, 0.36, 1],
                }
              : isDegrading
              ? {
                  duration: getDegradingDuration(depth),
                  ease: 'linear',
                }
              : isSymbolized
              ? {
                  duration: depth === 0 ? 2 : depth === 1 ? 1.8 : depth === 2 ? 1.6 : 1.4,
                  ease: 'linear',
                }
              : {
                  duration: 0.3,
                  ease: 'easeOut',
                }
          }
        >
          {/* 文字単位で分解 */}
          {isSymbolized || isBrokenOnAppear ? (
            // 記号変換フェーズ or Bパターン
            (isBrokenOnAppear ? chars : symbolChars).map((char, i) => {
              const isTail = i >= chars.length - tailLength
              const isLastFewTail = i >= chars.length - Math.min(3, tailLength)
              const shouldShowShadow = isLastFewTail && symbolizingProgress > 0.85
              
              // Bパターン：各文字のopacityが異なる
              const charOpacity = isBrokenOnAppear 
                ? 0.7 + (Math.sin(i * 0.5) * 0.15)
                : shouldShowShadow ? 0.7 : 0.9
              
              return (
                <motion.span
                  key={i}
                  style={{
                    display: 'inline-block',
                    color: shouldShowShadow
                      ? 'transparent'
                      : 'rgba(255, 255, 255, 0.85)',
                    textShadow: shouldShowShadow
                      ? '0 0 8px rgba(255,255,255,0.3)'
                      : 'none',
                    opacity: isBrokenOnAppear ? charOpacity : undefined,
                  }}
                  animate={
                    isBrokenOnAppear
                      ? {
                          opacity: [charOpacity, charOpacity * 0.9],
                          filter: ['blur(2px)', 'blur(3.5px)'],
                          x: [0, (Math.random() - 0.5) * shakeIntensity],
                          letterSpacing: ['0.04em', `${0.04 + Math.random() * 0.02}em`],
                        }
                      : {
                          opacity: shouldShowShadow
                            ? [0.7, 0.2]
                            : [0.9, 0.7],
                          filter: ['blur(2px)', 'blur(4px)'],
                          x: [0, (Math.random() - 0.5) * 2],
                        }
                  }
                  transition={{
                    duration: isBrokenOnAppear ? 1.6 : 2,
                    ease: 'linear',
                    delay: i * 0.03,
                  }}
                >
                  {isTail && symbolizingProgress < 0.95 && !isBrokenOnAppear ? chars[i] : char}
                </motion.span>
              )
            })
          ) : (
            // 通常表示・壊れ始めフェーズ
            chars.map((char, i) => (
              <motion.span
                key={i}
                style={{
                  display: 'inline-block',
                }}
                animate={
                  isDegrading
                    ? {
                        opacity: [1, 0.95, 0.9],
                        filter: ['blur(0px)', 'blur(1.5px)', 'blur(3px)'],
                        x: [0, (Math.random() - 0.5) * 2 * shakeIntensity, (Math.random() - 0.5) * 2 * shakeIntensity, 0],
                      }
                    : {}
                }
                transition={
                  isDegrading
                    ? {
                        duration: getDegradingDuration(depth),
                        ease: 'linear',
                        delay: i * 0.03,
                      }
                    : {}
                }
              >
                {char}
              </motion.span>
            ))
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
