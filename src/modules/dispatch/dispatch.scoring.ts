
export interface DispatchCandidate {
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehicleCapacityKg: number;
  driverCompletedDeliveries: number;
  vehicleCompletedDeliveries: number;
}

export interface ScoredCandidate extends DispatchCandidate {
  capacityScore: number;
  driverWorkloadScore: number;
  vehicleWorkloadScore: number;
  totalScore: number;
}

export function scoreCandidate(
  candidate: DispatchCandidate,
  orderWeightKg: number
): ScoredCandidate {
  if (orderWeightKg <= 0) {
    throw new Error("Order weight must be positive");
  }

  if (candidate.vehicleCapacityKg < orderWeightKg) {
    throw new Error("Vehicle capacity is insufficient");
  }

  const capacityScore =
    (1 - orderWeightKg / candidate.vehicleCapacityKg) * 100;

  const MAX_WORKLOAD_DELIVERIES = 10;

  const driverWorkloadScore = Math.min(
    candidate.driverCompletedDeliveries / MAX_WORKLOAD_DELIVERIES,
    1
  ) * 100;

  const vehicleWorkloadScore = Math.min(
    candidate.vehicleCompletedDeliveries / MAX_WORKLOAD_DELIVERIES,
    1
  ) * 100;
  const totalScore =
    capacityScore * 0.4 +
    driverWorkloadScore * 0.3 +
    vehicleWorkloadScore * 0.3;

  return {
    ...candidate,
    capacityScore,
    driverWorkloadScore,
    vehicleWorkloadScore,
    totalScore
  };
}

export function rankCandidates(
  candidates: ScoredCandidate[]
): ScoredCandidate[] {
  return [...candidates].sort(
    (a, b) => a.totalScore - b.totalScore
  );
}
