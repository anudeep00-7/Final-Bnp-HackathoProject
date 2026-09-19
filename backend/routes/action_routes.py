from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class ProcessActionRequest(BaseModel):
    action_id: str

@router.get("/actions")
def get_actions():
    return [
        {
            "action_id": "CA001",
            "action_type": "DIVIDEND",
            "status": "PENDING"
        }
    ]

@router.post("/process-action")
def process_action(request: ProcessActionRequest):
    return {
        "status": "SUCCESS",
        "action_id": request.action_id
    }