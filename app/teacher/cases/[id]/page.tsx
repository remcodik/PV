'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Case, CrimeType, CooperationLevel, IntervieweeType, COOPERATION_LABELS, COOPERATION_DESCRIPTIONS, SUSPECT_COOPERATION_LABELS, SUSPECT_COOPERATION_DESCRIPTIONS, KeyDiscovery } from '@/lib/types'
import { Shield, ArrowLeft, Save, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/app/components/ui/Card'
import { Button } from '@/app/components/ui/Button'
import { inputClass, labelClass } from '@/app/components/ui/form'
import { PageSpinner } from '@/app/components/ui/Spinner'

const CRIME_TYPES: { value: CrimeType; label: string; article: string }[] = [
  { value: 'diefstal', label: 'Diefstal', article: 'Art. 310 Sr' },
  { value: 'inbraak', label: 'Inbraak (gekwal. diefstal)', article: 'Art. 311 Sr' },
  { value: 'straatroof', label: 'Straatroof / Beroving', article: 'Art. 312 Sr' },
  { value: 'mishandeling', label: 'Mishandeling', article: 'Art. 300 Sr' },
  { value: 'huiselijk_geweld', label: 'Huiselijk geweld', article: 'Art. 304 Sr' },
  { value: 'bedreiging', label: 'Bedreiging', article: 'Art. 285 Sr' },
  { value: 'stalking', label: 'Stalking / Belaging', article: 'Art. 285b Sr' },
  { value: 'aanranding', label: 'Aanranding / Lastigvallen', article: 'Art. 246 Sr' },
  { value: 'vernieling', label: 'Vernieling', article: 'Art. 350 Sr' },
  { value: 'heling', label: 'Heling', article: 'Art. 416 Sr' },
  { value: 'oplichting', label: 'Oplichting / Fraude', article: 'Art. 326 Sr' },
  { value: 'rijden_onder_invloed', label: 'Rijden onder invloed', article: 'Art. 8 WVW' },
  { value: 'drugs', label: 'Drugsdelict', article: 'Art. 2/3 Opiumwet' },
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
    return <PageSpinner />
  }

  const isSuspect = caseData.intervieweeType === 'verdachte'

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/teacher/cases" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-9 h-9 bg-ink-800 rounded-md flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-semibold text-gray-900">Case bewerken</h1>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? 'Opslaan...' : 'Opslaan'}
          </Button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">
        {/* Type interview */}
        <Card className="p-4">
          <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Type interview</p>
          <div className="flex rounded-md overflow-hidden border border-gray-200">
            <button onClick={() => setField('intervieweeType', 'getuige')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${!isSuspect ? 'bg-ink-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Getuigenverhoor
            </button>
            <button onClick={() => setField('intervieweeType', 'verdachte')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${isSuspect ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Verdachtenverhoor
            </button>
          </div>
        </Card>

        {/* Basisinformatie */}
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Basisinformatie</h3>
          <div>
            <label className={labelClass}>Titel</label>
            <input type="text" value={caseData.title} onChange={e => setField('title', e.target.value)}
              className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Delictstype</label>
              <select value={caseData.crimeType} onChange={e => {
                const ct = CRIME_TYPES.find(c => c.value === e.target.value)
                setField('crimeType', e.target.value)
                if (ct?.article) setField('legalArticle', ct.article)
              }}
                className={inputClass}>
                {CRIME_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Wetsartikel</label>
              <input type="text" value={caseData.legalArticle} onChange={e => setField('legalArticle', e.target.value)}
                className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Korte omschrijving</label>
            <input type="text" value={caseData.description} onChange={e => setField('description', e.target.value)}
              className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Achtergrondinformatie</label>
            <textarea value={caseData.backgroundStory} onChange={e => setField('backgroundStory', e.target.value)} rows={8}
              className={`${inputClass} resize-y`} />
          </div>
        </Card>

        {/* Getuige / Verdachte */}
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">{isSuspect ? 'Verdachte' : 'Getuige'}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className={labelClass}>Naam {isSuspect ? 'verdachte' : 'getuige'}</label>
              <input type="text" value={caseData.witnessName} onChange={e => setField('witnessName', e.target.value)}
                className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Leeftijd</label>
              <input type="number" value={caseData.witnessAge} onChange={e => setField('witnessAge', parseInt(e.target.value))}
                className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Geslacht</label>
              <select value={caseData.witnessGender || 'vrouw'} onChange={e => setField('witnessGender', e.target.value as 'man' | 'vrouw')}
                className={inputClass}>
                <option value="vrouw">Vrouw</option>
                <option value="man">Man</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Profiel van de {isSuspect ? 'verdachte' : 'getuige'}</label>
            <textarea value={caseData.witnessProfile} onChange={e => setField('witnessProfile', e.target.value)} rows={5}
              className={`${inputClass} resize-y`} />
          </div>
          {isSuspect && (
            <>
              <div>
                <label className={labelClass}>Wat heeft de verdachte daadwerkelijk gedaan?</label>
                <textarea value={caseData.suspectBackground || ''} onChange={e => setField('suspectBackground', e.target.value)} rows={6}
                  className={`${inputClass} resize-y`}
                  placeholder="Beschrijf exact wat de verdachte heeft gedaan — alleen zichtbaar voor de AI..." />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={caseData.isGuilty ?? true} onChange={e => setField('isGuilty', e.target.checked)} className="w-4 h-4" />
                <div>
                  <span className="text-sm font-medium text-gray-900">Verdachte is schuldig</span>
                  <p className="text-xs text-gray-500">Uitvinken als je een onschuldige verdachte wilt oefenen</p>
                </div>
              </label>
            </>
          )}
          <div>
            <label className={`${labelClass} mb-2`}>{isSuspect ? 'Houding verdachte' : 'Meewerkingsniveau'}</label>
            <div className="space-y-2">
              {([1,2,3,4,5] as CooperationLevel[]).map(l => (
                <label key={l} className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="coop" value={l}
                    checked={caseData.cooperationLevel === l}
                    onChange={() => setField('cooperationLevel', l)}
                    className="mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-gray-900">{l} — {isSuspect ? SUSPECT_COOPERATION_LABELS[l] : COOPERATION_LABELS[l]}</span>
                    <p className="text-xs text-gray-500">{isSuspect ? SUSPECT_COOPERATION_DESCRIPTIONS[l] : COOPERATION_DESCRIPTIONS[l]}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </Card>

        {/* Wat weet de getuige/verdachte */}
        <Card className="p-6 space-y-3">
          <h3 className="font-semibold text-gray-900">Wat weet de {isSuspect ? 'verdachte' : 'getuige'}?</h3>
          {caseData.witnessKnows.map((k, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-sm text-gray-400 w-5 pt-2">{i+1}.</span>
              <textarea value={k} onChange={e => setKnows(i, e.target.value)} rows={2}
                className={`${inputClass} flex-1 resize-y`}
                placeholder={`Feit ${i+1}...`} />
            </div>
          ))}
        </Card>

        {/* Sleutelpunten */}
        <div className="bg-white rounded-lg border border-amber-200 p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900">Sleutelpunten voor de student</h3>
            <p className="text-sm text-gray-500 mt-1">
              Wat moet de student achterhalen via doorvragen? De {isSuspect ? 'verdachte' : 'getuige'} geeft hints; de student wordt beoordeeld op of hij deze punten heeft opgespoord en verwerkt in het PV.
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
                <textarea value={kd.description} onChange={e => setDiscovery(i, 'description', e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-amber-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
                  placeholder="Bijv. De verdachte had een tatoeage op zijn linkerarm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hoe hint de {isSuspect ? 'verdachte' : 'getuige'} hier naar? (alleen zichtbaar voor de AI)</label>
                <textarea value={kd.witnessHint} onChange={e => setDiscovery(i, 'witnessHint', e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-amber-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
                  placeholder="Bijv. Noem terloops iets over een opvallend kenmerk als uiterlijk ter sprake komt" />
              </div>
            </div>
          ))}
          <button onClick={addDiscovery}
            className="flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-900 px-3 py-2 border border-dashed border-amber-300 rounded-md w-full justify-center hover:bg-amber-50">
            <Plus className="w-4 h-4" />
            Sleutelpunt toevoegen
          </button>
        </div>
      </div>
    </div>
  )
}
