-- Update all models to use Thai unit "เครื่อง" and category "UPS"
UPDATE main_models
SET
  unit = 'เครื่อง',
  category = 'UPS',
  updated_at = NOW();
