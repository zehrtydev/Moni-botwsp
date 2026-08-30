-- Corrige la categoría de gastos de telefonía ya registrados.
update public.gastos as gasto
set categoria_id = categoria.id
from public.categorias as categoria
where categoria.nombre = 'Servicios'
  and lower(coalesce(gasto.descripcion, '')) like '%celular%';
