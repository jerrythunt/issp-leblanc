import { useEffect, useState } from "react";
import { db, auth } from "../firebase/config";
import { collection, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";

export default function Questions() {
  const [questions, setQuestions] = useState([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [newType, setNewType] = useState("rated"); // default type
  const navigate = useNavigate();

  const adminEmail = "admin@admin.com"; // <-- replace with your admin email


  // Fetch questions
  const fetchQuestions = async () => {
    const snapshot = await getDocs(collection(db, "questions"));
    const qList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sort alphabetically by text within type
    qList.sort((a, b) => a.text.localeCompare(b.text));

    setQuestions(qList);
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

// Add new question
const handleAddQuestion = async () => {
  const trimmedText = newQuestion.trim();
  if (!trimmedText) return;

  // Check if question already exists (case-insensitive)
  const exists = questions.some(q => q.text.toLowerCase() === trimmedText.toLowerCase());
  if (exists) {
    alert("This question already exists!");
    return;
  }

  // Add new question to Firestore
  await addDoc(collection(db, "questions"), {
    text: trimmedText,
    type: newType,
  });

  // Reset input and reload questions
  setNewQuestion("");
  setNewType("rated");
  fetchQuestions();
};

  // Delete question
  const handleDeleteQuestion = async (id) => {
    if (window.confirm("Are you sure you want to delete this question?")) {
      await deleteDoc(doc(db, "questions", id));
      fetchQuestions();
    }
  };

  // Separate lists by type
  const ratedQuestions = questions.filter(q => q.type === "rated");
  const textQuestions = questions.filter(q => q.type === "text");

  const containerStyle = {
    border: "1px solid #ccc",
    borderRadius: "6px",
    overflow: "hidden",
    marginBottom: "20px",
  };

  const headerStyle = (color) => ({
    backgroundColor: color,
    color: "white",
    padding: "8px 12px",
    fontWeight: "bold",
    fontSize: "16px",
  });

  const listStyle = {
    maxHeight: "250px",
    overflowY: "auto",
    padding: "8px",
  };

    return (
    <div>
        {/* Topbar */}
        <Topbar />

        {/* Main content */}
        <div className="container"> 
        <h1>Questions</h1>

        {/* Add new question */}
        <div style={{ marginBottom: "20px" }}>
            <input
            type="text"
            placeholder="Enter new question"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            />
            <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            style={{ marginTop: "8px" }}
            >
            <option value="rated">Rated (1-5, 0 = Not Observed)</option>
            <option value="text">Text</option>
            </select>
            <button onClick={handleAddQuestion} style={{ marginTop: "8px" }}>Add Question</button>
        </div>

        {/* Rated Questions container */}
        <div style={containerStyle}>
            <div style={headerStyle("#1976d2")}>Rated Questions</div>
            <div style={listStyle}>
            {ratedQuestions.length > 0 ? ratedQuestions.map(q => (
                <div key={q.id} className="user-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span>{q.text}</span>
                <button onClick={() => handleDeleteQuestion(q.id)} style={{ backgroundColor: "#d32f2f" }}>Delete</button>
                </div>
            )) : <p>No rated questions yet.</p>}
            </div>
        </div>

        {/* Text Questions container */}
        <div style={containerStyle}>
            <div style={headerStyle("#4caf50")}>Text Questions</div>
            <div style={listStyle}>
            {textQuestions.length > 0 ? textQuestions.map(q => (
                <div key={q.id} className="user-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span>{q.text}</span>
                <button onClick={() => handleDeleteQuestion(q.id)} style={{ backgroundColor: "#d32f2f" }}>Delete</button>
                </div>
            )) : <p>No text questions yet.</p>}
            </div>
        </div>
        </div>
    </div>
    );
}