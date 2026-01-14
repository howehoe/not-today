'use client'

import { motion } from 'framer-motion'
import { useState, useMemo } from 'react'

type Phase = 'idle' | 'pressing' | 'released' | 'wordAppearing' | 'brokenOnAppear' | 'wordVisible' | 'readingDetected' | 'wordDegrading' | 'symbolized' | 'resetToCircle'

interface GachaCoreProps {
  phase: Phase
  onPointerDown: () => void
  onPointerUp: () => void
}

// ランダムな円のパスを生成（わずかに歪ませる）
function generateCirclePath(
  centerX: number,
  centerY: number,
  radius: number,
  variance: number = 0.02,
  seed: number = 0
): string {
  // シードベースの擬似乱数生成（再現可能にする）
  let seedValue = seed
  const random = () => {
    seedValue = (seedValue * 9301 + 49297) % 233280
    return seedValue / 233280
  }

  const segments = 64
  const pathCommands: string[] = []

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    const randomOffset = (random() - 0.5) * variance
    const r = radius * (1 + randomOffset)
    const x = centerX + Math.cos(angle) * r
    const y = centerY + Math.sin(angle) * r

    if (i === 0) {
      pathCommands.push(`M ${x.toFixed(2)} ${y.toFixed(2)}`)
    } else {
      pathCommands.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`)
    }
  }

  pathCommands.push('Z')
  return pathCommands.join(' ')
}

export default function GachaCore({ phase, onPointerDown, onPointerUp }: GachaCoreProps) {
  const [isPressed, setIsPressed] = useState(false)

  // 3〜7本の線をランダムに生成（初回マウント時のみ）
  const lines = useMemo(() => {
    const randomSeed = Math.random() * 10000
    let seedValue = randomSeed
    const random = () => {
      seedValue = (seedValue * 9301 + 49297) % 233280
      return seedValue / 233280
    }

    const count = Math.floor(random() * 5) + 3 // 3〜7本
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      radius: 0.35 + (i / count) * 0.3, // 0.35〜0.65の範囲で均等に分布
      rotateOffset: random() * 360, // 初期回転オフセット
      scaleVariance: 0.995 + random() * 0.01, // 0.995〜1.005
      duration: 5 + random() * 2, // 5〜7秒
      delay: random() * 0.5, // 0〜0.5秒の遅延
      strokeWidth: 1 + random() * 0.5, // 1px〜1.5px
      pathSeed: random() * 10000, // パス生成用のシード
    }))
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    setIsPressed(true)
    onPointerDown()
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault()
    setIsPressed(false)
    onPointerUp()
  }

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (isPressed) {
      e.preventDefault()
      setIsPressed(false)
      onPointerUp()
    }
  }

  const isVisible = phase === 'idle' || phase === 'pressing'
  
  // 呼吸アニメーションの状態を決定
  const shouldBreathe = phase === 'idle' || phase === 'pressing'
  const isBreathingFast = phase === 'pressing' // 長押し時は浅く・早く

  // サイズをvw/vhベースで計算（画面サイズに依存）
  const size = 'clamp(30vh, 35vw, 40vh)'

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.6s easeOut',
        zIndex: 2, // 線の上、テキストの下
      }}
    >
      {/* 揺れる線（背景レイヤー） */}
      <svg
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          zIndex: 1,
          pointerEvents: 'none',
        }}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
      >
        {lines.map((line) => {
          const centerX = 50
          const centerY = 50
          const radius = line.radius * 50 // viewBox座標に変換
          const path = generateCirclePath(centerX, centerY, radius, 0.015, line.pathSeed)

          return (
            <motion.path
              key={line.id}
              d={path}
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth={line.strokeWidth}
              fill="none"
              transformOrigin="50 50"
              initial={{
                rotate: line.rotateOffset,
                scale: line.scaleVariance,
              }}
              animate={{
                rotate: [
                  line.rotateOffset,
                  line.rotateOffset + 1.5,
                  line.rotateOffset - 1,
                  line.rotateOffset,
                ],
                scale: [
                  line.scaleVariance,
                  line.scaleVariance * 1.01,
                  line.scaleVariance * 0.995,
                  line.scaleVariance,
                ],
              }}
              transition={{
                duration: line.duration,
                ease: 'easeInOut',
                repeat: Infinity,
                delay: line.delay,
              }}
            />
          )
        })}
      </svg>

      {/* すりガラス円 */}
      <motion.div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(8px) saturate(110%)',
          WebkitBackdropFilter: 'blur(8px) saturate(110%)',
          cursor: 'pointer',
          position: 'relative',
          touchAction: 'none',
          WebkitTapHighlightColor: 'transparent',
          zIndex: 2,
        }}
        initial={{ scale: 1 }}
        animate={
          shouldBreathe
            ? {
                scale: isPressed 
                  ? [1, 1.12, 1.15] // 長押し時は浅い呼吸
                  : [1, 1.02, 0.98, 1], // 通常時はゆっくりとした呼吸
                opacity: isPressed
                  ? [1, 0.92, 0.88] // 長押し時は濁りが強く
                  : [1, 0.96, 0.94, 1], // 通常時は軽い濁り
                backgroundColor: isPressed
                  ? [
                      'rgba(255, 255, 255, 0.05)',
                      'rgba(255, 255, 255, 0.04)',
                      'rgba(255, 255, 255, 0.035)',
                    ]
                  : [
                      'rgba(255, 255, 255, 0.05)',
                      'rgba(255, 255, 255, 0.045)',
                      'rgba(255, 255, 255, 0.04)',
                      'rgba(255, 255, 255, 0.05)',
                    ],
              }
            : {
                scale: isPressed ? 1.15 : 1,
                opacity: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              }
        }
        transition={
          shouldBreathe
            ? {
                duration: isBreathingFast ? 1.2 : 4, // 長押し時は早く、通常時はゆっくり
                ease: 'easeInOut',
                repeat: Infinity,
                repeatType: 'reverse',
              }
            : {
                duration: 0.6,
                ease: 'easeOut',
              }
        }
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerUp}
        whileTap={
          shouldBreathe
            ? undefined // 呼吸中はwhileTapを無効化
            : {
                scale: 1.15,
              }
        }
      />
    </div>
  )
}
