import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";

import type {
  DispatchEligibilityResult
} from "./dispatch.types.js";

export async function findEligibleResources(
  orderId: string
): Promise<DispatchEligibilityResult> {

  // 1. Find the order
  const order = await prisma.deliveryOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      weightKg: true,
      pickupAddress: true,
      deliveryAddress: true,
      deadline: true
    }
  });

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  // 2. Only confirmed orders can enter dispatch
  if (order.status !== "CONFIRMED") {
    throw new AppError(
      "Only confirmed orders can be dispatched",
      409
    );
  }

  // 3. Find eligible drivers and vehicles
  const [drivers, vehicles] = await Promise.all([

    prisma.driver.findMany({
      where: {
        status: "AVAILABLE",

        user: {
          is: {
            isActive: true
          }
        },

        assignments: {
          none: {
            status: "ACTIVE"
          }
        }
      },
      select: {
        id: true,
        user: {
          select: {
            name: true
          }
        }
      }
    }),

    prisma.vehicle.findMany({
      where: {
        status: "AVAILABLE",

        capacityKg: {
          gte: order.weightKg
        },

        assignments: {
          none: {
            status: "ACTIVE"
          }
        }
      },
      select: {
        id: true,
        capacityKg: true
      }
    })

  ]);

  // 4. Return the eligible resources
  return {
    order: {
      id: order.id,
      status: "CONFIRMED",
      weightKg: Number(order.weightKg),
      pickupAddress: order.pickupAddress,
      deliveryAddress: order.deliveryAddress,
      deadline: order.deadline
    },

    drivers: drivers.map((driver) => ({
      id: driver.id,
      name: driver.user.name
    })),

    vehicles: vehicles.map((vehicle) => ({
      id: vehicle.id,
      capacityKg: Number(vehicle.capacityKg)
    }))
  };
}