
import React, { useState } from 'react';
import axios from 'axios';

function AddExpense({ onAdd }) {
    const [amount, setAmount] = useState('');
    const [month, setMonth] = useState('');
    const [income, setIncome] = useState(''); // 👈 New state for income

    const handleAdd = async () => {
        if (amount && month) {
          await axios.post("http://localhost:5000/api/add-expense", {
            date: month + "-01",
            amount: parseFloat(amount),
          });
          alert("Expense Added!");
          setAmount('');
          setMonth('');
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
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
            />
            <button style={{ margin: '0 70px 0 130px',}}onClick={handleAdd}>Add Expense</button>

            <hr style={{ margin: '20px 0' }} />
        </div>
    );
}

export default AddExpense;

