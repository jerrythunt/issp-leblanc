import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import TakeReview from "./pages/TakeReview";
import Questions from "./pages/Questions";
import Surveys from "./pages/Surveys";
import Assessments from "./pages/Assessments";
import TakeSurvey from "./pages/TakeSurvey";
import PastAssessment from "./pages/PastAssessments";
import LandingPage from "./pages/LandingPage";
import SurveyOutro from "./pages/SurveyOutro";
import ReportPage from "./pages/ReportPage";

import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Router>
      <Routes>

        {/* =========================
            PUBLIC (NO LOGIN)
        ========================== */}
        <Route path="/" element={<Login />} />

        <Route path="/survey-outro" element={<SurveyOutro />} />
        <Route path="/survey/:id" element={<TakeSurvey />} />
        <Route path="/review/:revieweeId" element={<TakeReview />} />
        <Route path="/assessment/:id" element={<LandingPage />} />

        {/* =========================
            PROTECTED (LOGIN REQUIRED)
        ========================== */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/questions"
          element={
            <ProtectedRoute>
              <Questions />
            </ProtectedRoute>
          }
        />

        <Route
          path="/surveys"
          element={
            <ProtectedRoute>
              <Surveys />
            </ProtectedRoute>
          }
        />

        <Route
          path="/assessments"
          element={
            <ProtectedRoute>
              <Assessments />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pastAssessments"
          element={
            <ProtectedRoute>
              <PastAssessment />
            </ProtectedRoute>
          }
        />

        <Route
          path="/report/:id"
          element={
            <ProtectedRoute>
              <ReportPage />
            </ProtectedRoute>
          }
        />

      </Routes>
    </Router>
  );
}

export default App;