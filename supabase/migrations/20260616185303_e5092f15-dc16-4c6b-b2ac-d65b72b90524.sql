
ALTER TABLE public.facebook_webhook_config
  ADD COLUMN IF NOT EXISTS app_secret text,
  ADD COLUMN IF NOT EXISTS page_id text,
  ADD COLUMN IF NOT EXISTS last_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_validation_result jsonb;

-- Função segura para o cliente ler metadados sem expor tokens
CREATE OR REPLACE FUNCTION public.get_facebook_config_meta()
RETURNS TABLE (
  id uuid,
  verify_token text,
  page_id text,
  has_page_access_token boolean,
  has_app_secret boolean,
  last_validated_at timestamptz,
  last_validation_result jsonb,
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.verify_token,
    c.page_id,
    (c.page_access_token IS NOT NULL AND length(c.page_access_token) > 0) AS has_page_access_token,
    (c.app_secret IS NOT NULL AND length(c.app_secret) > 0) AS has_app_secret,
    c.last_validated_at,
    c.last_validation_result,
    c.updated_at
  FROM public.facebook_webhook_config c
  WHERE public.has_role(auth.uid(), 'admin')
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_facebook_config_meta() TO authenticated;
