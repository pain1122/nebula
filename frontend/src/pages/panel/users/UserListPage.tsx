import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

type UserRow = {
    id: number;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    city?: string;
    country?: string;
    created_at?: string;
};

type ViewMode = "grid" | "list";
type Range = "all" | "week" | "month" | "year";

function getToken() {
    return localStorage.getItem("auth_token") || "";
}

function fullName(u: UserRow) {
    const f = (u.first_name || "").trim();
    const l = (u.last_name || "").trim();
    const n = [f, l].filter(Boolean).join(" ");
    return n || u.email || `#${u.id}`;
}

const UserListPage: React.FC = () => {
    const nav = useNavigate();

    const [users, setUsers] = useState<UserRow[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [err, setErr] = useState<string>("");
    const [q, setQ] = useState<string>("");
    const [view, setView] = useState<ViewMode>("grid");
    const [range, setRange] = useState<Range>("all");

    async function fetchUsers(next?: Partial<{ q: string; range: Range }>) {
        setLoading(true);
        setErr("");

        const nextQ = next?.q ?? q;
        const nextRange = next?.range ?? range;

        try {
            const token = getToken();

            const params = new URLSearchParams();
            if (nextQ.trim()) params.set("q", nextQ.trim());
            if (nextRange !== "all") params.set("range", nextRange);

            const url = `${API_BASE}/api/admin/users${params.toString() ? `?${params}` : ""}`;

            const res = await fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });

            const json = await res.json();

            if (!res.ok) {
                setErr(json?.message || "خطا در دریافت لیست کاربران");
                setUsers([]);
                return;
            }

            const usersArr = json?.data?.users ?? json?.users ?? [];
            setUsers(Array.isArray(usersArr) ? usersArr : []);
        } catch {
            setErr("خطای شبکه/سرور");
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }


    useEffect(() => {
        fetchUsers();
    }, []);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return users;

        return users.filter((u) => {
            const hay = [
                fullName(u),
                u.email || "",
                u.phone || "",
                u.city || "",
                u.country || "",
            ]
                .join(" ")
                .toLowerCase();
            return hay.includes(s);
        });
    }, [q, users]);

    const showNoResult = !loading && !err && filtered.length === 0;

    return (
        <>
            {/* Toolbar */}
            <div className="card">
                <div className="card-body">
                    <div className="row g-2">
                        <div className="col-sm-4">
                            <div className="search-box">
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="جستجو بر اساس نام، ایمیل، تلفن..."
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                />
                                <i className="ri-search-line search-icon" />
                            </div>
                        </div>

                        <div className="col-sm-auto ms-auto">
                            <div className="list-grid-nav hstack gap-1">
                                <button
                                    type="button"
                                    className={`btn btn-soft-info nav-link btn-icon fs-14 ${view === "grid" ? "active" : ""
                                        }`}
                                    onClick={() => setView("grid")}
                                    title="نمایش شبکه‌ای"
                                >
                                    <i className="ri-grid-fill" />
                                </button>

                                <button
                                    type="button"
                                    className={`btn btn-soft-info nav-link btn-icon fs-14 ${view === "list" ? "active" : ""
                                        }`}
                                    onClick={() => setView("list")}
                                    title="نمایش لیستی"
                                >
                                    <i className="ri-list-unordered" />
                                </button>
                                <div className="dropdown">
                                    <button
                                        type="button"
                                        id="dropdownMenuLink1"
                                        data-bs-toggle="dropdown"
                                        aria-expanded="false"
                                        className="btn btn-soft-info btn-icon fs-14"
                                        title="فیلتر بازه"
                                    >
                                        <i className="ri-more-2-fill" />
                                    </button>

                                    <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="dropdownMenuLink1">
                                        <li>
                                            <button
                                                type="button"
                                                className={`dropdown-item ${range === "all" ? "active" : ""}`}
                                                onClick={() => { setRange("all"); fetchUsers({ range: "all" }); }}
                                            >
                                                همه
                                            </button>
                                        </li>
                                        <li>
                                            <button
                                                type="button"
                                                className={`dropdown-item ${range === "week" ? "active" : ""}`}
                                                onClick={() => { setRange("week"); fetchUsers({ range: "week" }); }}
                                            >
                                                هفته گذشته
                                            </button>
                                        </li>
                                        <li>
                                            <button
                                                type="button"
                                                className={`dropdown-item ${range === "month" ? "active" : ""}`}
                                                onClick={() => { setRange("month"); fetchUsers({ range: "month" }); }}
                                            >
                                                ماه گذشته
                                            </button>
                                        </li>
                                        <li>
                                            <button
                                                type="button"
                                                className={`dropdown-item ${range === "year" ? "active" : ""}`}
                                                onClick={() => { setRange("year"); fetchUsers({ range: "year" }); }}
                                            >
                                                سال گذشته
                                            </button>
                                        </li>
                                    </ul>
                                </div>


                                <button
                                    className="btn btn-success"
                                    onClick={() => nav("/panel/users/new")}
                                >
                                    <i className="ri-add-fill me-1 align-bottom" />
                                    اضافه کردن کاربر
                                </button>
                            </div>
                        </div>
                    </div>

                    {err ? (
                        <div className="alert alert-danger mt-3 mb-0">{err}</div>
                    ) : null}
                </div>
            </div>

            {/* List */}
            <div className="row">
                <div className="col-lg-12">
                    <div id="teamlist">
                        <div
                            className={`team-list ${view === "grid" ? "grid-view-filter row" : "list-view-filter row"
                                }`}
                            id="team-member-list"
                        >
                            {loading ? (
                                <div className="col-12">
                                    <div className="text-center py-4">
                                        <i className="mdi mdi-loading mdi-spin fs-20 align-middle me-2" />
                                        در حال بارگذاری...
                                    </div>
                                </div>
                            ) : null}

                            {!loading &&
                                filtered.map((u) => (
                                    <div
                                        key={u.id}
                                        className={view === "grid" ? "col-xxl-4 col-lg-6" : "col-12"}
                                    >
                                        <div className="card team-box">
                                            <div className="card-body p-4">
                                                <div className="d-flex align-items-center justify-content-between">
                                                    <div className="d-flex align-items-center gap-3">
                                                        <div className="avatar-lg img-thumbnail rounded-circle flex-shrink-0 d-flex align-items-center justify-content-center">
                                                            <div className="avatar-title border bg-light text-primary rounded-circle text-uppercase">
                                                                {fullName(u).slice(0, 2)}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <h5 className="fs-16 mb-1">{fullName(u)}</h5>
                                                            <p className="text-muted mb-0">{u.email || "—"}</p>
                                                            <div className="small text-muted mt-1">
                                                                {u.phone ? <span>{u.phone}</span> : null}
                                                                {u.city || u.country ? (
                                                                    <span className="ms-2">
                                                                        {u.city || ""} {u.country ? `- ${u.country}` : ""}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="text-end">
                                                        <Link to={`/panel/users/${u.id}`} className="btn btn-light btn-sm">
                                                            ویرایش
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>

                        {showNoResult ? (
                            <div className="py-4 mt-4 text-center" id="noresult">
                                <h5 className="mt-4">متاسفم! هیچ نتیجه‌ای یافت نشد</h5>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </>
    );
};

export default UserListPage;
