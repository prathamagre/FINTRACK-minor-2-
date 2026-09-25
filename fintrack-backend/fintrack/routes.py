import re
from datetime import date, datetime, timezone

from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt, get_jwt_identity, jwt_required
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from . import db, limiter
from .ai_service import AIService
from .models import Expense, Goal, GoalContribution, Income, RevokedToken, User
from .services import (dashboard_data, expense_json, goal_json, goal_plan_inputs,
                       income_json, money, monthly_expenses, savings_advice_inputs)
from .validation import (ValidationError, json_body, parse_amount, parse_date, parse_period,
                         required_text, valid_email)

api = Blueprint("api", __name__)


@api.errorhandler(ValidationError)
def invalid_input(error):
    return jsonify(error=str(error)), 400


def user_id():
    return int(get_jwt_identity())


def owned_or_404(model, record_id):
    row = model.query.filter_by(id=record_id, user_id=user_id()).first()
    if row is None:
        return None
    return row


@api.post("/auth/signup")
@limiter.limit("5 per hour")
def signup():
    data = json_body()
    name = required_text(data, "name", 120)
    email = required_text(data, "email", 254).lower()
    password = data.get("password")
    if not valid_email(email):
        raise ValidationError("A valid email address is required.")
    if not isinstance(password, str) or len(password) < 12 or len(password) > 128:
        raise ValidationError("Password must be between 12 and 128 characters.")
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise ValidationError("Password must include at least one letter and one number.")
    if User.query.filter_by(email=email).first():
        return jsonify(error="An account with this email already exists."), 409
    user = User(name=name, email=email, password_hash=generate_password_hash(password, method="scrypt"))
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="An account with this email already exists."), 409
    token = create_access_token(identity=str(user.id))
    return jsonify(user={"id": user.id, "name": user.name, "email": user.email}, access_token=token), 201


@api.post("/auth/login")
@limiter.limit("10 per minute")
def login():
    data = json_body()
    email = data.get("email")
    password = data.get("password")
    if not isinstance(email, str) or not valid_email(email) or not isinstance(password, str):
        raise ValidationError("A valid email and password are required.")
    user = User.query.filter_by(email=email.strip().lower()).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify(error="Invalid email or password."), 401
    return jsonify(user={"id": user.id, "name": user.name, "email": user.email},
                   access_token=create_access_token(identity=str(user.id)))


@api.get("/auth/me")
@jwt_required()
def me():
    user = db.session.get(User, user_id())
    if not user:
        return jsonify(error="User not found."), 404
    return jsonify(user={"id": user.id, "name": user.name, "email": user.email})


@api.post("/auth/logout")
@jwt_required()
def logout():
    token = get_jwt()
    db.session.add(RevokedToken(jti=token["jti"], expires_at=datetime.fromtimestamp(token["exp"], timezone.utc).replace(tzinfo=None)))
    db.session.commit()
    return jsonify(message="Logged out successfully.")


@api.get("/expenses")
@jwt_required()
def list_expenses():
    query = Expense.query.filter_by(user_id=user_id())
    if "month" in request.args:
        period = parse_period(request.args.get("month"))
        query = query.filter(db.extract("year", Expense.date) == int(period[:4]),
                             db.extract("month", Expense.date) == int(period[5:]))
    return jsonify([expense_json(row) for row in query.order_by(Expense.date.desc(), Expense.id.desc()).all()])


@api.post("/expenses")
@jwt_required()
def add_expense():
    data = json_body()
    row = Expense(user_id=user_id(), amount=parse_amount(data.get("amount")),
                  category=required_text(data, "category", 80),
                  description=required_text(data, "description", 500, optional=True),
                  date=parse_date(data.get("date")))
    db.session.add(row)
    db.session.commit()
    return jsonify(expense_json(row)), 201


@api.delete("/expenses/<int:expense_id>")
@jwt_required()
def delete_expense(expense_id):
    row = owned_or_404(Expense, expense_id)
    if not row:
        return jsonify(error="Expense not found."), 404
    db.session.delete(row)
    db.session.commit()
    return "", 204


@api.get("/income")
@jwt_required()
def list_income():
    rows = Income.query.filter_by(user_id=user_id()).order_by(Income.period.desc()).all()
    return jsonify([income_json(row) for row in rows])


@api.post("/income")
@jwt_required()
def add_income():
    data = json_body()
    period = parse_period(data.get("period"))
    row = Income(user_id=user_id(), amount=parse_amount(data.get("amount")), period=period)
    db.session.add(row)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="Income for this period already exists; update support can be added separately."), 409
    return jsonify(income_json(row)), 201


@api.put("/income/<int:income_id>")
@jwt_required()
def update_income(income_id):
    row = Income.query.filter_by(id=income_id, user_id=user_id()).first()
    if not row:
        return jsonify(error="Income record not found."), 404
    data = json_body()
    amount = parse_amount(data.get("amount"))
    period = parse_period(data.get("period"))
    duplicate = Income.query.filter(Income.user_id == user_id(), Income.period == period, Income.id != row.id).first()
    if duplicate:
        return jsonify(error="Income for this period already exists."), 409
    row.amount, row.period = amount, period
    db.session.commit()
    return jsonify(income_json(row))


@api.delete("/income/<int:income_id>")
@jwt_required()
def delete_income(income_id):
    row = Income.query.filter_by(id=income_id, user_id=user_id()).first()
    if not row:
        return jsonify(error="Income record not found."), 404
    db.session.delete(row)
    db.session.commit()
    return "", 204


@api.get("/dashboard")
@jwt_required()
def dashboard():
    return jsonify(dashboard_data(user_id()))


