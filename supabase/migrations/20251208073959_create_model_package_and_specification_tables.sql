-- Migration: Create Model Package and Specification Tables
-- Description: Adds tables for model starter packages (items + services) and UPS specifications

-- ============================================================================
-- 1. PACKAGE ITEMS - Catalog of items that can be included in packages
-- ============================================================================
CREATE TABLE package_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name_th VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  description TEXT,
  category VARCHAR(100),
  unit VARCHAR(50) DEFAULT 'piece',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE package_items IS 'Catalog of items that can be included in model starter packages';
COMMENT ON COLUMN package_items.code IS 'Unique item code (e.g., BAT-12V-7AH, CABLE-POWER)';
COMMENT ON COLUMN package_items.name_th IS 'Thai name of the item';
COMMENT ON COLUMN package_items.name_en IS 'English name of the item';
COMMENT ON COLUMN package_items.category IS 'Item category (e.g., battery, cable, accessory)';
COMMENT ON COLUMN package_items.unit IS 'Unit of measurement (e.g., piece, meter)';

-- ============================================================================
-- 2. PACKAGE SERVICES - Catalog of services that can be included in packages
-- ============================================================================
CREATE TABLE package_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name_th VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  description TEXT,
  category VARCHAR(100),
  duration_months INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE package_services IS 'Catalog of services that can be included in model starter packages';
COMMENT ON COLUMN package_services.code IS 'Unique service code (e.g., SVC-INSTALL, SVC-WARRANTY-1Y)';
COMMENT ON COLUMN package_services.name_th IS 'Thai name of the service';
COMMENT ON COLUMN package_services.name_en IS 'English name of the service';
COMMENT ON COLUMN package_services.category IS 'Service category (e.g., installation, warranty, maintenance)';
COMMENT ON COLUMN package_services.duration_months IS 'Service duration in months if applicable';

-- ============================================================================
-- 3. MODEL PACKAGE ITEMS - Junction table linking models to package items
-- ============================================================================
CREATE TABLE model_package_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES package_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(model_id, item_id)
);

COMMENT ON TABLE model_package_items IS 'Junction table linking models to their starter package items';
COMMENT ON COLUMN model_package_items.model_id IS 'Reference to the model';
COMMENT ON COLUMN model_package_items.item_id IS 'Reference to the package item';
COMMENT ON COLUMN model_package_items.quantity IS 'Quantity of this item included in the package';
COMMENT ON COLUMN model_package_items.note IS 'Additional notes for this item in the package';
COMMENT ON COLUMN model_package_items.display_order IS 'Display order for UI sorting';

-- ============================================================================
-- 4. MODEL PACKAGE SERVICES - Junction table linking models to package services
-- ============================================================================
CREATE TABLE model_package_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES package_services(id) ON DELETE RESTRICT,
  terms TEXT,
  note TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(model_id, service_id)
);

COMMENT ON TABLE model_package_services IS 'Junction table linking models to their starter package services';
COMMENT ON COLUMN model_package_services.model_id IS 'Reference to the model';
COMMENT ON COLUMN model_package_services.service_id IS 'Reference to the package service';
COMMENT ON COLUMN model_package_services.terms IS 'Service terms and conditions specific to this model';
COMMENT ON COLUMN model_package_services.note IS 'Additional notes for this service in the package';
COMMENT ON COLUMN model_package_services.display_order IS 'Display order for UI sorting';

-- ============================================================================
-- 5. MODEL SPECIFICATIONS - UPS technical specifications (1:1 with models)
-- ============================================================================
CREATE TABLE model_specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL UNIQUE REFERENCES models(id) ON DELETE CASCADE,
  
  -- Capacity & Power
  capacity_va INTEGER,
  capacity_watts INTEGER,
  power_factor DECIMAL(3,2),
  
  -- Input Specifications
  input_voltage_nominal INTEGER,
  input_voltage_range VARCHAR(50),
  input_frequency VARCHAR(50),
  input_phase VARCHAR(20),
  
  -- Output Specifications
  output_voltage_nominal INTEGER,
  output_voltage_regulation VARCHAR(50),
  output_frequency VARCHAR(50),
  output_waveform VARCHAR(50),
  
  -- Battery
  battery_type VARCHAR(100),
  battery_voltage INTEGER,
  battery_quantity INTEGER,
  battery_ah DECIMAL(6,2),
  typical_recharge_time VARCHAR(50),
  
  -- Runtime & Performance
  runtime_half_load_minutes INTEGER,
  runtime_full_load_minutes INTEGER,
  transfer_time_ms INTEGER,
  efficiency_percent DECIMAL(5,2),
  
  -- Physical
  dimensions_wxdxh VARCHAR(100),
  weight_kg DECIMAL(6,2),
  
  -- Environment
  operating_temperature VARCHAR(50),
  operating_humidity VARCHAR(50),
  noise_level_db DECIMAL(5,2),
  
  -- Connectivity & Features
  communication_ports TEXT[],
  outlets_iec INTEGER,
  outlets_nema INTEGER,
  has_lcd_display BOOLEAN DEFAULT FALSE,
  has_avr BOOLEAN DEFAULT FALSE,
  has_surge_protection BOOLEAN DEFAULT FALSE,
  
  -- Certifications & Standards
  certifications TEXT[],
  
  -- Additional
  additional_specs JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE model_specifications IS 'UPS technical specifications for each model (1:1 relationship)';
