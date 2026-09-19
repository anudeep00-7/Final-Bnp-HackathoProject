class ReconciliationService:

    def compare(
        self,
        before_state,
        after_state
    ):

        return {
            "before": before_state,
            "after": after_state,
            "status": "RECONCILED"
        }