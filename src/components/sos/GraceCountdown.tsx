interface Props {
  countdown: number
  onCancel: () => void
}

export default function GraceCountdown({ countdown, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
      <div className="bg-white rounded-3xl p-8 mx-6 text-center shadow-2xl max-w-sm w-full">
        <div className="text-6xl font-black text-red-600 mb-2">{countdown}</div>
        <p className="text-lg font-semibold text-gray-800 mb-1">SOS Sending in...</p>
        <p className="text-sm text-gray-500 mb-6">
          Your emergency alert will be sent to your trusted contacts and campus security.
        </p>
        <button
          onClick={onCancel}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 rounded-xl transition-colors text-lg"
        >
          Cancel — False Alarm
        </button>
      </div>
    </div>
  )
}
