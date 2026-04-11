// src/pages/CompanyInfo.jsx
import React from "react";
import ci360logo from "../assets/ClarityIndex360_Primary_4000px.png";

export default function SurveyOutro() {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <img src={ci360logo} alt="Clarity Index 360" style={styles.logo} />
        <h1 style={styles.title}>
          Thank you for completing the 360 survey!
        </h1>

        <p style={styles.text}>
          Your input contributes to meaningful leadership insight and
          development.
        </p>

        <p style={styles.text}>
          To learn more about the Clarity Index 360™, or how to bring this
          process into your organization, click the link below.
        </p>

        <a
          href="https://leblancleadership.ca/clarity-index-360"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.linkButton}
        >
          Learn More
        </a>
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
    marginTop: "80px",
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
    overflow: "hidden",
  },

  title: {
    marginBottom: "20px",
  },

  text: {
    lineHeight: "1.6",
    marginBottom: "16px",
  },

  linkButton: {
    display: "inline-block",
    marginTop: "20px",
    padding: "12px 24px",
    fontSize: "16px",
    borderRadius: "8px",
    backgroundColor: "#1bc95e",
    color: "#fff",
    textDecoration: "none",
    fontWeight: "bold",
  },
};
