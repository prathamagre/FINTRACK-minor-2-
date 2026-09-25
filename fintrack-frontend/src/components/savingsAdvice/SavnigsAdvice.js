import React, { useState } from "react";
import api from "../../api";
import "./SavingsAdvice.css";

const SavingsAdvice = () => {
  const [advice, setAdvice] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    try {
      setError("");
      const response = await api.post("/ai/savings-advice", {});
      setAdvice(JSON.stringify(response.data, null, 2));
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Could not load savings advice.");
    }
  };

  return (
    <div className="savings-advice">
      <h2>💸 Get Savings Advice</h2>
      <p>Advice uses your recorded income and expenses.</p>
      <button onClick={handleSubmit}>Get Advice</button>
      {error && <p role="alert">{error}</p>}
      {advice && <div className="advice-message"><h4>Personalized Advice:</h4><pre>{advice}</pre></div>}
    </div>
  );
};

export default SavingsAdvice;
