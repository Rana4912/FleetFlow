
import {
  describe,
  it,
  expect,
  vi
} from "vitest";

import { RouteMatrixService } from "../../src/modules/routing/route-matrix.service.js";
import { AppError } from "../../src/shared/errors/app-error.js";

import type {
  RouteMatrixProvider,
  RouteMatrixRequest,
  RouteMatrixResult
} from "../../src/infrastructure/routing/routing.types.js";

describe("RouteMatrixService", () => {
  const sources = [
    { latitude: 22.5726, longitude: 88.3639 },
    { latitude: 22.6000, longitude: 88.4000 }
  ];

  const targets = [
    { latitude: 22.6200, longitude: 88.4500 },
    { latitude: 22.5500, longitude: 88.3500 }
  ];

  const matrixResult: RouteMatrixResult = {
    sources,
    targets,
    provider: "MOCK",
    matrix: [
      [
        { distanceMeters: 12000, durationSeconds: 1800 },
        { distanceMeters: 5000, durationSeconds: 600 }
      ],
      [
        { distanceMeters: 8000, durationSeconds: 900 },
        { distanceMeters: null, durationSeconds: null }
      ]
    ]
  };

  const createProvider = () => {
    const provider: RouteMatrixProvider = {
      name: "MOCK",
      getRouteMatrix: vi.fn().mockResolvedValue(matrixResult)
    };

    return provider;
  };

  it("should return a valid route matrix", async () => {
    const provider = createProvider();
    const service = new RouteMatrixService(provider);

    const result = await service.getRouteMatrix({
      sources,
      targets
    });

    expect(result).toEqual(matrixResult);
    expect(provider.getRouteMatrix).toHaveBeenCalledWith({
      sources,
      targets
    });
  });

  it("should reject empty sources", async () => {
    const provider = createProvider();
    const service = new RouteMatrixService(provider);

    await expect(
      service.getRouteMatrix({
        sources: [],
        targets
      })
    ).rejects.toThrow(AppError);

    expect(provider.getRouteMatrix).not.toHaveBeenCalled();
  });

  it("should reject empty targets", async () => {
    const provider = createProvider();
    const service = new RouteMatrixService(provider);

    await expect(
      service.getRouteMatrix({
        sources,
        targets: []
      })
    ).rejects.toThrow(AppError);

    expect(provider.getRouteMatrix).not.toHaveBeenCalled();
  });

  it("should reject more than 1000 source-target pairs", async () => {
    const provider = createProvider();
    const service = new RouteMatrixService(provider);

    const largeSources = Array.from(
      { length: 32 },
      () => sources[0]!
    );

    const largeTargets = Array.from(
      { length: 32 },
      () => targets[0]!
    );

    await expect(
      service.getRouteMatrix({
        sources: largeSources,
        targets: largeTargets
      })
    ).rejects.toThrow(AppError);

    expect(provider.getRouteMatrix).not.toHaveBeenCalled();
  });

  it("should reject invalid source latitude", async () => {
    const provider = createProvider();
    const service = new RouteMatrixService(provider);

    await expect(
      service.getRouteMatrix({
        sources: [
          { ...sources[0]!, latitude: 91 }
        ],
        targets
      })
    ).rejects.toThrow(AppError);

    expect(provider.getRouteMatrix).not.toHaveBeenCalled();
  });

  it("should reject invalid target longitude", async () => {
    const provider = createProvider();
    const service = new RouteMatrixService(provider);

    await expect(
      service.getRouteMatrix({
        sources,
        targets: [
          { ...targets[0]!, longitude: 181 }
        ]
      })
    ).rejects.toThrow(AppError);

    expect(provider.getRouteMatrix).not.toHaveBeenCalled();
  });

  it("should reject NaN coordinates", async () => {
    const provider = createProvider();
    const service = new RouteMatrixService(provider);

    await expect(
      service.getRouteMatrix({
        sources: [
          { ...sources[0]!, latitude: Number.NaN }
        ],
        targets
      })
    ).rejects.toThrow(AppError);

    expect(provider.getRouteMatrix).not.toHaveBeenCalled();
  });

  it("should reject an incorrectly sized provider matrix", async () => {
    const provider = createProvider();

    vi.mocked(provider.getRouteMatrix).mockResolvedValue({
      ...matrixResult,
      matrix: [
        [{ distanceMeters: 1000, durationSeconds: 100 }]
      ]
    });

    const service = new RouteMatrixService(provider);

    await expect(
      service.getRouteMatrix({
        sources,
        targets
      })
    ).rejects.toThrow(
      "Routing provider returned an invalid matrix"
    );
  });

  it("should propagate provider errors", async () => {
    const provider = createProvider();

    vi.mocked(provider.getRouteMatrix).mockRejectedValue(
      new Error("Provider unavailable")
    );

    const service = new RouteMatrixService(provider);

    await expect(
      service.getRouteMatrix({
        sources,
        targets
      })
    ).rejects.toThrow("Provider unavailable");
  });
});
