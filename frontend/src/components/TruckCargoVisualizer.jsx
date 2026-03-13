import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Text, ContactShadows, Float } from '@react-three/drei';
import * as THREE from 'three';

function getFillColor(pct) {
  return '#facc15';
}

function getGlowColor(pct) {
  return '#93c5fd';
}

function CargoBox({ position, size, color, tapeColor }) {
  const [bw, bh, bd] = size;
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[bw, bh, bd]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0.02} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(bw, bh, bd)]} />
        <lineBasicMaterial color="#8B7355" linewidth={1} />
      </lineSegments>
      <mesh position={[0, bh / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[bw * 0.25, bd * 0.95]} />
        <meshStandardMaterial color={tapeColor} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, bd / 2 + 0.002]}>
        <planeGeometry args={[bw * 0.25, bh * 0.95]} />
        <meshStandardMaterial color={tapeColor} roughness={0.4} />
      </mesh>
    </group>
  );
}

function CargoBoxes({ fillPct, cargoWidth, cargoHeight, cargoDepth }) {
  const boxes = useMemo(() => {
    if (fillPct <= 0) return [];

    const pad = 0.06;
    const innerW = cargoWidth - pad * 2;
    const innerH = cargoHeight - pad * 2;
    const innerD = cargoDepth - pad * 2;

    const cols = Math.max(2, Math.round(innerW / 0.38));
    const layers = Math.max(2, Math.round(innerH / 0.35));
    const rows = Math.max(3, Math.round(innerD / 0.45));

    const boxW = innerW / cols;
    const boxH = innerH / layers;
    const boxD = innerD / rows;

    const totalSlots = cols * layers * rows;
    const filledCount = Math.max(1, Math.round(totalSlots * (fillPct / 100)));

    const cardboardColors = [
      '#c4956a', '#b8895e', '#d4a574', '#c09060',
      '#be9468', '#cbaa7a', '#b38550', '#cfa870',
    ];
    const tapeColors = ['#d4c5a0', '#e0d5b5', '#ccbd98'];

    const seededRand = (i) => {
      const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };

    const result = [];
    let count = 0;

    for (let layer = 0; layer < layers && count < filledCount; layer++) {
      for (let row = 0; row < rows && count < filledCount; row++) {
        for (let col = 0; col < cols && count < filledCount; col++) {
          const idx = count;
          const r = seededRand(idx);
          const shrink = 0.82 + r * 0.14;

          const x = -innerW / 2 + boxW / 2 + col * boxW;
          const y = -innerH / 2 + boxH / 2 + layer * boxH;
          const z = -innerD / 2 + boxD / 2 + row * boxD;

          result.push({
            key: `box-${idx}`,
            position: [
              x + (seededRand(idx + 50) - 0.5) * 0.02,
              y,
              z + (seededRand(idx + 100) - 0.5) * 0.02,
            ],
            size: [
              boxW * shrink - 0.02,
              boxH * shrink - 0.02,
              boxD * shrink - 0.02,
            ],
            color: cardboardColors[idx % cardboardColors.length],
            tapeColor: tapeColors[idx % tapeColors.length],
          });
          count++;
        }
      }
    }

    return result;
  }, [fillPct, cargoWidth, cargoHeight, cargoDepth]);

  return (
    <group>
      {boxes.map((b) => (
        <CargoBox
          key={b.key}
          position={b.position}
          size={b.size}
          color={b.color}
          tapeColor={b.tapeColor}
        />
      ))}
    </group>
  );
}

