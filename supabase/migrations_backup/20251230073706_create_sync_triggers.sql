-- Create triggers to keep denormalized data in sync

-- Trigger: When appointment is created/updated, sync fields to ticket
CREATE OR REPLACE FUNCTION sync_ticket_appointment()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tickets
  SET 
    appointment_date = NEW.appointment_date,
    appointment_time_start = NEW.appointment_time_start,
    appointment_time_end = NEW.appointment_time_end,
    appointment_is_approved = NEW.is_approved,
    appointment_type = NEW.appointment_type
  WHERE appointment_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_ticket_appointment ON appointments;
CREATE TRIGGER trg_sync_ticket_appointment
AFTER INSERT OR UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION sync_ticket_appointment();

-- Trigger: When site name changes, sync to tickets
CREATE OR REPLACE FUNCTION sync_ticket_site()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE tickets SET site_name = NEW.name WHERE site_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_ticket_site ON sites;
CREATE TRIGGER trg_sync_ticket_site
AFTER UPDATE ON sites
FOR EACH ROW EXECUTE FUNCTION sync_ticket_site();

-- Trigger: When company name changes, sync to sites and tickets
CREATE OR REPLACE FUNCTION sync_company_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name_th IS DISTINCT FROM OLD.name_th OR NEW.name_en IS DISTINCT FROM OLD.name_en THEN
    -- Update sites
    UPDATE sites
    SET company_name_th = NEW.name_th, company_name_en = NEW.name_en
    WHERE company_id = NEW.tax_id;
    
    -- Update tickets
    UPDATE tickets t
    SET company_name = COALESCE(NEW.name_th, NEW.name_en)
    FROM sites s
    WHERE t.site_id = s.id AND s.company_id = NEW.tax_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_company_name ON companies;
CREATE TRIGGER trg_sync_company_name
AFTER UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION sync_company_name();

-- Trigger: Sync site denorm fields on site insert/update
CREATE OR REPLACE FUNCTION sync_site_company_on_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Populate company names from companies table
  IF NEW.company_id IS NOT NULL THEN
    SELECT name_th, name_en INTO NEW.company_name_th, NEW.company_name_en
    FROM companies WHERE tax_id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_site_company ON sites;
CREATE TRIGGER trg_sync_site_company
BEFORE INSERT OR UPDATE OF company_id ON sites
FOR EACH ROW EXECUTE FUNCTION sync_site_company_on_change();

-- Trigger: Sync employee department_id from role
CREATE OR REPLACE FUNCTION sync_employee_department()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role_id IS NOT NULL THEN
    SELECT department_id INTO NEW.department_id FROM roles WHERE id = NEW.role_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_employee_department ON employees;
CREATE TRIGGER trg_sync_employee_department
BEFORE INSERT OR UPDATE OF role_id ON employees
FOR EACH ROW EXECUTE FUNCTION sync_employee_department();

-- Trigger: Sync ticket denorm fields on ticket insert/update
CREATE OR REPLACE FUNCTION sync_ticket_denorm_on_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Populate site_name and company_name from site
  IF NEW.site_id IS NOT NULL AND (NEW.site_id IS DISTINCT FROM OLD.site_id OR NEW.site_name IS NULL) THEN
    SELECT s.name, COALESCE(c.name_th, c.name_en)
    INTO NEW.site_name, NEW.company_name
    FROM sites s
    LEFT JOIN companies c ON s.company_id = c.tax_id
    WHERE s.id = NEW.site_id;
  END IF;
  
  -- Populate appointment fields from appointment
  IF NEW.appointment_id IS NOT NULL AND (NEW.appointment_id IS DISTINCT FROM OLD.appointment_id OR NEW.appointment_date IS NULL) THEN
    SELECT appointment_date, appointment_time_start, appointment_time_end, is_approved, appointment_type
    INTO NEW.appointment_date, NEW.appointment_time_start, NEW.appointment_time_end, NEW.appointment_is_approved, NEW.appointment_type
    FROM appointments WHERE id = NEW.appointment_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_ticket_denorm ON tickets;
CREATE TRIGGER trg_sync_ticket_denorm
BEFORE INSERT OR UPDATE OF site_id, appointment_id ON tickets
FOR EACH ROW EXECUTE FUNCTION sync_ticket_denorm_on_change();

