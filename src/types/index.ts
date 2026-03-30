export type UserRole = 'student' | 'faculty' | 'security' | 'admin'

export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  role: UserRole
  campus_id: string | null
  hostel_block: string | null
  is_verified: boolean
  fcm_token: string | null
  created_at: string
}

export type SOSStatus =
  | 'triggered'
  | 'level_1'
  | 'level_2'
  | 'level_3'
  | 'resolved'
  | 'false_alarm'

export type TriggerMethod = 'button' | 'shake' | 'silent' | 'checkin_miss'

export interface SOSEvent {
  id: string
  user_id: string
  status: SOSStatus
  trigger_method: TriggerMethod
  latitude: number | null
  longitude: number | null
  location_name: string | null
  triggered_at: string
  resolved_at: string | null
  resolved_by: string | null
  level_1_at: string | null
  level_2_at: string | null
  level_3_at: string | null
  audio_url: string | null
  notes: string | null
  user?: Pick<Profile, 'full_name' | 'phone'>
}

export interface TrustedContact {
  id: string
  user_id: string
  name: string
  phone: string | null
  email: string | null
  notify_via: string[]
  priority: number
  is_campus: boolean
  created_at: string
}

export interface IncidentReport {
  id: string
  reporter_id: string | null
  is_anonymous: boolean
  category: 'harassment' | 'suspicious' | 'unsafe_area' | 'other'
  description: string
  latitude: number | null
  longitude: number | null
  location_name: string | null
  severity: number
  status: 'pending' | 'verified' | 'dismissed'
  media_urls: string[] | null
  created_at: string
}

export interface CheckinSchedule {
  id: string
  user_id: string
  label: string | null
  interval_min: number
  start_time: string | null
  end_time: string | null
  is_active: boolean
  last_checkin: string | null
}

export interface BuddyAvailability {
  user_id: string
  is_available: boolean
  lat: number | null
  lng: number | null
  last_seen: string
  profile?: Pick<Profile, 'full_name' | 'avatar_url'>
}

export interface Notification {
  id: string
  user_id: string
  sos_id: string | null
  type: 'sos_alert' | 'resolved' | 'checkin' | 'info'
  title: string
  body: string | null
  is_read: boolean
  created_at: string
}

export interface ResponderDispatch {
  id: string
  sos_id: string
  responder_id: string
  dispatch_type: 'trusted_contact' | 'peer' | 'security' | 'admin'
  notified_at: string
  ack_at: string | null
  ack_status: 'pending' | 'en_route' | 'on_scene' | 'resolved'
}
