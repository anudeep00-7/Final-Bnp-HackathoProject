from fastapi import APIRouter
from pydantic import BaseModel
import pandas as pd

router = APIRouter()


class ProcessActionRequest(BaseModel):
    action_id: str


@router.get("/actions")
def get_actions():

    df = pd.read_csv(
        "data/corporate_actions.csv"
    )

    return df.to_dict(
        orient="records"
    )


@router.post("/process-action")
def process_action(
    request: ProcessActionRequest
):

    actions = pd.read_csv(
        "data/corporate_actions.csv"
    )

    actions.loc[
        actions["action_id"]
        == request.action_id,
        "status"
    ] = "PROCESSED"

    actions.to_csv(
        "data/corporate_actions.csv",
        index=False
    )

    return {
        "status": "SUCCESS",
        "action_id":
        request.action_id
    }