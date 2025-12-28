import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

type UserRole = "admin" | "doctor" | "user";

type UserFormState = {
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: string; // YYYY-MM-DD
  NID: string;
  city: string;
  country: string;
  zipCode: string;
  bio: string;
};

const emptyForm: UserFormState = {
  role: "user",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  birthDate: "",
  NID: "",
  city: "",
  country: "",
  zipCode: "",
  bio: "",
};

function getToken() {
  return localStorage.getItem("auth_token") || "";
}

const UserUpsertPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const isCreate = id === "new" || !id;

  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [loading, setLoading] = useState<boolean>(!isCreate);
  const [err, setErr] = useState<string>("");

  const [avatarPreview, setAvatarPreview] = useState<string>(
    "../../assets/images/users/avatar-1.jpg"
  );
  const [coverPreview, setCoverPreview] = useState<string>(
    "../../assets/images/profile-bg.jpg"
  );

  // ✅ لود واقعی کاربر در حالت edit
  useEffect(() => {
    if (isCreate) {
      setForm(emptyForm);
      setLoading(false);
      setErr("");
      return;
    }

    async function loadUser() {
      setLoading(true);
      setErr("");

      const token = getToken();
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          setErr(json?.message || "خطا در دریافت اطلاعات کاربر");
          setLoading(false);
          return;
        }

        const u = json?.data?.user ?? json?.user; // بسته به خروجی ApiController شما
        if (!u) {
          setErr("داده‌ی کاربر از API دریافت نشد");
          setLoading(false);
          return;
        }

        setForm({
          role: (u.role || "user") as UserRole,
          firstName: u.first_name ?? "",
          lastName: u.last_name ?? "",
          phone: u.phone ?? "",
          email: u.email ?? "",
          birthDate: u.birth_date ?? "", // باید YYYY-MM-DD باشه
          NID: u.NID ?? "",
          city: u.city ?? "",
          country: u.country ?? "",
          zipCode: u.zip_code ?? "",
          bio: u.bio ?? "",
        });
      } catch (e) {
        setErr("خطای شبکه/سرور");
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [id, isCreate, navigate]);

  const fullName = useMemo(() => {
    const f = form.firstName?.trim();
    const l = form.lastName?.trim();
    return [f, l].filter(Boolean).join(" ") || (isCreate ? "کاربر جدید" : "—");
  }, [form.firstName, form.lastName, isCreate]);

  const onChange =
    (key: keyof UserFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((p) => ({ ...p, [key]: e.target.value }));
    };

  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  };

  const onPickCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCoverPreview(url);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const token = getToken();
    if (!token) {
      alert("توکن نداریم. دوباره لاگین کن.");
      navigate("/login");
      return;
    }

    const payload = {
      role: form.role,
      first_name: form.firstName,
      last_name: form.lastName,
      phone: form.phone,
      email: form.email,
      birth_date: form.birthDate,
      NID: form.NID,
      city: form.city || null,
      country: form.country || null,
      zip_code: form.zipCode || null,
      bio: form.bio || null,
    };

    const url = isCreate
      ? `${API_BASE}/api/admin/users`
      : `${API_BASE}/api/admin/users/${id}`;

    const method = isCreate ? "POST" : "PUT";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          json?.message ||
          (json?.errors ? JSON.stringify(json.errors, null, 2) : null) ||
          `خطا: ${res.status}`;
        console.log("create/update user error:", json);
        alert(msg);
        return;
      }

      alert(isCreate ? "کاربر ایجاد شد ✅" : "کاربر به‌روزرسانی شد ✅");

      // ✅ بعد از موفقیت: برگرد به لیست (یا اگر خواستی روی همین user بمان)
      navigate("/users");
    } catch (err) {
      console.error(err);
      alert("خطای شبکه/سرور");
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <i className="mdi mdi-loading mdi-spin fs-20 align-middle me-2" />
        در حال بارگذاری...
      </div>
    );
  }

  return (
    <>
      {err ? <div className="alert alert-danger">{err}</div> : null}

      {/* هدر تصویر و کاور */}
      <div className="position-relative mx-n4 mt-n4">
        <div className="profile-wid-bg profile-setting-img">
          <img src={coverPreview} className="profile-wid-img" alt="کاور پروفایل" />
          <div className="overlay-content">
            <div className="text-end p-3">
              <div className="p-0 ms-auto rounded-circle profile-photo-edit">
                <input
                  id="profile-foreground-img-file-input"
                  type="file"
                  className="profile-foreground-img-file-input"
                  accept="image/*"
                  onChange={onPickCover}
                />
                <label
                  htmlFor="profile-foreground-img-file-input"
                  className="profile-photo-edit btn btn-light"
                >
                  <i className="ri-image-edit-line align-bottom me-1"></i>
                  تغییر جلد
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        {/* ستون چپ */}
        <div className="col-xxl-3">
          <div className="card mt-n5">
            <div className="card-body p-4">
              <div className="text-center">
                <div className="profile-user position-relative d-inline-block mx-auto mb-4">
                  <img
                    src={avatarPreview}
                    className="rounded-circle avatar-xl img-thumbnail user-profile-image"
                    alt="آواتار کاربر"
                  />
                  <div className="avatar-xs p-0 rounded-circle profile-photo-edit">
                    <input
                      id="profile-img-file-input"
                      type="file"
                      className="profile-img-file-input"
                      accept="image/*"
                      onChange={onPickAvatar}
                    />
                    <label htmlFor="profile-img-file-input" className="profile-photo-edit avatar-xs">
                      <span className="avatar-title rounded-circle bg-light text-body">
                        <i className="ri-camera-fill"></i>
                      </span>
                    </label>
                  </div>
                </div>

                <h5 className="fs-16 mb-1">{fullName}</h5>

                <div className="mt-3 d-flex gap-2 justify-content-center">
                  <button type="button" className="btn btn-soft-secondary" onClick={() => navigate(-1)}>
                    بازگشت
                  </button>
                  {!isCreate && (
                    <button type="button" className="btn btn-soft-danger">
                      غیرفعال‌سازی
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ستون راست */}
        <div className="col-xxl-9">
          <div className="card mt-xxl-n5">
            <div className="card-header">
              <ul className="nav nav-tabs-custom rounded card-header-tabs border-bottom-0" role="tablist">
                <li className="nav-item" role="presentation">
                  <a className="nav-link active" data-bs-toggle="tab" href="#personalDetails" role="tab">
                    <i className="fas fa-home"></i> جزئیات شخصی
                  </a>
                </li>
              </ul>
            </div>

            <div className="card-body p-4">
              <div className="tab-content">
                <div className="tab-pane active show" id="personalDetails" role="tabpanel">
                  <form onSubmit={onSubmit}>
                    <div className="row">
                      <div className="col-lg-6">
                        <div className="mb-3">
                          <label className="form-label">نام</label>
                          <input
                            required
                            type="text"
                            className="form-control"
                            placeholder="نام کوچک"
                            value={form.firstName}
                            onChange={onChange("firstName")}
                          />
                        </div>
                      </div>

                      <div className="col-lg-6">
                        <div className="mb-3">
                          <label className="form-label">نام خانوادگی</label>
                          <input
                            required
                            type="text"
                            className="form-control"
                            placeholder="نام خانوادگی"
                            value={form.lastName}
                            onChange={onChange("lastName")}
                          />
                        </div>
                      </div>

                      <div className="col-lg-6">
                        <div className="mb-3">
                          <label className="form-label">نقش</label>
                          <select
                            className="form-select"
                            value={form.role}
                            onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as UserRole }))}
                          >
                            <option value="admin">مدیرکل</option>
                            <option value="doctor">پزشک</option>
                            <option value="user">کاربر</option>
                          </select>
                        </div>
                      </div>

                      <div className="col-lg-6">
                        <div className="mb-3">
                          <label className="form-label">شماره تلفن</label>
                          <input
                            required
                            type="text"
                            className="form-control"
                            placeholder="شماره تلفن"
                            value={form.phone}
                            onChange={onChange("phone")}
                          />
                        </div>
                      </div>

                      <div className="col-lg-6">
                        <div className="mb-3">
                          <label className="form-label">آدرس ایمیل</label>
                          <input
                            type="email"
                            className="form-control"
                            placeholder="ایمیل"
                            value={form.email}
                            onChange={onChange("email")}
                          />
                        </div>
                      </div>

                      <div className="col-lg-6">
                        <div className="mb-3">
                          <label className="form-label">کد ملی</label>
                          <input
                            required
                            inputMode="numeric"
                            pattern="^[0-9]{10}$"
                            maxLength={10}
                            type="text"
                            className="form-control"
                            placeholder="کد ملی"
                            value={form.NID}
                            onChange={onChange("NID")}
                          />
                        </div>
                      </div>

                      <div className="col-lg-12">
                        <div className="mb-3">
                          <label className="form-label">تاریخ تولد</label>
                          <input
                            required
                            type="date"
                            className="form-control"
                            value={form.birthDate}
                            onChange={onChange("birthDate")}
                          />
                        </div>
                      </div>

                      <div className="col-lg-4">
                        <div className="mb-3">
                          <label className="form-label">شهر</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="شهر"
                            value={form.city}
                            onChange={onChange("city")}
                          />
                        </div>
                      </div>

                      <div className="col-lg-4">
                        <div className="mb-3">
                          <label className="form-label">کشور</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="کشور"
                            value={form.country}
                            onChange={onChange("country")}
                          />
                        </div>
                      </div>

                      <div className="col-lg-4">
                        <div className="mb-3">
                          <label className="form-label">کد پستی</label>
                          <input
                            type="text"
                            className="form-control"
                            minLength={5}
                            maxLength={6}
                            placeholder="کد پستی"
                            value={form.zipCode}
                            onChange={onChange("zipCode")}
                          />
                        </div>
                      </div>

                      <div className="col-lg-12">
                        <div className="mb-3 pb-2">
                          <label className="form-label">توضیحات</label>
                          <textarea
                            className="form-control"
                            rows={3}
                            placeholder="توضیحات"
                            value={form.bio}
                            onChange={onChange("bio")}
                          />
                        </div>
                      </div>

                      <div className="col-lg-12">
                        <div className="hstack gap-2 justify-content-end">
                          <button type="submit" className="btn btn-primary">
                            {isCreate ? "ایجاد کاربر" : "به‌روزرسانی"}
                          </button>
                          <button type="button" className="btn btn-soft-info" onClick={() => navigate(-1)}>
                            لغو
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>

                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default UserUpsertPage;
