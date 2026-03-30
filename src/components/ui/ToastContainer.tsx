import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Toast, type ToastData } from './Toast'

export default function ToastContainer() {
  const { user } = useAuth()
  const [toasts, setToasts] = useState<ToastData[]>([])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`toast:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as any
          setToasts((prev) => [
            ...prev,
            {
              id: n.id,
              title: n.title,
              body: n.body,
              type: n.type,
            },
          ])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-20 right-3 left-3 z-50 flex flex-col gap-2 max-w-sm ml-auto">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  )
}
