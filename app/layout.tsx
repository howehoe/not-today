import type { Metadata } from 'next'
import { Recursive } from 'next/font/google'
import './globals.css'

const recursive = Recursive({
  subsets: ['latin'],
  variable: '--font-recursive',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Not Today',
  description: 'An interactive art piece',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={recursive.variable}>
      <body>{children}</body>
    </html>
  )
}

