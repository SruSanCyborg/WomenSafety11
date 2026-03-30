import { useEffect, useState } from 'react'

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function install() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-24 left-3 right-3 z-50 max-w-sm mx-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-primary-100 p-4 flex items-center gap-3">
        <span className="text-3xl flex-shrink-0">🛡️</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-gray-800">Add SafeHer to Home Screen</p>
          <p className="text-xs text-gray-500">Works offline, instant SOS access</p>
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={install} className="bg-primary-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
            Install
          </button>
          <button onClick={() => setShow(false)} className="text-gray-400 text-xs text-center">
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
