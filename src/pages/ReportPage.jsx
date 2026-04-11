import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { Chart } from "chart.js/auto";
import jsPDF from "jspdf";
import logo from "../assets/llg.png";
import Topbar from "../components/Topbar";
import ci360logo from "../assets/ClarityIndex360_Primary_4000px.png";
import logoGraphic from "../assets/CI360_aperture_icon_teal_gold.png";

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
    const pdf = new jsPDF("p", "mm", "a4"); // ✅ Portrait by default

    let pageWidth = 210;
    let pageHeight = 297;
    let orientation = "p";

    let y = 20;

    const getRatingDistribution = (row) => {
      const dist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      if (!assessment?.participants) return dist;

      assessment.participants.forEach((p) => {
        if (!p.completed) return;

        const value = p.responses?.[row.qId];

        if (typeof value === "number") {
          const v = Math.round(value);
          if (v >= 0 && v <= 5) dist[v]++;
        }
      });

      return dist;
    };

    // =========================
    // TABLE LAYOUT CONSTANTS
    // =========================
    const leftMargin = 15;
    const pageRight = 195; // A4 usable width (portrait)
    const tableWidth = pageRight - leftMargin;

    const colX = {
      question: leftMargin,
      self: 135,
      others: 165,
    };

    const questionWidth = 110;
    const rowMinHeight = 12;

    const getSelfName = () => {
      const self = assessment?.participants?.find((p) => p.role === "Self");
      return self?.name || assessment?.name || "Unknown";
    };

    const ciHeaderLogo = await loadImage(ci360logo);

    const addFooter = () => {
      const page = pdf.internal.getNumberOfPages() - 1;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        ` Page ${page}
        © 2026 The LIVE. LEARN. GROW. Company
        A division of LeBlanc Leadership Group Inc. All rights reserved
        Clarity Index 360™ is a proprietary assessment. (Version 1.0)
        `,
        pageWidth / 2,
        pageHeight - 20,
        {
          align: "center",
        },
      );
    };

    // -------------
    // HEAT MAP HELPER
    // -------------

    const getHeatColor = (value) => {
      // grey for missing / 0
      if (value === null || value === undefined || value === 0) {
        return [225, 225, 225];
      }

      const v = Math.max(1, Math.min(5, value));
      const t = (v - 1) / 4;

      // light turquoise → dark turquoise
      const start = { r: 160, g: 240, b: 235 }; // light turquoise
      const end = { r: 0, g: 128, b: 128 }; // dark turquoise (teal-ish)

      const r = Math.round(start.r + t * (end.r - start.r));
      const g = Math.round(start.g + t * (end.g - start.g));
      const b = Math.round(start.b + t * (end.b - start.b));

      return [r, g, b];
    };

    function getBlueColor(value) {
      if (value === null || value === undefined || isNaN(value)) {
        return [235, 235, 235]; // neutral grey
      }

      // 1. take magnitude (ignore direction)
      const abs = Math.abs(value);

      // 2. define max expected range (adjust if needed)
      const max = 3; // <- IMPORTANT (since your scale is 0–3ish)

      // 3. normalize 0 → 1
      const t = Math.min(abs / max, 1);

      // 4. smooth gradient (light → dark blue)
      const r = Math.round(245 - t * 140);
      const g = Math.round(250 - t * 170);
      const b = 255;

      return [r, g, b];
    }

    const getHeatmapData = () => {
      if (!assessment?.participants) return [];

      const roles = {};
      const questionIds = new Set();

      assessment.participants.forEach((p) => {
        if (!p.completed) return;

        Object.entries(p.responses || {}).forEach(([qId, value]) => {
          if (typeof value !== "number") return;
          if (value === 0) return; // ignore 0s

          questionIds.add(qId);

          if (!roles[p.role]) roles[p.role] = {};
          if (!roles[p.role][qId]) roles[p.role][qId] = [];

          roles[p.role][qId].push(value);
        });
      });

      const questionsArr = Array.from(questionIds);

      return questionsArr.map((qId) => {
        const questionText = questions.find((q) => q.id === qId)?.text || qId;

        const row = {
          qId,
          question: questionText,
          roles: {},
          allValues: [], // 👈 add this
        };

        Object.entries(roles).forEach(([role, qMap]) => {
          const vals = qMap[qId] || [];

          if (vals.length > 0) {
            row.roles[role] = vals.reduce((a, b) => a + b, 0) / vals.length;

            row.allValues.push(...vals); // 👈 collect ALL values
          } else {
            row.roles[role] = null;
          }
        });

        // 👇 overall average across all raters
        row.overall =
          row.allValues.length > 0
            ? row.allValues.reduce((a, b) => a + b, 0) / row.allValues.length
            : null;

        return row;
      });
    };

    const addHeader = (logoData, pageWidth) => {
      const logoWidth = 40;
      const logoHeight = 10;

      pdf.addImage(
        logoData,
        "PNG",
        pageWidth / 2 - logoWidth / 2,
        8,
        logoWidth,
        logoHeight,
      );
    };

    let isFirstPage = true;

    const newPage = (dir = "p") => {
      pdf.addPage([297, 210], dir); // 👈 IMPORTANT

      orientation = dir;

      if (dir === "l") {
        pageWidth = 297;
        pageHeight = 210;
      } else {
        pageWidth = 210;
        pageHeight = 297;
      }

      y = 20;

      if (!isFirstPage) {
        addHeader(ciHeaderLogo, pageWidth);
      }

      isFirstPage = false;
    };

    const checkPageBreak = (space = 15) => {
      if (y + space > pageHeight - 50) {
        newPage();
      }
    };

    // Grab questions to display in PDF
    const getQuestionTableData = () => {
      if (!assessment?.participants) return [];

      const rows = {};

      assessment.participants.forEach((p) => {
        if (!p.completed) return;

        Object.entries(p.responses || {}).forEach(([qId, value]) => {
          if (typeof value !== "number") return;

          // 🚫 ignore 0 values entirely
          if (value === 0) return;

          if (!rows[qId]) {
            rows[qId] = {
              self: [],
              others: [],
            };
          }

          if (p.role === "Self") {
            rows[qId].self.push(value);
          } else {
            rows[qId].others.push(value);
          }
        });
      });

      return Object.entries(rows).map(([qId, data]) => {
        const questionText = questions.find((q) => q.id === qId)?.text || qId;

        const avg = (arr) =>
          arr.length > 0
            ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)
            : "N/A";

        return {
          question: questionText,
          self: avg(data.self),
          others: avg(data.others),
        };
      });
    };

    const selfName = getSelfName();

    const portraitPageWidth = 210;
    const portraitPageHeight = 297;

    const landscapePageWidth = 297;
    const landscapePageHeight = 210;

    const HEADER_HEIGHT = 32;

    const margin = 20;

    // =============================
    // COVER PAGE
    // =============================
    const ciLogo = await loadImage(ci360logo);
    pdf.addImage(ciLogo, "PNG", 12, 40, 180, 45, { align: "center" });

    pdf.setFontSize(16);
    pdf.setFont("helvetica", "italic");
    pdf.text("A focused 360 for leadership clarity and impact", 105, 100, {
      align: "center",
    });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    pdf.text(
      "_______________________________________________________________________________",
      105,
      110,
      { align: "center" },
    );

    pdf.setFontSize(12);
    pdf.text(
      `The Clarity Index is a developmental feedback tool designed to support leadership self-
      awareness, insight, and focused growth conversations. It is not intended for performance 
      management, compensation decisions, or disciplinary action.`,
      105,
      119,
      { align: "center" },
    );

    pdf.setFont("helvetica", "normal");
    pdf.text(
      "_______________________________________________________________________________",
      105,
      135,
      { align: "center" },
    );

    pdf.setFontSize(28);
    pdf.setFont("helvetica", "bold");
    const wrapClientName = pdf.splitTextToSize(`${selfName}`, 70, 100);
    pdf.text(wrapClientName, 105, 150, { align: "center" });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    pdf.text(
      "_______________________________________________________________________________",
      105,
      160,
      { align: "center" },
    );

    const logoPhoto = await loadImage(logoGraphic);
    pdf.addImage(logoPhoto, "PNG", 85, 165, 45, 45, { align: "center" });

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "italic", "bold");
    pdf.text("Clarity creates choice. Choice creates growth.", 105, 220, {
      align: "center",
    });

    // =============================
    //  INTRO PAGE (1)
    // =============================
    pdf.addPage();
    addHeader(ciHeaderLogo, pageWidth);

    // start BELOW header
    y = HEADER_HEIGHT;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text(`Introduction to Your Clarity Index 360™ Report`, 110, y, {
      align: "center",
    });
    y += 12;

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Purpose of the Clarity Index 360™`, 20, y);
    y += 10;

    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(12);
    const introText1 = `The Clarity Index 360™ is a facilitated, developmental leadership insight tool designed to help leaders understand how their leadership behaviours are experienced, perceived, and felt by others at work.

