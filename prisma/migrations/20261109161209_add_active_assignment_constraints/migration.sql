-- Ensure one active assignment per order.
CREATE UNIQUE INDEX "DeliveryAssignment_active_order_unique"
ON "DeliveryAssignment" ("orderId")
WHERE status = 'ACTIVE';

-- Ensure one active assignment per driver.
CREATE UNIQUE INDEX "DeliveryAssignment_active_driver_unique"
ON "DeliveryAssignment" ("driverId")
WHERE status = 'ACTIVE';

-- Ensure one active assignment per vehicle.
CREATE UNIQUE INDEX "DeliveryAssignment_active_vehicle_unique"
ON "DeliveryAssignment" ("vehicleId")
WHERE status = 'ACTIVE';