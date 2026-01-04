// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";

import DashboardLayout from "./layouts/DashboardLayout";
import AuthLayout from "./layouts/AuthLayouts";

import LoginPage from "./pages/panel/auth/LoginPage";
import ForgotPasswordPage from "./pages/panel/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/panel/auth/ResetPasswordPage";
import LockScreenPage from "./pages/panel/auth/LockScreenPage";
import LogoutPage from "./pages/panel/auth/LogoutPage";
import TwoStepVerificationPage from "./pages/panel/auth/TwoStepVerificationPage";

import AdminDashboardPage from "./pages/panel/AdminDashboardPage";
import PatientReservationsPage from "./pages/panel/PatientReservationsPage";
import UserUpsertPage from "./pages/panel/users/UserUpsertPage";
import UserListPage from "./pages/panel/users/UserListPage";

import QuestionnairesListPage from './pages/panel/questionary/QuestionnairesListPage'
import QuestionnaireCreatePage from './pages/panel/questionary/QuestionnaireCreatePage'



import QuestionnairesGridPage from "./pages/public/QuestionnairesGridPage";
import QuestionnairePublicPage from "./pages/public/QuestionnairePublicPage";



import { initVelzonApp } from "./assets/js/app";

function App() {
  useEffect(() => {
    initVelzonApp(document);
  }, []);

  return (
    <Routes>
      {/* auth pages */}
      <Route element={<AuthLayout />}>
        <Route path="/panel/login" element={<LoginPage />} />
        <Route path="/panel/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/panel/reset-password" element={<ResetPasswordPage />} />
        <Route path="/panel/lock" element={<LockScreenPage />} />
        <Route path="/panel/logout" element={<LogoutPage />} />
        <Route path="/panel/two-step" element={<TwoStepVerificationPage />} />
      </Route>

      {/* dashboard pages */}
      <Route element={<DashboardLayout />}>
        <Route path="/panel/" element={<AdminDashboardPage />} />
        <Route path="/panel/patient/reservations" element={<PatientReservationsPage />} />

        {/* Users (Admin) */}
        <Route path="/panel/users" element={<UserListPage />} />
        <Route path="/panel/users/new" element={<UserUpsertPage />} />
        <Route path="/panel/users/:id" element={<UserUpsertPage />} />

        <Route path="/panel/questionnaires" element={<QuestionnairesListPage />} />
        <Route path="/panel/questionnaires/new" element={<QuestionnaireCreatePage />} />
        <Route path="/panel/questionnaires/:id" element={<QuestionnaireCreatePage />} />
      </Route>

      {/* fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />


      {/* public pages */}
      <Route path="/questionnaires" element={<QuestionnairesGridPage />} />
      <Route path="/questionnaires/:slug" element={<QuestionnairePublicPage />} />
    </Routes>
  );
}

export default App;
