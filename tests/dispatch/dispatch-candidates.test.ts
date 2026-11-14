
import { describe, it, expect } from "vitest";

import { generateCandidates } from "../../src/modules/dispatch/dispatch.candidates.js";

import type {
  EligibleDriver,
  EligibleVehicle
} from "../../src/modules/dispatch/dispatch.types.js";

describe("Dispatch Candidate Generation", () => {
  const drivers: EligibleDriver[] = [
    { id: "driver-A", name: "Driver A" },
    { id: "driver-B", name: "Driver B" }
  ];

  const vehicles: EligibleVehicle[] = [
    { id: "vehicle-X", capacityKg: 100 },
    { id: "vehicle-Y", capacityKg: 500 },
    { id: "vehicle-Z", capacityKg: 1000 }
  ];

  const driverWorkloads = new Map([
    ["driver-A", 2],
    ["driver-B", 5]
  ]);

  const vehicleWorkloads = new Map([
    ["vehicle-X", 3],
    ["vehicle-Y", 4],
    ["vehicle-Z", 1]
  ]);

  it("generates every driver-vehicle combination", () => {
    const candidates = generateCandidates(
      drivers,
      vehicles,
      driverWorkloads,
      vehicleWorkloads
    );

    expect(candidates).toHaveLength(6);
  });

  it("assigns the correct driver and vehicle details", () => {
    const candidates = generateCandidates(
      drivers,
      vehicles,
      driverWorkloads,
      vehicleWorkloads
    );

    expect(candidates[0]).toEqual({
      driverId: "driver-A",
      driverName: "Driver A",
      vehicleId: "vehicle-X",
      vehicleCapacityKg: 100,
      driverCompletedDeliveries: 2,
      vehicleCompletedDeliveries: 3
    });
  });

  it("uses zero workload when no workload entry exists", () => {
    const candidates = generateCandidates(
      drivers,
      vehicles,
      new Map(),
      new Map()
    );

    expect(candidates[0].driverCompletedDeliveries).toBe(0);
    expect(candidates[0].vehicleCompletedDeliveries).toBe(0);
  });

  it("returns an empty array when no drivers are eligible", () => {
    expect(
      generateCandidates(
        [],
        vehicles,
        driverWorkloads,
        vehicleWorkloads
      )
    ).toEqual([]);
  });

  it("returns an empty array when no vehicles are eligible", () => {
    expect(
      generateCandidates(
        drivers,
        [],
        driverWorkloads,
        vehicleWorkloads
      )
    ).toEqual([]);
  });
});
