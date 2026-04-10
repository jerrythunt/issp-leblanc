import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";

export default function LandingPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [participant, setParticipant] = useState(null);
  const [assessment, setAssessment] = useState(null);

  useEffect(() => {
    const fetchParticipant = async () => {
      const snapshot = await getDocs(collection(db, "assessments"));

      let foundAssessment = null;
      let foundParticipant = null;

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const p = data.participants?.find(p => String(p.link) === String(id));

        if (p) {
          foundAssessment = { id: docSnap.id, ...data };
          foundParticipant = p;
          break;
        }
      }

      if (!foundParticipant) {
        setParticipant({ invalid: true });
        return;
      }

      setAssessment(foundAssessment);
      setParticipant(foundParticipant);
    };

    fetchParticipant();
  }, [id]);

  if (!participant) return <div>Loading...</div>;
  if (participant.invalid)
    return <div>This survey link is invalid or has already been used.</div>;

  // Client name logic
  const clientName =
    assessment?.participants?.find(p => p.role === "Self")?.name ||
    assessment?.name;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Welcome!</h1>

        <p style={styles.text}>
          Thank you for participating in this Clarity Index 360™ process for:
        </p>

        <h2 style={styles.clientName}>{clientName}</h2>

        <p style={styles.text}>
          Your feedback helps this leader better understand how their leadership
          is experienced by others and supports focused growth and development.
        </p>

        <p style={styles.text}>
          Your responses are confidential and will be shared in a way that
          protects anonymity wherever possible. Please respond based on your
          direct observations and experience.
        </p>

        <p style={styles.text}>
          This is a developmental process, <em>not</em> a performance evaluation.
        </p>

        <h2 style={styles.sectionTitle}>Rating Scale</h2>

        <ul style={styles.list}>
          <li>
            <b>1 – Rarely Demonstrated</b>: This behaviour is rarely observed or
            is ineffective when it occurs.
          </li>
          <li>
            <b>2 – Inconsistently Demonstrated</b>: This behaviour is sometimes
            observed, but not consistently or effectively.
          </li>
          <li>
            <b>3 – Generally Demonstrated</b>: This behaviour is regularly
            observed and generally effective.
          </li>
          <li>
            <b>4 – Consistently Demonstrated</b>: This behaviour is clearly and
            consistently demonstrated and has a positive impact.
          </li>
          <li>
            <b>5 – Clear Strength / Role Model</b>: This behaviour is a distinct
            strength and meaningfully elevates effectiveness.
          </li>
          <li>
            <b>N/O – Not Observed</b>: You have not had sufficient opportunity
            to observe this behaviour fairly. (does not affect scoring)
          </li>
        </ul>

        <p style={styles.text}>
          Thank you for sharing your perspective thoughtfully and honestly.
        </p>

        <button style={styles.button} onClick={() => navigate(`/survey/${id}`)}>
          Start Survey
        </button>
      </div>
    </div>
  );
}

// CSS 
const styles = {
  page: {
    textAlign: "center",
    marginTop: "60px",
    padding: "20px",
    fontFamily: "Arial, sans-serif",
    
  },

  card: {
    maxWidth: "750px",
    margin: "0 auto",
    padding: "40px",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    backgroundColor: "#01ff2b36",
  },

  title: {
    marginBottom: "20px",
  },

  clientName: {
    margin: "20px 0",
  },

  sectionTitle: {
    marginTop: "30px",
  },

  text: {
    lineHeight: "1.6",
    marginBottom: "12px",
  },

  list: {
    listStyleType: "none",
    paddingLeft: 0,
    textAlign: "left",
    display: "inline-block",
    marginTop: "10px",
  },

  button: {
    padding: "12px 24px",
    fontSize: "16px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#1976d2",
    color: "#fff",
    cursor: "pointer",
    marginTop: "20px",
  },
};