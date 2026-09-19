class ReconciliationService:

    def compare(
        self,
        before_state,
        after_state
    ):

        matched = (
            before_state !=
            after_state
        )

        return {
            "matched": matched,
            "before": before_state,
            "after": after_state
        }