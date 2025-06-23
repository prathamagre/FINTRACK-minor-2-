import React, { useState } from 'react';
import axios from 'axios';

function AddExpense({ onAdd }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(''); // 👈 New state for full date

  const handleAdd = async () => {
    if (amount && date) {
      const selectedMonth = date.slice(0, 7); // Extract month from YYYY-MM-DD

      await axios.post("https://pragee6946.pythonanywhere.com/api/add-expense", {
        date: date,                 // Full date (e.g., "2025-06-23")
        amount: parseFloat(amount),
        month: selectedMonth        // e.g., "2025-06"
      });

      alert("Expense Added!");
      setAmount('');
      setDate('');
      if (onAdd) onAdd();
    }
  };

  return (
    <div>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Add New Expense</h2>

      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Enter Amount"
      />

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      <button style={{ margin: '0 70px 0 130px' }} onClick={handleAdd}>
        Add Expense
      </button>

      <hr style={{ margin: '20px 0' }} />
    </div>
  );
}

export default AddExpense;


