import type { CalendarEvent, PrismaClient } from "@prisma/client";
import { badRequest, forbidden, notFound } from "../../errors/http.error";
import {
  requireActiveMember,
  requireEnabledModule,
} from "../household/household.service";
import {
  addDays,
  repeatOf,
  step,
  toDateString,
  turnOrder,
} from "../chores/chores.service";
import type { EventInput, RangeInput, SkipInput } from "./calendar.types";

const userSelect = {
  select: {
    id: true,
    username: true,
    profile: {
      select: { displayName: true, firstName: true, lastName: true },
    },
  },
} as const;

type Member = Awaited<ReturnType<typeof requireActiveMember>>;

const utcToday = () => new Date(`${toDateString(new Date())}T00:00:00.000Z`);

async function requireCalendarAccess(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
) {
  const member = await requireActiveMember(prisma, householdId, userId);
  const settings = await requireEnabledModule(prisma, householdId, "calendar");
  return { member, settings };
}

// Events: whoever added them. Away/guest entries: the person they're about.
// The owner can change any of them.
function canEdit(
  member: Member,
  event: Pick<CalendarEvent, "kind" | "userId" | "createdByUserId">,
) {
  if (member.role === "owner") return true;
  return event.kind === "event"
    ? event.createdByUserId === member.userId
    : event.userId === member.userId;
}

async function findEvent(
  prisma: PrismaClient,
  householdId: string,
  eventId: string,
) {
  const event = await prisma.calendarEvent.findFirst({
    where: { id: eventId, householdId },
  });
  if (!event) throw notFound("Event not found");
  return event;
}

async function requireEditable(
  prisma: PrismaClient,
  householdId: string,
  eventId: string,
  member: Member,
) {
  const event = await findEvent(prisma, householdId, eventId);
  if (!canEdit(member, event)) {
    throw forbidden(
      event.kind === "event"
        ? "Only whoever added this event, or the owner, can change it"
        : "Only the person this is about, or the owner, can change it",
    );
  }
  return event;
}

// Who an away/guest entry is about: yourself unless the owner picks someone,
// who must be in the household.
async function entryUserId(
  prisma: PrismaClient,
  householdId: string,
  member: Member,
  userId: string,
) {
  if (userId === member.userId) return userId;
  if (member.role !== "owner") {
    throw forbidden("Only the owner can add this for someone else");
  }
  await requireActiveMember(prisma, householdId, userId).catch(() => {
    throw badRequest("That person isn't in the household");
  });
  return userId;
}

function eventData(input: EventInput, userId: string | null) {
  const event = input.kind === "event" ? input : null;
  return {
    kind: input.kind,
    userId,
    title: input.kind === "away" ? null : input.title || null,
    notes: input.notes || null,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    startTime: event?.startTime ?? null,
    endTime: event?.endTime ?? null,
    repeatEvery: event?.repeat?.every ?? null,
    repeatUnit: event?.repeat?.unit ?? null,
    anchorDay: input.startsOn.getUTCDate(),
  };
}

// The days a stored event happens on within [from, to]: each day of its
// range, or each repeat (minus skipped ones).
export function eventDays(event: CalendarEvent, from: Date, to: Date) {
  const repeat = repeatOf(event);
  const days: Date[] = [];
  if (!repeat) {
    const first = event.startsOn > from ? event.startsOn : from;
    const last = event.endsOn < to ? event.endsOn : to;
    for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
    return days;
  }
  const skipped = new Set(event.skippedDates.map(toDateString));
  for (let d = event.startsOn; d <= to; d = step(d, repeat, event.anchorDay)) {
    if (d >= from && !skipped.has(toDateString(d))) days.push(d);
  }
  return days;
}

