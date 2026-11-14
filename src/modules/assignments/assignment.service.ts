
import { prisma } from "../../infrastructure/database/prisma.js";
import {
  AppError,
  ResourceConflictError
} from "../../shared/errors/app-error.js";
import type { CreateAssignmentInput } from "./assignment.schema.js";
import type { UpdateAssignmentStatusInput } from "./assignment.schema.js";


export async function createAssignment(input: CreateAssignmentInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Verify that the order exists and is CONFIRMED.
      const order = await tx.deliveryOrder.findUnique({
        where: { id: input.orderId },
        select: {
          id: true,
          status: true,
          weightKg: true
        }
      });

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      if (order.status !== "CONFIRMED") {
        throw new AppError(
          "Only confirmed orders can be assigned",
          409
        );
      }

      // 2. Verify that the driver exists.
      const driver = await tx.driver.findUnique({
        where: { id: input.driverId },
        select: {
          id: true,
          status: true,
          user: {
            select: {
              isActive: true
            }
          }
        }
      });

      if (!driver) {
        throw new AppError("Driver not found", 404);
      }

      if (!driver.user.isActive) {
        throw new ResourceConflictError("Driver account is inactive");
      }

      if (driver.status !== "AVAILABLE") {
        throw new ResourceConflictError("Driver is not available");
      }

      // 3. Atomically claim the driver.
      const driverClaim = await tx.driver.updateMany({
        where: {
          id: input.driverId,
          status: "AVAILABLE"
        },
        data: {
          status: "ON_DELIVERY"
        }
      });

      if (driverClaim.count !== 1) {
        throw new ResourceConflictError(
          "Driver is no longer available. Please retry."
        );
      }

      // 4. Verify that the vehicle exists.
      const vehicle = await tx.vehicle.findUnique({
        where: { id: input.vehicleId },
        select: {
          id: true,
          status: true,
          capacityKg: true
        }
      });

      if (!vehicle) {
        throw new AppError("Vehicle not found", 404);
      }

      if (vehicle.status !== "AVAILABLE") {
        throw new ResourceConflictError("Vehicle is not available");
      }

      // 5. Verify vehicle capacity.
      if (vehicle.capacityKg.lessThan(order.weightKg)) {
        throw new ResourceConflictError(
          "Vehicle capacity is insufficient for this order"
        );
      }

      // 6. Atomically claim the vehicle.
      const vehicleClaim = await tx.vehicle.updateMany({
        where: {
          id: input.vehicleId,
          status: "AVAILABLE",
          capacityKg: {
            gte: order.weightKg
          }
        },
        data: {
          status: "IN_USE"
        }
      });

      if (vehicleClaim.count !== 1) {
        throw new ResourceConflictError(
          "Vehicle is no longer available or has insufficient capacity"
        );
      }

      // 7. Atomically change the order status.
      const orderUpdate = await tx.deliveryOrder.updateMany({
        where: {
          id: input.orderId,
          status: "CONFIRMED"
        },
        data: {
          status: "ASSIGNED"
        }
      });

      if (orderUpdate.count !== 1) {
        throw new AppError(
          "Order status changed during assignment. Please retry.",
          409
        );
      }

      // 8. Create the active assignment.
      const assignment = await tx.deliveryAssignment.create({
        data: {
          orderId: input.orderId,
          driverId: input.driverId,
          vehicleId: input.vehicleId
        },
        select: {
          id: true,
          orderId: true,
          driverId: true,
          vehicleId: true,
          status: true,
          assignedAt: true
        }
      });

      // 9. Record the order status transition.
      await tx.orderStatusHistory.create({
        data: {
          orderId: input.orderId,
          status: "ASSIGNED",
          note: "Order assigned to a driver and vehicle"
        }
      });

      return assignment;
    });
  } catch (error) {
    // PostgreSQL partial unique index violation.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new ResourceConflictError(
        "Order, driver, or vehicle already has an active assignment"
      );
    }

    throw error;
  }
}

