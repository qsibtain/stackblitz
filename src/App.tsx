import { useState } from "react";

  // Version 1.0
  const M = (v: number) => `$${v.toFixed(2)}M`;
  const K = (v: number) => `$${v}K`;

  export default function FundingModel() {
    const [accel, setAccel] = useState(4);
    const [incub, setIncub] = useState(12);
    const [capital, setCapital] = useState(350);
    const [ugResearch, setUgResearch] = useState(100);

    const a = accel;
    const b = incub;
    const capM = capital / 1000;
    const ugM = ugResearch / 1000;
    const ugSpend = (yr: number) => yr === 2026 ? ugM / 2 : ugM;

    const budgets: Record<number, number> = { 2026: 0, 2027: 1, 2028: 4, 2029: 5, 2030: 5, 2031: 5, 2032: 5 };

    const seedAllocated = 1.12;
    const seedAdditional = 1.85;
    const seedTotal = seedAllocated + seedAdditional;
    const seedMonthly = seedTotal / 30;

    const seedSpend = (yr: number) => {
      if (yr === 2026) return 12 * seedMonthly;
      if (yr === 2027) return 12 * seedMonthly;
      if (yr === 2028) return 6 * seedMonthly;
      return 0;
    };

    const accelSpend = (yr: number) => {
      let s = 0;
      for (let c = 2026; c <= yr; c++) {
        const diff = yr - c;
        if (diff === 0) s += 0.075;
        else if (diff === 1) s += 0.15;
        else if (diff === 2) s += 0.15;
        else if (diff === 3) s += 0.075;
      }
      return s * a;
    };

    const incubSpend = (yr: number) => {
      let s = 0;
      for (let c = 2027; c <= yr; c++) {
        const diff = yr - c;
        if (diff >= 0 && diff <= 2) s += 0.05;
      }
      return s * b;
    };

    const startupSpend = (yr: number) => {
      let s = 0;
      for (let c = 2026; c <= yr; c++) {
        const diff = yr - c;
        if (diff >= 0 && diff <= 1) s += 3 * 0.025;
      }
      return s;
    };

    const activeCohorts = (yr: number) => {
      let ac = 0, ic = 0, sc = 0;
      for (let cy = 2026; cy <= yr; cy++) { const d = yr - cy; if (d >= 0 && d <= 3) ac++; }
      for (let cy = 2027; cy <= yr; cy++) { const d = yr - cy; if (d >= 0 && d <= 2) ic++; }
      for (let cy = 2026; cy <= yr; cy++) { const d = yr - cy; if (d >= 0 && d <= 1) sc++; }
      return { ac, ic, sc };
    };

    const centralAllowance = (yr: number) => {
      const { ac, ic } = activeCohorts(yr);
      const accelEmps = ac * a * 1.5;
      const incubEmps = ic * b * 0.5;
      const totalEmps = accelEmps + incubEmps;
      const premium = Math.floor(totalEmps / 10);
      const regular = totalEmps - premium;
      return regular * 0.008 + premium * 0.030;
    };

    const newAllocAccel = (yr: number) => (yr >= 2026 ? a * 0.45 : 0);
    const newAllocIncub = (yr: number) => (yr >= 2027 ? b * 0.15 : 0);
    const newAllocStartup = 3 * 0.05;

    const yrs = [2026, 2027, 2028, 2029, 2030, 2031, 2032];
    const rows: any[] = [];

    let A = 4.7;
    let X = seedTotal;

    for (const yr of yrs) {
      const B = budgets[yr];
      const sAccel = accelSpend(yr);
      const sIncub = incubSpend(yr);
      const sSeed = seedSpend(yr);
      const sStartup = startupSpend(yr);
      const sCentral = centralAllowance(yr);
      const S = sSeed + capM + ugSpend(yr) + sAccel + sIncub + sStartup + sCentral;
      const Y = newAllocAccel(yr) + newAllocIncub(yr) + capM + ugSpend(yr) + newAllocStartup + sCentral;
      const maxSpend = A + B;
      const ok = S <= maxSpend + 0.001;
      const Ap = A + B - S;
      const Xp = X + Y - S;

      const normalClawback = (X + Y) < B - 0.001;
      const firstYearClawback = yr === 2026 && (Xp + S) < 4.70 - 0.001;
      const clawback = normalClawback || firstYearClawback;
      const clawAmt = normalClawback ? Math.max(0, B - X - Y) : (firstYearClawback ? Math.max(0, 4.70 - Xp - S) : 0);

      rows.push({ yr, A, B, maxSpend, sSeed, sAccel, sIncub, sStartup, sCentral, S, X, Y, Ap, Xp, ok, clawback, clawAmt });
      A = Math.max(0,Ap);
      X = Xp;
    }

    const allOk = rows.every((r) => r.ok);
    const noClawback = rows.every((r) => !r.clawback);
    const bindingYear = rows.find((r) => !r.ok);

    const steadyRow = rows[rows.length - 1];
    const steadySpend = steadyRow ? steadyRow.S : 0;
    const steadyCentral = centralAllowance(2032);

    const steadyAccelEmps = 4 * a * 1.5;
    const steadyIncubEmps = 3 * b * 0.5;
    const steadyTotalEmps = steadyAccelEmps + steadyIncubEmps;

    const c = "px-2 py-1.5 text-xs border border-gray-200 text-right";
    const h = "px-2 py-1.5 text-xs font-semibold border border-gray-200 bg-gray-50 text-right";
    const lbl = "px-2 py-1.5 text-xs border border-gray-200 text-left whitespace-nowrap";
    const lblH = "px-2 py-1.5 text-xs font-semibold border border-gray-200 bg-gray-50 text-left whitespace-nowrap";

    const fixedAnnual = capM + ugM;

    return (
      <div className="max-w-5xl mx-auto p-4 font-sans">
        <h1 className="text-xl font-bold mb-1">Rolling Research Funding Model</h1>
        <p className="text-gray-500 text-xs mb-4">Annual cohorts of accelerator & incubator grants with overlapping spend</p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <h2 className="font-semibold text-blue-900 text-sm mb-2">Assumptions</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-blue-800">
            <div>Starting accrual (2026): <strong>$4.70M</strong></div>
            <div>Budget: <strong>$0→$1M→$4M→$5M→$5M...</strong></div>
            <div>SEED: <strong>{M(seedAllocated)} allocated + {M(seedAdditional)} additional = {M(seedTotal)}</strong></div>
            <div>SEED spend: <strong>{M(seedMonthly * 12)}/yr</strong> over 30 months (Jan '26–Jun '28)</div>
            <div>Capital/infrastructure: <strong>{K(capital)}/yr</strong> (ongoing)</div>
            <div>Undergraduate Research: <strong>{K(ugResearch)}/yr</strong> (half in 2026, starts mid-year)</div>
            <div>Start-up grants: <strong>$50K/2yr</strong>, 3 awards/yr</div>
            <div>Central allowance: <strong>$8K/emp/yr + $30K/1-in-10 emp/yr </strong></div>
            <div>Accelerator: <strong>$450K/3yr</strong>, new cohort Jul 1 each year</div>
            <div>Incubator: <strong>$150K/3yr</strong>, new cohort Jan 1 each year (from 2027)</div>
            <div>Steady state spend: <strong>{M(steadySpend)}</strong>/yr (budget: $5M + any accrual)</div>
            <div>Steady state employees: <strong>{steadyTotalEmps}</strong> ({steadyAccelEmps} accel + {steadyIncubEmps} incub)</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Accelerators per year: <span className="text-blue-600 font-bold text-lg">{accel}</span>
                <span className="text-gray-400 ml-1">({accel * 4} overlapping at steady state)</span>
              </label>
              <input type="range" min={0} max={12} value={accel} onChange={(e) => setAccel(+e.target.value)} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Incubators per year: <span className="text-green-600 font-bold text-lg">{incub}</span>
                <span className="text-gray-400 ml-1">({incub * 3} overlapping at steady state)</span>
              </label>
              <input type="range" min={0} max={25} value={incub} onChange={(e) => setIncub(+e.target.value)} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Capital/Infrastructure: <span className="text-purple-600 font-bold text-lg">{K(capital)}</span>/yr
              </label>
              <input type="range" min={0} max={2000} step={50} value={capital} onChange={(e) => setCapital(+e.target.value)} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Undergraduate Research: <span className="text-orange-600 font-bold text-lg">{K(ugResearch)}</span>/yr
              </label>
              <input type="range" min={0} max={500} step={25} value={ugResearch} onChange={(e) => setUgResearch(+e.target.value)} className="w-full" />
            </div>
          </div>
          <div className="text-xs text-gray-500 mb-3">
            Fixed annual: <strong>{M(fixedAnnual)}</strong> (capital + UG) | Start-ups: <strong>$150K/yr</strong> (3 x $50K) | Central allowance (steady):
  <strong>{M(steadyCentral)}</strong>
          </div>
           <div className={`rounded-lg p-2 text-center text-sm font-semibold ${allOk && noClawback ? "bg-green-100 text-green-800" : allOk ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>
              {!allOk
              ? `❌ Spending exceeds available funds in ${bindingYear?.yr}`
              : noClawback
              ? "✅ All constraints satisfied — this combination is sustainable!"
              : "⚠️ Spending OK, but some years risk QF clawback (need more allocations)"}
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-4">
          <strong>Key insight:</strong> At steady state you have <strong>{a * 4} active accelerator awards</strong> ({4} cohorts x {a}), <strong>{b * 3} active
  incubator awards</strong> ({3} cohorts x {b}), and <strong>6 start-up awards</strong> (2 cohorts x 3). Annual spend: {K(capital)} (capital) + {K(ugResearch)} (UG
   research) + $150K (start-ups) + ${(0.45 * a * 1000).toFixed(0)}K (accel) + ${(0.15 * b * 1000).toFixed(0)}K (incub) + {M(steadyCentral)} (central allowance for {steadyTotalEmps} employees) = <strong>{M(steadySpend)}</strong>. This must stay under the $5M annual budget + any accrual.
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
                {rows.map(r => <td key={r.yr} className={`${c} ${r.sSeed > 0 ? "" : "text-gray-300"}`}>{M(r.sSeed)}</td>)}
              </tr>
              <tr>
                <td className={`${lbl} text-purple-600 pl-4`}>Capital/Infrastructure</td>
                {rows.map(r => <td key={r.yr} className={c}>{M(capM)}</td>)}
              </tr>
              <tr>
                <td className={`${lbl} text-orange-600 pl-4`}>Undergraduate Research</td>
                {rows.map(r => <td key={r.yr} className={c}>{M(ugSpend(r.yr))}</td>)}
              </tr>
              <tr>
                <td className={`${lbl} text-teal-600 pl-4`}>Start-up grants</td>
                {rows.map(r => <td key={r.yr} className={c}>{M(r.sStartup)}</td>)}
              </tr>
              <tr>
                <td className={`${lbl} text-teal-500 pl-6`}>↳ active awards</td>
                {rows.map(r => { const { sc } = activeCohorts(r.yr); return <td key={r.yr} className={`${c} text-gray-400`}>{sc * 3}</td>; })}
              </tr>
              <tr>
                <td className={`${lbl} text-blue-600 pl-4`}>Accelerator spend</td>
                {rows.map(r => <td key={r.yr} className={c}>{M(r.sAccel)}</td>)}
              </tr>
              <tr>
                <td className={`${lbl} text-blue-500 pl-6`}>↳ active awards</td>
                {rows.map(r => { const { ac } = activeCohorts(r.yr); return <td key={r.yr} className={`${c} text-gray-400`}>{ac * a}</td>; })}
              </tr>
              <tr>
                <td className={`${lbl} text-green-600 pl-4`}>Incubator spend</td>
                {rows.map(r => <td key={r.yr} className={c}>{M(r.sIncub)}</td>)}
              </tr>
              <tr>
                <td className={`${lbl} text-green-500 pl-6`}>↳ active awards</td>
                {rows.map(r => { const { ic } = activeCohorts(r.yr); return <td key={r.yr} className={`${c} text-gray-400`}>{ic * b}</td>; })}
              </tr>
              <tr>
                <td className={`${lbl} text-red-600 pl-4`}>Central allowance</td>
                {rows.map(r => <td key={r.yr} className={c}>{M(r.sCentral)}</td>)}
              </tr>
              <tr>
                <td className={`${lbl} text-red-500 pl-6`}>↳ employees</td>
                {rows.map(r => { const { ac, ic } = activeCohorts(r.yr); const emps = ac * a * 1.5 + ic * b * 0.5; return <td key={r.yr} className={`${c}
  text-gray-400`}>{emps}</td>; })}
              </tr>

              <tr className="bg-orange-50 font-semibold">
                <td className={lbl}>S (Total spend)</td>
                {rows.map(r => <td key={r.yr} className={`${c} ${r.ok ? "" : "text-red-600 bg-red-100"}`}>{M(r.S)} {!r.ok && "❌"}</td>)}
              </tr>
              <tr className="bg-orange-50">
                <td className={`${lbl} text-orange-700`}>Headroom (A+B-S)</td>
                {rows.map(r => <td key={r.yr} className={`${c} ${r.ok ? "text-green-700" : "text-red-600"}`}>{M(r.maxSpend - r.S)}</td>)}
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
                {rows.map(r => <td key={r.yr} className={`${c} ${r.Xp < 0 ? "text-red-600 bg-red-100" : ""}`}>{M(r.Xp)}</td>)}
              </tr>
              <tr>
                <td className={lbl}>QF Clawback risk?</td>
                {rows.map(r => <td key={r.yr} className={`${c} ${r.clawback ? "text-yellow-600" : "text-green-600"}`}>{r.clawback ? `Yes ${M(r.clawAmt)}` :
  "No"}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }
