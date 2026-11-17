
import {
  describe,
  it,
  expect,
  vi,
  beforeEach
} from "vitest";

const {
  findEligibleResourcesMock,
  getRecentWorkloadsMock,
  optimizeMock
} = vi.hoisted(() => ({
  findEligibleResourcesMock: vi.fn(),
  getRecentWorkloadsMock: vi.fn(),
  optimizeMock: vi.fn()
}));

vi.mock("../../src/modules/dispatch/dispatch.eligibility.js", () => ({
  findEligibleResources: findEligibleResourcesMock
}));

vi.mock("../../src/modules/dispatch/dispatch.workload.js", () => ({
  getRecentWorkloads: getRecentWorkloadsMock
}));

vi.mock("../../src/modules/routing/delivery-route-optimization.dependencies.js", () => ({
  deliveryRouteOptimizationService: {
    optimize: optimizeMock
  }
}));

import {
  getDispatchRecommendations
} from "../../src/modules/dispatch/dispatch.service.js";

describe("Dispatch Route Integration", () => {
  const order = {
    id: "order-1",
    status: "CONFIRMED" as const,
    weightKg: 50,
    pickupAddress: "Salt Lake, Kolkata",
    deliveryAddress: "New Town, Kolkata",
    deadline: null,
    pickupLocation: {
      latitude: 22.5726,
      longitude: 88.3639,
      geocodingStatus: "SUCCEEDED" as const
    },
    deliveryLocation: {
      latitude: 22.5800,
      longitude: 88.3700,
      geocodingStatus: "SUCCEEDED" as const
    }
  };

  const routeResult = {
    route: [
      { stopId: "PICKUP", matrixIndex: 0 },
      { stopId: "DELIVERY", matrixIndex: 1 }
    ],
    totalDistanceMeters: 1500,
    totalDurationSeconds: 300
  };

  beforeEach(() => {
    vi.clearAllMocks();

    findEligibleResourcesMock.mockResolvedValue({
      order,
      drivers: [
        { id: "driver-1", name: "Test Driver" }
      ],
      vehicles: [
        { id: "vehicle-1", capacityKg: 100 }
      ]
    });

    getRecentWorkloadsMock.mockResolvedValue({
      driverWorkloads: new Map(),
      vehicleWorkloads: new Map()
    });

    optimizeMock.mockResolvedValue(routeResult);
  });

  it("calculates route when both locations are geocoded", async () => {
    const result = await getDispatchRecommendations("order-1");

    expect(optimizeMock).toHaveBeenCalledWith([
      {
        id: "PICKUP",
        coordinate: {
          latitude: 22.5726,
          longitude: 88.3639
        }
      },
      {
        id: "DELIVERY",
        coordinate: {
          latitude: 22.5800,
          longitude: 88.3700
        }
      }
    ]);

    expect(result.routeEstimate).toEqual(routeResult);
  });

  it("skips routing when pickup coordinates are missing", async () => {
    findEligibleResourcesMock.mockResolvedValue({
      order: {
        ...order,
        pickupLocation: null
      },
      drivers: [],
      vehicles: []
    });

    const result = await getDispatchRecommendations("order-1");

    expect(optimizeMock).not.toHaveBeenCalled();
    expect(result.routeEstimate).toBeNull();
  });

  it("skips routing when delivery geocoding is pending", async () => {
    findEligibleResourcesMock.mockResolvedValue({
      order: {
        ...order,
        deliveryLocation: {
          latitude: null,
          longitude: null,
          geocodingStatus: "PENDING"
        }
      },
      drivers: [],
      vehicles: []
    });

    const result = await getDispatchRecommendations("order-1");

    expect(optimizeMock).not.toHaveBeenCalled();
    expect(result.routeEstimate).toBeNull();
  });

  it("propagates routing provider errors", async () => {
    optimizeMock.mockRejectedValue(
      new Error("Routing provider unavailable")
    );

    await expect(
      getDispatchRecommendations("order-1")
    ).rejects.toThrow("Routing provider unavailable");
  });
});