@api.get("/prediction/next-month")
@jwt_required()
def predict_next_month():
    history = monthly_expenses(user_id(), months=13)
    recent_history = history[-7:-1]  # six completed months; current-month partial spend is excluded
    months_with_spending = sum(1 for item in recent_history if item["amount"] > 0)
    today = date.today()
    target_period = f"{today.year + (today.month == 12):04d}-{(today.month % 12) + 1:02d}"
    if months_with_spending < 3:
        return jsonify(forecast_amount=None, target_period=target_period, historical_values=recent_history,
                       confidence="insufficient_history", message="At least three months with expenses are needed for a forecast." )
    values = [item["amount"] for item in recent_history]
    forecast = round(sum(values) / len(values), 2)
    confidence = "limited_history" if months_with_spending < 6 else "historical_average"
    return jsonify(forecast_amount=forecast, target_period=target_period, historical_values=recent_history,
                   confidence=confidence,
                   message="Forecast uses a simple average of recent monthly spending; actual expenses may differ.")


@api.get("/goals")
@jwt_required()
def list_goals():
    rows = Goal.query.filter_by(user_id=user_id()).order_by(Goal.target_date).all()
    return jsonify([goal_json(row) for row in rows])


def goal_from_data(data, goal=None):
    name = required_text(data, "name", 160)
    goal_type = required_text(data, "goal_type", 80)
    target_amount = parse_amount(data.get("target_amount"))
    current_amount = parse_amount(data.get("current_amount", 0), "current_amount", allow_zero=True)
    if current_amount > target_amount:
        raise ValidationError("current_amount cannot exceed target_amount.")
    target_date = parse_date(data.get("target_date"), "target_date")
    description = required_text(data, "description", 1000, optional=True)
    if goal:
        goal.name, goal.goal_type = name, goal_type
        goal.target_amount, goal.current_amount = target_amount, current_amount
        goal.target_date, goal.description = target_date, description
        return goal
    return Goal(user_id=user_id(), name=name, goal_type=goal_type, target_amount=target_amount,
                current_amount=current_amount, target_date=target_date, description=description)


@api.post("/goals")
@jwt_required()
def create_goal():
    row = goal_from_data(json_body())
    db.session.add(row)
    db.session.commit()
    return jsonify(goal_json(row)), 201


@api.get("/goals/<int:goal_id>")
@jwt_required()
def get_goal(goal_id):
    row = owned_or_404(Goal, goal_id)
    return (jsonify(goal_json(row)), 200) if row else (jsonify(error="Goal not found."), 404)


@api.put("/goals/<int:goal_id>")
@jwt_required()
def update_goal(goal_id):
    row = owned_or_404(Goal, goal_id)
    if not row:
        return jsonify(error="Goal not found."), 404
    goal_from_data(json_body(), row)
    db.session.commit()
    return jsonify(goal_json(row))


@api.delete("/goals/<int:goal_id>")
@jwt_required()
def delete_goal(goal_id):
    row = owned_or_404(Goal, goal_id)
    if not row:
        return jsonify(error="Goal not found."), 404
    db.session.delete(row)
    db.session.commit()
    return "", 204


@api.get("/goals/<int:goal_id>/contributions")
@jwt_required()
def list_contributions(goal_id):
    goal = owned_or_404(Goal, goal_id)
    if not goal:
        return jsonify(error="Goal not found."), 404
    return jsonify([{"id": row.id, "goal_id": row.goal_id, "amount": money(row.amount),
                     "contribution_date": row.contribution_date.isoformat(), "created_at": row.created_at.isoformat() + "Z"}
                    for row in GoalContribution.query.filter_by(goal_id=goal.id, user_id=user_id())
                    .order_by(GoalContribution.contribution_date.desc()).all()])


@api.post("/goals/<int:goal_id>/contributions")
@jwt_required()
def add_contribution(goal_id):
    goal = owned_or_404(Goal, goal_id)
    if not goal:
        return jsonify(error="Goal not found."), 404
    data = json_body()
    amount = parse_amount(data.get("amount"))
    if goal.current_amount + amount > goal.target_amount:
        raise ValidationError("Contribution would exceed the goal target amount.")
    row = GoalContribution(goal_id=goal.id, user_id=user_id(), amount=amount,
                           contribution_date=parse_date(data.get("contribution_date", date.today().isoformat()), "contribution_date"))
    goal.current_amount += amount
    db.session.add(row)
    db.session.commit()
    return jsonify(id=row.id, goal_id=goal.id, amount=money(row.amount),
                   contribution_date=row.contribution_date.isoformat(), current_amount=money(goal.current_amount)), 201


@api.delete("/goals/<int:goal_id>/contributions/<int:contribution_id>")
@jwt_required()
def delete_contribution(goal_id, contribution_id):
    goal = owned_or_404(Goal, goal_id)
    if not goal:
        return jsonify(error="Goal not found."), 404
    row = GoalContribution.query.filter_by(id=contribution_id, goal_id=goal.id, user_id=user_id()).first()
    if not row:
        return jsonify(error="Contribution not found."), 404
    goal.current_amount -= row.amount
    db.session.delete(row)
    db.session.commit()
    return "", 204


@api.post("/ai/savings-advice")
@jwt_required()
def savings_advice():
    data = savings_advice_inputs(user_id())
    result, error, status = AIService().generate_savings_advice(data)
    if error:
        return jsonify(error=error), status
    return jsonify(result)


@api.post("/ai/goals/<int:goal_id>/plan")
@jwt_required()
def plan_goal(goal_id):
    goal = owned_or_404(Goal, goal_id)
    if not goal:
        return jsonify(error="Goal not found."), 404
    result, error, status = AIService().generate_goal_plan(goal_plan_inputs(goal, user_id()))
    if error:
        return jsonify(error=error), status
    return jsonify(result)
