import { useEffect, useState } from "react";
import { db, auth } from "../firebase/config";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";
import { onAuthStateChanged } from "firebase/auth";

export default function Surveys() {
  const [surveys, setSurveys] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [newSurveyName, setNewSurveyName] = useState("");
  const [editingSurvey, setEditingSurvey] = useState(null); // survey being edited
  const [filterType, setFilterType] = useState("all"); // question type filter
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const adminEmail = "admin@admin.com"; // restrict access

  // Fetch surveys
  const fetchSurveys = async () => {
    const snapshot = await getDocs(collection(db, "surveys"));
    setSurveys(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  // Add this function in your Surveys.jsx
  const handleDeleteSurvey = async (surveyId) => {
    // Check if any active assessment is using this survey
    const snapshot = await getDocs(collection(db, "assessments"));
    const activeUsingSurvey = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .some(
        (a) =>
          a.surveyId === surveyId && a.participants?.some((p) => !p.completed),
      );

    if (activeUsingSurvey) {
      alert(
        "Cannot delete this survey because it is used in an active assessment.",
      );
      return;
    }

    // If no active assessment is using it, allow deletion
    if (window.confirm("Are you sure you want to delete this survey?")) {
      await deleteDoc(doc(db, "surveys", surveyId));
      fetchSurveys(); // refresh the list
    }
  };

  // Fetch questions
  const fetchQuestions = async () => {
    const snapshot = await getDocs(collection(db, "questions"));
    setQuestions(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    fetchSurveys();
    fetchQuestions();
  }, []);

  // Create new survey
  const handleCreateSurvey = async () => {
    const trimmedName = newSurveyName.trim();
    if (!trimmedName) return;

    // Check if survey name already exists (case-insensitive)
    const exists = surveys.some(
      (s) => s.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (exists) {
      alert("A survey with this name already exists!");
      return;
    }

    await addDoc(collection(db, "surveys"), {
      name: trimmedName,
      questions: [],
      createdAt: Timestamp.now(),
    });

    setNewSurveyName("");
    fetchSurveys();
  };

  // Use existing survey as a template
  const handleUseTemplate = async (templateSurvey) => {
    const newName = prompt(
      "Enter a name for the new survey based on this template:",
    );
    if (!newName) return;

    const trimmedName = newName.trim();
    if (
      surveys.some((s) => s.name.toLowerCase() === trimmedName.toLowerCase())
    ) {
      alert("A survey with this name already exists!");
      return;
    }

    await addDoc(collection(db, "surveys"), {
      name: trimmedName,
      questions: templateSurvey.questions || [],
      createdAt: Timestamp.now(),
    });

    fetchSurveys();
  };

  // Open Edit Survey modal
  const handleEditSurvey = async (survey) => {
    // Fetch all assessments
    const snapshot = await getDocs(collection(db, "assessments"));
    const activeUsingSurvey = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .some(
        (a) =>
          a.surveyId === survey.id && a.participants?.some((p) => !p.completed),
      );

    if (activeUsingSurvey) {
      alert(
        "Cannot edit this survey because it is used in an active assessment.",
      );
      return;
    }

    // Open modal if not in use
    setEditingSurvey(survey);
    setFilterType("all");
  };

  // Close Edit Survey modal
  const handleCloseEdit = () => {
    setEditingSurvey(null);
  };

  // Add question to survey
  const handleAddQuestionToSurvey = async (question) => {
    if (editingSurvey.questions.some((q) => q.id === question.id)) {
      alert("Question already in survey!");
      return;
    }
    const updatedQuestions = [...editingSurvey.questions, question];
    const surveyRef = doc(db, "surveys", editingSurvey.id);
    await updateDoc(surveyRef, { questions: updatedQuestions });
    setEditingSurvey({ ...editingSurvey, questions: updatedQuestions });
    fetchSurveys();
  };

  // Remove question from survey
  const handleRemoveQuestionFromSurvey = async (questionId) => {
    const updatedQuestions = editingSurvey.questions.filter(
      (q) => q.id !== questionId,
    );
    const surveyRef = doc(db, "surveys", editingSurvey.id);
    await updateDoc(surveyRef, { questions: updatedQuestions });
    setEditingSurvey({ ...editingSurvey, questions: updatedQuestions });
    fetchSurveys();
  };

  // Filtered questions to add
  const filteredQuestions = questions.filter((q) => {
    if (filterType === "all") return true;
    return q.type === filterType;
  });

  return (
    <div>
      <Topbar />

      <div className="container">
        <h1>Surveys</h1>

        {/* Create new survey */}
        <div style={{ marginBottom: "20px" }}>
          <input
            type="text"
            placeholder="Enter new survey name"
            value={newSurveyName}
            onChange={(e) => setNewSurveyName(e.target.value)}
          />
          <button onClick={handleCreateSurvey} style={{ marginLeft: "8px" }}>
            Create Survey
          </button>
        </div>

        {/* List of surveys */}
        {surveys.length > 0 ? (
          surveys.map((s) => (
            <div
              key={s.id}
              className="user-card"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <div>
                <strong>{s.name}</strong> ({s.questions?.length || 0} questions)
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => handleEditSurvey(s)}>Edit Survey</button>
                <button onClick={() => handleUseTemplate(s)}>
                  Use as Template
                </button>
                <button
                  onClick={() => handleDeleteSurvey(s.id)}
                  style={{ backgroundColor: "#d32f2f" }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <p>No surveys yet.</p>
        )}
      </div>

      {/* Edit Survey Modal */}
      {editingSurvey && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "80%",
              maxWidth: "800px",
              background: "white",
              padding: "20px",
              borderRadius: "8px",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h2>Edit Survey: {editingSurvey.name}</h2>
            <button
              onClick={handleCloseEdit}
              style={{
                float: "right",
                backgroundColor: "#2fd334",
                marginBottom: "12px",
              }}
            >
              Close & Save
            </button>

            {/* Current questions in survey */}
            <h3>Questions in Survey</h3>
            <h>
              <em>**Questions appear in the order that you add them</em>
            </h>
            {editingSurvey.questions.length > 0 ? (
              editingSurvey.questions.map((q) => (
                <div
                  key={q.id}
                  className="user-card"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "4px",
                  }}
                >
                  <span>
                    {q.text} ({q.type})
                  </span>
                  <button
                    onClick={() => handleRemoveQuestionFromSurvey(q.id)}
                    style={{ backgroundColor: "#d32f2f" }}
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p>No questions in this survey yet.</p>
            )}

            {/* Add question to survey */}
            <h3 style={{ marginTop: "20px" }}>Add Questions from Database</h3>
            <label>
              Filter by type:{" "}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All</option>
                <option value="rated">Rated</option>
                <option value="text">Text</option>
              </select>
            </label>

            {filteredQuestions.length > 0 ? (
              filteredQuestions.map((q) => (
                <div
                  key={q.id}
                  className="user-card"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "4px",
                  }}
                >
                  <span>
                    {q.text} ({q.type})
                  </span>
                  <button onClick={() => handleAddQuestionToSurvey(q)}>
                    Add
                  </button>
                </div>
              ))
            ) : (
              <p>No questions available to add.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
