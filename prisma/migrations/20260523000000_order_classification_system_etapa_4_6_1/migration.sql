-- ETAPA 4.6.1 — Order Classification System
-- Preserva datos existentes usando RENAME COLUMN en lugar de DROP+ADD

-- 1. Crear el nuevo enum OrderType
CREATE TYPE "OrderType" AS ENUM ('DINE_IN', 'TAKEAWAY', 'DELIVERY');

-- 2. Renombrar tableNumber → reference (preserva todos los datos existentes)
ALTER TABLE "Order" RENAME COLUMN "tableNumber" TO "reference";

-- 3. Hacer reference nullable
ALTER TABLE "Order" ALTER COLUMN "reference" DROP NOT NULL;

-- 4. Agregar deliveryAddress nullable
ALTER TABLE "Order" ADD COLUMN "deliveryAddress" TEXT;

-- 5. Agregar type con default DINE_IN (todos los pedidos existentes quedan como DINE_IN)
ALTER TABLE "Order" ADD COLUMN "type" "OrderType" NOT NULL DEFAULT 'DINE_IN';
