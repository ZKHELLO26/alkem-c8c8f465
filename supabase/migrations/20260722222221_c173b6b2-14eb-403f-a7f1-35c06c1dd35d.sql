
CREATE POLICY "public_read_employees_lookup" ON public.employees_master
  FOR SELECT TO anon USING (true);
GRANT SELECT ON public.employees_master TO anon;

CREATE POLICY "public_read_doctors_lookup" ON public.doctors_master
  FOR SELECT TO anon USING (true);
GRANT SELECT ON public.doctors_master TO anon;
