import React from "react";
import "./ExpenseList.css";

const ExpenseList = ({ expenses, month, onMonthChange, onRefresh, onDelete, error }) => (
  <div className="expense-list">
    <h2>Expenses</h2>
    <div className="controls">
      <input type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} aria-label="Filter by month" />
      <button onClick={onRefresh}>View Expenses</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {expenses.length > 0 ? (
      <table>
        <thead><tr><th>Date</th><th>Amount</th><th>Category</th><th>Action</th></tr></thead>
        <tbody>{expenses.map((expense) => (
          <tr key={expense.id}>
            <td>{expense.date}</td><td>{expense.amount}</td><td>{expense.category}</td>
            <td><button type="button" onClick={() => onDelete(expense.id)}>Delete</button></td>
          </tr>
        ))}</tbody>
      </table>
    ) : (
      <p>No expenses to display. Select a month and click View Expenses.</p>
    )}
  </div>
);

export default ExpenseList;
