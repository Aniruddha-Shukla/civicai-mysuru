// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventCard, type EventCardProps } from "@/components/event-card";
import { istMidnight } from "@/lib/time";

afterEach(cleanup);

const props: EventCardProps = {
  serviceName: "Garbage Collection",
  eventType: "holiday",
  affectedDate: istMidnight("2026-11-02"),
  reason: "a municipal holiday",
  source: "MCC Circular No. 114/2026",
  sourceUrl: null,
  verificationStatus: "VERIFIED",
  lastVerifiedAt: new Date("2026-11-01T04:30:00Z"),
  alternative: { status: "UNAVAILABLE", arrangement: null },
};

const arrangement = {
  alternativeDate: istMidnight("2026-11-04"),
  alternativeTime: "07:00",
  affectedArea: "All streets in Ward 1",
  source: "MCC Circular No. 114/2026",
  lastVerifiedAt: new Date("2026-11-01T04:30:00Z"),
};

describe("EventCard", () => {
  it("UNAVAILABLE: renders the paper's wording and the §5 fallback sentence — never a time", () => {
    render(<EventCard {...props} />);
    expect(screen.getByText("No alternative arrangement has been officially published.")).toBeTruthy();
    expect(screen.getByText("The normal collection schedule is affected. No verified alternative arrangement is currently available.")).toBeTruthy();
    expect(screen.queryByText(/AM\./)).toBeNull();
  });

  it("VERIFIED: renders 'Alternative collection: Wednesday 7 AM.'", () => {
    render(<EventCard {...props} alternative={{ status: "VERIFIED", arrangement: { ...arrangement, verificationStatus: "VERIFIED" } }} />);
    expect(screen.getByText("Alternative collection: Wednesday 7 AM.")).toBeTruthy();
  });

  it("UNVERIFIED: renders 'A possible alternative may be Wednesday.' with its own treatment", () => {
    render(<EventCard {...props} alternative={{ status: "UNVERIFIED", arrangement: { ...arrangement, verificationStatus: "UNVERIFIED", lastVerifiedAt: null } }} />);
    expect(screen.getByText("A possible alternative may be Wednesday.")).toBeTruthy();
    expect(screen.getAllByText("Unverified").length).toBeGreaterThan(0);
  });

  it("always shows source, verification status and last-verified time", () => {
    render(<EventCard {...props} />);
    expect(screen.getAllByText(/MCC Circular No. 114\/2026/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Verified").length).toBeGreaterThan(0);
    expect(screen.getByText(/Last verified:/)).toBeTruthy();
  });

  it("shows 'Not yet verified' when lastVerifiedAt is null", () => {
    render(<EventCard {...props} verificationStatus="UNVERIFIED" lastVerifiedAt={null} />);
    expect(screen.getByText("Not yet verified")).toBeTruthy();
  });
});
