'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Case, CrimeType, CooperationLevel, COOPERATION_LABELS, COOPERATION_DESCRIPTIONS, KeyDiscovery } from '@/lib/types'
import { Shield, ArrowLeft, Save, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'

const CRIME_TYPES: { value: CrimeType; label: string; article: string }[] = [
  { value: 'vernieling', label: 'Vernieling', article: 'Art. 350 Sr' },
  { value: 'heling', label: 'Heling', article: 'Art. 416 Sr' },
  { value: 'diefstal', label: 'Diefstal', article: 'Art. 310 Sr' },
  { value: 'mishandeling', label: 'Mishandeling', article: 'Art. 300 Sr' },
  { value: 'inbraak', label: 'Inbraak', article: 'Art. 311 Sr' },
  { value: 'overig', label: 'Overig', article: '' },
]

export default function EditCasePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'cases', id)).then(snap => {
      if (snap.exists()) setCaseData({ id: snap.id, ...snap.data() } as Case)
    })
  }, [id])

  const setField = (key: string, value: unknown) => {
    setCaseData(prev => prev ? { ...prev, [key]: value } : prev)
  }

  const setKnows = (i: number, val: string) => {
    if (!caseData) return
    const arr = [...caseData.witnessKnows]
    arr[i] = val
    setField('witnessKnows', arr)
  }

  const setDiscovery = (i: number, field: keyof KeyDiscovery, val: string) => {
    if (!caseData) return
    const arr = [...(caseData.keyDiscoveries || [])]
    arr[i] = { ...arr[i], [field]: val }
    setField('keyDiscoveries', arr)
  }

  const addDiscovery = () => {
    if (!caseData) return
    setField('keyDiscoveries', [...(caseData.keyDiscoveries || []), { description: '', witnessHint: '' }])
  }

  const removeDiscovery = (i: number) => {
    if (!caseData) return
    const arr = [...(caseData.keyDiscoveries || [])]
    arr.splice(i, 1)
    setField('keyDiscoveries', arr)
  }

  const handleSave = async () => {
    if (!caseData) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'cases', id), {
        ...caseData,
        updatedAt: new Date().toISOString(),
        witnessKnows: caseData.witnessKnows.filter(k => k.trim()),
        keyDiscoveries: (caseData.keyDiscoveries || []).filter(kd => kd.description.trim()),
      })
      router.push('/teacher/cases')
    } finally {
      setSaving(false)
    }
  }

  if (!caseData) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Laden...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/teacher/cases" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-semibold text-gray-900">Case bewerken</h1>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Basisinformatie</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titel</label>
            <input type="text" value={caseData.title} onChange={e => setField('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delictstype</label>
              <select value={caseData.crimeType} onChange={e => setField('crimeType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CRIME_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wetsartikel</label>
              <input type="text" value={caseData.legalArticle} onChange={e => setField('legalArticle', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Korte omschrijving</label>
            <input type="text" value={caseData.description} onChange={e => setField('description', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Achtergrondinformatie</label>
            <textarea value={caseData.backgroundStory} onChange={e => setField('backgroundStory', e.target.value)} rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Getuige</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Naam</label>
              <input type="text" value={caseData.witnessName} onChange={e => setField('witnessName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Leeftijd</label>
              <input type="number" value={caseData.witnessAge} onChange={e => setField('witnessAge', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Profiel</label>
            <textarea value={caseData.witnessProfile} onChange={e => setField('witnessProfile', e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Meewerkingsniveau</label>
            <div className="space-y-2">
              {([1,2,3,4,5] as CooperationLevel[]).map(l => (
                <label key={l} className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="coop" value={l}
                    checked={caseData.cooperationLevel === l}
                    onChange={() => setField('cooperationLevel', l)}
                    className="mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-gray-900">{l} — {COOPERATION_LABELS[l]}</span>
                    <p className="text-xs text-gray-500">{COOPERATION_DESCRIPTIONS[l]}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h3 className="font-semibold text-gray-900">Wat weet de getuige?</h3>
          {caseData.witnessKnows.map((k, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-sm text-gray-400 w-5">{i+1}.</span>
              <input type="text" value={k} onChange={e => setKnows(i, e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`Feit ${i+1}...`} />
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-amber-200 p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900">Sleutelpunten voor de student</h3>
            <p className="text-sm text-gray-500 mt-1">
              Definieer wat de student moet achterhalen via doorvragen. De getuige geeft hints; de student wordt beoordeeld op of hij deze punten heeft opgespoord en verwerkt in het PV.
            </p>
          </div>
          {(caseData.keyDiscoveries || []).map((kd, i) => (
            <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Sleutelpunt {i + 1}</span>
                <button onClick={() => removeDiscovery(i)} className="text-amber-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Wat moet de student achterhalen?</label>
                <input
                  type="text"
                  value={kd.description}
                  onChange={e => setDiscovery(i, 'description', e.target.value)}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Bijv. De verdachte had een tatoeage op zijn linkerarm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hoe hint de getuige hier naar? (alleen zichtbaar voor de AI)</label>
                <input
                  type="text"
                  value={kd.witnessHint}
                  onChange={e => setDiscovery(i, 'witnessHint', e.target.value)}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Bijv. Noem terloops iets over een opvallend kenmerk als uiterlijk ter sprake komt"
                />
              </div>
            </div>
          ))}
          <button
            onClick={addDiscovery}
            className="flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-900 px-3 py-2 border border-dashed border-amber-300 rounded-lg w-full justify-center hover:bg-amber-50"
          >
            <Plus className="w-4 h-4" />
            Sleutelpunt toevoegen
          </button>
        </div>
      </div>
    </div>
  )
}
