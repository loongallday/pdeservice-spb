-- Populate denormalized fields from existing data

-- Populate site_name and company_name on tickets
UPDATE tickets t
SET 
  site_name = s.name,
  company_name = COALESCE(c.name_th, c.name_en)
FROM sites s
LEFT JOIN companies c ON s.company_id = c.tax_id
WHERE t.site_id = s.id
  AND (t.site_name IS NULL OR t.company_name IS NULL);

-- Populate company names on sites
UPDATE sites s
SET 
  company_name_th = c.name_th,
  company_name_en = c.name_en
FROM companies c
WHERE s.company_id = c.tax_id
  AND (s.company_name_th IS NULL OR s.company_name_en IS NULL);

-- Populate department_id on employees from roles
UPDATE employees e
SET department_id = r.department_id
FROM roles r
WHERE e.role_id = r.id
  AND e.department_id IS NULL;

