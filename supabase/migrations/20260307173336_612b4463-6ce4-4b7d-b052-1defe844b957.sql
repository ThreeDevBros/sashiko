INSERT INTO public.tenant_settings (tenant_name) 
SELECT 'eFood' 
WHERE NOT EXISTS (SELECT 1 FROM public.tenant_settings);