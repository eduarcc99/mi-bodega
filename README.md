# Mi Bodega — Sistema de Control de Inventario V1.0

Aplicación web responsive para gestionar inventario, ventas (POS), compras, devoluciones, dashboard, cierre de caja y reportes de una bodega en Perú (moneda PEN).

**Producción:** https://mi-bodega-alpha.vercel.app  
**Repositorio:** https://github.com/eduarcc99/mi-bodega

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite 6 + TypeScript + Tailwind CSS 4 + React Router 6 |
| Gráficos | Recharts |
| Backend | Supabase (Auth + PostgreSQL + RLS) |
| Imágenes | Cloudinary (CDN, preset unsigned) |
| Deploy | Vercel + GitHub |

### ¿Por qué Cloudinary?

- Redimensiona y optimiza automáticamente (WebP, compresión)
- CDN global = carga rápida en celular
- Plan gratuito suficiente para una bodega (~25 GB/mes)

---

## Módulos incluidos (V1.0)

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| Login + roles | `/login` | Dueña, admin, cajero |
| Dashboard | `/dashboard` | KPIs, gráficos, alertas de stock y vencimiento |
| Productos | `/productos` | CRUD, imágenes, categorías, margen automático |
| Compras | `/compras` | Registro de compras a proveedores (suma stock) |
| Punto de venta | `/pos` | Carrito, efectivo/Yape, venta genérica, ticket |
| Devoluciones | `/devoluciones` | Devolver ventas, repone stock, afecta caja |
| Cierre de caja | `/cierre-caja` | Efectivo + Yape, gastos del día, conteo final |
| Reportes | `/reportes` | PDF y Excel (ventas, compras, inventario, cierres) |

---

## Reglas de negocio importantes

### Margen y precio
```
Precio Venta = Costo / (1 - Margen% / 100)
Ejemplo: Costo S/10, margen 30% → PV = 10 / 0.7 = S/14.29
```

### Flujo recomendado
1. **Productos** — registrar primero en catálogo  
2. **Compras** — suma stock de productos ya existentes (no crea productos nuevos)  
3. **POS** — vender durante el día  
4. **Devoluciones** — si el cliente devuelve algo  
5. **Cierre de caja** — al final del día, contar efectivo y Yape  

### Ventas netas
Dashboard y reportes de ventas muestran **ventas netas** (ventas − devoluciones del período).  
La devolución cuenta el **día en que se registra** (igual que caja).

### Caja
```
Efectivo esperado = Apertura + Ventas efectivo − Gastos − Devoluciones efectivo
Yape esperado     = Ventas Yape − Devoluciones Yape
```
El Yape va al celular, no al cajón físico.

### Punto de venta
- **Enter** con un solo producto (o nombre exacto) → se agrega al carrito  
- Varios resultados → lista para elegir  
- Sin coincidencias → aviso; **no** abre venta genérica sola  
- **Venta genérica** → solo con el botón explícito del carrito  
- Último producto agregado aparece **arriba** en el carrito  

### Categorías
Desde **Productos → Categorías**: crear, editar margen % o eliminar (ej. Licores, Fiambres).

---

## Roles

| Rol | Acceso |
|-----|--------|
| `duena` / `admin` | Todo: dashboard, productos, compras, reportes, POS, devoluciones, caja |
| `cajero` | POS, devoluciones y cierre de caja (sin costos ni márgenes en productos) |

---

## Instalación local

### 1. Clonar e instalar

```bash
git clone https://github.com/eduarcc99/mi-bodega.git
cd mi-bodega
npm install
cp .env.example .env
```

### 2. Supabase — SQL (en orden)

Ejecutar en **Supabase → SQL Editor**:

| Orden | Archivo | Qué hace |
|-------|---------|----------|
| 1 | `supabase/schema.sql` | Esquema completo + RLS |
| 2 | `supabase/fix-auth-trigger.sql` | Fix registro de usuarios |
| 3 | `supabase/ventas-stock-trigger.sql` | Descuenta stock al vender |
| 4 | `supabase/caja-gastos.sql` | Gastos de caja + columnas cierre |
| 5 | `supabase/devoluciones-trigger.sql` | Devoluciones + repone stock |
| 6 | `supabase/caja-yape.sql` | Conciliación Yape en cierre |

### 3. Supabase — Auth y usuario dueña

1. **Authentication → Users** → crear usuario  
2. Asignar rol dueña:

```sql
UPDATE perfiles SET rol = 'duena', puede_backdate = true WHERE id = 'UUID-DEL-USUARIO';
```

3. **Authentication → URL Configuration** → Site URL: `https://mi-bodega-alpha.vercel.app`

### 4. Variables de entorno

`.env` local y **Vercel → Settings → Environment Variables**:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=bodega_productos
```

### 5. Cloudinary

1. Crear preset **unsigned**: `bodega_productos`  
2. Folder sugerido: `bodega/productos`

### 6. Ejecutar

```bash
npm run dev
```

Abrir http://localhost:5173

---

## Deploy (Vercel)

1. Conectar repo GitHub a Vercel  
2. Configurar variables `VITE_*`  
3. `git push` → deploy automático (~2 min)  
4. Recargar con Ctrl+F5 tras cada deploy  

---

## Estructura del proyecto

```
src/
├── components/       # Layout, rutas, gráficos, ticket POS
├── contexts/         # AuthContext (roles)
├── lib/              # Supabase, Cloudinary, caja, ventas, reportes…
├── pages/            # Pantallas por módulo
└── types/            # Tipos TypeScript
supabase/
├── schema.sql
├── fix-auth-trigger.sql
├── ventas-stock-trigger.sql
├── caja-gastos.sql
├── devoluciones-trigger.sql
└── caja-yape.sql
```

---

## Guía rápida para la dueña

```
URL: https://mi-bodega-alpha.vercel.app
Agregar a pantalla de inicio del celular (Chrome → Instalar / Safari → Añadir a inicio)

CADA DÍA:
  Vender      → Punto de venta
  Devolver    → Devoluciones (últimas 10 ventas visibles)
  Gastos      → Cierre de caja → Anotar gasto
  Al cerrar   → Contar efectivo + revisar Yape en la app
  Ver resumen → Dashboard

POCO A POCO:
  Productos   → ir agregando al catálogo
  Categorías  → Productos → botón Categorías
```

---

## Estado V1.0 — Sistema cerrado

| Funcionalidad | Estado |
|---------------|--------|
| Auth + roles + layout responsive | ✅ |
| CRUD productos + Cloudinary | ✅ |
| Categorías desde la app | ✅ |
| POS (carrito, pagos, genérica, ticket) | ✅ |
| Devoluciones + stock + caja | ✅ |
| Ventas netas en dashboard y reportes | ✅ |
| Cierre caja (efectivo, Yape, gastos) | ✅ |
| Zona horaria Perú en caja | ✅ |
| Compras proveedores | ✅ |
| Dashboard + Recharts | ✅ |
| Reportes PDF/Excel | ✅ |

### Mejoras opcionales V2 (futuro)
- Abrir caja formal (apertura del día)
- Crear producto desde Compras
- Anulación de ventas
- Dominio propio
- PWA offline

---

## Soporte técnico

| Problema | Revisar |
|----------|---------|
| No entra | Usuario en Supabase Auth |
| Imagen no sube | Variables Cloudinary en Vercel |
| Stock no cambia | Triggers SQL en Supabase |
| Caja vacía de noche | Zona horaria (ya corregida en código) |
| Cambios no se ven | `git push` + esperar deploy Vercel |

---

## Licencia

Proyecto privado — uso interno bodega.
