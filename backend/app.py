from fastapi import FastAPI

from routes.auth_routes import router as auth_router
from routes.portfolio_routes import router as portfolio_router
from routes.action_routes import router as action_router

app = FastAPI(
    title="BNP Corporate Actions Hub"
)

app.include_router(auth_router)
app.include_router(portfolio_router)
app.include_router(action_router)

@app.get("/")
def home():
    return {
        "message": "BNP Corporate Actions Hub Running"
    }
    