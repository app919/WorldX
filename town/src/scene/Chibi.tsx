import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshBasicMaterial, MeshStandardMaterial, type Group, type Mesh } from 'three';
import type { AvatarLook } from '../domain/types';

/**
 * Q 版小人（软萌版）：大头、圆脸、大眼睛带高光、腮红，小短手小短脚。
 * - 性别：女生是长发 / 侧发 + 小发卷，男生是短发 + 刘海小翘毛；
 * - 着装：背带裤（OPC 粉 /【例】蓝）、西装领带、衬衫工牌、马甲、夹克、T 恤 + 背包、休闲；
 * - 动作：走路摇摇晃晃，跑步弹跳，开心时蹦蹦跳。
 */
const matCache = new Map<string, MeshStandardMaterial>();
const M = (color: string, rough = 0.82) => {
  const k = `${color}_${rough}`;
  if (!matCache.has(k)) matCache.set(k, new MeshStandardMaterial({ color, roughness: rough, metalness: 0 }));
  return matCache.get(k)!;
};
const SHOE = '#4A3A33';
const WHITE = '#FFF9F0';

export function Chibi({
  look, movingRef, happyRef, scale = 1,
}: {
  look: AvatarLook;
  movingRef?: React.MutableRefObject<number>; // 0 静止，1 走，2 跑
  happyRef?: React.MutableRefObject<number>; // 开心跳跃截止时间（秒）
  scale?: number;
}) {
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const t0 = useRef(Math.random() * 10);

  useFrame((state) => {
    const t = state.clock.elapsedTime + t0.current;
    const moving = movingRef?.current ?? 0;
    const happy = (happyRef?.current ?? 0) > performance.now() / 1000;
    const freq = moving === 2 ? 14 : 9;
    const amp = moving ? 1 : 0;
    if (body.current) {
      const bounce = moving ? Math.abs(Math.sin(t * freq * 0.5)) * (moving === 2 ? 0.22 : 0.12) : Math.sin(t * 2) * 0.02;
      const hop = happy ? Math.abs(Math.sin(t * 8)) * 0.5 : 0;
      body.current.position.y = bounce + hop;
      body.current.rotation.z = Math.sin(t * freq * 0.5) * 0.12 * amp; // 摇摇晃晃
      const sq = 1 + Math.sin(t * (moving ? freq : 2)) * (moving ? 0.04 : 0.015);
      body.current.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    }
    // 站着的时候轻轻歪头，更有灵气
    if (head.current) head.current.rotation.z = moving ? 0 : Math.sin(t * 0.9) * 0.06;
    const swing = Math.sin(t * freq * 0.5) * 0.7 * amp;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.8 + (happy ? -2.4 : 0);
    if (armR.current) armR.current.rotation.x = swing * 0.8 + (happy ? -2.4 : 0);
  });

  const outfit = look.outfit ?? 'casual';
  const female = look.gender === 'f';
  const top = look.body;
  const pants = look.pants ?? (outfit === 'casual' ? '#5A4636' : '#4B5563');
  const accent = look.accent ?? WHITE;
  // 内搭 / 袖子颜色
  const shirt = outfit === 'overalls' || outfit === 'vest' ? WHITE : top;
  const sleeve = outfit === 'overalls' ? WHITE : outfit === 'vest' ? WHITE : top;
  const legColor = outfit === 'overalls' ? top : pants;
  const skin = M(look.skin);
  const hair = M(look.hair, 0.7);

  return (
    <group scale={scale}>
      {/* 软软的影子 */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <circleGeometry args={[0.42, 24]} />
        <meshBasicMaterial color="#4A3426" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <group ref={body}>
        {/* 腿 + 小鞋子 */}
        {[-1, 1].map((sd) => (
          <group key={sd} ref={sd < 0 ? legL : legR} position={[0.13 * sd, 0.32, 0]}>
            <mesh position-y={-0.12} material={M(legColor)} castShadow><capsuleGeometry args={[0.095, 0.12, 6, 12]} /></mesh>
            <mesh position={[0, -0.27, 0.04]} scale={[1, 0.62, 1.35]} material={M(SHOE, 0.6)} castShadow><sphereGeometry args={[0.1, 14, 10]} /></mesh>
          </group>
        ))}
        {/* 身体：圆润的小豆子 */}
        <mesh position-y={0.55} material={M(outfit === 'overalls' ? shirt : top)} castShadow><capsuleGeometry args={[0.28, 0.2, 8, 18]} /></mesh>
        <Outfit kind={outfit} top={top} pants={pants} accent={accent} />
        {/* 手 */}
        {[-1, 1].map((sd) => (
          <group key={sd} ref={sd < 0 ? armL : armR} position={[0.33 * sd, 0.7, 0]} rotation-z={0.12 * sd}>
            <mesh position-y={-0.12} material={M(sleeve)} castShadow><capsuleGeometry args={[0.078, 0.12, 6, 10]} /></mesh>
            <mesh position-y={-0.25} material={skin}><sphereGeometry args={[0.075, 12, 12]} /></mesh>
          </group>
        ))}
        {/* 大头 */}
        <group ref={head} position-y={1.25}>
          <mesh castShadow scale={[1.06, 0.96, 1]} material={skin}><sphereGeometry args={[0.52, 32, 24]} /></mesh>
          {/* 小耳朵 */}
          {[-1, 1].map((sd) => <mesh key={sd} position={[0.53 * sd, -0.04, 0]} scale={[0.5, 1, 0.8]} material={skin}><sphereGeometry args={[0.09, 10, 10]} /></mesh>)}
          <Hair female={female} mat={hair} />
          <Face female={female} hairColor={look.hair} />
          <Accessory kind={look.accessory} />
        </group>
      </group>
    </group>
  );
}

function Face({ female, hairColor }: { female: boolean; hairColor: string }) {
  return (
    <group>
      {/* 大眼睛 + 两颗高光 */}
      {[-1, 1].map((sd) => (
        <group key={sd} position={[0.17 * sd, -0.05, 0.455]}>
          <mesh scale={[0.85, 1.12, 0.6]}><sphereGeometry args={[0.078, 16, 16]} /><meshStandardMaterial color="#2B211D" roughness={0.3} /></mesh>
          <mesh position={[0.022, 0.03, 0.045]}><sphereGeometry args={[0.024, 8, 8]} /><meshBasicMaterial color="#ffffff" /></mesh>
          <mesh position={[-0.02, -0.03, 0.045]}><sphereGeometry args={[0.012, 8, 8]} /><meshBasicMaterial color="#ffffff" /></mesh>
          {/* 女生：上眼线的小睫毛 */}
          {female && <mesh position={[0.06 * sd, 0.07, 0.02]} rotation-z={-0.5 * sd}><boxGeometry args={[0.05, 0.014, 0.01]} /><meshBasicMaterial color="#2B211D" /></mesh>}
          {/* 眉毛 */}
          <mesh position={[0, 0.14, 0.01]} rotation-z={0.12 * sd}><capsuleGeometry args={[0.012, 0.06, 4, 6]} /><meshStandardMaterial color={hairColor} /></mesh>
        </group>
      ))}
      {/* 腮红 */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[0.3 * sd, -0.17, 0.4]} rotation-y={0.55 * sd} scale={[1.3, 0.8, 1]}>
          <circleGeometry args={[0.065, 16]} /><meshBasicMaterial color="#F59AA0" transparent opacity={0.55} />
        </mesh>
      ))}
      {/* 小嘴：微笑 */}
      <mesh position={[0, -0.19, 0.49]} rotation-z={Math.PI}>
        <torusGeometry args={[0.035, 0.011, 6, 12, Math.PI]} /><meshBasicMaterial color="#8A4B3E" />
      </mesh>
    </group>
  );
}

