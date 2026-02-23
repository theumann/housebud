"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getUserDisplayName } from "../../lib/displayName";

type ProfilePayload = {
  firstName: string;
  lastName: string;
  displayName: string; // optional in UX, but stored as "" / null here
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
    firstName: "",
    lastName: "",
    displayName: "",
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
            firstName: p.firstName || "",
            lastName: p.lastName || "",
            displayName: p.displayName || "",
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
            firstName: p.firstName || "",
            lastName: p.lastName || "",
            displayName: user.profile.displayName || "",
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

    if (form.displayName.length > 50) {
      setError("Display name is too long (max 50 characters)");
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
          firstName: form.firstName,
          lastName: form.lastName,
          displayName: form.displayName.trim() || null,
          school: form.school,
          collegeYear: form.collegeYear,
          targetCity: form.targetCity,
          targetState: form.targetState,
          targetZip: form.targetZip,
          bio: form.bio,
          avatarUrl: form.avatarUrl,
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
    saving || loadingProfile || !isDirty;

  const avatarPreview =
    form.avatarUrl && form.avatarUrl.trim().length > 0
      ? form.avatarUrl.trim()
      : null;

  return (
    <PageContainer data-testid="profile-edit-page">
      <header className="mb-4">
        <h1>{getUserDisplayName(user)}</h1>
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
                {/* displayName */}
                <div>
                  <label className="block text-sm mb-1">Display name</label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={(e) =>
                      handleChange("displayName", e.target.value)
                    }
                    className="w-full border rounded px-3 py-2"
                    placeholder="How others see you"
                  />
                </div>

                {/* School */}
                <div className="flex flex-col-reverse">
                  <input
                    id="profile-school"
                    type="text"
                    value={form.school}
                    onChange={(e) =>
                      handleChange("school", e.target.value)
                    }
                    className="peer w-full border rounded px-3 py-2"
                    placeholder="USF, SFSU, UCSF…"
                    required
                  />
                  <label
                    htmlFor="profile-school"
                    className="block text-sm mb-1 peer-required:after:content-['*'] peer-required:after:text-red-600"
                  >
                    School
                  </label>
                </div>

                {/* College year */}
                <div className="flex flex-col-reverse">
                  <select
                    id="profile-college-year"
                    value={form.collegeYear}
                    onChange={(e) =>
                      handleChange("collegeYear", e.target.value)
                    }
                    className="peer w-full border rounded px-3 py-2 bg-white"
                    required
                  >
                    <option value="">Select year</option>
                    <option value="Freshman">Freshman</option>
                    <option value="Sophomore">Sophomore</option>
                    <option value="Junior">Junior</option>
                    <option value="Senior">Senior</option>
                  </select>
                  <label
                    htmlFor="profile-college-year"
                    className="block text-sm mb-1 peer-required:after:content-['*'] peer-required:after:text-red-600"
                  >
                    College year
                  </label>
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm mb-1">Short bio</label>
                  <textarea
                    value={form.bio}
                    onChange={(e) =>
                      handleChange("bio", e.target.value)
                    }
                    rows={3}
                    className="w-full resize-none border rounded px-3 py-2"
                    placeholder="Tell potential roommates a bit about yourself."
                  />
                </div>
              </div>

              {/* Right column: Location + avatar */}
              <div className="space-y-4">
                {/* Target city */}
                <div className="flex flex-col-reverse">
                  <input
                    id="profile-target-city"
                    type="text"
                    value={form.targetCity}
                    onChange={(e) =>
                      handleChange("targetCity", e.target.value)
                    }
                    className="peer w-full border rounded px-3 py-2"
                    placeholder="San Francisco"
                    required
                  />
                  <label
                    htmlFor="profile-target-city"
                    className="block text-sm mb-1 peer-required:after:content-['*'] peer-required:after:text-red-600"
                  >
                    Target city
                  </label>
                </div>

                {/* Target state */}
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <div className="flex flex-col-reverse">
                    <input
                      id="profile-target-state"
                      type="text"
                      value={form.targetState}
                      onChange={(e) =>
                        handleChange("targetState", e.target.value)
                      }
                      className="peer w-full border rounded px-3 py-2"
                      placeholder="CA"
                      required
                    />
                    <label
                      htmlFor="profile-target-state"
                      className="block text-sm mb-1 peer-required:after:content-['*'] peer-required:after:text-red-600"
                    >
                      Target state
                    </label>
                  </div>

                  {/* Zip */}
                  <div className="flex flex-col-reverse">
                    <input
                      id="profile-target-zip"
                      type="text"
                      value={form.targetZip}
                      onChange={(e) =>
                        handleChange("targetZip", e.target.value)
                      }
                      className="peer w-full border rounded px-3 py-2"
                      placeholder="94117"
                      required
                    />
                    <label
                      htmlFor="profile-target-zip"
                      className="block text-sm mb-1 peer-required:after:content-['*'] peer-required:after:text-red-600"
                    >
                      Target ZIP
                    </label>
                  </div>
                </div>

                {/* Avatar URL + preview */}
                <div>
                  <label className="block text-sm mb-1">Avatar URL</label>
                  <input
                    type="url"
                    value={form.avatarUrl}
                    onChange={(e) =>
                      handleChange("avatarUrl", e.target.value)
                    }
                    className="w-full border rounded px-3 py-2"
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
              Your display name and school help others recognize you. Location is
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

