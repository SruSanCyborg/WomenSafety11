import { useSOSContext } from '../../contexts/SOSContext'
import GraceCountdown from './GraceCountdown'
import SOSStatus from './SOSStatus'

const statusColors: Record<string, string> = {
  idle: 'bg-red-600 hover:bg-red-700 active:scale-95',
  triggered: 'bg-orange-500',
  level_1: 'bg-orange-600 animate-pulse',
  level_2: 'bg-red-700 animate-pulse',
  level_3: 'bg-red-900 animate-pulse',
  resolved: 'bg-green-600',
  false_alarm: 'bg-gray-400',
}

const statusLabels: Record<string, string> = {
  idle: 'SOS',
  triggered: 'SENT',
  level_1: 'ALERT',
  level_2: 'URGENT',
  level_3: 'EMERGENCY',
  resolved: 'SAFE',
  false_alarm: 'CANCELLED',
}

export default function SOSButton() {
  const { status, showGrace, countdown, triggerSOS, cancelSOS, cancelActiveSOSAsFalseAlarm, reset } = useSOSContext()

  const isActive = status !== 'idle' && status !== 'resolved' && status !== 'false_alarm'

  function handleClick() {
    if (status === 'idle') {
      triggerSOS('button')
    } else if (status === 'resolved' || status === 'false_alarm') {
      reset()
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* SOS Ring + Button */}
      <div className="relative flex items-center justify-center">
        {isActive && (
          <>
            <span className="absolute w-48 h-48 rounded-full bg-red-400 opacity-20 animate-ping" />
            <span className="absolute w-40 h-40 rounded-full bg-red-500 opacity-30 animate-ping delay-150" />
          </>
        )}
        <button
          onClick={handleClick}
          disabled={isActive}
          className={`relative w-36 h-36 rounded-full text-white font-extrabold text-3xl shadow-2xl transition-all duration-200 ${statusColors[status] ?? 'bg-red-600'}`}
        >
          {statusLabels[status] ?? 'SOS'}
        </button>
      </div>

      {/* Grace period countdown overlay */}
      {showGrace && (
        <GraceCountdown countdown={countdown} onCancel={cancelSOS} />
      )}

      {/* Status info */}
      {!showGrace && status !== 'idle' && (
        <SOSStatus
          status={status}
          onCancelFalseAlarm={cancelActiveSOSAsFalseAlarm}
          onReset={reset}
        />
      )}

      {status === 'idle' && (
        <p className="text-sm text-gray-500 text-center max-w-xs">
          Press the button to send an emergency alert to your trusted contacts and campus security.
        </p>
      )}
    </div>
  )
}
