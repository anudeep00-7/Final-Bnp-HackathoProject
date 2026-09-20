"""
process_service.py — Transactional corporate-action processing engine.

Architecture:
  action_routes.py
      ↓
  ProcessService.process_action()
      ↓
  per-type _process_* methods
      ↓
  SQLAlchemy mutations inside a single open transaction
      ↓
  DB COMMIT in action_routes.py (or ROLLBACK on any exception)

AUDIT STRATEGY:
  The database trigger processing_audit (V03_triggers.sql) automatically
  writes to audit_logs on every INSERT/UPDATE to ca_processing.
  The trigger settlement_audit writes to audit_logs on every INSERT/UPDATE
  to settlements.
  This service therefore does NOT explicitly insert AuditLog rows.
  Doing so would create duplicates.

DECIMAL CONVENTION:
  All financial quantities use Python Decimal for exact arithmetic.
  Fractional shares are TRUNCATED to whole numbers using ROUND_DOWN
  unless the business rule for that action type specifies otherwise.
  Cash amounts are rounded to 6 decimal places (matches DB precision).

ELIGIBILITY CONVENTION:
  A holder is eligible for a corporate action if they held the security
  on or before the record_date (or ex_date if record_date is None).
  The latest position row with as_of_date <= eligibility_date is used.
  Zero or negative quantity positions are excluded.
"""

import datetime
import uuid
from decimal import ROUND_DOWN, Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import (
    CaElection,
    CaProcessing,
    CashBalance,
    CorporateActionEvent,
    EventTerm,
    Position,
    Price,
    Security,
    Settlement,
    User,
)

# ── Constants ────────────────────────────────────────────────────────────────
RULE_VERSION = "2.0"
ZERO = Decimal("0")
ONE = Decimal("1")
SIX_DP = Decimal("0.000001")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _d(value) -> Decimal:
    """Convert any numeric to Decimal safely."""
    if value is None:
        return ZERO
    return Decimal(str(value))


def _get_price_at(db: Session, security_id: str, effective_date) -> Optional[Decimal]:
    """
    Return the close_price of security on the most recent price_date
    that is <= effective_date.
    Returns None if no price is available (caller must handle explicitly).
    """
    row = (
        db.query(Price)
        .filter(Price.security_id == security_id, Price.price_date <= effective_date)
        .order_by(Price.price_date.desc())
        .first()
    )
    return _d(row.close_price) if row else None


def _get_eligible_positions(
    db: Session,
    security_id: str,
    eligibility_date,
) -> List[Position]:
    """
    Return the latest position for each portfolio that held security_id
    on or before eligibility_date with qty > 0, locked FOR UPDATE.

    eligibility_date: record_date or ex_date from the corporate action event.
    """
    from sqlalchemy import and_, or_

    sub = (
        db.query(
            Position.portfolio_id,
            Position.security_id,
            func.max(Position.as_of_date).label("max_date"),
        )
        .filter(
            Position.security_id == security_id,
            Position.as_of_date <= eligibility_date,
        )
        .group_by(Position.portfolio_id, Position.security_id)
        .all()
    )

    if not sub:
        return []

    conditions = []
    for row in sub:
        conditions.append(and_(
            Position.portfolio_id == row.portfolio_id,
            Position.as_of_date == row.max_date
        ))

    positions = (
        db.query(Position)
        .filter(Position.security_id == security_id)
        .filter(or_(*conditions))
        .with_for_update()
        .all()
    )
    return [p for p in positions if _d(p.qty) > ZERO]


def _cash_balance(db: Session, portfolio_id: str, currency: str) -> CashBalance:
    """Return (and lock) the cash balance row, creating one at 0 if absent."""
    bal = (
        db.query(CashBalance)
        .filter_by(portfolio_id=portfolio_id, currency=currency)
        .order_by(CashBalance.as_of_date.desc())
        .with_for_update()
        .first()
    )
    if bal is None:
        bal = CashBalance(
            portfolio_id=portfolio_id,
            currency=currency,
            balance=0,
            as_of_date=datetime.date.today(),
        )
        db.add(bal)
        db.flush()
    return bal


def _new_position_row(
    db: Session, pos: Position, new_qty: Decimal, new_avg: Decimal, as_of: datetime.date
) -> None:
    """
    Append a new position snapshot row.  The positions table is a time-series
    (PK = portfolio_id, security_id, as_of_date), so we INSERT a new row rather
    than mutating the bootstrap row.
    """
    existing = (
        db.query(Position)
        .filter_by(portfolio_id=pos.portfolio_id, security_id=pos.security_id, as_of_date=as_of)
        .first()
    )
    if existing:
        existing.qty = float(new_qty)
        existing.avg_cost = float(new_avg)
    else:
        new_row = Position(
            portfolio_id=pos.portfolio_id,
            security_id=pos.security_id,
            qty=float(new_qty),
            avg_cost=float(new_avg),
            as_of_date=as_of,
        )
        db.add(new_row)
    db.flush()


