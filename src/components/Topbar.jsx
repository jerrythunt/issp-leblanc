import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import smallLogo from "../assets/small_logo.png";

export default function Topbar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <nav className="topbar">
      <div className="topbar-left">
        <img src={smallLogo} alt="Logo" className="topbar-logo" />
        <a
          href="https://leblancleadership.ca/"
          target="_blank"
          rel="noopener noreferrer"
          className="topbar-title"
        >
          LeBlanc Leadership Group
        </a>
      </div>

      <div className="topbar-right">
        <Link to="/dashboard" className="topbar-link">Dashboard</Link>
        <Link to="/assessments" className="topbar-link">Create Assessment</Link>
        <Link to="/pastAssessments" className="topbar-link">Past Assessments</Link>
        <Link to="/questions" className="topbar-link">Questions</Link>
        <Link to="/surveys" className="topbar-link">Surveys</Link>
        <button onClick={handleLogout} className="topbar-logout-btn">
          Logout
        </button>
      </div>
    </nav>
  );
}