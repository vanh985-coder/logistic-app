'use client';

import React, { useRef, useMemo, useLayoutEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { ContainerDimension, PackedPlacement, PackageMetadata } from './types';
import { Eye, RotateCcw } from 'lucide-react';

export interface PackingSceneProps {
  container: ContainerDimension;
  placements: PackedPlacement[];
  packagesMap: Map<string, PackageMetadata>;
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
  isUnloadingMode?: boolean;
  unloadingStep?: number;
  unloadingSequence?: number[];
  hideUnloaded?: boolean;
  onStepChange?: (step: number) => void;
}

// Sub-component: Container Wireframe, Grid, and 3-axis Dimension Rulers
function ContainerWireframe({ container }: { container: ContainerDimension }) {
  const L = container.innerLengthMm / 1000;
  const W = container.innerWidthMm / 1000;
  const H = container.innerHeightMm / 1000;

  const wireframeEdges = useMemo(() => {
    const geom = new THREE.BoxGeometry(L, H, W);
    return new THREE.EdgesGeometry(geom);
  }, [L, W, H]);

  return (
    <group>
      {/* 3D Container Wireframe Boundary */}
      <lineSegments geometry={wireframeEdges} position={[0, H / 2, 0]}>
        <lineBasicMaterial color="#38BDF8" linewidth={1.5} transparent opacity={0.65} />
      </lineSegments>

      {/* Container Semi-transparent Base Plate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[L, W]} />
        <meshBasicMaterial color="#0F172A" transparent opacity={0.7} />
      </mesh>

      {/* Surrounding Floor Grid Helper */}
      <gridHelper
        args={[Math.max(L, W) * 1.5, 24, '#334155', '#1E293B']}
        position={[0, 0, 0]}
      />

      {/* Dimension Rulers with sharp mono typography */}
      {/* Length ruler (along front bottom X) */}
      <Html position={[0, 0.05, W / 2 + 0.3]} center distanceFactor={14}>
        <div className="bg-slate-900/90 text-slate-300 font-mono text-[10px] px-2 py-0.5 rounded border border-slate-700 pointer-events-none whitespace-nowrap shadow-md">
          Dài (L): {container.innerLengthMm.toLocaleString()} mm
        </div>
      </Html>

      {/* Width ruler (along right bottom Z) */}
      <Html position={[L / 2 + 0.4, 0.05, 0]} center distanceFactor={14}>
        <div className="bg-slate-900/90 text-slate-300 font-mono text-[10px] px-2 py-0.5 rounded border border-slate-700 pointer-events-none whitespace-nowrap shadow-md">
          Rộng (W): {container.innerWidthMm.toLocaleString()} mm
        </div>
      </Html>

      {/* Height ruler (along corner vertical Y) */}
      <Html position={[L / 2 + 0.4, H / 2, W / 2]} center distanceFactor={14}>
        <div className="bg-slate-900/90 text-slate-300 font-mono text-[10px] px-2 py-0.5 rounded border border-slate-700 pointer-events-none whitespace-nowrap shadow-md">
          Cao (H): {container.innerHeightMm.toLocaleString()} mm
        </div>
      </Html>
    </group>
  );
}

// Sub-component: High-performance InstancedMesh for placed packages
function PackagesInstancedMesh({
  container,
  placements,
  packagesMap,
  selectedIndex,
  onSelectIndex,
  hoveredIndex,
  onHoverIndex,
  isUnloadingMode = false,
  unloadingStep = 1,
  unloadingSequence,
  hideUnloaded = true,
  onStepChange,
}: {
  container: ContainerDimension;
  placements: PackedPlacement[];
  packagesMap: Map<string, PackageMetadata>;
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
  hoveredIndex: number | null;
  onHoverIndex: (index: number | null) => void;
  isUnloadingMode?: boolean;
  unloadingStep?: number;
  unloadingSequence?: number[];
  hideUnloaded?: boolean;
  onStepChange?: (step: number) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const L = container.innerLengthMm;
  const W = container.innerWidthMm;

  const unitBoxGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.35,
        metalness: 0.15,
      }),
    [],
  );

  const tempObj = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  const rankMap = useMemo(() => {
    const map = new Map<number, number>();
    if (unloadingSequence) {
      unloadingSequence.forEach((placementIdx, rank) => {
        map.set(placementIdx, rank);
      });
    }
    return map;
  }, [unloadingSequence]);

  const currentStepIdx = unloadingStep - 1; // 0-based
  const currentUnloadingPlacementIdx =
    isUnloadingMode && unloadingSequence && currentStepIdx >= 0 && currentStepIdx < unloadingSequence.length
      ? unloadingSequence[currentStepIdx]
      : null;

  // Update instanced mesh matrices and colors in a single pass
  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;

    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      const rank = isUnloadingMode && unloadingSequence ? (rankMap.get(i) ?? i) : i;

      // Handle packages already unloaded in animation mode
      if (isUnloadingMode && rank < currentStepIdx) {
        if (hideUnloaded) {
          tempObj.scale.set(0, 0, 0);
          tempObj.position.set(0, -999, 0);
          tempObj.updateMatrix();
          mesh.setMatrixAt(i, tempObj.matrix);
          continue;
        }
      }

      // Translate coordinates to Three.js world space:
      // X = length axis (centered at 0), Y = height (resting on floor at 0), Z = width (centered at 0)
      const posX = (p.xMm + p.placedLengthMm / 2 - L / 2) / 1000;
      const isCurrentUnloading = isUnloadingMode && rank === currentStepIdx;
      const liftY = isCurrentUnloading ? 0.06 : 0;
      const posY = (p.zMm + p.placedHeightMm / 2) / 1000 + liftY;
      const posZ = (p.yMm + p.placedWidthMm / 2 - W / 2) / 1000;

      tempObj.position.set(posX, posY, posZ);
      tempObj.scale.set(
        p.placedLengthMm / 1000,
        p.placedHeightMm / 1000,
        p.placedWidthMm / 1000,
      );
      tempObj.updateMatrix();
      mesh.setMatrixAt(i, tempObj.matrix);

      const meta = packagesMap.get(p.packageId);
      if (isCurrentUnloading) {
        tempColor.set('#F59E0B'); // Warm amber highlight for currently unloading item
      } else {
        tempColor.set(meta ? meta.color : '#38BDF8');
      }
      mesh.setColorAt(i, tempColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [
    container,
    placements,
    packagesMap,
    tempObj,
    tempColor,
    L,
    W,
    isUnloadingMode,
    currentStepIdx,
    hideUnloaded,
    rankMap,
  ]);

  // Active placement to highlight
  const activePlacement =
    isUnloadingMode && currentUnloadingPlacementIdx !== null
      ? placements[currentUnloadingPlacementIdx]
      : selectedIndex !== null
      ? placements[selectedIndex]
      : null;

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[unitBoxGeometry, material, placements.length]}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId !== undefined && e.instanceId >= 0 && e.instanceId < placements.length) {
            if (isUnloadingMode && unloadingSequence) {
              const rank = rankMap.get(e.instanceId);
              if (rank !== undefined && onStepChange) {
                onStepChange(rank + 1);
              }
            }
            onSelectIndex(e.instanceId);
          }
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          if (e.instanceId !== undefined && e.instanceId >= 0 && e.instanceId < placements.length) {
            onHoverIndex(e.instanceId);
          }
        }}
        onPointerOut={() => {
          onHoverIndex(null);
        }}
      />

      {/* Selected / Currently Unloading Box Glowing Highlight Wireframe */}
      {activePlacement && (
        <group
          position={[
            (activePlacement.xMm + activePlacement.placedLengthMm / 2 - L / 2) / 1000,
            (activePlacement.zMm + activePlacement.placedHeightMm / 2) / 1000 +
              (isUnloadingMode && currentUnloadingPlacementIdx !== null ? 0.06 : 0),
            (activePlacement.yMm + activePlacement.placedWidthMm / 2 - W / 2) / 1000,
          ]}
        >
          <mesh>
            <boxGeometry
              args={[
                (activePlacement.placedLengthMm + 8) / 1000,
                (activePlacement.placedHeightMm + 8) / 1000,
                (activePlacement.placedWidthMm + 8) / 1000,
              ]}
            />
            <meshBasicMaterial
              color={isUnloadingMode ? '#F59E0B' : '#FFFFFF'}
              wireframe
              transparent
              opacity={0.95}
            />
          </mesh>
        </group>
      )}

      {/* Floating Tooltip Label */}
      {(() => {
        if (isUnloadingMode && currentUnloadingPlacementIdx !== null && placements[currentUnloadingPlacementIdx]) {
          const p = placements[currentUnloadingPlacementIdx];
          const meta = packagesMap.get(p.packageId);
          const posX = (p.xMm + p.placedLengthMm / 2 - L / 2) / 1000;
          const posY = (p.zMm + p.placedHeightMm) / 1000 + 0.28;
          const posZ = (p.yMm + p.placedWidthMm / 2 - W / 2) / 1000;

          return (
            <Html position={[posX, posY, posZ]} center distanceFactor={12} pointerEvents="none">
              <div className="bg-slate-950/95 text-white text-[11px] font-mono px-3 py-1.5 rounded-lg shadow-2xl border-2 border-amber-500 flex items-center gap-2 whitespace-nowrap animate-in fade-in zoom-in-90 duration-150">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                <span className="font-bold text-amber-300">Dỡ #{unloadingStep}/{placements.length}:</span>
                <span className="font-bold text-white">{meta?.packageCode || p.packageId}</span>
                <span className="text-slate-400 font-sans">• {meta?.deliveryDestination || meta?.companyName}</span>
              </div>
            </Html>
          );
        }

        const activeIdx = hoveredIndex ?? selectedIndex;
        if (activeIdx === null || !placements[activeIdx]) return null;
        const p = placements[activeIdx];
        const meta = packagesMap.get(p.packageId);

        const posX = (p.xMm + p.placedLengthMm / 2 - L / 2) / 1000;
        const posY = (p.zMm + p.placedHeightMm) / 1000 + 0.15;
        const posZ = (p.yMm + p.placedWidthMm / 2 - W / 2) / 1000;

        return (
          <Html position={[posX, posY, posZ]} center distanceFactor={12} pointerEvents="none">
            <div className="bg-slate-950/95 text-white text-[11px] font-mono px-2 py-1 rounded shadow-xl border border-blue-500/80 flex items-center gap-1.5 whitespace-nowrap animate-in fade-in zoom-in-90 duration-150">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: meta?.color || '#38BDF8' }}
              />
              <span className="font-bold">{meta?.packageCode || p.packageId}</span>
              <span className="text-slate-400 font-sans">({meta?.companyName.slice(0, 16)}...)</span>
            </div>
          </Html>
        );
      })()}
    </group>
  );
}

