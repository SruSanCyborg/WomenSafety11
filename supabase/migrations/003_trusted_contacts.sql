CREATE TABLE trusted_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notify_via TEXT[] DEFAULT '{push,sms}',
  priority INT NOT NULL DEFAULT 1,
  is_campus BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE trusted_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own contacts" ON trusted_contacts FOR ALL USING (auth.uid() = user_id);

CREATE TABLE checkin_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT,
  interval_min INT DEFAULT 5,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT false,
  last_checkin TIMESTAMPTZ
);

ALTER TABLE checkin_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own schedules" ON checkin_schedules FOR ALL USING (auth.uid() = user_id);

CREATE TABLE safe_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  route_geojson JSONB NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE safe_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own routes" ON safe_routes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "All read verified routes" ON safe_routes FOR SELECT USING (is_verified = true);
