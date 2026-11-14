
import { prisma } from "../../infrastructure/database/prisma.js";

export interface DispatchWorkloads {
  driverWorkloads: Map<string, number>;
  vehicleWorkloads: Map<string, number>;
}

const WORKLOAD_WINDOW_DAYS = 7;

export async function getRecentWorkloads(
  since: Date = new Date(
    Date.now() - WORKLOAD_WINDOW_DAYS * 24 * 60 * 60 * 1000
  )
): Promise<DispatchWorkloads> {
  const [driverCounts, vehicleCounts] = await Promise.all([
    prisma.deliveryAssignment.groupBy({
      by: ["driverId"],
      where: {
        status: "COMPLETED",
        releasedAt: { gte: since }
      },
      _count: {
        _all: true
      }
    }),

    prisma.deliveryAssignment.groupBy({
      by: ["vehicleId"],
      where: {
        status: "COMPLETED",
        releasedAt: { gte: since }
      },
      _count: {
        _all: true
      }
    })
  ]);

  const driverWorkloads = new Map<string, number>(
    driverCounts.map(item => [
      item.driverId,
      item._count._all
    ])
  );

  const vehicleWorkloads = new Map<string, number>(
    vehicleCounts.map(item => [
      item.vehicleId,
      item._count._all
    ])
  );

  return {
    driverWorkloads,
    vehicleWorkloads
  };
}
