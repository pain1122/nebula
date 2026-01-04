import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Item = {
  id: number;
  title: string;
  slug: string;
  cover_image_url: string | null;
  questions_count: number;
  updated_at: string;
};

type ApiResp = {
  data: Item[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export default function QuestionnairesGridPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<ApiResp["meta"] | null>(null);

  async function load(p = 1, query = "") {
    setLoading(true);
    setErr("");

    try {
      const url = new URL(`${API_BASE}/api/questionnaires`);
      url.searchParams.set("page", String(p));
      if (query.trim()) url.searchParams.set("q", query.trim());

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      const json: ApiResp = await res.json();

      if (!res.ok) {
        throw new Error((json as any)?.message || "خطا در دریافت لیست پرسشنامه‌ها");
      }

      setItems(json.data || []);
      setMeta(json.meta || null);
      setPage(p);
    } catch (e: any) {
      setErr(e?.message || "خطای شبکه/سرور");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1, "");
  }, []);

  const onApply = () => load(1, q);

  return (
    <div className="page-content">
      <div className="container" style={{ maxWidth: 1200 }}>
        <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-3">
          <div>
            <h3 className="mb-1">پرسشنامه‌های سلامت</h3>
            <div className="text-muted">
              ابزارهای خودارزیابی و امتیازدهی (فقط موارد منتشرشده)
            </div>
          </div>

          <div className="d-flex gap-2" style={{ minWidth: 320 }}>
            <input
              className="form-control"
              placeholder="جستجو: عنوان یا اسلاگ..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onApply();
              }}
            />
            <button className="btn btn-outline-primary" onClick={onApply} disabled={loading}>
              اعمال
            </button>
          </div>
        </div>

        {err ? <div className="alert alert-danger">{err}</div> : null}
        {loading ? <div className="alert alert-info">در حال دریافت...</div> : null}

        {!loading && items.length === 0 ? (
          <div className="alert alert-warning">فعلاً پرسشنامه‌ای برای نمایش وجود ندارد.</div>
        ) : null}

        <div className="row g-3">
          {items.map((it) => (
            <div key={it.id} className="col-12 col-sm-6 col-lg-4">
              <div className="card h-100">
                {it.cover_image_url ? (
                  <img
                    src={it.cover_image_url}
                    className="card-img-top"
                    alt={it.title}
                    style={{ height: 160, objectFit: "cover" }}
                  />
                ) : (
                  <div
                    className="d-flex align-items-center justify-content-center"
                    style={{ height: 160, background: "#f5f7fb" }}
                  >
                    <span className="text-muted">بدون تصویر</span>
                  </div>
                )}

                <div className="card-body d-flex flex-column">
                  <div className="d-flex align-items-start justify-content-between gap-2">
                    <h5 className="card-title mb-1">{it.title}</h5>
                    <span className="badge bg-light text-dark">{it.questions_count} سؤال</span>
                  </div>

                  <div className="text-muted small mb-3">{it.slug}</div>

                  <div className="mt-auto d-flex justify-content-between align-items-center">
                    <div className="text-muted small">
                      بروزرسانی: {new Date(it.updated_at).toLocaleDateString("fa-IR")}
                    </div>

                    <Link to={`/questionnaires/${encodeURIComponent(it.slug)}`} className="btn btn-sm btn-primary">
                      شروع
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination ساده */}
        {meta && meta.last_page > 1 ? (
          <div className="d-flex justify-content-center align-items-center gap-2 mt-4">
            <button
              className="btn btn-outline-secondary"
              disabled={loading || page <= 1}
              onClick={() => load(page - 1, q)}
            >
              قبلی
            </button>
            <div className="text-muted">
              صفحه {meta.current_page} از {meta.last_page}
            </div>
            <button
              className="btn btn-outline-secondary"
              disabled={loading || page >= meta.last_page}
              onClick={() => load(page + 1, q)}
            >
              بعدی
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
