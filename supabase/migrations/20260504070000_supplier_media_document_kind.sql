-- Extend supplier_media kinds to support PDFs alongside photos for the
-- portfolio surface. Public profile renders both kinds; browse-card thumbnails
-- still filter on kind = 'photo' so a PDF can never become the supplier's hero
-- image. Existing rows keep `kind = 'photo'` (the table default).

alter type public.supplier_media_kind add value if not exists 'document';
