import random
from collections import Counter

# ==========================================
# 1. 基礎設定與資料結構 (新增 8 張花牌)
# ==========================================
# 0~33 為標準牌，34~41 為花牌
TILE_NAMES = [
    "一萬", "二萬", "三萬", "四萬", "五萬", "六萬", "七萬", "八萬", "九萬",
    "一筒", "二筒", "三筒", "四筒", "五筒", "六筒", "七筒", "八筒", "九筒",
    "一條", "二條", "三條", "四條", "五條", "六條", "七條", "八條", "九條",
    "東風", "南風", "西風", "北風", "紅中", "青發", "白板",
    "春", "夏", "秋", "冬", "梅", "蘭", "竹", "菊"
]

def format_hand(hand: list[int]) -> list[str]:
    """將牌編號列表轉為易讀的中文牌名"""
    return [TILE_NAMES[tile] for tile in sorted(hand)]

def create_deck() -> list[int]:
    """建立一副 144 張的牌 (含 8 張花牌) 並洗牌"""
    deck = []
    # 加入標準牌 (每種 4 張)
    for tile_id in range(34):
        deck.extend([tile_id] * 4)
    # 加入花牌 (每種 1 張)
    for tile_id in range(34, 42):
        deck.append(tile_id)
        
    random.shuffle(deck)
    return deck

# ==========================================
# 2. 開局儀式：骰子、局數、發牌與補花
# ==========================================
def roll_dice() -> list[int]:
    """擲 3 顆骰子"""
    return [random.randint(1, 6) for _ in range(3)]

def get_round_name(wind_round: int, dealer_index: int) -> str:
    """取得當前局數名稱，例如：東風東局"""
    winds = ["東", "南", "西", "北"]
    return f"{winds[wind_round]}風{winds[dealer_index]}局"

def deal_initial_tiles(deck: list[int]):
    """
    發起手牌與補花機制。
    回傳: (四家手牌, 四家花牌)
    """
    players_hand = [[], [], [], []]
    players_flowers = [[], [], [], []]
    
    # 1. 正常發牌 (從牌庫前方拿牌，用 pop(0))
    for _ in range(16):
        for p in range(4):
            players_hand[p].append(deck.pop(0))
    players_hand[0].append(deck.pop(0)) # 莊家多拿第 17 張
    
    # 2. 檢查並補花 (從牌庫後方拿牌，用 pop())
    for p in range(4):
        needs_replacement = True
        while needs_replacement:
            needs_replacement = False
            # 必須複製一份陣列來迭代，以免在迴圈中移除元素導致錯誤
            for tile in players_hand[p][:]:
                if tile >= 34: # 抽到花牌
                    players_hand[p].remove(tile)
                    players_flowers[p].append(tile)
                    players_hand[p].append(deck.pop()) # 從牌山尾部補牌
                    needs_replacement = True # 補進來的牌可能還是花牌，需再次檢查

    return players_hand, players_flowers

# ==========================================
# 3. 吃、碰、槓 判定邏輯
# ==========================================
def check_pong(hand: list[int], discarded_tile: int) -> bool:
    return hand.count(discarded_tile) >= 2

def check_kong(hand: list[int], discarded_tile: int) -> bool:
    return hand.count(discarded_tile) >= 3

def check_eat(hand: list[int], discarded_tile: int) -> list[list[int]]:
    if discarded_tile >= 27: 
        return []
    suit = discarded_tile // 9 
    options = []
    
    t1, t2 = discarded_tile - 2, discarded_tile - 1
    if t1 // 9 == suit and t2 // 9 == suit and t1 in hand and t2 in hand:
        options.append([t1, t2])
            
    t1, t2 = discarded_tile - 1, discarded_tile + 1
    if t1 // 9 == suit and t2 // 9 == suit and t1 in hand and t2 in hand:
        options.append([t1, t2])
            
    t1, t2 = discarded_tile + 1, discarded_tile + 2
    if t1 // 9 == suit and t2 // 9 == suit and t1 in hand and t2 in hand:
        options.append([t1, t2])
            
    return options

