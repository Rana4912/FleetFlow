

import { GeoapifyProvider } from "../../infrastructure/geocoding/geoapify.provider.js";
import { LocationService } from "./location.service.js";

const geocodingProvider = new GeoapifyProvider();

export const locationService = new LocationService(geocodingProvider);
