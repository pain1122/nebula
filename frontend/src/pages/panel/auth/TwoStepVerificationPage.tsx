import { Link } from "react-router-dom";

const moveToNext = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
  const input = e.currentTarget;
  const key = e.key;

  if (input.value && !/^\d$/.test(input.value)) {
    input.value = "";
    return;
  }

  if (key === "Backspace") {
    if (input.value === "" && idx > 1) {
      const prev = document.getElementById(`digit${idx - 1}-input`) as HTMLInputElement | null;
      prev?.focus();
      prev?.select?.();
    }
    return;
  }

  if (input.value.length === 1 && idx < 4) {
    const next = document.getElementById(`digit${idx + 1}-input`) as HTMLInputElement | null;
    next?.focus();
    next?.select?.();
  }
};

const TwoStepVerification: React.FC = () => {
  return (
    <div className="col-lg-6">
      <div className="p-lg-5 p-4">
        <div className="mb-4">
          <div className="avatar-lg mx-auto">
            <div className="avatar-title bg-light text-primary display-5 rounded-circle">
              <i className="ri-mail-line" />
            </div>
          </div>
        </div>

        <div className="text-muted text-center mx-lg-3">
          <h4 className="">ایمیل خود را تأیید کنید</h4>
          <p>
            لطفا کد 4 رقمی ارسال شده به <span className="fw-semibold">example@abc.com</span>
          </p>
        </div>

        <div className="mt-4">
          <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
            <div className="row">
              <div className="col-3">
                <div className="mb-3">
                  <label htmlFor="digit1-input" className="visually-hidden">رقم 1</label>
                  <input
                    type="text"
                    className="form-control form-control-lg bg-light border-light text-center"
                    onKeyUp={(e) => moveToNext(1, e)}
                    maxLength={1}
                    id="digit1-input"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="col-3">
                <div className="mb-3">
                  <label htmlFor="digit2-input" className="visually-hidden">رقم 2</label>
                  <input
                    type="text"
                    className="form-control form-control-lg bg-light border-light text-center"
                    onKeyUp={(e) => moveToNext(2, e)}
                    maxLength={1}
                    id="digit2-input"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="col-3">
                <div className="mb-3">
                  <label htmlFor="digit3-input" className="visually-hidden">رقم 3</label>
                  <input
                    type="text"
                    className="form-control form-control-lg bg-light border-light text-center"
                    onKeyUp={(e) => moveToNext(3, e)}
                    maxLength={1}
                    id="digit3-input"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="col-3">
                <div className="mb-3">
                  <label htmlFor="digit4-input" className="visually-hidden">رقم 4</label>
                  <input
                    type="text"
                    className="form-control form-control-lg bg-light border-light text-center"
                    onKeyUp={(e) => moveToNext(4, e)}
                    maxLength={1}
                    id="digit4-input"
                    inputMode="numeric"
                  />
                </div>
              </div>
            </div>

            <div className="mt-3">
              <button type="submit" className="btn btn-info w-100">تایید کنید</button>
            </div>
          </form>
        </div>

        <div className="mt-5 text-center">
          <p className="mb-0">
            کدی دریافت نکردید؟
            <Link to="/forgot-password" className="fw-semibold text-primary text-decoration-underline">
              ارسال مجدد
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default TwoStepVerification;
