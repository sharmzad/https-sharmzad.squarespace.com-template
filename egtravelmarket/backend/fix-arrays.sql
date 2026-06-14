-- Fix array storage format - convert from JSON to comma-separated
UPDATE expert_profiles SET
  languages = (CASE WHEN languages IS NOT NULL AND languages != '[]' AND languages != 'null' 
    THEN (SELECT string_agg(val, ', ') FROM (SELECT DISTINCT jsonb_array_elements_text(languages::jsonb) as val) t)
    ELSE NULL END),
  specialties = (CASE WHEN specialties IS NOT NULL AND specialties != '[]' AND specialties != 'null'
    THEN (SELECT string_agg(val, ', ') FROM (SELECT DISTINCT jsonb_array_elements_text(specialties::jsonb) as val) t)
    ELSE NULL END),
  certifications = (CASE WHEN certifications IS NOT NULL AND certifications != '[]' AND certifications != 'null'
    THEN (SELECT string_agg(val, ', ') FROM (SELECT DISTINCT jsonb_array_elements_text(certifications::jsonb) as val) t)
    ELSE NULL END)
WHERE (languages LIKE '[%' OR specialties LIKE '[%' OR certifications LIKE '[%');
