import { localHour } from './clock';
import { cityOfDistrict } from '../domain/cities';
import { weatherNow } from '../store/useWeather';
import type { WeatherKind } from '../domain/weather';
import { WeatherFx } from './WeatherFx';
import { LiveEvents } from './LiveEvents';
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AgXToneMapping, Color, PMREMGenerator, type AmbientLight, type DirectionalLight, type Fog, type HemisphereLight } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Street } from './Street';
import { Trees } from './Trees';
import { Props } from './Props';
import { Buildings } from './Buildings';
import { Player } from './Player';
import { People } from './People';
import { Tunnels } from './Tunnels';
import { JobTarget } from './JobTarget';
import { OppPins } from './OppPins';
import { Traffic } from './Traffic';
import { Markers } from './Markers';
import { ConnectionLines, Effects } from './Effects';
import { lightingFor } from './lighting';
import { applyNight, applyWet } from './materials';
import { compiledOf } from '../world';
import { DRAW_DIST, IS_MOBILE, LOW_GFX, ULTRA_GFX } from './quality';
import { Sky, Stars } from '@react-three/drei';
import { cam } from './input';
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
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

/** 天气对光照的影响：阴天、雨天、雪天天空更灰、阳光更弱 */
const WEATHER_LIGHT: Record<WeatherKind, { sun: number; sky: string; mix: number }> = {
  sunny: { sun: 1, sky: '#DDEBF2', mix: 0 },
  cloudy: { sun: 0.5, sky: '#B9C0C6', mix: 0.6 },
  rain: { sun: 0.38, sky: '#98A3AD', mix: 0.72 },
  snow: { sun: 0.62, sky: '#E6ECF1', mix: 0.7 },
};
const GREY = new Color();

