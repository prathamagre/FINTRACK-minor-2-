"""Import legacy rows only when explicitly invoked; source DB remains untouched."""
import argparse
import hashlib
import sqlite3
from decimal import Decimal
from pathlib import Path

from fintrack import create_app, db
from fintrack.models import Expense, LegacyImportRecord, User


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="Path to the old SQLite database.db")
    parser.add_argument("--user-id", required=True, type=int, help="Existing registered user's id")
    parser.add_argument("--dry-run", action="store_true", help="Report valid rows without importing")
    args = parser.parse_args()
    source = Path(args.source).resolve()
    if not source.is_file():
        parser.error(f"Source database does not exist: {source}")

    connection = sqlite3.connect(f"file:{source.as_posix()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    columns = {row[1] for row in connection.execute("PRAGMA table_info(expenses)")}
    if not {"id", "date", "amount"}.issubset(columns):
        parser.error("Source expenses table must contain id, date, and amount columns.")
    rows = connection.execute("SELECT id, date, amount FROM expenses ORDER BY id").fetchall()
    connection.close()

    app = create_app()
    with app.app_context():
        user = db.session.get(User, args.user_id)
        if not user:
            parser.error("No registered user has that id; sign up first.")
        valid = []
        for row in rows:
            amount = Decimal(str(row["amount"]))
            from datetime import date
            spend_date = date.fromisoformat(row["date"])
            if not amount.is_finite() or amount <= 0 or amount >= Decimal("10000000000"):
                parser.error(f"Legacy row {row['id']} has an invalid amount; no import was committed.")
            key = hashlib.sha256(f"{source}|{row['id']}|{row['date']}|{row['amount']}".encode()).hexdigest()
            valid.append((key, amount, spend_date))
        new_rows = [(key, amount, spend_date) for key, amount, spend_date in valid
                    if not db.session.get(LegacyImportRecord, key)]
        print(f"Found {len(rows)} legacy rows; {len(new_rows)} are not yet imported for user id {user.id}.")
        if args.dry_run:
            print("Dry run: no records were written.")
            return
        for key, amount, spend_date in new_rows:
            db.session.add(Expense(user_id=user.id, amount=amount, category="Uncategorized",
                                   description="Imported from legacy FINTRACK database", date=spend_date))
            db.session.add(LegacyImportRecord(source_key=key, user_id=user.id))
        db.session.commit()
        print(f"Imported {len(new_rows)} expenses. The source database was opened read-only and left unchanged.")


if __name__ == "__main__":
    main()
