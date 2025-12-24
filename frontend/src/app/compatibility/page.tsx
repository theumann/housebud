"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type CompatibilityQuestion = {
  id: string;
  code: string;
  text: string;
  helperText?: string | null;
  category?: string | null;
  type: "single_choice" | "scale_1_5" | "free_text";
  options: string[] | null;
  orderIndex: number;
};

type AnswerDto = {
  questionId: string;
  value: string;
};

const toTestId = (s: string) =>
  s
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export default function CompatibilityPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [questions, setQuestions] = useState<CompatibilityQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  
  const grouped = questions.reduce<Record<string, CompatibilityQuestion[]>>((acc, q) => {
    const cat = (q.category || "General").trim() || "General";
    (acc[cat] ||= []).push(q);
    return acc;
  }, {});

  const categories = Object.entries(grouped).sort(([a], [b]) => {
    const A = a.trim().toLowerCase();
    const B = b.trim().toLowerCase();
    if (A === "additional info") return 1;
    if (B === "additional info") return -1;
    return a.localeCompare(b);
  });

  useEffect(() => {
    if (categories.length === 0) return;

    setOpenCats((prev) => {
      // if already initialized, don't clobber user toggles
      if (Object.keys(prev).length > 0) return prev;

      const initial: Record<string, boolean> = {};
      categories.forEach(([cat]) => {
        initial[cat] = true; // or default false if you prefer
      });
      return initial;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.length]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      setLoadingQuestions(true);
      setError(null);
      try {
        const qs = await apiFetch<CompatibilityQuestion[]>(
          "/compatibility/questions",
          { token }
        );
        setQuestions(qs || []);

        const initial: Record<string, string> = {};
        (qs || []).forEach((q) => {
          initial[q.id] = "";
        });

        // load my answers
        const myAnswersResp = await apiFetch<any>(
          "/compatibility/answers/me",
          { token }
        );

        const myAnswers: AnswerDto[] = Array.isArray(myAnswersResp)
          ? myAnswersResp
          : Array.isArray(myAnswersResp?.answers)
          ? myAnswersResp.answers
          : [];


        myAnswers.forEach((a) => {
          initial[a.questionId] = a.value;
        });
        setAnswers(initial);
      } catch (err: any) {
        setError(err.message || "Failed to load compatibility questions");
      } finally {
        setLoadingQuestions(false);
      }
    };

    load();
  }, [token]);

  if (loading) {
    return (
      <PageContainer>
        <p>Loading...</p>
      </PageContainer>
    );
  }

  if (!user) return null;

  const handleChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
    setSuccess(null);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const payload: AnswerDto[] = Object.entries(answers).map(
    ([questionId, value]) => ({ questionId, value: value ?? "" })
    );
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch<{ message: string }>("/compatibility/answers/me", {
        method: "PUT",
        token,
        body: payload,
      });
      setSuccess("Your compatibility preferences have been saved.");
    } catch (err: any) {
      setError(err.message || "Failed to save answers");
    } finally {
      setSaving(false);
    }
  };

  const answeredCount = Object.values(answers).filter((v) => v).length;
  const totalQuestions = questions.length;
  const coverage =
    totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  return (
    <PageContainer data-testid="compatibility-page">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Compatibility profile</h1>
        <p className="mt-1 text-sm text-gray-600">
          Answer a few questions so we can propose roommates whose lifestyle is
          closer to yours. For the MVP, these answers are used only for match
          scoring.
        </p>
      </header>

      <div className="mb-4 grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* Summary card */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Your coverage</h2>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600">
              Answered questions:{" "}
              <span className="font-semibold">
                {answeredCount} / {totalQuestions || "—"}
              </span>
            </p>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Profile completeness</span>
                <span>{coverage}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-primary-500"
                  style={{ width: `${coverage}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Matching works best when you answer at least{" "}
                <strong>20%</strong> of the questions. You can update your
                answers at any time.
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Instructions card */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">How this is used</h2>
          </CardHeader>
          <CardBody>
            <ul className="list-disc space-y-1 pl-5 text-xs text-gray-600">
              <li>
                We don&apos;t show these answers to other users; they are used
                behind the scenes for compatibility scoring.
              </li>
              <li>
                Matches are still filtered by school / city first, then sorted
                by compatibility when enough answers are available.
              </li>
              <li>
                Future versions may let you mark some questions as more
                important than others (not part of MVP yet).
              </li>
            </ul>
          </CardBody>
        </Card>
      </div>

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

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">Questions</h2>
          {loadingQuestions && (
            <p className="mt-1 text-xs text-gray-500">Loading…</p>
          )}
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardBody>
            {questions.length === 0 && !loadingQuestions && (
              <p className="text-sm text-gray-500">
                No compatibility questions are configured yet.
              </p>
            )}

          <div className="space-y-3">
  {categories.map(([cat, qs]) => {
    const isOpen = openCats[cat] ?? true;
    const catAnswered = qs.filter((q) => (answers[q.id] ?? "").trim().length > 0).length;

    return (
      <div key={cat} className="rounded-md border border-border-subtle bg-surface">
        <button
          type="button"
          onClick={() => setOpenCats((prev) => ({ ...prev, [cat]: !isOpen }))}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
          data-testid={`compat-category-${toTestId(cat)}`}
        >
          <div>
            <p className="text-sm font-semibold text-gray-900">{cat}</p>
            <p className="text-xs text-gray-500">
              {catAnswered} / {qs.length} answered
            </p>
          </div>
          <span className="text-xs text-gray-500">{isOpen ? "Hide" : "Show"}</span>
        </button>

        {isOpen && (
          <div className="px-4 pb-4">
            <div className="space-y-4">
              {qs.map((q, idx) => {
                const value = answers[q.id] ?? "";
                const options = q.options || [];
                return (
                  <div
                    key={q.id}
                    data-testid={`question-${q.id}`}
                    className="border-b border-border-subtle pb-3 last:border-b-0"
                  >
                    <p className="text-sm font-medium text-gray-800">
                      {q.text}
                    </p>

                    {q.helperText && (
                      <p className="mt-1 text-xs text-gray-500">{q.helperText}</p>
                    )}

                    {q.type === "single_choice" && options.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {options.map((opt) => (
                          <label
                            key={opt}
                            className="flex cursor-pointer items-center gap-2 text-xs text-gray-700"
                          >
                            <input
                              type="radio"
                              name={q.id}
                              value={opt}
                              checked={value === opt}
                              onChange={() => handleChange(q.id, opt)}
                              data-testid={`question-${q.id}-option-${toTestId(opt)}`}
                              className="h-3 w-3"
                            />
                            <span>{opt}</span>
                          </label>
                        ))}

                        {/* UI-only remove/clear */}
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-700">
                          <input
                            type="radio"
                            name={q.id}
                            value=""
                            checked={value === ""}
                            onChange={() => handleChange(q.id, "")}
                            data-testid={`question-${q.id}-option-none`}
                            className="h-3 w-3"
                          />
                          <span className="italic text-gray-500">Prefer not to answer</span>
                        </label>
                      </div>
                    )}

                    {q.type === "free_text" && (
                      <p className="mt-1 text-xs text-gray-500">
                        (Free text not enabled in MVP UI yet.)
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  })}
</div>
          </CardBody>

          <CardFooter className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              You can adjust these answers at any time.
            </p>
            <Button
              data-testid="save-answers-button"
              type="submit"
              variant="primary"
              size="sm"
              disabled={saving || loadingQuestions}
            >
              {saving ? "Saving…" : "Save answers"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </PageContainer>
  );
}
