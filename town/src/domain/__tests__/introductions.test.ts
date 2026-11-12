import { describe, expect, it } from 'vitest';
import { bookMeeting, canSeeContact, confirmCollab, consentContact, IntroError, respond, sendHello } from '../introductions';

describe('商务连接状态机', () => {
  const hello = () => sendHello([], 'me', 'u1').intro;

  it('完整流程：打招呼 → 接受 → 双方同意交换联系方式 → 预约 → 双方确认合作', () => {
    let i = hello();
    expect(canSeeContact(i)).toBe(false);
    i = respond(i, 'u1', true).intro;
    i = consentContact(i, 'me').intro;
    expect(canSeeContact(i)).toBe(false); // 只有一方同意
    i = consentContact(i, 'u1').intro;
    expect(canSeeContact(i)).toBe(true);
    expect(i.status).toBe('contact_exchanged');
    const b = bookMeeting(i, 'me', 30, Date.now(), '介绍');
    expect(b.meeting.durationMin).toBe(30);
    i = b.intro;
    expect(i.status).toBe('meeting_booked');
    i = confirmCollab(i, 'me').intro;
    expect(i.status).toBe('collab_proposed');
    i = confirmCollab(i, 'u1').intro;
    expect(i.status).toBe('collab_confirmed');
  });

  it('对方接受前不能交换联系方式或预约', () => {
    const i = hello();
    expect(() => consentContact(i, 'me')).toThrow(IntroError);
    expect(() => bookMeeting(i, 'me', 15, 0, '')).toThrow(IntroError);
  });

  it('只有被打招呼的一方可以接受', () => {
    expect(() => respond(hello(), 'me', true)).toThrow(IntroError);
    expect(() => respond(hello(), 'stranger', true)).toThrow(IntroError);
  });

  it('AI 分身不能代为确认合作记录', () => {
    const i = respond(hello(), 'u1', true).intro;
    expect(() => confirmCollab(i, 'agent:a1')).toThrow(/本人确认/);
  });

  it('会议时长只能是 15/30/60', () => {
    const i = respond(hello(), 'u1', true).intro;
    expect(() => bookMeeting(i, 'me', 45 as 15, 0, '')).toThrow(IntroError);
  });

  it('防骚扰：重复打招呼 / 被婉拒后 24 小时内不能再打', () => {
    const first = hello();
    expect(() => sendHello([first], 'me', 'u1')).toThrow(/已经在联系/);
    const declined = respond(first, 'u1', false).intro;
    expect(() => sendHello([declined], 'me', 'u1')).toThrow(/婉拒/);
    expect(() => sendHello([declined], 'me', 'u1', 'hi', undefined, Date.now() + 25 * 3600 * 1000)).not.toThrow();
  });

  it('每一步都产生审计记录', () => {
    const r = sendHello([], 'me', 'u1');
    expect(r.log.action).toBe('intro.sent');
    expect(respond(r.intro, 'u1', true).log.action).toBe('intro.accepted');
  });
});