function TruckModel({ fillPct = 0, vehicleType = 'TRUCK' }) {
  const groupRef = useRef();

  const dims = useMemo(() => {
    switch (vehicleType) {
      case 'VAN': return { cw: 1.4, ch: 1.2, cd: 2.0, cabW: 1.4, cabH: 1.0, cabD: 0.8 };
      case 'PICKUP': return { cw: 1.3, ch: 0.6, cd: 1.5, cabW: 1.3, cabH: 0.9, cabD: 0.9 };
      case 'FLATBED': return { cw: 1.6, ch: 0.3, cd: 3.0, cabW: 1.5, cabH: 1.1, cabD: 0.9 };
      case 'CONTAINER': return { cw: 1.8, ch: 1.8, cd: 3.5, cabW: 1.6, cabH: 1.2, cabD: 0.9 };
      default: return { cw: 1.6, ch: 1.4, cd: 2.5, cabW: 1.5, cabH: 1.1, cabD: 0.9 };
    }
  }, [vehicleType]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.04;
    }
  });

  const { cw, ch, cd, cabW, cabH, cabD } = dims;
  const chassisY = -ch / 2 - 0.15;
  const wheelRadius = 0.18;
  const wheelWidth = 0.1;

  return (
    <group ref={groupRef}>
      <RoundedBox args={[Math.max(cw, cabW) + 0.1, 0.12, cd + cabD + 0.3]} radius={0.04} position={[0, chassisY, -(cabD - cd) / 2 * 0.3]}>
        <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
      </RoundedBox>

      <group position={[0, 0, cd / 2 + cabD / 2 + 0.05]}>
        <RoundedBox args={[cabW, cabH, cabD]} radius={0.08} position={[0, cabH / 2 - ch / 2, 0]}>
          <meshPhysicalMaterial color="#6b7280" roughness={0.3} metalness={0.5} clearcoat={0.6} />
        </RoundedBox>
        <mesh position={[0, cabH * 0.35 - ch / 2, cabD / 2 - 0.02]}>
          <planeGeometry args={[cabW * 0.7, cabH * 0.45]} />
          <meshPhysicalMaterial color="#d1d5db" transparent opacity={0.5} roughness={0.05} metalness={0.3} transmission={0.6} />
        </mesh>
        <mesh position={[-cabW / 2 + 0.15, -ch / 2 + cabH * 0.15, cabD / 2 + 0.01]}>
          <circleGeometry args={[0.08, 16]} />
          <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[cabW / 2 - 0.15, -ch / 2 + cabH * 0.15, cabD / 2 + 0.01]}>
          <circleGeometry args={[0.08, 16]} />
          <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={0.8} />
        </mesh>
      </group>

      <group position={[0, 0, 0]}>
        <RoundedBox args={[cw, ch, cd]} radius={0.04} position={[0, 0, 0]}>
          <meshPhysicalMaterial
            color="#cbd5e1"
            transparent
            opacity={0.22}
            roughness={0.1}
            metalness={0.1}
            side={THREE.DoubleSide}
          />
        </RoundedBox>
        <lineSegments position={[0, 0, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(cw, ch, cd)]} />
          <lineBasicMaterial color="#64748b" linewidth={1.5} />
        </lineSegments>
        {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz], i) => (
          <mesh key={`beam-${i}`} position={[sx * (cw / 2 - 0.02), 0, sz * (cd / 2 - 0.02)]}>
            <boxGeometry args={[0.04, ch, 0.04]} />
            <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
          </mesh>
        ))}
        <CargoBoxes fillPct={fillPct} cargoWidth={cw} cargoHeight={ch} cargoDepth={cd} />
        <Float speed={2} floatIntensity={0.3} rotationIntensity={0}>
          <Text
            position={[0, ch / 2 + 0.35, 0]}
            fontSize={0.28}
            color={getFillColor(fillPct)}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#334155"
          >
            {`${Math.round(fillPct)}%`}
          </Text>
        </Float>
      </group>

      {[
        [-cw / 2 - wheelWidth / 2, chassisY - 0.04, cd / 2 - 0.3],
        [cw / 2 + wheelWidth / 2, chassisY - 0.04, cd / 2 - 0.3],
        [-cw / 2 - wheelWidth / 2, chassisY - 0.04, -cd / 2 + 0.3],
        [cw / 2 + wheelWidth / 2, chassisY - 0.04, -cd / 2 + 0.3],
        [-cabW / 2 - wheelWidth / 2, chassisY - 0.04, cd / 2 + dims.cabD],
        [cabW / 2 + wheelWidth / 2, chassisY - 0.04, cd / 2 + dims.cabD],
      ].map((pos, i) => (
        <group key={`wheel-${i}`} position={pos} rotation={[0, 0, Math.PI / 2]}>
          <mesh>
            <cylinderGeometry args={[wheelRadius, wheelRadius, wheelWidth, 16]} />
            <meshStandardMaterial color="#1f2937" roughness={0.8} />
          </mesh>
          <mesh position={[0, wheelWidth / 2 + 0.005, 0]}>
            <cylinderGeometry args={[wheelRadius * 0.4, wheelRadius * 0.4, 0.01, 8]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.1} />
          </mesh>
        </group>
      ))}

      <mesh position={[-cw / 2 + 0.1, -ch / 2 + 0.15, -cd / 2 - 0.01]}>
        <boxGeometry args={[0.12, 0.08, 0.01]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[cw / 2 - 0.1, -ch / 2 + 0.15, -cd / 2 - 0.01]}>
        <boxGeometry args={[0.12, 0.08, 0.01]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

function CameraRig() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(3.5, 2.5, 3.5);
    camera.lookAt(0, 0, 0);
  }, []);
  return null;
}

function GroundGrid() {
  return null; // Removed ground grid for deep space dark aesthetic
}

const ExpandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const ShrinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
    <line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

