import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FilterBar } from "@/components/trails/FilterBar";
import { REGIONS, REGION_SLUGS, type RegionSlug } from "@/lib/constants/regions";

const pushMock = vi.fn();
let currentSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => currentSearchParams,
}));

function buildRegionCounts(): Record<RegionSlug, number> {
  const counts = Object.fromEntries(
    REGION_SLUGS.map((slug) => [slug, 0]),
  ) as Record<RegionSlug, number>;
  counts.slaskie = 3;
  counts.malopolskie = 2;
  counts.dolnoslaskie = 1;
  counts.podlaskie = 1;
  return counts;
}

describe("FilterBar & RegionPills (UI-02)", () => {
  beforeEach(() => {
    pushMock.mockReset();
    currentSearchParams = new URLSearchParams();
  });

  it("renders Cała Polska and all 16 Polish voivodeships with trail counts", () => {
    const regionCounts = buildRegionCounts();
    render(<FilterBar regionCounts={regionCounts} totalResults={7} />);

    const allButton = screen.getByRole("button", { name: /Cała Polska/i });
    expect(allButton).toBeInTheDocument();
    expect(allButton).toHaveAttribute("aria-pressed", "true");
    expect(allButton).toHaveTextContent("7");

    for (const region of REGIONS) {
      const btn = screen.getByRole("button", {
        name: new RegExp(`^${region.name}`, "i"),
      });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveAttribute("aria-pressed", "false");
    }

    const slaskieButton = screen.getByRole("button", { name: /^Śląskie/i });
    expect(slaskieButton).toHaveTextContent("3");
  });

  it("updates URL query to region=slaskie when clicking Śląskie pill", async () => {
    const user = userEvent.setup();
    render(<FilterBar regionCounts={buildRegionCounts()} totalResults={7} />);

    await user.click(screen.getByRole("button", { name: /^Śląskie/i }));

    expect(pushMock).toHaveBeenCalledWith("/?region=slaskie", {
      scroll: false,
    });
  });

  it("updates URL query to sort=distance_desc when changing sort order", async () => {
    const user = userEvent.setup();
    render(<FilterBar regionCounts={buildRegionCounts()} totalResults={7} />);

    const sortSelect = screen.getByLabelText("Sortuj szlaki");
    await user.selectOptions(sortSelect, "distance_desc");

    expect(pushMock).toHaveBeenCalledWith("/?sort=distance_desc", {
      scroll: false,
    });
  });

  it("updates URL query when typing a search phrase", async () => {
    const user = userEvent.setup();
    render(<FilterBar regionCounts={buildRegionCounts()} totalResults={7} />);

    const searchInput = screen.getByPlaceholderText(
      "Szukaj szlaku, pasma, miejscowości...",
    );
    await user.type(searchInput, "Beskid");

    await waitFor(
      () => {
        expect(pushMock).toHaveBeenCalledWith("/?q=Beskid", { scroll: false });
      },
      { timeout: 1500 },
    );
  });

  it("shows reset button when filters are active and resets URL to / on click", async () => {
    const user = userEvent.setup();
    currentSearchParams = new URLSearchParams(
      "region=slaskie&difficulty=moderate&sort=distance_desc&q=Jura",
    );

    render(<FilterBar regionCounts={buildRegionCounts()} totalResults={2} />);

    const slaskieButton = screen.getByRole("button", { name: /^Śląskie/i });
    expect(slaskieButton).toHaveAttribute("aria-pressed", "true");

    const resetButton = screen.getByRole("button", { name: /Wyczyść filtry/i });
    expect(resetButton).toBeInTheDocument();

    await user.click(resetButton);
    expect(pushMock).toHaveBeenCalledWith("/", { scroll: false });
  });
});
