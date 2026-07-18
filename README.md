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
- Productos **kg/litro** → modal para ingresar cantidad (no se agrega 1 solo)  
- **Venta mixta** (ej. tomate): por peso (balanza) o por unidad suelta con precio fijo  

### Venta mixta (kg + unidad suelta)
Para productos vendidos por peso que también se venden sueltos (tomate, etc.):

| Campo en producto | Significado |
|-------------------|-------------|
| Costo / precio catálogo | Por **kg** |
| Precio por unidad | Cobro por pieza suelta (S/) |
| Peso estimado por unidad | Cuántos kg descuenta del stock por cada pieza |

En POS el cajero elige **por peso** o **por unidad**. El stock siempre se descuenta en kg.  
En devoluciones, las ventas por unidad se devuelven en **piezas**.

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
| 7 | `supabase/venta-mixta.sql` | Venta por peso + unidad suelta (tomate) |

**Opcional** (solo para vaciar datos de prueba, no borra usuarios ni categorías):  
`supabase/cleanup-prueba.sql`

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
├── caja-yape.sql
├── venta-mixta.sql
└── cleanup-prueba.sql
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

## Web Push — alertas con app cerrada o en redes

Cuando un cliente pide en `/marghot`, el celular del staff recibe notificación **aunque Mi Bodega esté cerrada o estés en otra app** (Instagram, WhatsApp, etc.).

### Configuración (una vez)

1. **SQL** en Supabase → ejecutar `supabase/push-notificaciones-web.sql`
2. **Claves VAPID** (en tu PC):
   ```bash
   npx web-push generate-vapid-keys
   ```
3. **Vercel** → Environment Variables:
   - `VITE_VAPID_PUBLIC_KEY` = clave pública
4. **Supabase** → Edge Functions → Secrets:
   - `VAPID_PUBLIC_KEY` = clave pública
   - `VAPID_PRIVATE_KEY` = clave privada
   - `PUSH_WEBHOOK_SECRET` = string aleatorio largo
5. **Desplegar función** (con [Supabase CLI](https://supabase.com/docs/guides/cli)):
   ```bash
   supabase link --project-ref wreplfrezxnhlvtpkxxq
   supabase functions deploy notify-pedido-web --no-verify-jwt
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... PUSH_WEBHOOK_SECRET=...
   ```
6. **Database Webhook** (Supabase Dashboard → Database → Webhooks):
   - Tabla: `pedidos_web` · Evento: **INSERT**
   - Destino: Edge Function `notify-pedido-web`
   - Header opcional: `x-webhook-secret` = mismo `PUSH_WEBHOOK_SECRET`

### En el celular del dueño/cajero

1. Instalar PWA (Agregar a pantalla de inicio)
2. Pedidos web → **Activar** notificaciones
3. Debe aparecer: **「Push (app cerrada / en redes)」**
4. Probar: pedido desde otro celular en `/marghot` con Mi Bodega cerrada

> El timbre de 3 s solo suena con la app abierta. Con app cerrada suena el **tono del sistema** de la notificación push.

---

## Estado V1.0 — Sistema cerrado

| Funcionalidad | Estado |
|---------------|--------|
| Auth + roles + layout responsive | ✅ |
| CRUD productos + Cloudinary | ✅ |
| Categorías desde la app | ✅ |
| POS (carrito, pagos, genérica, ticket) | ✅ |
| Venta mixta kg + unidad suelta | ✅ |
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
| Push no llega cerrada | Ver sección Web Push: SQL, secrets, webhook, `VITE_VAPID_PUBLIC_KEY` en Vercel |

---

## Licencia

Proyecto privado — uso interno bodega.
