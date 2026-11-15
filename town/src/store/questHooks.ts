/**
 * 把已有的关键动作接到 gameEvents 上（新手任务进度、埋点共用），不改各个 store 的内部逻辑。
 * 返回错误数组的动作：空数组 = 成功；返回布尔的动作：true = 成功。
 */
import { emitGame, type GameEvent } from './gameEvents';
import { useTown } from './useTown';
import { useOpp } from './useOpp';
import { useCenter } from './useCenter';
import { useWork } from './useWork';
import './useQuests';

type AnyStore = { getState(): Record<string, unknown>; setState(p: Record<string, unknown>): void };
function wrap(store: AnyStore, key: string, ev: GameEvent | ((...a: unknown[]) => GameEvent | undefined)) {
  const orig = store.getState()[key] as (...a: unknown[]) => unknown;
  if (typeof orig !== 'function') return;
  store.setState({
    [key]: (...a: unknown[]) => {
      const r = orig(...a);
      const ok = Array.isArray(r) ? r.length === 0 : r !== false;
      const e = typeof ev === 'function' ? ev(...a) : ev;
      if (ok && e) emitGame(e);
      return r;
    },
  });
}

let done = false;
export function installQuestHooks() {
  if (done) return;
  done = true;
  const T = useTown as unknown as AnyStore, O = useOpp as unknown as AnyStore, C = useCenter as unknown as AnyStore, W = useWork as unknown as AnyStore;
  wrap(T, 'openShop', 'open_shop');
  wrap(T, 'saveProfile', 'profile');
  wrap(T, 'sayHello', 'say_hello');
  wrap(T, 'joinEvent', 'join_event');
  wrap(T, 'setTab', (tab) => (tab === 'chain' ? 'view_chain' : tab === 'center' ? 'center_service' : undefined));
  wrap(O, 'post', 'post_need');
  wrap(O, 'bid', 'bid');
  wrap(C, 'post', 'forum');
  wrap(W, 'accept', 'work');
}
