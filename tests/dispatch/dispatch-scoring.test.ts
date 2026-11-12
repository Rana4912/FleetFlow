
import { describe, it, expect } from "vitest";

import {
  scoreCandidate,
  rankCandidates,
  type DispatchCandidate
} from "../../src/modules/dispatch/dispatch.scoring.js";

describe("Dispatch Candidate Scoring", () => {
  const candidateA: DispatchCandidate = {
    driverId: "driver-A",
    driverName: "Driver A",
    vehicleId: "vehicle-A",
    vehicleCapacityKg: 100,
    driverCompletedDeliveries: 2,
    vehicleCompletedDeliveries: 3
  };

  const candidateB: DispatchCandidate = {
    driverId: "driver-B",
    driverName: "Driver B",
    vehicleId: "vehicle-B",
    vehicleCapacityKg: 500,
    driverCompletedDeliveries: 5,
    vehicleCompletedDeliveries: 4
  };

  it("calculates the candidate score correctly", () => {
    const result = scoreCandidate(candidateA, 80);

    expect(result.capacityScore).toBeCloseTo(20);
    expect(result.driverWorkloadScore).toBe(20);
    expect(result.vehicleWorkloadScore).toBe(30);

    expect(result.totalScore).toBeCloseTo(23);
  });

  it("rejects an order with non-positive weight", () => {
    expect(() => scoreCandidate(candidateA, 0))
      .toThrow("Order weight must be positive");
  });

  it("rejects a vehicle with insufficient capacity", () => {
    expect(() => scoreCandidate(candidateA, 150))
      .toThrow("Vehicle capacity is insufficient");
  });

  it("ranks candidates from lowest score to highest", () => {
    const scoredCandidates = [
      scoreCandidate(candidateB, 80),
      scoreCandidate(candidateA, 80)
    ];

    const ranked = rankCandidates(scoredCandidates);

    expect(ranked[0].driverId).toBe("driver-A");
    expect(ranked[1].driverId).toBe("driver-B");

    expect(ranked[0].totalScore)
      .toBeLessThan(ranked[1].totalScore);
  });

  it("does not mutate the original candidate array", () => {
    const candidates = [
      scoreCandidate(candidateB, 80),
      scoreCandidate(candidateA, 80)
    ];

    const originalOrder = candidates.map(c => c.driverId);

    rankCandidates(candidates);

    expect(candidates.map(c => c.driverId))
      .toEqual(originalOrder);
  });
});
