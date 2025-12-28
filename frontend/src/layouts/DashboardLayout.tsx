// src/layouts/DashboardLayout.tsx
import { useEffect } from "react";
import { Outlet } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import { applySavedHtmlAttributes, initPlugins, initVelzonBasics } from "../assets/js/layout";
import { initVelzonApp } from "../assets/js/app";



const DashboardLayout: React.FC = () => {
   useEffect(() => {
    applySavedHtmlAttributes();
    initVelzonBasics();
    initPlugins(document); // یا اگر می‌خوای محدودترش کنی، روی یک ref
    initVelzonApp(document);
  }, []);
  return (
    <>
      {/* دیگه این‌جا html/head/body نداریم، اون‌ها تو index.html هستن */}

      {/* Begin page */}
      <div id="layout-wrapper">
        <Header />

        <Sidebar />

        {/* Left Sidebar End */}
        <div className="vertical-overlay" />

        {/* ============================================================== */}
        {/* Start right Content here */}
        {/* ============================================================== */}
        <div className="main-content">
          <div className="page-content">
            <div className="container-fluid">
              { /* start page title */}
              <div className="row">
                <div className="col-12">
                  <div className="page-title-box d-sm-flex align-items-center justify-content-between">
                    <h4 className="mb-sm-0">عمودی شناور شد</h4>

                    <div className="page-title-right">
                      <ol className="breadcrumb m-0">
                        <li className="breadcrumb-item"><a href="javascript:%20void(0);">طرح بندی ها</a></li>
                        <li className="breadcrumb-item active">عمودی شناور شد</li>
                      </ol>
                    </div>

                  </div>
                </div>
              </div>
              { /* end page title */}
              <Outlet />
            </div>
          </div>

          <footer className="footer">
            <div className="container-fluid">
              <div className="row">
                <div className="col-sm-6">
                  {/* چون React هست، دیگه document.write نمی‌کنیم */}
                  {new Date().getFullYear()}© Velzon.
                </div>
                <div className="col-sm-6">
                  <div className="text-sm-end d-none d-sm-block">
                    طراحی و توسعه توسط سالار عباسی
                  </div>
                </div>
              </div>
            </div>
          </footer>
        </div>

        {/* end main content*/}
      </div>

      {/* back-to-top */}
      <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="btn btn-danger btn-icon"
        id="back-to-top">
        <i className="ri-arrow-up-line" />
      </button>

      {/* preloader – می‌تونی با state کنترلش کنی، فعلاً استاتیک */}
      <div id="preloader">
        <div id="status">
          <div className="spinner-border text-primary avatar-sm" role="status">
            <span className="visually-hidden">در حال بارگذاری...</span>
          </div>
        </div>
      </div>
    </>
  )
}

export default DashboardLayout