COMMENT ON COLUMN model_specifications.capacity_va IS 'Capacity in VA (e.g., 1000, 2000, 3000)';
COMMENT ON COLUMN model_specifications.capacity_watts IS 'Capacity in Watts';
COMMENT ON COLUMN model_specifications.power_factor IS 'Power factor (e.g., 0.8, 0.9)';
COMMENT ON COLUMN model_specifications.input_voltage_nominal IS 'Nominal input voltage (e.g., 220V)';
COMMENT ON COLUMN model_specifications.input_voltage_range IS 'Input voltage range (e.g., 160-290V)';
COMMENT ON COLUMN model_specifications.input_frequency IS 'Input frequency (e.g., 50/60 Hz)';
COMMENT ON COLUMN model_specifications.input_phase IS 'Input phase (single or three)';
COMMENT ON COLUMN model_specifications.output_voltage_nominal IS 'Nominal output voltage (e.g., 220V, 230V)';
COMMENT ON COLUMN model_specifications.output_voltage_regulation IS 'Output voltage regulation (e.g., +/-2%)';
COMMENT ON COLUMN model_specifications.output_frequency IS 'Output frequency (e.g., 50/60 Hz +/-1%)';
COMMENT ON COLUMN model_specifications.output_waveform IS 'Output waveform (e.g., Pure Sine Wave)';
COMMENT ON COLUMN model_specifications.battery_type IS 'Battery type (e.g., Sealed Lead-Acid, Lithium-Ion)';
COMMENT ON COLUMN model_specifications.battery_voltage IS 'Battery voltage (e.g., 12V, 24V, 48V)';
COMMENT ON COLUMN model_specifications.battery_quantity IS 'Number of batteries';
COMMENT ON COLUMN model_specifications.battery_ah IS 'Battery amp-hour rating';
COMMENT ON COLUMN model_specifications.typical_recharge_time IS 'Typical recharge time (e.g., 4-6 hours to 90%)';
COMMENT ON COLUMN model_specifications.runtime_half_load_minutes IS 'Runtime at 50% load in minutes';
COMMENT ON COLUMN model_specifications.runtime_full_load_minutes IS 'Runtime at 100% load in minutes';
COMMENT ON COLUMN model_specifications.transfer_time_ms IS 'Transfer time in milliseconds';
COMMENT ON COLUMN model_specifications.efficiency_percent IS 'Efficiency percentage (e.g., 95.5)';
COMMENT ON COLUMN model_specifications.dimensions_wxdxh IS 'Dimensions WxDxH (e.g., 190x410x320 mm)';
COMMENT ON COLUMN model_specifications.weight_kg IS 'Weight in kilograms';
COMMENT ON COLUMN model_specifications.operating_temperature IS 'Operating temperature range (e.g., 0-40C)';
COMMENT ON COLUMN model_specifications.operating_humidity IS 'Operating humidity range (e.g., 0-95% RH)';
COMMENT ON COLUMN model_specifications.noise_level_db IS 'Noise level in decibels';
COMMENT ON COLUMN model_specifications.communication_ports IS 'Array of communication ports (USB, RS-232, SNMP)';
COMMENT ON COLUMN model_specifications.outlets_iec IS 'Number of IEC outlets';
COMMENT ON COLUMN model_specifications.outlets_nema IS 'Number of NEMA outlets';
COMMENT ON COLUMN model_specifications.has_lcd_display IS 'Whether unit has LCD display';
COMMENT ON COLUMN model_specifications.has_avr IS 'Whether unit has Automatic Voltage Regulation';
COMMENT ON COLUMN model_specifications.has_surge_protection IS 'Whether unit has surge protection';
COMMENT ON COLUMN model_specifications.certifications IS 'Array of certifications (CE, UL, TIS)';
COMMENT ON COLUMN model_specifications.additional_specs IS 'Additional specifications as JSON';

-- ============================================================================
-- 6. INDEXES
-- ============================================================================

-- Package items indexes
CREATE INDEX idx_package_items_category ON package_items(category);
CREATE INDEX idx_package_items_is_active ON package_items(is_active);

-- Package services indexes
CREATE INDEX idx_package_services_category ON package_services(category);
CREATE INDEX idx_package_services_is_active ON package_services(is_active);

-- Model package items junction indexes
CREATE INDEX idx_model_package_items_model_id ON model_package_items(model_id);
CREATE INDEX idx_model_package_items_item_id ON model_package_items(item_id);

-- Model package services junction indexes
CREATE INDEX idx_model_package_services_model_id ON model_package_services(model_id);
CREATE INDEX idx_model_package_services_service_id ON model_package_services(service_id);

-- Model specifications indexes
CREATE INDEX idx_model_specifications_capacity_va ON model_specifications(capacity_va);

-- ============================================================================
-- 7. RLS POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_package_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_specifications ENABLE ROW LEVEL SECURITY;

-- Package items policies
CREATE POLICY "Allow authenticated read access to package_items"
  ON package_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated write access to package_items"
  ON package_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Package services policies
CREATE POLICY "Allow authenticated read access to package_services"
  ON package_services FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated write access to package_services"
  ON package_services FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Model package items policies
CREATE POLICY "Allow authenticated read access to model_package_items"
  ON model_package_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated write access to model_package_items"
  ON model_package_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Model package services policies
CREATE POLICY "Allow authenticated read access to model_package_services"
  ON model_package_services FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated write access to model_package_services"
  ON model_package_services FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Model specifications policies
CREATE POLICY "Allow authenticated read access to model_specifications"
  ON model_specifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated write access to model_specifications"
  ON model_specifications FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

