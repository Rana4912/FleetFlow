
import { findEligibleResources } from "./dispatch.eligibility.js";

import { getRecentWorkloads } from "./dispatch.workload.js";

import { generateCandidates } from "./dispatch.candidates.js";

import {
  scoreCandidate,
  rankCandidates
} from "./dispatch.scoring.js";

import type { DispatchOrder } from "./dispatch.types.js";
import type { ScoredCandidate } from "./dispatch.scoring.js";

import { createAssignment } from "../assignments/assignment.service.js";
import { AppError, ResourceConflictError } from "../../shared/errors/app-error.js";
import { deliveryRouteOptimizationService } from "../routing/delivery-route-optimization.dependencies.js";
import type { RouteOptimizationResult } from "../routing/route-optimizer.service.js";

export interface DispatchRecommendationResult {
  order: DispatchOrder;
  candidates: ScoredCandidate[];
  routeEstimate: RouteOptimizationResult | null;
}

export async function getDispatchRecommendations(
  orderId: string
): Promise<DispatchRecommendationResult> {

  // 1. Find eligible resources and validate the order
  const eligibility = await findEligibleResources(orderId);

  // 2. Retrieve recent driver and vehicle workloads
  const workloads = await getRecentWorkloads();

  // 3. Generate all possible combinations
  const candidates = generateCandidates(
    eligibility.drivers,
    eligibility.vehicles,
    workloads.driverWorkloads,
    workloads.vehicleWorkloads
  );

  // 4. Calculate the score for each candidate
  const scoredCandidates = candidates.map(candidate =>
    scoreCandidate(
      candidate,
      eligibility.order.weightKg
    )
  );

  // 5. Rank candidates (lowest score is best)
  const rankedCandidates = rankCandidates(scoredCandidates);

  // 6. Calculate delivery route when both locations are geocoded
  let routeEstimate: RouteOptimizationResult | null = null;

  const pickup = eligibility.order.pickupLocation;
  const delivery = eligibility.order.deliveryLocation;

  if (
    pickup?.geocodingStatus === "SUCCEEDED" &&
    delivery?.geocodingStatus === "SUCCEEDED" &&
    pickup.latitude !== null &&
    pickup.longitude !== null &&
    delivery.latitude !== null &&
    delivery.longitude !== null
  ) {
    routeEstimate = await deliveryRouteOptimizationService.optimize([
      {
        id: "PICKUP",
        coordinate: {
          latitude: pickup.latitude,
          longitude: pickup.longitude
        }
      },
      {
        id: "DELIVERY",
        coordinate: {
          latitude: delivery.latitude,
          longitude: delivery.longitude
        }
      }
    ]);
  }

  return {
    order: eligibility.order,
    candidates: rankedCandidates,
    routeEstimate
  };
}


export async function autoDispatchOrder(orderId: string) {
  const recommendations = await getDispatchRecommendations(orderId);

  if (recommendations.candidates.length === 0) {
    throw new AppError(
      "No eligible driver and vehicle combinations found",
      409
    );
  }

  let attemptedCandidates = 0;

  for (const candidate of recommendations.candidates) {
    attemptedCandidates++;

    try {
      const assignment = await createAssignment({
        orderId,
        driverId: candidate.driverId,
        vehicleId: candidate.vehicleId
      });

      return {
        order: recommendations.order,
        assignment,
        selectedCandidate: candidate,
        attemptedCandidates
      };
    } catch (error) {
      if (error instanceof ResourceConflictError) {
        continue;
      }

      throw error;
    }
  }

  throw new AppError(
    "All eligible candidates became unavailable. Please retry.",
    409
  );
}