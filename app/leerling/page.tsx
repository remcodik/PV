'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { GraduationCap } from 'lucide-react'

export default function LeerlingStart() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
    } else if (profile?.role === 'student') {
      router.replace('/student/dashboard')
    } else {
      router.replace('/login')
    }
  }, [user, profile, loading, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
          <GraduationCap className="w-8 h-8 text-white" />
        </div>
        <p className="text-blue-700 font-medium">PV Trainer — Student</p>
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mt-4" />
      </div>
    </div>
  )
}
