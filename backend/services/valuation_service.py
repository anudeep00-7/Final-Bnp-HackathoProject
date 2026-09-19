class ValuationService:

    def calculate_portfolio_value(self, holdings, latest_prices):

        total_value = 0

        for holding in holdings:
            security_id = holding["security_id"]
            quantity = holding["quantity"]

            market_price = latest_prices.get(
                security_id,
                0
            )

            total_value += quantity * market_price

        return total_value