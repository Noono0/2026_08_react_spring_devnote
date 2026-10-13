/**
 * BilliardsTable3D.tsx — three.js로 그리는 3D 당구대(당구 화면에서만 지연 로딩된다)
 *
 * [React와 three.js 나누기]
 *   three.js 장면(Scene)은 한 번 만들어 두고 매 프레임 직접 고치는 "명령형" 객체다.
 *   그래서 장면은 useEffect에서 테이블 크기가 바뀔 때만 새로 만들고,
 *   매번 바뀌는 값(공 위치·조준·재생할 샷)은 latestRef로 넘겨 애니메이션 루프가 읽게 한다.
 *   (값이 바뀔 때마다 장면을 다시 만들면 WebGL 자원이 계속 새로 생겨 느려진다)
 *
 * [재생] 서버가 보낸 궤적(1/30초 간격 mm 좌표)을 시간에 맞춰 이어 그리고,
 *   공이 움직인 거리만큼 굴러가는 방향으로 회전시킨다(거리 / 반지름 = 회전각).
 *   충돌·쿠션·포켓 이벤트 시간에 맞춰 소리를 낸다.
 * [조작] 왼쪽 버튼(한 손가락) 드래그 = 조준 방향, 오른쪽 버튼(두 손가락) = 시점 회전, 휠 = 확대.
 * [자원 정리] 장면을 버릴 때 geometry·material·texture·renderer를 모두 dispose한다(메모리 누수 방지).
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { canPlaceCue, positionAt, type AimPreview, type Point } from "@/features/games/online/games/billiards/billiardsAim";
import { ballLook, FRAME_MS, type BilliardsShot, type BilliardsView } from "@/features/games/online/games/billiards/billiardsRules";

export type CameraMode = "TOP" | "BEHIND" | "FREE";

export interface AimState {
  cueId: number;
  degrees: number;
  power: number;
  /** 당점(-50~50, 반지름의 %) */
  side: number;
  vertical: number;
}

export interface BilliardsTable3DProps {
  game: BilliardsView;
  replay: BilliardsShot | null;
  onReplayEnd: () => void;
  /** null이면 큐와 조준선을 숨긴다(내 차례가 아님·재생 중) */
  aim: AimState | null;
  preview: AimPreview | null;
  showGuide: boolean;
  cameraMode: CameraMode;
  placing: boolean;
  soundOn: boolean;
  onAimDegrees: (degrees: number) => void;
  onPlace: (point: Point) => void;
}

const CLOTH = { CAROM: "#1d5fae", POOL: "#1f7a45" } as const;
const CUSHION_DEPTH = 0.05;
const RAIL_WIDTH = 0.13;

/** 공 무늬(정거리 원통 투영): 번호 원·줄무늬·회전이 보이게 찍은 점 */
const ballTexture = (variant: BilliardsView["variant"], id: number): THREE.CanvasTexture => {
  const look = ballLook(variant, id);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = look.base;
    context.fillRect(0, 0, 512, 256);
    if (look.stripe) {
      context.fillStyle = look.stripe;
      context.fillRect(0, 72, 512, 112);
    }
    for (const centerX of [128, 384]) {
      if (look.number !== null) {
        context.fillStyle = "#fbfaf4";
        context.beginPath();
        context.ellipse(centerX, 128, 46, 40, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#111";
        context.font = "bold 56px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(String(look.number), centerX, 131);
      } else {
        // 캐롬 공·수구: 굴러가는 게 보이도록 작은 점
        context.fillStyle = id === 0 && variant === "EIGHT_BALL" ? "#c8161d" : "rgba(0, 0, 0, 0.28)";
        context.beginPath();
        context.arc(centerX, 128, 11, 0, Math.PI * 2);
        context.fill();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

/** 천의 결: 아주 옅은 잡음 */
const clothTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const image = context.createImageData(128, 128);
    for (let index = 0; index < image.data.length; index += 4) {
      const shade = 225 + Math.floor(Math.random() * 30);
      image.data[index] = shade;
      image.data[index + 1] = shade;
      image.data[index + 2] = shade;
      image.data[index + 3] = 255;
    }
    context.putImageData(image, 0, 0);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 5);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

/** 짧은 효과음(WebAudio로 즉석 합성 — 소리 파일 없이) */
const playSound = (audio: AudioContext, type: "BALL" | "CUSHION" | "POCKET") => {
  const now = audio.currentTime;
  const gain = audio.createGain();
  gain.connect(audio.destination);
  const oscillator = audio.createOscillator();
  oscillator.connect(gain);
  if (type === "BALL") {
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(2400, now);
    oscillator.frequency.exponentialRampToValueAtTime(900, now + 0.03);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    oscillator.start(now);
    oscillator.stop(now + 0.07);
  } else if (type === "CUSHION") {
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(190, now);
    oscillator.frequency.exponentialRampToValueAtTime(90, now + 0.09);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    oscillator.start(now);
    oscillator.stop(now + 0.13);
  } else {
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(120, now);
    oscillator.frequency.exponentialRampToValueAtTime(55, now + 0.3);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    oscillator.start(now);
    oscillator.stop(now + 0.36);
  }
};

interface Replaying {
  shot: BilliardsShot;
  startedAt: number;
  nextEvent: number;
  /** 포켓에 들어가는 공: 떨어지기 시작한 시각 */
  dropping: Map<number, { at: number; from: THREE.Vector3; pocket: THREE.Vector3 }>;
}

export const BilliardsTable3D = (props: BilliardsTable3DProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const latestRef = useRef(props);
  const replayRef = useRef<Replaying | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const [failed, setFailed] = useState(false);
  const { variant, tableLength, tableWidth, ballRadius, pockets } = props.game;

  useEffect(() => {
    latestRef.current = props;
  });

  // 새 샷이 오면 재생을 시작한다
  const replaySeq = props.replay?.seq ?? null;
  useEffect(() => {
    const shot = latestRef.current.replay;
    if (!shot) return;
    replayRef.current = { shot, startedAt: performance.now(), nextEvent: 0, dropping: new Map() };
    if (latestRef.current.soundOn && !audioRef.current && typeof AudioContext !== "undefined") audioRef.current = new AudioContext();
  }, [replaySeq]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setFailed(true);
      return;
    }
    const length = tableLength / 1000;
    const width = tableWidth / 1000;
    const radius = ballRadius / 1000;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "billiards-canvas";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#101318");
    // 반짝이는 공·나무에 비칠 주변 환경(방 하나를 미리 구운 반사맵)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = environment;
    scene.environmentIntensity = 0.35;
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 30);
    camera.position.set(0, 2.4, 2.2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 0.4;
    controls.maxDistance = 6;
    controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };

    const disposables: { dispose: () => void }[] = [environment, controls];
    const keep = <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item);
      return item;
    };

    // ── 조명: 당구장 등처럼 위에서 내리쬐는 스포트라이트 2개 + 은은한 주변광 ──
    scene.add(new THREE.HemisphereLight("#dfe8ff", "#2a2118", 0.55));
    for (const offset of [-length / 4, length / 4]) {
      const lamp = new THREE.SpotLight("#fff4e0", 9, 4, 0.95, 0.55, 1.4);
      lamp.position.set(offset, 1.35, 0);
      lamp.target.position.set(offset, 0, 0);
      lamp.castShadow = true;
      lamp.shadow.mapSize.set(1024, 1024);
      lamp.shadow.bias = -0.0004;
      scene.add(lamp, lamp.target);
    }

    // ── 테이블: 천 · 쿠션 · 나무 레일 · 다이아몬드(포인트) · 포켓 ──
    const cloth = keep(clothTexture());
    const clothMaterial = keep(new THREE.MeshStandardMaterial({ color: pockets ? CLOTH.POOL : CLOTH.CAROM, map: cloth, roughness: 0.95 }));
    const cushionMaterial = keep(new THREE.MeshStandardMaterial({ color: pockets ? CLOTH.POOL : CLOTH.CAROM, roughness: 0.85 }));
    const woodMaterial = keep(new THREE.MeshPhysicalMaterial({ color: "#5a3417", roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    const darkMaterial = keep(new THREE.MeshStandardMaterial({ color: "#050505", roughness: 1 }));
    const pearlMaterial = keep(new THREE.MeshStandardMaterial({ color: "#f3efe2", roughness: 0.3, metalness: 0.1 }));
    const addBox = (sizeX: number, sizeY: number, sizeZ: number, x: number, y: number, z: number, material: THREE.Material, shadows = true) => {
      const mesh = new THREE.Mesh(keep(new THREE.BoxGeometry(sizeX, sizeY, sizeZ)), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };

    const bed = new THREE.Mesh(keep(new THREE.PlaneGeometry(length + CUSHION_DEPTH * 2, width + CUSHION_DEPTH * 2)), clothMaterial);
    bed.rotation.x = -Math.PI / 2;
    bed.receiveShadow = true;
    scene.add(bed);
    const cushionHeight = radius * 1.27;
    const railTop = cushionHeight + 0.01;
    // 포켓 입구에는 쿠션을 끊는다(서버 BilliardsPhysics.Table의 입구 범위와 같게)
    const longSegments: [number, number][] = pockets ? [[0.085, length / 2 - 0.06], [length / 2 + 0.06, length - 0.085]] : [[0, length]];
    const shortSegment: [number, number] = pockets ? [0.085, width - 0.085] : [0, width];
    for (const side of [-1, 1]) {
      for (const [from, to] of longSegments) {
        addBox(to - from, cushionHeight, CUSHION_DEPTH, from + (to - from) / 2 - length / 2, cushionHeight / 2, side * (width / 2 + CUSHION_DEPTH / 2), cushionMaterial);
      }
      addBox(CUSHION_DEPTH, cushionHeight, shortSegment[1] - shortSegment[0], side * (length / 2 + CUSHION_DEPTH / 2), cushionHeight / 2, 0, cushionMaterial);
      // 나무 레일
      const outer = CUSHION_DEPTH + RAIL_WIDTH / 2;
      addBox(length + (CUSHION_DEPTH + RAIL_WIDTH) * 2, 0.05, RAIL_WIDTH, 0, railTop - 0.025, side * (width / 2 + outer), woodMaterial);
      addBox(RAIL_WIDTH, 0.05, width + CUSHION_DEPTH * 2, side * (length / 2 + outer), railTop - 0.025, 0, woodMaterial);
    }
    // 다이아몬드: 긴 레일 7개, 짧은 레일 3개(쿠션 시스템 계산의 기준점)
    const diamondGeometry = keep(new THREE.CylinderGeometry(0.006, 0.006, 0.002, 16));
    const diamondOffset = CUSHION_DEPTH + RAIL_WIDTH * 0.45;
    const addDiamond = (x: number, z: number) => {
      const diamond = new THREE.Mesh(diamondGeometry, pearlMaterial);
      diamond.position.set(x, railTop + 0.001, z);
      scene.add(diamond);
    };
    for (let index = 1; index < 8; index++) {
      const x = -length / 2 + (length * index) / 8;
      addDiamond(x, width / 2 + diamondOffset);
      addDiamond(x, -width / 2 - diamondOffset);
    }
    for (let index = 1; index < 4; index++) {
      const z = -width / 2 + (width * index) / 4;
      addDiamond(length / 2 + diamondOffset, z);
      addDiamond(-length / 2 - diamondOffset, z);
    }
    const pocketCenters: THREE.Vector3[] = [];
    if (pockets) {
      // 구멍은 얇은 검은 원판 두 장(천 높이 + 레일 윗면)으로 그린다. 기둥 모양이면 낮은 시점에서 말뚝처럼 보인다
      const holeGeometry = keep(new THREE.CylinderGeometry(0.062, 0.062, 0.002, 32));
      for (const [x, y] of [[0, 0], [length / 2, -0.02], [length, 0], [0, width], [length / 2, width + 0.02], [length, width]] as const) {
        const center = new THREE.Vector3(x - length / 2, 0, -(y - width / 2));
        const pull = new THREE.Vector3(center.x, 0, center.z).normalize().multiplyScalar(0.015);
        for (const height of [0.0012, railTop + 0.0012]) {
          const hole = new THREE.Mesh(holeGeometry, darkMaterial);
          hole.position.set(center.x + pull.x, height, center.z + pull.z);
          scene.add(hole);
        }
        pocketCenters.push(center);
      }
    }
    // 테이블 몸통과 바닥
    addBox(length + (CUSHION_DEPTH + RAIL_WIDTH) * 2, 0.22, width + (CUSHION_DEPTH + RAIL_WIDTH) * 2, 0, -0.112, 0, woodMaterial, false);
    const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(14, 10)), keep(new THREE.MeshStandardMaterial({ color: "#2b2622", roughness: 0.9 })));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.78;
    floor.receiveShadow = true;
    scene.add(floor);

    // ── 공 ──
    const ballGeometry = keep(new THREE.SphereGeometry(radius, 48, 32));
    const ballMeshes = new Map<number, THREE.Mesh>();
    const lastPositions = new Map<number, THREE.Vector3>();
    for (const ball of latestRef.current.game.balls) {
      const material = keep(new THREE.MeshPhysicalMaterial({ map: keep(ballTexture(variant, ball.id)), roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.04 }));
      const mesh = new THREE.Mesh(ballGeometry, material);
      mesh.castShadow = true;
      // 번호가 위로 보이도록 처음 방향을 돌려 둔다
      mesh.rotation.set(0, Math.PI / 2, -Math.PI / 2);
      scene.add(mesh);
      ballMeshes.set(ball.id, mesh);
    }
    const toWorld = (point: Point, target = new THREE.Vector3()) => target.set(point.x / 1000 - length / 2, radius, -(point.y / 1000 - width / 2));

    /** 공을 새 자리로 옮기며 굴러간 만큼 회전시킨다 */
    const moveBall = (id: number, position: THREE.Vector3 | null) => {
      const mesh = ballMeshes.get(id);
      if (!mesh) return;
      if (!position) {
        mesh.visible = false;
        lastPositions.delete(id);
        return;
      }
      mesh.visible = true;
      const previous = lastPositions.get(id);
      if (previous) {
        const dx = position.x - previous.x;
        const dz = position.z - previous.z;
        const distance = Math.hypot(dx, dz);
        if (distance > 1e-6 && distance < 0.2) {
          const axis = new THREE.Vector3(dz, 0, -dx).normalize();
          mesh.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, distance / radius));
        }
      }
      mesh.position.copy(position);
      lastPositions.set(id, position.clone());
    };

    // ── 큐 ──
    const cue = new THREE.Group();
    const cueLength = 1.45;
    const shaft = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.0062, 0.0105, cueLength * 0.6, 24)), keep(new THREE.MeshPhysicalMaterial({ color: "#e8cf9a", roughness: 0.35, clearcoat: 0.5 })));
    shaft.position.y = cueLength * 0.3;
    const butt = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.0105, 0.0145, cueLength * 0.4, 24)), keep(new THREE.MeshPhysicalMaterial({ color: "#2b1408", roughness: 0.3, clearcoat: 0.8 })));
    butt.position.y = -cueLength * 0.2;
    const ferrule = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.0062, 0.0062, 0.02, 24)), pearlMaterial);
    ferrule.position.y = cueLength * 0.6 + 0.01;
    const tip = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.0062, 0.0062, 0.008, 24)), keep(new THREE.MeshStandardMaterial({ color: "#2f6fd0", roughness: 0.9 })));
    tip.position.y = cueLength * 0.6 + 0.024;
    // 그룹의 원점이 큐 끝(팁)이 되도록 몸통을 아래로 내린다
    const body = new THREE.Group();
    body.add(shaft, butt, ferrule, tip);
    body.position.y = -(cueLength * 0.6 + 0.028);
    body.traverse((child) => {
      child.castShadow = true;
    });
    cue.add(body);
    scene.add(cue);

    // ── 조준선 · 고스트 볼 · 수구를 놓을 자리 ──
    const guideMaterial = keep(new THREE.LineDashedMaterial({ color: "#ffffff", dashSize: 0.025, gapSize: 0.018, transparent: true, opacity: 0.85 }));
    const objectLineMaterial = keep(new THREE.LineBasicMaterial({ color: "#ffd43b" }));
    const cueLineMaterial = keep(new THREE.LineBasicMaterial({ color: "#74c0fc" }));
    const guide = new THREE.Line(keep(new THREE.BufferGeometry()), guideMaterial);
    const objectLine = new THREE.Line(keep(new THREE.BufferGeometry()), objectLineMaterial);
    const cueLine = new THREE.Line(keep(new THREE.BufferGeometry()), cueLineMaterial);
    const ghost = new THREE.Mesh(ballGeometry, keep(new THREE.MeshBasicMaterial({ color: "#ffffff", wireframe: true, transparent: true, opacity: 0.45 })));
    const placeMarker = new THREE.Mesh(ballGeometry, keep(new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.5 })));
    scene.add(guide, objectLine, cueLine, ghost, placeMarker);
    let guideKey = "";
    const setLine = (line: THREE.Line, points: THREE.Vector3[]) => {
      line.geometry.setFromPoints(points);
      // 경계 구를 다시 계산하지 않으면 처음 위치 기준으로 "화면 밖"이라 판단해 선이 사라진다
      line.geometry.computeBoundingSphere();
      line.computeLineDistances();
      line.visible = points.length > 1;
    };
    const updateGuide = (preview: AimPreview | null, visible: boolean) => {
      const key = visible && preview ? JSON.stringify(preview) : "";
      if (key === guideKey) return;
      guideKey = key;
      if (!visible || !preview) {
        guide.visible = objectLine.visible = cueLine.visible = ghost.visible = false;
        return;
      }
      setLine(guide, preview.path.map((point) => toWorld(point)));
      if (preview.kind === "BALL") {
        const ghostWorld = toWorld(preview.ghost);
        ghost.position.copy(ghostWorld);
        ghost.visible = true;
        const target = latestRef.current.game.balls.find((ball) => ball.id === preview.targetId);
        const targetWorld = target ? toWorld(target) : ghostWorld;
        setLine(objectLine, [targetWorld, targetWorld.clone().add(new THREE.Vector3(preview.objectDirection.x, 0, -preview.objectDirection.y).multiplyScalar(0.35))]);
        if (preview.cueDirection) {
          setLine(cueLine, [ghostWorld, ghostWorld.clone().add(new THREE.Vector3(preview.cueDirection.x, 0, -preview.cueDirection.y).multiplyScalar(0.25))]);
        } else {
          cueLine.visible = false;
        }
      } else {
        ghost.visible = objectLine.visible = cueLine.visible = false;
      }
    };

    // ── 포인터: 조준·수구 놓기 ──
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -radius);
    const pointerTable = (event: PointerEvent): Point | null => {
      const bounds = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      return hit ? { x: (hit.x + length / 2) * 1000, y: (-hit.z + width / 2) * 1000 } : null;
    };
    let aiming = false;
    let hoverPoint: Point | null = null;
    const aimAt = (point: Point) => {
      const current = latestRef.current;
      const cueBall = current.game.balls.find((ball) => ball.id === current.aim?.cueId);
      if (!cueBall || !current.aim) return;
      const degrees = (Math.atan2(point.y - cueBall.y, point.x - cueBall.x) * 180) / Math.PI;
      current.onAimDegrees(degrees < 0 ? degrees + 360 : degrees);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const point = pointerTable(event);
      const current = latestRef.current;
      if (!point || replayRef.current) return;
      if (current.placing) {
        current.onPlace(point);
        return;
      }
      if (!current.aim) return;
      aiming = true;
      renderer.domElement.setPointerCapture(event.pointerId);
      aimAt(point);
    };
    const onPointerMove = (event: PointerEvent) => {
      const point = pointerTable(event);
      hoverPoint = point;
      if (aiming && point) aimAt(point);
    };
    const onPointerUp = () => {
      aiming = false;
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);
    const preventMenu = (event: Event) => event.preventDefault();
    renderer.domElement.addEventListener("contextmenu", preventMenu);

    // ── 크기 맞추기 ──
    const resize = () => {
      const widthPx = mount.clientWidth || 640;
      const heightPx = mount.clientHeight || Math.round(widthPx * 0.6);
      renderer.setSize(widthPx, heightPx);
      camera.aspect = widthPx / heightPx;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(mount);

    // ── 시점 ──
    const desiredPosition = new THREE.Vector3();
    const desiredTarget = new THREE.Vector3();
    let lastMode: CameraMode | null = null;
    const updateCamera = () => {
      const current = latestRef.current;
      const mode = current.cameraMode;
      controls.enabled = mode === "FREE";
      if (mode === "FREE") {
        if (lastMode !== "FREE") {
          camera.position.set(0, 1.9, width / 2 + 1.7);
          controls.target.set(0, 0, 0);
        }
        lastMode = mode;
        controls.update();
        return;
      }
      if (mode === "TOP") {
        const verticalHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const horizontalHalf = verticalHalf * camera.aspect;
        const height = Math.max((length / 2 + 0.24) / horizontalHalf, (width / 2 + 0.24) / verticalHalf);
        desiredPosition.set(0, height, 0.01);
        desiredTarget.set(0, 0, 0);
      } else {
        const cueBall = current.game.balls.find((ball) => ball.id === (current.aim?.cueId ?? current.game.cueBalls[current.game.turnSeat ?? 0] ?? 0));
        const cueWorld = cueBall && !cueBall.pocketed ? toWorld(cueBall) : new THREE.Vector3();
        const radians = THREE.MathUtils.degToRad(current.aim?.degrees ?? 0);
        const direction = new THREE.Vector3(Math.cos(radians), 0, -Math.sin(radians));
        desiredPosition.copy(cueWorld).addScaledVector(direction, -0.95).add(new THREE.Vector3(0, 0.38, 0));
        desiredTarget.copy(cueWorld).addScaledVector(direction, 0.7);
      }
      const snap = lastMode !== mode;
      lastMode = mode;
      camera.position.lerp(desiredPosition, snap ? 1 : 0.12);
      controls.target.lerp(desiredTarget, snap ? 1 : 0.12);
      camera.lookAt(controls.target);
    };

    // ── 큐 자세: 팁이 당점 앞에 오고, 힘만큼 뒤로 당긴다 ──
    const updateCue = (aim: AimState | null) => {
      const cueBall = aim ? latestRef.current.game.balls.find((ball) => ball.id === aim.cueId && !ball.pocketed) : null;
      if (!aim || !cueBall || replayRef.current || latestRef.current.placing) {
        cue.visible = false;
        return;
      }
      cue.visible = true;
      const radians = THREE.MathUtils.degToRad(aim.degrees);
      const direction = new THREE.Vector3(Math.cos(radians), 0, -Math.sin(radians));
      const right = new THREE.Vector3(Math.sin(radians), 0, Math.cos(radians));
      const center = toWorld(cueBall);
      const pull = 0.012 + (aim.power / 100) * 0.22;
      const tipPosition = center.clone()
        .addScaledVector(direction, -(radius + pull))
        .addScaledVector(right, (aim.side / 100) * radius)
        .add(new THREE.Vector3(0, (aim.vertical / 100) * radius, 0));
      // 큐는 살짝 들려 있다(레일을 넘어가도록 4°)
      const along = direction.clone().multiplyScalar(Math.cos(THREE.MathUtils.degToRad(4))).add(new THREE.Vector3(0, -Math.sin(THREE.MathUtils.degToRad(4)), 0));
      cue.position.copy(tipPosition);
      cue.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), along.normalize());
    };

    // ── 매 프레임 ──
    let frameId = 0;
    const render = () => {
      frameId = requestAnimationFrame(render);
      const current = latestRef.current;
      const replay = replayRef.current;
      const now = performance.now();
      if (replay) {
        const elapsed = now - replay.startedAt;
        current.game.balls.forEach((ball, index) => {
          const point = positionAt(replay.shot.frames, index, elapsed, FRAME_MS);
          const dropping = replay.dropping.get(ball.id);
          if (point) {
            moveBall(ball.id, toWorld(point));
            return;
          }
          // 포켓으로 빨려 들어가며 떨어지는 모습(0.25초)
          const mesh = ballMeshes.get(ball.id);
          if (!mesh || !mesh.visible) return;
          if (!dropping) {
            const from = mesh.position.clone();
            const pocket = pocketCenters.reduce((best, next) => (next.distanceTo(from) < best.distanceTo(from) ? next : best), pocketCenters[0] ?? from);
            replay.dropping.set(ball.id, { at: now, from, pocket });
            return;
          }
          const ratio = Math.min(1, (now - dropping.at) / 250);
          const position = dropping.from.clone().lerp(dropping.pocket, ratio);
          position.y = radius - ratio * radius * 2.5;
          mesh.position.copy(position);
          if (ratio >= 1) mesh.visible = false;
        });
        const events = replay.shot.events;
        while (replay.nextEvent < events.length && (events[replay.nextEvent]?.timeMs ?? Infinity) <= elapsed) {
          const event = events[replay.nextEvent];
          replay.nextEvent++;
          if (event && current.soundOn && audioRef.current) playSound(audioRef.current, event.type);
        }
        if (elapsed >= replay.shot.durationMs + 300) {
          replayRef.current = null;
          current.onReplayEnd();
        }
      } else {
        for (const ball of current.game.balls) moveBall(ball.id, ball.pocketed ? null : toWorld(ball));
      }
      updateCue(replay ? null : current.aim);
      updateGuide(current.preview, !replay && current.aim !== null && current.showGuide && !current.placing);
      const canPlace = current.placing && !replay && hoverPoint !== null && canPlaceCue({ length: tableLength, width: tableWidth, radius: ballRadius }, current.game.balls, hoverPoint);
      placeMarker.visible = canPlace;
      if (canPlace && hoverPoint) toWorld(hoverPoint, placeMarker.position);
      updateCamera();
      renderer.render(scene, camera);
    };
    render();

    return () => {
      cancelAnimationFrame(frameId);
      observer?.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.domElement.removeEventListener("contextmenu", preventMenu);
      for (const item of disposables) item.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [variant, tableLength, tableWidth, ballRadius, pockets]);

  useEffect(() => () => {
    void audioRef.current?.close();
  }, []);

  if (failed) {
    return <p className="online-hint" role="alert">이 브라우저에서 3D(WebGL)를 쓸 수 없어 당구대를 그릴 수 없습니다. 하드웨어 가속을 켜거나 다른 브라우저로 열어 주세요.</p>;
  }
  return (
    <div
      ref={mountRef}
      className="billiards-stage"
      role="img"
      aria-label={`${props.game.variantLabel} 당구대 3D 화면. 왼쪽 버튼으로 끌면 조준, 오른쪽 버튼으로 끌면 시점 회전, 휠로 확대합니다.`}
    />
  );
};

export default BilliardsTable3D;
