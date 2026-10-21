"use client";

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
} from "@/components/household/HouseholdCalendar";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";

const DAYS = 7;
const MAX_ITEMS = 8;

// The next week of the calendar on the household Overview; hidden while the
// calendar is off or the week is empty.
export function ComingUp({ household }: { household: Household }) {
  if (!household.settings.calendarEnabled) return null;
  return <ComingUpCard household={household} />;
}

function ComingUpCard({ household }: { household: Household }) {
  const today = localToday();
  const calendar = useCalendar(household.id, today, addDays(today, DAYS - 1));
  const nameOf = useNameOf();

  if (calendar.loading || calendar.occurrences.length === 0) return null;

  // Overdue chores are one line, so they don't crowd out the week.
  const overdue = calendar.occurrences.filter((o) => o.overdue).length;
  const upcoming = calendar.occurrences.filter((o) => !o.overdue);
  const shown = upcoming.slice(0, MAX_ITEMS - (overdue ? 1 : 0));
  const byDay = new Map<string, Occurrence[]>(overdue ? [[today, []]] : []);
  for (const o of shown) byDay.set(o.date, [...(byDay.get(o.date) ?? []), o]);
  const more = upcoming.length - shown.length;
  const calendarHref = `/household/${household.id}/calendar`;

  return (
    <Card data-testid="coming-up">
      <CardHeader className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Coming up</h2>
        <Link
          href={calendarHref}
          className="text-sm text-primary-700 underline-offset-2 hover:underline dark:text-primary-500"
        >
          Calendar
        </Link>
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        {[...byDay].map(([day, items]) => (
          <section key={day}>
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
            <ul className="mt-1 flex flex-col gap-1">
              {day === today && overdue > 0 && (
                <li className="flex items-start gap-2 text-sm">
                  <span
                    aria-hidden="true"
                    className={clsx(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      KIND_DOT.chore,
                    )}
                  />
                  <Link
                    data-testid="coming-up-overdue"
                    href={`/household/${household.id}/chores`}
                    className="text-red-700 underline-offset-2 hover:underline dark:text-red-400"
                  >
                    {overdue === 1
                      ? "1 overdue chore"
                      : `${overdue} overdue chores`}
                  </Link>
                </li>
              )}
              {items.map((o) => {
                const { title, detail } = describeOccurrence(o, nameOf);
                return (
                  <li
                    key={`${o.kind}-${o.id}`}
                    className="flex items-start gap-2 text-sm"
                  >
                    <span
                      aria-hidden="true"
                      className={clsx(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        KIND_DOT[o.kind],
                      )}
                    />
                    <span className="min-w-0 break-words">
                      {title}
                      {detail && (
                        <span className="ml-1 text-xs text-subtle">
                          {detail}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {more > 0 && (
          <Link
            href={calendarHref}
            className="text-xs text-subtle underline-offset-2 hover:underline"
          >
            And {more} more this week
          </Link>
        )}
      </CardBody>
    </Card>
  );
}
