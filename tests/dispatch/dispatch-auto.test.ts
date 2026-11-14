
import {
  describe,
  it,
  expect,
  beforeEach,
  vi
} from "vitest";

import { AppError, ResourceConflictError } from "../../src/shared/errors/app-error.js";

const mocks = vi.hoisted(() => ({
  findEligibleResources: vi.fn(),
  getRecentWorkloads: vi.fn(),
  createAssignment: vi.fn()
}));

vi.mock("../../src/modules/dispatch/dispatch.eligibility.js", () => ({
  findEligibleResources: mocks.findEligibleResources
}));

vi.mock("../../src/modules/dispatch/dispatch.workload.js", () => ({
  getRecentWorkloads: mocks.getRecentWorkloads
}));

vi.mock("../../src/modules/assignments/assignment.service.js", () => ({
  createAssignment: mocks.createAssignment
}));

import { autoDispatchOrder } from "../../src/modules/dispatch/dispatch.service.js";

describe("Automatic Dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.findEligibleResources.mockResolvedValue({
      order: {
        id: "order-1",
        status: "CONFIRMED",
        weightKg: 50,
        pickupAddress: "Kolkata",
        deliveryAddress: "New Town",
        deadline: null
      },
      drivers: [
        { id: "driver-1", name: "Driver One" },
        { id: "driver-2", name: "Driver Two" }
      ],
      vehicles: [
        { id: "vehicle-1", capacityKg: 100 }
      ]
    });

    mocks.getRecentWorkloads.mockResolvedValue({
      driverWorkloads: new Map([
        ["driver-1", 0],
        ["driver-2", 10]
      ]),
      vehicleWorkloads: new Map([
        ["vehicle-1", 0]
      ])
    });

    mocks.createAssignment.mockResolvedValue({
      id: "assignment-1",
      orderId: "order-1",
      driverId: "driver-1",
      vehicleId: "vehicle-1",
      status: "ACTIVE"
    });
  });

  it("assigns the highest-ranked candidate", async () => {
    const result = await autoDispatchOrder("order-1");

    expect(mocks.createAssignment).toHaveBeenCalledTimes(1);

    expect(mocks.createAssignment).toHaveBeenCalledWith({
      orderId: "order-1",
      driverId: "driver-1",
      vehicleId: "vehicle-1"
    });

    expect(result.assignment.id).toBe("assignment-1");
    expect(result.attemptedCandidates).toBe(1);
  });

  it("tries the next candidate when the first becomes unavailable", async () => {
    mocks.createAssignment
      .mockRejectedValueOnce(
        new ResourceConflictError("Driver is no longer available")
      )
      .mockResolvedValueOnce({
        id: "assignment-2",
        orderId: "order-1",
        driverId: "driver-2",
        vehicleId: "vehicle-1",
        status: "ACTIVE"
      });

    const result = await autoDispatchOrder("order-1");

    expect(mocks.createAssignment).toHaveBeenCalledTimes(2);

    expect(result.assignment.id).toBe("assignment-2");
    expect(result.assignment.driverId).toBe("driver-2");
    expect(result.attemptedCandidates).toBe(2);
  });

  it("returns conflict when all candidates become unavailable", async () => {
    mocks.createAssignment.mockRejectedValue(
      new ResourceConflictError("Resource unavailable")
    );

    await expect(
      autoDispatchOrder("order-1")
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "All eligible candidates became unavailable. Please retry."
    });

    expect(mocks.createAssignment).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-resource errors", async () => {
    mocks.createAssignment.mockRejectedValue(
      new AppError("Order not found", 404)
    );

    await expect(
      autoDispatchOrder("order-1")
    ).rejects.toThrow("Order not found");

    expect(mocks.createAssignment).toHaveBeenCalledTimes(1);
  });
});