def _processing_row(
    *,
    action: CorporateActionEvent,
    pos: Position,
    user: User,
    now: datetime.datetime,
    rule_applied: str,
    eligibility_date,
    before_qty: Decimal,
    after_qty: Decimal,
    before_avg: Decimal,
    after_avg: Decimal,
    before_cash: Decimal,
    cash_movement: Decimal,
    after_cash: Decimal,
    before_mv: Decimal,
    after_mv: Decimal,
    currency: str,
    before_state: dict,
    after_state: dict,
    election_id: Optional[str] = None,
) -> CaProcessing:
    """Build a CaProcessing object with all required fields filled in."""
    before_cost_basis = before_qty * before_avg
    after_cost_basis = after_qty * after_avg
    return CaProcessing(
        ca_id=action.ca_id,
        portfolio_id=pos.portfolio_id,
        security_id=pos.security_id,
        election_id=election_id,
        status="PROCESSED",
        processing_date=now,
        effective_date=action.ex_date or now.date(),
        rule_applied=rule_applied,
        rule_version=RULE_VERSION,
        eligible_qty=float(before_qty),
        eligibility_date=eligibility_date,
        before_quantity=float(before_qty),
        after_quantity=float(after_qty),
        before_avg_cost=float(before_avg),
        after_avg_cost=float(after_avg),
        before_cost_basis=float(before_cost_basis),
        after_cost_basis=float(after_cost_basis),
        currency=currency,
        before_cash=float(before_cash),
        cash_movement=float(cash_movement),
        after_cash=float(after_cash),
        before_market_value=float(before_mv),
        after_market_value=float(after_mv),
        before_state=before_state,
        after_state=after_state,
        processed_by=user.user_id,
        created_at=now,
    )


def _cash_settlement(
    *,
    processing: CaProcessing,
    portfolio_id: str,
    security_id: str,
    leg_code: str,
    cash_movement: Decimal,
    currency: str,
    recognition_date,
    settlement_date,
    now: datetime.datetime,
) -> Settlement:
    return Settlement(
        processing_id=processing.processing_id,
        portfolio_id=portfolio_id,
        security_id=security_id,
        leg_code=leg_code,
        settlement_type="CASH",
        quantity_movement=0,
        cash_movement=float(cash_movement),
        currency=currency,
        recognition_date=recognition_date,
        settlement_date=settlement_date or recognition_date,
        status="SETTLED",
        settled_at=now,
    )


def _security_settlement(
    *,
    processing: CaProcessing,
    portfolio_id: str,
    security_id: str,
    leg_code: str,
    quantity_movement: Decimal,
    currency: str,
    recognition_date,
    settlement_date,
    now: datetime.datetime,
    cost_basis_movement: Optional[Decimal] = None,
) -> Settlement:
    return Settlement(
        processing_id=processing.processing_id,
        portfolio_id=portfolio_id,
        security_id=security_id,
        leg_code=leg_code,
        settlement_type="SECURITY",
        quantity_movement=float(quantity_movement),
        cash_movement=0,
        currency=currency,
        recognition_date=recognition_date,
        settlement_date=settlement_date or recognition_date,
        status="SETTLED",
        settled_at=now,
        cost_basis_movement=float(cost_basis_movement) if cost_basis_movement is not None else None,
    )


# ── Main service ──────────────────────────────────────────────────────────────

