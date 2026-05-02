'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Shield } from 'lucide-react'

export default function DocentStart() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
    } else if (profile?.role === 'teacher') {
      router.replace('/teacher/dashboard')
    } else {
      router.replace('/login')
    }
  }, [user, profile, loading, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-emerald-50">
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <p className="text-emerald-700 font-medium">PV Trainer — Docent</p>
        <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mt-4" />
      </div>
    </div>
  )
}
