'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function HomePage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
    } else if (!profile) {
      // Authenticated in Firebase but no Firestore profile — send to login
      // (login page will show the "geen account" error if they try again)
      router.replace('/login')
    } else if (profile.role === 'teacher') {
      router.replace('/teacher/dashboard')
    } else {
      router.replace('/student/dashboard')
    }
  }, [user, profile, loading, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Laden...</p>
      </div>
    </div>
  )
}
