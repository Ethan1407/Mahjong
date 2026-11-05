import unittest

import mahjong_rules
from npc_ai import choose_npc_discard


class MahjongLogicTests(unittest.TestCase):
    def test_recommend_discard_for_hand_returns_actionable_result(self):
        hand = [
            0, 1, 2, 3, 4, 5, 6, 7, 8,
            9, 10, 11, 18, 19, 20, 33
        ]
        result = mahjong_rules.recommend_discard_for_hand(hand)
        self.assertIn('tile', result)
        self.assertIn('waiting_count', result)
        self.assertIn('waiting_tiles', result)
        self.assertIsInstance(result['waiting_tiles'], list)

    def test_check_hu_accepts_standard_winning_pattern(self):
        hand = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 7]
        self.assertTrue(mahjong_rules.check_hu(hand))

    def test_choose_npc_discard_uses_rule_based_engine(self):
        hand = [0, 0, 1, 1, 2, 3, 4, 5, 6, 9, 10, 11, 18, 19, 20, 27]
        result = choose_npc_discard(hand)
        self.assertIsNotNone(result)
        self.assertIn('tile', result)
        self.assertIn('reason', result)
        self.assertGreaterEqual(result['tile'], 0)


if __name__ == '__main__':
    unittest.main()
