import { useEffect, useState } from 'react'

export interface ToastData {
  id: string
  title: string
  body?: string
  type: 'sos_alert' | 'resolved' | 'checkin' | 'info'
}

const icons: Record<ToastData['type'], string> = {
  sos_alert: '🚨',
  resolved: '✅',
  checkin: '⏰',
  info: 'ℹ️',
}

const colors: Record<ToastData['type'], string> = {
  sos_alert: 'border-red-500 bg-red-50',
  resolved: 'border-green-500 bg-green-50',
  checkin: 'border-yellow-500 bg-yellow-50',
  info: 'border-blue-500 bg-blue-50',
}

interface Props {
  toast: ToastData
  onDismiss: (id: string) => void
}

export function Toast({ toast, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Animate in
    setTimeout(() => setVisible(true), 10)
    // Auto dismiss after 5s
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(toast.id), 300)
    }, 5000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-xl border-l-4 shadow-lg transition-all duration-300 ${colors[toast.type]} ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      }`}
    >
      <span className="text-xl flex-shrink-0">{icons[toast.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-gray-900">{toast.title}</p>
        {toast.body && <p className="text-xs text-gray-600 mt-0.5">{toast.body}</p>}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-gray-400 hover:text-gray-600 text-lg leading-none flex-shrink-0"
      >
        ×
      </button>
    </div>
  )
}
