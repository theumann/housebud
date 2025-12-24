"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type ProfilePayload = {
  nickname: string;
  school: string;
  collegeYear: string;
  targetCity: string;
  targetState: string;
  targetZip: string;
  bio: string;
  avatarUrl: string;
};

export default function ProfilePage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<ProfilePayload>({
    nickname: "",
    school: "",
    collegeYear: "",
    targetCity: "",
    targetState: "",
    targetZip: "",
    bio: "",
    avatarUrl: "",
  });

  const [initialForm, setInitialForm] = useState<ProfilePayload | null>(null);

  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Load profile from backend
  useEffect(() => {
    if (!token) return;

    const loadProfile = async () => {
      setLoadingProfile(true);
      setError(null);

      try {
        // backend might return either the profile directly or { profile: {...} }
        const resp = await apiFetch<any>("/profile/me", { token });

        const p = resp?.profile ?? resp ?? null;

        if (p) {
          const next: ProfilePayload = {
            nickname: p.nickname || "",
            school: p.school || "",
            collegeYear: p.collegeYear || "",
            targetCity: p.targetCity || "",
            targetState: p.targetState || "",
            targetZip: p.targetZip || "",
            bio: p.bio || "",
            avatarUrl: p.avatarUrl || "",
          };
          setForm(next);
          setInitialForm(next);
        } else if (user?.profile) {
          // Fallback: use what we already have in AuthContext
          const next: ProfilePayload = {
            nickname: user.profile.nickname || "",
            school: user.profile.school || "",
            collegeYear: user.profile.collegeYear || "",
            targetCity: user.profile.targetCity || "",
            targetState: user.profile.targetState || "",
            targetZip: user.profile.targetZip || "",
            bio: "",
            avatarUrl: "",
          };
          setForm(next);
          setInitialForm(next);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load profile");
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfile();
  }, [token, user]);

  if (loading) {
    return (
      <PageContainer>
        <p>Loading...</p>
      </PageContainer>
    );
  }

  if (!user) return null;

  const handleChange = (
    field: keyof ProfilePayload,
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!form.nickname.trim()) {
      setError("Nickname is required.");
      setSuccess(null);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch("/profile/me", {
        method: "PATCH", // your backend uses PATCH, not PUT
        token,
        body: {
          ...form,
        },
      });

      setSuccess("Profile saved successfully.");
      setInitialForm(form); // reset dirty state baseline
    } catch (err: any) {
      setError(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const isDirty =
    !!initialForm &&
    JSON.stringify(initialForm) !== JSON.stringify(form);

  const disableSave =
    saving || loadingProfile || !form.nickname.trim() || !isDirty;

  const avatarPreview =
    form.avatarUrl && form.avatarUrl.trim().length > 0
      ? form.avatarUrl.trim()
      : null;

  return (
    <PageContainer data-testid="profile-edit-page">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Your profile</h1>
        <p className="mt-1 text-sm text-gray-600">
          This information is used for matching and how you appear to others in
          the app.
        </p>
      </header>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">Account & roommate profile</h2>
          {loadingProfile && (
            <p className="mt-1 text-xs text-gray-500">Loading profile…</p>
          )}
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardBody>
            {error && (
              <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-3 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {success}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)]">
              {/* Left column */}
              <div className="space-y-4">
                {/* Nickname */}
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    In-app nickname<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.nickname}
                    onChange={(e) =>
                      handleChange("nickname", e.target.value)
                    }
                    className="mt-1 w-full rounded-md border border-border-subtle px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="What should other users see?"
                  />
                </div>

                {/* School */}
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    School
                  </label>
                  <input
                    type="text"
                    value={form.school}
                    onChange={(e) =>
                      handleChange("school", e.target.value)
                    }
                    className="mt-1 w-full rounded-md border border-border-subtle px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="USF, SFSU, UCSF…"
                  />
                </div>

                {/* College year */}
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    College year
                  </label>
                  <input
                    type="text"
                    value={form.collegeYear}
                    onChange={(e) =>
                      handleChange("collegeYear", e.target.value)
                    }
                    className="mt-1 w-full rounded-md border border-border-subtle px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Freshman, Sophomore, 1st year grad…"
                  />
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    Short bio (optional)
                  </label>
                  <textarea
                    value={form.bio}
                    onChange={(e) =>
                      handleChange("bio", e.target.value)
                    }
                    rows={3}
                    className="mt-1 w-full resize-none rounded-md border border-border-subtle px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Tell potential roommates a bit about yourself."
                  />
                </div>
              </div>

              {/* Right column: Location + avatar */}
              <div className="space-y-4">
                {/* Target city */}
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    Target city
                  </label>
                  <input
                    type="text"
                    value={form.targetCity}
                    onChange={(e) =>
                      handleChange("targetCity", e.target.value)
                    }
                    className="mt-1 w-full rounded-md border border-border-subtle px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="San Francisco"
                  />
                </div>

                {/* Target state */}
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700">
                      Target state
                    </label>
                    <input
                      type="text"
                      value={form.targetState}
                      onChange={(e) =>
                        handleChange("targetState", e.target.value)
                      }
                      className="mt-1 w-full rounded-md border border-border-subtle px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="CA"
                    />
                  </div>

                  {/* Zip */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700">
                      Target ZIP
                    </label>
                    <input
                      type="text"
                      value={form.targetZip}
                      onChange={(e) =>
                        handleChange("targetZip", e.target.value)
                      }
                      className="mt-1 w-full rounded-md border border-border-subtle px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="94117"
                    />
                  </div>
                </div>

                {/* Avatar URL + preview */}
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    Avatar URL (optional)
                  </label>
                  <input
                    type="url"
                    value={form.avatarUrl}
                    onChange={(e) =>
                      handleChange("avatarUrl", e.target.value)
                    }
                    className="mt-1 w-full rounded-md border border-border-subtle px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="https://example.com/your-photo.jpg"
                  />
                  {avatarPreview && (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-full bg-surface-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={avatarPreview}
                          alt="Avatar preview"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        This image will be shown on your cards and in chats.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardBody>

          <CardFooter className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Your nickname and school help others recognize you. Location is
              used to filter and sort matches.
            </p>
            <Button
              data-testid="save-profile-button"
              type="submit"
              variant="primary"
              size="sm"
              disabled={disableSave}
            >
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </PageContainer>
  );
}
