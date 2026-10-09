"use client";

import { FormEvent, useState } from "react";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";
import type { Household } from "@/hooks/useHouseholds";
import {
  type Chore,
  type ChoreInput,
  type Repeat,
  type RepeatUnit,
  localToday,
  useChores,
} from "@/hooks/useChores";
import { ModuleOff } from "@/components/household/ModuleOff";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getUserDisplayName } from "@/lib/displayName";
import { Input, Select } from "@/components/ui/Input";

type NameOf = (userId: string | null) => string;

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
      {error}
    </div>
  );
}

const UNITS: RepeatUnit[] = ["day", "week", "month", "quarter"];

function scheduleLabel(repeat: Repeat | null) {
  if (repeat === null) return "Once";
  return repeat.every === 1
    ? `Every ${repeat.unit}`
    : `Every ${repeat.every} ${repeat.unit}s`;
}

function formatDay(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function ChoreForm({
  household,
  chore,
  onSubmit,
  onCancel,
}: {
  household: Household;
  chore?: Chore;
  onSubmit: (input: ChoreInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(chore?.name ?? "");
  const [recurring, setRecurring] = useState(chore ? !!chore.repeat : true);
  const [every, setEvery] = useState(String(chore?.repeat?.every ?? 1));
  const [unit, setUnit] = useState<RepeatUnit>(chore?.repeat?.unit ?? "week");
  const [dueDate, setDueDate] = useState(chore?.dueDate ?? localToday());
  // New chores rotate through everyone, starting with whoever creates it.
  const [rotation, setRotation] = useState<string[]>(
    chore?.rotation ??
      [...household.members]
        .sort((a, b) =>
          a.userId === user?.id ? -1 : b.userId === user?.id ? 1 : 0,
        )
        .map((m) => m.userId),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOf = (userId: string) => {
    const member = household.members.find((m) => m.userId === userId);
    return member ? getUserDisplayName(member.user) : "Roommate";
  };
  const everyNumber = Number(every);
  const everyValid =
    !recurring ||
    (Number.isInteger(everyNumber) && everyNumber >= 1 && everyNumber <= 365);

  const move = (index: number, delta: number) => {
    const next = [...rotation];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setRotation(next);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !everyValid || !dueDate) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        repeat: recurring ? { every: everyNumber, unit } : null,
        dueDate,
        rotation,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  return (
    <form
      data-testid="chore-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface px-4 py-3"
    >
      <label className="text-sm">
        <span className="mb-1 block">Chore</span>
        <Input
          data-testid="chore-form-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Take out the trash"
          maxLength={80}
          className="w-full"
        />
      </label>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block">Repeats</span>
          <Select
            data-testid="chore-form-recurrence"
            value={recurring ? "every" : "once"}
            onChange={(e) => setRecurring(e.target.value === "every")}
          >
            <option value="every">Every</option>
            <option value="once">Once</option>
          </Select>
        </label>
        {recurring && (
          <>
            <Input
              data-testid="chore-form-every"
              type="number"
              aria-label="How many"
              min={1}
              max={365}
              value={every}
              onChange={(e) => setEvery(e.target.value)}
              className="w-20"
            />
            <Select
              data-testid="chore-form-unit"
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
        <label className="text-sm">
          <span className="mb-1 block">{recurring ? "Next due" : "Due"}</span>
          <Input
            data-testid="chore-form-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </label>
      </div>

      <div className="text-sm">
        <span className="mb-1 block">Who takes turns (first is up next)</span>
        {rotation.length === 0 && (
          <p className="text-xs text-subtle">
            Nobody: anyone can do it when it&apos;s due.
          </p>
        )}
        <ol className="flex flex-col gap-1">
          {rotation.map((userId, index) => (
            <li
              key={userId}
              data-testid={`chore-form-rotation-${userId}`}
              className="flex items-center gap-2"
            >
              <span className="w-5 text-xs text-subtle">{index + 1}.</span>
              <span className="min-w-0 flex-1 truncate">{nameOf(userId)}</span>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Move ${nameOf(userId)} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Move ${nameOf(userId)} down`}
                disabled={index === rotation.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Take ${nameOf(userId)} out of the rotation`}
                onClick={() =>
                  setRotation(rotation.filter((id) => id !== userId))
                }
              >
                ✕
              </Button>
            </li>
          ))}
        </ol>
        <div className="mt-1 flex flex-wrap gap-2">
          {household.members
            .filter((m) => !rotation.includes(m.userId))
            .map((m) => (
              <Button
                key={m.userId}
                data-testid={`chore-form-add-${m.userId}`}
                variant="secondary"
                size="sm"
                onClick={() => setRotation([...rotation, m.userId])}
              >
                + {getUserDisplayName(m.user)}
              </Button>
            ))}
        </div>
      </div>

      <ErrorNote error={error} />

      <div className="flex gap-2">
        <Button
          data-testid="chore-form-submit"
          type="submit"
          disabled={submitting || !name.trim() || !everyValid || !dueDate}
        >
          {submitting ? "Saving…" : chore ? "Save" : "Add chore"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ChoreRow({
  chore,
  today,
  meId,
  nameOf,
  busy,
  onDone,
  onStart,
  onStop,
  onEdit,
  onDelete,
}: {
  chore: Chore;
  today: string;
  meId: string | undefined;
  nameOf: NameOf;
  busy: boolean;
  onDone: () => void;
  onStart: () => void;
  onStop: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const overdue = chore.dueDate < today;
  const myTurn = chore.assigneeUserId !== null && chore.assigneeUserId === meId;
  const nextUp = chore.rotation.length > 1 ? chore.rotation[1] : null;

  return (
    <li
      data-testid={`chore-${chore.id}`}
      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{chore.name}</p>
        <p className="text-xs text-subtle">
          {scheduleLabel(chore.repeat)} ·{" "}
          <span
            data-testid={`chore-due-${chore.id}`}
            className={clsx(overdue && "font-semibold text-red-600")}
          >
            {overdue
              ? `Overdue (${formatDay(chore.dueDate)})`
              : chore.dueDate === today
                ? "Due today"
                : `Due ${formatDay(chore.dueDate)}`}
          </span>
        </p>
        <p className="text-xs">
          <span
            data-testid={`chore-assignee-${chore.id}`}
            className={clsx(
              myTurn
                ? "font-semibold text-primary-700 dark:text-primary-500"
                : "text-muted",
            )}
          >
            {chore.assigneeUserId === null
              ? "Anyone"
              : myTurn
                ? "Your turn"
                : `${nameOf(chore.assigneeUserId)}'s turn`}
          </span>
          {nextUp && (
            <span className="text-subtle"> · then {nameOf(nextUp)}</span>
          )}
        </p>
        {chore.startedAt && (
          <p
            data-testid={`chore-started-${chore.id}`}
            className="text-xs font-medium text-amber-700 dark:text-amber-400"
          >
            {chore.startedByUserId === meId
              ? "You"
              : nameOf(chore.startedByUserId)}{" "}
            started ·{" "}
            {new Date(chore.startedAt).toLocaleString(undefined, {
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {!chore.startedByUserId && (
          <Button
            data-testid={`chore-start-${chore.id}`}
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={onStart}
          >
            Start
          </Button>
        )}
        {chore.startedByUserId === meId && (
          <Button
            data-testid={`chore-stop-${chore.id}`}
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={onStop}
          >
            Stop
          </Button>
        )}
        <Button
          data-testid={`chore-done-${chore.id}`}
          size="sm"
          disabled={busy}
          onClick={onDone}
        >
          Done
        </Button>
        <Button
          data-testid={`chore-edit-${chore.id}`}
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={onEdit}
        >
          Edit
        </Button>
        <Button
          data-testid={`chore-delete-${chore.id}`}
          variant="ghost"
          size="sm"
          className="text-red-600 hover:bg-red-50"
          disabled={busy}
          onClick={onDelete}
        >
          Delete
        </Button>
      </div>
    </li>
  );
}

export function ChoreBoard({ household }: { household: Household }) {
  const { user } = useAuth();
  const chores = useChores(household.id);
  // "new", a chore id being edited, or null.
  const [editing, setEditing] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (chores.unavailable) {
    return <ModuleOff household={household} moduleName="chore list" />;
  }

  const nameOf: NameOf = (userId) => {
    const member = household.members.find((m) => m.userId === userId);
    return member ? getUserDisplayName(member.user) : "A former member";
  };

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

  const handleDelete = (chore: Chore) => {
    if (!window.confirm(`Delete "${chore.name}"? Its history goes too.`)) {
      return;
    }
    run(() => chores.removeChore(chore.id));
  };

  const today = localToday();
  const visible = onlyMine
    ? chores.chores.filter((c) => c.assigneeUserId === user?.id)
    : chores.chores;
  const groups = [
    {
      key: "overdue",
      title: "Overdue",
      items: visible.filter((c) => c.dueDate < today),
    },
    {
      key: "today",
      title: "Today",
      items: visible.filter((c) => c.dueDate === today),
    },
    {
      key: "upcoming",
      title: "Upcoming",
      items: visible.filter((c) => c.dueDate > today),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card data-testid="chore-board">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Chores</h2>
              <p className="mt-1 text-sm text-muted">
                Who does what in {household.name}, and whose turn is next.
              </p>
            </div>
            {editing !== "new" && (
              <Button
                data-testid="chore-add"
                size="sm"
                onClick={() => setEditing("new")}
              >
                Add chore
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          {editing === "new" && (
            <ChoreForm
              household={household}
              onSubmit={async (input) => {
                await chores.createChore(input);
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
            />
          )}

          <ErrorNote error={actionError ?? chores.error} />

          {chores.chores.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input
                data-testid="chores-only-mine"
                type="checkbox"
                checked={onlyMine}
                onChange={(e) => setOnlyMine(e.target.checked)}
                className="h-4 w-4 cursor-pointer"
              />
              Only my turns
            </label>
          )}

          {chores.loading && chores.chores.length === 0 ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : visible.length === 0 ? (
            <p data-testid="chores-empty" className="text-sm text-subtle">
              {onlyMine ? "Nothing is your turn." : "No chores yet."}
            </p>
          ) : (
            groups
              .filter((g) => g.items.length > 0)
              .map((g) => (
                <section key={g.key} data-testid={`chores-${g.key}`}>
                  <h3
                    className={clsx(
                      "text-sm font-semibold",
                      g.key === "overdue" && "text-red-600",
                    )}
                  >
                    {g.title} ({g.items.length})
                  </h3>
                  <ul className="divide-y divide-border-subtle">
                    {g.items.map((chore) =>
                      editing === chore.id ? (
                        <li key={chore.id} className="py-3">
                          <ChoreForm
                            household={household}
                            chore={chore}
                            onSubmit={async (input) => {
                              await chores.updateChore(chore.id, input);
                              setEditing(null);
                            }}
                            onCancel={() => setEditing(null)}
                          />
                        </li>
                      ) : (
                        <ChoreRow
                          key={chore.id}
                          chore={chore}
                          today={today}
                          meId={user?.id}
                          nameOf={nameOf}
                          busy={busy}
                          onDone={() =>
                            run(() => chores.completeChore(chore.id))
                          }
                          onStart={() => run(() => chores.startChore(chore.id))}
                          onStop={() => run(() => chores.stopChore(chore.id))}
                          onEdit={() => setEditing(chore.id)}
                          onDelete={() => handleDelete(chore)}
                        />
                      ),
                    )}
                  </ul>
                </section>
              ))
          )}
        </CardBody>
      </Card>

      {chores.history.length > 0 && (
        <Card data-testid="chores-history">
          <CardHeader>
            <h3 className="text-sm font-semibold">Recently done</h3>
          </CardHeader>
          <CardBody>
            <ul className="flex flex-col gap-1 text-sm">
              {chores.history.map((c) => (
                <li key={c.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {nameOf(c.doneByUserId)} did {c.choreName}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-subtle">
                    {formatDay(c.completedOn)}
                    {c.completedOn > c.dueDate && " · late"}
                    {c.undoable && (
                      <Button
                        data-testid={`chore-undo-${c.id}`}
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => run(() => chores.undoCompletion(c.id))}
                      >
                        Undo
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