# ==========================================
# 4. 胡牌與聽牌 演算法 (自動忽略花牌，僅計算 0~33)
# ==========================================
def can_form_melds(tile_counts: Counter) -> bool:
    first_tile = next((t for t in range(34) if tile_counts[t] > 0), None)
    if first_tile is None:
        return True

    if tile_counts[first_tile] >= 3:
        tile_counts[first_tile] -= 3
        if can_form_melds(tile_counts):
            tile_counts[first_tile] += 3
            return True
        tile_counts[first_tile] += 3

    is_suit = first_tile < 27
    not_end_of_suit = (first_tile % 9) <= 6
    if is_suit and not_end_of_suit:
        t2, t3 = first_tile + 1, first_tile + 2
        if tile_counts[t2] > 0 and tile_counts[t3] > 0:
            tile_counts[first_tile] -= 1
            tile_counts[t2] -= 1
            tile_counts[t3] -= 1
            if can_form_melds(tile_counts):
                tile_counts[first_tile] += 1
                tile_counts[t2] += 1
                tile_counts[t3] += 1
                return True
            tile_counts[first_tile] += 1
            tile_counts[t2] += 1
            tile_counts[t3] += 1
    return False

def check_hu(hand: list[int]) -> bool:
    if len(hand) != 17:
        return False
    counts = Counter(hand)
    for eye_candidate, count in list(counts.items()):
        if count >= 2 and eye_candidate < 34: # 雀頭不能是花牌
            counts[eye_candidate] -= 2
            if can_form_melds(counts):
                counts[eye_candidate] += 2
                return True
            counts[eye_candidate] += 2
    return False

def check_ready_hand(hand: list[int]) -> list[int]:
    if len(hand) != 16:
        return []
    waiting_tiles = []
    for candidate_tile in range(34): # 聽牌只會聽標準牌
        test_hand = hand + [candidate_tile]
        if check_hu(test_hand):
            waiting_tiles.append(candidate_tile)
    return waiting_tiles


def recommend_discard_for_hand(hand: list[int]) -> dict:
    """根據當前手牌，挑出最穩定的棄牌候選。這個判定是後端大腦的核心。"""
    if not hand:
        return {"tile": None, "tile_name": None, "waiting_count": 0, "waiting_tiles": [], "reason": "手牌為空"}

    best_choice = {
        "tile": None,
        "tile_name": None,
        "waiting_count": -1,
        "waiting_tiles": [],
        "reason": "目前無明顯好牌可棄",
    }

    unique_tiles = sorted({tile for tile in hand if 0 <= tile < 34})
    if not unique_tiles:
        return {"tile": None, "tile_name": None, "waiting_count": 0, "waiting_tiles": [], "reason": "當前手牌僅有花牌"}

    counts = Counter(hand)
    for discard_candidate in unique_tiles:
        test_hand = [tile for tile in hand if tile != discard_candidate]
        waiting_tiles = check_ready_hand(test_hand)
        score = len(waiting_tiles)

        # 額外加權：重複牌越多，越不適合保留，因為容易卡死
        duplicate_penalty = counts[discard_candidate] - 1
        score -= duplicate_penalty * 2

        # 如果候選牌與其他牌形成順子/刻子，會更高權重
        if discard_candidate < 27:
            suit_index = discard_candidate // 9
            normalized = discard_candidate % 9
            for offset in (-1, 0, 1):
                neighbor = discard_candidate + offset
                if 0 <= neighbor < 34 and neighbor // 9 == suit_index:
                    if neighbor in test_hand:
                        score += 1

        if score > best_choice["waiting_count"]:
            best_choice = {
                "tile": discard_candidate,
                "tile_name": TILE_NAMES[discard_candidate],
                "waiting_count": max(0, score),
                "waiting_tiles": waiting_tiles,
                "reason": f"棄出 {TILE_NAMES[discard_candidate]} 後，仍可聽 {max(0, score)} 張。",
            }

    if best_choice["tile"] is None:
        fallback_tile = unique_tiles[0]
        return {
            "tile": fallback_tile,
            "tile_name": TILE_NAMES[fallback_tile],
            "waiting_count": 0,
            "waiting_tiles": [],
            "reason": f"沒有明顯進張，先保留穩定牌型，暫時以 {TILE_NAMES[fallback_tile]} 為安全棄牌。",
        }

    return best_choice

