import { useEffect, useState } from "react";
import { db } from "../firebase/config";
import { collection, getDocs, addDoc } from "firebase/firestore";
import Topbar from "../components/Topbar";
import { v4 as uuidv4 } from "uuid";

export default function Assessments() {
  const [surveys, setSurveys] = useState([]);
  const [activeAssessments, setActiveAssessments] = useState([]);

  const [assessmentName, setAssessmentName] = useState("");
  const [selectedSurvey, setSelectedSurvey] = useState("");

  // Temporary participants before saving
  const [participantName, setParticipantName] = useState("");
  const [role, setRole] = useState("Leader");
  const [participantsList, setParticipantsList] = useState([]);

  useEffect(() => {
    const fetchSurveys = async () => {
      try {
        const snapshot = await getDocs(collection(db, "surveys"));
        setSurveys(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error fetching surveys:", err);
      }
    };
    fetchSurveys();
  }, []);

  useEffect(() => {
    const fetchActive = async () => {
      try {
        const snapshot = await getDocs(collection(db, "assessments"));
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          participants: doc.data().participants || [],
        }));
        setActiveAssessments(data);
      } catch (err) {
        console.error("Error fetching assessments:", err);
      }
    };
    fetchActive();
  }, []);

  const handleAddToList = () => {
    if (!participantName.trim()) {
      alert("Enter participant name");
      return;
    }
    setParticipantsList(prev => [
      ...prev,
      { name: participantName.trim(), role, link: uuidv4(), completed: false },
    ]);
    setParticipantName("");
    setRole("Leader");
  };

  const handleRemoveParticipant = index => {
    setParticipantsList(prev => prev.filter((_, i) => i !== index));
  };

const handleSaveAssessment = async () => {
  if (!assessmentName.trim() || !selectedSurvey || participantsList.length === 0) {
    alert("Please fill out assessment name, select survey, and add participants.");
    return;
  }

  try {
    // Save assessment to Firestore
    const docRef = await addDoc(collection(db, "assessments"), {
      name: assessmentName.trim(),
      surveyId: selectedSurvey,
      participants: participantsList,
      createdAt: new Date(),
    });

    // Reset form
    setAssessmentName("");
    setSelectedSurvey("");
    setParticipantsList([]);
    setParticipantName("");
    setRole("Leader");

    // Show links for participants
    const baseURL = window.location.origin; // https://yourapp.com
    const links = participantsList.map(
      (p) => `${baseURL}/assessment/${p.link}`
    );

    alert(
      "Assessment saved successfully!\n\nLanding page links for participants:\n" +
        links.join("\n")
    );
  } catch (err) {
    console.error("Error saving assessment:", err);
    alert("Failed to save assessment. Check console.");
  }
};
  return (
    <div>
      <Topbar />
      <div className="container">
        <h1>Create Assessment</h1>

        <div style={{ marginBottom: "20px", border: "1px solid #ccc", padding: "12px", borderRadius: "6px" }}>
          <input
            type="text"
            placeholder="Assessment/Company Name"
            value={assessmentName}
            onChange={e => setAssessmentName(e.target.value)}
            style={{ marginRight: "8px" }}
          />

          <select value={selectedSurvey} onChange={e => setSelectedSurvey(e.target.value)} style={{ marginRight: "8px" }}>
            <option value="">Select Survey</option>
            {surveys.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Participant Name"
            value={participantName}
            onChange={e => setParticipantName(e.target.value)}
            style={{ marginRight: "8px" }}
          />

          <select value={role} onChange={e => setRole(e.target.value)} style={{ marginRight: "8px" }}>
            <option value="Self">Self</option>
            <option value="Leader's Leader">Leader's Leader</option>
            <option value="Leader">Leader</option>
            <option value="Peer">Peer</option>
            <option value="Direct Report">Direct Report</option>
            <option value="Indirect Report">Indirect Report</option>
            <option value="Other">Other</option>
          </select>

          <button onClick={handleAddToList}>Add Participant</button>
        </div>

        {participantsList.length > 0 && (
          <div style={{ marginBottom: "20px", border: "1px solid #eee", padding: "12px", borderRadius: "6px" }}>
            <h3>Participants to be added:</h3>
            <ul>
              {participantsList.map((p, idx) => (
                <li key={idx}>
                  {p.name} - {p.role}{" "}
                  <button onClick={() => handleRemoveParticipant(idx)} style={{ marginLeft: "8px" }}>Remove</button>
                </li>
              ))}
            </ul>
            <button onClick={handleSaveAssessment}>Save Assessment</button>
          </div>
        )}        
      </div>
    </div>
  );
}