Rather than measuring everything at once, the Clarity Index 360 intentionally focuses on a small number of priority behaviours that matter most for effectiveness, relationships, and impact right now. The goal is not perfection, comparison, or judgment, it is clarity: clarity about what is working well, where leadership impact is strongest, and where focused attention or refinement may be useful.`;
    const lines1 = pdf.splitTextToSize(
      introText1,
      portraitPageWidth - margin * 2,
    );

    pdf.text(lines1, 20, y);
    y += lines1.length * 6;

    pdf.setFont("helvetica", "bold");
    pdf.text(`How the Clarity Index 360 Is Designed`, 20, y);
    y += 10;

    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(12);
    const introText2 = `The Clarity Index 360 differs from traditional 360-degree feedback tools in several important ways:

  • It is focused and bespoke, rather than broad or competency heavy.
  • It is administered and facilitated by The LIVE. LEARN. GROW. Company, a division of LeBlanc Leadership Group Inc.
  • It prioritizes insight over volume, collecting only data that will be used.
  • It is never delivered without facilitation, ensuring context, care, and meaning.
  • It treats feedback as developmental input, not evaluative judgment.

Each Clarity Index 360 is customized based on the leader’s role, context, goals, and coaching focus. Questions are drawn from a curated menu of behavioural statements and open-ended prompts, with a maximum of:

  • Approximately 10 rating questions
  • 3–5 narrative questions

