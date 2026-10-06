"use client";

import { useEffect } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useHouseholds } from "@/hooks/useHouseholds";
import { CurrentHouseholdContext } from "@/context/CurrentHouseholdContext";
import { InviteInbox } from "@/components/household/InviteInbox";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";

export default function HouseholdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { householdId } = useParams<{ householdId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { households, loadingHouseholds, householdsError, reload } =
    useHouseholds();

  const household = households.find((h) => h.id === householdId) ?? null;
  // Not a member (left, removed, or a stale link): /household picks another
  // household or offers create/join.
  const missing =
    !!user && !loadingHouseholds && !householdsError && !household;

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (missing) router.replace("/household");
  }, [missing, router]);

  if (loading) {
    return (
      <PageContainer>
        <p>Loading...</p>
      </PageContainer>
    );
  }

  if (!user) return null;

  // Switching households keeps you on the same page (overview, shopping…).
  const subpath = pathname.slice(`/household/${householdId}`.length);

  return (
    <CurrentHouseholdContext.Provider
      value={household ? { household, reload } : null}
    >
      <PageContainer data-testid="household-page">
        {householdsError && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {householdsError}
          </div>
        )}

        <InviteInbox onAccepted={(id) => router.push(`/household/${id}`)} />

        {households.length > 1 && (
          <div
            data-testid="household-switcher"
            className="mb-4 flex flex-wrap gap-2"
          >
            {households.map((h) => (
              <Button
                key={h.id}
                size="sm"
                variant={h.id === householdId ? "primary" : "secondary"}
                onClick={() => router.push(`/household/${h.id}${subpath}`)}
              >
                {h.name}
              </Button>
            ))}
          </div>
        )}

        {household ? children : <p>Loading...</p>}
      </PageContainer>
    </CurrentHouseholdContext.Provider>
  );
}
