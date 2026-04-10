import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { Chart } from "chart.js/auto";
import jsPDF from "jspdf";
import logo from "../assets/llg.png";
import colorWheel from "../assets/color-wheel.png";
import colorBar from "../assets/color-bar.png";
import Topbar from "../components/Topbar";

export default function ReportPage() {
  const { id } = useParams();

  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState([]);

  const questionChartRefs = useRef({});
  const questionCanvasRefs = useRef({});

  const chartRef = useRef(null);
  const canvasRef = useRef(null);

  const getQuestionMap = () => {
    const map = {};

    questions.forEach((q) => {
      map[q.id] = q.text;
    });

    return map;
  };

  //----------------------
  // LOAD IMAGE HELPER
  //----------------------
  const loadImage = async (src) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;

    await new Promise((res) => (img.onload = res));

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    return canvas.toDataURL("image/png");
  };

  // -----------------------------
  // FETCH DATA
  // -----------------------------
  useEffect(() => {
    const fetchData = async () => {
      const ref = doc(db, "assessments", id);
      const snap = await getDoc(ref);

      if (!snap.exists()) return;

      const data = snap.data();
      setAssessment({ id: snap.id, ...data });

      const surveyRef = doc(db, "surveys", data.surveyId);
      const surveySnap = await getDoc(surveyRef);

      if (surveySnap.exists()) {
        setQuestions(surveySnap.data().questions || []);
      }
    };

    fetchData();
  }, [id]);

  // -----------------------------
  // ROLE AVERAGES
  // -----------------------------
  const processRoleAverages = () => {
    if (!assessment?.participants) return { labels: [], datasets: [] };

    const roles = {};
    const questionIds = new Set();

    assessment.participants.forEach((p) => {
      if (!p.completed) return;

      Object.entries(p.responses || {}).forEach(([qId, value]) => {
        if (typeof value !== "number") return;

        questionIds.add(qId);

        if (!roles[p.role]) roles[p.role] = {};
        if (!roles[p.role][qId]) roles[p.role][qId] = [];

        roles[p.role][qId].push(value);
      });
    });

    const labels = Array.from(questionIds);

    const datasets = Object.entries(roles).map(([role, qData]) => ({
      label: role,
      data: labels.map((qId) => {
        const vals = qData[qId] || [];
        if (!vals.length) return 0;

        return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
      }),
    }));

    return { labels, datasets };
  };

  // -----------------------------
  // TEXT RESPONSES
  // -----------------------------
  const getTextResponses = () => {
    const grouped = {};

    if (!assessment?.participants) return grouped;

    assessment.participants.forEach((p) => {
      if (!p.completed) return;

      Object.entries(p.responses || {}).forEach(([qId, value]) => {
        if (typeof value !== "string") return;

        const question =
          questions.find((q) => q.id === qId)?.text || "Question";

        if (!grouped[qId]) {
          grouped[qId] = {
            question,
            responses: [],
          };
        }

        grouped[qId].responses.push({
          name: p.name,
          role: p.role,
          text: value,
        });
      });
    });

    return grouped;
  };

  // -----------------------------
  // INSIGHTS
  // -----------------------------
  const getInsights = () => {
    if (!assessment?.participants) return [];

    const scores = {};

    assessment.participants.forEach((p) => {
      if (!p.completed) return;

      Object.entries(p.responses || {}).forEach(([_, value]) => {
        if (typeof value !== "number") return;

        if (!scores[p.role]) scores[p.role] = [];
        scores[p.role].push(value);
      });
    });

    const averages = Object.entries(scores).map(([role, vals]) => ({
      role,
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    }));

    const insights = [];

    const self = averages.find((r) => r.role === "Self");
    const others = averages.filter((r) => r.role !== "Self");

    const othersAvg =
      others.reduce((a, b) => a + b.avg, 0) / (others.length || 1);

    if (self && othersAvg) {
      const gap = self.avg - othersAvg;

      if (gap > 0.8) {
        insights.push(
          "Self-perception is significantly higher than peer feedback.",
        );
      } else if (gap < -0.8) {
        insights.push("Peers rate leadership higher than self-perception.");
      } else {
        insights.push("Self and peer perceptions are generally aligned.");
      }
    }

    return insights;
  };

  // -----------------------------
  // CHART RENDER
  // -----------------------------
  useEffect(() => {
    if (!assessment) return;

    const { labels, datasets } = processRoleAverages();

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    chartRef.current = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "top" },
        },
      },
    });
  }, [assessment]);

  // -----------------------------
  // PDF EXPORT
  // -----------------------------
  const downloadPDF = async () => {
    const pdf = new jsPDF("l", "mm", "a4"); // ✅ LANDSCAPE

    const logoData = await loadImage(logo);
    const pageWidth = 297;
    const pageHeight = 210;

    let y = 20;

    const getSelfName = () => {
      const self = assessment?.participants?.find((p) => p.role === "Self");
      return self?.name || assessment?.name || "Unknown";
    };

    const addFooter = () => {
      const page = pdf.internal.getNumberOfPages()-1; // Ignore title page
      pdf.setFontSize(9);
      pdf.text(`Clarity Index 360° Report - Page ${page}`, 10, 200);
      pdf.addImage(logoData, "PNG", 125, 190, 40, 15);
    };

    const newPage = () => {
      addFooter();
      pdf.addPage();
      y = 20;
    };

    const checkPageBreak = (space = 15) => {
      if (y + space > pageHeight - 20) {
        newPage();
      }
    };

    const selfName = getSelfName();

    // =============================
    // COVER PAGE (1)
    // =============================
    pdf.setFontSize(30);
    pdf.text("Leadership 360°", 112, y);
    y += 12;

    pdf.setFontSize(28);
    pdf.setTextColor(50, 50, 220);
    const wrapClientName = pdf.splitTextToSize(`${selfName}`, 90);
    pdf.text(wrapClientName, 190, 100);
    y += 12;

    pdf.setFontSize(20);
    pdf.setTextColor(0, 0, 0);
    const wrapAssessmentName = pdf.splitTextToSize(`${assessment.name}`, 250);
    pdf.text(wrapAssessmentName, 20, 20);

    pdf.setFontSize(11);
    pdf.text(
      "In partnership with Leblanc Leadership Group Inc.\nThe LIVE. LEARN. GROW. Company",
      180,
      180,
    );

    const wheel = await loadImage(colorWheel);
    pdf.addImage(wheel, "PNG", 24, 45, 130, 130);

    const rainbowBar = await loadImage(colorBar);
    pdf.addImage(rainbowBar, "PNG", 0, 28, 300, 5);



    // =============================
    //  INTRO PAGE (2)
    // =============================
    pdf.addPage();
    y = 20;

    pdf.setFontSize(18);
    pdf.setTextColor(50, 50, 220);
    pdf.text(`Introduction `, 20, y);
    y += 12;

    pdf.setFontSize(14);
    pdf.text(`Why leadership development?`, 20, y);
    y += 10;

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(12);
    const introText1 = `Leadership development is a vital component of building a great organization. It allows you to shape the culture and strategy of the business. Developing and sharpening leadership skills across leadership will increase employee morale and retention, improve productivity, promote better decision making, build better teams, and result in a better work environment for everyone.\n\nLeadership development is a lifelong process, not a one-off learning event. There is always something to be improved upon. It doesn’t need to be daunting or complicated. Slow, consistent development is the best approach. Small changes can end up making a huge impact on your career and work life.\n\nYour leadership development journey starts with understanding the skills needed to be a leader at the LDB, recognizing and appreciating your strengths, and reflecting on what abilities you need to develop to improve your leadership impact.\n\nThis Leadership 360 Assessment is a companion to the LDB Leadership Development Toolkit, providing valuable insights as you work to refine and enhance your leadership capabilities and capacity.   `;
    const lines1 = pdf.splitTextToSize(introText1, 250);

    pdf.text(lines1, 20, y);
    y += lines1.length * 6;

    pdf.setFontSize(14);
    pdf.setTextColor(50, 50, 220);
    pdf.text(`What is a 360 assessment?`, 20, y);
    y += 10;

    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    const introText2 = `A 360 is a powerful tool to better understand your leadership: \n\n-   By gaining a deeper understanding of how you see yourself in relation to LDB Leadership Competencies.\n-   By learning how those you work with see and perceive your leadership capabilities.\n-   By hearing how others experience your leadership.\n\nHelping you connect your actions, approach, and behaviours to the work that you do, and better understand what is effective, what may not be as useful, and any gaps or invisible gaps that may exist. `;
    const lines2 = pdf.splitTextToSize(introText2, 250);

    pdf.text(lines2, 20, y);
    y += lines2.length * 6;

    addFooter();

    // =============================
    //  HOW TO USE REPORT (3)
    // =============================
    pdf.addPage();
    y = 20;

    pdf.setFontSize(18);
    pdf.setTextColor(50, 50, 220);
    pdf.text(`How to use this report `, 20, y);
    y += 12;

    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    const howTo1 = `The LDB Leadership 360 is designed to provide data and insights. Using the LDB’s 13 Leadership Competencies as a foundation, the 360 statements provide clarity around: 

How you see yourself as a leader. What do you believe about your effectiveness as a leader? Do you give yourself enough credit for the good things that you do? Are there practices or patterns in your leadership that were once effective, but no longer serve you? Are there things that you have been working on already? Gaps or invisible gaps in your leadership? How key groups within your professional life see, perceive, and experience your leadership. What do they respect and appreciate about you as a leader? Are there behaviours or practices that perhaps are not as effective, potentially adding tension and conflict? Are these behaviours gaps things you are already familiar with and working on? Or are they invisible gaps, things you are unaware of, or have not been brought to your attention? 

Your coach will walk you through the following pages of this report, helping you to interpret the data provided. As you review the responses, it is important to keep in mind that everyone’s experience will vary, which will be reflected in the results. Through discussion with your coach, through taking time to reflect on the data, and taking time to notice and observe your day-to-day actions and behaviours, you will be able to make meaning of what is contained in your 360 report. 

In addition to the 360 results contained within this report, keep a copy of the LDB Leadership Development Toolkit close by. While the 360 report provides a snapshot of where you may be as a leader, the toolkit breaks down each competency in detail, providing key success factors and sample behaviours and actions that demonstrate effective leadership. 

In combination, these two leadership development tools contain a wealth of insights as you continue to refine and enhance your leadership practice. With the support of your coach and your own leader(s), you will be able to:  

- Make meaning of the insights and data from your 360. 
- Gain a deeper appreciation of the good work you do as a leader within the LDB.
- Identify opportunities for further growth and development as a leader. 
- Develop meaningful and impactful goals as part of your MyP3 process 
- Deepen your self-awareness. 
- Grow, both professionally and personally. `;
    const lines3 = pdf.splitTextToSize(howTo1, 250);

    pdf.text(lines3, 20, y);
    y += lines3.length * 6;

    addFooter();

    // =============================
    // EXECUTIVE SUMMARY
    // =============================
    pdf.addPage();
    y = 20;

    pdf.setFontSize(18);
    pdf.text("", 20, y);
    y += 12;

    getInsights().forEach((i) => {
      checkPageBreak(10);
      pdf.setFontSize(12);
      pdf.text("• " + i, 20, y);
      y += 8;
    });

    addFooter();

    // =============================
    // CHART DATA
    // =============================

    pdf.addPage();
    y = 20;

    pdf.setFontSize(18);
    pdf.setTextColor(50, 50, 220);
    pdf.text("Leadership Overview", 20, y);
    pdf.setTextColor(0, 0, 0);
    y += 10;

    // convert canvas → image
    const chartCanvas = canvasRef.current;
    const chartImage = chartCanvas.toDataURL("image/png");

    // size chart properly for landscape A4
    const imgWidth = 260;
    const imgHeight = 120;

    pdf.addImage(chartImage, "PNG", 15, y, imgWidth, imgHeight);

    addFooter();

    // =============================
    // TEXT RESPONSES
    // =============================
    pdf.addPage();
    y = 20;

    pdf.setFontSize(18);
    pdf.setTextColor(50, 50, 220);
    pdf.text("Narrative Comments", 20, y);
    pdf.setTextColor(0, 0, 0);
    y += 12;

    const textData = getTextResponses();

    Object.values(textData).forEach((q) => {
      checkPageBreak(20);

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      const wrappedQuestion = pdf.splitTextToSize(String(q.question), 250);
      pdf.text(wrappedQuestion, 20, y);
      y += wrappedQuestion.length * 6;

      q.responses.forEach((r) => {
        checkPageBreak(18);

        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        const lines = pdf.splitTextToSize(`- ${r.text}\n`, 250);
        pdf.text(lines, 25, y);
        y += lines.length * 5;
      });

      y += 6;
    });

    addFooter();

    // =============================
    // PARTICIPANTS
    // =============================
    pdf.addPage();
    y = 20;

    pdf.setFontSize(18);
    pdf.text("Participants (Testing Purposes Only", 20, y);
    y += 12;

    assessment.participants.forEach((p) => {
      checkPageBreak(10);

      pdf.setFontSize(11);
      pdf.text(
        `${p.name} (${p.role}) - ${p.completed ? "Completed" : "Pending"}`,
        20,
        y,
      );
      y += 8;
    });

    addFooter();

    // SAVE
    // Saves Assessment name and Client's name, stripping spaces and replacing with dashes
    pdf.save(
      `${assessment.name.replace(/\s+/g, "-")}-${selfName.replace(/\s+/g, "-")}-360-report.pdf`,
    );
  };

  if (!assessment) return <p>Loading...</p>;

  const textData = getTextResponses();
  const insights = getInsights();