export async function listOccurrences(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
  range: RangeInput,
) {
  const { member, settings } = await requireCalendarAccess(
    prisma,
    householdId,
    userId,
  );
  const { from, to } = range;
  const today = range.today ?? utcToday();

  const [events, members, chores] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        householdId,
        startsOn: { lte: to },
        OR: [{ repeatEvery: { not: null } }, { endsOn: { gte: from } }],
      },
      include: { createdByUser: userSelect },
    }),
    prisma.householdMember.findMany({
      where: { householdId, status: "active" },
      include: { user: userSelect },
    }),
    settings.choresEnabled
      ? prisma.chore.findMany({ where: { householdId, archivedAt: null } })
      : [],
  ]);
  const users = new Map(members.map((m) => [m.userId, m.user]));
  const memberIds = new Set(users.keys());

  const occurrences = events
    // Entries about someone who has left go with them.
    .filter((e) => e.userId === null || memberIds.has(e.userId))
    .flatMap((e) =>
      eventDays(e, from, to).map((day) => ({
        date: toDateString(day),
        kind: e.kind,
        id: e.id,
        title: e.title,
        notes: e.notes,
        startTime: e.startTime,
        endTime: e.endTime,
        startsOn: toDateString(e.startsOn),
        endsOn: toDateString(e.endsOn),
        repeat: repeatOf(e),
        user: e.userId ? (users.get(e.userId) ?? null) : null,
        createdBy: e.createdByUser,
        canEdit: canEdit(member, e),
        overdue: false,
      })),
    );

  for (const chore of chores) {
    const repeat = repeatOf(chore);
    const turns = turnOrder(chore, memberIds);
    const turnUser = (k: number) =>
      turns.length > 0 ? (users.get(turns[k % turns.length]) ?? null) : null;
    const base = {
      kind: "chore" as const,
      id: chore.id,
      title: chore.name,
      notes: null,
      startTime: null,
      endTime: null,
      repeat,
      createdBy: null,
      canEdit: false,
    };

    // An overdue chore sits on today; its repeats carry on after today, as
    // they will once it's done.
    let due = chore.dueDate;
    let k = 0;
    if (due < today) {
      if (today >= from && today <= to) {
        occurrences.push({
          ...base,
          date: toDateString(today),
          startsOn: toDateString(due),
          endsOn: toDateString(due),
          user: turnUser(0),
          overdue: true,
        });
      }
      if (!repeat) continue;
      while (due <= today) due = step(due, repeat, chore.anchorDay);
      k = 1;
    }
    for (; due <= to; k++) {
      if (due >= from) {
        occurrences.push({
          ...base,
          date: toDateString(due),
          startsOn: toDateString(due),
          endsOn: toDateString(due),
          user: turnUser(k),
          overdue: false,
        });
      }
      if (!repeat) break;
      due = step(due, repeat, chore.anchorDay);
    }
  }

  // Within a day: who's away or visiting, all-day events, chores, then
  // events with a time.
  const rank = (o: { kind: string; startTime: string | null }) =>
    o.kind === "away"
      ? 0
      : o.kind === "guest"
        ? 1
        : o.kind === "chore"
          ? 3
          : o.startTime
            ? 4
            : 2;
  occurrences.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      rank(a) - rank(b) ||
      (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
      (a.title ?? "").localeCompare(b.title ?? ""),
  );
  return { occurrences };
}

function serializeEvent(event: CalendarEvent, member: Member) {
  return {
    id: event.id,
    kind: event.kind,
    userId: event.userId,
    title: event.title,
    notes: event.notes,
    startsOn: toDateString(event.startsOn),
    endsOn: toDateString(event.endsOn),
    startTime: event.startTime,
    endTime: event.endTime,
    repeat: repeatOf(event),
    skippedDates: event.skippedDates.map(toDateString),
    canEdit: canEdit(member, event),
  };
}

export async function createEvent(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
  input: EventInput,
) {
  const { member } = await requireCalendarAccess(prisma, householdId, userId);
  const aboutUserId =
    input.kind === "event"
      ? null
      : await entryUserId(
          prisma,
          householdId,
          member,
          input.userId ?? member.userId,
        );

  const event = await prisma.calendarEvent.create({
    data: {
      householdId,
      ...eventData(input, aboutUserId),
      createdByUserId: userId,
    },
  });
  return serializeEvent(event, member);
}

export async function updateEvent(
  prisma: PrismaClient,
  householdId: string,
  eventId: string,
  userId: string,
  input: EventInput,
) {
  const { member } = await requireCalendarAccess(prisma, householdId, userId);
  const existing = await requireEditable(prisma, householdId, eventId, member);
  if (input.kind !== existing.kind) {
    throw badRequest("An entry can't change kind");
  }
  // Unless the owner moves it to someone else, an entry stays about the
  // same person.
  const aboutUserId =
    input.kind === "event"
      ? null
      : await entryUserId(
          prisma,
          householdId,
          member,
          input.userId ?? existing.userId ?? member.userId,
        );
  const data = eventData(input, aboutUserId);
  // A new date or repeat makes old skips meaningless.
  const rescheduled =
    data.startsOn.getTime() !== existing.startsOn.getTime() ||
    data.repeatEvery !== existing.repeatEvery ||
    data.repeatUnit !== existing.repeatUnit;

  const event = await prisma.calendarEvent.update({
    where: { id: eventId },
    data: { ...data, ...(rescheduled && { skippedDates: [] }) },
  });
  return serializeEvent(event, member);
}

export async function deleteEvent(
  prisma: PrismaClient,
  householdId: string,
  eventId: string,
  userId: string,
) {
  const { member } = await requireCalendarAccess(prisma, householdId, userId);
  await requireEditable(prisma, householdId, eventId, member);
  await prisma.calendarEvent.delete({ where: { id: eventId } });
}

// Leaves out one occurrence of a repeating event.
export async function skipOccurrence(
  prisma: PrismaClient,
  householdId: string,
  eventId: string,
  userId: string,
  input: SkipInput,
) {
  const { member } = await requireCalendarAccess(prisma, householdId, userId);
  const event = await requireEditable(prisma, householdId, eventId, member);
  const day = toDateString(input.date);
  if (event.skippedDates.some((d) => toDateString(d) === day)) {
    return serializeEvent(event, member);
  }
  if (
    !repeatOf(event) ||
    eventDays(event, input.date, input.date).length !== 1
  ) {
    throw badRequest("The event doesn't repeat on that day");
  }

  const updated = await prisma.calendarEvent.update({
    where: { id: eventId },
    data: { skippedDates: { push: input.date } },
  });
  return serializeEvent(updated, member);
}
