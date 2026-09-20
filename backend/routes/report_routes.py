from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ai import notice_extractor
from database.db import get_db
from reports import pdf_generator, report_service
from routes.auth_routes import get_current_user
from services import audit_service

router = APIRouter(prefix="/reports", tags=["reports"])


def _load(db, user, portfolio_id):
    if not audit_service.can_view(user, portfolio_id):
        raise HTTPException(403, "This portfolio is not assigned to you")
    try:
        return report_service.build_report_data(db, portfolio_id)
    except LookupError as e:
        raise HTTPException(404, str(e))


@router.get("/{portfolio_id}/pdf")
def report_pdf(portfolio_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    data = _load(db, user, portfolio_id)
    return Response(pdf_generator.build_pdf(data), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="portfolio_{portfolio_id}_report.pdf"'})


@router.get("/{portfolio_id}/summary")
def report_summary(portfolio_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    data = _load(db, user, portfolio_id)
    return {"portfolio_id": portfolio_id, "summary": data["summary"], "totals": data["totals"]}


class NoticeBody(BaseModel):
    text: str


@router.post("/extract-notice")
def extract_notice(body: NoticeBody, db: Session = Depends(get_db), user=Depends(get_current_user)):
    securities = notice_extractor.load_securities(db=db)
    return notice_extractor.extract_notice(body.text, securities)