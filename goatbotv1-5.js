// goatbot v1.5 - 1.576 average score
// deployed 9/3/26

export default function bot({ history, memory }) {
  const C = "C", D = "D";

  const init = () => ({
    oppC: 0,
    oppD: 0,
    oppDefStreak: 0,
    oppCoopStreak: 0,
    score: 0,
    testedDefection: false,
    logp: [0, 0, 0, 0, 0, 0, 0],
    hardLock: false,
    exploitLock: false,
    exploitStep: 0,
    forgive: 0,
    lastProbe: -99,
    probeCooldown: 0,
    recentOpp: [],
    recentMy: [],
    punishAfterOurD: 0,
    opportunitiesAfterOurD: 0,
    chaos: 0,
    phase: 0
  });

  const norm = x => (x === D ? D : C);

  try {
    memory = memory && typeof memory === "object" && Array.isArray(memory.logp) ? memory : init();
    const n = history.length;
    if (n === 0) return [C, memory];

    const last = history[n - 1];
    const myLast = norm(last.you);
    const oppLast = norm(last.opponent);

    if (oppLast === C) {
      memory.oppC++;
      memory.oppCoopStreak++;
      memory.oppDefStreak = 0;
    } else {
      memory.oppD++;
      memory.oppDefStreak++;
      memory.oppCoopStreak = 0;
    }

    if (myLast === D) memory.testedDefection = true;

    memory.score +=
      myLast === C && oppLast === C ? 2 :
      myLast === D && oppLast === C ? 3 :
      myLast === C && oppLast === D ? 0 : 1;

    memory.recentOpp.push(oppLast);
    memory.recentMy.push(myLast);
    if (memory.recentOpp.length > 18) memory.recentOpp.shift();
    if (memory.recentMy.length > 18) memory.recentMy.shift();

    if (n >= 2) {
      const prev = history[n - 2];
      const prevYou = norm(prev.you);
      const prevOpp = norm(prev.opponent);

      if (prevYou === D) {
        memory.opportunitiesAfterOurD++;
        if (oppLast === D) memory.punishAfterOurD++;
      }

      const predAllC = C;
      const predAllD = D;
      const predTFT = prevYou;
      const predGTFT = prevYou === D ? D : C;
      const predWSLS = prevYou === prevOpp ? prevYou : (prevYou === C ? D : C);
      const predGrim = memory.testedDefection ? D : C;
      const predAlt = prevOpp === C ? D : C;

      const preds = [predAllC, predAllD, predTFT, predGTFT, predWSLS, predGrim, predAlt];
      const eps = 0.055;
      for (let i = 0; i < preds.length; i++) {
        memory.logp[i] += Math.log(preds[i] === oppLast ? 1 - eps : eps);
      }

      const flip = norm(history[n - 2].opponent) !== oppLast;
      if (flip) memory.chaos = Math.min(memory.chaos + 1, 60);
      else memory.chaos = Math.max(memory.chaos - 1, 0);
    }

    const total = memory.oppC + memory.oppD;
    const defRate = total ? memory.oppD / total : 0;
    const coopRate = 1 - defRate;
    const avg = memory.score / n;
    const punishRate = memory.opportunitiesAfterOurD ? memory.punishAfterOurD / memory.opportunitiesAfterOurD : 0;

    const lp = memory.logp;
    const mx = Math.max(lp[0], lp[1], lp[2], lp[3], lp[4], lp[5], lp[6]);
    const ex = lp.map(v => Math.exp(v - mx));
    const z = ex.reduce((a, b) => a + b, 0);
    const p = ex.map(v => v / z);

    const pAllC = p[0], pAllD = p[1], pTFT = p[2], pGTFT = p[3], pWSLS = p[4], pGrim = p[5], pAlt = p[6];
    const pRecip = pTFT + pGTFT + pWSLS;
    const pHard = pAllD + pGrim;
    const pMax = Math.max(...p);

    const looksRandom = n >= 20 && pMax < 0.42 && defRate > 0.2 && defRate < 0.8 && memory.chaos > 10;

    if (memory.probeCooldown > 0) memory.probeCooldown--;
    if (memory.forgive > 0) memory.forgive--;

    if (n < 6) {
      const open = [C, C, D, C, C, D];
      return [open[n] || C, memory];
    }

    if (
      memory.oppDefStreak >= 3 ||
      (total >= 8 && defRate > 0.69) ||
      (n >= 8 && pHard > 0.78) ||
      (looksRandom && defRate > 0.42) ||
      (n >= 24 && avg < 0.9)
    ) {
      memory.hardLock = true;
    }

    if (memory.hardLock) {
      if (memory.oppCoopStreak >= 4 && defRate < 0.56) {
        memory.hardLock = false;
      } else {
        if (n % 23 === 0 && coopRate > 0.14) return [C, memory];
        return [D, memory];
      }
    }

    let dd = 0;
    for (let i = n - 1; i >= 0 && i >= n - 8; i--) {
      const h = history[i];
      if (norm(h.you) === D && norm(h.opponent) === D) dd++;
      else break;
    }
    if (dd >= 4 && memory.forgive === 0 && pHard < 0.64 && !looksRandom) {
      memory.forgive = 7;
      return [C, memory];
    }

    if (memory.exploitLock) {
      if (
        oppLast === D ||
        pRecip > 0.34 ||
        pGrim > 0.2 ||
        punishRate > 0.3
      ) {
        memory.exploitLock = false;
      } else {
        memory.exploitStep = (memory.exploitStep + 1) % 6;
        if (memory.exploitStep !== 5) return [D, memory];
        return [C, memory];
      }
    }

    const safeToExploit =
      n >= 10 &&
      pAllC > 0.86 &&
      defRate < 0.08 &&
      memory.testedDefection &&
      punishRate < 0.2 &&
      pRecip < 0.3 &&
      pGrim < 0.2;

    if (safeToExploit) {
      memory.exploitLock = true;
      memory.exploitStep = 0;
      return [D, memory];
    }

    const shouldProbe =
      oppLast === C &&
      n - memory.lastProbe > 13 &&
      memory.probeCooldown === 0 &&
      pMax < 0.6 &&
      pHard < 0.6 &&
      pGrim < 0.25 &&
      defRate < 0.38 &&
      !looksRandom;

    if (shouldProbe) {
      memory.lastProbe = n;
      memory.probeCooldown = 13;
      return [D, memory];
    }

    if (oppLast === D) {
      if (pHard > 0.62 || defRate > 0.54 || looksRandom) return [D, memory];
      if (memory.forgive > 0) return [C, memory];
      if (pRecip > 0.45 && memory.oppDefStreak === 1) {
        memory.forgive = 1;
        return [C, memory];
      }
      return [D, memory];
    }

    if (n >= 96) {
      if (pAllC > 0.9 && pRecip < 0.25 && pGrim < 0.15) return [D, memory];
      if (pRecip > 0.55 || pGrim > 0.25) return [C, memory];
    }

    if (pAlt > 0.55 && n % 2 === 0) return [D, memory];

    return [C, memory];
  } catch {
    const safe = init();
    if (history && history.length > 0) {
      const opp = history[history.length - 1].opponent === "D" ? "D" : "C";
      return [opp, safe];
    }
    return [C, safe];
  }
}