# ==========================================
# 5. AI 教練決策引擎
# ==========================================
def evaluate_discards(hand: list[int]) -> dict:
    if len(hand) != 17:
        return {}
    analysis = {}
    unique_tiles = set(hand)
    for discard_candidate in unique_tiles:
        if discard_candidate >= 34: continue # 防呆：不該評估打出花牌
        test_hand = hand.copy()
        test_hand.remove(discard_candidate)
        waiting_tiles = check_ready_hand(test_hand)
        if waiting_tiles:
            analysis[discard_candidate] = waiting_tiles
    return analysis

# ==========================================
# 測試區塊 
# ==========================================
if __name__ == "__main__":
    print("=== 台灣麻將開局儀式測試 ===")
    
    # 1. 決定圈數與莊家
    wind_round = 0  # 0:東圈
    dealer = 0      # 0:玩家當莊 (東家)
    print(f"📍 當前局數：{get_round_name(wind_round, dealer)}")
    
    # 2. 擲骰子
    dices = roll_dice()
    print(f"🎲 擲骰子結果: {dices} (總和: {sum(dices)})")
    
    # 3. 洗牌與發牌
    game_deck = create_deck()
    print(f"\n洗牌完成，牌庫總共 {len(game_deck)} 張牌。")
    
    players_hands, players_flowers = deal_initial_tiles(game_deck)
    
    print("\n--- 起手牌與補花結果 ---")
    for i in range(4):
        role = "莊家" if i == 0 else f"閒家 {i}"
        print(f"\n👤 {role}:")
        if players_flowers[i]:
            print(f"   🌸 抽到花牌: {format_hand(players_flowers[i])}")
        print(f"   🀄 補完花後的手牌 ({len(players_hands[i])}張): {format_hand(players_hands[i])}")
        
    print(f"\n📦 發牌與補花結束後，牌庫剩餘: {len(game_deck)} 張")

    # ==========================================
# 6. 輪流出牌 演算法
# ==========================================
def draw_tile(deck: list[int], hand: list[int]):
    if deck:
        hand.append(deck.pop(0))

def discard_tile(hand: list[int], tile: int):
    if tile in hand:
        hand.remove(tile)

def play_round(players_hands: list[list[int]], deck: list[int]):
    for i in range(4):
        print(f"\n--- 玩家 {i} 的回合 ---")
        draw_tile(deck, players_hands[i])
        print(f"玩家 {i} 抽牌後的手牌: {format_hand(players_hands[i])}")
        
        # 簡單的出牌策略：隨機出一張牌
        discard_candidate = random.choice(players_hands[i])
        discard_tile(players_hands[i], discard_candidate)
        print(f"玩家 {i} 出牌: {TILE_NAMES[discard_candidate]}")
        print(f"玩家 {i} 出牌後的手牌: {format_hand(players_hands[i])}")

# ==========================================
# 測試區塊 
# ==========================================
if __name__ == "__main__":
    print("=== 台灣麻將開局儀式測試 ===")
    
    # ... 現有的程式碼 ...

    print("\n--- 開始輪流出牌 ---")
    play_round(players_hands, game_deck)
    print(f"\n📦 輪流出牌結束後，牌庫剩餘: {len(game_deck)} 張")