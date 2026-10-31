import { describe, expect, it } from "vitest";
import {
  appointmentPreview,
  availabilityFromShifts,
  newWorkingShift,
  shiftsFromAvailability,
  workingHoursError,
} from "./workingHours";

describe("real weekly shift compilation", () => {
  it("turns a full working day and lunch into fourteen half-hour appointments", () => {
    const shift = newWorkingShift("sun", 5);
    const availability = availabilityFromShifts([shift]);
    expect(workingHoursError([shift], [5])).toBeNull();
    expect(appointmentPreview(availability[0]!.windows[0]!)).toEqual([
      "08:00",
      "08:30",
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
      "11:30",
      "13:00",
      "13:30",
      "14:00",
      "14:30",
      "15:00",
      "15:30",
    ]);
  });
  it("matches server break-end cursor advancement, including a break across two services", () => {
    const shift = newWorkingShift("sun", 5, "08:00", "12:00");
    shift.breaks = [{ start: "09:50", end: "10:20" }];
    shift.sessions = [
      { ...shift.sessions[0]!, end: "10:00" },
      { ...shift.sessions[0]!, key: "second", checkup_id: 6, start: "10:00", duration_minutes: 20 },
    ];
    const compiled = availabilityFromShifts([shift]);
    expect(compiled[0]!.windows.map((rule) => rule.breaks)).toEqual([
      [{ start: "09:50", end: "10:00" }],
      [{ start: "10:00", end: "10:20" }],
    ]);
    expect(compiled[0]!.windows.map(appointmentPreview)).toEqual([
      ["08:00", "08:30", "09:00"],
      ["10:20", "10:40", "11:00", "11:20", "11:40"],
    ]);
    expect(workingHoursError([shift], [5, 6])).toBeNull();
    expect(availabilityFromShifts(shiftsFromAvailability(compiled))).toEqual(compiled);
    expect(shiftsFromAvailability(compiled)[0]!.breaks).toEqual(shift.breaks);
  });
  it("round trips existing short rules, split shifts, prices, dates and breaks without inventing hours", () => {
    const morning = newWorkingShift("mon", 5, "08:00", "08:30");
    morning.sessions[0]!.price_override = 750000;
    morning.sessions[0]!.currency_override = "IRR";
    morning.effective_from = "2026-10-20";
    morning.effective_until = "2026-11-20";
    const afternoon = newWorkingShift("mon", 6, "14:00", "17:00");
    afternoon.breaks = [{ start: "15:00", end: "15:15" }];
    const saved = availabilityFromShifts([morning, afternoon]);
    const restored = shiftsFromAvailability(saved);
    expect(restored).toHaveLength(2);
    expect(restored[0]!.end).toBe("08:30");
    expect(availabilityFromShifts(restored)).toEqual(saved);
    expect(availabilityFromShifts([])).toEqual([]);
  });
  it("keeps adjacent rules with different validity as separate shifts", () => {
    const a = newWorkingShift("mon", 5, "08:00", "12:00");
    const b = newWorkingShift("mon", 5, "12:00", "16:00");
    b.effective_from = "2026-11-01";
    expect(shiftsFromAvailability(availabilityFromShifts([a, b]))).toHaveLength(2);
  });
  it.each([
    ["overnight", "invalidShift"],
    ["overlap", "overlap"],
    ["break outside", "invalidBreak"],
    ["break overlap", "invalidBreak"],
    ["zero capacity", "noAppointments"],
    ["gap", "coverage"],
    ["duration", "invalidDuration"],
    ["dates", "invalidDates"],
    ["unoffered", "invalidService"],
    ["price", "invalidPrice"],
    ["limit", "sessionLimit"],
  ])("refuses %s before transport", (scenario, expected) => {
    const a = newWorkingShift("sun", 5);
    const shifts = [a];
    if (scenario === "overnight") a.end = "07:00";
    if (scenario === "overlap") shifts.push(newWorkingShift("sun", 5, "15:00", "18:00"));
    if (scenario === "break outside") a.breaks = [{ start: "07:00", end: "09:00" }];
    if (scenario === "break overlap") a.breaks.push({ start: "12:30", end: "13:30" });
    if (scenario === "zero capacity") a.breaks = [{ start: "08:00", end: "16:00" }];
    if (scenario === "gap") a.sessions[0]!.start = "09:00";
    if (scenario === "duration") a.sessions[0]!.duration_minutes = 0;
    if (scenario === "dates") {
      a.effective_from = "2026-11-01";
      a.effective_until = "2026-10-01";
    }
    if (scenario === "unoffered") a.sessions[0]!.checkup_id = 7;
    if (scenario === "price") a.sessions[0]!.currency_override = "IRR";
    if (scenario === "limit") a.sessions = Array.from({ length: 9 }, () => ({ ...a.sessions[0]! }));
    expect(workingHoursError(shifts, [5])).toBe(expected);
  });
});
