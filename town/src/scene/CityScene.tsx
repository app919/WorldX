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
import { LOW_GFX } from './quality';
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
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
  const anchor = useRef({ x: 1e9, z: 0, hour: -99 });
  useFrame((state, dt) => {
    const s = useTown.getState();
    if (s.timeFlow) { acc.current += dt; if (acc.current > 1) { s.setHour(s.hour + acc.current / 60); acc.current = 0; } }
    const L = lightingFor(s.hour);
    (state.scene.background as Color | null)?.set(L.sky);
    (state.scene.fog as Fog | null)?.color.set(L.fog);
    if (sun.current) {
      sun.current.color.set(L.sunColor);
      sun.current.intensity = L.sunIntensity;
      // 阴影防闪烁：阴影相机中心按 12 个单位的网格吸附、太阳方向每 20 游戏分钟才更新一次，
      // 避免阴影贴图每帧滑动造成边缘“抖动 / 闪烁”。
      const a = anchor.current, p = playerRuntime;
      const gx = Math.round(p.x / 12) * 12, gz = Math.round(p.z / 12) * 12;
      const hq = Math.round(s.hour * 3) / 3;
      if (gx !== a.x || gz !== a.z || hq !== a.hour) {
        a.x = gx; a.z = gz; a.hour = hq;
        const Lq = lightingFor(hq);
        sun.current.position.set(gx + Lq.sunPos[0] * 0.5, Lq.sunPos[1], gz + Lq.sunPos[2] * 0.6);
        sun.current.target.position.set(gx, 0, gz);
        sun.current.target.updateMatrixWorld();
      }
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
        shadow-camera-left={-48} shadow-camera-right={48} shadow-camera-top={48} shadow-camera-bottom={-48}
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
      shadows={LOW_GFX ? false : 'soft'}
      dpr={LOW_GFX ? 0.75 : [1, 2]}
      camera={{ fov: 30, near: 0.5, far: 500, position: [0, 30, 30] }}
      onPointerMissed={() => openCard(undefined)}
      gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: AgXToneMapping, toneMappingExposure: 1.15 }}
    >
      <color attach="background" args={['#DDEBF2']} />
      <fog attach="fog" args={['#DDEBF2', LOW_GFX ? 50 : 75, LOW_GFX ? 95 : 150]} />
      <Env />
      <Stats />
      <DayNight />
      <District />
      {!LOW_GFX && (
        /* 画质：环境光遮蔽（墙角、屋檐、车底的自然阴影）+ 夜晚灯光的柔光 + 抗锯齿 */
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <N8AO aoRadius={2.2} distanceFalloff={1.2} intensity={2.4} quality="medium" halfRes />
          <Bloom luminanceThreshold={0.92} luminanceSmoothing={0.2} intensity={0.45} mipmapBlur />
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
          <SMAA />
          <Vignette offset={0.35} darkness={0.25} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
