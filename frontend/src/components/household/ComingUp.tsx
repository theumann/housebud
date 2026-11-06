"use client";

import { useId, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { Household } from "@/hooks/useHouseholds";
import { localToday } from "@/hooks/useChores";
import { addDays, type Occurrence, useCalendar } from "@/hooks/useCalendar";
import {
  KIND_DOT,
  dayLabel,
  describeOccurrence,
  useNameOf,
  weekStart,
} from "@/components/household/HouseholdCalendar";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Chevron } from "@/components/ui/Chevron";

const MAX_ITEMS = 12;
const OPEN_KEY = "comingUpOpen";

type Section = {
  label: string;
  // Within a week, each line starts with its weekday.
  showDay: boolean;
  items: Occurrence[];
};

function readOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) === "true";
  } catch {
    return false;
  }
}

function saveOpen(open: boolean) {
  try {
    localStorage.setItem(OPEN_KEY, String(open));
  } catch {}
}

function nowTime() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const weekday = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
  });

// Today until the end of next week on the household Overview; hidden while
// the calendar is off or nothing is planned.
export function ComingUp({ household }: { household: Household }) {
  if (!household.settings.calendarEnabled) return null;
  return <ComingUpCard household={household} />;
}

function ComingUpCard({ household }: { household: Household }) {
  const today = localToday();
  const tomorrow = addDays(today, 1);
  const thisWeekEnd = addDays(weekStart(today), 6);
  const nextWeekEnd = addDays(thisWeekEnd, 7);
  const calendar = useCalendar(household.id, today, nextWeekEnd);
  const nameOf = useNameOf();
  const [open, setOpen] = useState(readOpen);
  const bodyId = useId();

  if (calendar.loading || calendar.occurrences.length === 0) return null;

  const toggle = () => {
    saveOpen(!open);
    setOpen(!open);
  };

  // Overdue chores are one line, so they don't crowd out the rest.
  const overdue = calendar.occurrences.filter((o) => o.overdue).length;
  const upcoming = calendar.occurrences.filter((o) => !o.overdue);

  // Collapsed, the card shows the next thing: today's timed events that
  // are over don't count.
  const now = nowTime();
  const next = upcoming.find(
    (o) => o.date !== today || !o.startTime || (o.endTime ?? o.startTime) > now,
  );

  const sections: Section[] = [
    { label: "Today", showDay: false, items: [] },
    { label: "Tomorrow", showDay: false, items: [] },
    { label: "This week", showDay: true, items: [] },
    { label: "Next week", showDay: true, items: [] },
  ];
  const sectionOf = (day: string) =>
    day === today ? 0 : day === tomorrow ? 1 : day <= thisWeekEnd ? 2 : 3;
  // An entry over several days is listed once per section, on its first day
  // there (its range is in the detail).
  const seen = new Set<string>();
  let room = MAX_ITEMS - (overdue ? 1 : 0);
  let more = 0;
  for (const o of upcoming) {
    const section = sectionOf(o.date);
    if (o.startsOn !== o.endsOn) {
      const key = `${section}-${o.kind}-${o.id}-${o.startsOn}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    if (room > 0) {
      sections[section].items.push(o);
      room--;
    } else {
      more++;
    }
  }
  const calendarHref = `/household/${household.id}/calendar`;

  const overdueLine = overdue > 0 && (
    <li className="flex items-start gap-2 text-sm">
      <span
        aria-hidden="true"
        className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", KIND_DOT.chore)}
      />
      <Link
        data-testid="coming-up-overdue"
        href={`/household/${household.id}/chores`}
        className="text-red-700 underline-offset-2 hover:underline dark:text-red-400"
      >
        {overdue === 1 ? "1 overdue chore" : `${overdue} overdue chores`}
      </Link>
    </li>
  );

  const row = (o: Occurrence, when: string | null, whenWidth = false) => {
    const { title, detail } = describeOccurrence(o, nameOf);
    return (
      <li
        key={`${o.kind}-${o.id}-${o.date}`}
        className="flex items-start gap-2 text-sm"
      >
        <span
          aria-hidden="true"
          className={clsx(
            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
            KIND_DOT[o.kind],
          )}
        />
        {when && (
          <span
            className={clsx(
              "mt-0.5 shrink-0 text-xs text-subtle",
              whenWidth && "w-8",
            )}
          >
            {when}
          </span>
        )}
        <span className="min-w-0 break-words">
          {title}
          {detail && <span className="ml-1 text-xs text-subtle">{detail}</span>}
        </span>
      </li>
    );
  };

  return (
    <Card data-testid="coming-up">
      {/* The toggle fills the header, card padding included, up to the
          Calendar link. */}
      <CardHeader className="flex items-stretch p-0">
        <h2 className="min-w-0 flex-1 text-lg font-semibold">
          <button
            type="button"
            data-testid="coming-up-toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={toggle}
            className="flex h-full w-full cursor-pointer items-center gap-2 rounded-tl-card px-4 pt-4 pb-2 text-left"
          >
            <Chevron className={open ? "" : "-rotate-90"} />
            Coming up
          </button>
        </h2>
        <Link
          href={calendarHref}
          className="flex items-center rounded-tr-card pt-4 pr-4 pb-2 pl-3 text-sm text-primary-700 underline-offset-2 hover:underline dark:text-primary-400"
        >
          Calendar
        </Link>
      </CardHeader>
      <CardBody id={bodyId} className="flex flex-col gap-3">
        {open ? (
          <>
            {sections.map((section, i) =>
              section.items.length === 0 && !(i === 0 && overdueLine) ? null : (
                <section
                  key={section.label}
                  data-testid={`coming-up-section-${i}`}
                >
                  <h3
                    className={clsx(
                      "text-xs font-semibold uppercase tracking-wide",
                      i === 0
                        ? "text-primary-700 dark:text-primary-400"
                        : "text-subtle",
                    )}
                  >
                    {section.label}
                  </h3>
                  <ul className="mt-1 flex flex-col gap-1">
                    {i === 0 && overdueLine}
                    {section.items.map((o) =>
                      row(o, section.showDay ? weekday(o.date) : null, true),
                    )}
                  </ul>
                </section>
              ),
            )}
            {more > 0 && (
              <Link
                href={calendarHref}
                className="text-xs text-subtle underline-offset-2 hover:underline"
              >
                And {more} more by the end of next week
              </Link>
            )}
          </>
        ) : (
          <ul data-testid="coming-up-next" className="flex flex-col gap-1">
            {overdueLine}
            {next ? (
              row(next, dayLabel(next.date, today))
            ) : (
              <li className="text-sm text-muted">Nothing else coming up</li>
            )}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
