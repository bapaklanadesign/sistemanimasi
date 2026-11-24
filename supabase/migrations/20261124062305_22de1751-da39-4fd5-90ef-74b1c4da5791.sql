ALTER TABLE public.pl_packing_lists ADD COLUMN tracking_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX pl_packing_lists_tracking_token_key ON public.pl_packing_lists (tracking_token);

CREATE OR REPLACE FUNCTION public.public_track_packing_list(_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'pl_number', p.pl_number,
    'pl_date', p.pl_date,
    'status', p.status,
    'status_changed_at', p.status_changed_at,
    'voyage_no', p.voyage_no,
    'etd', p.etd,
    'eta', p.eta,
    'total_koli', p.total_koli,
    'total_weight_kg', p.total_weight_kg,
    'total_volume_m3', p.total_volume_m3,
    'item_count', p.item_count,
    'vessel', v.name,
    'origin', CASE WHEN o.id IS NULL THEN NULL ELSE jsonb_build_object('name', o.name, 'city', o.city) END,
    'destination', CASE WHEN d.id IS NULL THEN NULL ELSE jsonb_build_object('name', d.name, 'city', d.city) END,
    'shipper', jsonb_build_object('name', s.name, 'city', s.city),
    'consignee', jsonb_build_object('name', c.name, 'city', c.city),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('line_no', i.line_no, 'name', i.name, 'qty', i.qty, 'unit', i.unit, 'weight_kg', i.weight_kg, 'volume_m3', i.volume_m3) ORDER BY i.line_no) FROM public.pl_items i WHERE i.packing_list_id = p.id), '[]'::jsonb),
    'history', COALESCE((SELECT jsonb_agg(jsonb_build_object('to_status', h.to_status, 'changed_at', h.changed_at) ORDER BY h.changed_at) FROM public.pl_status_history h WHERE h.packing_list_id = p.id), '[]'::jsonb)
  )
  FROM public.pl_packing_lists p
  JOIN public.pl_parties s ON s.id = p.shipper_id
  JOIN public.pl_parties c ON c.id = p.consignee_id
  LEFT JOIN public.pl_vessels v ON v.id = p.vessel_id
  LEFT JOIN public.pl_ports o ON o.id = p.origin_port_id
  LEFT JOIN public.pl_ports d ON d.id = p.destination_port_id
  WHERE p.tracking_token = _token
$$;
REVOKE ALL ON FUNCTION public.public_track_packing_list(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_track_packing_list(uuid) TO anon, authenticated;