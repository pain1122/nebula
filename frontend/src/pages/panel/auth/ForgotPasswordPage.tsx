import { Link } from "react-router-dom";

const ForgotPasswordPage: React.FC = () => {
  return (
    <>
    <div className="col-lg-6">
      <div className="p-lg-5 p-4">
        <h5 className="text-primary">رمز عبور را فراموش کرده اید؟</h5>
        <p className="text-muted">بازنشانی رمز عبور با velzon</p>

        <div className="mt-2 text-center">
          <lord-icon src="https://cdn.lordicon.com/rhvddzym.json" trigger="loop" colors="primary:#0ab39c" className="avatar-xl">
          </lord-icon>
        </div>

        <div className="alert border-0 alert-warning text-center mb-2 mx-2" role="alert">ایمیل خود را وارد کنید و دستورالعمل ها برای شما ارسال خواهد شد!</div>
        <div className="p-2">
          <form onSubmit={(e) => { e.preventDefault()}}>
            <div className="mb-4">
              <label className="form-label">ایمیل</label>
              <input type="email" className="form-control" id="email" placeholder="آدرس ایمیل را وارد کنید" />
            </div>

            <div className="text-center mt-4">
              <button className="btn btn-info w-100" type="submit">ارسال لینک بازنشانی</button>
            </div>
          </form>{ /* end form */}
        </div>

        <div className="mt-5 text-center">
          <p className="mb-0">صبر کن، رمز عبورم را به خاطر دارم...<Link to="auth-signin-cover.html" className="fw-semibold text-primary text-decoration-underline">اینجا را کلیک کنید</Link> </p>
        </div>
      </div>
    </div>
      { /* end col */}</>
  )
}

export default ForgotPasswordPage
