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

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/questions" element={<Questions />} />
        <Route path="/surveys" element={<Surveys />} />
        <Route path="/survey-outro" element={<SurveyOutro />} />
        <Route path="/assessments" element={<Assessments />} />
        <Route path="/pastAssessments" element={<PastAssessment />} />
        <Route path="/survey/:id" element={<TakeSurvey />} />
        <Route path="/review/:revieweeId" element={<TakeReview />} />
        {/* This is the link you send */}
        <Route path="/assessment/:id" element={<LandingPage />} />
        <Route path="/report/:id" element={<ReportPage />} />
      </Routes>
    </Router>
  );
}

export default App;