function Hair({ female, mat }: { female: boolean; mat: MeshStandardMaterial }) {
  return (
    <group>
      {/* 盖在头顶的软帽形 + 后脑勺 */}
      <mesh position={[0, 0.09, -0.03]} scale={[1.1, 0.95, 1.08]} material={mat}>
        <sphereGeometry args={[0.52, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
      </mesh>
      <mesh position={[0, 0.02, -0.17]} scale={[1.06, 0.98, 0.92]} material={mat}><sphereGeometry args={[0.52, 24, 16]} /></mesh>
      {female ? (
        <>
          {/* 齐刘海 + 两侧长发 + 后面的长发 + 小发髻 */}
          <mesh position={[0, 0.3, 0.3]} rotation-x={0.5} scale={[1.6, 0.5, 0.6]} material={mat}><sphereGeometry args={[0.2, 16, 10]} /></mesh>
          {[-1, 1].map((sd) => <mesh key={sd} position={[0.44 * sd, -0.22, 0.08]} material={mat}><capsuleGeometry args={[0.1, 0.36, 6, 10]} /></mesh>)}
          <mesh position={[0, -0.32, -0.3]} scale={[1.4, 1, 0.7]} material={mat}><capsuleGeometry args={[0.24, 0.3, 8, 12]} /></mesh>
          <mesh position={[0.18, 0.5, -0.2]} material={mat}><sphereGeometry args={[0.15, 14, 12]} /></mesh>
          <mesh position={[0.3, 0.52, -0.1]} rotation-z={-0.6}><torusGeometry args={[0.06, 0.025, 6, 12]} /><meshStandardMaterial color="#F59AA0" /></mesh>
        </>
      ) : (
        <>
          {/* 斜刘海 + 头顶小翘毛 */}
          <mesh position={[-0.12, 0.3, 0.32]} rotation={[0.55, 0, 0.35]} scale={[1.5, 0.45, 0.6]} material={mat}><sphereGeometry args={[0.2, 16, 10]} /></mesh>
          <mesh position={[0.15, 0.28, 0.34]} rotation={[0.6, 0, -0.3]} scale={[1, 0.4, 0.55]} material={mat}><sphereGeometry args={[0.18, 14, 10]} /></mesh>
          <mesh position={[0.05, 0.62, 0]} rotation-z={-0.5} material={mat}><coneGeometry args={[0.05, 0.18, 8]} /></mesh>
          {[-1, 1].map((sd) => <mesh key={sd} position={[0.47 * sd, 0.05, -0.02]} scale={[0.5, 1, 0.9]} material={mat}><sphereGeometry args={[0.15, 12, 10]} /></mesh>)}
        </>
      )}
    </group>
  );
}

/** 着装细节（叠加在身体上） */
function Outfit({ kind, top, pants, accent }: { kind: NonNullable<AvatarLook['outfit']>; top: string; pants: string; accent: string }) {
  const T = useMemo(() => M(top), [top]);
  switch (kind) {
    case 'overalls':
      return (
        <group>
          {/* 裤腰 + 胸前护兜 + 两条背带 + 金色纽扣 */}
          <mesh position-y={0.43} material={T} castShadow><cylinderGeometry args={[0.3, 0.29, 0.26, 20]} /></mesh>
          <mesh position={[0, 0.66, 0.2]} rotation-x={-0.12} material={T}><boxGeometry args={[0.3, 0.24, 0.1]} /></mesh>
          <mesh position={[0, 0.66, 0.255]} rotation-x={-0.12}><boxGeometry args={[0.1, 0.07, 0.02]} /><meshStandardMaterial color={accent} /></mesh>
          {[-1, 1].map((sd) => (
            <group key={sd}>
              <mesh position={[0.13 * sd, 0.8, 0.02]} rotation-x={0.3} material={T}><boxGeometry args={[0.06, 0.36, 0.48]} /></mesh>
              <mesh position={[0.12 * sd, 0.75, 0.255]}><sphereGeometry args={[0.025, 8, 8]} /><meshStandardMaterial color="#E8C77A" metalness={0.4} roughness={0.4} /></mesh>
            </group>
          ))}
        </group>
      );
    case 'suit':
      return (
        <group>
          {/* 白衬衫 V 领 + 领带 + 翻领 */}
          <mesh position={[0, 0.72, 0.245]} rotation-x={-0.25}><boxGeometry args={[0.16, 0.2, 0.04]} /><meshStandardMaterial color={WHITE} /></mesh>
          <mesh position={[0, 0.66, 0.27]} rotation-x={-0.2}><boxGeometry args={[0.055, 0.24, 0.03]} /><meshStandardMaterial color={accent} /></mesh>
          {[-1, 1].map((sd) => <mesh key={sd} position={[0.1 * sd, 0.7, 0.25]} rotation={[-0.25, 0, 0.35 * sd]} material={M(shade(top))}><boxGeometry args={[0.06, 0.24, 0.04]} /></mesh>)}
          <mesh position-y={0.36} material={M(pants)}><cylinderGeometry args={[0.285, 0.28, 0.12, 20]} /></mesh>
        </group>
      );
    case 'office':
      return (
        <group>
          {/* 衬衫领 + 挂绳工牌 */}
          {[-1, 1].map((sd) => <mesh key={sd} position={[0.07 * sd, 0.83, 0.2]} rotation={[-0.6, 0, 0.5 * sd]}><boxGeometry args={[0.1, 0.05, 0.08]} /><meshStandardMaterial color={WHITE} /></mesh>)}
          <mesh position={[0, 0.72, 0.18]} rotation-x={Math.PI / 2 - 0.25}><torusGeometry args={[0.13, 0.008, 4, 16, Math.PI]} /><meshStandardMaterial color={accent} /></mesh>
          <mesh position={[0, 0.58, 0.29]}><boxGeometry args={[0.1, 0.13, 0.015]} /><meshStandardMaterial color={WHITE} /></mesh>
          <mesh position={[0, 0.6, 0.3]}><boxGeometry args={[0.07, 0.03, 0.01]} /><meshStandardMaterial color={accent} /></mesh>
          <mesh position-y={0.36} material={M(pants)}><cylinderGeometry args={[0.285, 0.28, 0.12, 20]} /></mesh>
        </group>
      );
    case 'vest':
      return (
        <group>
          {/* 马甲（前面露出白衬衫）+ 小领结 */}
          <mesh position-y={0.55} scale={[1.04, 1, 1.04]} material={T}><capsuleGeometry args={[0.28, 0.16, 8, 18]} /></mesh>
          <mesh position={[0, 0.66, 0.27]}><boxGeometry args={[0.1, 0.3, 0.03]} /><meshStandardMaterial color={WHITE} /></mesh>
          <mesh position={[0, 0.8, 0.26]}><boxGeometry args={[0.1, 0.05, 0.04]} /><meshStandardMaterial color={shade(top)} /></mesh>
          <mesh position-y={0.36} material={M(pants)}><cylinderGeometry args={[0.29, 0.285, 0.12, 20]} /></mesh>
        </group>
      );
    case 'jacket':
      return (
        <group>
          {/* 敞开的夹克：前面露出白 T + 立领 */}
          <mesh position={[0, 0.6, 0.27]}><boxGeometry args={[0.16, 0.34, 0.03]} /><meshStandardMaterial color={WHITE} /></mesh>
          <mesh position-y={0.82} material={M(shade(top))}><torusGeometry args={[0.16, 0.035, 6, 20]} /></mesh>
          <mesh position-y={0.36} material={M(pants)}><cylinderGeometry args={[0.29, 0.285, 0.12, 20]} /></mesh>
        </group>
      );
    case 'tee':
      return (
        <group>
          {/* 双肩小背包 */}
          <mesh position={[0, 0.6, -0.3]} material={M(accent)} castShadow><boxGeometry args={[0.36, 0.38, 0.16]} /></mesh>
          <mesh position={[0, 0.52, -0.39]} material={M(shade(accent))}><boxGeometry args={[0.24, 0.14, 0.04]} /></mesh>
          {[-1, 1].map((sd) => <mesh key={sd} position={[0.15 * sd, 0.7, 0.05]} rotation-x={0.25} material={M(shade(accent))}><boxGeometry args={[0.045, 0.34, 0.56]} /></mesh>)}
          <mesh position-y={0.36} material={M(pants)}><cylinderGeometry args={[0.285, 0.28, 0.12, 20]} /></mesh>
        </group>
      );
    default:
      return null;
  }
}

/** 稍深一点的同色（领子、包盖） */
function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.round(v * 0.78)).toString(16).padStart(2, '0');
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

function Accessory({ kind }: { kind: AvatarLook['accessory'] }) {
  const m = { roughness: 0.8 };
  switch (kind) {
    case 'beret':
      return (
        <group position={[0.06, 0.44, -0.02]} rotation-z={-0.25}>
          <mesh scale={[1, 0.35, 1]}><sphereGeometry args={[0.42, 24, 12]} /><meshStandardMaterial color="#B5654E" {...m} /></mesh>
          <mesh position-y={0.14}><sphereGeometry args={[0.04, 8, 8]} /><meshStandardMaterial color="#B5654E" {...m} /></mesh>
        </group>
      );
    case 'cap':
      return (
        <group position={[0, 0.36, 0]}>
          <mesh scale={[1.05, 0.6, 1.05]}><sphereGeometry args={[0.49, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#86A57C" {...m} /></mesh>
          <mesh position={[0, 0, 0.44]} rotation-x={0.15} scale={[1, 0.15, 0.7]}>
            <cylinderGeometry args={[0.3, 0.3, 0.2, 20, 1, false, -Math.PI / 2, Math.PI]} /><meshStandardMaterial color="#86A57C" {...m} />
          </mesh>
        </group>
      );
    case 'headphones':
      return (
        <group>
          <mesh position-y={0.12} rotation-z={Math.PI / 2} rotation-y={Math.PI / 2}><torusGeometry args={[0.55, 0.04, 8, 24, Math.PI]} /><meshStandardMaterial color="#E8C77A" {...m} /></mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0.53 * s, 0, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.13, 0.13, 0.1, 16]} /><meshStandardMaterial color="#F4EBDA" {...m} /></mesh>
          ))}
        </group>
      );
    case 'scarf':
      return <mesh position-y={-0.52} rotation-x={Math.PI / 2}><torusGeometry args={[0.27, 0.08, 10, 24]} /><meshStandardMaterial color="#F0C4C6" {...m} /></mesh>;
    case 'glasses':
      return (
        <group position={[0, -0.04, 0.5]}>
          {[-1, 1].map((s) => <mesh key={s} position={[0.17 * s, 0, 0]}><torusGeometry args={[0.1, 0.014, 8, 20]} /><meshStandardMaterial color="#4A3426" /></mesh>)}
          <mesh><boxGeometry args={[0.1, 0.014, 0.01]} /><meshStandardMaterial color="#4A3426" /></mesh>
        </group>
      );
    default:
      return null;
  }
}

/**
 * 透视轮廓：角色被建筑挡住时，以半透明的柔和轮廓显示（不改变建筑，不会闪烁）。
 * 与正常角色共用同一套动画引用，叠加在其上方渲染、忽略深度测试。
 */
export function GhostChibi(props: Parameters<typeof Chibi>[0] & { groupRef?: React.MutableRefObject<Group | null> }) {
  const g = useRef<Group | null>(null);
  const { groupRef, ...rest } = props;
  useLayoutEffect(() => {
    g.current?.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) { m.material = GHOST; m.renderOrder = 999; m.castShadow = false; m.receiveShadow = false; }
    });
  });
  return <group ref={(el) => { g.current = el; if (groupRef) groupRef.current = el; }} visible={false}><Chibi {...rest} /></group>;
}

// 只在角色被建筑挡住时显示（由 Player 根据建筑数据判断），叠加在最上层
const GHOST = new MeshBasicMaterial({ color: '#3A2618', transparent: true, opacity: 0.82, depthWrite: false, depthTest: false, toneMapped: false, fog: false });
