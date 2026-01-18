-- Fix RLS policies that re-evaluate auth functions for each row
-- Wrap auth.<function>() with (select ...) for better performance

-- Fix departments policy
DROP POLICY IF EXISTS "Admins can manage departments" ON departments;
CREATE POLICY "Admins can manage departments" ON departments
  FOR ALL USING ((select user_has_min_level(5)));

-- Fix appointment_approval_users policies
DROP POLICY IF EXISTS "Users can read appointment approval users" ON appointment_approval_users;
CREATE POLICY "Users can read appointment approval users" ON appointment_approval_users
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Level 2+ can insert appointment approval users" ON appointment_approval_users;
CREATE POLICY "Level 2+ can insert appointment approval users" ON appointment_approval_users
  FOR INSERT WITH CHECK ((select user_has_min_level(2)));

DROP POLICY IF EXISTS "Level 2+ can update appointment approval users" ON appointment_approval_users;
CREATE POLICY "Level 2+ can update appointment approval users" ON appointment_approval_users
  FOR UPDATE USING ((select user_has_min_level(2)));

DROP POLICY IF EXISTS "Level 2+ can delete appointment approval users" ON appointment_approval_users;
CREATE POLICY "Level 2+ can delete appointment approval users" ON appointment_approval_users
  FOR DELETE USING ((select user_has_min_level(2)));

-- Fix ticket_audit policy
DROP POLICY IF EXISTS "Users can read ticket audit logs" ON ticket_audit;
CREATE POLICY "Users can read ticket audit logs" ON ticket_audit
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

-- Fix announcements policies
DROP POLICY IF EXISTS "Users can read announcements" ON announcements;
CREATE POLICY "Users can read announcements" ON announcements
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Level 1+ can insert announcements" ON announcements;
CREATE POLICY "Level 1+ can insert announcements" ON announcements
  FOR INSERT WITH CHECK ((select user_has_min_level(1)));

DROP POLICY IF EXISTS "Level 2+ can update announcements" ON announcements;
CREATE POLICY "Level 2+ can update announcements" ON announcements
  FOR UPDATE USING ((select user_has_min_level(2)));

DROP POLICY IF EXISTS "Level 2+ can delete announcements" ON announcements;
CREATE POLICY "Level 2+ can delete announcements" ON announcements
  FOR DELETE USING ((select user_has_min_level(2)));

-- Fix announcement_photos policies
DROP POLICY IF EXISTS "Users can read announcement photos" ON announcement_photos;
CREATE POLICY "Users can read announcement photos" ON announcement_photos
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Level 1+ can insert announcement photos" ON announcement_photos;
CREATE POLICY "Level 1+ can insert announcement photos" ON announcement_photos
  FOR INSERT WITH CHECK ((select user_has_min_level(1)));

DROP POLICY IF EXISTS "Level 2+ can update announcement photos" ON announcement_photos;
CREATE POLICY "Level 2+ can update announcement photos" ON announcement_photos
  FOR UPDATE USING ((select user_has_min_level(2)));

DROP POLICY IF EXISTS "Level 2+ can delete announcement photos" ON announcement_photos;
CREATE POLICY "Level 2+ can delete announcement photos" ON announcement_photos
  FOR DELETE USING ((select user_has_min_level(2)));

-- Fix announcement_files policies
DROP POLICY IF EXISTS "Users can read announcement files" ON announcement_files;
CREATE POLICY "Users can read announcement files" ON announcement_files
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Level 1+ can insert announcement files" ON announcement_files;
CREATE POLICY "Level 1+ can insert announcement files" ON announcement_files
  FOR INSERT WITH CHECK ((select user_has_min_level(1)));

DROP POLICY IF EXISTS "Level 2+ can update announcement files" ON announcement_files;
CREATE POLICY "Level 2+ can update announcement files" ON announcement_files
  FOR UPDATE USING ((select user_has_min_level(2)));

DROP POLICY IF EXISTS "Level 2+ can delete announcement files" ON announcement_files;
CREATE POLICY "Level 2+ can delete announcement files" ON announcement_files
  FOR DELETE USING ((select user_has_min_level(2)));

