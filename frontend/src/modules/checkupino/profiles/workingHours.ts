import type { DoctorPractice, WorkingRule } from "./practice";

export const workingDays = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const;
export type WorkingDay = (typeof workingDays)[number];
export type ServiceSession = Omit<WorkingRule, "breaks" | "effective_from" | "effective_until"> & {
  key: string;
};
export type WorkingShift = {
  key: string;
  day: WorkingDay;
  start: string;
  end: string;
  effective_from: string | null;
  effective_until: string | null;
  breaks: WorkingRule["breaks"];
  sessions: ServiceSession[];
};
type Availability = DoctorPractice["workplaces"][number]["availability"];
export const clockMinutes = (value: string) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return Number.NaN;
  const [hour, minute] = value.split(":").map(Number);
  return hour! * 60 + minute!;
};
export const minuteClock = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

// The persisted service rules remain authoritative. Adjacent rules with identical
// validity form one shift; gaps remain distinct shifts rather than invented hours.
export function shiftsFromAvailability(availability: Availability): WorkingShift[] {
  const shifts: WorkingShift[] = [];
  for (const day of availability) {
    let previous: WorkingShift | undefined;
    for (const rule of [...day.windows].sort((a, b) => a.start.localeCompare(b.start))) {
      const { breaks, effective_from, effective_until, ...session } = structuredClone(rule);
      if (
        !previous ||
        previous.end !== rule.start ||
        previous.breaks.length + breaks.length > 8 ||
        previous.effective_from !== effective_from ||
        previous.effective_until !== effective_until
      ) {
        previous = {
          key: crypto.randomUUID(),
          day: day.day,
          start: rule.start,
          end: rule.end,
          effective_from,
          effective_until,
          breaks: [],
          sessions: [],
        };
        shifts.push(previous);
      }
      previous.end = rule.end;
      previous.sessions.push({ ...session, key: crypto.randomUUID() });
      previous.breaks.push(...breaks);
      previous.breaks.sort((a, b) => a.start.localeCompare(b.start));
      previous.breaks = previous.breaks.reduce<WorkingRule["breaks"]>((all, pause) => {
        const last = all.at(-1);
        if (last && last.end === pause.start) last.end = pause.end;
        else all.push({ ...pause });
        return all;
      }, []);
    }
  }
  return shifts;
}

export function newWorkingShift(
  day: WorkingDay,
  serviceId: number,
  start = "08:00",
  end = "16:00",
): WorkingShift {
  return {
    key: crypto.randomUUID(),
    day,
    start,
    end,
    effective_from: null,
    effective_until: null,
    breaks: start === "08:00" && end === "16:00" ? [{ start: "12:00", end: "13:00" }] : [],
    sessions: [
      {
        key: crypto.randomUUID(),
        checkup_id: serviceId,
        start,
        end,
        duration_minutes: 30,
        price_override: null,
        currency_override: null,
      },
    ],
  };
}

export function availabilityFromShifts(shifts: WorkingShift[]): Availability {
  return workingDays.flatMap((day) => {
    const windows = shifts
      .filter((shift) => shift.day === day)
      .flatMap((shift) =>
        shift.sessions.map(({ key: _key, ...session }) => ({
          ...session,
          effective_from: shift.effective_from,
          effective_until: shift.effective_until,
          breaks: shift.breaks.flatMap((pause) => {
            const start = pause.start > session.start ? pause.start : session.start;
            const end = pause.end < session.end ? pause.end : session.end;
            return start < end ? [{ start, end }] : [];
          }),
        })),
      );
    return windows.length ? [{ day, windows }] : [];
  });
}

// Mirrors SchedulingService's cursor: an intersecting break advances to its end.
// These are recurring template times, not a claim that dated slots are unbooked.
export function appointmentPreview(
  rule: Pick<WorkingRule, "start" | "end" | "duration_minutes" | "breaks">,
): string[] {
  let cursor = clockMinutes(rule.start);
  const end = clockMinutes(rule.end),
    duration = rule.duration_minutes;
  if (!Number.isInteger(duration) || duration < 5 || duration > 720) return [];
  const pauses = rule.breaks
    .map((p) => ({ start: clockMinutes(p.start), end: clockMinutes(p.end) }))
    .sort((a, b) => a.start - b.start);
  const result: string[] = [];
  for (let bound = 0; bound < 600 && cursor + duration <= end; bound++) {
    const pause = pauses.find((p) => cursor < p.end && cursor + duration > p.start);
    if (pause) {
      if (pause.end <= cursor) break;
      cursor = pause.end;
    } else {
      result.push(minuteClock(cursor));
      cursor += duration;
    }
  }
  return result;
}

export function workingHoursError(shifts: WorkingShift[], serviceIds: number[]): string | null {
  for (const day of workingDays) {
    const rows = shifts.filter((s) => s.day === day).sort((a, b) => a.start.localeCompare(b.start));
    if (rows.reduce((count, shift) => count + shift.sessions.length, 0) > 8) return "sessionLimit";
    let previousEnd = "";
    for (const shift of rows) {
      if (
        !Number.isFinite(clockMinutes(shift.start)) ||
        !Number.isFinite(clockMinutes(shift.end)) ||
        shift.start >= shift.end
      )
        return "invalidShift";
      if (previousEnd > shift.start) return "overlap";
      previousEnd = shift.end;
      if (
        shift.effective_from &&
        shift.effective_until &&
        shift.effective_from > shift.effective_until
      )
        return "invalidDates";
      const breaks = [...shift.breaks].sort((a, b) => a.start.localeCompare(b.start));
      let previousBreakEnd = "";
      if (breaks.length > 8) return "invalidBreak";
      for (const pause of breaks) {
        if (
          !Number.isFinite(clockMinutes(pause.start)) ||
          !Number.isFinite(clockMinutes(pause.end)) ||
          pause.start >= pause.end ||
          pause.start < shift.start ||
          pause.end > shift.end ||
          previousBreakEnd > pause.start
        )
          return "invalidBreak";
        previousBreakEnd = pause.end;
      }
      let cursor = shift.start;
      if (!shift.sessions.length) return "coverage";
      for (const session of shift.sessions) {
        if (
          session.start !== cursor ||
          session.start >= session.end ||
          session.end > shift.end ||
          !Number.isFinite(clockMinutes(session.end))
        )
          return "coverage";
        if (!serviceIds.includes(session.checkup_id)) return "invalidService";
        if (
          (session.price_override !== null &&
            (!Number.isSafeInteger(session.price_override) ||
              session.price_override < 0 ||
              session.price_override > 2147483647)) ||
          (session.currency_override !== null &&
            (session.price_override === null || !/^[A-Z]{3}$/.test(session.currency_override)))
        )
          return "invalidPrice";
        if (
          !Number.isInteger(session.duration_minutes) ||
          session.duration_minutes < 5 ||
          session.duration_minutes > 720
        )
          return "invalidDuration";
        const compiled = availabilityFromShifts([{ ...shift, sessions: [session] }])[0]!
          .windows[0]!;
        if (!appointmentPreview(compiled).length) return "noAppointments";
        cursor = session.end;
      }
      if (cursor !== shift.end) return "coverage";
    }
  }
  return null;
}
