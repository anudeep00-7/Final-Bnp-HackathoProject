class BonusProcessor:

    def process(
        self,
        current_quantity,
        bonus_quantity
    ):

        return {
            "old_quantity":
            current_quantity,

            "new_quantity":
            current_quantity +
            bonus_quantity
        }