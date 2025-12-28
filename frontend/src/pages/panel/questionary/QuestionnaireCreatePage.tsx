// frontend/src/pages/panel/questionary/QuestionnaireCreatePage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

// مسیر را اگر متفاوت است اصلاح کن:
import RichTextEditor from "../../../components/editor/RichTextEditor"

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function getToken() {
    return localStorage.getItem("auth_token") || "";
}

type Status = "draft" | "published";

type Choice = {
    id: string;
    text: string;
    score: number;
};

type Question = {
    id: string;
    text: string;
    choices: Choice[];
    sort_order?: number;
};

type Recommendation = {
    id: string;
    min_score: number;
    max_score: number;
    title: string;
    body_html: string;
    priority?: number;
};

type QuestionnairePayload = {
    title: string;
    slug: string;
    status: Status;
    cover_image_url: string | null;
    content_html: string;
    questions: Array<{
        text: string;
        sort_order?: number;
        choices: Array<{
            text: string;
            score: number;
            sort_order?: number;
        }>;
    }>;
    recommendations: Array<{
        min_score: number;
        max_score: number;
        title: string;
        body_html?: string | null;
        priority?: number;
        conditions?: any;
    }>;
};

const uid = () => Math.random().toString(36).slice(2);

function slugifyFaLike(input: string) {
    // یک slugify ساده (اگر خودت slug را دستی می‌دی، همین هم کافی است)
    return input
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\w\u0600-\u06FF-]+/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

