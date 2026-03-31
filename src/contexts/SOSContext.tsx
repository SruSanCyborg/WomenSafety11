import { createContext, useContext, ReactNode } from 'react'
import { useSOS } from '../hooks/useSOS'
import type { SOSStatus, TriggerMethod } from '../types'

interface SOSContextValue {
  status: SOSStatus | 'idle'
  sosId: string | null
  countdown: number
  showGrace: boolean
  triggerSOS: (method?: TriggerMethod) => void
  cancelSOS: () => void
  cancelActiveSOSAsFalseAlarm: () => Promise<void>
  reset: () => void
}

const SOSContext = createContext<SOSContextValue | null>(null)

export function SOSProvider({ children }: { children: ReactNode }) {
  const sos = useSOS()
  return <SOSContext.Provider value={sos}>{children}</SOSContext.Provider>
}

export function useSOSContext() {
  const ctx = useContext(SOSContext)
  if (!ctx) throw new Error('useSOSContext must be used within SOSProvider')
  return ctx
}
