/**
 * 商务连接状态机：打招呼 → 接受 → 交换联系方式 → 预约见面 → 合作记录
 *
 * 关键约束（全部有单测）：
 * - 联系方式只有在双方都同意后才可见。
 * - 合作记录必须双方确认，AI / 系统不能擅自认定。
 * - 被婉拒后不能重复骚扰（同一对用户 24 小时内不可再次打招呼）。
 * - 每次状态变化都返回审计记录。
 */
import type { AuditLog, Introduction, IntroStatus, Meeting } from './types';

export class IntroError extends Error {}

const ORDER: IntroStatus[] = ['sent', 'accepted', 'contact_exchanged', 'meeting_booked', 'collab_proposed', 'collab_confirmed'];
const at = (s: IntroStatus) => ORDER.indexOf(s);

let seq = 0;
const nid = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

function audit(actor: string, action: string, target: string, detail?: string): AuditLog {
  return { id: nid('log'), at: Date.now(), actor, action, target, detail };
}

export const DEFAULT_HELLO = '嗨，我发现我们好像有合作的可能，要不要认识一下？';

export function sendHello(
  existing: Introduction[], fromUserId: string, toUserId: string, message = DEFAULT_HELLO, relationshipId?: string, now = Date.now(),
): { intro: Introduction; log: AuditLog } {
  if (fromUserId === toUserId) throw new IntroError('不能给自己打招呼');
  const prior = existing.find(
    (i) => (i.fromUserId === fromUserId && i.toUserId === toUserId) || (i.fromUserId === toUserId && i.toUserId === fromUserId),
  );
  if (prior && prior.status !== 'declined') throw new IntroError('你们已经在联系中啦');
  if (prior && prior.status === 'declined' && now - prior.updatedAt < 24 * 3600 * 1000) {
    throw new IntroError('对方刚刚婉拒过，过一段时间再试试吧');
  }
  const intro: Introduction = {
    id: nid('intro'), fromUserId, toUserId, relationshipId, message: message.slice(0, 200),
    status: 'sent', contactConsent: { from: false, to: false }, collabConfirm: { from: false, to: false },
    createdAt: now, updatedAt: now,
  };
  return { intro, log: audit(fromUserId, 'intro.sent', toUserId) };
}

function sideOf(intro: Introduction, userId: string): 'from' | 'to' {
  if (intro.fromUserId === userId) return 'from';
  if (intro.toUserId === userId) return 'to';
  throw new IntroError('你不是这次连接的参与者');
}

export function respond(intro: Introduction, actorId: string, accept: boolean): { intro: Introduction; log: AuditLog } {
  if (sideOf(intro, actorId) !== 'to') throw new IntroError('只有被打招呼的一方可以接受或婉拒');
  if (intro.status !== 'sent') throw new IntroError('这条招呼已经处理过了');
  const next: Introduction = { ...intro, status: accept ? 'accepted' : 'declined', updatedAt: Date.now() };
  return { intro: next, log: audit(actorId, accept ? 'intro.accepted' : 'intro.declined', intro.id) };
}

/** 任一方同意交换联系方式；双方都同意后才进入 contact_exchanged */
export function consentContact(intro: Introduction, actorId: string): { intro: Introduction; log: AuditLog } {
  if (at(intro.status) < at('accepted') || intro.status === 'declined') throw new IntroError('对方接受招呼后才能交换联系方式');
  const side = sideOf(intro, actorId);
  const contactConsent = { ...intro.contactConsent, [side]: true };
  const both = contactConsent.from && contactConsent.to;
  const status: IntroStatus = both && intro.status === 'accepted' ? 'contact_exchanged' : intro.status;
  return {
    intro: { ...intro, contactConsent, status, updatedAt: Date.now() },
    log: audit(actorId, both ? 'contact.exchanged' : 'contact.consented', intro.id),
  };
}

export function canSeeContact(intro: Introduction | undefined): boolean {
  return !!intro && intro.contactConsent.from && intro.contactConsent.to;
}

export function bookMeeting(
  intro: Introduction, actorId: string, durationMin: 15 | 30 | 60, startsAt: number, topic: string,
): { intro: Introduction; meeting: Meeting; log: AuditLog } {
  sideOf(intro, actorId);
  if (at(intro.status) < at('accepted') || intro.status === 'declined') throw new IntroError('对方接受招呼后才能预约见面');
  if (![15, 30, 60].includes(durationMin)) throw new IntroError('会议时长只能是 15 / 30 / 60 分钟');
  const meeting: Meeting = {
    id: nid('meet'), introductionId: intro.id,
    hostId: actorId, guestId: actorId === intro.fromUserId ? intro.toUserId : intro.fromUserId,
    durationMin, startsAt, topic: topic.slice(0, 80), status: 'booked',
  };
  const status: IntroStatus = at(intro.status) < at('meeting_booked') ? 'meeting_booked' : intro.status;
  return { intro: { ...intro, status, updatedAt: Date.now() }, meeting, log: audit(actorId, 'meeting.booked', meeting.id, `${durationMin}min`) };
}

/** 合作记录：一方提出 → 另一方确认。actorId 不能是 agent。 */
export function confirmCollab(intro: Introduction, actorId: string): { intro: Introduction; log: AuditLog } {
  if (actorId.startsWith('agent:')) throw new IntroError('合作记录必须由本人确认，AI 分身不能代为确认');
  if (at(intro.status) < at('accepted') || intro.status === 'declined') throw new IntroError('还没有建立联系');
  const side = sideOf(intro, actorId);
  const collabConfirm = { ...intro.collabConfirm, [side]: true };
  const both = collabConfirm.from && collabConfirm.to;
  return {
    intro: { ...intro, collabConfirm, status: both ? 'collab_confirmed' : 'collab_proposed', updatedAt: Date.now() },
    log: audit(actorId, both ? 'collab.confirmed' : 'collab.proposed', intro.id),
  };
}

export const STATUS_LABEL: Record<IntroStatus, string> = {
  sent: '已打招呼，等待回应',
  accepted: '对方已接受',
  declined: '对方婉拒了',
  contact_exchanged: '已交换联系方式',
  meeting_booked: '已预约线上见面',
  collab_proposed: '等待对方确认合作记录',
  collab_confirmed: '双方确认合作 🤝',
};