class ProcessService:

    def process_action(
        self, db: Session, action_id: str, user: User
    ) -> Dict[str, Any]:
        """
        Entry point.  Routes to the appropriate per-type handler.
        All mutations are inside the caller's open transaction.
        The caller (action_routes.py) commits or rolls back.
        """
        # 1. Load & lock action
        action = (
            db.query(CorporateActionEvent)
            .filter_by(ca_id=action_id)
            .with_for_update()
            .first()
        )
        if not action:
            raise ValueError(f"Action {action_id} not found")

        # 2. Status validation
        if action.status != "ACTIVE":
            raise ValueError(
                f"Action {action_id} cannot be processed (status: {action.status})"
            )

        # 3. Processing block check
        term = db.query(EventTerm).filter_by(ca_id=action_id).first()
        if term and term.processing_block_reason:
            raise ValueError(f"Action {action_id} is blocked: {term.processing_block_reason}")

        # 4. Idempotency check  (app layer — DB also enforces via partial unique index)
        if (
            db.query(CaProcessing)
            .filter_by(ca_id=action_id, status="PROCESSED")
            .filter(CaProcessing.reversal_of.is_(None))
            .first()
        ):
            raise ValueError(f"Action {action_id} has already been processed")

        now = datetime.datetime.now(datetime.timezone.utc)

        # 5. Route by type
        handlers = {
            "CASH_DIVIDEND": self._process_cash_dividend,
            "BONUS_ISSUE": self._process_bonus_issue,
            "NAME_CHANGE": self._process_name_change,
            "STOCK_SPLIT": self._process_stock_split,
            "REVERSE_SPLIT": self._process_reverse_split,
            "STOCK_DIVIDEND": self._process_stock_dividend,
            "RIGHTS_ISSUE": self._process_rights_issue,
        }
        handler = handlers.get(action.action_type)
        if handler is None:
            raise ValueError(
                f"Action type '{action.action_type}' is not yet supported for processing"
            )

        details = handler(db, action, term, user, now)

        return {
            "status": "SUCCESS",
            "action_id": action_id,
            "action_type": action.action_type,
            "processed_records": len(details),
        }

    # ── CASH DIVIDEND ────────────────────────────────────────────────────────

    def _process_cash_dividend(
        self,
        db: Session,
        action: CorporateActionEvent,
        term: Optional[EventTerm],
        user: User,
        now: datetime.datetime,
    ) -> list:
        eligibility_date = action.record_date or action.ex_date
        positions = _get_eligible_positions(db, action.security_id, eligibility_date)
        security = db.query(Security).filter_by(security_id=action.security_id).first()
        currency = security.currency
        rate = _d(action.cash_rate_per_share)
        price = _get_price_at(db, action.security_id, action.ex_date)

        results = []
        for pos in positions:
            before_qty = _d(pos.qty)
            before_avg = _d(pos.avg_cost)
            cash_received = (before_qty * rate).quantize(SIX_DP)

            bal = _cash_balance(db, pos.portfolio_id, currency)
            before_cash = _d(bal.balance)
            after_cash = before_cash + cash_received

            before_mv = (before_qty * price) if price is not None else ZERO
            after_mv = before_mv  # qty unchanged

            bal.balance = float(after_cash)
            bal.as_of_date = now.date()

            pr = _processing_row(
                action=action, pos=pos, user=user, now=now,
                rule_applied="CASH_DIVIDEND_RULE",
                eligibility_date=eligibility_date,
                before_qty=before_qty, after_qty=before_qty,
                before_avg=before_avg, after_avg=before_avg,
                before_cash=before_cash, cash_movement=cash_received, after_cash=after_cash,
                before_mv=before_mv, after_mv=after_mv,
                currency=currency,
                before_state={"cash": str(before_cash), "qty": str(before_qty)},
                after_state={"cash": str(after_cash), "qty": str(before_qty)},
            )
            db.add(pr)
            db.flush()

            stl = _cash_settlement(
                processing=pr,
                portfolio_id=pos.portfolio_id,
                security_id=action.security_id,
                leg_code="GROSS_DIV",
                cash_movement=cash_received,
                currency=currency,
                recognition_date=action.ex_date,
                settlement_date=action.pay_date or action.ex_date,
                now=now,
            )
            db.add(stl)
            db.flush()
            results.append(pr)

        return results

    # ── BONUS ISSUE ──────────────────────────────────────────────────────────

    def _process_bonus_issue(
        self,
        db: Session,
        action: CorporateActionEvent,
        term: Optional[EventTerm],
        user: User,
        now: datetime.datetime,
    ) -> list:
        """
        Rounding rule: bonus shares are truncated to whole numbers (ROUND_DOWN).
        Fractional entitlements are forfeited (no cash-in-lieu in this implementation).
        Total cost basis is preserved; avg_cost per share decreases proportionally.
        """
        eligibility_date = action.record_date or action.ex_date
        positions = _get_eligible_positions(db, action.security_id, eligibility_date)
        security = db.query(Security).filter_by(security_id=action.security_id).first()
        currency = security.currency
        ratio_n = _d(action.ratio_numerator)
        ratio_d = _d(action.ratio_denominator)
        price = _get_price_at(db, action.security_id, action.ex_date)

        results = []
        for pos in positions:
            before_qty = _d(pos.qty)
            before_avg = _d(pos.avg_cost)
            before_cost_basis = before_qty * before_avg

            # Truncate bonus shares to whole number
            raw_bonus = before_qty * ratio_n / ratio_d
            bonus_qty = raw_bonus.to_integral_value(rounding=ROUND_DOWN)
            after_qty = before_qty + bonus_qty

            # Cost basis preserved; avg_cost dilutes
            after_avg = (before_cost_basis / after_qty).quantize(SIX_DP) if after_qty > ZERO else ZERO

            before_mv = (before_qty * price) if price is not None else ZERO
            after_mv = (after_qty * price) if price is not None else ZERO

            _new_position_row(db, pos, after_qty, after_avg, now.date())

            pr = _processing_row(
                action=action, pos=pos, user=user, now=now,
                rule_applied="BONUS_ISSUE_RULE",
                eligibility_date=eligibility_date,
                before_qty=before_qty, after_qty=after_qty,
                before_avg=before_avg, after_avg=after_avg,
                before_cash=ZERO, cash_movement=ZERO, after_cash=ZERO,
                before_mv=before_mv, after_mv=after_mv,
                currency=currency,
                before_state={"qty": str(before_qty), "avg_cost": str(before_avg)},
                after_state={"qty": str(after_qty), "avg_cost": str(after_avg)},
            )
            db.add(pr)
            db.flush()

            stl = _security_settlement(
                processing=pr,
                portfolio_id=pos.portfolio_id,
                security_id=action.security_id,
                leg_code="NEW_SHARES",
                quantity_movement=bonus_qty,
                currency=currency,
                recognition_date=action.ex_date,
                settlement_date=action.pay_date or action.ex_date,
                now=now,
                cost_basis_movement=ZERO,  # bonus shares at zero marginal cost
            )
            db.add(stl)
            db.flush()
            results.append(pr)

        return results

    # ── NAME CHANGE ──────────────────────────────────────────────────────────

    def _process_name_change(
        self,
        db: Session,
        action: CorporateActionEvent,
        term: Optional[EventTerm],
        user: User,
        now: datetime.datetime,
    ) -> list:
        security = db.query(Security).filter_by(security_id=action.security_id).with_for_update().first()
        old_name = security.name

        new_name = None
        new_symbol = None
        if term:
            new_name = term.new_name
            new_symbol = term.new_symbol
        if not new_name and action.notes:
            new_name = action.notes

        if not new_name:
            raise ValueError("No new name found in event_terms for NAME_CHANGE action")

        security.name = new_name
        if new_symbol:
            security.symbol = new_symbol

        eligibility_date = action.ex_date
        positions = _get_eligible_positions(db, action.security_id, eligibility_date)

        results = []
        for pos in positions:
            before_qty = _d(pos.qty)
            before_avg = _d(pos.avg_cost)

            pr = _processing_row(
                action=action, pos=pos, user=user, now=now,
                rule_applied="NAME_CHANGE_RULE",
                eligibility_date=eligibility_date,
                before_qty=before_qty, after_qty=before_qty,
                before_avg=before_avg, after_avg=before_avg,
                before_cash=ZERO, cash_movement=ZERO, after_cash=ZERO,
                before_mv=ZERO, after_mv=ZERO,
                currency=security.currency,
                before_state={"name": old_name},
                after_state={"name": new_name},
            )
            db.add(pr)
            db.flush()
            # No settlement for a pure name change
            results.append(pr)

        return results

    # ── STOCK SPLIT ──────────────────────────────────────────────────────────

    def _process_stock_split(
        self,
        db: Session,
        action: CorporateActionEvent,
        term: Optional[EventTerm],
        user: User,
        now: datetime.datetime,
    ) -> list:
        """
        Stock split: qty multiplied by ratio_numerator/ratio_denominator.
        Example: 2-for-1 → ratio_num=2, ratio_den=1 → qty doubles.
        Avg cost per share decreases proportionally; total cost basis unchanged.
        Fractional resulting shares are truncated (ROUND_DOWN).
        """
        eligibility_date = action.record_date or action.ex_date
        positions = _get_eligible_positions(db, action.security_id, eligibility_date)
        security = db.query(Security).filter_by(security_id=action.security_id).first()
        currency = security.currency
        ratio_n = _d(action.ratio_numerator)
        ratio_d = _d(action.ratio_denominator)
        if ratio_d == ZERO:
            raise ValueError("STOCK_SPLIT ratio_denominator is zero")
        if ratio_n <= ZERO:
            raise ValueError("STOCK_SPLIT ratio_numerator must be positive")
        price = _get_price_at(db, action.security_id, action.ex_date)

        results = []
        for pos in positions:
            before_qty = _d(pos.qty)
            before_avg = _d(pos.avg_cost)
            before_cost_basis = before_qty * before_avg

            raw_after = before_qty * ratio_n / ratio_d
            after_qty = raw_after.to_integral_value(rounding=ROUND_DOWN)
            after_avg = (before_cost_basis / after_qty).quantize(SIX_DP) if after_qty > ZERO else ZERO

            before_mv = (before_qty * price) if price is not None else ZERO
            after_mv = (after_qty * price) if price is not None else ZERO

            _new_position_row(db, pos, after_qty, after_avg, now.date())

            pr = _processing_row(
                action=action, pos=pos, user=user, now=now,
                rule_applied="STOCK_SPLIT_RULE",
                eligibility_date=eligibility_date,
                before_qty=before_qty, after_qty=after_qty,
                before_avg=before_avg, after_avg=after_avg,
                before_cash=ZERO, cash_movement=ZERO, after_cash=ZERO,
                before_mv=before_mv, after_mv=after_mv,
                currency=currency,
                before_state={"qty": str(before_qty), "avg_cost": str(before_avg)},
                after_state={"qty": str(after_qty), "avg_cost": str(after_avg)},
            )
            db.add(pr)
            db.flush()

            # Security settlement for the additional shares
            additional_qty = after_qty - before_qty
            if additional_qty > ZERO:
                stl = _security_settlement(
                    processing=pr,
                    portfolio_id=pos.portfolio_id,
                    security_id=action.security_id,
                    leg_code="SPLIT_SHARES",
                    quantity_movement=additional_qty,
                    currency=currency,
                    recognition_date=action.ex_date,
                    settlement_date=action.pay_date or action.ex_date,
                    now=now,
                    cost_basis_movement=ZERO,
                )
                db.add(stl)
                db.flush()

            results.append(pr)

        return results

    # ── REVERSE SPLIT ────────────────────────────────────────────────────────

    def _process_reverse_split(
        self,
        db: Session,
        action: CorporateActionEvent,
        term: Optional[EventTerm],
        user: User,
        now: datetime.datetime,
    ) -> list:
        """
        Reverse split: qty multiplied by ratio_numerator/ratio_denominator.
        Example: 1-for-5 → ratio_num=1, ratio_den=5 → qty = old_qty / 5.
        Fractional resulting shares are truncated (ROUND_DOWN).
        Total cost basis is preserved; avg cost per share increases.
        """
        eligibility_date = action.record_date or action.ex_date
        positions = _get_eligible_positions(db, action.security_id, eligibility_date)
        security = db.query(Security).filter_by(security_id=action.security_id).first()
        currency = security.currency
        ratio_n = _d(action.ratio_numerator)
        ratio_d = _d(action.ratio_denominator)
        if ratio_d == ZERO or ratio_n == ZERO:
            raise ValueError("REVERSE_SPLIT ratio must be non-zero")
        price = _get_price_at(db, action.security_id, action.ex_date)

        results = []
        for pos in positions:
            before_qty = _d(pos.qty)
            before_avg = _d(pos.avg_cost)
            before_cost_basis = before_qty * before_avg

            raw_after = before_qty * ratio_n / ratio_d
            after_qty = raw_after.to_integral_value(rounding=ROUND_DOWN)
            after_avg = (before_cost_basis / after_qty).quantize(SIX_DP) if after_qty > ZERO else ZERO

            before_mv = (before_qty * price) if price is not None else ZERO
            after_mv = (after_qty * price) if price is not None else ZERO

            _new_position_row(db, pos, after_qty, after_avg, now.date())

            # Cancelled/eliminated shares settlement leg
            eliminated_qty = before_qty - after_qty

            pr = _processing_row(
                action=action, pos=pos, user=user, now=now,
                rule_applied="REVERSE_SPLIT_RULE",
                eligibility_date=eligibility_date,
                before_qty=before_qty, after_qty=after_qty,
                before_avg=before_avg, after_avg=after_avg,
                before_cash=ZERO, cash_movement=ZERO, after_cash=ZERO,
                before_mv=before_mv, after_mv=after_mv,
                currency=currency,
                before_state={"qty": str(before_qty), "avg_cost": str(before_avg)},
                after_state={"qty": str(after_qty), "avg_cost": str(after_avg)},
            )
            db.add(pr)
            db.flush()

            if eliminated_qty > ZERO:
                # Negative quantity_movement = shares taken away
                stl = _security_settlement(
                    processing=pr,
                    portfolio_id=pos.portfolio_id,
                    security_id=action.security_id,
                    leg_code="CONSOLIDATED_SHARES",
                    quantity_movement=-eliminated_qty,
                    currency=currency,
                    recognition_date=action.ex_date,
                    settlement_date=action.pay_date or action.ex_date,
                    now=now,
                )
                db.add(stl)
                db.flush()

            results.append(pr)

        return results

    # ── STOCK DIVIDEND ───────────────────────────────────────────────────────

    def _process_stock_dividend(
        self,
        db: Session,
        action: CorporateActionEvent,
        term: Optional[EventTerm],
        user: User,
        now: datetime.datetime,
    ) -> list:
        """
        Stock dividend: new shares distributed at ratio_num/ratio_den.
        Similar to bonus issue; no cash movement; avg cost dilutes.
        """
        eligibility_date = action.record_date or action.ex_date
        positions = _get_eligible_positions(db, action.security_id, eligibility_date)
        security = db.query(Security).filter_by(security_id=action.security_id).first()
        currency = security.currency
        ratio_n = _d(action.ratio_numerator)
        ratio_d = _d(action.ratio_denominator)
        price = _get_price_at(db, action.security_id, action.ex_date)

        results = []
        for pos in positions:
            before_qty = _d(pos.qty)
            before_avg = _d(pos.avg_cost)
            before_cost_basis = before_qty * before_avg

            raw_new = before_qty * ratio_n / ratio_d
            dividend_qty = raw_new.to_integral_value(rounding=ROUND_DOWN)
            after_qty = before_qty + dividend_qty
            after_avg = (before_cost_basis / after_qty).quantize(SIX_DP) if after_qty > ZERO else ZERO

            before_mv = (before_qty * price) if price is not None else ZERO
            after_mv = (after_qty * price) if price is not None else ZERO

            _new_position_row(db, pos, after_qty, after_avg, now.date())

            pr = _processing_row(
                action=action, pos=pos, user=user, now=now,
                rule_applied="STOCK_DIVIDEND_RULE",
                eligibility_date=eligibility_date,
                before_qty=before_qty, after_qty=after_qty,
                before_avg=before_avg, after_avg=after_avg,
                before_cash=ZERO, cash_movement=ZERO, after_cash=ZERO,
                before_mv=before_mv, after_mv=after_mv,
                currency=currency,
                before_state={"qty": str(before_qty), "avg_cost": str(before_avg)},
                after_state={"qty": str(after_qty), "avg_cost": str(after_avg)},
            )
            db.add(pr)
            db.flush()

            if dividend_qty > ZERO:
                stl = _security_settlement(
                    processing=pr,
                    portfolio_id=pos.portfolio_id,
                    security_id=action.security_id,
                    leg_code="STOCK_DIV_SHARES",
                    quantity_movement=dividend_qty,
                    currency=currency,
                    recognition_date=action.ex_date,
                    settlement_date=action.pay_date or action.ex_date,
                    now=now,
                    cost_basis_movement=ZERO,
                )
                db.add(stl)
                db.flush()

            results.append(pr)

        return results

    # ── RIGHTS ISSUE ─────────────────────────────────────────────────────────

    def _process_rights_issue(
        self,
        db: Session,
        action: CorporateActionEvent,
        term: Optional[EventTerm],
        user: User,
        now: datetime.datetime,
    ) -> list:
        """
        Rights Issue (voluntary, election-based).

        Election types:
          SUBSCRIBE  → buy up to entitled_qty new shares at subscription_price
          SELL       → sell entitlement rights (cash proceeds — simplified)
          LAPSE      → decline; no movement; audit only

        Entitlement:
          Each holder is entitled to (position_qty * ratio_n / ratio_d) rights.
          SUBSCRIBE: elected_qty <= entitlement; new_shares = elected_qty.
          SELL: elected_qty = rights to sell (simplified: cash = qty * offer/sub price).
          LAPSE: elected_qty = 0.

        Election lookup:
          If no election row exists for a portfolio, the action lapses for that portfolio.
        """
        eligibility_date = action.record_date or action.ex_date
        positions = _get_eligible_positions(db, action.security_id, eligibility_date)
        security = db.query(Security).filter_by(security_id=action.security_id).first()
        currency = security.currency
        ratio_n = _d(action.ratio_numerator)
        ratio_d = _d(action.ratio_denominator)
        sub_price = _d(action.subscription_price)
        price = _get_price_at(db, action.security_id, action.ex_date)

        results = []
        for pos in positions:
            before_qty = _d(pos.qty)
            before_avg = _d(pos.avg_cost)
            before_cost_basis = before_qty * before_avg

            # Compute entitlement (truncated)
            entitlement = (before_qty * ratio_n / ratio_d).to_integral_value(rounding=ROUND_DOWN)

            # Load election
            election = (
                db.query(CaElection)
                .filter_by(ca_id=action.ca_id, portfolio_id=pos.portfolio_id)
                .first()
            )
            if not election:
                election_id = f"EL-{uuid.uuid4().hex[:10].upper()}"
                election = CaElection(
                    election_id=election_id,
                    ca_id=action.ca_id,
                    portfolio_id=pos.portfolio_id,
                    election_type="LAPSE",
                    elected_qty=0,
                    election_date=action.election_deadline or action.pay_date or now.date(),
                    status="CONFIRMED",
                    notes="Auto-generated LAPSE due to no election"
                )
                db.add(election)
                db.flush()

            election_type = election.election_type
            elected_qty = _d(election.elected_qty) if election.elected_qty else ZERO
            election_id = election.election_id

            before_mv = (before_qty * price) if price is not None else ZERO

            if election_type == "LAPSE" or elected_qty == ZERO:
                # No movement, just audit
                after_qty = before_qty
                after_avg = before_avg
                after_cash_val = ZERO
                cash_mvt = ZERO
                after_mv = before_mv
                rule = "RIGHTS_ISSUE_LAPSE"
                bs = {"qty": str(before_qty), "election": "LAPSE"}
                as_ = {"qty": str(before_qty), "election": "LAPSE"}

                pr = _processing_row(
                    action=action, pos=pos, user=user, now=now,
                    rule_applied=rule,
                    eligibility_date=eligibility_date,
                    before_qty=before_qty, after_qty=after_qty,
                    before_avg=before_avg, after_avg=after_avg,
                    before_cash=ZERO, cash_movement=ZERO, after_cash=ZERO,
                    before_mv=before_mv, after_mv=after_mv,
                    currency=currency,
                    before_state=bs, after_state=as_,
                    election_id=election_id,
                )
                db.add(pr)
                db.flush()
                results.append(pr)

            elif election_type == "SUBSCRIBE":
                # Cap elected_qty at entitlement
                new_shares = min(elected_qty, entitlement).to_integral_value(rounding=ROUND_DOWN)
                cash_paid = (new_shares * sub_price).quantize(SIX_DP)

                after_qty = before_qty + new_shares
                # New avg cost: (old cost basis + cash paid) / new qty
                after_avg = ((before_cost_basis + cash_paid) / after_qty).quantize(SIX_DP) if after_qty > ZERO else ZERO

                after_mv = (after_qty * price) if price is not None else ZERO

                bal = _cash_balance(db, pos.portfolio_id, currency)
                before_cash = _d(bal.balance)
                after_cash = before_cash - cash_paid  # cash goes out to pay for shares
                bal.balance = float(after_cash)
                bal.as_of_date = now.date()

                _new_position_row(db, pos, after_qty, after_avg, now.date())

                pr = _processing_row(
                    action=action, pos=pos, user=user, now=now,
                    rule_applied="RIGHTS_ISSUE_SUBSCRIBE",
                    eligibility_date=eligibility_date,
                    before_qty=before_qty, after_qty=after_qty,
                    before_avg=before_avg, after_avg=after_avg,
                    before_cash=before_cash, cash_movement=-cash_paid, after_cash=after_cash,
                    before_mv=before_mv, after_mv=after_mv,
                    currency=currency,
                    before_state={"qty": str(before_qty), "cash": str(before_cash)},
                    after_state={"qty": str(after_qty), "cash": str(after_cash)},
                    election_id=election_id,
                )
                db.add(pr)
                db.flush()

                # Security leg: new shares received
                db.add(_security_settlement(
                    processing=pr,
                    portfolio_id=pos.portfolio_id,
                    security_id=action.security_id,
                    leg_code="RIGHTS_NEW_SHARES",
                    quantity_movement=new_shares,
                    currency=currency,
                    recognition_date=action.ex_date,
                    settlement_date=action.pay_date or action.ex_date,
                    now=now,
                    cost_basis_movement=cash_paid,
                ))
                db.flush()
                # Cash leg: subscription payment
                db.add(_cash_settlement(
                    processing=pr,
                    portfolio_id=pos.portfolio_id,
                    security_id=action.security_id,
                    leg_code="RIGHTS_SUBSCRIPTION",
                    cash_movement=-cash_paid,  # outflow
                    currency=currency,
                    recognition_date=action.ex_date,
                    settlement_date=action.pay_date or action.ex_date,
                    now=now,
                ))
                db.flush()
                results.append(pr)

            elif election_type == "SELL":
                # Simplified: sell entitlement at subscription_price, receive cash
                rights_to_sell = min(elected_qty, entitlement).to_integral_value(rounding=ROUND_DOWN)
                cash_received = (rights_to_sell * sub_price).quantize(SIX_DP)

                bal = _cash_balance(db, pos.portfolio_id, currency)
                before_cash = _d(bal.balance)
                after_cash = before_cash + cash_received
                bal.balance = float(after_cash)
                bal.as_of_date = now.date()

                after_mv = before_mv  # qty unchanged

                pr = _processing_row(
                    action=action, pos=pos, user=user, now=now,
                    rule_applied="RIGHTS_ISSUE_SELL",
                    eligibility_date=eligibility_date,
                    before_qty=before_qty, after_qty=before_qty,
                    before_avg=before_avg, after_avg=before_avg,
                    before_cash=before_cash, cash_movement=cash_received, after_cash=after_cash,
                    before_mv=before_mv, after_mv=after_mv,
                    currency=currency,
                    before_state={"qty": str(before_qty), "cash": str(before_cash)},
                    after_state={"qty": str(before_qty), "cash": str(after_cash)},
                    election_id=election_id,
                )
                db.add(pr)
                db.flush()

                db.add(_cash_settlement(
                    processing=pr,
                    portfolio_id=pos.portfolio_id,
                    security_id=action.security_id,
                    leg_code="RIGHTS_SELL_PROCEEDS",
                    cash_movement=cash_received,
                    currency=currency,
                    recognition_date=action.ex_date,
                    settlement_date=action.pay_date or action.ex_date,
                    now=now,
                ))
                db.flush()
                results.append(pr)

        return results

    # ── REVERSAL ─────────────────────────────────────────────────────────────

    def reverse_action(
        self, db: Session, action_id: str, user: User, reason: str
    ) -> Dict[str, Any]:
        """
        Reverse all PROCESSED ca_processing rows for action_id.
        Each reversal:
          1. Restores position qty/avg_cost to pre-processing values.
          2. Restores cash balance.
          3. Inserts a new ca_processing row with reversal_of=original.processing_id
             and exactly inverted before/after fields.
          4. The DB trigger audit_processing:
             - Creates audit_logs entries.
             - Sets original row status to REVERSED.
        """
        originals = (
            db.query(CaProcessing)
            .filter_by(ca_id=action_id, status="PROCESSED")
            .filter(CaProcessing.reversal_of.is_(None))
            .with_for_update()
            .all()
        )
        if not originals:
            raise ValueError(f"No PROCESSED records found for action {action_id}")

        now = datetime.datetime.now(datetime.timezone.utc)
        results = []

        for orig in originals:
            # --- Restore position ---
            pos = (
                db.query(Position)
                .filter_by(portfolio_id=orig.portfolio_id, security_id=orig.security_id)
                .order_by(Position.as_of_date.desc())
                .with_for_update()
                .first()
            )
            if pos is not None:
                _new_position_row(
                    db, pos,
                    new_qty=_d(orig.before_quantity),
                    new_avg=_d(orig.before_avg_cost),
                    as_of=now.date(),
                )

            # --- Restore cash ---
            if orig.cash_movement and float(orig.cash_movement) != 0:
                bal = _cash_balance(db, orig.portfolio_id, orig.currency)
                bal.balance = float(_d(bal.balance) - _d(orig.cash_movement))
                bal.as_of_date = now.date()

            # --- Insert reversal ca_processing row ---
            # Must exactly invert original (enforced by check_processing trigger)
            reversal = CaProcessing(
                ca_id=orig.ca_id,
                portfolio_id=orig.portfolio_id,
                security_id=orig.security_id,
                election_id=orig.election_id,
                status="PROCESSED",  # trigger will flip original to REVERSED
                processing_date=now,
                effective_date=orig.effective_date,
                rule_applied=orig.rule_applied,
                rule_version=orig.rule_version,
                eligible_qty=orig.eligible_qty,
                eligibility_date=orig.eligibility_date,
                # Swap before/after
                before_quantity=orig.after_quantity,
                after_quantity=orig.before_quantity,
                before_avg_cost=orig.after_avg_cost,
                after_avg_cost=orig.before_avg_cost,
                before_cost_basis=orig.after_cost_basis,
                after_cost_basis=orig.before_cost_basis,
                currency=orig.currency,
                before_cash=orig.after_cash,
                cash_movement=float(-_d(orig.cash_movement)),
                after_cash=orig.before_cash,
                before_market_value=orig.after_market_value,
                after_market_value=orig.before_market_value,
                before_receivable_value=orig.after_receivable_value,
                after_receivable_value=orig.before_receivable_value,
                before_state=orig.after_state,
                after_state=orig.before_state,
                processed_by=user.user_id,
                reversal_of=orig.processing_id,
                reversal_reason=reason,
                created_at=now,
            )
            db.add(reversal)
            db.flush()
            results.append(reversal)

        return {
            "status": "REVERSED",
            "action_id": action_id,
            "reversed_records": len(results),
        }
