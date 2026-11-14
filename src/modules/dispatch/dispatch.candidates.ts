
import type {
  EligibleDriver,
  EligibleVehicle
} from "./dispatch.types.js";

import type {
  DispatchCandidate
} from "./dispatch.scoring.js";

export function generateCandidates(
  drivers: EligibleDriver[],
  vehicles: EligibleVehicle[],
  driverWorkloads: ReadonlyMap<string, number>,
  vehicleWorkloads: ReadonlyMap<string, number>
): DispatchCandidate[] {
  return drivers.flatMap(driver =>
    vehicles.map(vehicle => ({
      driverId: driver.id,
      driverName: driver.name,
      vehicleId: vehicle.id,
      vehicleCapacityKg: vehicle.capacityKg,

      driverCompletedDeliveries:
        driverWorkloads.get(driver.id) ?? 0,

      vehicleCompletedDeliveries:
        vehicleWorkloads.get(vehicle.id) ?? 0
    }))
  );
}
