
import type { Request, Response } from "express";

import type {
  GeocodeAddressInput
} from "./location.schema.js";

import { locationService } from "./location.dependencies.js";

export async function geocodeAddressController(
  req: Request,
  res: Response
) {
  const { address } = req.body as GeocodeAddressInput;

  const location = await locationService.geocodeAddress(address);

  res.status(201).json({
    success: true,
    message:
      location.geocodingStatus === "SUCCEEDED"
        ? "Address geocoded successfully"
        : "Address could not be geocoded",
    data: {
      location
    }
  });
}