export default function TruckCargoVisualizer({
  weightUsed = 0,
  weightCapacity = 1000,
  volumeUsed = 0,
  volumeCapacity = 10,
  vehicleType = 'TRUCK',
  vehicleName = 'Vehicle',
  plateNumber = '',
  style = {},
  height = 420,
  showLabels = true,
}) {
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const weightPct = weightCapacity > 0 ? Math.min((weightUsed / weightCapacity) * 100, 100) : 0;
  const volumePct = volumeCapacity > 0 ? Math.min((volumeUsed / volumeCapacity) * 100, 100) : 0;
  const displayPct = volumePct;

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => { });
    } else {
      document.exitFullscreen().catch(() => { });
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const boxesCount = Math.round(displayPct * 20); // rough estimate logic

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: isFullscreen ? '100vh' : '100%',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 1,
        borderRadius: isFullscreen ? 0 : 8,
        overflow: 'hidden',
        background: '#0a0a0a',
        fontFamily: 'Inter, sans-serif',
        ...style,
      }}
    >
      <Canvas
        shadows
        className="force-canvas-full"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block' }}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        camera={{ fov: 40, near: 0.1, far: 50 }}
      >
        <color attach="background" args={['#0a0a0a']} />
        <CameraRig />
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={3}
          maxDistance={15}
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 2 + 0.1}
          autoRotate={false}
        />

        <ambientLight intensity={0.5} color="#fff" />
        <hemisphereLight intensity={0.2} color="#ffffff" groundColor="#000000" />
        <directionalLight position={[5, 8, 5]} intensity={1.5} castShadow />

        <group scale={[0.8, 0.8, 0.8]} position={[0, 0.5, 0]}>
            {/* Draw just the bounding box wireframe instead of full truck */}
            <lineSegments position={[0, 0, 0]}>
                <edgesGeometry args={[new THREE.BoxGeometry(2, 1.5, 4.5)]} />
                <lineBasicMaterial color="#ef4444" transparent opacity={0.4} linewidth={1} />
            </lineSegments>
            <CargoBoxes fillPct={displayPct} cargoWidth={2} cargoHeight={1.5} cargoDepth={4.5} />
        </group>
      </Canvas>

      {/* Top Header Overlay (if not rendered by a parent modal) */}
      <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          padding: '16px 24px', display: 'flex', justifyContent: 'space-between',
          color: '#fff', pointerEvents: 'none'
      }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
             <span style={{ fontWeight: 600, fontSize: 16 }}>3D Packing View &ndash; {plateNumber || vehicleName}</span>
          </div>
      </div>

      {/* Panels */}
      <div style={{ position: 'absolute', top: 60, right: 24, display: 'flex', justifyContent: 'flex-end', pointerEvents: 'none', alignItems: 'flex-start' }}>
          
          {/* Right Panel: Statistics */}
          <div style={{ background: '#000', border: '1px solid #333', borderRadius: 8, padding: 16, width: 240, pointerEvents: 'auto' }}>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, marginBottom: 16 }}>Statistics</div>
              
              <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>Volume Utilization:</span>
                      <span style={{ background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{volumePct.toFixed(1)}%</span>
                  </div>
                  <div style={{ color: '#d1d5db', fontSize: 11 }}>
                      {volumeUsed.toFixed(2)} m³ / {volumeCapacity.toFixed(2)} m³
                  </div>
              </div>

              <div style={{ borderTop: '1px solid #333', paddingTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>Weight Utilization:</span>
                      <span style={{ background: '#3b82f6', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{weightPct.toFixed(1)}%</span>
                  </div>
                  <div style={{ color: '#d1d5db', fontSize: 11 }}>
                      {weightUsed.toFixed(0)} kg / {weightCapacity.toFixed(0)} kg
                  </div>
              </div>
          </div>
      </div>

      {/* Bottom Controls */}
      <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#000', border: '1px solid #333',
          padding: '8px 16px', borderRadius: 20, display: 'flex', gap: 16, pointerEvents: 'none',
      }}>
          <span style={{ color: '#9ca3af', fontSize: 11 }}>Hover for info</span>
          <span style={{ color: '#444' }}>|</span>
          <span style={{ color: '#9ca3af', fontSize: 11 }}>Drag to rotate</span>
          <span style={{ color: '#444' }}>|</span>
          <span style={{ color: '#9ca3af', fontSize: 11 }}>Scroll to zoom</span>
      </div>

      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        style={{
          position: 'absolute', top: 16, right: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 8, border: 'none',
          background: 'transparent',
          cursor: 'pointer', color: '#9ca3af', transition: 'all 0.2s',
          zIndex: 10,
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; }}
      >
        {isFullscreen ? <ShrinkIcon /> : <ExpandIcon />}
      </button>
    </div>
  );
}