export default function QuestionnaireCreatePage() {
    const nav = useNavigate();
    const { id } = useParams<{ id: string }>();

    const isEdit = useMemo(() => !!id && id !== "new", [id]);

    const [loading, setLoading] = useState<boolean>(false);
    const [saving, setSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Base fields
    const [title, setTitle] = useState<string>("");
    const [slug, setSlug] = useState<string>("");
    const [status, setStatus] = useState<Status>("draft");
    const [coverImageUrl, setCoverImageUrl] = useState<string>("");
    const [contentHtml, setContentHtml] = useState<string>("");

    // Nested
    const [questions, setQuestions] = useState<Question[]>([]);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

    // --- Helpers: Questions ---
    const addQuestion = () => {
        setQuestions((prev) => [
            ...prev,
            {
                id: uid(),
                text: "",
                choices: [{ id: uid(), text: "", score: 0 }],
            },
        ]);
    };

    const removeQuestion = (qid: string) => {
        setQuestions((prev) => prev.filter((q) => q.id !== qid));
    };

    const updateQuestionText = (qid: string, text: string) => {
        setQuestions((prev) => prev.map((q) => (q.id === qid ? { ...q, text } : q)));
    };

    const addChoice = (qid: string) => {
        setQuestions((prev) =>
            prev.map((q) =>
                q.id === qid ? { ...q, choices: [...q.choices, { id: uid(), text: "", score: 0 }] } : q
            )
        );
    };

    const removeChoice = (qid: string, cid: string) => {
        setQuestions((prev) =>
            prev.map((q) =>
                q.id === qid
                    ? { ...q, choices: q.choices.filter((c) => c.id !== cid) }
                    : q
            )
        );
    };

    const updateChoice = (qid: string, cid: string, patch: Partial<Choice>) => {
        setQuestions((prev) =>
            prev.map((q) =>
                q.id !== qid
                    ? q
                    : {
                        ...q,
                        choices: q.choices.map((c) => (c.id === cid ? { ...c, ...patch } : c)),
                    }
            )
        );
    };

    // --- Helpers: Recommendations ---
    const addRecommendation = () => {
        setRecommendations((prev) => [
            ...prev,
            {
                id: uid(),
                min_score: 0,
                max_score: 0,
                title: "",
                body_html: "",
            },
        ]);
    };

    const removeRecommendation = (rid: string) => {
        setRecommendations((prev) => prev.filter((r) => r.id !== rid));
    };

    const updateRecommendation = (rid: string, patch: Partial<Recommendation>) => {
        setRecommendations((prev) => prev.map((r) => (r.id === rid ? { ...r, ...patch } : r)));
    };

    // --- Load for edit ---
    useEffect(() => {
        if (!isEdit) return;

        const abort = new AbortController();
        (async () => {
            try {
                setLoading(true);
                setError(null);

                const token = getToken();
                if (!token) {
                    nav("/login");
                    return;
                }

                const res = await fetch(`${API_BASE}/api/admin/questionnaires/${encodeURIComponent(id!)}`, {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    signal: abort.signal,
                });


                if (!res.ok) {
                    const txt = await res.text().catch(() => "");
                    throw new Error(`خطا در دریافت اطلاعات (${res.status}). ${txt}`);
                }

                const data = await res.json();

                setTitle(data.title ?? "");
                setSlug(data.slug ?? "");
                setStatus((data.status ?? "draft") as Status);
                setCoverImageUrl(data.cover_image_url ?? "");
                setContentHtml(data.content_html ?? "");

                // questions + choices
                const qList: Question[] = (data.questions ?? []).map((q: any) => ({
                    id: String(q.id ?? uid()),
                    text: q.text ?? "",
                    sort_order: q.sort_order ?? 0,
                    choices: (q.choices ?? []).map((c: any) => ({
                        id: String(c.id ?? uid()),
                        text: c.text ?? "",
                        score: Number(c.score ?? 0),
                    })),
                }));

                setQuestions(qList.length ? qList : []);

                // recommendations
                const rList: Recommendation[] = (data.recommendations ?? []).map((r: any) => ({
                    id: String(r.id ?? uid()),
                    min_score: Number(r.min_score ?? 0),
                    max_score: Number(r.max_score ?? 0),
                    title: r.title ?? "",
                    body_html: r.body_html ?? "",
                    priority: Number(r.priority ?? 0),
                }));

                setRecommendations(rList.length ? rList : []);
            } catch (e: any) {
                if (e?.name === "AbortError") return;
                setError(e?.message ?? "خطای ناشناخته");
            } finally {
                setLoading(false);
            }
        })();

        return () => abort.abort();
    }, [isEdit, id]);

    // --- Validation (minimal) ---
    function validateBeforeSave(): string | null {
        if (!title.trim()) return "عنوان الزامی است.";
        if (!slug.trim()) return "اسلاگ الزامی است.";
        if (!questions.length) return "حداقل یک سؤال باید اضافه شود.";

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.text.trim()) return `متن سؤال ${i + 1} خالی است.`;
            if (!q.choices.length) return `سؤال ${i + 1} باید حداقل یک گزینه داشته باشد.`;
            for (let j = 0; j < q.choices.length; j++) {
                const c = q.choices[j];
                if (!c.text.trim()) return `متن گزینه ${j + 1} در سؤال ${i + 1} خالی است.`;
                if (!Number.isFinite(c.score)) return `امتیاز گزینه ${j + 1} در سؤال ${i + 1} معتبر نیست.`;
            }
        }

        for (let k = 0; k < recommendations.length; k++) {
            const r = recommendations[k];
            if (!Number.isFinite(r.min_score) || !Number.isFinite(r.max_score)) return `بازه امتیاز توصیه ${k + 1} معتبر نیست.`;
            if (r.min_score > r.max_score) return `حداقل امتیاز در توصیه ${k + 1} نباید بزرگ‌تر از حداکثر باشد.`;
            if (!r.title.trim()) return `عنوان توصیه ${k + 1} خالی است.`;
        }

        return null;
    }

    // --- Save ---
    const handleSave = async () => {
        const msg = validateBeforeSave();
        if (msg) {
            setError(msg);
            return;
        }

        setSaving(true);
        setError(null);

        const payload: QuestionnairePayload = {
            title: title.trim(),
            slug: slug.trim(),
            status,
            cover_image_url: coverImageUrl.trim() ? coverImageUrl.trim() : null,
            content_html: contentHtml ?? "",

            questions: questions.map((q, qi) => ({
                text: q.text,
                sort_order: qi,
                choices: q.choices.map((c, ci) => ({
                    text: c.text,
                    score: Number(c.score),
                    sort_order: ci,
                })),
            })),

            recommendations: recommendations.map((r, ri) => ({
                min_score: Number(r.min_score),
                max_score: Number(r.max_score),
                title: r.title,
                body_html: r.body_html ?? "",
                priority: r.priority ?? ri,
            })),
        };

        try {
            const token = getToken();
            if (!token) {
                nav("/login");
                return;
            }

            const url = isEdit
                ? `${API_BASE}/api/admin/questionnaires/${encodeURIComponent(id!)}`
                : `${API_BASE}/api/admin/questionnaires`;

            const res = await fetch(url, {
                method: isEdit ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });


            if (!res.ok) {
                // اگر Laravel ولیدیشن بده معمولاً JSON خطاها برمی‌گردونه
                const json = await res.json().catch(() => null);
                const firstErr =
                    json?.message ||
                    (json?.errors ? Object.values(json.errors)[0]?.[0] : null) ||
                    `خطا در ذخیره (${res.status})`;
                throw new Error(firstErr);
            }

            // بعد از ذخیره برگرد لیست
            nav("/panel/questionnaires");
        } catch (e: any) {
            setError(e?.message ?? "خطای ناشناخته در ذخیره");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="page-content">
            <div className="container-fluid">
                {error ? (
                    <div className="alert alert-danger">{error}</div>
                ) : null}

                {loading ? (
                    <div className="alert alert-info">در حال دریافت اطلاعات...</div>
                ) : null}

                <div className="row">
                    {/* Left column */}
                    <div className="col-12 col-lg-7">
                        {/* Base info */}
                        <div className="card mb-4">
                            <div className="card-header">
                                <h5 className="card-title mb-0">اطلاعات پایه</h5>
                            </div>
                            <div className="card-body">
                                <div className="mb-3">
                                    <label className="form-label">عنوان</label>
                                    <input
                                        className="form-control"
                                        value={title}
                                        onChange={(e) => {
                                            setTitle(e.target.value);
                                            // auto slug if empty
                                            if (!slug.trim()) setSlug(slugifyFaLike(e.target.value));
                                        }}
                                        placeholder="مثلاً: PHQ-9"
                                    />
                                </div>

                                <div className="mb-3">
                                    <label className="form-label">اسلاگ</label>
                                    <input
                                        className="form-control"
                                        value={slug}
                                        onChange={(e) => setSlug(slugifyFaLike(e.target.value))}
                                        placeholder="مثلاً: phq9"
                                    />
                                </div>

                                <div className="mb-3">
                                    <label className="form-label">کاور (URL)</label>
                                    <input
                                        className="form-control"
                                        value={coverImageUrl}
                                        onChange={(e) => setCoverImageUrl(e.target.value)}
                                        placeholder="https://..."
                                    />
                                </div>

                                {coverImageUrl.trim() ? (
                                    <div className="mt-3">
                                        <div className="text-muted mb-2">پیش‌نمایش کاور:</div>
                                        <img
                                            src={coverImageUrl}
                                            alt=""
                                            className="img-fluid rounded"
                                            style={{ maxHeight: 220, objectFit: "cover", width: "100%" }}
                                        />
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="card mb-4">
                            <div className="card-header d-flex align-items-center justify-content-between">
                                <h5 className="card-title mb-0">محتوا</h5>
                                <span className="text-muted small">راهنما/توضیحات پرسشنامه</span>
                            </div>
                            <div className="card-body">
                                <RichTextEditor value={contentHtml} onChange={setContentHtml} placeholder="متن معرفی یا راهنمای پرسشنامه..." />
                            </div>
                        </div>

                        {/* Questions (Accordion Repeater) */}
                        <div className="card mb-4">
                            <div className="card-header d-flex align-items-center justify-content-between">
                                <h5 className="card-title mb-0">سؤال‌ها</h5>
                                <button type="button" className="btn btn-sm btn-outline-primary" onClick={addQuestion}>
                                    + افزودن سؤال
                                </button>
                            </div>

                            <div className="card-body">
                                {questions.length === 0 ? (
                                    <div className="alert alert-warning mb-0">
                                        هنوز سؤالی اضافه نشده. روی «افزودن سؤال» بزن.
                                    </div>
                                ) : (
                                    <div className="accordion" id="questionsAccordion">
                                        {questions.map((q, idx) => {
                                            const headingId = `q_head_${q.id}`;
                                            const collapseId = `q_col_${q.id}`;
                                            return (
                                                <div className="accordion-item" key={q.id}>
                                                    <h2 className="accordion-header" id={headingId}>
                                                        <button
                                                            className={`accordion-button ${idx === 0 ? "" : "collapsed"}`}
                                                            type="button"
                                                            data-bs-toggle="collapse"
                                                            data-bs-target={`#${collapseId}`}
                                                            aria-expanded={idx === 0 ? "true" : "false"}
                                                            aria-controls={collapseId}
                                                        >
                                                            <span className="fw-semibold">سؤال {idx + 1}</span>
                                                            <span className="text-muted ms-3 text-truncate" style={{ maxWidth: 320 }}>
                                                                {q.text ? q.text : "بدون متن"}
                                                            </span>
                                                        </button>
                                                    </h2>

                                                    <div
                                                        id={collapseId}
                                                        className={`accordion-collapse collapse ${idx === 0 ? "show" : ""}`}
                                                        aria-labelledby={headingId}
                                                        data-bs-parent="#questionsAccordion"
                                                    >
                                                        <div className="accordion-body">
                                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                                <div className="fw-semibold">متن سؤال</div>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-outline-danger"
                                                                    onClick={() => removeQuestion(q.id)}
                                                                >
                                                                    حذف سؤال
                                                                </button>
                                                            </div>

                                                            <input
                                                                className="form-control mb-3"
                                                                value={q.text}
                                                                onChange={(e) => updateQuestionText(q.id, e.target.value)}
                                                                placeholder="متن سؤال را وارد کنید..."
                                                            />

                                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                                <div className="fw-semibold">گزینه‌ها</div>
                                                                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => addChoice(q.id)}>
                                                                    + افزودن گزینه
                                                                </button>
                                                            </div>

                                                            <div className="d-flex flex-column gap-2">
                                                                {q.choices.map((c, cIdx) => (
                                                                    <div key={c.id} className="border rounded p-2">
                                                                        <div className="row g-2 align-items-center">
                                                                            <div className="col-12 col-md-7">
                                                                                <label className="form-label mb-1">متن گزینه {cIdx + 1}</label>
                                                                                <input
                                                                                    className="form-control"
                                                                                    value={c.text}
                                                                                    onChange={(e) => updateChoice(q.id, c.id, { text: e.target.value })}
                                                                                    placeholder="مثلاً: هرگز / گاهی / ..."
                                                                                />
                                                                            </div>

                                                                            <div className="col-8 col-md-3">
                                                                                <label className="form-label mb-1">امتیاز</label>
                                                                                <input
                                                                                    type="number"
                                                                                    className="form-control"
                                                                                    value={c.score}
                                                                                    onChange={(e) => updateChoice(q.id, c.id, { score: Number(e.target.value) })}
                                                                                />
                                                                            </div>

                                                                            <div className="col-4 col-md-2 d-flex align-items-end">
                                                                                <button
                                                                                    type="button"
                                                                                    className="btn btn-outline-danger w-100"
                                                                                    onClick={() => removeChoice(q.id, c.id)}
                                                                                    disabled={q.choices.length <= 1}
                                                                                    title={q.choices.length <= 1 ? "حداقل یک گزینه لازم است" : "حذف گزینه"}
                                                                                >
                                                                                    حذف
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            <div className="text-muted small mt-2">
                                                                نکته: امتیاز نهایی کاربر = جمع امتیاز گزینه‌های انتخاب‌شده.
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recommendations */}
                        <div className="card mb-4">
                            <div className="card-header d-flex align-items-center justify-content-between">
                                <h5 className="card-title mb-0">توصیه‌ها</h5>
                                <button type="button" className="btn btn-sm btn-outline-primary" onClick={addRecommendation}>
                                    + افزودن توصیه
                                </button>
                            </div>

                            <div className="card-body">
                                {recommendations.length === 0 ? (
                                    <div className="alert alert-warning mb-0">
                                        هنوز توصیه‌ای تعریف نشده. (اختیاری) می‌تونی توصیه‌ها را بر اساس بازه امتیاز اضافه کنی.
                                    </div>
                                ) : (
                                    <div className="d-flex flex-column gap-3">
                                        {recommendations.map((r, idx) => (
                                            <div key={r.id} className="border rounded p-3">
                                                <div className="d-flex align-items-center justify-content-between mb-2">
                                                    <div className="fw-semibold">توصیه {idx + 1}</div>
                                                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeRecommendation(r.id)}>
                                                        حذف
                                                    </button>
                                                </div>

                                                <div className="row g-2 mb-2">
                                                    <div className="col-6 col-md-2">
                                                        <label className="form-label">از</label>
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            value={r.min_score}
                                                            onChange={(e) => updateRecommendation(r.id, { min_score: Number(e.target.value) })}
                                                        />
                                                    </div>

                                                    <div className="col-6 col-md-2">
                                                        <label className="form-label">تا</label>
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            value={r.max_score}
                                                            onChange={(e) => updateRecommendation(r.id, { max_score: Number(e.target.value) })}
                                                        />
                                                    </div>

                                                    <div className="col-12 col-md-8">
                                                        <label className="form-label">عنوان</label>
                                                        <input
                                                            className="form-control"
                                                            value={r.title}
                                                            onChange={(e) => updateRecommendation(r.id, { title: e.target.value })}
                                                            placeholder="مثلاً: وضعیت کم‌خطر / نیاز به پیگیری / ..."
                                                        />
                                                    </div>
                                                </div>

                                                <label className="form-label">متن توصیه</label>
                                                <RichTextEditor
                                                    value={r.body_html}
                                                    onChange={(v: string) => updateRecommendation(r.id, { body_html: v })}
                                                    placeholder="متن توصیه را وارد کنید..."
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right column (simple actions box) */}
                    <div className="col-12 col-lg-5">
                        <div className="card mb-4">
                            <div className="card-header">
                                <h5 className="mb-0">عملیات</h5>
                            </div>

                            <div className="card-body d-flex flex-column gap-3">
                                <div>
                                    <label className="form-label">وضعیت</label>
                                    <select
                                        className="form-select"
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value as Status)}
                                        disabled={saving}
                                    >
                                        <option value="draft">پیش‌نویس</option>
                                        <option value="published">منتشر</option>
                                    </select>
                                </div>

                                <div className="d-flex gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-primary flex-fill"
                                        onClick={handleSave}
                                        disabled={saving}
                                    >
                                        {saving ? "در حال ذخیره..." : "ذخیره"}
                                    </button>

                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary flex-fill"
                                        onClick={() => {
                                            // اگر اسلاگ داری، بهتره با اسلاگ باز کنی
                                            // این مسیر رو مطابق مسیر صفحه نمایش خودتون تنظیم کن
                                            const url = slug ? `/questionnaires/${encodeURIComponent(slug)}` : "#";
                                            if (url !== "#") window.open(url, "_blank");
                                        }}
                                        disabled={!slug} // بدون اسلاگ نمایش معنی نداره
                                        title={!slug ? "برای نمایش، ابتدا اسلاگ را وارد کنید" : "نمایش"}
                                    >
                                        نمایش
                                    </button>
                                </div>
                            </div>
                        </div>


                        <div className="card">
                            <div className="card-header">
                                <h5 className="mb-0">خلاصه</h5>
                            </div>
                            <div className="card-body">
                                <div className="d-flex justify-content-between">
                                    <span className="text-muted">تعداد سؤال</span>
                                    <span className="fw-semibold">{questions.length}</span>
                                </div>
                                <div className="d-flex justify-content-between mt-2">
                                    <span className="text-muted">تعداد توصیه</span>
                                    <span className="fw-semibold">{recommendations.length}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
