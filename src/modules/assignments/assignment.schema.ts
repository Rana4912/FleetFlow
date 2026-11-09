import { z } from "zod";

export const createAssignmentSchema = z.object({
  orderId: z.uuid("Invalid order ID"),
  driverId: z.uuid("Invalid driver ID"),
  vehicleId: z.uuid("Invalid vehicle ID")
}).strict();

export type CreateAssignmentInput = z.infer<
  typeof createAssignmentSchema
>;

export const assignmentParamsSchema = z.object({
  assignmentId: z.uuid("Invalid assignment ID")
});

export const updateAssignmentStatusSchema = z.object({
  status: z.enum([
    "PICKED_UP",
    "IN_TRANSIT",
    "DELIVERED",
    "FAILED"
  ])
}).strict();

export type UpdateAssignmentStatusInput = z.infer<
  typeof updateAssignmentStatusSchema
>;