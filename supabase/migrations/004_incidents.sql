CREATE TABLE incident_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_anonymous BOOLEAN DEFAULT false,
  category TEXT NOT NULL CHECK (category IN ('harassment','suspicious','unsafe_area','other')),
  description TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_name TEXT,
  severity INT DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','verified','dismissed')),
  media_urls TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can report" ON incident_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Users read own reports" ON incident_reports FOR SELECT USING (
  is_anonymous = false AND auth.uid() = reporter_id
  OR auth.jwt()->'user_metadata'->>'role' IN ('security','admin')
);
CREATE POLICY "All read verified" ON incident_reports FOR SELECT USING (status = 'verified');
CREATE POLICY "Admin can update" ON incident_reports FOR UPDATE USING (
  auth.jwt()->'user_metadata'->>'role' IN ('security','admin')
);
