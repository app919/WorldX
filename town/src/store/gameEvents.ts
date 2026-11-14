/**
 * 游戏内行为事件（新手任务、成就、埋点共用）。界面上的关键动作都在这里登记一次：
 * 搜索、打个飞的、进店、聊一聊、留需求、参观【例】、报名活动、换城市……
 */
export type GameEvent =
  | 'search' | 'fly' | 'enter_shop' | 'agent_ask' | 'live_chat' | 'leave_need' | 'visit_example' | 'say_hello'
  | 'open_shop' | 'view_chain' | 'speed_match' | 'post_need' | 'bid' | 'join_event' | 'watch_event' | 'switch_city'
  | 'switch_district' | 'stroll' | 'visit_landmark' | 'view_investor' | 'center_service' | 'forum' | 'work' | 'follow_feed' | 'profile' | 'zoom';

type Listener = (e: GameEvent, meta?: Record<string, string>) => void;
const listeners = new Set<Listener>();
export function onGameEvent(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function emitGame(e: GameEvent, meta?: Record<string, string>) { for (const l of listeners) { try { l(e, meta); } catch { /* 监听器出错不影响游戏 */ } } }
