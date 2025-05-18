import React, { useEffect, useState } from "react";
import axios from "axios";

import ExpenseList from "../../components/expenseList/ExpenseList";
import PredictExpense from "../../components/predictExpense/PredictExpense";
import SavingsAdvice from "../../components/savingsAdvice/SavnigsAdvice";
import ExpensesChart from "../../components/expensesChart/ExpensesChart";
import AddExpense from "../../components/addExpense/AddExpense";

import "./ViewExpenses.css";

const ViewExpenses = () => {
  const [expenses, setExpenses] = useState([]);

  const fetchExpenses = async () => {
    try {
      const res = await axios.get("https://pragee6946.pythonanywhere.com/api/expenses");
      setExpenses(res.data);
    } catch (err) {
      console.error("Failed to fetch expenses", err);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  return (
    <div className="view-expenses-container">
      <h1>📋 View Your Expenses</h1>

      <div className="section">
        <ExpenseList expenses={expenses} />
        <div className="view-expenses-container">
          <div style={{ marginBottom: '30px' }}>
            <AddExpense onAdd={fetchExpenses} />
          </div>
        </div>
      </div>

      <div className="section">
        <ExpensesChart data={expenses} />
      </div>

      <div className="section">
        <PredictExpense expenses={expenses} />
      </div>

      <div className="section">
        <SavingsAdvice expenses={expenses} />
      </div>
    </div>
  );
};

export default ViewExpenses;