function DayNight() {
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const amb = useRef<AmbientLight>(null);
  const acc = useRef(0);
  const anchor = useRef({ x: 1e9, z: 0, hour: -99 });
  useFrame((state, dt) => {
    const s = useTown.getState();
    // 昼夜跟当地真实时间走（东八区）；在「我的」或顶栏里可以临时预览其他时段
    if (s.timeFlow) { acc.current += dt; if (acc.current > 5 || s.hourSync !== true) { acc.current = 0; const h = localHour(cityOfDistrict(s.district).tz); if (Math.abs(h - s.hour) > 0.01) s.setHour(h); if (s.hourSync !== true) useTown.setState({ hourSync: true }); } }
    const L = lightingFor(s.hour);
    const W = WEATHER_LIGHT[weatherNow(cityOfDistrict(s.district).id)];
    (state.scene.background as Color | null)?.set(L.sky).lerp(GREY.set(W.sky), W.mix * (1 - L.night * 0.5));
    (state.scene.fog as Fog | null)?.color.copy((state.scene.background as Color));
    if (sun.current) {
      sun.current.color.set(L.sunColor);
      sun.current.intensity = L.sunIntensity * W.sun;
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
    applyWet(weatherNow(cityOfDistrict(s.district).id) === 'rain' ? 1 : 0);
  });
  return (
    <>
      <ambientLight ref={amb} intensity={0.5} />
      <hemisphereLight ref={hemi} args={['#FFF8EC', '#E3D9C9', 0.6]} />
      <directionalLight ref={sun} castShadow intensity={2} shadow-mapSize={ULTRA_GFX ? [4096, 4096] : IS_MOBILE ? [1024, 1024] : [2048, 2048]}
        shadow-camera-left={-48} shadow-camera-right={48} shadow-camera-top={48} shadow-camera-bottom={-48}
        shadow-camera-near={1} shadow-camera-far={160} shadow-bias={-0.0005} shadow-normalBias={0.04} />
    </>
  );
}

/**
 * 天空：物理大气散射（瑞利 + 米氏散射），太阳位置跟当地时间走；夜里换成星空。
 * 跟随 / 第一人称视角能看到地平线，雾的距离也跟着调整（远处的楼淡入雾里，不会突然出现）。
 */
function Atmosphere() {
  const sky = useRef<{ material: { uniforms: Record<string, { value: unknown }> } } | null>(null);
  const stars = useRef<{ visible: boolean } | null>(null);
  useFrame((state) => {
    const s = useTown.getState();
    const L = lightingFor(s.hour);
    const W = WEATHER_LIGHT[weatherNow(cityOfDistrict(s.district).id)];
    const dayAngle = ((s.hour - 6) / 12) * Math.PI;
    const u = sky.current?.material.uniforms;
    if (u) {
      (u.sunPosition.value as { set(x: number, y: number, z: number): void }).set(Math.cos(dayAngle) * 100, Math.sin(dayAngle) * 100, 40);
      u.turbidity.value = 4 + W.mix * 10;
      u.rayleigh.value = 1.2 + L.night * 0.4 - W.mix * 0.6;
      u.mieCoefficient.value = 0.004 + W.mix * 0.01;
    }
    if (stars.current) stars.current.visible = L.night > 0.55 && W.mix < 0.5;
    const fog = state.scene.fog as Fog | null;
    if (fog) {
      const top = cam.mode === 'top';
      const near = top ? (LOW_GFX ? 50 : ULTRA_GFX ? 95 : 75) : 30, far = top ? (LOW_GFX ? 95 : ULTRA_GFX ? 200 : 150) : DRAW_DIST - 6;
      fog.near += (near - fog.near) * 0.1; fog.far += (far - fog.far) * 0.1;
    }
  });
  return (
    <>
      <Sky ref={sky as never} distance={4500} sunPosition={[60, 40, 30]} turbidity={4} rayleigh={1.2} mieCoefficient={0.004} mieDirectionalG={0.85} />
      <group ref={stars as never}><Stars radius={300} depth={60} count={LOW_GFX ? 1200 : 3000} factor={5} saturation={0.2} fade speed={0.4} /></group>
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
      <Tunnels cd={cd} />
      <People district={district} />
      <LiveEvents district={district} />
      <Markers district={district} />
      <JobTarget district={district} />
      <OppPins district={district} />
      <Player />
      <WeatherFx />
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
      dpr={LOW_GFX ? 0.75 : ULTRA_GFX ? [1.25, 2] : IS_MOBILE ? [1, 1.5] : [1, 2]}
      camera={{ fov: 30, near: 0.5, far: 500, position: [0, 30, 30] }}
      onPointerMissed={() => openCard(undefined)}
      // 生产环境不逐个读取着色器编译日志（three.js 默认会读，首屏要多花约半秒）
      onCreated={({ gl }) => { gl.debug.checkShaderErrors = location.search.includes('e2e'); }}
      gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: AgXToneMapping, toneMappingExposure: 1.15 }}
    >
      <color attach="background" args={['#DDEBF2']} />
      <fog attach="fog" args={['#DDEBF2', LOW_GFX ? 50 : 75, LOW_GFX ? 95 : 150]} />
      <Env />
      <Atmosphere />
      <Stats />
      <DayNight />
      <District />
      {!LOW_GFX && (
        /* 画质：环境光遮蔽（墙角、屋檐、车底的自然阴影）+ 夜晚灯光的柔光 + 抗锯齿 */
        <EffectComposer multisampling={0} enableNormalPass={false}>
          {(!IS_MOBILE || ULTRA_GFX) ? <N8AO aoRadius={2.2} distanceFalloff={1.2} intensity={2.4} quality={ULTRA_GFX ? 'high' : 'medium'} halfRes={!ULTRA_GFX} /> : <Vignette offset={0.5} darkness={0} />}
          <Bloom luminanceThreshold={0.92} luminanceSmoothing={0.2} intensity={0.45} mipmapBlur />
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
          {/* 调色：略提对比与饱和，让阳光下的砖墙、梧桐更有层次 */}
          <BrightnessContrast brightness={0} contrast={0.07} />
          <HueSaturation saturation={0.06} />
          <SMAA />
          <Vignette offset={0.35} darkness={0.25} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