export async function updateAssignmentStatus(
  assignmentId: string,
  userId: string,
  input: UpdateAssignmentStatusInput
) {
  return prisma.$transaction(async (tx) => {
    // 1. Find the driver's profile.
    const driver = await tx.driver.findUnique({
      where: { userId },
      select: { id: true }
    });

    if (!driver) {
      throw new AppError("Driver profile not found", 404);
    }

    // 2. Find an active assignment belonging to this driver.
    const assignment = await tx.deliveryAssignment.findFirst({
      where: {
        id: assignmentId,
        driverId: driver.id,
        status: "ACTIVE"
      },
      select: {
        id: true,
        driverId: true,
        vehicleId: true,
        order: {
          select: {
            id: true,
            status: true
          }
        }
      }
    });

    if (!assignment) {
      throw new AppError("Active assignment not found", 404);
    }

    // 3. Define permitted delivery transitions.
    const allowedTransitions: Record<string, string[]> = {
      ASSIGNED: ["PICKED_UP"],
      PICKED_UP: ["IN_TRANSIT", "FAILED"],
      IN_TRANSIT: ["DELIVERED", "FAILED"]
    };

    const allowed = allowedTransitions[
      assignment.order.status
    ] ?? [];

    if (!allowed.includes(input.status)) {
      throw new AppError(
        `Cannot change order status from ${assignment.order.status} to ${input.status}`,
        409
      );
    }

    // 4. Atomically update the order.
    const orderUpdate = await tx.deliveryOrder.updateMany({
      where: {
        id: assignment.order.id,
        status: assignment.order.status
      },
      data: {
        status: input.status
      }
    });

    if (orderUpdate.count !== 1) {
      throw new AppError(
        "Order status changed concurrently. Please retry.",
        409
      );
    }

    // 5. Record order status history.
    await tx.orderStatusHistory.create({
      data: {
        orderId: assignment.order.id,
        status: input.status,
        note: `Driver changed order status from ${assignment.order.status} to ${input.status}`
      }
    });

    // 6. Release resources when delivery reaches a terminal state.
    const isTerminal =
      input.status === "DELIVERED" ||
      input.status === "FAILED";

    if (isTerminal) {
      const assignmentUpdate =
        await tx.deliveryAssignment.updateMany({
          where: {
            id: assignment.id,
            status: "ACTIVE"
          },
          data: {
            status: "COMPLETED",
            releasedAt: new Date()
          }
        });

      if (assignmentUpdate.count !== 1) {
        throw new AppError(
          "Assignment is no longer active. Please retry.",
          409
        );
      }

      const driverUpdate = await tx.driver.updateMany({
        where: {
          id: assignment.driverId,
          status: "ON_DELIVERY"
        },
        data: {
          status: "AVAILABLE"
        }
      });

      if (driverUpdate.count !== 1) {
        throw new AppError(
          "Driver state is inconsistent. Assignment could not be completed.",
          409
        );
      }

      const vehicleUpdate = await tx.vehicle.updateMany({
        where: {
          id: assignment.vehicleId,
          status: "IN_USE"
        },
        data: {
          status: "AVAILABLE"
        }
      });

      if (vehicleUpdate.count !== 1) {
        throw new AppError(
          "Vehicle state is inconsistent. Assignment could not be completed.",
          409
        );
      }
    }

    // 7. Return updated assignment and order.
    const updatedAssignment =
      await tx.deliveryAssignment.findUniqueOrThrow({
        where: { id: assignment.id },
        select: {
          id: true,
          orderId: true,
          driverId: true,
          vehicleId: true,
          status: true,
          assignedAt: true,
          releasedAt: true
        }
      });

    const updatedOrder =
      await tx.deliveryOrder.findUniqueOrThrow({
        where: { id: assignment.order.id },
        select: {
          id: true,
          status: true,
          updatedAt: true
        }
      });

    return {
      assignment: updatedAssignment,
      order: updatedOrder
    };
  });
}