// Camera Preset Controller
function CameraManager({
  container,
  presetView,
  onResetPreset,
}: {
  container: ContainerDimension;
  presetView: 'iso' | 'top' | 'side' | 'front' | null;
  onResetPreset: () => void;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const L = container.innerLengthMm / 1000;
  const W = container.innerWidthMm / 1000;
  const H = container.innerHeightMm / 1000;
  const centerY = H / 2;

  useLayoutEffect(() => {
    if (!presetView || !controlsRef.current) return;

    if (presetView === 'iso') {
      camera.position.set(L * 0.95, H * 2.2, W * 3.2);
    } else if (presetView === 'top') {
      camera.position.set(0, Math.max(L, W) * 1.5, 0.001);
    } else if (presetView === 'side') {
      camera.position.set(0, centerY, W * 3.2);
    } else if (presetView === 'front') {
      camera.position.set(L * 1.4, centerY, 0);
    }

    controlsRef.current.target.set(0, centerY, 0);
    controlsRef.current.update();
    onResetPreset();
  }, [presetView, camera, L, W, H, centerY, onResetPreset]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={[0, centerY, 0]}
      minDistance={2}
      maxDistance={60}
      enableDamping
      dampingFactor={0.1}
    />
  );
}

export function PackingScene({
  container,
  placements,
  packagesMap,
  selectedIndex,
  onSelectIndex,
  isUnloadingMode = false,
  unloadingStep = 1,
  unloadingSequence,
  hideUnloaded = true,
  onStepChange,
}: PackingSceneProps) {
  const [presetView, setPresetView] = useState<'iso' | 'top' | 'side' | 'front' | null>('iso');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const H = container.innerHeightMm / 1000;
  const L = container.innerLengthMm / 1000;
  const W = container.innerWidthMm / 1000;

  return (
    <div className="relative w-full h-[460px] sm:h-[520px] bg-[#090D16] overflow-hidden select-none">
      {/* Preset View Action Buttons Floating on Top-Left */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 p-1 rounded-lg bg-slate-900/90 border border-slate-800 backdrop-blur shadow-lg text-xs">
        <span className="text-[10px] text-slate-400 font-mono px-1 flex items-center gap-1">
          <Eye className="h-3 w-3 text-blue-400" />
          Góc nhìn:
        </span>
        <button
          onClick={() => setPresetView('iso')}
          className="px-2 py-1 rounded text-[11px] font-medium text-slate-200 hover:text-white hover:bg-slate-800 transition"
        >
          Isometric
        </button>
        <button
          onClick={() => setPresetView('top')}
          className="px-2 py-1 rounded text-[11px] font-medium text-slate-200 hover:text-white hover:bg-slate-800 transition"
        >
          Top (Trên)
        </button>
        <button
          onClick={() => setPresetView('side')}
          className="px-2 py-1 rounded text-[11px] font-medium text-slate-200 hover:text-white hover:bg-slate-800 transition"
        >
          Side (Hông)
        </button>
        <button
          onClick={() => setPresetView('front')}
          className="px-2 py-1 rounded text-[11px] font-medium text-slate-200 hover:text-white hover:bg-slate-800 transition"
        >
          Front (Cửa)
        </button>
        <button
          onClick={() => setPresetView('iso')}
          title="Đặt lại camera"
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </div>

      {/* Control Hints on Bottom-Left */}
      <div className="absolute bottom-3 left-3 z-10 text-[10px] text-slate-500 font-mono bg-slate-950/70 px-2.5 py-1 rounded border border-slate-800/80 pointer-events-none">
        Chuột trái: Xoay (Orbit) • Chuột phải: Trượt (Pan) • Con lăn: Thu phóng (Zoom)
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [L * 0.95, H * 2.2, W * 3.2], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        className="w-full h-full"
      >
        <color attach="background" args={['#090D16']} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[15, 25, 20]} intensity={1.1} />
        <directionalLight position={[-15, 10, -20]} intensity={0.4} />

        <CameraManager
          container={container}
          presetView={presetView}
          onResetPreset={() => setPresetView(null)}
        />

        <ContainerWireframe container={container} />

        <PackagesInstancedMesh
          container={container}
          placements={placements}
          packagesMap={packagesMap}
          selectedIndex={selectedIndex}
          onSelectIndex={onSelectIndex}
          hoveredIndex={hoveredIndex}
          onHoverIndex={setHoveredIndex}
          isUnloadingMode={isUnloadingMode}
          unloadingStep={unloadingStep}
          unloadingSequence={unloadingSequence}
          hideUnloaded={hideUnloaded}
          onStepChange={onStepChange}
        />
      </Canvas>
    </div>
  );
}
