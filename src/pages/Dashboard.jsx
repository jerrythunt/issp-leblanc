import { useEffect, useState } from "react";
import { db, auth } from "../firebase/config";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";

export default function Dashboard() {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [surveys, setSurveys] = useState([]);

  // Fetch assessments
  useEffect(() => {
    const fetchAssessments = async () => {
      try {
        const snapshot = await getDocs(collection(db, "assessments"));
        setAssessments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error fetching assessments:", err);
      }
    };
    fetchAssessments();
  }, []);

  // Fetch surveys for grouping
  useEffect(() => {
    const fetchSurveys = async () => {
      const snapshot = await getDocs(collection(db, "surveys"));
      setSurveys(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchSurveys();
  }, []);

  // Mark assessment as complete

const handleOverrideComplete = async (assessmentId) => {
  if (!window.confirm("Are you sure you want to close this assessment? This will remove all participants who haven't completed the survey.")) return;

  const assessmentRef = doc(db, "assessments", assessmentId);

  // Find the assessment locally
  const assessment = assessments.find(a => a.id === assessmentId);
  if (!assessment) return;

  // Keep only participants who completed
  const completedParticipants = assessment.participants.filter(p => p.completed);

  // Update Firestore
  await updateDoc(assessmentRef, { participants: completedParticipants });

  // Update local state
  setAssessments(prev => prev.map(a => 
    a.id === assessmentId 
      ? { ...a, participants: completedParticipants } 
      : a
  ));
};


  // Group active assessments by survey
  const activeBySurvey = surveys
    .map(survey => {
      const activeAssessments = assessments
        .filter(a => a.surveyId === survey.id)
        // Only include if at least one participant has not completed
        .filter(a => a.participants?.some(p => !p.completed));

      return { ...survey, activeAssessments };
    })
    .filter(s => s.activeAssessments.length > 0);

  return (
    <div>
      <Topbar />
      <div className="container">
        <h1>Clarity Index™ Dashboard</h1>
        <h2><u>Active Assessments</u></h2>

        {activeBySurvey.length > 0 ? activeBySurvey.map(survey => (
          <div key={survey.id} style={{ marginBottom: "20px" }}>
            <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid #1bc95e", padding: "8px", borderRadius: "6px" }}>
              {survey.activeAssessments.map(a => {
                const total = a.participants.length;
                const completedCount = a.participants.filter(p => p.completed).length;
                const notCompleted = a.participants.filter(p => !p.completed);

                return (
                  <div key={a.id} style={{ marginBottom: "12px", borderBottom: "1px solid #f0f0f0", paddingBottom: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong>
                            {a.name}</strong> ({total} participants)
                        <p>
                            <strong>Client: </strong>{a.participants.find(p => p.role === "Self")?.name || a.name}</p>
                        <p>
                            <strong>Survey: </strong>{surveys.find(s => s.id === a.surveyId)?.name || "N/A"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleOverrideComplete(a.id)}
                        style={{ backgroundColor: "#d72a2a", color: "white", border: "none", borderRadius: "4px", padding: "4px 8px", cursor: "pointer" }}
                      >
                        Mark Complete
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginTop: "6px", background: "#eee", borderRadius: "4px", height: "12px", width: "100%" }}>
                      <div style={{
                        width: `${(completedCount / total) * 100}%`,
                        background: "#1976d2",
                        height: "100%",
                        borderRadius: "4px"
                      }} />
                    </div>
                    <small>{completedCount} of {total} completed</small>

                    {/* List of participants not completed */}
                    {notCompleted.length > 0 && (
                      <ul style={{ marginTop: "6px" }}>
                        {notCompleted.map((p, idx) => (
                          <li key={idx}>{p.name} ({p.role}) - 
<a
            href={`/assessment/${p.link}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {window.location.origin}/assessment/{p.link}
          </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )) : <p>No active assessments at the moment.</p>}
      </div>
    </div>
  );
}