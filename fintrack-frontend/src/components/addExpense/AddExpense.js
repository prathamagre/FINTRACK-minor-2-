import React, { useState } from 'react';
import axios from 'axios';

function AddExpense({ onAdd }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(''); 
  const handleAdd = async () => {
    if (amount && date) {
      const selectedMonth = date.slice(0, 7); 

      await axios.post("https://pragee6946.pythonanywhere.com/api/add-expense", {
        date: date,                 
        amount: parseFloat(amount),
        month: selectedMonth        
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


