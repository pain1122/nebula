import { Navigate } from "react-router-dom";
export default function ScheduleIndexRedirect() {
  return <Navigate to="/schedules" replace />;
}
