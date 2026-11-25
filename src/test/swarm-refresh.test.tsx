import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SwarmRebuildRunner } from "@/components/swarm-rebuild";
import { SwarmRebuild } from "@/lib/swarm/swarm-rebuild";

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => "/",
}));
vi.mock("@/lib/swarm/swarm-rebuild", () => ({
  SwarmRebuild: { start: vi.fn(), stop: vi.fn(), configure: vi.fn() },
}));

describe("Swarm Rebuild refresh", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
  afterEach(() => { vi.useRealTimers(); sessionStorage.clear(); });

  it("starts again after a refresh even with a previous session marker", () => {
    sessionStorage.setItem("swarm-rebuild:/", "1");
    const first = render(<SwarmRebuildRunner />);
    act(() => { vi.advanceTimersByTime(400); });
    expect(SwarmRebuild.start).toHaveBeenCalledTimes(1);
    first.unmount();
    const refreshed = render(<SwarmRebuildRunner />);
    act(() => { vi.advanceTimersByTime(400); });
    expect(SwarmRebuild.start).toHaveBeenCalledTimes(2);
    refreshed.unmount();
  });

  it("does not auto-start when manual mode is configured", () => {
    const runner = render(<SwarmRebuildRunner config={{ auto: false }} />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(SwarmRebuild.start).not.toHaveBeenCalled();
    runner.unmount();
  });

  it("cancels a pending start when the page is unmounted", () => {
    const runner = render(<SwarmRebuildRunner />);
    runner.unmount();
    act(() => { vi.advanceTimersByTime(400); });
    expect(SwarmRebuild.start).not.toHaveBeenCalled();
  });
});