All raters are asked to respond based on direct observation of behaviour, not intent, personality, or assumptions. There are no right or wrong answers—honest, thoughtful input helps surface patterns that support reflection, learning, and constructive conversation.`;
    const lines2 = pdf.splitTextToSize(
      introText2,
      portraitPageWidth - margin * 2,
    );

    pdf.text(lines2, 20, y);
    y += lines2.length * 6;
    addFooter();

    // =============================
    //  HOW TO READ RATINGS (2)
    // =============================
    pdf.addPage();
    addHeader(ciHeaderLogo, pageWidth);

    // start BELOW header
    y = HEADER_HEIGHT;

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`How to Read The Ratings`, 20, y);
    y += 10;

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    pdf.text(
      `The rating questions use a behaviourally anchored scale, defined as follows:`,
      20,
      y,
    );
    y += 10;

    pdf.setFont("helvetica", "bold");
    pdf.text(`1 – Rarely Demonstrated`, 20, y);
    y += 5;
    pdf.setFont("helvetica", "normal");
    let rating1 = `This behaviour is rarely observed or is ineffective when it occurs. It may create confusion, misalignment, or require intervention.`;
    let rating1Lines = pdf.splitTextToSize(
      rating1,
      portraitPageWidth - margin * 2,
    );
    pdf.text(rating1Lines, 20, y);
    y += rating1Lines.length * 6;

    // ----------------------------

    pdf.setFont("helvetica", "bold");
    pdf.text(`2 – Inconsistently Demonstrated`, 20, y);
    y += 5;
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    let rating2 = `The behaviour shows up occasionally but lacks consistency or impact. Effectiveness may vary by situation, pressure, or audience.`;
    let rating2Lines = pdf.splitTextToSize(
      rating2,
      portraitPageWidth - margin * 2,
    );
    pdf.text(rating2Lines, 20, y);
    y += rating2Lines.length * 6;

    // ----------------------------

    pdf.setFont("helvetica", "bold");
    pdf.text(`3 – Generally Demonstrated`, 20, y);
    y += 5;

    pdf.setFont("helvetica", "normal");
    let rating3 = `The behaviour is regularly observed and generally effective. It meets expectations and contributes positively, with room to strengthen impact or consistency.`;
    let rating3Lines = pdf.splitTextToSize(
      rating3,
      portraitPageWidth - margin * 2,
    );
    pdf.text(rating3Lines, 20, y);
    y += rating3Lines.length * 6;

    // ----------------------------

    pdf.setFont("helvetica", "bold");
    pdf.text(`4 – Consistently Demonstrated`, 20, y);
    y += 5;
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    let rating4 = `The behaviour is clearly and consistently demonstrated and meets expectations. It positively influences others and supports strong individual or team outcomes.`;
    let rating4Lines = pdf.splitTextToSize(
      rating4,
      portraitPageWidth - margin * 2,
    );
    pdf.text(rating4Lines, 20, y);
    y += rating4Lines.length * 6;

    // ----------------------------

    pdf.setFont("helvetica", "bold");
    pdf.text(`5 – Clear Strength / Role Model`, 20, y);
    y += 5;

    pdf.setFont("helvetica", "normal");
    let rating5 = `This behaviour is a distinct strength. The leader models it for others and it meaningfully elevates team, system, or organizational effectiveness.`;
    let rating5Lines = pdf.splitTextToSize(
      rating5,
      portraitPageWidth - margin * 2,
    );
    pdf.text(rating5Lines, 20, y);
    y += rating5Lines.length * 6;

    // ----------------------------

    pdf.setFont("helvetica", "bold");
    pdf.text(`N/O – Not Observed`, 20, y);
    y += 5;

    pdf.setFont("helvetica", "normal");
    let ratingNo = `The rater has not had sufficient opportunity to observe this behaviour and cannot rate it fairly.`;
    let ratingNoLines = pdf.splitTextToSize(
      ratingNo,
      portraitPageWidth - margin * 2,
    );
    pdf.text(ratingNoLines, 20, y);
    y += ratingNoLines.length * 6;
    y += 10;

    // ------------------------------------------
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Understanding Aggregation and Confidentiality`, 20, y);
    y += 10;
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");

    let ratingExplained = `The Clarity Index 360 is designed to protect psychological safety while preserving insight:

• Self-ratings are shown transparently and included in overall averages.
• Leader and Leader’s Leader ratings are shown transparently.
• Other rater categories are shown only when there are three or more raters in that category.
• Categories with fewer than three raters are included in the overall score but not shown separately.

These rules ensure confidentiality while still allowing meaningful patterns to emerge.`;
    let ratingExplainedLines = pdf.splitTextToSize(
      ratingExplained,
      portraitPageWidth - margin * 2,
    );
    pdf.text(ratingExplainedLines, 20, y);
    y += ratingExplainedLines.length * 6;

    addFooter();

    // =============================
    // NARRATIVE COMMENTS AND THEMATIC INSIGHTS (3)
    // =============================
    pdf.addPage();
    addHeader(ciHeaderLogo, pageWidth);

    // start BELOW header
    y = HEADER_HEIGHT;

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Narrative Comments and Thematic Insights`, 20, y);
    y += 10;

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");

    let narrativeExplained = `In addition to numeric ratings, this report includes verbatim narrative comments. These comments are not attributed to individual raters and are presented to add context, nuance, and texture to the quantitative data.

