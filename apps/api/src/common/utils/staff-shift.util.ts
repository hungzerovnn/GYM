import { addDays, differenceInCalendarDays, differenceInMinutes, endOfDay, isSameDay, startOfDay } from 'date-fns';

const bangkokDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export type ShiftLike = {
  id?: string;
  code?: string | null;
  name?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  isOvernight?: boolean | null;
  lateToleranceMinutes?: number | null;
  earlyLeaveToleranceMinutes?: number | null;
  overtimeAfterMinutes?: number | null;
};

export type ShiftPatternLike<TShift extends ShiftLike = ShiftLike> = {
  id?: string;
  startDate: Date | string;
  endDate?: Date | string | null;
  rotationCycleDays?: number | null;
  isUnlimitedRotation?: boolean | null;
  shifts: TShift[];
};

export type AttendanceEventLike = {
  eventAt: Date | string;
  eventType?: string | null;
};

export type ShiftWindow = {
  startAt: Date;
  endAt: Date;
  startMinutes: number;
  endMinutes: number;
  overnight: boolean;
  label: string;
};

export type ShiftSummary = {
  shift: ShiftLike | null;
  window: ShiftWindow | null;
  firstCheckIn: Date | null;
  lastCheckOut: Date | null;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  status:
    | 'UNASSIGNED'
    | 'UPCOMING'
    | 'NOT_CHECKED_IN'
    | 'WORKING'
    | 'LATE'
    | 'LEFT_EARLY'
    | 'COMPLETED'
    | 'MISSING_CHECKOUT'
    | 'ABSENT';
};

const toDate = (value: Date | string) =>
  value instanceof Date ? value : new Date(value);

const dateKey = (value: Date) => {
  const parts = bangkokDateFormatter.formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value || '0000';
  const month = parts.find((part) => part.type === 'month')?.value || '01';
  const day = parts.find((part) => part.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
};

export const parseClockToMinutes = (value?: string | null, fallback = 0) => {
  const normalized = String(value || '').trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return fallback;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return fallback;
  }

  return hours * 60 + minutes;
};

export const formatMinutesToClock = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60)
    .toString()
    .padStart(2, '0');
  const mins = Math.max(0, safeMinutes % 60)
    .toString()
    .padStart(2, '0');
  return `${hours}:${mins}`;
};

export const buildShiftWindowForDate = (
  targetDate: Date,
  shift: ShiftLike,
): ShiftWindow => {
  const startMinutes = parseClockToMinutes(shift.startTime, 8 * 60);
  const fallbackEndMinutes = startMinutes + 8 * 60;
  const parsedEndMinutes = parseClockToMinutes(shift.endTime, fallbackEndMinutes);
  const overnight = Boolean(
    shift.isOvernight || parsedEndMinutes <= startMinutes,
  );
  const startDateKey = dateKey(targetDate);
  const startAt = new Date(
    `${startDateKey}T${formatMinutesToClock(startMinutes)}:00+07:00`,
  );
  const endBaseDate = overnight ? addDays(startAt, 1) : startAt;
  const endDateKey = dateKey(endBaseDate);
  const endAt = new Date(
    `${endDateKey}T${formatMinutesToClock(parsedEndMinutes)}:00+07:00`,
  );

  return {
    startAt,
    endAt,
    startMinutes,
    endMinutes: parsedEndMinutes,
    overnight,
    label: `${formatMinutesToClock(startMinutes)} - ${formatMinutesToClock(parsedEndMinutes)}${
      overnight ? ' (+1)' : ''
    }`,
  };
};

const resolveEffectiveEndDate = <TShift extends ShiftLike>(
  pattern: ShiftPatternLike<TShift>,
) => {
  if (pattern.endDate) {
    return endOfDay(toDate(pattern.endDate));
  }

  if (pattern.isUnlimitedRotation) {
    return null;
  }

  const cycleDays = Math.max(1, Number(pattern.rotationCycleDays || 1));
  if (pattern.shifts.length) {
    return endOfDay(
      addDays(
        startOfDay(toDate(pattern.startDate)),
        pattern.shifts.length * cycleDays - 1,
      ),
    );
  }

  return null;
};

