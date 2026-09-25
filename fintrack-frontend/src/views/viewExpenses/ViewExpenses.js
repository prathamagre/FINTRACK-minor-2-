import React, { useCallback, useEffect, useState } from "react";
import api from "../../api";

import ExpenseList from "../../components/expenseList/ExpenseList";
import PredictExpense from "../../components/predictExpense/PredictExpense";
import SavingsAdvice from "../../components/savingsAdvice/SavnigsAdvice";
import ExpensesChart from "../../components/expensesChart/ExpensesChart";
import AddExpense from "../../components/addExpense/AddExpense";

import "./ViewExpenses.css";

const ViewExpenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [month, setMonth] = useState("");
  const [error, setError] = useState("");

  const fetchExpenses = useCallback(async () => {
    try {
      setError("");
      const res = await api.get("/expenses", { params: month ? { month } : {} });
      setExpenses(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Could not load expenses. Please sign in and try again.");
    }
  }, [month]);

  const deleteExpense = async (id) => {
    try {
      await api.delete(`/expenses/${id}`);
      await fetchExpenses();
    } catch (err) {
      setError(err.response?.data?.error || "Could not delete expense.");
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  return (
    <div className="view-expenses-container">
      <h1>📋 View Your Expenses</h1>

      <div className="section">
        <ExpenseList expenses={expenses} month={month} onMonthChange={setMonth} onRefresh={fetchExpenses} onDelete={deleteExpense} error={error} />
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
