
import React, { useState } from "react";
import axios from "axios";
import "./SavingsAdvice.css";

const SavingsAdvice = () => {
  const [income, setIncome] = useState("");
  const [advice, setAdvice] = useState("");

  const handleSubmit = async () => {
    if (!income) return;

    try {
      const response = await axios.post("http://localhost:5000/api/savings-advice", {
        income: parseFloat(income),
      });
      setAdvice(response.data.advice);
    } catch (error) {
      console.error("Error fetching advice:", error);
    }
  };

  return (
    <div className="savings-advice">
      <h2>💸 Get Savings Advice</h2>

      <input
        type="number"
        placeholder="Enter your income"
        value={income}
        onChange={(e) => setIncome(e.target.value)}
      />

      <button onClick={handleSubmit}>Get Advice</button>

      {advice && (
        <div className="advice-message">
          <h4>💬 Personalized Advice:</h4>
          <pre>{advice}</pre> {/* Render multiline text nicely */}
        </div>
      )}
    </div>
  );
};

export default SavingsAdvice;
