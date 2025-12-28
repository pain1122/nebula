// frontend/src/pages/panel/questionary/QuestionnairesListPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function getToken() {
  return localStorage.getItem("auth_token") || "";
}

type Status = "draft" | "published";

type QuestionnaireRow = {
  id: number;
  title: string;
  slug: string;
  status: Status;
  questionsCount: number;
  updatedAt: string;
};

type LaravelPaginator<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export default function QuestionnairesListPage() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  // server data
  const [items, setItems] = useState<QuestionnaireRow[]>([]);
  const [page, setPage] = useState<number>(1);
  const [lastPage, setLastPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);

  // filters (UI state)
  const [qInput, setQInput] = useState<string>("");
  const [statusInput, setStatusInput] = useState<"all" | Status>("all");

  // filters (applied state)
  const [qApplied, setQApplied] = useState<string>("");
  const [statusApplied, setStatusApplied] = useState<"all" | Status>("all");

  async function load(pageNo: number) {
    setLoading(true);
    setErr("");

    const token = getToken();
    if (!token) {
      nav("/login");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/questionnaires?page=${pageNo}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.message || `خطا در دریافت لیست (${res.status})`;
        // اگر نقش نداشت:
        if (msg?.toLowerCase?.().includes("right roles")) {
          setErr("دسترسی ندارید: کاربر نقش admin ندارد.");
        } else {
          setErr(msg);
        }
        return;
      }

      // paginator استاندارد: { data: [...], current_page, last_page, total, ... }
      const paginator: LaravelPaginator<any> = json;

      const mapped: QuestionnaireRow[] = (paginator?.data ?? []).map((x: any) => ({
        id: Number(x.id),
        title: x.title ?? "",
        slug: x.slug ?? "",
        status: (x.status ?? "draft") as Status,
        questionsCount: Number(x.questions_count ?? x.questionsCount ?? 0),
        updatedAt: x.updated_at ?? x.updatedAt ?? "",
      }));

      setItems(mapped);
      setPage(Number(paginator?.current_page ?? pageNo));
      setLastPage(Number(paginator?.last_page ?? 1));
      setTotal(Number(paginator?.total ?? mapped.length));
    } catch (e) {
      setErr("خطای شبکه/سرور");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const filtered = useMemo(() => {
    let out = items;

    const q = qApplied.trim().toLowerCase();
    if (q) {
      out = out.filter((x) => {
        const t = (x.title ?? "").toLowerCase();
        const s = (x.slug ?? "").toLowerCase();
        return t.includes(q) || s.includes(q);
      });
    }

    if (statusApplied !== "all") {
      out = out.filter((x) => x.status === statusApplied);
    }

    return out;
  }, [items, qApplied, statusApplied]);

  const applyFilters = () => {
    setQApplied(qInput);
    setStatusApplied(statusInput);
    // اگر می‌خوای اعمال فیلتر همیشه از صفحه 1 شروع شه:
    setPage(1);
  };

  return (
    <div className="page-content">
      <div className="container-fluid">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h4 className="mb-1">پرسشنامه‌ها</h4>
            <div className="text-muted">مدیریت ابزارهای خودآزمایی و امتیازدهی</div>
          </div>

          <Link to="/panel/questionnaires/new" className="btn btn-primary">
            + ایجاد پرسشنامه
          </Link>
        </div>

        {err ? <div className="alert alert-danger">{err}</div> : null}
        {loading ? <div className="alert alert-info">در حال دریافت اطلاعات...</div> : null}

        {/* Filters */}
        <div className="card mb-3">
          <div className="card-body">
            <div className="row g-2">
              <div className="col-md-6">
                <input
                  className="form-control"
                  placeholder="جستجو: عنوان یا اسلاگ..."
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyFilters();
                  }}
                />
              </div>

              <div className="col-md-3">
                <select
                  className="form-select"
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value as any)}
                >
                  <option value="all">همه وضعیت‌ها</option>
                  <option value="published">منتشر شده</option>
                  <option value="draft">پیش‌نویس</option>
                </select>
              </div>

              <div className="col-md-3">
                <button className="btn btn-outline-secondary w-100" onClick={applyFilters} disabled={loading}>
                  اعمال
                </button>
              </div>
            </div>

            <div className="text-muted small mt-2">
              نمایش: {filtered.length} مورد از {items.length} (کل: {total})
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card">
          <div className="card-body">
            <div className="table-responsive table-card">
              <table className="table align-middle table-nowrap mb-0">
                <thead className="table-light">
                  <tr>
                    <th>عنوان</th>
                    <th>اسلاگ</th>
                    <th>وضعیت</th>
                    <th>تعداد سؤال</th>
                    <th>آخرین ویرایش</th>
                    <th className="text-end">عملیات</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((q) => (
                    <tr key={q.id}>
                      <td className="fw-medium">{q.title}</td>
                      <td className="text-muted">{q.slug}</td>
                      <td>
                        <span className={`badge ${q.status === "published" ? "bg-success" : "bg-warning"}`}>
                          {q.status === "published" ? "منتشر" : "پیش‌نویس"}
                        </span>
                      </td>
                      <td>{q.questionsCount}</td>
                      <td className="text-muted">{q.updatedAt}</td>
                      <td className="text-end">
                        <Link to={`/panel/questionnaires/${q.id}`} className="btn btn-sm btn-outline-primary">
                          ویرایش
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        هیچ پرسشنامه‌ای ثبت نشده است.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="d-flex align-items-center justify-content-between mt-3">
              <div className="text-muted small">
                صفحه {page} از {lastPage}
              </div>

              <div className="d-flex gap-2">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={loading || page <= 1}
                >
                  قبلی
                </button>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                  disabled={loading || page >= lastPage}
                >
                  بعدی
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
