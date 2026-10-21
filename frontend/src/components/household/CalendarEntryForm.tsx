"use client";

import { FormEvent, useState } from "react";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";
import type { Household } from "@/hooks/useHouseholds";
import type { RepeatUnit } from "@/hooks/useChores";
import type { EntryInput, EntryKind, Occurrence } from "@/hooks/useCalendar";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { getUserDisplayName } from "@/lib/displayName";

const UNITS: RepeatUnit[] = ["day", "week", "month", "quarter"];

const KINDS: { kind: EntryKind; label: string }[] = [
  { kind: "event", label: "Event" },
  { kind: "away", label: "I'm away" },
  { kind: "guest", label: "Guest" },
];

// Adds an entry on `day`, or edits the entry `entry` is a day of (for a
// repeating event, the whole series).
export function CalendarEntryForm({
  household,
  day,
  entry,
  onSubmit,
  onCancel,
}: {
  household: Household;
  day: string;
  entry?: Occurrence;
  onSubmit: (input: EntryInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const [kind, setKind] = useState<EntryKind>(
    entry && entry.kind !== "chore" ? entry.kind : "event",
  );
  const [title, setTitle] = useState(entry?.title ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [startsOn, setStartsOn] = useState(entry?.startsOn ?? day);
  const [endsOn, setEndsOn] = useState(entry?.endsOn ?? day);
  const [timed, setTimed] = useState(!!entry?.startTime);
  const [startTime, setStartTime] = useState(entry?.startTime ?? "19:00");
  const [endTime, setEndTime] = useState(entry?.endTime ?? "");
  const [recurring, setRecurring] = useState(!!entry?.repeat);
  const [every, setEvery] = useState(String(entry?.repeat?.every ?? 1));
  const [unit, setUnit] = useState<RepeatUnit>(entry?.repeat?.unit ?? "week");
  const [userId, setUserId] = useState(entry?.user?.id ?? user?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = household.myRole === "owner";
  const everyNumber = Number(every);
  // Timed and repeating events are on one day.
  const oneDay = kind === "event" && (timed || recurring);
  const lastDay = oneDay ? startsOn : endsOn;
  const valid =
    !!startsOn &&
    lastDay >= startsOn &&
    (kind !== "event" ||
      (!!title.trim() &&
        (!timed || !!startTime) &&
        (!timed || !endTime || endTime > startTime) &&
        (!recurring ||
          (Number.isInteger(everyNumber) &&
            everyNumber >= 1 &&
            everyNumber <= 365))));

  const changeStart = (value: string) => {
    setStartsOn(value);
    if (endsOn < value) setEndsOn(value);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(
        kind === "event"
          ? {
              kind,
              title: title.trim(),
              notes: notes.trim(),
              startsOn,
              endsOn: lastDay,
              ...(timed && {
                startTime,
                ...(endTime && { endTime }),
              }),
              repeat: recurring ? { every: everyNumber, unit } : null,
            }
          : {
              kind,
              userId,
              ...(kind === "guest" && { title: title.trim() }),
              notes: notes.trim(),
              startsOn,
              endsOn,
            },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  const heading = entry
    ? entry.repeat
      ? "Edit every repeat"
      : "Edit"
    : "Add to the calendar";

  return (
    <form
      data-testid="calendar-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-muted p-3 text-sm"
    >
      <p className="font-semibold">{heading}</p>

      {!entry && (
        <div className="flex flex-wrap gap-1" role="radiogroup">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              role="radio"
              aria-checked={kind === k.kind}
              data-testid={`calendar-form-kind-${k.kind}`}
              onClick={() => setKind(k.kind)}
              className={clsx(
                "rounded-full border px-3 py-1",
                kind === k.kind
                  ? "border-primary-600 bg-primary-100 font-semibold text-primary-700 dark:bg-primary-600/20 dark:text-primary-100"
                  : "border-border-strong bg-surface text-muted",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}

      {kind !== "event" && isOwner && (
        <label>
          <span className="mb-1 block">
            {kind === "away" ? "Who's away" : "Whose guest"}
          </span>
          <Select
            data-testid="calendar-form-user"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full"
          >
            {household.members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.userId === user?.id ? "Me" : getUserDisplayName(m.user)}
              </option>
            ))}
          </Select>
        </label>
      )}

      {kind !== "away" && (
        <Input
          data-testid="calendar-form-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            kind === "event"
              ? "What's happening, e.g. Landlord inspection"
              : "Who's visiting (optional), e.g. My sister"
          }
          aria-label={kind === "event" ? "Event" : "Guest"}
          maxLength={80}
          className="w-full"
        />
      )}

      {kind === "event" && (
        <label className="flex items-center gap-2">
          <input
            data-testid="calendar-form-timed"
            type="checkbox"
            checked={timed}
            onChange={(e) => setTimed(e.target.checked)}
            className="h-4 w-4 cursor-pointer"
          />
          At a set time
        </label>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label>
          <span className="mb-1 block">{oneDay ? "Day" : "From"}</span>
          <Input
            data-testid="calendar-form-starts"
            type="date"
            value={startsOn}
            onChange={(e) => changeStart(e.target.value)}
          />
        </label>
        {!oneDay && (
          <label>
            <span className="mb-1 block">To</span>
            <Input
              data-testid="calendar-form-ends"
              type="date"
              value={endsOn}
              min={startsOn}
              onChange={(e) => setEndsOn(e.target.value)}
            />
          </label>
        )}
        {kind === "event" && timed && (
          <>
            <label>
              <span className="mb-1 block">Starts</span>
              <Input
                data-testid="calendar-form-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </label>
            <label>
              <span className="mb-1 block">Ends (optional)</span>
              <Input
                data-testid="calendar-form-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </label>
          </>
        )}
      </div>

      {kind === "event" && (
        <div className="flex flex-wrap items-end gap-2">
          <label>
            <span className="mb-1 block">Repeats</span>
            <Select
              data-testid="calendar-form-recurrence"
              value={recurring ? "every" : "once"}
              onChange={(e) => setRecurring(e.target.value === "every")}
            >
              <option value="once">Once</option>
              <option value="every">Every</option>
            </Select>
          </label>
          {recurring && (
            <>
              <Input
                data-testid="calendar-form-every"
                type="number"
                aria-label="How many"
                min={1}
                max={365}
                value={every}
                onChange={(e) => setEvery(e.target.value)}
                className="w-20"
              />
              <Select
                data-testid="calendar-form-unit"
                aria-label="Unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value as RepeatUnit)}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {everyNumber === 1 ? u : `${u}s`}
                  </option>
                ))}
              </Select>
            </>
          )}
        </div>
      )}

      <Textarea
        data-testid="calendar-form-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={
          kind === "away"
            ? "Note (optional), e.g. Back Sunday night"
            : "Notes (optional)"
        }
        aria-label="Notes"
        maxLength={500}
        rows={2}
        className="w-full"
      />

      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          data-testid="calendar-form-submit"
          type="submit"
          disabled={submitting || !valid}
        >
          {submitting ? "Saving…" : entry ? "Save" : "Add"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
