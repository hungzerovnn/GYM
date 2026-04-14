"use client";

import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Loader2, MapPin, Trash2, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { api, ListResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate, formatDateTime } from "@/lib/format";
import { translateStatus, translateText } from "@/lib/i18n/display";
import { localizeResourceDefinition } from "@/lib/i18n/portal";
import { useLocale } from "@/lib/i18n/provider";
import { ResourceDefinition } from "@/types/portal";
import { EmptyState } from "../feedback/empty-state";
import { PageHeader } from "../layout/page-header";
import { SearchBar } from "../table/search-bar";

const SLOT_MINUTES = 30;
const DAY_START_MINUTES = 5 * 60;
const DAY_END_MINUTES = 22 * 60;
const TRAINER_COLUMN_WIDTH = 240;
const SLOT_COLUMN_WIDTH = 58;
const DURATION_PRESETS = [30, 60, 90, 120];
const STATUS_LEGEND = ["SCHEDULED", "CHECKED_IN", "COMPLETED", "MISSED", "CANCELLED"] as const;
const BOARD_SLOT_SURFACE_INSET_CLASSNAME = "absolute inset-x-px inset-y-[5px] rounded-[0.7rem] border transition";
const BOARD_GRID_ITEM_INSET_CLASSNAME = "mx-px my-[5px]";

type BranchOption = {
  id: string;
  name: string;
};

type TrainerBoardRow = {
  id: string;
  branchId: string;
  branchName: string;
  code: string;
  fullName: string;
  specialty?: string;
  trainingSessionCount?: number;
  upcomingSessionCount?: number;
  status?: string;
};

type TrainingSessionBoardItem = {
  id: string;
  branchId: string;
  branchName: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  trainerId?: string;
  trainerName?: string;
  contractId?: string;
  contractCode?: string;
  contractPackageName?: string;
  remainingSessions?: number;
  code: string;
  scheduledAt: string;
  scheduledDateTime?: string;
  durationMinutes?: number;
  location?: string;
  status?: string;
  consumedSessions?: number;
  note?: string;
  attendanceCount?: number;
  presentCount?: number;
  attachmentCount?: number;
  attendance?: Array<{
    id: string;
    customerId: string;
    customerName: string;
    status?: string;
    checkInAt?: string;
    consumedSessions?: number;
    note?: string;
  }>;
};

type TrainingScheduleBoardResponse = {
  date: string;
  totalSessions: number;
  totalTrainers: number;
  sessions: TrainingSessionBoardItem[];
  trainers: TrainerBoardRow[];
};

type CustomerOption = {
  id: string;
  fullName: string;
  phone?: string;
  branchName?: string;
};

type ContractOption = {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  servicePackageName?: string;
  remainingSessions?: number;
  status?: string;
  endDate?: string;
};

type DragSelection = {
  rowId: string;
  startIndex: number;
  currentIndex: number;
};

type ScheduleBoardMode = "trainer" | "location";

type ScheduleBoardRow = {
  id: string;
  branchId: string;
  branchName: string;
  title: string;
  code: string;
  subtitle: string;
  avatarLabel: string;
  bookedMinutes: number;
  sessions: TrainingSessionBoardItem[];
  trainerId?: string;
  trainerName?: string;
  location?: string;
};

type ScheduleBoardGroup = {
  id: string;
  branchName: string;
  rows: ScheduleBoardRow[];
  totalSessions: number;
  bookedMinutes: number;
};

type WeeklyApplyOption = {
  value: number;
  shortLabel: string;
  fullLabel: string;
};

type BookingDialogState =
  | { open: false }
  | {
      open: true;
      mode: "create" | "edit";
      sessionId?: string;
      branchId: string;
      trainerId: string;
      trainerName: string;
      customerId: string;
      customerName: string;
      contractId: string;
      startAt: string;
      endAt: string;
      location: string;
      consumedSessions: number;
      note: string;
      status: string;
      applyWeekly: boolean;
      applyWeekdays: number[];
      participantCustomerIds: string[];
    };

const startOfLocalDay = (value?: Date) => {
  const source = value ? new Date(value) : new Date();
  return new Date(source.getFullYear(), source.getMonth(), source.getDate(), 0, 0, 0, 0);
};

const addDays = (value: Date, amount: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
};

const toDateInputValue = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getIntlLocaleTag = (locale: string) => {
  switch (locale) {
    case "en":
      return "en-US";
    case "ko":
      return "ko-KR";
    default:
      return "vi-VN";
  }
};

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const createWeekdayOptions = (locale: string): WeeklyApplyOption[] => {
  const displayLocale = getIntlLocaleTag(locale);
  const shortFormatter = new Intl.DateTimeFormat(displayLocale, {
    weekday: "short",
  });
  const fullFormatter = new Intl.DateTimeFormat(displayLocale, {
    weekday: "long",
  });
  const monday = new Date(2026, 3, 13, 0, 0, 0, 0);

  return WEEKDAY_ORDER.map((weekday) => {
    const offset = weekday === 0 ? 6 : weekday - 1;
    const date = addDays(monday, offset);
    return {
      value: weekday,
      shortLabel: shortFormatter.format(date),
      fullLabel: fullFormatter.format(date),
    };
  });
};

const toDateTimeLocalValue = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

const parseDateInputValue = (value: string) => {
  const [year, month, day] = value.split("-").map((item) => Number(item));
  return new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0);
};

const parseDateTimeLocalValue = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const combineDateAndMinutes = (date: Date, totalMinutes: number) => {
  const combined = startOfLocalDay(date);
  combined.setMinutes(totalMinutes);
  return combined;
};

const minutesBetween = (start: string, end: string) => {
  const diff = parseDateTimeLocalValue(end).getTime() - parseDateTimeLocalValue(start).getTime();
  return Math.max(SLOT_MINUTES, Math.round(diff / 60000));
};

const buildTimeLabel = (minutes: number) => {
  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
};

const createTimeBoundaryOptions = (extraMinutes: number[] = []) => {
  const minuteSet = new Set<number>([DAY_END_MINUTES, ...extraMinutes]);
  for (let minutes = DAY_START_MINUTES; minutes < DAY_END_MINUTES; minutes += SLOT_MINUTES) {
    minuteSet.add(minutes);
  }

  return Array.from(minuteSet)
    .filter((minutes) => minutes >= DAY_START_MINUTES && minutes <= DAY_END_MINUTES)
    .sort((left, right) => left - right)
    .map((minutes) => ({
      minutes,
      value: buildTimeLabel(minutes),
      label: buildTimeLabel(minutes),
    }));
};

const getDateTimeMinutes = (value: string) => {
  const parsed = parseDateTimeLocalValue(value);
  return parsed.getHours() * 60 + parsed.getMinutes();
};

const setDateTimeToMinutes = (dateTimeValue: string, minutes: number) => {
  const current = parseDateTimeLocalValue(dateTimeValue);
  const next = new Date(current);
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return toDateTimeLocalValue(next);
};

const setDatePartForDateTime = (dateTimeValue: string, dateValue: string) => {
  const current = parseDateTimeLocalValue(dateTimeValue);
  const nextDate = parseDateInputValue(dateValue);
  nextDate.setHours(current.getHours(), current.getMinutes(), 0, 0);
  return toDateTimeLocalValue(nextDate);
};

const createTimeSlots = () => {
  const slots: Array<{ index: number; startMinutes: number; endMinutes: number; label: string }> = [];
  let slotIndex = 0;
  for (let minutes = DAY_START_MINUTES; minutes < DAY_END_MINUTES; minutes += SLOT_MINUTES) {
    slots.push({
      index: slotIndex,
      startMinutes: minutes,
      endMinutes: minutes + SLOT_MINUTES,
      label: `${buildTimeLabel(minutes)} - ${buildTimeLabel(minutes + SLOT_MINUTES)}`,
    });
    slotIndex += 1;
  }
  return slots;
};

const clampSlotIndex = (index: number, slotCount: number) => Math.max(0, Math.min(slotCount - 1, index));

