import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase/config";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import ci360logo from "../assets/ClarityIndex360_Primary_4000px.png";
import logoGraphic from "../assets/CI360_aperture_icon_teal_gold.png";

export default function TakeSurvey() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState(null);
  const [participant, setParticipant] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchAssessmentAndParticipant = async () => {
      const snapshot = await getDocs(collection(db, "assessments"));

      let foundAssessment = null;
      let foundParticipant = null;

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const p = data.participants?.find((p) => p.link === id);

        if (p) {
          foundAssessment = { id: docSnap.id, ...data };
          foundParticipant = p;
        }
      });

      if (!foundParticipant) {
        setParticipant({ invalid: true });
        return;
      }

      setAssessment(foundAssessment);
      setParticipant(foundParticipant);

      const surveySnapshot = await getDocs(collection(db, "surveys"));
      const surveyDoc = surveySnapshot.docs.find(
        (s) => s.id === foundAssessment.surveyId,
      );

      if (surveyDoc) setQuestions(surveyDoc.data().questions || []);
    };

    fetchAssessmentAndParticipant();
  }, [id]);

  const handleChange = (qId, value) => {
    setResponses((prev) => ({ ...prev, [qId]: value }));
    setErrors((prev) => ({ ...prev, [qId]: false }));
  };

  const handleSubmit = async () => {
    if (!assessment || !participant) return;

    const newErrors = {};
    let hasError = false;

    questions.forEach((q) => {
      const answer = responses[q.id];

      if (q.type === "text") {
        if (!answer || answer.trim() === "") {
          newErrors[q.id] = "Please answer this question.";
          hasError = true;
        } else if (answer.length > 1200) {
          newErrors[q.id] = "Text exceeds 1200 characters.";
          hasError = true;
        }
      } else {
        if (answer === undefined || answer === null) {
          newErrors[q.id] = "Please answer this question.";
          hasError = true;
        }
      }
    });

    if (hasError) {
      setErrors(newErrors);
      alert("Please fix errors before submitting.");
      return;
    }

    const updatedParticipants = assessment.participants.map((p) =>
      p.link === id ? { ...p, completed: true, responses } : p,
    );

    const ref = doc(db, "assessments", assessment.id);
    await updateDoc(ref, { participants: updatedParticipants });

    navigate("/survey-outro");
  };

  if (!participant) return <p>Loading...</p>;
  if (participant.invalid)
    return <p>This survey link is invalid or has already been used.</p>;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <img src={ci360logo} alt="Clarity Index 360" style={styles.logo} />

        {questions.length === 0 && (
          <p style={styles.text}>No questions found for this survey.</p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          {questions.map((q) => (
            <div key={q.id} style={styles.questionBlock}>
              <label
                style={{
                  ...styles.label,
                  color: errors[q.id] ? "red" : "#000",
                }}
              >
                {q.text}
              </label>

              {q.type === "text" ? (
                <>
                  <textarea
                    value={responses[q.id] || ""}
                    onChange={(e) => handleChange(q.id, e.target.value)}
                    rows={3}
                    maxLength={1200}
                    style={{
                      ...styles.textarea,
                      borderColor: errors[q.id] ? "red" : "#ccc",
                    }}
                  />

                  <div style={styles.charCount}>
                    {responses[q.id]?.length || 0}/1200 characters
                  </div>

                  {errors[q.id] && (
                    <div style={styles.error}>{errors[q.id]}</div>
                  )}
                </>
              ) : (
                <div style={styles.scaleContainer}>
                  {[0, 1, 2, 3, 4, 5].map((val) => {
                    const label = val === 0 ? "N/O" : val;
                    const isSelected = responses[q.id] === val;

                    return (
                      <label key={val} style={styles.scaleItem}>
                        <div
                          style={{
                            ...styles.circle,
                            borderColor: errors[q.id] ? "red" : "#1976d2",
                          }}
                        >
                          {isSelected && <div style={styles.innerCircle} />}
                        </div>

                        <input
                          type="radio"
                          name={q.id}
                          checked={isSelected}
                          onChange={() => handleChange(q.id, val)}
                          style={{ display: "none" }}
                        />

                        <span>{label}</span>
                      </label>
                    );
                  })}

                  {errors[q.id] && (
                    <div style={styles.error}>{errors[q.id]}</div>
                  )}
                </div>
              )}
            </div>
          ))}

          {questions.length > 0 && (
            <button type="submit" style={styles.button}>
              Submit Survey
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

const styles = {
  logo: {
    width: "clamp(180px, 40%, 280px)",
    height: "auto",
    display: "block",
    margin: "0 auto 20px auto",
  },
  page: {
    textAlign: "center",
    marginTop: "60px",
    padding: "20px",
    fontFamily: "Arial, sans-serif",
  },

  card: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "40px",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    backgroundColor: "#fff",
    overflow: "hidden",
  },

  title: {
    marginBottom: "20px",
  },

  text: {
    marginBottom: "16px",
  },

  questionBlock: {
    marginBottom: "25px",
    textAlign: "left",
  },

  label: {
    fontWeight: "bold",
    display: "block",
    marginBottom: "8px",
  },

  textarea: {
    width: "100%",
    padding: "8px",
    borderRadius: "6px",
  },

  charCount: {
    fontSize: "12px",
    color: "gray",
    marginTop: "4px",
  },

  error: {
    color: "red",
    fontSize: "12px",
    marginTop: "4px",
  },

  scaleContainer: {
    display: "flex",
    justifyContent: "center",
    gap: "20px",
    flexWrap: "wrap",
    marginTop: "8px",
  },

  scaleItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    cursor: "pointer",
    gap: "4px",
  },

  circle: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    border: "2px solid #1976d2",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  innerCircle: {
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    backgroundColor: "#1976d2",
  },

  button: {
    marginTop: "20px",
    padding: "12px 24px",
    fontSize: "16px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#1976d2",
    color: "#fff",
    cursor: "pointer",
  },
};
