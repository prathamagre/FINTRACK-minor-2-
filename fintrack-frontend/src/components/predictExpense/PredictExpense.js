
import React, { useState } from "react";
import axios from "axios";
import "./PredictExpense.css";

const PredictExpense = () => {
  const [predictedExpense, setPredictedExpense] = useState(null);

  const fetchPrediction = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/predict');
      setPredictedExpense(response.data.predicted_expense);
    } catch (error) {
      console.error('Error fetching prediction:', error);
    }
  };

  return (
    <div className="predict-expense">
      <h2>🔮 Predict Next Month's Expense</h2>
      <button onClick={fetchPrediction}>Predict Expense</button>

      {predictedExpense !== null && (
        <div className="prediction-result">
          <p>Predicted Expense: ₹{predictedExpense}</p>
        </div>
      )}
    </div>
  );
};

export default PredictExpense;
