'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

function LandingPageContent() {
  const searchParams = useSearchParams()
  const lpId = searchParams.get('id')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!lpId) {
      setError('랜딩 페이지 ID가 필요합니다.')
    }
  }, [lpId])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">페이지를 찾을 수 없습니다</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  if (!lpId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-gray-400">로딩 중...</p>
        </div>
      </div>
    )
  }

  // 모든 쿼리 파라미터를 iframe에 전달
  const allParams = searchParams.toString()

  return (
    <iframe
      src={`/api/lp/render?${allParams}`}
      className="w-full h-screen border-0"
      title="Landing Page"
    />
  )
}

export default function LandingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    }>
      <LandingPageContent />
    </Suspense>
  )
}
