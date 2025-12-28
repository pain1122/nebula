import { Link } from "react-router-dom";

const LogoutPage: React.FC = () => {
  return (
    <div className="col-lg-6">
      <div className="p-lg-5 p-4 text-center">
        <lord-icon src="https://cdn.lordicon.com/hzomhqxz.json" trigger="loop" colors="primary:#405189,secondary:#08a88a" style={{ width: 180, height: 180 }} />

        <div className="mt-4 pt-2">
          <h5>شما از سیستم خارج شده اید</h5>
          <p className="text-muted">با تشکر از شما برای استفاده<span className="fw-semibold"> ولزون </span>قالب مدیریت</p>
          <div className="mt-4">
            <Link to="/login" className="btn btn-info w-100">وارد شوید</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LogoutPage
