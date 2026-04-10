import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase/config";
import { collection, getDocs, addDoc } from "firebase/firestore";

export default function TakeReview() {
  const { revieweeId } = useParams();
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const fetchQuestions = async () => {
      const snapshot = await getDocs(collection(db, "questions"));
      const questionList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuestions(questionList);
    };
    fetchQuestions();
  }, []);

  const handleSubmit = async () => {
    const reviewData = questions.map(q => ({
      questionId: q.id,
      answer: answers[q.id] || "",
    }));

    await addDoc(collection(db, "reviews"), {
      revieweeId,
      reviewerId: auth.currentUser.uid,
      responses: reviewData,
      submittedAt: new Date().toISOString(),
    });

    alert("Review submitted!");
    navigate("/dashboard");
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Take Review</h1>
      {questions.map(q => (
        <div key={q.id} className="mb-4">
          <p>{q.text}</p>
          {q.type === "scaled" ? (
            <select
              className="p-2 border rounded w-full"
              value={answers[q.id] || ""}
              onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
            >
              <option value="">Select a score</option>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          ) : (
            <textarea
              className="w-full p-2 border rounded"
              value={answers[q.id] || ""}
              onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
            />
          )}
        </div>
      ))}
      <button className="p-2 bg-blue-500 text-white rounded" onClick={handleSubmit}>
        Submit Review
      </button>
    </div>
  );
}