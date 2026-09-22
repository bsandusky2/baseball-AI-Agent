'use client';

import { useEffect, useState } from 'react';
import { divergingColor } from './color-scale';

type HomeRun = {
  date: string;
  exit_velocity: number;
  launch_angle: number;
  distance: number;
  spray_angle: number;
};
type ChartData = { count: number; home_runs: HomeRun[] };

const WIDTH = 640;
const HEIGHT = 340;
const ORIGIN_X = WIDTH / 2;
const ORIGIN_Y = HEIGHT - 40;
const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);
const GRAVITY_FPS2 = 32.174;
const MPH_TO_FPS = 1.4667;
const ARC_SAMPLES = 20;
const FOUL_LINE_DEG = 45;
const TABLE_ROWS = 20;
// Rotates the camera around home plate so neither foul line lands exactly
// on the isometric formula's own x-y axis — at a plain 45°, one foul line
// coincides with that axis and renders as a dead-straight vertical line
// while the other fans naturally, an artifact of the math rather than the
// field. The offset keeps both foul lines visibly slanted, like an actual
// angled camera behind the plate.
const CAMERA_ROTATION_DEG = 20;

function groundXY(distanceFt: number, angleDeg: number) {
  const rad = ((angleDeg + CAMERA_ROTATION_DEG) * Math.PI) / 180;
  return { x: distanceFt * Math.sin(rad), y: distanceFt * Math.cos(rad) };
}

// Ground distance + height (both feet) -> isometric screen position. This is
// the standard two-axis isometric formula (screenX from the x-y difference,
// screenY from their sum, minus height) — the same projection Savant's own
// bat-tracking trajectory page uses to fan real arcs out from home plate.
function project(groundX: number, groundY: number, height: number, scale: number) {
  return {
    x: ORIGIN_X + (groundX - groundY) * COS30 * scale,
    y: ORIGIN_Y - (groundX + groundY) * SIN30 * scale - height * scale * 1.15,
  };
}

// Trajectory shape reconstructed from real launch parameters, not a
// generic decorative arc: peak height comes from the exit velocity's
// vertical component under gravity (exact for the vertical axis, no drag
// needed for that), landing distance is Statcast's own measured
// hit_distance_sc, and the parabola s*(1-s) interpolates between them —
// close enough to a real batted-ball arc to be honest, without pretending
// to model air resistance we don't have the data to compute.
function arcPoints(distanceFt: number, launchAngleDeg: number, exitVelocityMph: number, sprayAngleDeg: number, scale: number) {
  const launchRad = (launchAngleDeg * Math.PI) / 180;
  const vyFps = exitVelocityMph * MPH_TO_FPS * Math.sin(launchRad);
  const peakHeight = Math.max(8, (vyFps * vyFps) / (2 * GRAVITY_FPS2));

  const points = [];
  for (let i = 0; i <= ARC_SAMPLES; i++) {
    const s = i / ARC_SAMPLES;
    const groundDist = distanceFt * s;
    const height = 4 * peakHeight * s * (1 - s);
    const { x: groundX, y: groundY } = groundXY(groundDist, sprayAngleDeg);
    points.push(project(groundX, groundY, height, scale));
  }
  return points;
}

function ChartShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-white">Home Runs</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function HomeRunChart({ fetchUrl }: { fetchUrl: string }) {
  const [data, setData] = useState<ChartData | null>(null);

  useEffect(() => {
    setData(null);
    fetch(fetchUrl)
      .then((res) => res.json())
      .then(setData)
      .catch((err) => console.error('Failed to load home runs', err));
  }, [fetchUrl]);

  if (!data) {
    return (
      <ChartShell>
        <p className="py-16 text-center text-xs text-gray-600">Loading…</p>
      </ChartShell>
    );
  }
  const homeRuns = data.home_runs;
  if (homeRuns.length === 0) {
    return (
      <ChartShell>
        <p className="py-16 text-center text-xs text-gray-600">No home runs recorded</p>
      </ChartShell>
    );
  }

  const maxDistance = Math.max(...homeRuns.map((hr) => hr.distance));
  const scale = (HEIGHT - 60) / (maxDistance * (SIN30 * 2));

  const minEV = Math.min(...homeRuns.map((hr) => hr.exit_velocity));
  const maxEV = Math.max(...homeRuns.map((hr) => hr.exit_velocity));

  const fenceDistance = maxDistance * 1.05;
  const leftFoulGround = groundXY(fenceDistance, -FOUL_LINE_DEG);
  const rightFoulGround = groundXY(fenceDistance, FOUL_LINE_DEG);
  const leftFoul = project(leftFoulGround.x, leftFoulGround.y, 0, scale);
  const rightFoul = project(rightFoulGround.x, rightFoulGround.y, 0, scale);
  const plate = project(0, 0, 0, scale);
  const fieldArc = [];
  for (let deg = -FOUL_LINE_DEG; deg <= FOUL_LINE_DEG; deg += 5) {
    const { x: gx, y: gy } = groundXY(fenceDistance, deg);
    fieldArc.push(project(gx, gy, 0, scale));
  }
  const fieldWedge = `M ${plate.x} ${plate.y} L ${fieldArc.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`;

  return (
    <ChartShell>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
            <path d={fieldWedge} fill="#1baf7a" fillOpacity={0.12} stroke="none" />
            <line x1={plate.x} y1={plate.y} x2={leftFoul.x} y2={leftFoul.y} stroke="#383835" strokeWidth={1} />
            <line x1={plate.x} y1={plate.y} x2={rightFoul.x} y2={rightFoul.y} stroke="#383835" strokeWidth={1} />

            {homeRuns.map((hr, i) => {
              const points = arcPoints(hr.distance, hr.launch_angle, hr.exit_velocity, hr.spray_angle, scale);
              const path = points.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              const color = divergingColor(hr.exit_velocity, minEV, maxEV);
              return <path key={i} d={path} fill="none" stroke={color} strokeWidth={1.25} strokeOpacity={0.75} />;
            })}

            <circle cx={plate.x} cy={plate.y} r={4} fill="#fcfcfb" stroke="#0d0d0d" strokeWidth={1} />
          </svg>

          <div className="mt-1 flex items-center justify-center gap-2 text-[10px] text-gray-500">
            <span>{minEV.toFixed(0)} mph</span>
            <div className="h-2 w-24 rounded-full" style={{ background: 'linear-gradient(to right, #2a78d6, #f0efec, #e34948)' }} />
            <span>{maxEV.toFixed(0)} mph</span>
            <span className="ml-1 uppercase tracking-wide">Exit Velocity</span>
          </div>
        </div>

        <div>
          <div className="max-h-[300px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Exit Velocity</th>
                  <th className="pb-2 pr-4 font-medium">Distance</th>
                  <th className="pb-2 font-medium">Launch Angle</th>
                </tr>
              </thead>
              <tbody>
                {homeRuns.slice(0, TABLE_ROWS).map((hr, i) => (
                  <tr key={i} className="border-t border-gray-800">
                    <td className="py-1.5 pr-4 text-gray-300">{hr.date}</td>
                    <td className="py-1.5 pr-4 font-semibold text-white">{hr.exit_velocity.toFixed(1)} mph</td>
                    <td className="py-1.5 pr-4 font-semibold text-white">{hr.distance.toFixed(0)} ft</td>
                    <td className="py-1.5 font-semibold text-white">{hr.launch_angle.toFixed(0)}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] text-gray-600">
            Showing {Math.min(TABLE_ROWS, homeRuns.length)} of {data.count} home runs, most recent first.
          </p>
        </div>
      </div>
    </ChartShell>
  );
}
