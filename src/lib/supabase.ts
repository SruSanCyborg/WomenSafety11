import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dqnizffhupehuwxenqur.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxbml6ZmZodXBlaHV3eGVucXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDM3MDksImV4cCI6MjA5MDQxOTcwOX0.dSyoQ208fmItiEtMBCeU5Od8mTAnMqRNDnBXMMw20nU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: { eventsPerSecond: 10 },
  },
})
