CREATE TABLE sos_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'triggered' CHECK (status IN ('triggered','level_1','level_2','level_3','resolved','false_alarm')),
  trigger_method TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_name TEXT,
  triggered_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  level_1_at TIMESTAMPTZ,
  level_2_at TIMESTAMPTZ,
  level_3_at TIMESTAMPTZ,
  audio_url TEXT,
  notes TEXT
);

ALTER TABLE sos_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User reads own SOS" ON sos_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User inserts own SOS" ON sos_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User updates own SOS" ON sos_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Security reads all SOS" ON sos_events FOR SELECT USING (
  auth.jwt()->'user_metadata'->>'role' IN ('security','admin')
);
CREATE POLICY "Security updates all SOS" ON sos_events FOR UPDATE USING (
  auth.jwt()->'user_metadata'->>'role' IN ('security','admin')
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE sos_events;

CREATE TABLE responder_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sos_id UUID REFERENCES sos_events(id) ON DELETE CASCADE,
  responder_id UUID REFERENCES auth.users(id),
  dispatch_type TEXT NOT NULL,
  notified_at TIMESTAMPTZ DEFAULT now(),
  ack_at TIMESTAMPTZ,
  ack_status TEXT DEFAULT 'pending' CHECK (ack_status IN ('pending','en_route','on_scene','resolved'))
);

ALTER TABLE responder_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Responders read own dispatches" ON responder_dispatches FOR SELECT USING (auth.uid() = responder_id);
CREATE POLICY "Responders update own dispatches" ON responder_dispatches FOR UPDATE USING (auth.uid() = responder_id);
CREATE POLICY "Admin reads all dispatches" ON responder_dispatches FOR SELECT USING (
  auth.jwt()->'user_metadata'->>'role' IN ('security','admin')
);

CREATE TABLE location_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sos_id UUID REFERENCES sos_events(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT now()
);