export const resolveShiftForDate = <TShift extends ShiftLike>(
  pattern: ShiftPatternLike<TShift>,
  targetDate: Date,
) => {
  if (!pattern.shifts.length) {
    return null;
  }

  const normalizedStart = startOfDay(toDate(pattern.startDate));
  const normalizedTarget = startOfDay(targetDate);
  if (normalizedTarget < normalizedStart) {
    return null;
  }

  const effectiveEndDate = resolveEffectiveEndDate(pattern);
  if (effectiveEndDate && normalizedTarget > endOfDay(effectiveEndDate)) {
    return null;
  }

  const dayOffset = differenceInCalendarDays(normalizedTarget, normalizedStart);
  if (dayOffset < 0) {
    return null;
  }

  const cycleDays = Math.max(1, Number(pattern.rotationCycleDays || 1));
  const cycleOffset =
    cycleDays > 1 ? Math.floor(dayOffset / cycleDays) : dayOffset;
  const shiftIndex =
    pattern.shifts.length === 1 ? 0 : cycleOffset % pattern.shifts.length;
  const shift = pattern.shifts[shiftIndex];

  return {
    shift,
    shiftIndex,
    effectiveEndDate,
    window: buildShiftWindowForDate(targetDate, shift),
  };
};

export const summarizeShiftAttendance = (args: {
  shift: ShiftLike | null;
  targetDate: Date;
  events: AttendanceEventLike[];
  now?: Date;
}) => {
  if (!args.shift) {
    return {
      shift: null,
      window: null,
      firstCheckIn: null,
      lastCheckOut: null,
      workedMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      status: 'UNASSIGNED',
    } satisfies ShiftSummary;
  }

  const window = buildShiftWindowForDate(args.targetDate, args.shift);
  const now = args.now || new Date();
  const toleranceLate = Math.max(0, Number(args.shift.lateToleranceMinutes || 0));
  const toleranceEarly = Math.max(
    0,
    Number(args.shift.earlyLeaveToleranceMinutes || 0),
  );
  const overtimeAfterMinutes = Math.max(
    0,
    Number(args.shift.overtimeAfterMinutes || 0),
  );
  const relevantEvents = args.events
    .map((event) => ({
      ...event,
      eventAt: toDate(event.eventAt),
    }))
    .filter((event) => {
      if (window.overnight) {
        return (
          event.eventAt >= startOfDay(args.targetDate) &&
          event.eventAt <= endOfDay(addDays(args.targetDate, 1))
        );
      }

      return isSameDay(event.eventAt, args.targetDate);
    })
    .sort((left, right) => left.eventAt.getTime() - right.eventAt.getTime());

  const firstCheckIn =
    relevantEvents.find((event) => event.eventType === 'CHECK_IN')?.eventAt ||
    null;
  const lastCheckOut =
    [...relevantEvents]
      .reverse()
      .find((event) => event.eventType === 'CHECK_OUT')?.eventAt || null;
  const lateMinutes = firstCheckIn
    ? Math.max(0, differenceInMinutes(firstCheckIn, window.startAt) - toleranceLate)
    : 0;
  const earlyLeaveMinutes = lastCheckOut
    ? Math.max(0, differenceInMinutes(window.endAt, lastCheckOut) - toleranceEarly)
    : 0;
  const workedMinutes =
    firstCheckIn &&
    lastCheckOut &&
    lastCheckOut.getTime() > firstCheckIn.getTime()
      ? differenceInMinutes(lastCheckOut, firstCheckIn)
      : 0;
  const overtimeMinutes = lastCheckOut
    ? Math.max(0, differenceInMinutes(lastCheckOut, window.endAt) - overtimeAfterMinutes)
    : 0;

  let status: ShiftSummary['status'] = 'ABSENT';

  if (firstCheckIn && !lastCheckOut) {
    status = now <= window.endAt ? 'WORKING' : 'MISSING_CHECKOUT';
  } else if (firstCheckIn && lastCheckOut) {
    if (earlyLeaveMinutes > 0) {
      status = 'LEFT_EARLY';
    } else if (lateMinutes > 0) {
      status = 'LATE';
    } else {
      status = 'COMPLETED';
    }
  } else if (now < window.startAt) {
    status = 'UPCOMING';
  } else if (now <= window.endAt) {
    status = 'NOT_CHECKED_IN';
  }

  return {
    shift: args.shift,
    window,
    firstCheckIn,
    lastCheckOut,
    workedMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
    status,
  } satisfies ShiftSummary;
};
