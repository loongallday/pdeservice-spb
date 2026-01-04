-- Fix multiple permissive policies that overlap on the same role/action
-- Consolidate into single policies per action

-- Fix departments - remove overlapping SELECT policies, separate write policies
DROP POLICY IF EXISTS "Admins can manage departments" ON departments;
DROP POLICY IF EXISTS "Anyone can view departments" ON departments;

-- Single SELECT policy for all
CREATE POLICY "Anyone can view departments" ON departments
  FOR SELECT USING (true);

-- Admin policies for write operations only
CREATE POLICY "Admins can insert departments" ON departments
  FOR INSERT WITH CHECK ((select user_has_min_level(5)));

CREATE POLICY "Admins can update departments" ON departments
  FOR UPDATE USING ((select user_has_min_level(5)));

CREATE POLICY "Admins can delete departments" ON departments
  FOR DELETE USING ((select user_has_min_level(5)));

-- Fix model_package_items - separate read and write policies
DROP POLICY IF EXISTS "Allow authenticated read access to model_package_items" ON model_package_items;
DROP POLICY IF EXISTS "Allow authenticated write access to model_package_items" ON model_package_items;

CREATE POLICY "Authenticated can read model_package_items" ON model_package_items
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated can insert model_package_items" ON model_package_items
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated can update model_package_items" ON model_package_items
  FOR UPDATE USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated can delete model_package_items" ON model_package_items
  FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- Fix model_package_services
DROP POLICY IF EXISTS "Allow authenticated read access to model_package_services" ON model_package_services;
DROP POLICY IF EXISTS "Allow authenticated write access to model_package_services" ON model_package_services;

CREATE POLICY "Authenticated can read model_package_services" ON model_package_services
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated can insert model_package_services" ON model_package_services
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated can update model_package_services" ON model_package_services
  FOR UPDATE USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated can delete model_package_services" ON model_package_services
  FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- Fix model_specifications
DROP POLICY IF EXISTS "Allow authenticated read access to model_specifications" ON model_specifications;
DROP POLICY IF EXISTS "Allow authenticated write access to model_specifications" ON model_specifications;

CREATE POLICY "Authenticated can read model_specifications" ON model_specifications
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated can insert model_specifications" ON model_specifications
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated can update model_specifications" ON model_specifications
  FOR UPDATE USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated can delete model_specifications" ON model_specifications
  FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- Fix package_items
DROP POLICY IF EXISTS "Allow authenticated read access to package_items" ON package_items;
DROP POLICY IF EXISTS "Allow authenticated write access to package_items" ON package_items;

CREATE POLICY "Authenticated can read package_items" ON package_items
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated can insert package_items" ON package_items
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated can update package_items" ON package_items
  FOR UPDATE USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated can delete package_items" ON package_items
  FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- Fix package_services
DROP POLICY IF EXISTS "Allow authenticated read access to package_services" ON package_services;
DROP POLICY IF EXISTS "Allow authenticated write access to package_services" ON package_services;

CREATE POLICY "Authenticated can read package_services" ON package_services
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated can insert package_services" ON package_services
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated can update package_services" ON package_services
  FOR UPDATE USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated can delete package_services" ON package_services
  FOR DELETE USING ((select auth.uid()) IS NOT NULL);

