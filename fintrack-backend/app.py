from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Connect to DB
def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

# Create Table
def create_table():
    conn = get_db_connection()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            amount REAL NOT NULL,
            month TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

create_table()

@app.route('/api/add-expense', methods=['POST'])
def add_expense():
    data = request.get_json()
    amount = data.get('amount')
    date = data.get('date')
    
    conn = get_db_connection()
    conn.execute('INSERT INTO expenses (date, amount) VALUES (?, ?)', (date, amount))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Expense added successfully!'})


@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    month = request.args.get('month')
    conn = get_db_connection()
    if month:
        expenses = conn.execute('SELECT * FROM expenses WHERE month = ?', (month,)).fetchall()
    else:
        expenses = conn.execute('SELECT * FROM expenses').fetchall()
    conn.close()
    expense_list = [dict(x) for x in expenses]
    return jsonify(expense_list)


# Predict next expense
@app.route('/api/predict', methods=['GET'])
def predict_expense():
    conn = get_db_connection()
    expenses = conn.execute('SELECT amount FROM expenses').fetchall()
    conn.close()
    amounts = [x['amount'] for x in expenses]

    if len(amounts) < 2:
        return jsonify({'message': 'Not enough data for prediction!'})

    X = np.array(range(len(amounts))).reshape(-1, 1)
    y = np.array(amounts)
    model = LinearRegression()
    model.fit(X, y)
    next_index = np.array([[len(amounts)]])
    prediction = model.predict(next_index)[0]

    return jsonify({'predicted_expense': round(prediction, 2)})

@app.route('/api/savings-advice', methods=['POST'])
def savings_advice():
    data = request.get_json()
    income = data.get('income')

    if income is None or income <= 0:
        return jsonify({'advice': 'Invalid income value provided.'}), 400

    conn = get_db_connection()
    expenses = conn.execute('SELECT amount FROM expenses').fetchall()
    conn.close()

    if not expenses:
        return jsonify({'advice': 'No expenses found. Start tracking expenses to get advice.'})

    amounts = [x['amount'] for x in expenses]
    total_expense = sum(amounts)
    avg_expense = total_expense / len(amounts)
    savings = income - avg_expense
    savings_rate = savings / income

    # Determine advice
    if savings_rate >= 0.5:
        advice = (
            "🏆 Excellent savings rate! You're saving over 50% of your income.\n"
            "- Consider investing in **SIPs** or **mutual funds** for long-term goals.\n"
            "- Allocate a portion to **index funds** or **ETFs**.\n"
            "- Review your portfolio annually and diversify."
        )
    elif savings_rate >= 0.3:
        advice = (
            "✅ Good job! You're saving a healthy portion.\n"
            "- Set up an **emergency fund** (3–6 months of expenses).\n"
            "- Consider **FDs** or **recurring deposits** for short-term goals.\n"
            "- Start a small **SIP** in a diversified mutual fund."
        )
    elif savings_rate >= 0.1:
        advice = (
            "🟡 You're saving a little, but there's room to grow.\n"
            "- Track your discretionary spending (food, subscriptions, etc).\n"
            "- Avoid lifestyle inflation and unnecessary EMIs.\n"
            "- Automate a small SIP or RD to build discipline."
        )
    else:
        advice = (
            "🚨 Warning: You're saving very little or nothing.\n"
            "- Re-evaluate fixed expenses (rent, bills).\n"
            "- Avoid high-interest debt (credit cards, personal loans).\n"
            "- Consider a **budgeting app** or envelope method.\n"
            "- Focus on building a small emergency buffer first."
        )

    return jsonify({'advice': advice})


# Clear all expenses
@app.route('/api/clear-expenses', methods=['POST'])
def clear_expenses():
    conn = get_db_connection()
    conn.execute('DELETE FROM expenses')
    conn.commit()
    conn.close()
    return jsonify({'message': 'All expenses cleared!'})


if __name__ == '__main__':
    app.run(debug=True)
