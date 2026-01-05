-- Achievement Add-on Tables
-- Temporary gamification system for employee achievements
-- No foreign key constraints to main tables for loose coupling

-- ============================================
-- Table 1: addon_achievement_goals
-- Admin manages goals directly in database
-- ============================================
CREATE TABLE IF NOT EXISTS addon_achievement_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  action_type TEXT NOT NULL DEFAULT 'ticket_create',
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  target_count INTEGER NOT NULL CHECK (target_count > 0),
  reward_type TEXT NOT NULL DEFAULT 'drink_coupon',
  reward_description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE addon_achievement_goals IS 'Achievement goals - admin manages directly in DB';
COMMENT ON COLUMN addon_achievement_goals.action_type IS 'Type of action to track: ticket_create';
COMMENT ON COLUMN addon_achievement_goals.period_type IS 'Period for goal: daily, weekly, monthly';
COMMENT ON COLUMN addon_achievement_goals.target_count IS 'Number of actions required to complete goal';

-- ============================================
-- Table 2: addon_employee_achievements
-- Tracks progress per employee per goal per period
-- ============================================
CREATE TABLE IF NOT EXISTS addon_employee_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  goal_id UUID NOT NULL REFERENCES addon_achievement_goals(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  current_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one record per employee per goal per period
  UNIQUE (employee_id, goal_id, period_start)
);

CREATE INDEX idx_addon_achievements_employee ON addon_employee_achievements(employee_id);
CREATE INDEX idx_addon_achievements_status ON addon_employee_achievements(status);
CREATE INDEX idx_addon_achievements_period ON addon_employee_achievements(period_start, period_end);

COMMENT ON TABLE addon_employee_achievements IS 'Employee achievement progress tracking';
COMMENT ON COLUMN addon_employee_achievements.employee_id IS 'References main_employees.id (no FK for loose coupling)';

-- ============================================
-- Table 3: addon_employee_coupons
-- Stores earned coupons/rewards
-- ============================================
CREATE TABLE IF NOT EXISTS addon_employee_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  achievement_id UUID REFERENCES addon_employee_achievements(id) ON DELETE SET NULL,
  coupon_type TEXT NOT NULL DEFAULT 'drink_coupon',
  coupon_description TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'redeemed', 'expired')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  redeemed_at TIMESTAMPTZ,
  redeemed_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_addon_coupons_employee ON addon_employee_coupons(employee_id);
CREATE INDEX idx_addon_coupons_status ON addon_employee_coupons(status);
CREATE INDEX idx_addon_coupons_expires ON addon_employee_coupons(expires_at);

COMMENT ON TABLE addon_employee_coupons IS 'Employee coupons earned from achievements';
COMMENT ON COLUMN addon_employee_coupons.employee_id IS 'References main_employees.id (no FK for loose coupling)';
COMMENT ON COLUMN addon_employee_coupons.redeemed_by IS 'Admin who approved redemption (set directly in DB)';

-- ============================================
-- Insert sample goals for initial setup
-- ============================================
INSERT INTO addon_achievement_goals (name, description, action_type, period_type, target_count, reward_type, reward_description, is_active) VALUES
  ('นักสร้างตั๋วรายวัน', 'สร้างตั๋วครบ 20 ใบในหนึ่งวัน', 'ticket_create', 'daily', 20, 'drink_coupon', 'ชา หรือ น้ำอัดลม 1 แก้ว', true),
  ('นักสร้างตั๋วรายสัปดาห์', 'สร้างตั๋วครบ 100 ใบในหนึ่งสัปดาห์', 'ticket_create', 'weekly', 100, 'drink_coupon', 'ชา หรือ น้ำอัดลม 2 แก้ว', true),
  ('นักสร้างตั๋วรายเดือน', 'สร้างตั๋วครบ 400 ใบในหนึ่งเดือน', 'ticket_create', 'monthly', 400, 'drink_coupon', 'ชา หรือ น้ำอัดลม 5 แก้ว', true);

