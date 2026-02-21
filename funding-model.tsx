import { useState } from "react";

const M = (v) => `$${v.toFixed(2)}M`;

export default function FundingModel() {
  const [accel, setAccel] = useState(5);
  const [incub, setIncub] = useState(5);

  const a = accel;
  const b = incub;

  const budgets = { 2026: 0, 2027: 1, 2028: 3, 2029: 5, 2030: 5, 2031: 5, 2032: 5 };

  // Accelerator: starts Jul 1 each year, $150K/yr for 3 years
  // Per cohort: year0=half($75K), year1=full($150K), year2=full($150K), year3=half-end($75K)
  const accelSpend = (yr) => {
    let s = 0;
    for (let c = 2026; c <= yr; c++) {
      const diff = yr - c;
      if (diff === 0) s += 0.075; // half year start
      else if (diff === 1) s += 0.15; // full year
      else if (diff === 2) s += 0.15; // full year
      else if (diff === 3) s += 0.075; // half year end
    }
    return s * a;
  };

  // Incubator: starts Jan 1 each year from 2027, $50K/yr for 3 years
  const incubSpend = (yr) => {
    let s = 0;
    for (let c = 2027; c <= yr; c++) {
      const diff = yr - c;
      if (diff >= 0 && diff <= 2) s += 0.05;
    }
    return s * b;
  };

  // SEED: $1M/yr in 2026 and 2027 only
  const seedSpend = (yr) => (yr <= 2027 ? 1.0 : 0);
  const capitalSpend = 0.5;

  // New allocations each year (full project value)
  const newAllocAccel = (yr) => (yr >= 2026 ? a * 0.45 : 0);
  const newAllocIncub = (yr) => (yr >= 2027 ? b * 0.15 : 0);
  const newAllocCapital = 0.5;

  const yrs = [2026, 2027, 2028, 2029, 2030, 2031, 2032];
  const rows = [];

  let A = 4.7;
  let X = 2.0; // existing SEED

  for (const yr of yrs) {
    const B = budgets[yr];
    const sAccel = accelSpend(yr);
    const sIncub = incubSpend(yr);
    const sSeed = seedSpend(yr);
    const S = sSeed + capitalSpend + sAccel + sIncub;
    const Y = newAllocAccel(yr) + newAllocIncub(yr) + newAllocCapital;
    const maxSpend = A + B;
    const ok = S <= maxSpend + 0.001;
    const Ap = A + B - S;
    const Xp = X + Y - S;
    const clawback = (X + Y) < B - 0.001;
    const clawAmt = Math.max(0, B - X - Y);

    rows.push({ yr, A, B, maxSpend, sSeed, sAccel, sIncub, S, X, Y, Ap, Xp, ok, clawback, clawAmt });
    A = Ap;
    X = Xp;
  }

  const allOk = rows.every((r) => r.ok);
  const noClawback = rows.every((r) => !r.clawback);
  const bindingYear = rows.find((r) => !r.ok);

  // Steady state check: at $5M budget, spend = 0.5 + 0.45a + 0.15b
  const steadySpend = 0.5 + 0.45 * a + 0.15 * b;
  const steadyOk = steadySpend <= 5.0;

  const c = "px-2 py-1.5 text-xs border border-gray-200 text-right";
  const h = "px-2 py-1.5 text-xs font-semibold border border-gray-200 bg-gray-50 text-right";
  const lbl = "px-2 py-1.5 text-xs border border-gray-200 text-left whitespace-nowrap";
  const lblH = "px-2 py-1.5 text-xs font-semibold border border-gray-200 bg-gray-50 text-left whitespace-nowrap";

  // Active cohort counts
  const activeCohorts = (yr) => {
    let ac = 0, ic = 0;
    for (let cy = 2026; cy <= yr; cy++) { const d = yr - cy; if (d >= 0 && d <= 3) ac++; }
    for (let cy = 2027; cy <= yr; cy++) { const d = yr - cy; if (d >= 0 && d <= 2) ic++; }
    return { ac, ic };
  };

  // Suggested combos
  const combos = [];
  for (let ai = 0; ai <= 12; ai += 1) {
    for (let bi = 0; bi <= 30; bi += 1) {
      // Check all years
      let valid = true;
      let tA = 4.7, tX = 2.0;
      for (const yr of yrs) {
        const B = budgets[yr];
        let sA = 0;
        for (let cc = 2026; cc <= yr; cc++) { const d = yr - cc; if (d===0) sA+=0.075; else if(d===1||d===2) sA+=0.15; else if(d===3) sA+=0.075; }
        sA *= ai;
        let sI = 0;
        for (let cc = 2027; cc <= yr; cc++) { const d = yr - cc; if (d>=0&&d<=2) sI+=0.05; }
        sI *= bi;
        const S = seedSpend(yr) + 0.5 + sA + sI;
        if (S > tA + B + 0.001) { valid = false; break; }
        tA = tA + B - S;
        tX = tX + (yr>=2026?ai*0.45:0) + (yr>=2027?bi*0.15:0) + 0.5 - S;
      }
      // Also check steady state
      const ss = 0.5 + 0.45*ai + 0.15*bi;
      if (valid && ss <= 5.0) combos.push({a:ai, b:bi});
    }
  }
  // Get pareto-optimal combos (max total grants)
  const pareto = [];
  let maxB = -1;
  const sortedByA = [...combos].sort((x,y) => x.a - y.a);
  for (let ai = 0; ai <= 12; ai++) {
    const matching = combos.filter(c => c.a === ai);
    if (matching.length > 0) {
      const best = matching.reduce((p, c) => c.b > p.b ? c : p);
      pareto.push(best);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 font-sans">
      <h1 className="text-xl font-bold mb-1">Rolling Research Funding Model</h1>
      <p className="text-gray-500 text-xs mb-4">Annual cohorts of accelerator & incubator grants with overlapping spend</p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <h2 className="font-semibold text-blue-900 text-sm mb-2">Assumptions</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-blue-800">
          <div>Starting accrual (2026): <strong>$4.70M</strong></div>
          <div>Existing SEED: <strong>$2M allocated, $1M/yr spend (2026-27)</strong></div>
          <div>Capital/infrastructure: <strong>$500K/yr</strong> (ongoing)</div>
          <div>Budget: <strong>$0→$1M→$3M→$5M→$5M...</strong></div>
          <div>Accelerator: <strong>$450K/3yr</strong>, new cohort Jul 1 each year</div>
          <div>Incubator: <strong>$150K/3yr</strong>, new cohort Jan 1 each year (from 2027)</div>
          <div>Steady state spend: <strong>{M(steadySpend)}</strong>/yr {steadyOk ? "✅" : "❌ exceeds $5M"}</div>
          <div>Overlapping accel cohorts (steady): <strong>4</strong> | incub: <strong>3</strong></div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-6 mb-3">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">
              Accelerators per year: <span className="text-blue-600 font-bold text-lg">{accel}</span>
              <span className="text-gray-400 ml-1">({accel * 4} overlapping at steady state)</span>
            </label>
            <input type="range" min={0} max={12} value={accel} onChange={(e) => setAccel(+e.target.value)} className="w-full" />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">
              Incubators per year: <span className="text-green-600 font-bold text-lg">{incub}</span>
              <span className="text-gray-400 ml-1">({incub * 3} overlapping at steady state)</span>
            </label>
            <input type="range" min={0} max={25} value={incub} onChange={(e) => setIncub(+e.target.value)} className="w-full" />
          </div>
        </div>
        <div className={`rounded-lg p-2 text-center text-sm font-semibold ${allOk && noClawback && steadyOk ? "bg-green-100 text-green-800" : allOk && steadyOk ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>
          {!steadyOk
            ? `❌ Steady-state spend (${M(steadySpend)}) exceeds $5M budget`
            : !allOk
            ? `❌ Spending exceeds available funds in ${bindingYear?.yr}`
            : noClawback
            ? "✅ All constraints satisfied — this combination is sustainable!"
            : "⚠️ Spending OK, but some years risk QF clawback (need more allocations)"}
        </div>
      </div>

      <div className="overflow-x-auto mb-4">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr><th className={lblH}></th>{rows.map(r => <th key={r.yr} className={h}>{r.yr}</th>)}</tr>
          </thead>
          <tbody>
            <tr className="bg-blue-50">
              <td className={lbl}>A (Accrued in)</td>
              {rows.map(r => <td key={r.yr} className={c}>{M(r.A)}</td>)}
            </tr>
            <tr className="bg-blue-50">
              <td className={lbl}>B (New budget)</td>
              {rows.map(r => <td key={r.yr} className={c}>{M(r.B)}</td>)}
            </tr>
            <tr className="bg-blue-50 font-semibold">
              <td className={lbl}>A+B (Available)</td>
              {rows.map(r => <td key={r.yr} className={c}>{M(r.maxSpend)}</td>)}
            </tr>

            <tr><td colSpan={8} className="h-px bg-gray-300"></td></tr>

            <tr>
              <td className={`${lbl} text-gray-500 pl-4`}>SEED spend</td>
              {rows.map(r => <td key={r.yr} className={`${c} ${r.sSeed>0?"":"text-gray-300"}`}>{M(r.sSeed)}</td>)}
            </tr>
            <tr>
              <td className={`${lbl} text-gray-500 pl-4`}>Capital spend</td>
              {rows.map(r => <td key={r.yr} className={c}>{M(capitalSpend)}</td>)}
            </tr>
            <tr>
              <td className={`${lbl} text-blue-600 pl-4`}>Accelerator spend</td>
              {rows.map(r => <td key={r.yr} className={c}>{M(r.sAccel)}</td>)}
            </tr>
            <tr>
              <td className={`${lbl} text-blue-500 pl-6`}>↳ active cohorts</td>
              {rows.map(r => { const ac = activeCohorts(r.yr); return <td key={r.yr} className={`${c} text-gray-400`}>{ac.ac}</td>; })}
            </tr>
            <tr>
              <td className={`${lbl} text-green-600 pl-4`}>Incubator spend</td>
              {rows.map(r => <td key={r.yr} className={c}>{M(r.sIncub)}</td>)}
            </tr>
            <tr>
              <td className={`${lbl} text-green-500 pl-6`}>↳ active cohorts</td>
              {rows.map(r => { const ac = activeCohorts(r.yr); return <td key={r.yr} className={`${c} text-gray-400`}>{ac.ic}</td>; })}
            </tr>

            <tr className="bg-orange-50 font-semibold">
              <td className={lbl}>S (Total spend)</td>
              {rows.map(r => <td key={r.yr} className={`${c} ${r.ok?"":"text-red-600 bg-red-100"}`}>{M(r.S)} {!r.ok&&"❌"}</td>)}
            </tr>
            <tr className="bg-orange-50">
              <td className={`${lbl} text-orange-700`}>Headroom (A+B-S)</td>
              {rows.map(r => <td key={r.yr} className={`${c} ${r.ok?"text-green-700":"text-red-600"}`}>{M(r.maxSpend - r.S)}</td>)}
            </tr>

            <tr><td colSpan={8} className="h-px bg-gray-300"></td></tr>

            <tr>
              <td className={lbl}>X (Allocated unspent in)</td>
              {rows.map(r => <td key={r.yr} className={c}>{M(r.X)}</td>)}
            </tr>
            <tr>
              <td className={lbl}>Y (New allocations)</td>
              {rows.map(r => <td key={r.yr} className={c}>{M(r.Y)}</td>)}
            </tr>

            <tr><td colSpan={8} className="h-px bg-gray-300"></td></tr>

            <tr className="bg-purple-50">
              <td className={`${lbl} font-semibold`}>A' (Accrued out)</td>
              {rows.map(r => <td key={r.yr} className={c}>{M(r.Ap)}</td>)}
            </tr>
            <tr className="bg-purple-50">
              <td className={`${lbl} font-semibold`}>X' (Allocated unspent out)</td>
              {rows.map(r => <td key={r.yr} className={`${c} ${r.Xp<0?"text-red-600 bg-red-100":""}`}>{M(r.Xp)}</td>)}
            </tr>
            <tr>
              <td className={lbl}>QF Clawback risk?</td>
              {rows.map(r => <td key={r.yr} className={`${c} ${r.clawback?"text-yellow-600":"text-green-600"}`}>{r.clawback?`Yes ${M(r.clawAmt)}`:"No"}</td>)}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
        <h3 className="font-semibold text-sm mb-2">Maximum Feasible Combinations</h3>
        <p className="text-xs text-gray-500 mb-1">Steady state constraint: <strong>0.45a + 0.15b ≤ 4.5</strong> → <strong>3a + b ≤ 30</strong></p>
        <p className="text-xs text-gray-500 mb-3">Plus early-year spending constraints (2026-2028 are tightest)</p>
        <div className="grid grid-cols-4 gap-1.5">
          {pareto.filter(p => p.a <= 10 && p.a % 1 === 0).map((p) => (
            <button key={`${p.a}-${p.b}`} onClick={() => { setAccel(p.a); setIncub(p.b); }}
              className={`text-xs p-1.5 rounded border transition-colors ${accel===p.a && incub===p.b ? "bg-blue-100 border-blue-400 font-bold" : "bg-white border-gray-200 hover:bg-gray-50"}`}>
              <span className="text-blue-600">{p.a}</span> accel + <span className="text-green-600">{p.b}</span> incub
            </button>
          ))}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
        <strong>Key insight:</strong> With rolling cohorts, you eventually reach <strong>4 overlapping accelerator cohorts</strong> and <strong>3 overlapping incubator cohorts</strong>. The steady-state annual spend is $500K (capital) + ${(0.45*a*1000).toFixed(0)}K (accel) + ${(0.15*b*1000).toFixed(0)}K (incub) = {M(steadySpend)}. This must stay under the $5M annual budget. The <strong>early years (2027-2028)</strong> are the tightest because SEED is still running and the budget hasn't fully ramped up.
      </div>
    </div>
  );
}
