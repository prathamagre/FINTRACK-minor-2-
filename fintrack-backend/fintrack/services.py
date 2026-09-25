from datetime import date
from decimal import Decimal

from . import db
from .models import Expense, Goal, GoalContribution, Income


def money(value):
    return float(value or 0)


def monthly_expenses(user_id, months=12):
    # Group in Python so the same query works on SQLite and PostgreSQL.
    totals = {}
    for row in Expense.query.filter_by(user_id=user_id).all():
        period = row.date.strftime("%Y-%m")
        totals[period] = totals.get(period, Decimal("0")) + row.amount
    end = date.today().replace(day=1)
    periods = []
    year, month = end.year, end.month
    for _ in range(months):
        periods.append(f"{year:04d}-{month:02d}")
        year, month = (year - 1, 12) if month == 1 else (year, month - 1)
    periods.reverse()
    return [{"period": period, "amount": money(totals.get(period, Decimal("0")))} for period in periods]


def dashboard_data(user_id):
    today = date.today()
    period = today.strftime("%Y-%m")
    expenses = Expense.query.filter_by(user_id=user_id).order_by(Expense.date.desc(), Expense.id.desc()).all()
    incomes = Income.query.filter_by(user_id=user_id).order_by(Income.period.desc()).all()
    goals = Goal.query.filter_by(user_id=user_id).order_by(Goal.target_date).all()
    total_expenses = sum((row.amount for row in expenses), Decimal("0"))
    total_income = sum((row.amount for row in incomes), Decimal("0"))
    current_expenses = sum((row.amount for row in expenses if row.date.strftime("%Y-%m") == period), Decimal("0"))
    category_totals = {}
    for row in expenses:
        category_totals[row.category] = category_totals.get(row.category, Decimal("0")) + row.amount
    monthly = monthly_expenses(user_id)
    income_by_period = {row.period: money(row.amount) for row in incomes}
    savings = total_income - total_expenses
    return {
        "total_income": money(total_income), "total_expenses": money(total_expenses),
        "estimated_savings": money(savings),
        "savings_rate": round(money(savings) / money(total_income), 4) if total_income > 0 else None,
        "current_month": period, "current_month_expenses": money(current_expenses),
        "monthly_expenses": monthly,
        "historical_monthly_spending": monthly,
        "monthly_income": [{"period": key, "amount": amount} for key, amount in sorted(income_by_period.items())],
        "category_expenses": [{"category": key, "amount": money(value)} for key, value in sorted(category_totals.items())],
        "recent_expenses": [expense_json(row) for row in expenses[:10]],
        "recent_income": [income_json(row) for row in incomes[:10]],
        "goal_summaries": [goal_json(row) for row in goals],
    }


def savings_advice_inputs(user_id):
    """Return only calculated financial aggregates suitable for an AI request."""
    data = dashboard_data(user_id)
    return {
        "total_income": data["total_income"],
        "total_expenses": data["total_expenses"],
        "estimated_savings": data["estimated_savings"],
        "savings_rate": data["savings_rate"],
        "current_month": data["current_month"],
        "current_month_expenses": data["current_month_expenses"],
        "monthly_spending_history": data["monthly_expenses"][-6:],
        "monthly_income_history": data["monthly_income"][-6:],
        "category_expenses": data["category_expenses"],
    }


def expense_json(row):
    return {"id": row.id, "amount": money(row.amount), "category": row.category,
            "description": row.description, "date": row.date.isoformat(), "created_at": row.created_at.isoformat() + "Z"}


def income_json(row):
    return {"id": row.id, "amount": money(row.amount), "period": row.period, "created_at": row.created_at.isoformat() + "Z"}


def goal_json(row):
    return {"id": row.id, "name": row.name, "goal_type": row.goal_type,
            "target_amount": money(row.target_amount), "current_amount": money(row.current_amount),
            "target_date": row.target_date.isoformat(), "description": row.description,
            "progress_ratio": min(money(row.current_amount) / money(row.target_amount), 1),
            "created_at": row.created_at.isoformat() + "Z", "updated_at": row.updated_at.isoformat() + "Z"}


def get_owned_goal(user_id, goal_id):
    return Goal.query.filter_by(id=goal_id, user_id=user_id).first()


def goal_plan_inputs(goal, user_id):
    from datetime import date
    today = date.today()
    months_left = max((goal.target_date.year - today.year) * 12 + goal.target_date.month - today.month, 1)
    remaining = max(Decimal("0"), goal.target_amount - goal.current_amount)
    incomes = Income.query.filter_by(user_id=user_id).all()
    avg_income = sum((r.amount for r in incomes), Decimal("0")) / len(incomes) if incomes else Decimal("0")
    recent = Expense.query.filter_by(user_id=user_id).filter(Expense.date >= today.replace(day=1)).all()
    categories = {}
    for row in recent:
        categories[row.category] = categories.get(row.category, Decimal("0")) + row.amount
    return {"goal": {"name": goal.name, "goal_type": goal.goal_type, "target_amount": money(goal.target_amount),
            "current_amount": money(goal.current_amount), "remaining": money(remaining),
            "target_date": goal.target_date.isoformat(), "months_remaining": months_left,
            "progress_percentage": round(min(money(goal.current_amount) / money(goal.target_amount), 1) * 100, 1),
            "required_monthly_saving": money(remaining / months_left)},
            "average_monthly_income_from_recorded_periods": money(avg_income),
            "current_month_spending_by_category": {k: money(v) for k, v in categories.items()},
            "monthly_spending_history": monthly_expenses(user_id, months=6)}
