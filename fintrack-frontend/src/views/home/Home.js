import React from "react";
import "./Home.css";

const Home = () => {
  return (
    <div className="home-container">
      <h1>Welcome to FinTrack</h1>
      <p className="tagline">Your personal finance tracker and budget predictor. 📈</p>

      <div className="introduction">
        <p>
          FinTrack is your one-stop solution for managing personal finances. Whether you want to monitor your
          expenses, predict future spending, or receive savings advice—FinTrack helps you take control of your money
          with simplicity and ease.
        </p>
      </div>

      <div className="features">
        <h2>🔍 Key Features</h2>
        <ul>
          <li>💸 Add and track your monthly expenses</li>
          <li>📊 Visualize your spending with interactive charts</li>
          <li>🤖 Predict next month’s expenses using machine learning</li>
          <li>💡 Get personalized savings advice based on your income</li>
          <li>📁 Secure and organized financial records</li>
        </ul>
      </div>

      <div className="get-started">
        <h2>🚀 Ready to take charge of your finances?</h2>
        <p>Navigate to the <strong>View Expenses</strong> section to begin tracking your spending today!</p>
      </div>
    </div>
  );
};

export default Home;
