import { formatDuration } from "./format";

describe("formatDuration", () => {
  describe("seconds (< 60)", () => {
    it("returns seconds suffix for values under 60", () => {
      expect(formatDuration(30)).toBe("30s");
    });

    it("returns 1s for a single second", () => {
      expect(formatDuration(1)).toBe("1s");
    });

    it("returns 59s at the upper boundary before minutes", () => {
      expect(formatDuration(59)).toBe("59s");
    });
  });

  describe("zero duration", () => {
    it("returns 0s for zero seconds", () => {
      expect(formatDuration(0)).toBe("0s");
    });
  });

  describe("minutes (60–3599)", () => {
    it("returns 1m for exactly 60 seconds", () => {
      expect(formatDuration(60)).toBe("1m");
    });

    it("returns rounded minutes for values between minute boundaries", () => {
      // 90 seconds = 1.5 minutes → rounds to 2m
      expect(formatDuration(90)).toBe("2m");
    });

    it("returns 5m for 300 seconds", () => {
      expect(formatDuration(300)).toBe("5m");
    });

    it("rounds down when fractional part is below 0.5", () => {
      // 100 seconds = 1.667 minutes → rounds to 2m
      expect(formatDuration(100)).toBe("2m");
      // 70 seconds = 1.167 minutes → rounds to 1m
      expect(formatDuration(70)).toBe("1m");
    });

    it("returns 59m at the upper boundary before hours", () => {
      // 59 * 60 = 3540 seconds → 59m
      expect(formatDuration(3540)).toBe("59m");
    });
  });

  describe("hours with remaining minutes (≥ 3600)", () => {
    it("returns 1h 0m for exactly 3600 seconds", () => {
      expect(formatDuration(3600)).toBe("1h 0m");
    });

    it("returns hours and remaining minutes for mixed durations", () => {
      // 3660 seconds = 61 minutes → 1h 1m
      expect(formatDuration(3660)).toBe("1h 1m");
    });

    it("returns 1h 30m for 5400 seconds", () => {
      // 5400 / 60 = 90 minutes → Math.round = 90 → 1h 30m
      expect(formatDuration(5400)).toBe("1h 30m");
    });

    it("returns 2h 0m for exactly 7200 seconds", () => {
      expect(formatDuration(7200)).toBe("2h 0m");
    });

    it("handles multi-hour durations with remaining minutes", () => {
      // 9000 seconds = 150 minutes → 2h 30m
      expect(formatDuration(9000)).toBe("2h 30m");
    });
  });

  describe("large values", () => {
    it("handles 24 hours worth of seconds", () => {
      // 86400 seconds = 1440 minutes → 24h 0m
      expect(formatDuration(86400)).toBe("24h 0m");
    });

    it("handles values exceeding 24 hours", () => {
      // 100000 seconds = 1667 minutes (rounded) → 27h 47m
      const seconds = 100000;
      const mins = Math.round(seconds / 60); // 1667
      const hrs = Math.floor(mins / 60); // 27
      const remainMins = mins % 60; // 47
      expect(formatDuration(seconds)).toBe(`${hrs}h ${remainMins}m`);
    });

    it("handles a full week of seconds", () => {
      // 604800 seconds = 10080 minutes → 168h 0m
      expect(formatDuration(604800)).toBe("168h 0m");
    });
  });

  describe("edge cases", () => {
    it("handles negative values by returning them with seconds suffix", () => {
      // Negative values are < 60, so they fall into the seconds branch
      expect(formatDuration(-5)).toBe("-5s");
    });

    it("handles fractional seconds by preserving them in the output", () => {
      expect(formatDuration(30.5)).toBe("30.5s");
    });
  });
});