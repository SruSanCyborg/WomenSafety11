CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sos_id UUID REFERENCES sos_events(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('sos_alert','resolved','checkin','info')),
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notifications" ON notifications FOR ALL USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

CREATE TABLE buddy_availability (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_available BOOLEAN DEFAULT false,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  last_seen TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE buddy_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users update own availability" ON buddy_availability FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "All can read buddy availability" ON buddy_availability FOR SELECT USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE buddy_availability;

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION log_action(p_action TEXT, p_target TEXT, p_meta JSONB DEFAULT '{}')
RETURNS VOID AS $$
BEGIN
  INSERT INTO audit_log (actor_id, action, target, meta)
  VALUES (auth.uid(), p_action, p_target, p_meta);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