const buildSessionCode = (scheduledAt: Date) => {
  const datePart = `${scheduledAt.getFullYear()}${String(scheduledAt.getMonth() + 1).padStart(2, "0")}${String(scheduledAt.getDate()).padStart(2, "0")}`;
  const timePart = `${String(scheduledAt.getHours()).padStart(2, "0")}${String(scheduledAt.getMinutes()).padStart(2, "0")}`;
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PT-${datePart}-${timePart}-${randomPart}`;
};

const getSelectionBounds = (selection: DragSelection) => ({
  startIndex: Math.min(selection.startIndex, selection.currentIndex),
  endIndex: Math.max(selection.startIndex, selection.currentIndex),
});

const getSessionGridRange = (session: TrainingSessionBoardItem, selectedDate: Date, slotCount: number) => {
  const scheduledAt = new Date(session.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) return null;
  if (scheduledAt.toDateString() !== selectedDate.toDateString()) return null;

  const minutesFromDayStart = scheduledAt.getHours() * 60 + scheduledAt.getMinutes();
  if (minutesFromDayStart + Number(session.durationMinutes || 60) <= DAY_START_MINUTES) return null;
  if (minutesFromDayStart >= DAY_END_MINUTES) return null;

  const startIndex = clampSlotIndex(Math.floor((minutesFromDayStart - DAY_START_MINUTES) / SLOT_MINUTES), slotCount);
  const span = Math.max(1, Math.ceil(Number(session.durationMinutes || 60) / SLOT_MINUTES));

  return {
    startIndex,
    endIndex: clampSlotIndex(startIndex + span - 1, slotCount),
    span: Math.max(1, Math.min(span, slotCount - startIndex)),
  };
};

const getPersonInitials = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "PT";

const formatMinutesLabel = (minutes: number) => {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (hours && remainder) {
    return `${hours}h ${remainder}m`;
  }
  if (hours) {
    return `${hours}h`;
  }
  return `${remainder}m`;
};

const getSessionTimeRangeLabel = (session: TrainingSessionBoardItem) => {
  const startAt = new Date(session.scheduledAt);
  if (Number.isNaN(startAt.getTime())) return "";
  const endAt = new Date(startAt.getTime() + Math.max(SLOT_MINUTES, Number(session.durationMinutes || SLOT_MINUTES)) * 60000);
  return `${buildTimeLabel(startAt.getHours() * 60 + startAt.getMinutes())} - ${buildTimeLabel(endAt.getHours() * 60 + endAt.getMinutes())}`;
};

const normalizeSearchText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const getSessionLocationLabel = (session: TrainingSessionBoardItem) =>
  String(session.location || "").trim() || translateText("Chua gan line / phong");

const buildLocationRowId = (branchId: string | undefined, locationLabel: string) =>
  `${String(branchId || "all")}::${normalizeSearchText(locationLabel) || "unassigned"}`;

const buildBoardRowId = ({
  boardMode,
  branchId,
  trainerId,
  location,
}: {
  boardMode: ScheduleBoardMode;
  branchId?: string;
  trainerId?: string;
  location?: string;
}) => {
  if (boardMode === "location") {
    return buildLocationRowId(
      branchId,
      String(location || "").trim() || translateText("Chua gan line / phong"),
    );
  }

  return String(trainerId || "");
};

const groupSessionsByBoardRow = ({
  sessions,
  boardMode,
  fallbackBranchId,
}: {
  sessions: TrainingSessionBoardItem[];
  boardMode: ScheduleBoardMode;
  fallbackBranchId?: string;
}) => {
  const rows = new Map<string, TrainingSessionBoardItem[]>();

  sessions.forEach((session) => {
    const rowId =
      boardMode === "location"
        ? buildLocationRowId(
            session.branchId || fallbackBranchId,
            getSessionLocationLabel(session),
          )
        : String(session.trainerId || "");

    if (!rowId) return;

    const current = rows.get(rowId) || [];
    current.push(session);
    rows.set(rowId, current);
  });

  return rows;
};

const normalizeSessionMatchValue = (value: unknown) => String(value || "").trim().toLowerCase();

const getScheduledMinutes = (scheduledAt: string) => {
  const parsed = new Date(scheduledAt);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getHours() * 60 + parsed.getMinutes();
};

const findMatchingSessionForApplyDate = ({
  sessions,
  branchId,
  customerId,
  contractId,
  trainerId,
  location,
  preferredMinutes,
  ignoreSessionId,
}: {
  sessions: TrainingSessionBoardItem[];
  branchId?: string;
  customerId: string;
  contractId: string;
  trainerId: string;
  location?: string;
  preferredMinutes: number;
  ignoreSessionId?: string;
}) => {
  const normalizedLocation = normalizeSessionMatchValue(location);
  const normalizedBranchId = String(branchId || "");
  const normalizedCustomerId = String(customerId || "");
  const normalizedContractId = String(contractId || "");
  const normalizedTrainerId = String(trainerId || "");

  return sessions
    .filter((session) => {
      if (ignoreSessionId && session.id === ignoreSessionId) return false;
      if (normalizedBranchId && String(session.branchId || "") !== normalizedBranchId) return false;
      if (String(session.customerId || "") !== normalizedCustomerId) return false;
      if (String(session.contractId || "") !== normalizedContractId) return false;
      if (String(session.trainerId || "") !== normalizedTrainerId) return false;
      return normalizeSessionMatchValue(session.location) === normalizedLocation;
    })
    .sort((left, right) => {
      const leftDistance = Math.abs(getScheduledMinutes(left.scheduledAt) - preferredMinutes);
      const rightDistance = Math.abs(getScheduledMinutes(right.scheduledAt) - preferredMinutes);
      return leftDistance - rightDistance;
    })[0];
};

const isRangeAvailableForDateSessions = ({
  sessions,
  boardMode,
  fallbackBranchId,
  rowId,
  dateValue,
  startIndex,
  endIndex,
  ignoreSessionId,
}: {
  sessions: TrainingSessionBoardItem[];
  boardMode: ScheduleBoardMode;
  fallbackBranchId?: string;
  rowId: string;
  dateValue: string;
  startIndex: number;
  endIndex: number;
  ignoreSessionId?: string;
}) => {
  const targetDate = parseDateInputValue(dateValue);
  const lower = Math.min(startIndex, endIndex);
  const upper = Math.max(startIndex, endIndex);
  const sessionsByBoardRow = groupSessionsByBoardRow({
    sessions,
    boardMode,
    fallbackBranchId,
  });

  return !(sessionsByBoardRow.get(rowId) || []).some((session) => {
    if (ignoreSessionId && session.id === ignoreSessionId) return false;
    const range = getSessionGridRange(session, targetDate, slots.length);
    if (!range) return false;
    return lower <= range.endIndex && upper >= range.startIndex;
  });
};

const getRemainingSessionsLabel = (session: TrainingSessionBoardItem) =>
  session.remainingSessions === null || session.remainingSessions === undefined
    ? ""
    : `${translateText("Con lai")}: ${Math.max(0, Number(session.remainingSessions || 0))}`;

const getSessionParticipants = (session: TrainingSessionBoardItem) => {
  const participants = new Map<string, { customerId: string; customerName: string }>();
  const appendParticipant = (customerId: unknown, customerName: unknown) => {
    const normalizedId = String(customerId || "").trim();
    const normalizedName = String(customerName || "").trim();
    const key = normalizedId || normalizedName;
    if (!key || !normalizedName) return;
    participants.set(key, {
      customerId: normalizedId,
      customerName: normalizedName,
    });
  };

  appendParticipant(session.customerId, session.customerName);
  (session.attendance || []).forEach((item) => appendParticipant(item.customerId, item.customerName));

  return Array.from(participants.values());
};

const getSessionParticipantCount = (session: TrainingSessionBoardItem) =>
  getSessionParticipants(session).length;

const isGroupTrainingSession = (session: TrainingSessionBoardItem) =>
  getSessionParticipantCount(session) > 1;

const getSessionParticipantSummary = (session: TrainingSessionBoardItem, maxNames = 2) => {
  const participants = getSessionParticipants(session).map((item) => item.customerName);
  if (!participants.length) return "";
  if (participants.length <= maxNames) {
    return participants.join(" | ");
  }
  return `${participants.slice(0, maxNames).join(" | ")} +${participants.length - maxNames}`;
};

const getSessionTimeBoundaryLabels = (session: TrainingSessionBoardItem) => {
  const startAt = new Date(session.scheduledAt);
  if (Number.isNaN(startAt.getTime())) {
    return { startLabel: "", endLabel: "" };
  }

  const endAt = new Date(startAt.getTime() + Math.max(SLOT_MINUTES, Number(session.durationMinutes || SLOT_MINUTES)) * 60000);
  return {
    startLabel: buildTimeLabel(startAt.getHours() * 60 + startAt.getMinutes()),
    endLabel: buildTimeLabel(endAt.getHours() * 60 + endAt.getMinutes()),
  };
};

const getStatusBoardTheme = (status?: string) => {
  switch (String(status || "").toUpperCase()) {
    case "CHECKED_IN":
      return {
        blockClassName:
          "border-emerald-400 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white shadow-[0_16px_34px_rgba(16,185,129,0.28)]",
        badgeClassName: "bg-white/20 text-white",
        dotClassName: "bg-emerald-400",
      };
    case "COMPLETED":
      return {
        blockClassName:
          "border-sky-400 bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-500 text-white shadow-[0_16px_34px_rgba(14,165,233,0.28)]",
        badgeClassName: "bg-white/20 text-white",
        dotClassName: "bg-sky-400",
      };
    case "MISSED":
      return {
        blockClassName:
          "border-amber-400 bg-gradient-to-r from-amber-500 via-orange-500 to-orange-400 text-white shadow-[0_16px_34px_rgba(245,158,11,0.26)]",
        badgeClassName: "bg-white/20 text-white",
        dotClassName: "bg-amber-400",
      };
    case "CANCELLED":
      return {
        blockClassName:
          "border-rose-400 bg-gradient-to-r from-rose-500 via-pink-500 to-rose-400 text-white shadow-[0_16px_34px_rgba(244,63,94,0.26)]",
        badgeClassName: "bg-white/20 text-white",
        dotClassName: "bg-rose-400",
      };
    default:
      return {
        blockClassName:
          "border-violet-400 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-500 text-white shadow-[0_16px_34px_rgba(139,92,246,0.28)]",
        badgeClassName: "bg-white/20 text-white",
        dotClassName: "bg-violet-400",
      };
  }
};

const getBoardSlotSurfaceClassName = ({
  occupied,
  selected,
  isHourBoundary,
  hoverable,
}: {
  occupied: boolean;
  selected: boolean;
  isHourBoundary: boolean;
  hoverable: boolean;
}) => {
  const baseClassName = `pointer-events-none ${BOARD_SLOT_SURFACE_INSET_CLASSNAME}`;
  if (selected) {
    return `${baseClassName} border-transparent bg-transparent shadow-none`;
  }

  if (occupied) {
    return `${baseClassName} border-slate-200 bg-slate-100/95`;
  }

  return `${baseClassName} ${
    isHourBoundary ? "border-slate-200/90 bg-white" : "border-slate-100 bg-slate-50/90"
  } ${hoverable ? "group-hover:border-emerald-200 group-hover:bg-emerald-50" : ""}`;
};

const slots = createTimeSlots();
const boardGridTemplate = `minmax(${TRAINER_COLUMN_WIDTH}px, ${TRAINER_COLUMN_WIDTH}px) repeat(${slots.length}, minmax(${SLOT_COLUMN_WIDTH}px, ${SLOT_COLUMN_WIDTH}px))`;

export function PtScheduleCalendarWorkspace({ resource }: { resource: ResourceDefinition }) {
  const { locale } = useLocale();
  const localizedResource = useMemo(() => localizeResourceDefinition(resource), [locale, resource]);
  const supportsParticipantGrouping =
    resource.key === "pt-schedule-calendar" || resource.key === "class-schedule-group-pt";
  const boardContent = useMemo(() => {
    const getUnifiedTrainingSessionEntityLabel = (session: TrainingSessionBoardItem) =>
      isGroupTrainingSession(session) ? translateText("PT nhom") : translateText("Hoi vien");

    const getUnifiedTrainingSessionPrimaryText = (session: TrainingSessionBoardItem) =>
      isGroupTrainingSession(session)
        ? translateText("Lich PT nhom")
        : session.customerName || translateText("Chua chon hoi vien");

    const getUnifiedTrainingSessionSecondaryText = (session: TrainingSessionBoardItem) => {
      if (isGroupTrainingSession(session)) {
        return (
          getSessionParticipantSummary(session, 3) ||
          session.contractPackageName ||
          session.contractCode ||
          session.code
        );
      }

      return session.contractPackageName || session.contractCode || session.code;
    };

    const getUnifiedTrainingSessionMetaItems = (session: TrainingSessionBoardItem) =>
      (
        isGroupTrainingSession(session)
          ? [
              getSessionTimeRangeLabel(session),
              `${translateText("Hoi vien")}: ${getSessionParticipantCount(session)}`,
              session.location,
            ]
          : [
              getSessionTimeRangeLabel(session),
              session.customerPhone,
              getRemainingSessionsLabel(session),
              session.location,
            ]
      ).filter(Boolean);

    switch (resource.key) {
      case "class-schedule-bookings":
        return {
          searchPlaceholder: translateText("Tim booking, hoi vien, PT, line, khu vuc"),
          heroHint: translateText("Nhin theo tung PT de biet hoi vien nao da book lich, o line nao va khung gio nao."),
          entityLabel: () => "Booking",
          primaryText: (session: TrainingSessionBoardItem) => session.customerName || translateText("Chua chon hoi vien"),
          secondaryText: (session: TrainingSessionBoardItem) => session.contractPackageName || session.contractCode || session.code,
          metaItems: (session: TrainingSessionBoardItem) =>
            [
              getSessionTimeRangeLabel(session),
              session.location,
              session.attendanceCount ? `${translateText("So booking")}: ${session.attendanceCount}` : "",
            ].filter(Boolean),
        } as const;
      case "class-schedule-timetable":
        return {
          searchPlaceholder: translateText("Tim lich lop, line, PT, khu vuc"),
          heroHint: translateText("Moi block phai cho thay lop nao dang dien ra va PT nao dang phu trach tren khung gio do."),
          entityLabel: () => "Lop",
          primaryText: (session: TrainingSessionBoardItem) =>
            session.contractPackageName || session.location || session.customerName || session.code,
          secondaryText: (session: TrainingSessionBoardItem) =>
            [session.customerName, session.location].filter(Boolean).join(" | ") || session.code,
          metaItems: (session: TrainingSessionBoardItem) =>
            [
              getSessionTimeRangeLabel(session),
              session.presentCount || session.attendanceCount
                ? `${translateText("Co mat")}: ${session.presentCount || 0}/${session.attendanceCount || 0}`
                : "",
            ].filter(Boolean),
        } as const;
      case "class-schedule-group-pt":
        return {
          searchPlaceholder: translateText("Tim lich PT nhom, PT, hoi vien, khu vuc"),
          heroHint: translateText("Block lich PT nhom can the hien ro nhom dang day, PT phu trach va so hoc vien tham gia."),
          entityLabel: getUnifiedTrainingSessionEntityLabel,
          primaryText: getUnifiedTrainingSessionPrimaryText,
          secondaryText: getUnifiedTrainingSessionSecondaryText,
          metaItems: getUnifiedTrainingSessionMetaItems,
        } as const;
      case "class-schedule-line-schedule":
        return {
          searchPlaceholder: translateText("Tim lich line, khu vuc, PT, booking"),
          heroHint: translateText("Lich line nen cho thay line hoac khu vuc nao dang chay va PT nao dung lop trong khung gio do."),
          entityLabel: () => "Line",
          primaryText: (session: TrainingSessionBoardItem) =>
            session.trainerName || translateText("Chua gan PT"),
          secondaryText: (session: TrainingSessionBoardItem) =>
            [session.contractPackageName, session.customerName].filter(Boolean).join(" | ") || session.code,
          metaItems: (session: TrainingSessionBoardItem) =>
            [
              getSessionTimeRangeLabel(session),
              session.customerPhone,
              session.attendanceCount ? `${translateText("Booking")}: ${session.attendanceCount}` : "",
            ].filter(Boolean),
        } as const;
      default:
        return {
          searchPlaceholder: translateText("Tim PT, hoi vien, SDT, goi tap, dia diem"),
          heroHint: translateText("Nhin theo tung PT de biet hoi vien nao dang duoc xep lich va o khung gio nao."),
          entityLabel: getUnifiedTrainingSessionEntityLabel,
          primaryText: getUnifiedTrainingSessionPrimaryText,
          secondaryText: getUnifiedTrainingSessionSecondaryText,
          metaItems: getUnifiedTrainingSessionMetaItems,
        } as const;
    }
  }, [locale, resource.key]);
  const boardMode: ScheduleBoardMode =
    resource.key === "class-schedule-line-schedule" ? "location" : "trainer";
  const isLocationBoard = boardMode === "location";
  const { user, isReady } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => startOfLocalDay());
  const [branchId, setBranchId] = useState("");
  const [trainerSearch, setTrainerSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);
  const [dialog, setDialog] = useState<BookingDialogState>({ open: false });
  const [customerLookup, setCustomerLookup] = useState("");
  const dragSelectionRef = useRef<DragSelection | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragPointerTargetRef = useRef<HTMLElement | null>(null);
  const rowGridRefs = useRef(new Map<string, HTMLDivElement>());
  const openCreateDialogRef = useRef<(rowId: string, startIndex: number, endIndex: number) => void>(() => undefined);
  const canView = Boolean(user?.permissions.includes("training-sessions.view"));
  const canCreate = Boolean(user?.permissions.includes("training-sessions.create"));
  const canEdit = Boolean(user?.permissions.includes("training-sessions.update"));
  const canDelete = Boolean(user?.permissions.includes("training-sessions.delete"));
  const selectedDateKey = toDateInputValue(selectedDate);
  const effectiveBranchId = branchId || String(user?.branchId || "");

  useEffect(() => {
    if (!user?.branchId || branchId) return;
    setBranchId(String(user.branchId));
  }, [branchId, user?.branchId]);

  const branchesQuery = useQuery({
    queryKey: ["pt-schedule-branches"],
    enabled: isReady,
    queryFn: async () => {
      const response = await api.get<ListResponse<Record<string, unknown>>>("/branches", {
        params: { pageSize: 100, sortBy: "name", sortOrder: "asc" },
      });
      return response.data.data.map((item) => ({
        id: String(item.id || ""),
        name: String(item.name || item.code || ""),
      })) as BranchOption[];
    },
  });

  const boardQuery = useQuery({
    queryKey: ["pt-schedule-board", effectiveBranchId, selectedDateKey],
    enabled: isReady && canView,
    queryFn: async () => {
      const response = await api.get<TrainingScheduleBoardResponse>("/training-sessions/board", {
        params: {
          branchId: effectiveBranchId || undefined,
          dateFrom: selectedDateKey,
        },
      });
      return response.data;
    },
  });

  const customersQuery = useQuery({
    queryKey: ["pt-schedule-customers", dialog.open ? dialog.branchId : effectiveBranchId, customerLookup],
    enabled: dialog.open,
    queryFn: async () => {
      const response = await api.get<ListResponse<Record<string, unknown>>>("/customers", {
        params: {
          branchId: dialog.open ? dialog.branchId || effectiveBranchId || undefined : undefined,
          pageSize: 100,
          search: customerLookup || undefined,
        },
      });
      return response.data.data.map((item) => ({
        id: String(item.id || ""),
        fullName: String(item.fullName || item.customerName || ""),
        phone: String(item.phone || ""),
        branchName: String(item.branchName || ""),
      })) as CustomerOption[];
    },
  });

  const contractsQuery = useQuery({
    queryKey: ["pt-schedule-contracts", dialog.open ? dialog.branchId : effectiveBranchId, dialog.open ? dialog.customerId : ""],
    enabled: dialog.open && Boolean(dialog.customerId),
    queryFn: async () => {
      const response = await api.get<ListResponse<Record<string, unknown>>>("/contracts", {
        params: {
          branchId: dialog.open ? dialog.branchId || effectiveBranchId || undefined : undefined,
          customerId: dialog.open ? dialog.customerId || undefined : undefined,
          status: "ACTIVE",
          pageSize: 100,
          sortBy: "endDate",
          sortOrder: "asc",
        },
      });
      return response.data.data
        .map((item) => ({
          id: String(item.id || ""),
          code: String(item.code || ""),
          customerId: String(item.customerId || ""),
          customerName: String(item.customerName || ""),
          servicePackageName: String(item.servicePackageName || item.packageName || ""),
          remainingSessions: Number(item.remainingSessions || 0),
          status: String(item.status || ""),
          endDate: String(item.endDate || ""),
        }))
        .filter((item) => item.customerId === (dialog.open ? dialog.customerId : ""));
    },
  });

  const trainerMap = useMemo(
    () => new Map((boardQuery.data?.trainers || []).map((trainer) => [trainer.id, trainer])),
    [boardQuery.data?.trainers],
  );
  const allSessions = boardQuery.data?.sessions || [];
  const normalizedBoardSearch = normalizeSearchText(trainerSearch);
  const normalizedMemberSearch = normalizeSearchText(memberSearch);
  const visibleSessions = useMemo(() => {
    return allSessions.filter((session) => {
      const participantSearchTerms = getSessionParticipants(session).map((item) => item.customerName);
      const boardHaystack = normalizeSearchText(
        [
          session.customerName,
          session.customerPhone,
          session.contractCode,
          session.contractPackageName,
          session.location,
          session.trainerName,
          session.code,
          session.branchName,
          ...participantSearchTerms,
          isGroupTrainingSession(session) ? translateText("PT nhom") : "",
        ].join(" "),
      );
      const memberHaystack = normalizeSearchText(
        [
          session.customerName,
          session.customerPhone,
          session.contractCode,
          session.contractPackageName,
          session.remainingSessions,
          ...participantSearchTerms,
        ].join(" "),
      );

      const matchesBoardSearch =
        !normalizedBoardSearch || boardHaystack.includes(normalizedBoardSearch);
      const matchesMemberSearch =
        !normalizedMemberSearch ||
        memberHaystack.includes(normalizedMemberSearch);

      return matchesBoardSearch && matchesMemberSearch;
    });
  }, [allSessions, locale, normalizedBoardSearch, normalizedMemberSearch]);
  const visibleTrainerIds = useMemo(
    () =>
      new Set(
        visibleSessions
          .map((session) => String(session.trainerId || ""))
          .filter(Boolean),
      ),
    [visibleSessions],
  );
  const visibleTrainers = useMemo(() => {
    const trainers = boardQuery.data?.trainers || [];
    if (!normalizedBoardSearch && !normalizedMemberSearch) return trainers;

    return trainers.filter((trainer) => {
      const trainerHaystack = normalizeSearchText(
        [trainer.fullName, trainer.code, trainer.specialty, trainer.branchName].join(
          " ",
        ),
      );

      return (
        visibleTrainerIds.has(trainer.id) ||
        (!!normalizedBoardSearch &&
          trainerHaystack.includes(normalizedBoardSearch))
      );
    });
  }, [
    boardQuery.data?.trainers,
    normalizedBoardSearch,
    normalizedMemberSearch,
    visibleTrainerIds,
  ]);

  const sessionsByTrainer = useMemo(() => {
    const result = new Map<string, TrainingSessionBoardItem[]>();
    visibleSessions.forEach((session) => {
      const trainerId = String(session.trainerId || "");
      if (!trainerId) return;
      const current = result.get(trainerId) || [];
      current.push(session);
      result.set(trainerId, current);
    });
    return result;
  }, [visibleSessions]);

  const currentCustomerOptions = useMemo(() => {
    const options = customersQuery.data || [];
    if (!dialog.open || !dialog.customerId || options.some((item) => item.id === dialog.customerId)) {
      return options;
    }

    return [
      {
        id: dialog.customerId,
        fullName: dialog.customerName,
        phone: "",
        branchName: "",
      },
      ...options,
    ];
  }, [customersQuery.data, dialog]);

  const currentContractOptions = useMemo(() => {
    const options = contractsQuery.data || [];
    if (!dialog.open || !dialog.contractId || options.some((item) => item.id === dialog.contractId)) {
      return options;
    }

    return [
      {
        id: dialog.contractId,
        code: translateText("Hop dong hien tai"),
        customerId: dialog.customerId,
        customerName: dialog.customerName,
        servicePackageName: "",
        remainingSessions: 0,
        status: "",
        endDate: "",
      },
      ...options,
    ];
  }, [contractsQuery.data, dialog]);
  const dialogCustomerId = dialog.open ? dialog.customerId : "";
  const dialogContractId = dialog.open ? dialog.contractId : "";
  const dialogStartAtValue = dialog.open ? dialog.startAt : "";
  const dialogEndAtValue = dialog.open ? dialog.endAt : "";
  const dialogDurationMinutes = dialog.open ? minutesBetween(dialog.startAt, dialog.endAt) : SLOT_MINUTES;
  const dialogStartMinutes = dialog.open ? getDateTimeMinutes(dialog.startAt) : DAY_START_MINUTES;
  const dialogEndMinutes = dialog.open ? getDateTimeMinutes(dialog.endAt) : DAY_START_MINUTES + SLOT_MINUTES;
  const dialogDateValue = dialog.open
    ? toDateInputValue(parseDateTimeLocalValue(dialog.startAt))
    : toDateInputValue(selectedDate);
  const dialogStartTimeOptions = useMemo(
    () => createTimeBoundaryOptions([dialogStartMinutes]).filter((option) => option.minutes < DAY_END_MINUTES),
    [dialogStartMinutes],
  );
  const dialogEndTimeOptions = useMemo(
    () => createTimeBoundaryOptions([dialogEndMinutes]).filter((option) => option.minutes > dialogStartMinutes),
    [dialogEndMinutes, dialogStartMinutes],
  );
  const contractFieldHelperText = dialogCustomerId
    ? currentContractOptions.length > 0
      ? translateText("Chi hien hop dong / goi PT dang hoat dong da ban cho hoi vien nay, khong lay truc tiep tu bang gia.")
      : translateText("Hoi vien nay chua co hop dong PT dang hoat dong. Hay dang ky dich vu truoc khi xep lich.")
    : translateText("Chon hoi vien truoc de tai danh sach hop dong / goi PT da mua.");
  const dialogWeekdayOptions = useMemo(() => createWeekdayOptions(locale), [locale]);
  const dialogContractEndDate =
    dialog.open
      ? currentContractOptions.find((option) => option.id === dialog.contractId)?.endDate || ""
      : "";
  const dialogParticipantCustomerIds = dialog.open
    ? Array.from(new Set([dialog.customerId, ...(dialog.participantCustomerIds || [])].filter(Boolean)))
    : [];

  useEffect(() => {
    if (!dialog.open || !dialogCustomerId || dialogContractId || currentContractOptions.length !== 1) {
      return;
    }

    setDialog((current) =>
      current.open && current.customerId === dialogCustomerId
        ? { ...current, contractId: currentContractOptions[0]?.id || "" }
        : current,
    );
  }, [currentContractOptions, dialogContractId, dialogCustomerId, dialog.open]);

  const closeDialog = () => {
    setDialog({ open: false });
    setCustomerLookup("");
  };

  const updateDialogDate = (dateValue: string) => {
    setDialog((current) => {
      if (!current.open) return current;
      return {
        ...current,
        startAt: setDatePartForDateTime(current.startAt, dateValue),
        endAt: setDatePartForDateTime(current.endAt, dateValue),
      };
    });
  };

  const updateDialogStartTime = (timeValue: string) => {
    const nextMinutes = Number.parseInt(timeValue.slice(0, 2), 10) * 60 + Number.parseInt(timeValue.slice(3, 5), 10);
    setDialog((current) => {
      if (!current.open) return current;
      const nextStartAt = setDateTimeToMinutes(current.startAt, nextMinutes);
      const maxEndMinutes = Math.min(DAY_END_MINUTES, nextMinutes + minutesBetween(current.startAt, current.endAt));
      const nextEndAt = setDateTimeToMinutes(nextStartAt, Math.max(nextMinutes + SLOT_MINUTES, maxEndMinutes));
      return {
        ...current,
        startAt: nextStartAt,
        endAt: nextEndAt,
      };
    });
  };

  const updateDialogEndTime = (timeValue: string) => {
    const nextMinutes = Number.parseInt(timeValue.slice(0, 2), 10) * 60 + Number.parseInt(timeValue.slice(3, 5), 10);
    setDialog((current) => {
      if (!current.open) return current;
      if (nextMinutes <= getDateTimeMinutes(current.startAt)) return current;
      return {
        ...current,
        endAt: setDateTimeToMinutes(current.endAt, nextMinutes),
      };
    });
  };

  const shiftDialogTimeRange = (deltaMinutes: number) => {
    setDialog((current) => {
      if (!current.open) return current;
      const currentStartMinutes = getDateTimeMinutes(current.startAt);
      const currentEndMinutes = getDateTimeMinutes(current.endAt);
      const nextStartMinutes = currentStartMinutes + deltaMinutes;
      const nextEndMinutes = currentEndMinutes + deltaMinutes;
      if (nextStartMinutes < DAY_START_MINUTES || nextEndMinutes > DAY_END_MINUTES) {
        return current;
      }

      return {
        ...current,
        startAt: setDateTimeToMinutes(current.startAt, nextStartMinutes),
        endAt: setDateTimeToMinutes(current.endAt, nextEndMinutes),
      };
    });
  };

  const toggleDialogApplyWeekly = () => {
    setDialog((current) => {
      if (!current.open) {
        return current;
      }

      return {
        ...current,
        applyWeekly: !current.applyWeekly,
        applyWeekdays:
          !current.applyWeekly && current.applyWeekdays.length === 0
            ? [parseDateTimeLocalValue(current.startAt).getDay()]
            : current.applyWeekdays,
      };
    });
  };

  const toggleDialogApplyWeekday = (weekdayValue: number) => {
    setDialog((current) => {
      if (!current.open) {
        return current;
      }

      const alreadySelected = current.applyWeekdays.includes(weekdayValue);
      return {
        ...current,
        applyWeekdays: alreadySelected
          ? current.applyWeekdays.filter((value) => value !== weekdayValue)
          : [...current.applyWeekdays, weekdayValue].sort((left, right) => left - right),
      };
    });
  };

  const toggleDialogParticipantCustomer = (customerId: string) => {
    setDialog((current) => {
      if (!current.open || !supportsParticipantGrouping) {
        return current;
      }

      if (customerId === current.customerId) {
        return current;
      }

      const alreadySelected = current.participantCustomerIds.includes(customerId);
      return {
        ...current,
        participantCustomerIds: alreadySelected
          ? current.participantCustomerIds.filter((value) => value !== customerId)
          : [...current.participantCustomerIds, customerId],
      };
    });
  };

  const isSlotOccupied = (
    rowId: string,
    slotIndex: number,
    ignoreSessionId?: string,
  ) =>
    (sessionsByBoardRow.get(rowId) || []).some((session) => {
      if (ignoreSessionId && session.id === ignoreSessionId) return false;
      const range = getSessionGridRange(session, selectedDate, slots.length);
      if (!range) return false;
      return slotIndex >= range.startIndex && slotIndex <= range.endIndex;
    });

  const isRangeAvailable = (
    rowId: string,
    startIndex: number,
    endIndex: number,
    ignoreSessionId?: string,
  ) => {
    const lower = Math.min(startIndex, endIndex);
    const upper = Math.max(startIndex, endIndex);
    for (let slotIndex = lower; slotIndex <= upper; slotIndex += 1) {
      if (isSlotOccupied(rowId, slotIndex, ignoreSessionId)) {
        return false;
      }
    }
    return true;
  };

  const getBoardSessionsForDate = async (dateValue: string, branchValue: string) => {
    if (dateValue === selectedDateKey && branchValue === effectiveBranchId) {
      return allSessions;
    }

    const response = await api.get<TrainingScheduleBoardResponse>("/training-sessions/board", {
      params: {
        branchId: branchValue || undefined,
        dateFrom: dateValue,
      },
    });
    return response.data.sessions || [];
  };

  const openCreateDialog = (rowId: string, startIndex: number, endIndex: number) => {
    const row = boardRowMap.get(rowId);
    const startSlot = slots[Math.min(startIndex, endIndex)];
    const endSlot = slots[Math.max(startIndex, endIndex)];
    if (!row || !startSlot || !endSlot) return;

    const startAt = combineDateAndMinutes(selectedDate, startSlot.startMinutes);
    const endAt = combineDateAndMinutes(selectedDate, endSlot.endMinutes);
    setDialog({
      open: true,
      mode: "create",
      branchId: row.branchId || effectiveBranchId,
      trainerId: row.trainerId || "",
      trainerName: row.trainerName || "",
      customerId: "",
      customerName: "",
      contractId: "",
      startAt: toDateTimeLocalValue(startAt),
      endAt: toDateTimeLocalValue(endAt),
      location:
        row.location === translateText("Chua gan line / phong")
          ? ""
          : row.location || "",
      consumedSessions: 1,
      note: "",
      status: "SCHEDULED",
      applyWeekly: false,
      applyWeekdays: [selectedDate.getDay()],
      participantCustomerIds: [],
    });
  };

  useEffect(() => {
    dragSelectionRef.current = dragSelection;
  }, [dragSelection]);

  useEffect(() => {
    openCreateDialogRef.current = openCreateDialog;
  }, [openCreateDialog]);

  const openEditDialog = (session: TrainingSessionBoardItem) => {
    if (!canEdit) return;

    const startAt = parseDateTimeLocalValue(session.scheduledAt);
    const endAt = new Date(startAt.getTime() + Number(session.durationMinutes || 60) * 60000);
    const participantCustomerIds = Array.from(
      new Set(
        [session.customerId, ...(session.attendance || []).map((item) => String(item.customerId || ""))]
          .filter(Boolean),
      ),
    ).filter((value) => value !== session.customerId);
    setDialog({
      open: true,
      mode: "edit",
      sessionId: session.id,
      branchId: session.branchId || effectiveBranchId,
      trainerId: String(session.trainerId || ""),
      trainerName: String(session.trainerName || trainerMap.get(String(session.trainerId || ""))?.fullName || ""),
      customerId: session.customerId,
      customerName: session.customerName,
      contractId: String(session.contractId || ""),
      startAt: toDateTimeLocalValue(startAt),
      endAt: toDateTimeLocalValue(endAt),
      location: String(session.location || ""),
      consumedSessions: Number(session.consumedSessions || 1),
      note: String(session.note || ""),
      status: String(session.status || "SCHEDULED"),
      applyWeekly: false,
      applyWeekdays: [startAt.getDay()],
      participantCustomerIds,
    });
  };

  const updateSlotSelection = (rowId: string, slotIndex: number) => {
    const currentSelection = dragSelectionRef.current;
    if (!currentSelection || currentSelection.rowId !== rowId) return;
    if (!isRangeAvailable(rowId, currentSelection.startIndex, slotIndex)) return;
    if (currentSelection.currentIndex === slotIndex) return;
    const nextSelection = { ...currentSelection, currentIndex: slotIndex };
    dragSelectionRef.current = nextSelection;
    setDragSelection(nextSelection);
  };

  const setRowGridRef = (rowId: string, element: HTMLDivElement | null) => {
    if (element) {
      rowGridRefs.current.set(rowId, element);
      return;
    }
    rowGridRefs.current.delete(rowId);
  };

  const releaseCapturedPointer = (pointerId?: number | null) => {
    const target = dragPointerTargetRef.current;
    if (
      target &&
      pointerId !== undefined &&
      pointerId !== null &&
      target.hasPointerCapture(pointerId)
    ) {
      try {
        target.releasePointerCapture(pointerId);
      } catch {
        // Ignore capture release failures during teardown.
      }
    }
    dragPointerIdRef.current = null;
    dragPointerTargetRef.current = null;
  };

  const getSlotIndexFromClientX = (rowId: string, clientX: number) => {
    const rowGridElement = rowGridRefs.current.get(rowId);
    if (!rowGridElement) return null;
    const slotElements = Array.from(
      rowGridElement.querySelectorAll<HTMLElement>('[data-board-slot="true"]'),
    );
    if (!slotElements.length) return null;

    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    slotElements.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const distance = Math.abs(clientX - centerX);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    return clampSlotIndex(closestIndex, slots.length);
  };

  const beginSlotSelection = (
    event: ReactPointerEvent<HTMLDivElement>,
    rowId: string,
    slotIndex: number,
  ) => {
    const occupied = isSlotOccupied(rowId, slotIndex);
    if (!canCreate || event.button !== 0 || occupied) return;
    const selection = { rowId, startIndex: slotIndex, currentIndex: slotIndex };
    dragSelectionRef.current = selection;
    dragPointerIdRef.current = event.pointerId;
    dragPointerTargetRef.current = event.currentTarget;
    setDragSelection(selection);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore browsers/runtime paths that reject explicit capture here.
    }
    event.preventDefault();
  };

  const startRowSelection = (
    event: ReactPointerEvent<HTMLDivElement>,
    rowId: string,
  ) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-row-meta='true']") || target?.closest("[data-session-block='true']")) {
      return;
    }

    const slotIndex = getSlotIndexFromClientX(rowId, event.clientX);
    if (slotIndex === null) return;
    beginSlotSelection(event, rowId, slotIndex);
  };

  const finalizeSlotSelection = (clientX: number, pointerId?: number | null) => {
    const selection = dragSelectionRef.current;
    if (!selection) return;

    const slotIndex = getSlotIndexFromClientX(selection.rowId, clientX);
    if (slotIndex !== null) {
      updateSlotSelection(selection.rowId, slotIndex);
    }

    const finalSelection = dragSelectionRef.current;
    if (!finalSelection) {
      releaseCapturedPointer(pointerId);
      return;
    }

    const { startIndex, endIndex } = getSelectionBounds(finalSelection);
    releaseCapturedPointer(pointerId);
    openCreateDialogRef.current(finalSelection.rowId, startIndex, endIndex);
    dragSelectionRef.current = null;
    setDragSelection(null);
  };

  const handleRowPointerUpCapture = (
    event: ReactPointerEvent<HTMLDivElement>,
    rowId: string,
  ) => {
    const selection = dragSelectionRef.current;
    const activePointerId = dragPointerIdRef.current;
    if (
      !selection ||
      selection.rowId !== rowId ||
      (activePointerId !== null && event.pointerId !== activePointerId)
    ) {
      return;
    }

    finalizeSlotSelection(event.clientX, event.pointerId);
  };

  const handleSlotPointerUp = (
    event: ReactPointerEvent<HTMLDivElement>,
    rowId: string,
  ) => {
    const selection = dragSelectionRef.current;
    const activePointerId = dragPointerIdRef.current;
    if (
      !selection ||
      selection.rowId !== rowId ||
      (activePointerId !== null && event.pointerId !== activePointerId)
    ) {
      return;
    }

    finalizeSlotSelection(event.clientX, event.pointerId);
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const activePointerId = dragPointerIdRef.current;
      const selection = dragSelectionRef.current;
      if (!selection || activePointerId === null || event.pointerId !== activePointerId) return;
      const slotIndex = getSlotIndexFromClientX(selection.rowId, event.clientX);
      if (slotIndex === null) return;
      updateSlotSelection(selection.rowId, slotIndex);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const activePointerId = dragPointerIdRef.current;
      if (activePointerId !== null && event.pointerId !== activePointerId) return;
      finalizeSlotSelection(event.clientX, event.pointerId);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      const activePointerId = dragPointerIdRef.current;
      if (activePointerId !== null && event.pointerId !== activePointerId) return;
      releaseCapturedPointer(event.pointerId);
      dragSelectionRef.current = null;
      setDragSelection(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!dialog.open) return { savedCount: 0 };

      const startAt = parseDateTimeLocalValue(dialog.startAt);
      const endAt = parseDateTimeLocalValue(dialog.endAt);
      if (endAt <= startAt) {
        throw new Error(translateText("Khung gio ket thuc phai lon hon gio bat dau."));
      }

      const durationMinutes = minutesBetween(dialog.startAt, dialog.endAt);
      const startIndex = clampSlotIndex(Math.floor(((startAt.getHours() * 60 + startAt.getMinutes()) - DAY_START_MINUTES) / SLOT_MINUTES), slots.length);
      const endIndex = clampSlotIndex(Math.ceil(((endAt.getHours() * 60 + endAt.getMinutes()) - DAY_START_MINUTES) / SLOT_MINUTES) - 1, slots.length);
      const boardRowId = buildBoardRowId({
        boardMode,
        branchId: dialog.branchId,
        trainerId: dialog.trainerId,
        location: dialog.location,
      });
      if (!boardRowId) {
        throw new Error(
          translateText("Vui long chon PT truoc khi luu lich."),
        );
      }
      const payload = {
        branchId: dialog.branchId,
        contractId: dialog.contractId || undefined,
        customerId: dialog.customerId,
        trainerId: dialog.trainerId || undefined,
        durationMinutes,
        location: dialog.location.trim() || undefined,
        status: dialog.status || "SCHEDULED",
        consumedSessions: Number(dialog.consumedSessions || 1),
        note: dialog.note.trim() || undefined,
        participantCustomerIds: supportsParticipantGrouping
          ? dialog.mode === "create"
            ? dialog.participantCustomerIds.length > 0
              ? dialogParticipantCustomerIds
              : undefined
            : dialog.participantCustomerIds.length > 0
              ? dialogParticipantCustomerIds
              : []
          : undefined,
      };

      if (dialog.mode === "edit" && dialog.sessionId && dialog.applyWeekly && dialog.applyWeekdays.length > 0) {
        const response = await api.post<{ savedCount?: number }>(`/training-sessions/${dialog.sessionId}/sync-weekly`, {
          ...payload,
          boardMode,
          scheduledAt: startAt.toISOString(),
          weekdayValues: dialog.applyWeekdays,
        });
        return { savedCount: Number(response.data?.savedCount || 1) };
      }

      if (!isRangeAvailable(boardRowId, startIndex, endIndex, dialog.mode === "edit" ? dialog.sessionId : undefined)) {
        throw new Error(
          translateText(
            isLocationBoard
              ? "Khung gio line / phong nay da co lich. Hay chon moc khac."
              : "Khung gio nay da co lich PT. Hay chon moc khac.",
          ),
        );
      }

      if (dialog.mode === "edit" && dialog.sessionId) {
        await api.patch(`/training-sessions/${dialog.sessionId}`, {
          ...payload,
          scheduledAt: startAt.toISOString(),
        });
        return { savedCount: 1 };
      }

      await api.post("/training-sessions", {
        ...payload,
        code: buildSessionCode(startAt),
        scheduledAt: startAt.toISOString(),
      });
      return { savedCount: 1 };
    },
    onSuccess: async (result) => {
      const savedCount = Math.max(1, Number(result?.savedCount || 1));
      toast.success(savedCount > 1 ? `${translateText("Da luu lich PT.")} (${savedCount})` : translateText("Da luu lich PT."));
      closeDialog();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pt-schedule-board"] }),
        queryClient.invalidateQueries({ queryKey: ["training-sessions"] }),
      ]);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : translateText("Khong luu duoc lich PT.");
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string) => api.delete(`/training-sessions/${sessionId}`),
    onSuccess: async () => {
      toast.success(translateText("Da xoa lich PT."));
      closeDialog();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pt-schedule-board"] }),
        queryClient.invalidateQueries({ queryKey: ["training-sessions"] }),
      ]);
    },
    onError: () => toast.error(translateText("Khong xoa duoc lich PT.")),
  });

  const selectedBranchName =
    branchesQuery.data?.find((branch) => branch.id === effectiveBranchId)?.name || user?.branchName || translateText("Toan he thong");
  const bookedMinutesByTrainer = useMemo(() => {
    const result = new Map<string, number>();
    sessionsByTrainer.forEach((sessions, trainerId) => {
      result.set(
        trainerId,
        sessions.reduce((sum, session) => sum + Math.max(SLOT_MINUTES, Number(session.durationMinutes || SLOT_MINUTES)), 0),
      );
    });
    return result;
  }, [sessionsByTrainer]);
  const trainerGroups = useMemo<ScheduleBoardGroup[]>(() => {
    const groups = new Map<string, ScheduleBoardGroup>();

    visibleTrainers.forEach((trainer) => {
      const groupId = String(trainer.branchId || trainer.branchName || "unassigned");
      const trainerSessions = [...(sessionsByTrainer.get(trainer.id) || [])].sort(
        (left, right) =>
          new Date(left.scheduledAt).getTime() -
          new Date(right.scheduledAt).getTime(),
      );
      const bookedMinutes = bookedMinutesByTrainer.get(trainer.id) || 0;
      const current =
        groups.get(groupId) ||
        {
          id: groupId,
          branchName:
            trainer.branchName ||
            selectedBranchName ||
            translateText("Chua gan chi nhanh"),
          rows: [],
          totalSessions: 0,
          bookedMinutes: 0,
        };

      current.rows.push({
        id: trainer.id,
        branchId: trainer.branchId || "",
        branchName:
          trainer.branchName ||
          current.branchName ||
          translateText("Chua gan chi nhanh"),
        title: trainer.fullName,
        code: trainer.code || "PT",
        subtitle:
          [trainer.branchName, trainer.specialty].filter(Boolean).join(" | ") ||
          "-",
        avatarLabel: getPersonInitials(trainer.fullName),
        bookedMinutes,
        sessions: trainerSessions,
        trainerId: trainer.id,
        trainerName: trainer.fullName,
        location: "",
      });
      current.totalSessions += trainerSessions.length;
      current.bookedMinutes += bookedMinutes;
      groups.set(groupId, current);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        rows: [...group.rows].sort((left, right) =>
          left.title.localeCompare(right.title),
        ),
      }))
      .sort((left, right) => left.branchName.localeCompare(right.branchName));
  }, [
    bookedMinutesByTrainer,
    selectedBranchName,
    sessionsByTrainer,
    visibleTrainers,
  ]);
  const locationGroups = useMemo<ScheduleBoardGroup[]>(() => {
    const groups = new Map<
      string,
      ScheduleBoardGroup & { rowMap: Map<string, ScheduleBoardRow> }
    >();

    visibleSessions.forEach((session) => {
      const branchId = String(session.branchId || effectiveBranchId || "");
      const branchName =
        session.branchName ||
        selectedBranchName ||
        translateText("Chua gan chi nhanh");
      const locationLabel = getSessionLocationLabel(session);
      const rowId = buildLocationRowId(branchId, locationLabel);
      const durationMinutes = Math.max(
        SLOT_MINUTES,
        Number(session.durationMinutes || SLOT_MINUTES),
      );
      const current =
        groups.get(branchId || branchName) ||
        {
          id: branchId || branchName,
          branchName,
          rows: [],
          totalSessions: 0,
          bookedMinutes: 0,
          rowMap: new Map<string, ScheduleBoardRow>(),
        };

      let row = current.rowMap.get(rowId);
      if (!row) {
        row = {
          id: rowId,
          branchId,
          branchName,
          title: locationLabel,
          code: translateText("Line / Phong"),
          subtitle: "",
          avatarLabel: getPersonInitials(locationLabel),
          bookedMinutes: 0,
          sessions: [],
          location: locationLabel,
        };
        current.rowMap.set(rowId, row);
        current.rows.push(row);
      }

      row.sessions.push(session);
      row.bookedMinutes += durationMinutes;
      current.totalSessions += 1;
      current.bookedMinutes += durationMinutes;
      groups.set(branchId || branchName, current);
    });

    return Array.from(groups.values())
      .map((group) => ({
        id: group.id,
        branchName: group.branchName,
        totalSessions: group.totalSessions,
        bookedMinutes: group.bookedMinutes,
        rows: group.rows
          .map((row) => {
            const trainerNames = Array.from(
              new Set(
                row.sessions
                  .map((session) => String(session.trainerName || "").trim())
                  .filter(Boolean),
              ),
            );
            return {
              ...row,
              subtitle:
                trainerNames.join(" | ") || translateText("Chua gan PT"),
              sessions: [...row.sessions].sort(
                (left, right) =>
                  new Date(left.scheduledAt).getTime() -
                  new Date(right.scheduledAt).getTime(),
              ),
            };
          })
          .sort((left, right) => left.title.localeCompare(right.title)),
      }))
      .sort((left, right) => left.branchName.localeCompare(right.branchName));
  }, [effectiveBranchId, selectedBranchName, visibleSessions]);
  const scheduleGroups = isLocationBoard ? locationGroups : trainerGroups;
  const boardRowMap = useMemo(() => {
    const rows = new Map<string, ScheduleBoardRow>();
    scheduleGroups.forEach((group) => {
      group.rows.forEach((row) => {
        rows.set(row.id, row);
      });
    });
    return rows;
  }, [scheduleGroups]);
  const sessionsByBoardRow = useMemo(
    () =>
      groupSessionsByBoardRow({
        sessions: allSessions,
        boardMode,
        fallbackBranchId: effectiveBranchId,
      }),
    [allSessions, boardMode, effectiveBranchId],
  );
  const totalBookedMinutes = useMemo(
    () => visibleSessions.reduce((sum, session) => sum + Math.max(SLOT_MINUTES, Number(session.durationMinutes || SLOT_MINUTES)), 0),
    [visibleSessions],
  );
  const totalBoardRows = scheduleGroups.reduce(
    (total, group) => total + group.rows.length,
    0,
  );
  const averageBookedMinutes =
    totalBoardRows > 0 ? Math.round(totalBookedMinutes / totalBoardRows) : 0;
  const boardAxisLabel = isLocationBoard
    ? translateText("Line / Phong")
    : translateText("PT");
  const hasActiveDragSelection = Boolean(dragSelection);
  const dialogLabelClassName = "space-y-1.5 text-sm";
  const dialogLabelTextClassName = "text-sm font-semibold text-slate-700";
  const dialogFieldClassName =
    "h-10 w-full rounded-[0.8rem] border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400";
  const dialogTextareaClassName =
    "min-h-[96px] w-full rounded-[0.8rem] border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400";
  const dialogChipClassName =
    "rounded-full px-3 py-1.5 text-sm font-semibold transition";

  if (isReady && !canView) {
    return (
      <EmptyState
        description={translateText("Vai tro hien tai chua duoc cap quyen xem lich PT.")}
        title={translateText("Khong co quyen xem module")}
      />
    );
  }

  return (
    <div className="pt-schedule-workspace space-y-3">
      <PageHeader
        title={localizedResource.title}
        subtitle={localizedResource.subtitle}
        actions={
          <div className="flex min-w-[min(100%,680px)] flex-1 flex-wrap items-center justify-end gap-2">
            <div className="min-w-[220px] max-w-[360px] flex-1">
              <SearchBar onChange={setTrainerSearch} placeholder={boardContent.searchPlaceholder} value={trainerSearch} />
            </div>
            <div className="flex items-center gap-2">
              <button className="secondary-button px-3" onClick={() => setSelectedDate((current) => addDays(current, -1))} type="button">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button className="secondary-button" onClick={() => setSelectedDate(startOfLocalDay())} type="button">
                {translateText("Hom nay")}
              </button>
              <button className="secondary-button px-3" onClick={() => setSelectedDate((current) => addDays(current, 1))} type="button">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        }
      />

      <div className="grid items-start gap-3 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <section className="rounded-[1rem] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{translateText("Chi nhanh")}</p>
            <select
              className="mt-3 h-11 w-full rounded-[0.82rem] border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400"
              onChange={(event) => setBranchId(event.target.value)}
              value={effectiveBranchId}
            >
              {user?.branchId ? null : <option value="">{translateText("Toan he thong")}</option>}
              {(branchesQuery.data || []).map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </section>

          <section className="rounded-[1rem] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{translateText("Thoi gian")}</p>
            <input
              className="mt-3 h-11 w-full rounded-[0.82rem] border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400"
              onChange={(event) => setSelectedDate(parseDateInputValue(event.target.value))}
              type="date"
              value={selectedDateKey}
            />
          </section>

          <section className="rounded-[1rem] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{translateText("Hoi vien / lien he")}</p>
            <input
              className="mt-3 h-11 w-full rounded-[0.82rem] border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400"
              onChange={(event) => setMemberSearch(event.target.value)}
              placeholder={translateText("Loc theo hoi vien, SDT, ma hop dong")}
              value={memberSearch}
            />
          </section>

          <section className="rounded-[1rem] border border-emerald-100 bg-emerald-50/80 p-4 text-sm text-emerald-900 shadow-[0_10px_30px_rgba(16,185,129,0.08)]">
            <p className="font-semibold">{translateText("Cau hinh Booking")}</p>
            <p className="mt-2 leading-6">
              {translateText(
                isLocationBoard
                  ? "Bam nhanh vao 1 o trong de tao lich 30 phut, hoac keo tren dung hang cua line / phong de mo rong khung gio. Chon PT trong form neu dang tao tu man hinh line."
                  : "Bam nhanh vao 1 o trong de tao lich 30 phut, hoac keo tu moc bat dau den moc ket thuc tren dung hang cua PT.",
              )}
            </p>
            <p className="mt-2 text-xs text-emerald-700">
              {canCreate
                ? translateText(
                    isLocationBoard
                      ? "Moi block la mot khung line dang chay. Ban co the xep PT va hoi vien trong form chi tiet."
                      : "Moi block la mot buoi PT. Ban co the tao nhieu block trong cung mot ngay cho mot PT.",
                  )
                : translateText("Tai khoan hien tai chi co quyen xem lich.")}
            </p>
          </section>
        </aside>

        <section className="space-y-4">
          <div className="overflow-hidden rounded-[1.2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_32%),linear-gradient(135deg,_#f8fafc,_#ffffff_42%,_#eefbf5)] shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
              <div className="max-w-2xl">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span className="font-semibold text-emerald-700">{localizedResource.title}</span>
                  <span className="text-slate-300">|</span>
                  <span className="font-semibold text-slate-900">{selectedBranchName}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {canCreate ? boardContent.heroHint : translateText("Tai khoan hien tai chi co quyen xem lich.")}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1rem] border border-white/70 bg-white/85 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <CalendarDays className="h-4 w-4 text-emerald-600" />
                    {translateText("Ngay dang xem")}
                  </div>
                  <p className="mt-2 text-base font-semibold text-slate-900">{formatDate(selectedDate)}</p>
                </div>
                <div className="rounded-[1rem] border border-white/70 bg-white/85 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <UsersRound className="h-4 w-4 text-emerald-600" />
                    {boardAxisLabel}
                  </div>
                  <p className="mt-2 text-base font-semibold text-slate-900">{totalBoardRows || (isLocationBoard ? 0 : boardQuery.data?.totalTrainers || visibleTrainers.length)}</p>
                </div>
                <div className="rounded-[1rem] border border-white/70 bg-white/85 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <Clock3 className="h-4 w-4 text-emerald-600" />
                    {translateText("Tong lich dat")}
                  </div>
                  <p className="mt-2 text-base font-semibold text-slate-900">{visibleSessions.length}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatMinutesLabel(totalBookedMinutes)}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-emerald-100/80 bg-white/70 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                {STATUS_LEGEND.map((status) => {
                  const theme = getStatusBoardTheme(status);
                  return (
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5" key={status}>
                      <span className={`h-2.5 w-2.5 rounded-full ${theme.dotClassName}`} />
                      {translateStatus(status).label}
                    </span>
                  );
                })}
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">
                  <span className="h-2.5 w-2.5 rounded-full border border-emerald-500 bg-emerald-200" />
                  {translateText("Keo de tao lich moi")}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5">
                  {`TB / ${boardAxisLabel}: ${formatMinutesLabel(averageBookedMinutes)}`}
                </span>
              </div>
            </div>
          </div>

          {boardQuery.isLoading ? (
            <div className="rounded-[1rem] border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-emerald-600" />
              {translateText("Dang tai lich PT...")}
            </div>
          ) : boardQuery.isError ? (
            <EmptyState
              description={translateText("Khong tai duoc du lieu lich PT. Hay kiem tra API va quyen truy cap.")}
              title={translateText("Module gap loi")}
            />
          ) : !scheduleGroups.length ? (
            <EmptyState
              description={
                isLocationBoard
                  ? translateText("Khong tim thay line / phong nao theo bo loc hien tai.")
                  : translateText("Khong tim thay PT nao theo bo loc hien tai.")
              }
              title={
                isLocationBoard
                  ? translateText("Chua co line / phong")
                  : translateText("Chua co PT")
              }
            />
          ) : (
            <div className="overflow-auto rounded-[1.25rem] border border-slate-200 bg-[#f8fafc] p-1 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
              <div className="min-w-max space-y-4">
                {scheduleGroups.map((group) => (
                  <div className="overflow-hidden rounded-[1rem] border border-slate-200 bg-white" key={group.id}>
                    <div className="border-b border-slate-800 bg-slate-950 px-4 py-2.5 text-white">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-medium uppercase tracking-[0.12em] text-slate-400">{translateText("Chi nhanh")}</span>
                          <span className="font-semibold text-sm text-white">{group.branchName}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-200">
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{formatDate(selectedDate)}</span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{`${group.rows.length} ${boardAxisLabel}`}</span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{`${translateText("Tong lich dat")}: ${group.totalSessions}`}</span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{formatMinutesLabel(group.bookedMinutes)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50">
                      <div className="grid border-b border-slate-200 bg-slate-900" style={{ gridTemplateColumns: boardGridTemplate }}>
                        <div className="sticky left-0 z-20 flex items-center gap-3 border-r border-white/10 bg-slate-900 px-3 py-2.5 text-white">
                          <div className="grid h-9 w-9 place-items-center rounded-[0.9rem] bg-white/10 text-xs font-semibold">{group.rows.length}</div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{boardAxisLabel}</p>
                            <p className="mt-0.5 text-xs font-medium text-white/80">{formatDate(selectedDate)}</p>
                          </div>
                        </div>
                        {slots.map((slot) => (
                          <div
                            className={`flex h-12 flex-col items-center justify-center border-r border-white/10 px-1 text-center ${
                              slot.startMinutes % 60 === 0 ? "bg-slate-900" : "bg-slate-800/95"
                            }`}
                            key={`${group.id}-${slot.index}`}
                          >
                            <span className="text-[11px] font-semibold text-white">{buildTimeLabel(slot.startMinutes)}</span>
                            <span className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-slate-400">{slot.startMinutes % 60 === 0 ? "00" : "30"}</span>
                          </div>
                        ))}
                      </div>

                      {group.rows.map((row) => {
                        const rowSessions = row.sessions;
                        const selectionBounds =
                          dragSelection && dragSelection.rowId === row.id ? getSelectionBounds(dragSelection) : null;
                        const bookedMinutes = row.bookedMinutes;
                        const utilization = Math.min(100, Math.round((bookedMinutes / (DAY_END_MINUTES - DAY_START_MINUTES)) * 100));
                        const selectionRangeLabel =
                          selectionBounds && slots[selectionBounds.startIndex] && slots[selectionBounds.endIndex]
                            ? `${buildTimeLabel(slots[selectionBounds.startIndex]!.startMinutes)} - ${buildTimeLabel(slots[selectionBounds.endIndex]!.endMinutes)}`
                            : "";

                        return (
                          <div
                            className="relative grid min-h-[84px] overflow-hidden border-b border-slate-200 last:border-b-0"
                            key={row.id}
                            onPointerDown={(event) => startRowSelection(event, row.id)}
                            onPointerUpCapture={(event) => handleRowPointerUpCapture(event, row.id)}
                            ref={(element) => setRowGridRef(row.id, element)}
                            style={{ gridTemplateColumns: boardGridTemplate, touchAction: "none" }}
                          >
                            <div className="sticky left-0 z-10 flex flex-col justify-center border-r border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur" data-row-meta="true">
                              <div className="flex items-start gap-3">
                                <div className="grid h-10 w-10 place-items-center rounded-[1.1rem] bg-slate-950 text-xs font-semibold text-white">
                                  {row.avatarLabel}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[13px] font-semibold text-slate-900">{row.title}</p>
                                  <p className="mt-0.5 text-[11px] text-slate-500">{row.code || boardAxisLabel}</p>
                                  <p className="mt-0.5 truncate text-[10px] text-slate-500">{row.subtitle || "-"}</p>
                                </div>
                              </div>

                              <div className="mt-2.5">
                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${utilization}%` }} />
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                                  <span>{`${translateText("Tong lich dat")}: ${rowSessions.length}`}</span>
                                  <span>{formatMinutesLabel(bookedMinutes)}</span>
                                </div>
                              </div>
                            </div>

                            {slots.map((slot) => {
                              const occupied = isSlotOccupied(row.id, slot.index);
                              const isHourBoundary = slot.startMinutes % 60 === 0;
                              const selected =
                                Boolean(
                                  selectionBounds &&
                                    slot.index >= selectionBounds.startIndex &&
                                    slot.index <= selectionBounds.endIndex,
                                );
                              const selectable = canCreate && !occupied;
                              const hoverable = selectable && !hasActiveDragSelection;

                              return (
                                <div
                                  className={`group relative select-none transition ${
                                    isHourBoundary ? "border-r border-slate-200" : "border-r border-slate-100"
                                  } ${selectable ? "z-20 cursor-crosshair" : "z-0"}`}
                                  data-board-slot="true"
                                  data-row-id={row.id}
                                  data-slot-index={slot.index}
                                  key={`${row.id}-${slot.index}`}
                                  onPointerDown={
                                    selectable
                                      ? (event) => {
                                          event.stopPropagation();
                                          beginSlotSelection(event, row.id, slot.index);
                                        }
                                      : undefined
                                  }
                                  onPointerUp={
                                    selectable
                                      ? (event) => handleSlotPointerUp(event, row.id)
                                      : undefined
                                  }
                                  style={{ gridColumn: slot.index + 2, gridRow: 1 }}
                                  title={
                                    selectable
                                      ? `${slot.label} | ${translateText("Bam de tao lich 30 phut hoac keo de mo rong")}`
                                      : slot.label
                                  }
                                >
                                  <div className={getBoardSlotSurfaceClassName({ occupied, selected, isHourBoundary, hoverable })} />
                                </div>
                              );
                            })}

                            {rowSessions.map((session) => {
                              const range = getSessionGridRange(session, selectedDate, slots.length);
                              if (!range) return null;
                              const theme = getStatusBoardTheme(session.status);
                              const durationLabel = formatMinutesLabel(Math.max(SLOT_MINUTES, Number(session.durationMinutes || SLOT_MINUTES)));
                              const timeBoundaryLabels = getSessionTimeBoundaryLabels(session);
                              const isCompactBlock = range.span <= 1;
                              const primaryText = boardContent.primaryText(session);
                              const secondaryText = boardContent.secondaryText(session);
                              const metaItems = boardContent.metaItems(session);
                              const timeRangeLabel = getSessionTimeRangeLabel(session);
                              const compactMeta =
                                metaItems.find((item) => item !== timeRangeLabel) || "";

                              return (
                                <button
                                  className={`group relative z-10 ${BOARD_GRID_ITEM_INSET_CLASSNAME} flex min-h-[72px] flex-col overflow-hidden rounded-[0.95rem] border text-left ${theme.blockClassName} ${
                                    isCompactBlock ? "justify-between px-2 py-2" : "justify-between px-3 py-2"
                                  }`}
                                  data-session-block="true"
                                  key={session.id}
                                  onClick={() => openEditDialog(session)}
                                  style={{ gridColumn: `${range.startIndex + 2} / span ${range.span}`, gridRow: 1 }}
                                  title={`${primaryText} | ${timeRangeLabel} | ${durationLabel}`}
                                  type="button"
                                >
                                  <span className={`absolute inset-y-2 left-1.5 rounded-full bg-white/45 ${isCompactBlock ? "w-[3px]" : "w-1"}`} />

                                  {isCompactBlock ? (
                                    <>
                                      <div className="relative flex items-center justify-between gap-1 pl-2">
                                        <span className="h-2 w-2 shrink-0 rounded-full bg-white/80" />
                                        <span className="rounded-full bg-white/12 px-1.5 py-0.5 text-[9px] font-semibold text-white/90">{durationLabel}</span>
                                      </div>

                                      <div className="relative min-w-0 pl-2">
                                        <p className="truncate text-[10px] font-semibold leading-4">{primaryText}</p>
                                        {secondaryText ? <p className="mt-0.5 truncate text-[9px] text-white/80">{secondaryText}</p> : null}
                                        {compactMeta ? <p className="mt-0.5 truncate text-[8.5px] text-white/70">{compactMeta}</p> : null}
                                      </div>

                                      <div className="relative space-y-0.5 pl-2 text-[9px] text-white/90">
                                        <div className="flex items-center gap-1">
                                          <Clock3 className="h-2.5 w-2.5 shrink-0" />
                                          <span className="font-semibold">{timeBoundaryLabels.startLabel}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-white/80">
                                          <span className="ml-[2px] h-1.5 w-1.5 shrink-0 rounded-full bg-white/60" />
                                          <span>{timeBoundaryLabels.endLabel}</span>
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="relative flex items-start justify-between gap-2 pl-2.5">
                                        <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${theme.badgeClassName}`}>
                                          {translateStatus(session.status || "SCHEDULED").label}
                                        </span>
                                        <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85">
                                          {boardContent.entityLabel(session)}
                                        </span>
                                        {canEdit ? <span className="text-[10px] font-semibold text-white/70 opacity-0 transition group-hover:opacity-100">{translateText("Sua")}</span> : null}
                                      </div>

                                      <div className="relative min-w-0 pl-2.5">
                                        <p className="truncate text-xs font-semibold">{primaryText}</p>
                                        <p className="mt-1 truncate text-[11px] text-white/85">{secondaryText}</p>
                                      </div>

                                      <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1 pl-2.5 text-[10px] text-white/85">
                                        {metaItems.map((item, index) => (
                                          <span className="inline-flex min-w-0 items-center gap-1 truncate" key={`${session.id}-meta-${index}`}>
                                            {index === 0 ? <Clock3 className="h-3 w-3 shrink-0" /> : <MapPin className="h-3 w-3 shrink-0" />}
                                            <span className="truncate">{item}</span>
                                          </span>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </button>
                              );
                            })}

                            {selectionBounds ? (
                              <div
                                className={`pointer-events-none relative z-30 ${BOARD_GRID_ITEM_INSET_CLASSNAME} rounded-[0.95rem] border-2 border-dashed border-emerald-500 bg-emerald-200/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)]`}
                                style={{
                                  gridColumn: `${selectionBounds.startIndex + 2} / span ${selectionBounds.endIndex - selectionBounds.startIndex + 1}`,
                                  gridRow: 1,
                                }}
                              >
                                {selectionRangeLabel ? (
                                  <div className="absolute left-2 top-2 rounded-full bg-emerald-700/92 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
                                    {selectionRangeLabel}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {dialog.open ? (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/40 p-3 sm:p-4">
          <div className="grid min-h-full place-items-start sm:place-items-center">
            <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-[1rem] border border-slate-200 bg-white shadow-[0_22px_80px_rgba(15,23,42,0.28)] max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)]">
              <div className="flex items-start justify-between gap-3 border-b border-emerald-500/20 bg-emerald-600 px-4 py-3 text-white">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{dialog.mode === "create" ? translateText("Dang ky lich tap") : translateText("Cap nhat lich PT")}</p>
                  <p className="mt-1 truncate text-xs text-emerald-50/90">{`${dialog.trainerName || dialog.location || boardAxisLabel} | ${formatDateTime(dialog.startAt)}`}</p>
                </div>
                <button className="rounded-full p-1 transition hover:bg-white/10" onClick={closeDialog} type="button">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="overflow-y-auto overscroll-contain px-4 py-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className={dialogLabelClassName}>
                    <span className={dialogLabelTextClassName}>{translateText("Chi nhanh")}</span>
                    <select
                      className={dialogFieldClassName}
                      onChange={(event) => setDialog((current) => (current.open ? { ...current, branchId: event.target.value } : current))}
                      value={dialog.branchId}
                    >
                      {(branchesQuery.data || []).map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={dialogLabelClassName}>
                    <span className={dialogLabelTextClassName}>{translateText("Huan luyen vien")}</span>
                    <select
                      className={dialogFieldClassName}
                      onChange={(event) => {
                        const trainer = trainerMap.get(event.target.value);
                        setDialog((current) =>
                          current.open
                            ? {
                                ...current,
                                trainerId: event.target.value,
                                trainerName: trainer?.fullName || current.trainerName,
                                branchId: trainer?.branchId || current.branchId,
                              }
                            : current,
                        );
                      }}
                      value={dialog.trainerId}
                    >
                      {(boardQuery.data?.trainers || []).map((trainer) => (
                        <option key={trainer.id} value={trainer.id}>
                          {trainer.fullName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={dialogLabelClassName}>
                    <span className={dialogLabelTextClassName}>{translateText("Ngay tap")}</span>
                    <input
                      className={dialogFieldClassName}
                      onChange={(event) => updateDialogDate(event.target.value)}
                      type="date"
                      value={dialogDateValue}
                    />
                  </label>

                  {dialog.mode === "edit" ? (
                    <div className="space-y-2 md:col-span-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <input
                            checked={dialog.applyWeekly}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            onChange={toggleDialogApplyWeekly}
                            type="checkbox"
                          />
                          <span>{translateText("Ap dung hang tuan")}</span>
                        </label>
                        <span className="text-xs text-slate-500">
                          {dialog.applyWeekly
                            ? dialogContractEndDate
                              ? `${translateText("Den het")}: ${formatDate(parseDateTimeLocalValue(dialogContractEndDate))}`
                              : translateText("Ap dung cho cac ngay duoc tick.")
                            : translateText("Khong bat thi chi luu cho ngay hien tai.")}
                        </span>
                      </div>
                      {dialog.applyWeekly ? (
                        <div className="flex flex-wrap gap-2">
                          {dialogWeekdayOptions.map((option) => {
                            const checked = dialog.applyWeekdays.includes(option.value);
                            return (
                              <label
                                className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
                                  checked
                                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
                                }`}
                                key={option.value}
                                title={option.fullLabel}
                              >
                                <input
                                  checked={checked}
                                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                  onChange={() => toggleDialogApplyWeekday(option.value)}
                                  type="checkbox"
                                />
                                <span>{option.shortLabel}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : null}
                      <p className="text-xs leading-5 text-slate-500">
                        {dialog.applyWeekly
                          ? translateText(
                              "Tick thu nao thi he thong cap nhat toan bo lich cung thu tu ngay dang chon den het han hop dong. Thu nao khong tick thi khong ap dung.",
                            )
                          : translateText("Khong bat thi chi luu cho ngay hien tai.")}
                      </p>
                    </div>
                  ) : null}

                  <label className={dialogLabelClassName}>
                    <span className={dialogLabelTextClassName}>{translateText("Gio bat dau")}</span>
                    <select className={dialogFieldClassName} onChange={(event) => updateDialogStartTime(event.target.value)} value={buildTimeLabel(dialogStartMinutes)}>
                      {dialogStartTimeOptions.map((option) => (
                        <option key={`start-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={dialogLabelClassName}>
                    <span className={dialogLabelTextClassName}>{translateText("Gio ket thuc")}</span>
                    <select className={dialogFieldClassName} onChange={(event) => updateDialogEndTime(event.target.value)} value={buildTimeLabel(dialogEndMinutes)}>
                      {dialogEndTimeOptions.map((option) => (
                        <option key={`end-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={dialogLabelClassName}>
                    <span className={dialogLabelTextClassName}>{translateText("Chinh chi tiet")}</span>
                    <input
                      className={dialogFieldClassName}
                      onChange={(event) => setDialog((current) => (current.open ? { ...current, startAt: event.target.value } : current))}
                      step={1800}
                      type="datetime-local"
                      value={dialogStartAtValue}
                    />
                  </label>

                  <label className={dialogLabelClassName}>
                    <span className={dialogLabelTextClassName}>{translateText("Chinh gio ket thuc")}</span>
                    <input
                      className={dialogFieldClassName}
                      onChange={(event) => setDialog((current) => (current.open ? { ...current, endAt: event.target.value } : current))}
                      step={1800}
                      type="datetime-local"
                      value={dialogEndAtValue}
                    />
                  </label>

                  <div className="md:col-span-2">
                    <p className={dialogLabelTextClassName}>{translateText("Moc thoi gian nhanh")}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-emerald-200 hover:text-emerald-700"
                        onClick={() => shiftDialogTimeRange(-SLOT_MINUTES)}
                        type="button"
                      >
                        {translateText("Lui 30 phut")}
                      </button>
                      <button
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-emerald-200 hover:text-emerald-700"
                        onClick={() => shiftDialogTimeRange(SLOT_MINUTES)}
                        type="button"
                      >
                        {translateText("Tien 30 phut")}
                      </button>
                      {DURATION_PRESETS.map((duration) => (
                        <button
                          className={`${dialogChipClassName} ${
                            dialogDurationMinutes === duration
                              ? "bg-emerald-600 text-white"
                              : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
                          }`}
                          key={duration}
                          onClick={() => {
                            const startAt = parseDateTimeLocalValue(dialogStartAtValue);
                            const startMinutes = startAt.getHours() * 60 + startAt.getMinutes();
                            const safeEndMinutes = Math.min(DAY_END_MINUTES, startMinutes + duration);
                            setDialog((current) =>
                              current.open
                                ? { ...current, endAt: setDateTimeToMinutes(current.endAt, safeEndMinutes) }
                                : current,
                            );
                          }}
                          type="button"
                        >
                          {`${duration} ${translateText("phut")}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <span className={dialogLabelTextClassName}>{translateText("Tim hoi vien")}</span>
                    <input
                      className={dialogFieldClassName}
                      onChange={(event) => setCustomerLookup(event.target.value)}
                      placeholder={translateText("Nhap ten hoac so dien thoai hoi vien")}
                      value={customerLookup}
                    />
                  </div>

                  <label className={dialogLabelClassName}>
                    <span className={dialogLabelTextClassName}>
                      {supportsParticipantGrouping ? translateText("Hoi vien chinh") : translateText("Chon hoi vien")}
                    </span>
                    <select
                      className={dialogFieldClassName}
                      onChange={(event) => {
                        const option = currentCustomerOptions.find((item) => item.id === event.target.value);
                        setDialog((current) =>
                          current.open
                            ? {
                                ...current,
                                customerId: event.target.value,
                                customerName: option?.fullName || "",
                                contractId: "",
                                participantCustomerIds: Array.from(
                                  new Set(
                                    [event.target.value, ...current.participantCustomerIds.filter(Boolean)],
                                  ),
                                ).filter((value) => value !== event.target.value),
                              }
                            : current,
                        );
                      }}
                      value={dialog.customerId}
                    >
                      <option value="">{translateText("Chon hoi vien")}</option>
                      {currentCustomerOptions.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {[customer.fullName, customer.phone].filter(Boolean).join(" | ")}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={dialogLabelClassName}>
                    <span className={dialogLabelTextClassName}>{translateText("Hop dong / goi PT")}</span>
                    <select
                      className={dialogFieldClassName}
                      onChange={(event) => setDialog((current) => (current.open ? { ...current, contractId: event.target.value } : current))}
                      value={dialog.contractId}
                    >
                      <option value="">{translateText("Chon hop dong / goi PT")}</option>
                      {currentContractOptions.map((contract) => (
                        <option key={contract.id} value={contract.id}>
                          {[contract.code, contract.servicePackageName, `${translateText("Con lai")}: ${contract.remainingSessions || 0}`]
                            .filter(Boolean)
                            .join(" | ")}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs leading-5 text-slate-500">{contractFieldHelperText}</p>
                  </label>

                  {supportsParticipantGrouping ? (
                    <div className="space-y-2 md:col-span-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={dialogLabelTextClassName}>{translateText("Hoc vien tham gia")}</span>
                        <span className="text-xs font-medium text-emerald-700">{`${dialogParticipantCustomerIds.length} ${translateText("Hoi vien")}`}</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto rounded-[1rem] border border-slate-200 bg-slate-50/70 p-3">
                        {currentCustomerOptions.length ? (
                          <div className="grid gap-2 md:grid-cols-2">
                            {currentCustomerOptions.map((customer) => {
                              const checked = dialogParticipantCustomerIds.includes(customer.id);
                              const isPrimaryCustomer = customer.id === dialog.customerId;
                              return (
                                <label
                                  className={`flex cursor-pointer gap-3 rounded-[0.9rem] border px-3 py-2.5 transition ${
                                    checked || isPrimaryCustomer
                                      ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                                      : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
                                  }`}
                                  key={`participant-${customer.id}`}
                                >
                                  <input
                                    checked={checked || isPrimaryCustomer}
                                    className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    disabled={isPrimaryCustomer}
                                    onChange={() => toggleDialogParticipantCustomer(customer.id)}
                                    type="checkbox"
                                  />
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">{customer.fullName}</p>
                                    <p className="truncate text-xs text-slate-500">{customer.phone || customer.branchName || "-"}</p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">{translateText("Khong co hoc vien nao phu hop voi bo loc hien tai.")}</p>
                        )}
                      </div>
                      <p className="text-xs leading-5 text-slate-500">
                        {translateText(
                          "Chi can 1 hoc vien thi block se hien theo hoi vien. Tu 2 hoc vien tro len he thong se hien Lich PT nhom. Hoc vien chinh van dung de gan hop dong chinh.",
                        )}
                      </p>
                    </div>
                  ) : null}

                  <label className={dialogLabelClassName}>
                    <span className={dialogLabelTextClassName}>{translateText("Khu vuc")}</span>
                    <input
                      className={dialogFieldClassName}
                      onChange={(event) => setDialog((current) => (current.open ? { ...current, location: event.target.value } : current))}
                      placeholder={translateText("Vi du: Tang 2 / Studio 1")}
                      value={dialog.location}
                    />
                  </label>

                  <label className={dialogLabelClassName}>
                    <span className={dialogLabelTextClassName}>{translateText("Tru buoi")}</span>
                    <input
                      className={dialogFieldClassName}
                      min={0}
                      onChange={(event) =>
                        setDialog((current) =>
                          current.open ? { ...current, consumedSessions: Math.max(0, Number(event.target.value || 0)) } : current,
                        )
                      }
                      type="number"
                      value={dialog.consumedSessions}
                    />
                  </label>

                  <label className={`${dialogLabelClassName} md:col-span-2`}>
                    <span className={dialogLabelTextClassName}>{translateText("Ghi chu")}</span>
                    <textarea
                      className={dialogTextareaClassName}
                      onChange={(event) => setDialog((current) => (current.open ? { ...current, note: event.target.value } : current))}
                      placeholder={translateText("Nhap ghi chu")}
                      value={dialog.note}
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
                <div className="space-y-1 text-sm text-slate-500">
                  <div>{`${translateText("Khung gio")}: ${buildTimeLabel(dialogStartMinutes)} - ${buildTimeLabel(dialogEndMinutes)}`}</div>
                  <div>{`${translateText("Thoi luong")}: ${dialogDurationMinutes} ${translateText("phut")}`}</div>
                </div>
                <div className="flex items-center gap-2">
                  {dialog.mode === "edit" && dialog.sessionId && canDelete ? (
                    <button
                      className="secondary-button border-rose-200 text-rose-600 hover:bg-rose-50"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(dialog.sessionId!)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                      {translateText("Xoa")}
                    </button>
                  ) : null}
                  <button className="secondary-button" onClick={closeDialog} type="button">
                    {translateText("Bo qua")}
                  </button>
                  <button
                    className="primary-button"
                    disabled={saveMutation.isPending || !dialog.branchId || !dialog.trainerId || !dialog.customerId || !dialog.contractId}
                    onClick={() => saveMutation.mutate()}
                    type="button"
                  >
                    {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {translateText("Luu")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
