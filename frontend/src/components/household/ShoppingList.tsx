"use client";

import { FormEvent, useState } from "react";
import clsx from "clsx";
import type { Household } from "@/hooks/useHouseholds";
import { type ShoppingItem, useShoppingList } from "@/hooks/useShoppingList";
import { ModuleOff } from "@/components/household/ModuleOff";
import { ExpenseForm } from "@/components/household/ExpenseForm";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { AddButton, Button } from "@/components/ui/Button";
import { getUserDisplayName } from "@/lib/displayName";
import { Input } from "@/components/ui/Input";

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
      {error}
    </div>
  );
}

function ItemRow({
  item,
  disabled,
  onToggle,
  onRemove,
}: {
  item: ShoppingItem;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
  onRemove: () => void;
}) {
  const checked = item.checkedAt !== null;
  const who = checked ? item.checkedByUser : item.addedByUser;

  return (
    <li
      data-testid={`shopping-item-${item.id}`}
      className="flex items-center gap-3 py-2"
    >
      <input
        data-testid={`shopping-item-check-${item.id}`}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onToggle(e.target.checked)}
        aria-label={checked ? `Uncheck ${item.name}` : `Check off ${item.name}`}
        className="h-4 w-4 shrink-0 cursor-pointer"
      />
      <div className="min-w-0 flex-1">
        <p
          className={clsx(
            "truncate text-sm",
            checked && "text-subtle line-through",
          )}
        >
          <span data-testid="shopping-item-name">{item.name}</span>
          {item.quantity && (
            <span className="text-subtle"> · {item.quantity}</span>
          )}
        </p>
        {who && (
          <p className="text-xs text-subtle">
            {checked ? "Got it: " : "Added by "}
            {getUserDisplayName(who)}
            {item.expenseId && " · on an expense"}
          </p>
        )}
      </div>
      <Button
        data-testid={`shopping-item-remove-${item.id}`}
        variant="ghost"
        size="sm"
        className="px-2 text-subtle! hover:text-red-700! dark:hover:text-red-400!"
        disabled={disabled}
        onClick={onRemove}
        aria-label={`Remove ${item.name}`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </Button>
    </li>
  );
}

export function ShoppingList({ household }: { household: Household }) {
  const { user } = useAuth();
  const list = useShoppingList(household.id);
  const [buying, setBuying] = useState(false);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (list.unavailable) {
    return <ModuleOff household={household} moduleName="shopping list" />;
  }

  const open = list.items.filter((i) => !i.checkedAt);
  const done = list.items
    .filter((i) => i.checkedAt)
    .sort((a, b) => b.checkedAt!.localeCompare(a.checkedAt!));

  // What I checked off that isn't on an expense yet.
  const myUnpaid = done.filter(
    (i) => i.checkedByUser?.id === user?.id && !i.expenseId,
  );

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

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    setActionError(null);
    try {
      await list.addItem(trimmed, quantity.trim());
      setName("");
      setQuantity("");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setAdding(false);
    }
  };

  const renderItems = (items: ShoppingItem[]) =>
    items.map((item) => (
      <ItemRow
        key={item.id}
        item={item}
        disabled={busy}
        onToggle={(checked) => run(() => list.setChecked(item.id, checked))}
        onRemove={() => run(() => list.removeItem(item.id))}
      />
    ));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Shopping list"
        description={`Shared with everyone in ${household.name}.`}
      />
      <Card data-testid="shopping-list">
        <CardBody className="flex flex-col gap-4 pt-4">
          <form onSubmit={handleAdd} className="flex gap-2">
            <Input
              data-testid="shopping-add-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Add an item, e.g. Milk"
              aria-label="Item"
              maxLength={100}
              className="min-w-0 flex-1"
            />
            <Input
              data-testid="shopping-add-quantity"
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Qty"
              aria-label="Quantity (optional)"
              maxLength={30}
              className="w-20 sm:w-36"
            />
            <AddButton
              data-testid="shopping-add-submit"
              type="submit"
              label="Add"
              disabled={adding || !name.trim()}
            />
          </form>

          <ErrorNote error={actionError ?? list.error} />

          {list.loading && list.items.length === 0 ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : (
            <>
              <section>
                <h3 className="text-sm font-semibold">
                  To buy ({open.length})
                </h3>
                {open.length === 0 ? (
                  <p
                    data-testid="shopping-empty"
                    className="py-2 text-sm text-subtle"
                  >
                    Nothing on the list.
                  </p>
                ) : (
                  <ul
                    data-testid="shopping-open-items"
                    className="divide-y divide-border-subtle"
                  >
                    {renderItems(open)}
                  </ul>
                )}
              </section>

              {done.length > 0 && (
                <section>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">
                      Done ({done.length})
                    </h3>
                    <Button
                      data-testid="shopping-clear-checked"
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => run(list.clearChecked)}
                    >
                      Clear checked
                    </Button>
                  </div>
                  {household.settings.expensesEnabled &&
                    (buying ? (
                      <div className="my-2 rounded border border-border-subtle p-3">
                        <p className="mb-2 text-sm text-muted">
                          Add the receipt total for what you bought; it&apos;s
                          split like any other expense.
                        </p>
                        <ExpenseForm
                          household={household}
                          currency={household.settings.currency}
                          initialDescription={myUnpaid
                            .map((i) => i.name)
                            .join(", ")
                            .slice(0, 200)}
                          submitLabel="Add expense"
                          onSubmit={async (input) => {
                            await list.recordPurchase({
                              ...input,
                              shoppingItemIds: myUnpaid.map((i) => i.id),
                            });
                            setBuying(false);
                          }}
                          onCancel={() => setBuying(false)}
                        />
                      </div>
                    ) : (
                      myUnpaid.length > 0 && (
                        <Button
                          data-testid="shopping-bought"
                          variant="outline"
                          size="sm"
                          className="my-1"
                          disabled={busy}
                          onClick={() => setBuying(true)}
                        >
                          I bought these ({myUnpaid.length}) → add expense
                        </Button>
                      )
                    ))}
                  <ul
                    data-testid="shopping-done-items"
                    className="divide-y divide-border-subtle"
                  >
                    {renderItems(done)}
                  </ul>
                </section>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
