# TacosManager - Reglas de Negocio

Versión: 1.0
Estado: Backend NestJS + Prisma + PostgreSQL
Última actualización: Etapa 4.2 (Kitchen Queue Logic)

---

# 1. Descripción General

TacosManager es una plataforma SaaS multi-taquería diseñada para administrar:

- Catálogo de productos
- Pedidos
- Cocina
- Historial de órdenes
- Operación diaria de meseros y cocineros

La plataforma permite que múltiples taquerías operen simultáneamente de forma aislada utilizando arquitectura multi-tenant.

---

# 2. Arquitectura Multi-Tenant

## Principio General

Toda la información pertenece a una taquería.

Ningún usuario puede acceder a información de otra taquería.

---

## Entidad Taquería

Cada taquería posee:

- id
- name
- restaurantCode

---

## restaurantCode

Es el identificador único real de una taquería.

Ejemplos:

- TQR-4821
- TM-9182
- TACO-1832

Reglas:

- Debe ser único
- Se genera automáticamente
- No puede modificarse manualmente

---

## Nombre de Taquería

Reglas:

- Pueden existir múltiples taquerías con el mismo nombre
- El nombre NO es un identificador único
- El restaurantCode es el identificador oficial

Ejemplo válido:

Taquería El Güero
- TQR-1111

Taquería El Güero
- TQR-2222

---

# 3. Usuarios

## Roles

### COOK

Puede:

- Ver todos los pedidos de la taquería
- Cambiar estados de pedidos
- Gestionar cocina
- Ver historial completo

No puede:

- Acceder a otras taquerías

---

### WAITER

Puede:

- Crear pedidos
- Consultar sus pedidos
- Editar pedidos propios

No puede:

- Ver pedidos de otros meseros
- Cambiar estados de cocina
- Acceder a otras taquerías

---

# 4. Registro Inteligente

## Flujo General

El frontend solicita:

- name
- email
- password
- role
- taqueriaName

---

## Escenario 1

### No existen coincidencias

Respuesta:

- Permitir crear nueva taquería

---

## Escenario 2

### Existe una coincidencia

Respuesta:

- Permitir unirse
- Permitir crear una nueva taquería con el mismo nombre

---

## Escenario 3

### Existen múltiples coincidencias

Respuesta:

- Mostrar lista de coincidencias
- Permitir seleccionar una
- Permitir crear una nueva

---

# 5. Productos

## Product

Campos principales:

- id
- name
- price
- complements
- taqueriaId

---

## Reglas

Todos los productos pertenecen a una taquería.

Los usuarios sólo pueden consultar productos de su propia taquería.

---

## Complementos

Máximo:

3 complementos por producto.

---

# 6. Pedidos

---

## Order

Representa una orden completa.

Contiene:

- waiter
- taquería
- plates
- status
- revision
- priorityTimestamp

---

## tableNumber

Representa el identificador visual de la orden.

No necesariamente es numérico.

Ejemplos válidos:

- Mesa 1
- Mesa Juanita
- Barra 3
- Terraza
- Uber Eats
- Pedido Rappi

Reglas:

- Obligatorio
- String
- No vacío

---

# 7. Plates

Representan agrupaciones visuales dentro de una orden.

Ejemplo:

PLATE 1
- Taco Pastor
- Taco Asada

PLATE 2
- Quesadilla
- Horchata

---

Campos:

- id
- orderId
- plateNumber
- isClosed
- createdInRevision

---

# 8. Items

Representan productos individuales.

Campos:

- id
- plateId
- productId
- quantity
- selectedComplements
- notes
- isNew
- createdInRevision

---

## Notes

Las notas son opcionales.

Ejemplos válidos:

```json
{
  "notes": ""
}
```

```json
{
}
```

```json
{
  "notes": "Sin salsa"
}
```

---

# 9. Historial

Los pedidos nunca deben eliminarse físicamente.

Objetivos:

- Auditoría
- Historial
- Reportes
- Estadísticas futuras

---

# 10. Regla Crítica de Edición

## Append Only Editing

Los pedidos NO se modifican.

Los pedidos se amplían.

---

## Permitido

Agregar:

- Nuevos plates
- Nuevos items

---

## Prohibido

Modificar:

- Plates existentes
- Items existentes
- Cantidades anteriores
- Productos anteriores

---

Ejemplo:

Pedido original:

PLATE 1
- Taco Pastor
- Taco Asada

Cliente pide más:

PLATE 2
- Quesadilla
- Horchata

PLATE 1 permanece intacto.

---

# 11. Revisions

Cada pedido posee:

revision

---

Pedido nuevo:

revision = 1

---

Primera actualización:

revision = 2

---

Segunda actualización:

revision = 3

---

Objetivo:

- Trazabilidad
- Realtime futuro
- Auditoría

---

# 12. createdInRevision

Permite identificar cuándo apareció un plate o item.

Ejemplo:

PLATE 1

createdInRevision = 1

---

PLATE 2

createdInRevision = 2

---

# 13. Estados de Pedido

Estados válidos:

- UPDATED
- PENDING
- PREPARING
- READY
- DELIVERED
- CANCELLED

---

## PENDING

Pedido recién creado.

---

## UPDATED

Pedido previamente existente que recibió nuevos plates/items.

Tiene máxima prioridad para cocina.

---

## PREPARING

Pedido en preparación.

---

## READY

Pedido terminado.

---

## DELIVERED

Pedido entregado.

---

## CANCELLED

Pedido cancelado.

