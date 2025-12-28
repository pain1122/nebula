import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const LoginPage: React.FC = () => {
  const nav = useNavigate();
  const [email, setEmail] = useState("");      // یا username
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json?.message || "خطا در ورود");
        return;
      }

      // مهم: بسته به خروجی AuthController شما ممکنه مسیرش فرق کنه
      // رایج‌ترین حالت‌ها:
      const token = json?.data?.token || json?.token || json?.access_token;

      if (!token) {
        alert("توکن از سرور دریافت نشد. خروجی login را چک کن.");
        console.log("login response:", json);
        return;
      }

      localStorage.setItem("auth_token", token);
      nav("/");
    } catch (err) {
      console.error(err);
      alert("خطای شبکه/سرور");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="col-lg-6">
      <div className="p-lg-5 p-4">
        <div>
          <h5 className="text-primary">برگشت خوش آمدید!</h5>
          <p className="text-muted">برای ادامه وارد شوید.</p>
        </div>

        <div className="mt-4">
          <form onSubmit={onSubmit}>
            <div className="mb-3">
              <label className="form-label">ایمیل</label>
              <input className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="mb-3">
              <div className="float-end">
                <Link to="/forgot-password" className="text-muted">رمز عبور را فراموش کرده اید؟</Link>
              </div>
              <label className="form-label">رمز عبور</label>
              <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <div className="mt-4">
              <button className="btn btn-info w-100" type="submit" disabled={loading}>
                {loading ? "..." : "وارد شوید"}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
