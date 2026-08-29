-- ============================================================================
-- Guita — Migración 0011: ocultar categorías predefinidas por usuario
-- ============================================================================
-- Las predefinidas son filas globales (user_id is null) que la policy de SELECT
-- expone a todos los usuarios. Borrarlas se las borraría a todos, y por eso las
-- policies de update/delete (user_id = auth.uid()) nunca matchean contra un null.
--
-- En vez de tocar datos compartidos, cada usuario guarda cuáles no quiere ver.
-- La fila sigue existiendo, así que los movimientos ya categorizados con ella
-- conservan nombre y color.

alter table public.users
  add column if not exists hidden_category_ids uuid[] not null default '{}';
