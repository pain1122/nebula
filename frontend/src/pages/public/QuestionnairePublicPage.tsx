import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";


type Choice = { id: number; text: string; score: number };
type Question = { id: number; text: string; choices: Choice[] };
type Questionnaire = {
  id: number;
  title: string;
  slug: string;
  cover_image_url: string | null;
  content_html: string;
  questions: Question[];
};

type SubmitResponse = {
  submission_id: number;
  total_score: number;
  recommendation: null | { title: string; body_html: string | null };
};

function buildHeaders(extra?: Record<string, string>): HeadersInit {
  const headers = new Headers(extra);

  const token =
    localStorage.getItem("auth_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    "";

  if (token) headers.set("Authorization", `Bearer ${token}`);

  return headers;
}

function firstValidationError(errors: unknown): string | null {
  if (!errors || typeof errors !== "object") return null;

  const vals = Object.values(errors as Record<string, unknown>);

  for (const v of vals) {
    if (Array.isArray(v) && v.length && typeof v[0] === "string") return v[0];
    if (typeof v === "string") return v;
  }

  return null;
}


export default function QuestionnairePublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const [personal, setPersonal] = useState({ name: "", phone: "" });


  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string>("");
  const [result, setResult] = useState<SubmitResponse | null>(null);

  const [data, setData] = useState<Questionnaire | null>(null);

  // answers: question_id -> choice_id
  const [answers, setAnswers] = useState<Record<number, number>>({});


  useEffect(() => {
    const abort = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: buildHeaders({ Accept: "application/json" }),
          signal: abort.signal,
        });

        if (!res.ok) return;

        const me = await res.json().catch(() => null);

        const fullName =
          (me?.name && String(me.name).trim()) ||
          [me?.first_name, me?.last_name].filter(Boolean).join(" ").trim();

        setPersonal({
          name: fullName || "",
          phone: me?.phone ? String(me.phone) : "",
        });
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    })();

    return () => abort.abort();
  }, []);


  useEffect(() => {
    const abort = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setErr("");
        setSubmitErr("");
        setResult(null);

        const res = await fetch(
          `${API_BASE}/api/questionnaires/${encodeURIComponent(slug || "")}`,
          {
            headers: { Accept: "application/json" },
            signal: abort.signal,
          }
        );

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(json?.message || `خطا در دریافت پرسشنامه (${res.status})`);
        }

        setData(json);
        setAnswers({});
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setErr(e?.message || "خطای شبکه/سرور");
      } finally {
        setLoading(false);
      }
    })();

    return () => abort.abort();
  }, [slug]);

  const totalQuestions = data?.questions?.length || 0;

  const answeredCount = useMemo(() => {
    if (!data) return 0;
    return data.questions.reduce((acc, q) => acc + (answers[q.id] ? 1 : 0), 0);
  }, [data, answers]);

  const canSubmit =
    totalQuestions > 0 &&
    answeredCount === totalQuestions &&
    personal.name.trim().length > 1 &&
    personal.phone.trim().length > 0;

  const totalScore = useMemo(() => {
    if (!data) return 0;
    let s = 0;
    for (const q of data.questions) {
      const chosenId = answers[q.id];
      const ch = q.choices.find((c) => c.id === chosenId);
      if (ch) s += Number(ch.score || 0);
    }
    return s;
  }, [data, answers]);

  const onSelect = (questionId: number, choiceId: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: choiceId }));
  };

  const onSubmit = async () => {
    if (!slug || !data) return;

    setSubmitting(true);
    setSubmitErr("");

    try {
      const payload = {
        submitter_name: personal.name.trim(),
        submitter_phone: personal.phone.trim(),
        answers: data.questions.map((q) => ({
          question_id: q.id,
          choice_id: answers[q.id],
        })),
      };

      const res = await fetch(
        `${API_BASE}/api/questionnaires/${encodeURIComponent(slug)}/submit`,
        {
          method: "POST",
          headers: buildHeaders({
            "Content-Type": "application/json",
            Accept: "application/json",
          }),
          body: JSON.stringify(payload),
          // cookie-based:
          // credentials: "include",
        }
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          (json && typeof json === "object" && "message" in json && typeof (json as any).message === "string"
            ? (json as any).message
            : null) ||
          firstValidationError((json as any)?.errors) ||
          `خطا در ثبت (${res.status})`;

        throw new Error(msg);

      }

      setResult(json as SubmitResponse);

      // اسکرول به نتیجه
      setTimeout(() => {
        const el = document.getElementById("result-box");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (e: any) {
      setSubmitErr(e?.message || "خطای شبکه/سرور در ثبت");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-content">
      <div className="container" style={{ maxWidth: 980 }}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <div>
            <div className="text-muted small mb-1">
              <Link to="/questionnaires">← بازگشت به لیست</Link>
            </div>
            <h3 className="mb-1">{data?.title || "پرسشنامه"}</h3>
            {data ? (
              <div className="text-muted">
                {answeredCount} از {totalQuestions} پاسخ داده شده
              </div>
            ) : null}
          </div>

          {data ? (
            <div className="text-end">
              <div className="text-muted small">امتیاز فعلی</div>
              <div className="fw-bold" style={{ fontSize: 18 }}>
                {totalScore}
              </div>
            </div>
          ) : null}
        </div>

        {err ? <div className="alert alert-danger">{err}</div> : null}
        {loading ? <div className="alert alert-info">در حال دریافت...</div> : null}

        {!loading && data ? (
          <>
            {data.cover_image_url ? (
              <img
                src={data.cover_image_url}
                alt={data.title}
                className="img-fluid rounded mb-3"
                style={{ maxHeight: 260, objectFit: "cover", width: "100%" }}
              />
            ) : null}

            {data.content_html ? (
              <div className="card mb-3">
                <div className="card-body">
                  <div className="card mb-3">
                    <div className="card-header fw-semibold">اطلاعات فردی</div>
                    <div className="card-body">
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">نام و نام خانوادگی</label>
                          <input
                            className="form-control"
                            value={personal.name}
                            onChange={(e) => setPersonal(p => ({ ...p, name: e.target.value }))}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">شماره تماس</label>
                          <input
                            className="form-control"
                            value={personal.phone}
                            onChange={(e) => setPersonal(p => ({ ...p, phone: e.target.value }))}
                            dir="ltr"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: data.content_html }} />
                </div>
              </div>
            ) : null}

            {/* ✅ Result */}
            {result ? (
              <div className="card mb-3" id="result-box">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <div className="fw-semibold">نتیجه</div>
                  <div className="text-muted">
                    امتیاز نهایی: <span className="fw-bold">{result.total_score}</span>
                  </div>
                </div>
                <div className="card-body">
                  {result.recommendation ? (
                    <>
                      <h5 className="mb-2">{result.recommendation.title}</h5>
                      {result.recommendation.body_html ? (
                        <div
                          dangerouslySetInnerHTML={{ __html: result.recommendation.body_html }}
                        />
                      ) : (
                        <div className="text-muted">متنی برای نمایش موجود نیست.</div>
                      )}
                    </>
                  ) : (
                    <div className="text-muted">
                      برای این امتیاز، توصیه‌ای تعریف نشده است.
                    </div>
                  )}

                  <div className="text-muted small mt-3">
                    کد رهگیری: #{result.submission_id}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Questions */}
            <div className="card">
              <div className="card-body">
                {data.questions.map((q, idx) => (
                  <div key={q.id} className="border rounded p-3 mb-3">
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <div className="fw-semibold">
                        {idx + 1}. {q.text}
                      </div>
                      {answers[q.id] ? (
                        <span className="badge bg-success">پاسخ داده شد</span>
                      ) : (
                        <span className="badge bg-light text-dark">در انتظار</span>
                      )}
                    </div>

                    <div className="mt-3 d-flex flex-column gap-2">
                      {q.choices.map((c) => {
                        const checked = answers[q.id] === c.id;
                        return (
                          <label
                            key={c.id}
                            className={`border rounded p-2 d-flex align-items-center gap-2 ${checked ? "bg-light" : ""
                              }`}
                            style={{ cursor: "pointer" }}
                          >
                            <input
                              type="radio"
                              name={`q_${q.id}`}
                              checked={checked}
                              onChange={() => onSelect(q.id, c.id)}
                            />
                            <span>{c.text}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {submitErr ? <div className="alert alert-danger">{submitErr}</div> : null}

                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="text-muted">
                    برای ثبت نهایی باید همه سؤال‌ها پاسخ داده شوند.
                  </div>

                  <button
                    className="btn btn-primary"
                    disabled={!canSubmit || submitting || !!result}
                    onClick={onSubmit}
                  >
                    {result
                      ? "ثبت شد ✅"
                      : submitting
                        ? "در حال ثبت..."
                        : "ثبت و مشاهده نتیجه"}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
