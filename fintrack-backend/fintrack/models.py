from datetime import datetime, timezone

from . import db


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(254), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    expenses = db.relationship("Expense", back_populates="user", cascade="all, delete-orphan")
    incomes = db.relationship("Income", back_populates="user", cascade="all, delete-orphan")
    goals = db.relationship("Goal", back_populates="user", cascade="all, delete-orphan")


class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    category = db.Column(db.String(80), nullable=False)
    description = db.Column(db.String(500), nullable=False, default="")
    date = db.Column(db.Date, nullable=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    user = db.relationship("User", back_populates="expenses")


class Income(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    period = db.Column(db.String(7), nullable=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    user = db.relationship("User", back_populates="incomes")
    __table_args__ = (db.UniqueConstraint("user_id", "period", name="uq_income_user_period"),)


class Goal(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(160), nullable=False)
    goal_type = db.Column(db.String(80), nullable=False)
    target_amount = db.Column(db.Numeric(12, 2), nullable=False)
    current_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    target_date = db.Column(db.Date, nullable=False)
    description = db.Column(db.String(1000), nullable=False, default="")
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)
    user = db.relationship("User", back_populates="goals")
    contributions = db.relationship("GoalContribution", back_populates="goal", cascade="all, delete-orphan")


class GoalContribution(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    goal_id = db.Column(db.Integer, db.ForeignKey("goal.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    contribution_date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    goal = db.relationship("Goal", back_populates="contributions")


class RevokedToken(db.Model):
    jti = db.Column(db.String(36), primary_key=True)
    expires_at = db.Column(db.DateTime, nullable=False)


class LegacyImportRecord(db.Model):
    source_key = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    imported_at = db.Column(db.DateTime, nullable=False, default=utcnow)