Where appropriate, themes may be synthesized to surface:

• Strengths
• Growth edges
• Patterns and tensions
• Opportunities for intentional development

The intent is to support conversation, reflection, and action, not judgment.`;
    let narrativeExplainedLines = pdf.splitTextToSize(
      narrativeExplained,
      portraitPageWidth - margin * 2,
    );
    pdf.text(narrativeExplainedLines, 20, y);
    y += narrativeExplainedLines.length * 6;

    // ---------------
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`What This Assessment Is (and Is Not)`, 20, y);
    y += 10;

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");

    let notAssessmentExplained = `The Clarity Index 360 is:

• A tool for self-awareness and leadership growth
• Input for coaching and developmental dialogue
• A way to reduce noise and focus attention on what matters most

The Clarity Index 360 is not used for:

• Performance ratings
• Compensation or promotion decisions
• Ranking leaders against one another
• Disciplinary or HR compliance purposes`;
    let notAssessmentExplainedLines = pdf.splitTextToSize(
      notAssessmentExplained,
      portraitPageWidth - margin * 2,
    );
    pdf.text(notAssessmentExplainedLines, 20, y);
    y += notAssessmentExplainedLines.length * 6;

    // -----------------------------

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`A Final Note`, 20, y);
    y += 10;

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");

    let finalNote = `The value of this report lies not in the numbers alone, but in the quality of reflection and conversation it enables. It is intended to be explored thoughtfully, with curiosity and care, as part of an ongoing leadership development journey.`;
    let finalNoteLines = pdf.splitTextToSize(
      finalNote,
      portraitPageWidth - margin * 2,
    );
    pdf.text(finalNoteLines, 20, y);
    y += finalNoteLines.length * 6;

    addFooter();

    // =============================
    // INTERPRETING RESULTS (4)
    // =============================
    pdf.addPage();
    addHeader(ciHeaderLogo, pageWidth);

    // start BELOW header
    y = HEADER_HEIGHT;

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Interpreting Your Results`, 20, y);
    y += 10;

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");

    let interpretWords = `The pages that follow present multiple perspectives on how your leadership behaviours are experienced by others. Rather than focusing on individual scores or isolated data points, this report is best read by noticing patterns, alignment, and areas of difference across perspectives.

No single score tells the full story. What matters most is how the information comes together to support reflection, insight, and meaningful conversation.

This report is designed to be explored thoughtfully and, where possible, in dialogue with a coach or facilitator. Its purpose is not judgment or evaluation, but clarity about what is working well, where your leadership impact is strongest, and where focused attention may be useful.

As you review the results, consider approaching them with curiosity rather than conclusion.`;
    let interpretWordsLines = pdf.splitTextToSize(
      interpretWords,
      portraitPageWidth - margin * 2,
    );
    pdf.text(interpretWordsLines, 20, y);
    y += interpretWordsLines.length * 6;

    addFooter();

    // =============================
    // AT A GLANCE RESULTS (5)
    // =============================
    pdf.addPage();
    addHeader(ciHeaderLogo, pageWidth);

    // start BELOW header
    y = HEADER_HEIGHT;

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`At-a-Glance Results`, 20, y);
    y += 10;

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");

    let glanceWords = `This page provides a high-level view of your Clarity Index 360 results, including:

• your self-ratings
• aggregated ratings from others
• areas of alignment and difference

Use this page to gain an initial sense of how your leadership is experienced across perspectives. Avoid drawing conclusions too quickly and resist the urge to focus only on the highest or lowest scores. The most useful insights often live in the patterns and gaps.

Instead, notice:

• where scores cluster
• where gaps appear
• where results feel affirming, surprising, or unclear

The pages that follow will provide additional context to support deeper understanding.`;
    let glanceWordsLines = pdf.splitTextToSize(
      glanceWords,
      portraitPageWidth - margin * 2,
    );
    pdf.text(glanceWordsLines, 20, y);
    y += glanceWordsLines.length * 6;

    addFooter();

    // =============================
    // INITIAL PATTERNS AND OBSERVATIONS (6)
    // =============================
    pdf.addPage();
    addHeader(ciHeaderLogo, pageWidth);

    // start BELOW header
    y = HEADER_HEIGHT;

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Initial Patterns and Observations`, 20, y);
    y += 10;

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");

    let patternsWords = `Before exploring individual themes in detail, it can be helpful to pause and notice broader patterns emerging from the data. Based on the results, several patterns may be worth your attention:

    • Areas where self-perception and others’ experience appear closely aligned
    • Areas where there is a noticeable difference between self and others`;
    let patternsWordsLines = pdf.splitTextToSize(
      patternsWords,
      portraitPageWidth - margin * 2,
    );
    pdf.text(patternsWordsLines, 20, y);
    y += patternsWordsLines.length * 6;

    const tableData = getQuestionTableData();

    let startY = y;

    // =========================
    // HEADER
    // =========================
    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");

    pdf.text("Self Rating", colX.self, startY);
    pdf.text("Raters", colX.others, startY);

    startY += 6;

    // header underline
    pdf.setDrawColor(180);
    pdf.line(leftMargin, startY, pageRight, startY);

    startY += 6;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);

    tableData.forEach((row, index) => {
      checkPageBreak(rowMinHeight + 6);

      const questionLines = pdf.splitTextToSize(row.question, questionWidth);
      const cellHeight = Math.max(rowMinHeight, questionLines.length * 6);

      const rowY = startY;

      // =========================
      // ZEBRA STRIPE (slightly stronger contrast)
      // =========================
      if (index % 2 === 0) {
        pdf.setFillColor(240, 240, 240);
        pdf.rect(leftMargin, rowY - 5, tableWidth, cellHeight, "F");
      }

      // =========================
      // GRID BORDER
      // =========================
      pdf.setDrawColor(200);
      pdf.rect(leftMargin, rowY - 5, tableWidth, cellHeight);

      // vertical separators (wider spacing)
      pdf.line(130, rowY - 5, 130, rowY - 5 + cellHeight);
      pdf.line(160, rowY - 5, 160, rowY - 5 + cellHeight);

      // =========================
      // TEXT
      // =========================
      pdf.text(questionLines, colX.question + 2, rowY);

      pdf.text(String(row.self), colX.self + 2, rowY);
      pdf.text(String(row.others), colX.others + 2, rowY);

      startY += cellHeight;
    });

    y = startY + 10;

    addFooter();

    // =============================
    // RESULTS BY LEADERSHIP THEME (7)
    // =============================
    pdf.addPage();
    addHeader(ciHeaderLogo, pageWidth);

    // start BELOW header
    y = HEADER_HEIGHT;

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Results by Leadership Theme`, 20, y);
    y += 10;

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");

    let leadershipWords = `The following tables present results related to Rater Group Comparisons, Ratings Differentials, and Ratings Distribution drawing on input from multiple perspectives.

As you review this section, consider the following reflection questions:

• What stands out to you most in these results?
• Where do you notice alignment between your self-ratings and others’ experience?
• Where do you notice differences or variation across perspectives?
• What context, conditions, or expectations might influence how these behaviours are experienced?

Avoid focusing solely on whether scores are “high” or “low.” Instead, notice patterns of experience and what they may be pointing to.`;
    let leadershipWordsLines = pdf.splitTextToSize(
      leadershipWords,
      portraitPageWidth - margin * 2,
    );
    pdf.text(leadershipWordsLines, 20, y);
    y += leadershipWordsLines.length * 6;

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Self-Perception and Others' Experience`, 20, y);
    y += 10;

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");

    let leadershipWords2 = `Differences between how leaders see themselves and how they are experienced by others are common and expected. These differences are not inherently positive or negative.

In some cases, they may point to:

• strengths that are under-recognized
• behaviours that show up differently under pressure
• differences in context, role expectations, or visibility

Use this comparison as an opportunity to explore how your intentions, actions, and impact intersect, particularly in moments that matter most.`;
    let leadershipWordsLines2 = pdf.splitTextToSize(
      leadershipWords2,
      portraitPageWidth - margin * 2,
    );
    pdf.text(leadershipWordsLines2, 20, y);
    y += leadershipWordsLines2.length * 6;

    addFooter();

    // =============================
    // TABLE 1 RATER GROUP COMPARISONS - HEAT MAP (8) - LANDSCAPE
    // =============================
    newPage("l");
    addHeader(ciHeaderLogo, pageWidth);
    const shiftLeft = -20;

    // always reset Y AFTER header
    startY = HEADER_HEIGHT + 6;

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Table 1: Rater Group Comparisons", pageWidth / 2, startY, {
      align: "center",
    });
    startY -= 8;

    // DATA
    const data = getHeatmapData();

    const roleList = Object.keys(
      assessment.participants
        .filter((p) => p.completed)
        .reduce((acc, p) => {
          acc[p.role] = true;
          return acc;
        }, {}),
    );

    // TITLE
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");

    startY += 10;

    // COLUMN LAYOUT
    const x = {
      question: 15,
      questionMaxWidth: 75,
      overall: 115 + shiftLeft,
    };

    const avgWidth = 20;
    const colWidth = 30;
    const roleX = {};
    let xPos = x.overall + avgWidth + shiftLeft + 19;

    roleList.forEach((r) => {
      if (r !== "Self") {
        roleX[r] = xPos;
        xPos += 30;
      }
    });

    const rowHeight = 8;

    // GROUP HEADER
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");

    // group label spanning roles
    const rolesStartX = 150;
    startY += 5;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");

    pdf.text("Raters", x.overall + 10, startY, { align: "center" });

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");

    Object.entries(roleX).forEach(([role, xpos]) => {
      const wrapped = pdf.splitTextToSize(role, 25);

      const centerX = xpos + 15; // because each column is 30 wide

      pdf.text(wrapped, centerX, startY, {
        align: "center",
      });
    });

    startY += 6;

    // ROWS
    pdf.setFont("helvetica", "normal");

    data.forEach((row, i) => {
      const questionLines = pdf.splitTextToSize(
        row.question,
        x.questionMaxWidth,
      );
      const h = Math.max(rowHeight, questionLines.length * 5);

      // ✅ IMPORTANT: check BEFORE drawing anything
      if (startY + h > pageHeight - 30) {
        newPage("l");
        addHeader(ciHeaderLogo, pageWidth);

        startY = HEADER_HEIGHT + 10;

        // redraw table header on new page
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");

        pdf.text("Question", x.question, startY);
        pdf.text("Avg", x.overall, startY);

        Object.entries(roleX).forEach(([role, xpos]) => {
          const wrappedRole = pdf.splitTextToSize(role, 22);
          pdf.text(wrappedRole, xpos, startY);
        });

        startY += 6;
        pdf.line(15, startY, pageWidth - 15, startY);
        startY += 6;

        pdf.setFont("helvetica", "normal");
      }

      const rowY = startY;

      // zebra stripe

      // border
      pdf.setDrawColor(200);
      pdf.rect(15, rowY - 4, pageWidth - 30, h);

      // text
      pdf.text(questionLines, x.question + 2, rowY);

      const avgVal = row.overall;
      const [ar, ag, ab] = getHeatColor(avgVal);
      const CELL_HEIGHT = h;
      const textY = rowY + CELL_HEIGHT / 2 + 2;

      pdf.setFillColor(ar, ag, ab);
      pdf.rect(x.overall, rowY - 4, 20, h, "F");
      const avgText = avgVal ? avgVal.toFixed(2) : "-";
      const avgCenterX = x.overall + 10; // 20 / 2
      pdf.text(avgText, avgCenterX, rowY + 3, { align: "center" });

      Object.entries(roleX).forEach(([role, xpos]) => {
        const val = row.roles[role];
        const [r, g, b] = getHeatColor(val);

        pdf.setFillColor(r, g, b);
        pdf.rect(xpos, rowY - 4, 30, h, "F");
        const text = val ? val.toFixed(2) : "-";
        const centerX = xpos + 15; // 30 / 2 = 15
        pdf.text(text, centerX, rowY + 3, { align: "center" });
      });

      startY += h;
    });

    y = startY + 2;

    pdf.setFontSize(10);
    pdf.text(
      `NOTE: Higher ratings appear darker in tone, with ratings colors lightening as the rating moves lower on the scale`,
      15,
      y,
    );

    addFooter();

    // =============================
    // TABLE 2 RATINGS DIFFERENTIALS - HEAT MAP (8) - LANDSCAPE
    // =============================
    newPage("l");
    addHeader(ciHeaderLogo, pageWidth);

    // always reset Y AFTER header
    startY = HEADER_HEIGHT + 6;

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Table 2: Ratings Differentials", pageWidth / 2, startY, {
      align: "center",
    });
    startY += 1;

    // DATA
    const data2 = getHeatmapData();

    const roleList2 = Object.keys(
      assessment.participants
        .filter((p) => p.completed)
        .reduce((acc, p) => {
          acc[p.role] = true;
          return acc;
        }, {}),
    );

    // COLUMN LAYOUT
    const x2 = {
      question: 15,
      questionMaxWidth: 75,
      self: 115 + shiftLeft,
    };

    const roleX2 = {};
    let xPos2 = x.overall + avgWidth + shiftLeft + 19;

    roleList2.forEach((r) => {
      if (r !== "Self") {
        roleX2[r] = xPos2;
        xPos2 += 30;
      }
    });

    const rowHeight2 = 8;

    startY += 6;

    // Self label
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");

    pdf.text("Self", x2.self + 10, startY, { align: "center" });

    // role headers
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");

    Object.entries(roleX2).forEach(([role, xpos]) => {
      const centerX = xpos + 15;
      const wrapped = pdf.splitTextToSize(role, 25);

      pdf.text(wrapped, centerX, startY, { align: "center" });
    });

    startY += 10;

    // ROWS
    pdf.setFont("helvetica", "normal");

    data2.forEach((row) => {
      const questionLines = pdf.splitTextToSize(
        row.question,
        x2.questionMaxWidth,
      );

      const h = Math.max(rowHeight2, questionLines.length * 5);

      if (startY + h > pageHeight - 30) {
        newPage("l");
        addHeader(ciHeaderLogo, pageWidth);
        startY = HEADER_HEIGHT + 10;

        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");

        pdf.text("Self", x2.self + 10, startY, { align: "center" });

        Object.entries(roleX2).forEach(([role, xpos]) => {
          pdf.text(role, xpos + 15, startY, { align: "center" });
        });

        startY += 5;
        pdf.setFont("helvetica", "normal");
      }

      const rowY = startY;

      // border
      pdf.setDrawColor(200);
      pdf.rect(15, rowY - 4, pageWidth - 30, h);

      // question
      pdf.text(questionLines, x2.question + 2, rowY);

      // SELF COLUMN (fixed color)
      const selfVal = row.roles["Self"];

      pdf.setFillColor(225, 235, 255); // constant light blue
      pdf.rect(x2.self, rowY - 4, 20, h, "F");

      pdf.text(
        selfVal != null ? selfVal.toFixed(2) : "-",
        x2.self + 10,
        rowY + 3,
        { align: "center" },
      );

      // DIFFERENTIALS (role - self)
      Object.entries(roleX2).forEach(([role, xpos]) => {
        const roleVal = row.roles[role];

        const diff =
          roleVal != null && selfVal != null ? roleVal - selfVal : null;

        const abs = Math.min(Math.abs(diff ?? 0), 3);
        const t = abs / 3;

        // symmetric blue gradient based on distance from 0
        const r = Math.round(245 - t * 140);
        const g = Math.round(250 - t * 170);
        const b = 255;

        pdf.setFillColor(r, g, b);
        pdf.rect(xpos, rowY - 4, 30, h, "F");

        pdf.text(diff != null ? diff.toFixed(2) : "-", xpos + 15, rowY + 3, {
          align: "center",
        });
      });

      startY += h;
    });

    y = startY + 2;

    pdf.setFontSize(10);
    pdf.text(
      `NOTE: Ratings color tone can be interpreted as: 
  • Lighter tones (0.00) represents ratings where both you and your raters are in alignment 
  • Darker tones with a negative (-1.00) entry represent ratings where you have rated yourself higher than your raters 
  • Darker tones with a positive (1.00) entry represent ratings where you have rated yourself lower than your raters`,
      15,
      y,
    );

    addFooter();

    // =============================
    // TABLE 3 RATING DISTRIBUTIONS - (8) - LANDSCAPE
    // =============================
    newPage("l");
    addHeader(ciHeaderLogo, pageWidth);

    let startY2 = HEADER_HEIGHT;

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");

    pdf.text("Table 3: Ratings Distribution", pageWidth / 2, startY2, {
      align: "center",
    });

    // IMPORTANT: move cursor BELOW title
    startY2 += 10;

    // IMPORTANT: define data
    const data3 = getHeatmapData();

    const chartX = 110;
    const chartWidth = 180;
    const barHeight = 8;
    const slotWidth = chartWidth / 6;
    const textX = 15;
    const textWidth = chartX - textX - 10;

    const ratingColors = {
      0: [220, 220, 220], // Not Observed → neutral grey (fixes confusion)
      1: [255, 160, 120], // Rarely → warm orange
      2: [90, 160, 100], // Inconsistent → muted green
      3: [80, 120, 255], // Generally → strong blue (shifted darker + more saturated)
      4: [200, 120, 220], // Consistently → purple
      5: [140, 200, 120], // Clear Strength → green
    };

    const legendItems = [
      "0 Not Observed",
      "1 Rarely Demonstrated",
      "2 Inconsistently Demonstrated",
      "3 Generally Demonstrated",
      "4 Consistently Demonstrated",
      "5 Clear Strength",
    ];

    data3.forEach((row) => {
      const dist = getRatingDistribution(row);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      const questionLines = pdf.splitTextToSize(row.question, textWidth);
      const lineHeight = 4;
      const textHeight = questionLines.length * lineHeight;

      const h = Math.max(barHeight + 2, textHeight);

      if (startY2 + h > pageHeight - 30) {
        newPage("l");
        addHeader(ciHeaderLogo, pageWidth);
        startY2 = HEADER_HEIGHT + 10;
      }

      const rowY = startY2;

      // =========================
      // QUESTION LABEL
      // =========================
      pdf.setFontSize(8);
      pdf.setFontSize(8);

      questionLines.forEach((line, idx) => {
        pdf.text(line, textX, rowY + idx * 4);
      });

      // =========================
      // PROPORTIONAL STACKED BAR
      // =========================
      const total = Object.values(dist).reduce((a, b) => a + b, 0);

      let currentX = chartX;

      for (let i = 0; i <= 5; i++) {
        const count = dist[i] || 0;
        const [r, g, b] = ratingColors[i];

        // skip empty categories visually (optional)
        if (total === 0 || count === 0) continue;

        const width = (count / total) * chartWidth;

        pdf.setFillColor(r, g, b);
        pdf.rect(currentX, rowY - 4, width, barHeight, "F");

        pdf.setDrawColor(255);
        pdf.rect(currentX, rowY - 4, width, barHeight);

        // label (only if wide enough so it doesn't clutter)
        if (width > 10) {
          pdf.setTextColor(0);
          pdf.setFontSize(8);
          pdf.text(String(count), currentX + width / 2, rowY + 3, {
            align: "center",
          });
        }

        currentX += width;
      }

      startY2 += h + 0.3;
    });

    pdf.setFontSize(8);
    let lx = 15;
    let ly = startY2;

    legendItems.forEach((label, i) => {
      const [r, g, b] = ratingColors[i];

      pdf.setFillColor(r, g, b);
      pdf.rect(lx, ly - 3, 5, 5, "F");

      pdf.text(label, lx + 7, ly);

      lx += 50;
    });

    y = startY;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(
      `NOTE: The above ratings distribution combines all rater groups`,
      15,
      y,
    );

    addFooter();

    // =============================
    // NARRATIVE FEEDBACK INTRO (9) - BACK TO PORTRAIT
    // =============================
    newPage("p");
    addHeader(ciHeaderLogo, pageWidth);

    // start BELOW header
    y = HEADER_HEIGHT;

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Narrative Feedback Introduction`, 20, y);
    y += 10;
    pdf.setFontSize(13);
    pdf.text(`Narrative Comments: Context and Nuance`, 20, y);

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    y += 10;

    let narrativeNuanceWords = `In addition to numeric ratings, raters were invited to provide open-ended comments. These narrative responses offer context, examples, and nuance that numbers alone cannot provide.

