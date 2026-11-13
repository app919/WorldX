import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshBasicMaterial, type Group, type Mesh } from 'three';
import type { AvatarLook } from '../domain/types';

/**
 * Q 版小人：大头、小身体、短手短脚，柔软圆润。
 * 动作：走路摇摇晃晃，跑步弹跳，开心时蹦蹦跳。
 */
export function Chibi({
  look, movingRef, happyRef, scale = 1,
}: {
  look: AvatarLook;
  movingRef?: React.MutableRefObject<number>; // 0 静止，1 走，2 跑
  happyRef?: React.MutableRefObject<number>; // 开心跳跃截止时间（秒）
  scale?: number;
}) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const t0 = useRef(Math.random() * 10);

  useFrame((state, dt) => {
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
      // 呼吸感 squash & stretch
      const sq = 1 + Math.sin(t * (moving ? freq : 2)) * (moving ? 0.04 : 0.015);
      body.current.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    }
    const swing = Math.sin(t * freq * 0.5) * 0.7 * amp;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.8 + (happy ? -2.4 : 0);
    if (armR.current) armR.current.rotation.x = swing * 0.8 + (happy ? -2.4 : 0);
    void dt;
  });

  const mat = { roughness: 0.85, metalness: 0 };
  return (
    <group ref={root} scale={scale}>
      {/* 软软的影子 */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <circleGeometry args={[0.42, 24]} />
        <meshBasicMaterial color="#4A3426" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <group ref={body}>
        {/* 腿 */}
        <group ref={legL} position={[-0.14, 0.3, 0]}>
          <mesh position-y={-0.14} castShadow>
            <capsuleGeometry args={[0.09, 0.12, 6, 12]} />
            <meshStandardMaterial color="#5A4636" {...mat} />
          </mesh>
        </group>
        <group ref={legR} position={[0.14, 0.3, 0]}>
          <mesh position-y={-0.14} castShadow>
            <capsuleGeometry args={[0.09, 0.12, 6, 12]} />
            <meshStandardMaterial color="#5A4636" {...mat} />
          </mesh>
        </group>
        {/* 身体：圆润的小豆子 */}
        <mesh position-y={0.52} castShadow>
          <capsuleGeometry args={[0.27, 0.22, 8, 18]} />
          <meshStandardMaterial color={look.body} {...mat} />
        </mesh>
        {/* 手 */}
        <group ref={armL} position={[-0.32, 0.66, 0]}>
          <mesh position-y={-0.12} castShadow>
            <capsuleGeometry args={[0.075, 0.12, 6, 10]} />
            <meshStandardMaterial color={look.body} {...mat} />
          </mesh>
          <mesh position-y={-0.24}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial color={look.skin} {...mat} />
          </mesh>
        </group>
        <group ref={armR} position={[0.32, 0.66, 0]}>
          <mesh position-y={-0.12} castShadow>
            <capsuleGeometry args={[0.075, 0.12, 6, 10]} />
            <meshStandardMaterial color={look.body} {...mat} />
          </mesh>
          <mesh position-y={-0.24}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial color={look.skin} {...mat} />
          </mesh>
        </group>
        {/* 大头 */}
        <group position-y={1.2}>
          <mesh castShadow>
            <sphereGeometry args={[0.5, 32, 24]} />
            <meshStandardMaterial color={look.skin} {...mat} />
          </mesh>
          {/* 头发：盖在头顶的软帽形 */}
          <mesh position={[0, 0.08, -0.04]} scale={[1.06, 0.92, 1.06]}>
            <sphereGeometry args={[0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
            <meshStandardMaterial color={look.hair} {...mat} />
          </mesh>
          <mesh position={[0, 0.02, -0.18]} scale={[1.02, 0.95, 0.9]}>
            <sphereGeometry args={[0.5, 24, 16]} />
            <meshStandardMaterial color={look.hair} {...mat} />
          </mesh>
          {/* 眼睛 */}
          <mesh position={[-0.16, -0.04, 0.46]}>
            <sphereGeometry args={[0.055, 12, 12]} />
            <meshStandardMaterial color="#2E2420" roughness={0.4} />
          </mesh>
          <mesh position={[0.16, -0.04, 0.46]}>
            <sphereGeometry args={[0.055, 12, 12]} />
            <meshStandardMaterial color="#2E2420" roughness={0.4} />
          </mesh>
          <mesh position={[-0.145, -0.015, 0.505]}>
            <sphereGeometry args={[0.017, 8, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.175, -0.015, 0.505]}>
            <sphereGeometry args={[0.017, 8, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* 腮红 */}
          <mesh position={[-0.28, -0.14, 0.4]} rotation-y={-0.5}>
            <circleGeometry args={[0.07, 16]} />
            <meshBasicMaterial color="#F0A9A9" transparent opacity={0.6} />
          </mesh>
          <mesh position={[0.28, -0.14, 0.4]} rotation-y={0.5}>
            <circleGeometry args={[0.07, 16]} />
            <meshBasicMaterial color="#F0A9A9" transparent opacity={0.6} />
          </mesh>
          {/* 小嘴 */}
          <mesh position={[0, -0.16, 0.48]} rotation-x={0.2}>
            <torusGeometry args={[0.04, 0.012, 6, 12, Math.PI]} />
            <meshBasicMaterial color="#7A4A3A" />
          </mesh>
          <Accessory kind={look.accessory} />
        </group>
      </group>
    </group>
  );
}

function Accessory({ kind }: { kind: AvatarLook['accessory'] }) {
  const m = { roughness: 0.8 };
  switch (kind) {
    case 'beret':
      return (
        <group position={[0.06, 0.42, -0.02]} rotation-z={-0.25}>
          <mesh scale={[1, 0.35, 1]}>
            <sphereGeometry args={[0.4, 24, 12]} />
            <meshStandardMaterial color="#B5654E" {...m} />
          </mesh>
          <mesh position-y={0.14}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#B5654E" {...m} />
          </mesh>
        </group>
      );
    case 'cap':
      return (
        <group position={[0, 0.34, 0]}>
          <mesh scale={[1, 0.6, 1]}>
            <sphereGeometry args={[0.47, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#86A57C" {...m} />
          </mesh>
          <mesh position={[0, 0, 0.42]} rotation-x={0.15} scale={[1, 0.15, 0.7]}>
            <cylinderGeometry args={[0.3, 0.3, 0.2, 20, 1, false, -Math.PI / 2, Math.PI]} />
            <meshStandardMaterial color="#86A57C" {...m} />
          </mesh>
        </group>
      );
    case 'headphones':
      return (
        <group>
          <mesh position-y={0.12} rotation-z={Math.PI / 2} rotation-y={Math.PI / 2}>
            <torusGeometry args={[0.52, 0.04, 8, 24, Math.PI]} />
            <meshStandardMaterial color="#E8C77A" {...m} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0.5 * s, 0, 0]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.13, 0.13, 0.1, 16]} />
              <meshStandardMaterial color="#F4EBDA" {...m} />
            </mesh>
          ))}
        </group>
      );
    case 'scarf':
      return (
        <mesh position-y={-0.5} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.26, 0.08, 10, 24]} />
          <meshStandardMaterial color="#F0C4C6" {...m} />
        </mesh>
      );
    case 'glasses':
      return (
        <group position={[0, -0.03, 0.49]}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0.16 * s, 0, 0]}>
              <torusGeometry args={[0.09, 0.015, 8, 20]} />
              <meshStandardMaterial color="#4A3426" />
            </mesh>
          ))}
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