return (
  
  <div style={styles.page}>
    <Topbar />
    {/* 👇 EVERYTHING HIDDEN FROM VIEW BUT STILL RENDERS */}
    <div style={styles.hiddenContent}>
      <div id="report" style={styles.card}>
        {/* HEADER */}
        <h1 style={styles.title}>Executive 360° Leadership Report</h1>
        <h2 style={styles.subTitle}>{assessment.name}</h2>

        <p style={styles.meta}>
          Participants: {assessment.participants.length} | Completed:{" "}
          {assessment.participants.filter((p) => p.completed).length}
        </p>

        {/* INSIGHTS */}
        <div style={styles.section}>
          <h3>Executive Summary</h3>
          {insights.map((i, idx) => (
            <p key={idx}>• {i}</p>
          ))}
        </div>

        {/* CHART */}
        <div style={styles.section}>
          <h3>Leadership Perception Overview</h3>
          <canvas ref={canvasRef}></canvas>
        </div>

        {/* TEXT RESPONSES */}
        <div style={styles.section}>
          <h3>Narrative Comments</h3>

          {Object.values(textData).map((q, i) => (
            <div key={i} style={styles.textBlock}>
              <h4>{q.question}</h4>

              {q.responses.map((r, j) => (
                <div key={j} style={styles.comment}>
                  <p>- {r.text}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* 👇 ONLY THING USER SEES */}
    <button style={styles.button} onClick={downloadPDF}>
      Download PDF
    </button>
  </div>
);
}
const styles = {
  page: {
    padding: "40px",
    fontFamily: "Arial",
    background: "#f5f6f8",
  },

  card: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "50px",
    background: "#fff",
    borderRadius: "14px",
    boxShadow: "0 6px 25px rgba(0,0,0,0.08)",
  },

  title: {
    fontSize: "28px",
    marginBottom: "5px",
  },

  subTitle: {
    color: "#555",
    marginBottom: "10px",
  },

  meta: {
    fontSize: "14px",
    color: "#777",
    marginBottom: "30px",
  },

  section: {
    marginTop: "30px",
    textAlign: "left",
  },

  textBlock: {
    marginBottom: "20px",
    padding: "10px",
    borderLeft: "3px solid #1976d2",
    background: "#fafafa",
  },

  comment: {
    marginTop: "8px",
  },

  button: {
    marginTop: "30px",
    padding: "12px 24px",
    background: "#1976d2",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },
  hiddenContent: {
  position: "absolute",
  left: "-99999px",
  top: "0",
  width: "1000px",
  height: "auto",
},
};
