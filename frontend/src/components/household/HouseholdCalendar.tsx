"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";
import type { Household } from "@/hooks/useHouseholds";
import { localToday, type Repeat } from "@/hooks/useChores";
import {
  addDays,
  type CalendarUser,
  type Occurrence,
  useCalendar,
} from "@/hooks/useCalendar";
import { ModuleOff } from "@/components/household/ModuleOff";
import { CalendarEntryForm } from "@/components/household/CalendarEntryForm";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getUserDisplayName } from "@/lib/displayName";

const AGENDA_DAYS = 28;
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

// A dot per kind, in the agenda and the month grid.
export const KIND_DOT: Record<Occurrence["kind"], string> = {
  event: "bg-primary-600",
  away: "bg-avatar-amber-ink",
  guest: "bg-avatar-blue-ink",
  chore: "bg-faint",
};

const toDate = (day: string) => new Date(`${day}T00:00:00`);

export function dayLabel(day: string, today: string) {
  if (day === today) return "Today";
  if (day === addDays(today, 1)) return "Tomorrow";
  return toDate(day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function shortDay(day: string) {
  return toDate(day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function repeatLabel(repeat: Repeat) {
  return repeat.every === 1
    ? `Every ${repeat.unit}`
    : `Every ${repeat.every} ${repeat.unit}s`;
}

// What an occurrence says, for the agenda, a day in the month view and
// Overview's "Coming up".
export function describeOccurrence(
  o: Occurrence,
  nameOf: (u: CalendarUser | null) => string,
) {
  // Whether the person it's about is the viewer (nameOf says "You").
  const me = nameOf(o.user) === "You";
  const range =
    o.startsOn !== o.endsOn
      ? `${shortDay(o.startsOn)} – ${shortDay(o.endsOn)}`
      : null;
  switch (o.kind) {
    case "away":
      return {
        title: me ? "You're away" : `${nameOf(o.user)} away`,
        detail: range,
      };
    case "guest":
      return {
        title: o.title
          ? `${me ? "Your" : `${nameOf(o.user)}'s`} guest: ${o.title}`
          : `${me ? "You have" : `${nameOf(o.user)} has`} a guest`,
        detail: range,
      };
    case "chore":
      return {
        title: o.title ?? "",
        detail: [
          o.overdue ? `Overdue since ${shortDay(o.startsOn)}` : null,
          o.user ? (me ? "Your turn" : `${nameOf(o.user)}'s turn`) : null,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    default:
      return {
        title: o.title ?? "",
        detail: [
          o.startTime
            ? o.endTime
              ? `${formatTime(o.startTime)} – ${formatTime(o.endTime)}`
              : formatTime(o.startTime)
            : null,
          range,
          o.repeat ? repeatLabel(o.repeat) : null,
        ]
          .filter(Boolean)
          .join(" · "),
      };
  }
}

export function useNameOf() {
  const { user } = useAuth();
  return (u: CalendarUser | null) =>
    !u ? "A former member" : u.id === user?.id ? "You" : getUserDisplayName(u);
}

function OccurrenceRow({
  o,
  household,
  nameOf,
  busy,
  brief,
  onEdit,
  onDelete,
  onSkip,
}: {
  o: Occurrence;
  household: Household;
  nameOf: (u: CalendarUser | null) => string;
  busy: boolean;
  // A later day of an entry already shown: no notes or buttons.
  brief: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSkip: () => void;
}) {
  const { title, detail } = describeOccurrence(o, nameOf);
  return (
    <li
      data-testid={`calendar-entry-${o.kind}`}
      className="flex items-start gap-3 py-2 text-sm"
    >
      <span
        aria-hidden="true"
        className={clsx(
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          KIND_DOT[o.kind],
        )}
      />
      <div className="min-w-0 flex-1">
        {o.kind === "chore" ? (
          <Link
            href={`/household/${household.id}/chores`}
            className="break-words font-medium underline-offset-2 hover:underline"
          >
            {title}
          </Link>
        ) : (
          <p className="break-words font-medium">{title}</p>
        )}
        {detail && (
          <p
            className={clsx(
              "text-xs",
              o.overdue ? "text-red-700 dark:text-red-400" : "text-subtle",
            )}
          >
            {detail}
          </p>
        )}
        {o.notes && !brief && (
          <p className="whitespace-pre-line break-words text-xs text-muted">
            {o.notes}
          </p>
        )}
        {o.canEdit && !brief && (
          <div className="mt-1 flex flex-wrap gap-1">
            <Button
              data-testid="calendar-entry-edit"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={onEdit}
            >
              Edit
            </Button>
            {o.repeat && (
              <Button
                data-testid="calendar-entry-skip"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={onSkip}
              >
                Skip this one
              </Button>
            )}
            <Button
              data-testid="calendar-entry-delete"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={onDelete}
            >
              Delete
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

// The Sunday on or before `day`.
function weekStart(day: string) {
  return addDays(day, -toDate(day).getDay());
}

export function HouseholdCalendar({ household }: { household: Household }) {
  const today = localToday();
  const [view, setView] = useState<"agenda" | "month">("agenda");
  const [agendaFrom, setAgendaFrom] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(today);
  // A new entry (on that day), or the occurrence being edited.
  const [form, setForm] = useState<{ day: string; entry?: Occurrence } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const nameOf = useNameOf();

  const gridFrom = weekStart(`${month}-01`);
  const from = view === "agenda" ? agendaFrom : gridFrom;
  const to =
    view === "agenda"
      ? addDays(agendaFrom, AGENDA_DAYS - 1)
      : addDays(gridFrom, 41);
  const calendar = useCalendar(household.id, from, to);

  if (calendar.unavailable) {
    return <ModuleOff household={household} moduleName="calendar" />;
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setBusy(false);
    }
  };

  const byDay = new Map<string, Occurrence[]>();
  for (const o of calendar.occurrences) {
    byDay.set(o.date, [...(byDay.get(o.date) ?? []), o]);
  }

  // In the agenda, an entry over several days has its notes and buttons only
  // on the first day shown.
  const firstShown = new Map<string, string>();
  for (const o of calendar.occurrences) {
    if (!firstShown.has(o.id)) firstShown.set(o.id, o.date);
  }
  const brief = (o: Occurrence) =>
    view === "agenda" &&
    o.kind !== "chore" &&
    o.startsOn !== o.endsOn &&
    firstShown.get(o.id) !== o.date;

  const dayList = (day: string, items: Occurrence[]) => (
    <ul className="flex flex-col divide-y divide-border-subtle">
      {items.map((o) => (
        <OccurrenceRow
          key={`${o.kind}-${o.id}-${o.date}`}
          o={o}
          household={household}
          nameOf={nameOf}
          busy={busy}
          brief={brief(o)}
          onEdit={() => setForm({ day, entry: o })}
          onSkip={() => run(() => calendar.skip(o.id, o.date))}
          onDelete={() => {
            const what = o.repeat
              ? `every "${o.title}"`
              : o.kind === "event"
                ? `"${o.title}"`
                : "this entry";
            if (window.confirm(`Delete ${what}?`)) {
              run(() => calendar.remove(o.id));
            }
          }}
        />
      ))}
    </ul>
  );

  const monthName = toDate(`${month}-01`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const shiftMonth = (delta: number) => {
    const d = toDate(`${month}-01`);
    d.setMonth(d.getMonth() + delta);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setMonth(next);
    setSelectedDay(today.startsWith(next) ? today : `${next}-01`);
  };

  return (
    <Card data-testid="calendar">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Calendar</h2>
          <p className="mt-1 text-sm text-muted">
            What&apos;s on in {household.name}, who&apos;s away, and when chores
            are due.
          </p>
        </div>
        {form === null && (
          <Button
            data-testid="calendar-add"
            className="shrink-0 self-start"
            onClick={() =>
              setForm({ day: view === "month" ? selectedDay : today })
            }
          >
            Add
          </Button>
        )}
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        {form && (
          <CalendarEntryForm
            key={form.entry ? `${form.entry.id}-${form.day}` : form.day}
            household={household}
            day={form.day}
            entry={form.entry}
            onSubmit={async (input) => {
              if (form.entry) await calendar.update(form.entry.id, input);
              else await calendar.create(input);
              setForm(null);
            }}
            onCancel={() => setForm(null)}
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            className="flex rounded-full border border-border-strong p-0.5 text-xs"
            role="tablist"
          >
            {(["agenda", "month"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                data-testid={`calendar-view-${v}`}
                onClick={() => setView(v)}
                className={clsx(
                  "rounded-full px-3 py-1",
                  view === v
                    ? "bg-primary-100 font-semibold text-primary-700 dark:bg-primary-600/20 dark:text-primary-100"
                    : "text-muted",
                )}
              >
                {v === "agenda" ? "Agenda" : "Month"}
              </button>
            ))}
          </div>
          {view === "month" ? (
            <div className="flex items-center gap-1 text-sm">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Previous month"
                data-testid="calendar-prev"
                onClick={() => shiftMonth(-1)}
              >
                ‹
              </Button>
              <span data-testid="calendar-month" className="font-medium">
                {monthName}
              </span>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Next month"
                data-testid="calendar-next"
                onClick={() => shiftMonth(1)}
              >
                ›
              </Button>
            </div>
          ) : (
            agendaFrom !== today && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAgendaFrom(today)}
              >
                Back to today
              </Button>
            )
          )}
        </div>

        {actionError || calendar.error ? (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError ?? calendar.error}
          </div>
        ) : null}

        {view === "agenda" ? (
          <>
            <Button
              data-testid="calendar-earlier"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setAgendaFrom(addDays(agendaFrom, -AGENDA_DAYS))}
            >
              ↑ Earlier
            </Button>
            {calendar.loading ? (
              <p className="text-sm text-muted">Loading...</p>
            ) : byDay.size === 0 ? (
              <p
                data-testid="calendar-empty"
                className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted"
              >
                Nothing on between {shortDay(from)} and {shortDay(to)}.
              </p>
            ) : (
              <div
                data-testid="calendar-agenda"
                className="flex flex-col gap-3"
              >
                {[...byDay].map(([day, items]) => (
                  <section key={day} data-testid={`calendar-day-${day}`}>
                    <h3
                      className={clsx(
                        "text-xs font-semibold uppercase tracking-wide",
                        day === today
                          ? "text-primary-700 dark:text-primary-500"
                          : "text-subtle",
                      )}
                    >
                      {dayLabel(day, today)}
                    </h3>
                    {dayList(day, items)}
                  </section>
                ))}
              </div>
            )}
            <Button
              data-testid="calendar-later"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setAgendaFrom(addDays(agendaFrom, AGENDA_DAYS))}
            >
              ↓ Later
            </Button>
          </>
        ) : (
          <>
            <div data-testid="calendar-grid" className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((d, i) => (
                <span
                  key={i}
                  className="text-center text-[11px] font-semibold text-subtle"
                >
                  {d}
                </span>
              ))}
              {Array.from({ length: 42 }, (_, i) => addDays(gridFrom, i)).map(
                (day) => {
                  const kinds = [
                    ...new Set((byDay.get(day) ?? []).map((o) => o.kind)),
                  ];
                  return (
                    <button
                      key={day}
                      type="button"
                      data-testid={`calendar-cell-${day}`}
                      aria-pressed={day === selectedDay}
                      onClick={() => setSelectedDay(day)}
                      className={clsx(
                        "flex aspect-square flex-col items-center justify-center gap-1 rounded-md text-sm sm:aspect-auto sm:h-16",
                        day.slice(0, 7) !== month && "text-faint",
                        day === selectedDay
                          ? "bg-primary-100 font-semibold text-primary-700 dark:bg-primary-600/20 dark:text-primary-100"
                          : "hover:bg-surface-muted",
                        day === today &&
                          day !== selectedDay &&
                          "ring-1 ring-primary-600",
                      )}
                    >
                      {Number(day.slice(8))}
                      <span className="flex h-1.5 gap-0.5">
                        {kinds.map((k) => (
                          <span
                            key={k}
                            className={clsx(
                              "h-1.5 w-1.5 rounded-full",
                              KIND_DOT[k],
                            )}
                          />
                        ))}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
            <section data-testid="calendar-selected-day">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">
                {dayLabel(selectedDay, today)}
              </h3>
              {calendar.loading ? (
                <p className="py-2 text-sm text-muted">Loading...</p>
              ) : (byDay.get(selectedDay) ?? []).length === 0 ? (
                <p className="py-2 text-sm text-subtle">Nothing on.</p>
              ) : (
                dayList(selectedDay, byDay.get(selectedDay)!)
              )}
            </section>
          </>
        )}

        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle">
          {(
            [
              ["event", "Events"],
              ["away", "Away"],
              ["guest", "Guests"],
              ["chore", "Chores"],
            ] as const
          )
            .filter(([k]) => k !== "chore" || household.settings.choresEnabled)
            .map(([k, label]) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={clsx("h-2 w-2 rounded-full", KIND_DOT[k])} />
                {label}
              </span>
            ))}
        </p>
      </CardBody>
    </Card>
  );
}
