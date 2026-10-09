"use client";

import Link from "next/link";
import type { Household } from "@/hooks/useHouseholds";
import { Card, CardBody } from "@/components/ui/Card";

export function ModuleOff({
  household,
  moduleName,
}: {
  household: Household;
  moduleName: string;
}) {
  return (
    <Card data-testid="module-off">
      <CardBody>
        <p className="text-sm">
          The {moduleName} is turned off for {household.name}.
        </p>
        {household.myRole === "owner" ? (
          <p className="mt-1 text-sm text-muted">
            You can turn it on in the{" "}
            <Link
              href={`/household/${household.id}`}
              className="underline underline-offset-2"
            >
              owner settings
            </Link>
            .
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">
            The household owner can turn it on.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
