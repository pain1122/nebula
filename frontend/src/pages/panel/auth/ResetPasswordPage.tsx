import { Link } from "react-router-dom";

const ResetPasswordPage: React.FC = () => {
  return (
    <div className="col-lg-6">
      <div className="p-lg-5 p-4">
        <h5 className="text-primary">رمز عبور جدید ایجاد کنید</h5>
        <p className="text-muted">رمز عبور جدید شما باید با رمز عبور استفاده شده قبلی متفاوت باشد.</p>

        <div className="p-2">
          <form onSubmit={(e) => { e.preventDefault()}}>
            <div className="mb-3">
              <label className="form-label" htmlFor="password-input">رمز عبور</label>
              <div className="position-relative auth-pass-inputgroup">
                <input type="password" className="form-control pe-5 password-input" onPaste={(e) => e.preventDefault()} placeholder="رمز عبور را تایید کنید" id="password-input" aria-describedby="passwordInput" pattern="(?=.*\\d)(?=.*[a-z])(?=.*[A-Z]).{8,}" required />
                <button className="btn btn-link position-absolute end-0 top-0 text-decoration-none text-muted password-addon" type="button" id="password-addon"><i className="ri-eye-fill align-middle" /></button>
              </div>
              <div id="passwordInput" className="form-text">باید حداقل 8 کاراکتر باشد.</div>
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="confirm-password-input">رمز عبور را تایید کنید</label>
              <div className="position-relative auth-pass-inputgroup mb-3">
                <input type="password" className="form-control pe-5 password-input" onPaste={(e) => e.preventDefault()} placeholder="رمز عبور را تایید کنید" pattern="(?=.*\\d)(?=.*[a-z])(?=.*[A-Z]).{8,}" id="confirm-password-input" required />
                <button className="btn btn-link position-absolute end-0 top-0 text-decoration-none text-muted password-addon" type="button" id="confirm-password-input"><i className="ri-eye-fill align-middle" /></button>
              </div>
            </div>

            <div id="password-contain" className="p-3 bg-light mb-2 rounded">
              <h5 className="fs-13">رمز عبور باید حاوی:</h5>
              <p id="pass-length" className="invalid fs-12 mb-2">حداقل <b>  8 کاراکتر </b></p>
              <p id="pass-lower" className="invalid fs-12 mb-2">در <b>  حروف کوچک  </b> حرف (a-z)</p>
              <p id="pass-upper" className="invalid fs-12 mb-2">حداقل <b>  حروف بزرگ  </b> حرف (A-Z)</p>
              <p id="pass-number" className="invalid fs-12 mb-0">حداقل <b>  شماره  </b> (0-9)</p>
            </div>

            <div className="form-check">
              <input className="form-check-input" type="checkbox" value='true' id="auth-remember-check" />
              <label className="form-check-label" htmlFor="auth-remember-check">مرا به خاطر بسپار</label>
            </div>

            <div className="mt-4">
              <button className="btn btn-success w-100" type="submit">بازنشانی رمز عبور</button>
            </div>

          </form>
        </div>

        <div className="mt-5 text-center">
          <p className="mb-0">صبر کن، رمز عبورم را به خاطر دارم...<Link to="auth-signin-cover.html" className="fw-semibold text-primary text-decoration-underline">اینجا را کلیک کنید</Link> </p>
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordPage
