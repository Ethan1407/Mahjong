import asyncio
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai

import mahjong_rules
import npc_ai

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


class ActionRequest(BaseModel):
    hand: list[int]
    incoming_tile: int


class HandAnalysisRequest(BaseModel):
    hand: list[int]
    selected_tile: int


class DiscardAnalysisRequest(BaseModel):
    clicked_tile: int
    context: str


class DrawRequest(BaseModel):
    hand: list[int]
    drawn_tile: int | None = None


class NpcDiscardRequest(BaseModel):
    player_hand: list[int]
    discarded_tile: int
    npc_name: str | None = None


class NpcDecisionRequest(BaseModel):
    hand: list[int]
    npc_name: str | None = None


def tile_label(tile_id: int) -> str:
    if 0 <= tile_id < len(mahjong_rules.TILE_NAMES):
        return mahjong_rules.TILE_NAMES[tile_id]
    return str(tile_id)


def call_gemini(prompt: str, fallback: str) -> str:
    if client is None:
        return fallback
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        text = (getattr(response, "text", "") or "").strip()
        return text or fallback
    except Exception:
        return fallback


async def ask_gemini(prompt: str, fallback: str) -> str:
    return await asyncio.to_thread(call_gemini, prompt, fallback)


@app.post("/api/check-action")
async def check_action(payload: ActionRequest):
    hand = payload.hand
    incoming_tile = payload.incoming_tile

    can_eat = bool(mahjong_rules.check_eat(hand, incoming_tile))
    can_pong = bool(mahjong_rules.check_pong(hand, incoming_tile))
    can_kong = bool(mahjong_rules.check_kong(hand, incoming_tile))

    can_hu = False
    test_hand = hand + [incoming_tile]
    if len(test_hand) == 17:
        can_hu = bool(mahjong_rules.check_hu(test_hand))

    options: list[str] = []
    if can_eat:
        options.append("eat")
    if can_pong:
        options.append("pong")
    if can_kong:
        options.append("kong")
    if can_hu:
        options.append("hu")

    return {
        "can_eat": can_eat,
        "can_pong": can_pong,
        "can_kong": can_kong,
        "can_hu": can_hu,
        "options": options,
    }


@app.post("/api/player-draw")
async def player_draw(payload: DrawRequest):
    hand = list(payload.hand)
    drawn_tile = payload.drawn_tile
    if drawn_tile is not None and drawn_tile >= 0:
        hand.append(drawn_tile)

    recommendation = mahjong_rules.recommend_discard_for_hand(hand)
    tile_name = recommendation.get("tile_name") or tile_label(recommendation["tile"]) if recommendation.get("tile") is not None else "無"

    return {
        "drawn_tile": drawn_tile,
        "drawn_tile_name": tile_label(drawn_tile) if drawn_tile is not None else None,
        "hand": hand,
        "recommended_discard": recommendation,
        "recommended_tile": recommendation.get("tile"),
        "recommended_tile_name": tile_name,
        "analysis": recommendation.get("reason") or f"摸到 {tile_label(drawn_tile) if drawn_tile is not None else '牌'}，後端已計算最佳棄牌。",
    }


@app.post("/api/npc-decision")
async def npc_decision(payload: NpcDecisionRequest):
    hand = list(payload.hand)
    if not hand:
        return {"npc_name": payload.npc_name or "NPC", "discarded_tile": None, "discarded_tile_name": None, "recommended_discard": {"tile": None, "reason": "手牌為空"}, "reason": "手牌為空"}

    recommendation = npc_ai.choose_npc_discard(hand)
    discard_tile = recommendation.get("tile")
    return {
        "npc_name": payload.npc_name or "NPC",
        "discarded_tile": discard_tile,
        "discarded_tile_name": tile_label(discard_tile) if discard_tile is not None else None,
        "recommended_discard": recommendation,
        "reason": recommendation.get("reason") or "後端已依規則決定最佳棄牌。",
    }


@app.post("/api/npc-discard")
async def npc_discard(payload: NpcDiscardRequest):
    result = await check_action(ActionRequest(hand=payload.player_hand, incoming_tile=payload.discarded_tile))
    return {
        "npc_name": payload.npc_name or "NPC",
        "discarded_tile": payload.discarded_tile,
        "discarded_tile_name": tile_label(payload.discarded_tile),
        "player_hand": payload.player_hand,
        "action_result": result,
    }


@app.post("/api/npc-reaction")
async def npc_reaction(payload: ActionRequest):
    result = npc_ai.evaluate_npc_reaction(payload.hand, payload.incoming_tile)
    return result


@app.post("/api/analyze-hand")
async def analyze_hand(payload: HandAnalysisRequest):
    selected_tile = payload.selected_tile
    hand = payload.hand

    if selected_tile not in hand:
        return {
            "analysis": "所選牌不在手牌中，先確認牌面後再判定。",
            "waiting_count": 0,
            "waiting_tiles": [],
        }

    remaining = [tile for tile in hand if tile != selected_tile]
    waiting_tiles = []
    if len(remaining) == 16:
        waiting_tiles = mahjong_rules.check_ready_hand(remaining)

    if not waiting_tiles:
        fallback = f"{tile_label(selected_tile)}打出後無明顯進張，建議先保留。"
    elif len(waiting_tiles) >= 6:
        fallback = f"{tile_label(selected_tile)}打出後可聽 {len(waiting_tiles)} 張，建議打出。"
    else:
        fallback = f"{tile_label(selected_tile)}打出後只聽 {len(waiting_tiles)} 張，保留價值中。"

    prompt = (
        f"台灣麻將中，打出 {tile_label(selected_tile)} 後可聽 {len(waiting_tiles)} 張：{waiting_tiles[:10]}。"
        "請用 50 字內中文，判斷是否建議打出並說明保留價值。"
    )
    analysis = await ask_gemini(prompt, fallback)
    analysis = analysis[:50]

    return {
        "analysis": analysis,
        "waiting_count": len(waiting_tiles),
        "waiting_tiles": waiting_tiles,
    }


@app.post("/api/analyze-discard")
async def analyze_discard(payload: DiscardAnalysisRequest):
    tile_name = tile_label(payload.clicked_tile)
    prompt = (
        f"你是麻將讀牌高手，{payload.context}，對手打出 {tile_name}。"
        "請以 50 字內中文分析其可能牌型與打牌意圖。"
    )
    fallback = f"{tile_name}很可能不是主力牌，可能在保留其他花色或等待更穩定搭配。"
    analysis = await ask_gemini(prompt, fallback)

    return {"analysis": analysis[:50]}


@app.post("/api/coach")
async def get_coach_advice(state: HandAnalysisRequest):
    recommendation = mahjong_rules.recommend_discard_for_hand(state.hand)
    return {
        "recommended_discard": recommendation,
        "recommended_tile": recommendation.get("tile"),
        "recommended_tile_name": recommendation.get("tile_name"),
        "message": recommendation.get("reason") or "後端已計算最佳棄牌。",
    }


@app.get("/health")
async def health_check():
    return {"status": "ok"}