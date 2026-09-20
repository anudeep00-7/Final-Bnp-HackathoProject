from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ai import nl_query
from database.db import get_db
from routes.auth_routes import get_current_user
from services import audit_service

router = APIRouter(tags=["audit"])


@router.get("/audit")
def get_audit(action_id: Optional[str] = None, portfolio_id: Optional[str] = None,
              db: Session = Depends(get_db), user=Depends(get_current_user)):
    if portfolio_id and not audit_service.can_view(user, portfolio_id):
        raise HTTPException(403, "This portfolio is not assigned to you")
    return audit_service.list_audit(db, user, action_id, portfolio_id)


class AskBody(BaseModel):
    question: str


@router.post("/audit/ask")
def ask(body: AskBody, db: Session = Depends(get_db), user=Depends(get_current_user)):
    try:
        return nl_query.answer(db, body.question, user)
    except ValueError as e:
        raise HTTPException(422, str(e))