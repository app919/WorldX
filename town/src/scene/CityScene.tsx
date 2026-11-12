import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AgXToneMapping, PMREMGenerator, type AmbientLight, type Color, type DirectionalLight, type Fog, type HemisphereLight } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Street } from './Street';
import { Trees } from './Trees';
import { Props } from './Props';
import { Buildings } from './Buildings';
import { Player } from './Player';
import { People } from './People';
import { Traffic } from './Traffic';
import { Markers } from './Markers';
import { ConnectionLines, Effects } from './Effects';
import { lightingFor } from './lighting';
import { applyNight } from './materials';
import { compiledOf } from '../world';
import { playerRuntime, useTown } from '../store/useTown';

/** 测试用：记录渲染统计（仅 ?e2e） */
function Stats() {
  const { gl } = useThree();
  useFrame(() => {
    const w = window as unknown as { __townStats?: unknown };
    if (location.search.includes('e2e')) w.__townStats = { calls: gl.info.render.calls, triangles: gl.info.render.triangles };
  });
  return null;
}

/** 本地生成的柔和环境光照（无需外部 HDR），让玻璃与车漆有反射 */
function Env() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.55;
    return () => { env.dispose(); pm.dispose(); };
  }, [gl, scene]);
  return null;
}

function DayNight() {
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const amb = useRef<AmbientLight>(null);
  const acc = useRef(0);
  useFrame((state, dt) => {
    const s = useTown.getState();
    if (s.timeFlow) { acc.current += dt; if (acc.current > 1) { s.setHour(s.hour + acc.current / 60); acc.current = 0; } }
    const L = lightingFor(s.hour);
    (state.scene.background as Color | null)?.set(L.sky);
    (state.scene.fog as Fog | null)?.color.set(L.fog);
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
    state.scene.environmentIntensity = 0.55 * (1 - L.night * 0.6);
    applyNight(L.night);
  });
  return (
    <>
      <ambientLight ref={amb} intensity={0.5} />
      <hemisphereLight ref={hemi} args={['#FFF8EC', '#E3D9C9', 0.6]} />
      <directionalLight ref={sun} castShadow intensity={2} shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-36} shadow-camera-right={36} shadow-camera-top={36} shadow-camera-bottom={-36}
        shadow-camera-near={1} shadow-camera-far={160} shadow-bias={-0.0005} shadow-normalBias={0.04} />
    </>
  );
}

function District() {
  const district = useTown((s) => s.district);
  const cd = useMemo(() => compiledOf(district), [district]);
  return (
    <group key={district}>
      <Street cd={cd} />
      <Trees props={cd.props} />
      <Props props={cd.props} />
      <Buildings def={cd.def} />
      <Traffic cd={cd} />
      <People district={district} />
      <Markers district={district} />
      <Player />
      <ConnectionLines />
      <Effects />
    </group>
  );
}

export function CityScene() {
  const openCard = useTown((s) => s.openCard);
  useEffect(() => () => { document.body.style.cursor = ''; }, []);
  return (
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      camera={{ fov: 30, near: 0.5, far: 500, position: [0, 30, 30] }}
      onPointerMissed={() => openCard(undefined)}
      gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: AgXToneMapping, toneMappingExposure: 1.15 }}
    >
      <color attach="background" args={['#DDEBF2']} />
      <fog attach="fog" args={['#DDEBF2', 75, 150]} />
      <Env />
      <Stats />
      <DayNight />
      <District />
    </Canvas>
  );
}
