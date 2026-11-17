
import {
  describe,
  it,
  expect,
  vi,
  afterEach
} from "vitest";

import { GeoapifyMatrixProvider } from "../../src/infrastructure/routing/geoapify-matrix.provider.js";
import { RoutingProviderError } from "../../src/infrastructure/routing/routing.errors.js";

describe("GeoapifyMatrixProvider", () => {
  const provider = new GeoapifyMatrixProvider();

  const sources = [
    { latitude: 22.5726, longitude: 88.3639 },
    { latitude: 22.6000, longitude: 88.4000 }
  ];

  const targets = [
    { latitude: 22.6200, longitude: 88.4500 },
    { latitude: 22.5500, longitude: 88.3500 }
  ];

  const validResponse = {
    sources_to_targets: [
      [
        {
          distance: 12000,
          time: 1800,
          source_index: 0,
          target_index: 0
        },
        {
          distance: 5000,
          time: 600,
          source_index: 0,
          target_index: 1
        }
      ],
      [
        {
          distance: 8000,
          time: 900,
          source_index: 1,
          target_index: 0
        },
        {
          distance: null,
          time: null,
          source_index: 1,
          target_index: 1
        }
      ]
    ]
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return a valid route matrix", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(validResponse), {
        status: 200
      })
    );

    const result = await provider.getRouteMatrix({
      sources,
      targets
    });

    expect(result.provider).toBe("GEOAPIFY");

    expect(result.matrix).toEqual([
      [
        { distanceMeters: 12000, durationSeconds: 1800 },
        { distanceMeters: 5000, durationSeconds: 600 }
      ],
      [
        { distanceMeters: 8000, durationSeconds: 900 },
        { distanceMeters: null, durationSeconds: null }
      ]
    ]);
  });

  it("should send coordinates in longitude-latitude order", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(validResponse), {
          status: 200
        })
      );

    await provider.getRouteMatrix({ sources, targets });

    const requestOptions = fetchMock.mock.calls[0]?.[1];

    expect(requestOptions?.method).toBe("POST");

    const body = JSON.parse(
      String(requestOptions?.body)
    );

    expect(body.sources[0].location).toEqual([
      88.3639,
      22.5726
    ]);

    expect(body.targets[0].location).toEqual([
      88.4500,
      22.6200
    ]);
  });

  it("should reject empty sources", async () => {
    await expect(
      provider.getRouteMatrix({
        sources: [],
        targets
      })
    ).rejects.toThrow(RoutingProviderError);
  });

  it("should reject empty targets", async () => {
    await expect(
      provider.getRouteMatrix({
        sources,
        targets: []
      })
    ).rejects.toThrow(RoutingProviderError);
  });

  it("should reject more than 1000 source-target pairs", async () => {
    const largeSources = Array.from(
      { length: 32 },
      () => sources[0]!
    );

    const largeTargets = Array.from(
      { length: 32 },
      () => targets[0]!
    );

    await expect(
      provider.getRouteMatrix({
        sources: largeSources,
        targets: largeTargets
      })
    ).rejects.toThrow(RoutingProviderError);
  });

  it("should throw when network request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("Network failure")
    );

    await expect(
      provider.getRouteMatrix({ sources, targets })
    ).rejects.toThrow(RoutingProviderError);
  });

  it("should throw when provider returns HTTP 503", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Unavailable", {
        status: 503
      })
    );

    await expect(
      provider.getRouteMatrix({ sources, targets })
    ).rejects.toThrow(RoutingProviderError);
  });

  it("should reject invalid JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("invalid-json", {
        status: 200
      })
    );

    await expect(
      provider.getRouteMatrix({ sources, targets })
    ).rejects.toThrow(RoutingProviderError);
  });

  it("should reject an incomplete matrix", async () => {
    const incompleteResponse = {
      sources_to_targets: [
        [
          {
            distance: 12000,
            time: 1800,
            source_index: 0,
            target_index: 0
          }
        ]
      ]
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(incompleteResponse), {
        status: 200
      })
    );

    await expect(
      provider.getRouteMatrix({ sources, targets })
    ).rejects.toThrow(
      "Geoapify returned an incomplete route matrix"
    );
  });

  it("should reject inconsistent matrix indexes", async () => {
    const inconsistentResponse = {
      sources_to_targets: [
        [
          {
            distance: 12000,
            time: 1800,
            source_index: 1,
            target_index: 0
          },
          ...validResponse.sources_to_targets[0]!.slice(1)
        ],
        validResponse.sources_to_targets[1]
      ]
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(inconsistentResponse), {
        status: 200
      })
    );

    await expect(
      provider.getRouteMatrix({ sources, targets })
    ).rejects.toThrow(
      "Geoapify returned inconsistent matrix indexes"
    );
  });
});
