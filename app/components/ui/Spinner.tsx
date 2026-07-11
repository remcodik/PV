export function Spinner({ className = 'w-6 h-6' }: { className?: string }) {
  return <div className={`${className} border-2 border-ink-700 border-t-transparent rounded-full animate-spin`} />
}

export function PageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="text-center">
        <Spinner className="w-9 h-9 mx-auto mb-3" />
        <p className="text-sm text-gray-400">Laden...</p>
      </div>
    </div>
  )
}
