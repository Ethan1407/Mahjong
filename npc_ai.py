from __future__ import annotations

from collections import Counter

import mahjong_rules


def choose_npc_discard(hand: list[int], *, preferred_tile: int | None = None) -> dict:
    """Rule-based NPC discard engine.

    This chooses a discard using backend rules instead of random fallback logic.
    It prefers tiles that are low value, duplicated, or least likely to preserve a win state.
    """
    if not hand:
        return {"tile": None, "tile_name": None, "reason": "手牌為空", "waiting_count": 0, "waiting_tiles": []}

    hand = [tile for tile in hand if 0 <= tile < 34]
    if not hand:
        return {"tile": None, "tile_name": None, "reason": "僅有花牌，無法合法出牌", "waiting_count": 0, "waiting_tiles": []}

    if preferred_tile is not None and 0 <= preferred_tile < 34 and preferred_tile in hand:
        candidate_tiles = [preferred_tile]
    else:
        counts = Counter(hand)
        candidate_tiles = sorted(set(hand), key=lambda tile: (
            -counts[tile],
            mahjong_rules.TILE_NAMES[tile],
        ))

    best_choice = {
        "tile": None,
        "tile_name": None,
        "reason": "無明顯優先棄牌",
        "waiting_count": 999,
        "waiting_tiles": [],
    }

    for tile in candidate_tiles:
        test_hand = [value for value in hand if value != tile]
        waiting_tiles = mahjong_rules.check_ready_hand(test_hand)
        score = len(waiting_tiles)

        counts = Counter(test_hand)
        score -= counts[tile] * 2

        if tile < 27:
            suit = tile // 9
            idx = tile % 9
            if idx >= 2 and (tile - 2) // 9 == suit and (tile - 2) in hand:
                score += 1
            if idx <= 6 and (tile + 1) // 9 == suit and (tile + 1) in hand:
                score += 1

        if score < best_choice["waiting_count"] or (
            score == best_choice["waiting_count"] and best_choice["tile"] is None
        ):
            best_choice = {
                "tile": tile,
                "tile_name": mahjong_rules.TILE_NAMES[tile],
                "reason": f"棄出 {mahjong_rules.TILE_NAMES[tile]} 後，保留價值較低且有較少進張。",
                "waiting_count": score,
                "waiting_tiles": waiting_tiles,
            }

    if best_choice["tile"] is None:
        fallback = min(set(hand), key=lambda value: value)
        return {
            "tile": fallback,
            "tile_name": mahjong_rules.TILE_NAMES[fallback],
            "reason": "依規則安全選擇最低價值牌作為棄牌。",
            "waiting_count": 0,
            "waiting_tiles": [],
        }

    return best_choice


def evaluate_npc_reaction(hand: list[int], incoming_tile: int) -> dict:
    """Return the highest-priority legal reaction for an NPC to the incoming discard."""
    hand = list(hand)
    can_eat = bool(mahjong_rules.check_eat(hand, incoming_tile))
    can_pong = bool(mahjong_rules.check_pong(hand, incoming_tile))
    can_kong = bool(mahjong_rules.check_kong(hand, incoming_tile))
    can_hu = False
    if len(hand) == 16:
        test_hand = hand + [incoming_tile]
        can_hu = bool(mahjong_rules.check_hu(test_hand))

    action = None
    if can_hu:
        action = 'hu'
    elif can_kong:
        action = 'kong'
    elif can_pong:
        action = 'pong'
    elif can_eat:
        action = 'eat'

    return {
        "can_eat": can_eat,
        "can_pong": can_pong,
        "can_kong": can_kong,
        "can_hu": can_hu,
        "action": action,
        "options": [
            label for label, enabled in {
                'eat': can_eat,
                'pong': can_pong,
                'kong': can_kong,
                'hu': can_hu,
            }.items() if enabled
        ],
    }
