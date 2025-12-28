import { Link } from "react-router-dom";

const LockScreenPage: React.FC = () => {
  return (
    <div className="col-lg-6">
      <div className="p-lg-5 p-4">
        <div>
          <h5 className="text-primary">صفحه قفل</h5>
          <p className="text-muted">رمز عبور خود را وارد کنید تا قفل صفحه باز شود!</p>
        </div>
        <div className="user-thumb text-center">
          <img src="../../assets/images/users/avatar-1.jpg" className="rounded-circle img-thumbnail avatar-lg" alt="\u062A\u0635\u0648\u06CC\u0631 \u06A9\u0648\u0686\u06A9" />
          <h5 className="fs-17 mt-3">آنا آدام</h5>
        </div>

        <div className="mt-4">
          <form onSubmit={(e) => { e.preventDefault()}}>
            <div className="mb-3">
              <label className="form-label" htmlFor="userpassword">رمز عبور</label>
              <input type="password" className="form-control" id="userpassword" placeholder="رمز عبور را وارد کنید" required />
            </div>
            <div className="mb-2 mt-4">
              <button className="btn btn-info w-100" type="submit">باز کردن قفل</button>
            </div>
          </form>{ /* end form */}
        </div>

        <div className="mt-5 text-center">
          <p className="mb-0">نه تو؟ بازگشت<Link to="auth-signin-cover.html" className="fw-semibold text-primary text-decoration-underline">وارد شوید</Link></p>
        </div>
      </div>
    </div>
  )
}

export default LockScreenPage
