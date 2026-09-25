import React, { useState } from "react";
import api from "../../api";
import "./PredictExpense.css";

const PredictExpense = () => {
  const [forecast, setForecast] = useState(null);
  const [message, setMessage] = useState("");

  const fetchPrediction = async () => {
    try {
      const response = await api.get('/prediction/next-month');
      setForecast(response.data.forecast_amount);
      setMessage(response.data.message || "");
    } catch (error) {
      setForecast(null);
      setMessage(error.response?.data?.error || "Could not load a forecast. Please sign in and try again.");
    }
  };

  return (
    <div className="predict-expense">
      <h2>🔮 Predict Next Month's Expense</h2>
      <button onClick={fetchPrediction}>Predict Expense</button>
      {forecast !== null && <div className="prediction-result"><p>Forecast: ₹{forecast}</p></div>}
      {message && <p role="status">{message}</p>}
    </div>
  );
};

export default PredictExpense;
