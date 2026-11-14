export interface DispatchOrder {
  id: string;
  status: "CONFIRMED";
  weightKg: number;
  pickupAddress: string;
  deliveryAddress: string;
  deadline: Date | null;
}

export interface EligibleDriver {
  id: string;
  name: string;
}

export interface EligibleVehicle {
  id: string;
  capacityKg: number;
}

export interface DispatchEligibilityResult {
  order: DispatchOrder;
  drivers: EligibleDriver[];
  vehicles: EligibleVehicle[];
}