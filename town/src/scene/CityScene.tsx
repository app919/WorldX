import { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { DirectionalLight, HemisphereLight, AmbientLight, Fog } from 'three';
import { Color } from 'three';
import { Ground, Houses, PlaneTrees, StreetLamps } from './Streets';
import { Landmarks } from './Landmarks';
import { Shops } from './Shops';
import { Player } from './Player';
import { Residents } from './Residents';
import { ConnectionLines, Effects } from './Effects';
import { lightingFor } from './lighting';
import { applyNight } from './materials';
import { playerRuntime, useTown } from '../store/useTown';

/** 昼夜循环：时间流逝 + 天空/阳光/路灯/窗户灯光平滑过渡 */
function DayNight() {
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const amb = useRef<AmbientLight>(null);
  const acc = useRef(0);
  useFrame((state, dt) => {
    const s = useTown.getState();
    if (s.timeFlow) {
      acc.current += dt;
      // 现实 1 秒 = 游戏 1 分钟
      if (acc.current > 1) { s.setHour(s.hour + acc.current / 60); acc.current = 0; }
    }
    const L = lightingFor(s.hour);
    const bg = state.scene.background as Color | null;
    if (bg) bg.set(L.sky);
    const fog = state.scene.fog as Fog | null;
    if (fog) fog.color.set(L.fog);
    if (sun.current) {
      sun.current.color.set(L.sunColor);
      sun.current.intensity = L.sunIntensity;
      const p = playerRuntime;
      sun.current.position.set(p.x + L.sunPos[0] * 0.5, L.sunPos[1], p.z + L.sunPos[2] * 0.6);
      sun.current.target.position.set(p.x, 0, p.z);
      sun.current.target.updateMatrixWorld();
    }
    if (hemi.current) { hemi.current.color.set(L.hemiSky); hemi.current.groundColor.set(L.hemiGround); }
    if (amb.current) amb.current.intensity = L.ambient;
    applyNight(L.night);
  });
  return (
    <>
      <ambientLight ref={amb} intensity={0.5} />
      <hemisphereLight ref={hemi} args={['#FFF8EC', '#E3D9C9', 0.7]} />
      <directionalLight
        ref={sun}
        castShadow
        intensity={2}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0006}
        shadow-radius={6}
      />
    </>
  );
}

export function CityScene() {
  const select = useTown((s) => s.select);
  useEffect(() => () => { document.body.style.cursor = ''; }, []);
  return (
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      camera={{ fov: 32, near: 0.5, far: 400, position: [0, 20, 25] }}
      onPointerMissed={() => select(null)}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <color attach="background" args={['#DDEBF2']} />
      <fog attach="fog" args={['#DDEBF2', 60, 150]} />
      <DayNight />
      <Ground />
      <PlaneTrees />
      <StreetLamps />
      <Houses />
      <Landmarks />
      <Shops />
      <Residents />
      <Player />
      <ConnectionLines />
      <Effects />
    </Canvas>
  );
}
