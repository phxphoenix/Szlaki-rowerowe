import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ElevationChart } from "@/components/map/ElevationChart";
import type { RoutePoint } from "@/types/trail";

const SAMPLE_POINTS_WITH_ELEVATION: RoutePoint[] = [
  { lat: 50.3514, lng: 19.1995, ele: 260, distKm: 0 },
  { lat: 50.355, lng: 19.205, ele: 285, distKm: 1.5 },
  { lat: 50.36, lng: 19.21, ele: 315, distKm: 3.2 },
  { lat: 50.365, lng: 19.215, ele: 290, distKm: 5.0 },
  { lat: 50.37, lng: 19.22, ele: 270, distKm: 6.8 },
];

describe("ElevationChart (UI-04)", () => {
  it("renders elevation profile with min, max and gain stats when points contain <ele>", () => {
    render(<ElevationChart routePoints={SAMPLE_POINTS_WITH_ELEVATION} />);

    expect(screen.getByTestId("elevation-chart")).toBeInTheDocument();
    expect(screen.getByTestId("elevation-chart-svg")).toBeInTheDocument();
    expect(screen.getByText(/Profil wysokościowy/i)).toBeInTheDocument();
    expect(screen.getAllByText("260 m").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("315 m").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("↑ 55 m")).toBeInTheDocument();
  });

  it("calls onHoverPoint on mouse move, touch move, and clears on leave/touchEnd", () => {
    const onHoverPoint = vi.fn();

    render(
      <ElevationChart
        routePoints={SAMPLE_POINTS_WITH_ELEVATION}
        onHoverPoint={onHoverPoint}
      />,
    );

    const svg = screen.getByTestId("elevation-chart-svg");

    fireEvent.mouseMove(svg, { clientX: 400, clientY: 100 });
    expect(onHoverPoint).toHaveBeenCalledTimes(1);
    const hoveredIndex = onHoverPoint.mock.calls[0][0];
    expect(typeof hoveredIndex).toBe("number");
    expect(hoveredIndex).toBeGreaterThanOrEqual(0);
    expect(hoveredIndex).toBeLessThan(SAMPLE_POINTS_WITH_ELEVATION.length);

    expect(screen.getByTestId("elevation-chart-tooltip")).toBeInTheDocument();
    expect(screen.getByTestId("elevation-active-readout")).toBeInTheDocument();

    fireEvent.mouseLeave(svg);
    expect(onHoverPoint).toHaveBeenLastCalledWith(null);

    fireEvent.touchMove(svg, {
      touches: [{ clientX: 250, clientY: 80 }],
    });
    expect(typeof onHoverPoint.mock.calls[2][0]).toBe("number");

    fireEvent.touchEnd(svg);
    expect(onHoverPoint).toHaveBeenLastCalledWith(null);
  });

  it("supports keyboard stepping through elevation points", () => {
    const onHoverPoint = vi.fn();

    render(
      <ElevationChart
        routePoints={SAMPLE_POINTS_WITH_ELEVATION}
        onHoverPoint={onHoverPoint}
      />,
    );

    const svg = screen.getByTestId("elevation-chart-svg");
    fireEvent.keyDown(svg, { key: "ArrowRight" });
    expect(onHoverPoint).toHaveBeenLastCalledWith(0);

    fireEvent.keyDown(svg, { key: "ArrowRight" });
    expect(onHoverPoint).toHaveBeenLastCalledWith(1);

    fireEvent.keyDown(svg, { key: "Escape" });
    expect(onHoverPoint).toHaveBeenLastCalledWith(null);
  });

  it("hides gracefully (returns null) when fewer than 2 points have elevation data", () => {
    const noElePoints: RoutePoint[] = [
      { lat: 50.3514, lng: 19.1995, distKm: 0 },
      { lat: 50.355, lng: 19.205, distKm: 1.5 },
      { lat: 50.36, lng: 19.21, ele: 280, distKm: 3.0 },
    ];

    const { container } = render(<ElevationChart routePoints={noElePoints} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("elevation-chart")).not.toBeInTheDocument();
  });
});
