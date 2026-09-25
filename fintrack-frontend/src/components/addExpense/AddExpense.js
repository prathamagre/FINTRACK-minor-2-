import React, { useState } from 'react';
import api from '../../api';

function AddExpense({ onAdd }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('Uncategorized');
  const [error, setError] = useState('');
  const handleAdd = async () => {
    setError('');
    try {
      await api.post('/expenses', { date, amount: Number(amount), category, description: '' });
      setAmount('');
      setDate('');
      if (onAdd) onAdd();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not add expense. Please sign in and try again.');
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

      <input type="text" value={category} maxLength={80} onChange={(e) => setCategory(e.target.value)} placeholder="Category" aria-label="Expense category" />

      <button style={{ margin: '0 70px 0 130px' }} onClick={handleAdd} disabled={!amount || Number(amount) <= 0 || !date || !category.trim()}>
        Add Expense
      </button>
      {error && <p role="alert">{error}</p>}

      <hr style={{ margin: '20px 0' }} />
    </div>
  );
}

export default AddExpense;


