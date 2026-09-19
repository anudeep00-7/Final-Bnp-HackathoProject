import pandas as pd


class PortfolioService:

    def get_portfolios(self):

        df = pd.read_csv("data/portfolios.csv")

        return df.to_dict(
            orient="records"
        )

    def get_holdings(
        self,
        portfolio_id: str
    ):

        df = pd.read_csv(
            "data/positions.csv"
        )

        holdings = df[
            df["portfolio_id"] ==
            portfolio_id
        ]

        return holdings.to_dict(
            orient="records"
        )