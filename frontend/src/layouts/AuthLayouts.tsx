import { Link, Outlet } from "react-router-dom";
import { useEffect } from "react";

const loadScriptOnce = (src: string) => {
    if (document.querySelector(`script[src="${src}"]`)) return;
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    document.body.appendChild(s);
};

const AuthLayout: React.FC = () => {
    useEffect(() => {
        loadScriptOnce("/assets/js/pages/password-addon.init.js");
    }, []);
    return (
        <>
            { /* auth-page wrapper */}
            <div className="auth-page-wrapper auth-bg-cover py-5 d-flex justify-content-center align-items-center min-vh-100">
                <div className="bg-overlay" />
                { /* auth-page content */}
                <div className="auth-page-content overflow-hidden pt-lg-5">
                    <div className="container">
                        <div className="row">
                            <div className="col-lg-12">
                                <div className="card overflow-hidden">
                                    <div className="row g-0">
                                        <div className="col-lg-6">
                                            <div className="p-lg-5 p-4 auth-one-bg h-100">
                                                <div className="bg-overlay" />
                                                <div className="position-relative h-100 d-flex flex-column">
                                                    <div className="mb-4">
                                                        <Link to="/" className="d-block">
                                                            <img src="/assets/images/logo-light.png" alt="" height="18" />
                                                        </Link>
                                                    </div>
                                                    <div className="mt-auto">
                                                        <div className="mb-3">
                                                            <i className="ri-double-quotes-l display-4 text-success" />
                                                        </div>

                                                        <div id="qoutescarouselIndicators" className="carousel slide" data-bs-ride="carousel">
                                                            <div className="carousel-indicators">
                                                                <button type="button" data-bs-target="#qoutescarouselIndicators" data-bs-slide-to="0" className="active" aria-current="true" aria-label="Slide 1" />
                                                                <button type="button" data-bs-target="#qoutescarouselIndicators" data-bs-slide-to="1" aria-label="Slide 2" />
                                                                <button type="button" data-bs-target="#qoutescarouselIndicators" data-bs-slide-to="2" aria-label="Slide 3" />
                                                            </div>
                                                            <div className="carousel-inner text-center text-white-50 pb-5">
                                                                <div className="carousel-item active">
                                                                    <p className="fs-15 fst-italic">"عالی! کد تمیز، طراحی تمیز، سفارشی سازی آسان. بسیار متشکرم!"</p>
                                                                </div>
                                                                <div className="carousel-item">
                                                                    <p className="fs-15 fst-italic">"موضوع با پشتیبانی شگفت انگیز مشتری واقعا عالی است."</p>
                                                                </div>
                                                                <div className="carousel-item">
                                                                    <p className="fs-15 fst-italic">"عالی! کد تمیز، طراحی تمیز، سفارشی سازی آسان. بسیار متشکرم!"</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        { /* end carousel */}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        { /* end col */}
                                        <Outlet />
                                    </div>
                                    { /* end row */}
                                </div>
                                { /* end card */}
                            </div>
                            { /* end col */}

                        </div>
                        { /* end row */}
                    </div>
                    { /* end container */}
                </div>
                { /* end auth page content */}

                { /* footer */}
                <footer className="footer">
                    <div className="container">
                        <div className="row">
                            <div className="col-lg-12">
                                <div className="text-center">
                                    <p className="mb-0 text-center">© {new Date().getFullYear()} ولزون ساخته شده با <i className="mdi mdi-heart text-danger" /> توسط سالار عباسی
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </footer>
                { /* end Footer */}
            </div>
        </>
    )
}

export default AuthLayout
