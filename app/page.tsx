'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { PageSpinner } from '@/app/components/ui/Spinner'

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

  return <PageSpinner />
}
