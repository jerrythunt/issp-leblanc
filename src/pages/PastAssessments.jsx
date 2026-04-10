import { useEffect, useState } from "react";
import { db } from "../firebase/config";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import Topbar from "../components/Topbar";
import { useNavigate } from "react-router-dom";

export default function PastAssessments() {
  const [pastAssessments, setPastAssessments] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [expanded, setExpanded] = useState({}); // track which assessments are expanded
  const navigate = useNavigate();

useEffect(() => {
  const fetchData = async () => {
    try {
      // ✅ ORDERED QUERY (NEWEST FIRST)
      const aRef = collection(db, "assessments");
      const q = query(aRef, orderBy("createdAt", "desc"));

      const aSnap = await getDocs(q);

      const assessmentsData = aSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(a => a.participants?.every(p => p.completed));

      setPastAssessments(assessmentsData);

      const sSnap = await getDocs(collection(db, "surveys"));
      setSurveys(sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    } catch (err) {
      console.error("Error fetching past assessments:", err);
    }
  };

  fetchData();
}, []);

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div>
      <Topbar />
      <div className="container">
        <h1>Past Assessments</h1>

        {pastAssessments.length === 0 && <p>No past assessments yet.</p>}

        {pastAssessments.map(a => {
          const survey = surveys.find(s => s.id === a.surveyId);
          const client = a.participants.find(p => p.role === "Self");
          const isExpanded = expanded[a.id];
          

          return (
            <div
              key={a.id}
              style={{
                marginBottom: "12px",
                border: "1px solid #ccc",
                borderRadius: "6px",
                backgroundColor: "#f9f9f9",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px",
                  cursor: "pointer",
                  backgroundColor: "#e0e0e0",
                  borderRadius: "6px 6px 0 0",
                }}
                onClick={() => toggleExpand(a.id)}
              >
                <div>
                  <strong>{a.name}</strong> - <strong>Client:</strong>{" "}
                  {client?.name || "N/A"} - <strong>Survey:</strong>{" "}
                  {survey?.name || "N/A"} 
                </div>
                <div>{isExpanded ? "▲" : "▼"}
                  
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: "12px" }}>
                  <div>
        {isExpanded ? "▲" : "▼"}

        {/* ✅ BUTTON GOES HERE */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/report/${a.id}`);
          }}
          style={{
            marginLeft: "10px",
            padding: "6px 12px",
            backgroundColor: "#1976d2",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          View Report
        </button>
      </div>
                  {survey?.questions.map(q => (
                    <div
                      key={q.id}
                      style={{
                        marginTop: "8px",
                        padding: "8px",
                        background: "#fff",
                        borderRadius: "4px",
                      }}
                    >
                      <strong>Q:</strong> {q.text} ({q.type})
                      <ul style={{ marginTop: "4px" }}>
                        {a.participants.map(p => (
                          <li key={p.link}>
                            ({p.role}):{" "}
                            <em>{p.responses?.[q.id] ?? "No answer"}</em>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}