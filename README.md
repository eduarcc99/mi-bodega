# Mi Bodega — Sistema de Control de Inventario V1.0

Aplicación web responsive para gestionar inventario, ventas (POS), compras, dashboard y cierre de caja de una bodega.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + React Router |
| Backend | Supabase (Auth + PostgreSQL + RLS) |
| Imágenes | **Cloudinary** (CDN, optimización automática) |

### ¿Por qué Cloudinary y no Supabase Storage?

Para fotos de productos, Cloudinary es mejor opción:
- Redimensiona y optimiza automáticamente (WebP, compresión)
- CDN global = carga rápida en celular
- Plan gratuito suficiente para una bodega (~25 GB/mes)
- Supabase Storage queda reservado para documentos/PDFs si los necesitas después

## Inicio rápido

### 1. Clonar e instalar

```bash
cd e:\WEBS\BODEGA
npm install
cp .env.example .env
```

### 2. Configurar Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ir a **SQL Editor** y ejecutar el contenido de `supabase/schema.sql`
3. Ir a **Authentication > Users** y crear el primer usuario (dueña)
4. En **Table Editor > perfiles**, cambiar el rol a `duena`:

```sql
UPDATE perfiles SET rol = 'duena', puede_backdate = true WHERE id = 'UUID-DEL-USUARIO';
```

5. Copiar **Project URL** y **anon key** al archivo `.env`

### 3. Configurar Cloudinary

1. Crear cuenta en [cloudinary.com](https://cloudinary.com)
2. Ir a **Settings > Upload > Upload presets**
3. Crear preset:
   - Name: `bodega_productos`
   - Signing Mode: **Unsigned**
   - Folder: `bodega/productos`
4. Copiar **Cloud name** y el nombre del preset al `.env`

### 4. Ejecutar

```bash
npm run dev
```

Abrir [http://localhost:5173](http://localhost:5173)

## Estructura del proyecto

```
src/
├── components/     # Layout, rutas protegidas
├── contexts/       # AuthContext (roles)
├── lib/            # Supabase, Cloudinary, utilidades
├── pages/          # Login, Dashboard, Productos, POS…
└── types/          # Tipos TypeScript
supabase/
└── schema.sql      # Esquema completo de BD + RLS
```

## Roles

| Rol | Acceso |
|-----|--------|
| `duena` / `admin` | Todo: dashboard, productos, compras, reportes, POS |
| `cajero` | Solo POS y cierre de caja (sin ver costos ni márgenes) |

## Fórmula de margen

```
Precio Venta = Costo / (1 - Margen% / 100)
Ejemplo: Costo S/10, margen 30% → PV = 10 / 0.7 = S/14.29
```

## Roadmap V1.0

- [x] Auth + roles + layout responsive
- [x] CRUD productos con margen automático
- [x] Upload imágenes Cloudinary
- [ ] Punto de venta completo (carrito, pagos, devoluciones)
- [ ] Módulo de compras
- [ ] Dashboard con gráficos (Recharts)
- [ ] Cierre de caja diario
- [ ] Reportes PDF/Excel

## Deploy

- **Frontend:** Vercel o Netlify (conectar repo GitHub)
- **Backend:** Supabase Cloud (ya incluido)
- **Imágenes:** Cloudinary Cloud (ya incluido)