---

# 14. Prioridad de Cocina

Prioridades globales:

1. UPDATED
2. PENDING
3. PREPARING
4. READY
5. DELIVERED
6. CANCELLED

---

# 15. Cola FIFO

Dentro de cada grupo se utiliza FIFO.

First In First Out.

---

Ejemplo:

Pedido A 12:00

Pedido B 12:05

Resultado:

Pedido A

Pedido B

---

# 16. Prioridad de Pedidos Actualizados

Los pedidos actualizados siempre tienen prioridad sobre pedidos pendientes.

Ejemplo:

Pedido A → PENDING

Pedido B → PENDING

Pedido C → UPDATED

Resultado:

Pedido C

Pedido A

Pedido B

---

# 17. priorityTimestamp

Campo utilizado para:

- Reordenamiento
- Priorización
- Realtime futuro

Debe actualizarse cuando:

- Se crea una orden
- Se agregan nuevos plates
- Se agregan nuevos items

---

# 18. Highlight Verde

Los nuevos productos agregados en actualizaciones deben mostrarse en verde.

---

## Activación

Cuando se agregan nuevos items:

isNew = true

---

## Permanencia

El color verde permanece durante:

- UPDATED
- PREPARING

---

## Eliminación

El color verde desaparece únicamente cuando:

- READY

---

Al pasar a READY:

isNew = false

---

# 19. Seguridad

Todos los endpoints deben validar:

- JWT
- Ownership
- Multi-tenant
- Roles

---

## Un mesero no puede

- Cambiar estados
- Ver pedidos ajenos
- Ver información de otra taquería

---

## Un cocinero no puede

- Acceder a otra taquería

---

# 20. Realtime — Reglas de Conexión WebSocket

## Autenticación WebSocket

El token JWT utilizado en REST es el mismo que se usa en WebSocket.

El token debe enviarse en el handshake:

```txt
socket.handshake.auth.token = "<jwt>"
```

O bien:

```txt
Authorization: Bearer <jwt>
```

JWT inválido o ausente → conexión rechazada.

---

## Rooms Multi-Tenant

Cada taquería tiene su propia room:

```txt
taqueria:<taqueriaId>
```

Reglas:

- Todos los usuarios de la misma taquería comparten room.
- Un usuario nunca puede unirse a la room de otra taquería.
- El `taqueriaId` de la room proviene exclusivamente del JWT (nunca del cliente).

---

## Aislamiento de Eventos

Los eventos de negocio se emiten únicamente a la room de la taquería correspondiente.

Un cocinero o mesero solo recibe eventos de su propia taquería.

---

## Eventos Disponibles

- `connection` — validación JWT + join room automático
- `disconnect` — limpieza de conexión
- `join-taqueria` — confirmación de room activa
- `order-created` — orden nueva creada (emitido tras POST /orders)
- `order-updated` — orden actualizada con Append Only (emitido tras PATCH /orders/:id)
- `order-status-changed` — estado de orden cambiado (emitido tras PATCH /orders/:id/status)

---

# 21. Reglas de Sincronización Realtime

## Persistencia antes de Emisión

El orden es invariante:

```txt
1. Guardar en PostgreSQL
2. Confirmar persistencia
3. Emitir evento WebSocket
```

Nunca emitir antes de confirmar que la BD tiene el dato.

## Propagación de Cambios

Cuando un WAITER crea un pedido:

- El pedido se persiste en BD.
- `order-created` se emite a toda la room de la taquería.
- Cocina y meseros conectados reciben el evento inmediatamente.

Cuando un WAITER actualiza un pedido (Append Only):

- Los nuevos plates/items se persisten en BD.
- El status cambia a `UPDATED` automáticamente.
- La revisión se incrementa.
- Los nuevos items tienen `isNew: true`.
- `order-updated` se emite a toda la room de la taquería.

Cuando un COOK cambia el estado:

- El nuevo status se persiste en BD.
- Si el nuevo status es `READY`, todos los `isNew: true` se limpian en la misma transacción antes de emitir.
- `order-status-changed` se emite a toda la room de la taquería.

## Sincronización Cocina

El COOK recibe en tiempo real:

- Nuevas órdenes creadas por cualquier mesero de la taquería.
- Órdenes actualizadas (items nuevos en highlight verde via `isNew`).
- Confirmación de sus propios cambios de estado.

## Sincronización Meseros

El WAITER recibe en tiempo real:

- Cambios de estado de sus propias órdenes (el COOK las actualiza).
- Actualizaciones de otros meseros de la misma taquería.

## Receptor de Eventos

Todos los usuarios conectados a la room de la taquería reciben todos los eventos.

El backend **no filtra por rol** — el frontend decide qué hacer con cada evento.

## Payload Completo

Todos los eventos emiten la orden completa con plates e items.

El frontend puede actualizar su estado local sin realizar llamadas REST adicionales.

## Fallo de Emisión

Si Socket.IO falla al emitir un evento:

- La transacción de BD **no se revierte**.
- La respuesta REST al cliente es exitosa.
- El error se registra en Logger.

La persistencia en BD tiene prioridad absoluta sobre la emisión WebSocket.

---

# 22. Principios Arquitectónicos

Mantener siempre:

- NestJS modular
- PrismaService Singleton
- DTOs tipados
- ValidationPipe
- TypeScript estricto
- Sin any
- Ownership centralizado
- Arquitectura multi-tenant
- Seguridad por roles
- Source of Truth en Backend

---

# Fin del Documento