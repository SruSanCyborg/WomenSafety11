import type { SOSStatus } from '../../types'

interface Props {
  status: SOSStatus | 'idle'
  onCancelFalseAlarm: () => void
  onReset: () => void
}

const levelInfo: Record<string, { label: string; description: string; color: string }> = {
  triggered: {
    label: 'Alert Sent',
    description: 'Your SOS has been triggered. Notifying trusted contacts...',
    color: 'bg-orange-50 border-orange-200 text-orange-800',
  },
  level_1: {
    label: 'Level 1 — Alert',
    description: 'Trusted contacts have been notified. Help is on the way.',
    color: 'bg-orange-50 border-orange-200 text-orange-800',
  },
  level_2: {
    label: 'Level 2 — Urgent',
    description: 'Campus security has been alerted. A responder is en route.',
    color: 'bg-red-50 border-red-300 text-red-800',
  },
  level_3: {
    label: 'Level 3 — Emergency',
    description: 'FULL CAMPUS ALERT. All available responders and admin have been notified.',
    color: 'bg-red-100 border-red-500 text-red-900',
  },
  resolved: {
    label: 'Resolved — You are Safe',
    description: 'Your emergency has been resolved. Stay safe.',
    color: 'bg-green-50 border-green-300 text-green-800',
  },
  false_alarm: {
    label: 'Alert Cancelled',
    description: 'Your alert has been cancelled as a false alarm.',
    color: 'bg-gray-50 border-gray-200 text-gray-600',
  },
}

export default function SOSStatus({ status, onCancelFalseAlarm, onReset }: Props) {
  const info = levelInfo[status]
  if (!info) return null

  const isActive = status !== 'resolved' && status !== 'false_alarm'

  return (
    <div className={`w-full border-2 rounded-2xl p-4 ${info.color}`}>
      <div className="flex items-center gap-2 mb-1">
        {isActive && <span className="w-2 h-2 rounded-full bg-current animate-pulse inline-block" />}
        <span className="font-bold text-base">{info.label}</span>
      </div>
      <p className="text-sm mb-4">{info.description}</p>

      <div className="flex gap-2">
        {isActive && (
          <button
            onClick={onCancelFalseAlarm}
            className="flex-1 bg-white/70 hover:bg-white border border-current text-sm font-semibold py-2 rounded-xl transition-colors"
          >
            False Alarm
          </button>
        )}
        {!isActive && (
          <button
            onClick={onReset}
            className="flex-1 bg-white/70 hover:bg-white border border-current text-sm font-semibold py-2 rounded-xl transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}