The comments that follow are:

• presented verbatim
• not attributed to individuals
• organized by question

As you read them, resist the urge to tally or weigh individual comments. Instead, notice:

• recurring themes or language
• contrasts in perspective
• moments of clarity or tension

Resist the urge to focus only on the highest or lowest scores. The most useful insights often live in the patterns and gaps. These comments are intended to support reflection and conversation, not to assign intent or judgement`;
    let narrativeNuanceLines = pdf.splitTextToSize(
      narrativeNuanceWords,
      portraitPageWidth - margin * 2,
    );
    pdf.text(narrativeNuanceLines, 20, y);
    y += narrativeNuanceLines.length * 6;

    addFooter();

    // =============================
    // NARRATIVE COMMENTS BEGIN (10-?)
    // =============================
    pdf.addPage();
    addHeader(ciHeaderLogo, pageWidth);

    // start BELOW header
    y = HEADER_HEIGHT;

    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text("Narrative Comments by Question", 20, y);
    y += 12;

    pdf.setTextColor(0, 0, 0);

    const textData = getTextResponses();

    Object.values(textData).forEach((q) => {
      checkPageBreak(20);

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");

      const wrappedQuestion = pdf.splitTextToSize(
        String(q.question),
        portraitPageWidth - margin * 2,
      );

      pdf.text(wrappedQuestion, 20, y);
      y += wrappedQuestion.length * 6;

      q.responses.forEach((r) => {
        checkPageBreak(18);

        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");

        const lines = pdf.splitTextToSize(
          `- ${r.text}`,
          portraitPageWidth - margin * 2,
        );

        pdf.text(lines, 25, y);
        y += lines.length * 5;
      });

      y += 6;
    });

    addFooter();

    // =============================
    // OUTRO PAGE (-1)
    // =============================
    pdf.addPage();
    addHeader(ciHeaderLogo, pageWidth);

    // start BELOW header
    y = HEADER_HEIGHT;

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Integration and Forward Reflection`, 20, y);
    y += 10;

    pdf.setFontSize(12.5);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Making Meaning of the Results`, 20, y);
    y += 10;

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");

    let outroWords = `The Clarity Index 360 is not intended to provide answers, but to invite intentional reflection and choice.

As you integrate what you have noticed in this report, consider the following questions:
• What feels most important to sit with after reviewing these results?
• Which strengths do you want to protect or build on?
• What patterns, if left unexamined, might limit your impact?
• What conversations might these results invite, with your coach, your leader, or your team?
• Where do you feel most ready to experiment or adjust your leadership approach?

The value of this report lies not in the data itself, but in how it supports ongoing learning, growth, and leadership practice.`;
    let outroWordsLines = pdf.splitTextToSize(
      outroWords,
      portraitPageWidth - margin * 2,
    );
    pdf.text(outroWordsLines, 20, y);
    y += outroWordsLines.length * 6;

    pdf.addImage(logoPhoto, "PNG", 80, 130, 45, 45, { align: "center" });
    y += 10;

    pdf.setFontSize(22);
    pdf.setFont("helvetica", "bolditalic");
    pdf.text(`Clarity creates choice.`, portraitPageWidth / 2, 188, {
      align: "center",
    });
    y += 17;
    pdf.text(`Choice creates growth.`, portraitPageWidth / 2, 203, {
      align: "center",
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
