class DividendProcessor:

    def process(
        self,
        quantity,
        dividend_per_share,
        current_cash_balance
    ):

        cash_received = (
            quantity *
            dividend_per_share
        )

        return {
            "cash_received": cash_received,
            "updated_cash_balance":
            current_cash_balance +
            cash_received
        }