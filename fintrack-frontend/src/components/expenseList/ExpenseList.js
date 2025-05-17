
import React, { useState, useEffect } from "react";
import axios from "axios";
import "./ExpenseList.css";

const ExpenseList = () => {
  const [expenses, setExpenses] = useState([]);
  const [month, setMonth] = useState("");

  const fetchExpenses = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/expenses?month=${month}`);
      setExpenses(response.data);
    } catch (error) {
      console.error("Error fetching expenses:", error);
    }
  };

  const handleClearExpenses = async () => {
    try {
      await axios.post('http://localhost:5000/api/clear-expenses');
      setExpenses([]);
      alert("All expenses cleared!");
    } catch (error) {
      console.error("Error clearing expenses:", error);
    }
  };

  return (
    <div className="expense-list">
      <h2>🗓️ Expenses</h2>
      <div className="controls">
        <button onClick={fetchExpenses}>View Expenses</button>
        <button className="clear-button" onClick={handleClearExpenses}>Clear All</button>
      </div>

      {expenses.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id}>
                <td>{expense.date}</td>
                <td>{expense.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No expenses to display. Select a month and click View Expenses.</p>
      )}
    </div>
  );
};

export default ExpenseList;
