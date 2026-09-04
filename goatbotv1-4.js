// goatbot v1.4 - 1.3313 average score
// deployed 9/3/26

export default function bot({
    history,
    memory
}) {
    const C = "C",
        D = "D";

    const init = () => ({
        oppC: 0,
        oppD: 0,
        oppDefStreak: 0,
        oppCoopStreak: 0,
        score: 0,
        mode: 0,
        probeCooldown: 0,
        forgive: 0,
        exploitCycle: 0,
        exploitConfirmed: false,
        defectLock: false,
        everWeDefected: false,
        logp: [0, 0, 0, 0, 0, 0],
        noise: 0,
        lastProbeRound: -99
    });

    try {
        memory = memory && typeof memory === "object" && Array.isArray(memory.logp) ? memory : init();
        const n = history.length;

        if (n === 0) return [C, memory];

        const last = history[n - 1];
        const myLast = last.you === D ? D : C;
        const oppLast = last.opponent === D ? D : C;

        if (oppLast === C) {
            memory.oppC++;
            memory.oppCoopStreak++;
            memory.oppDefStreak = 0;
        } else {
            memory.oppD++;
            memory.oppDefStreak++;
            memory.oppCoopStreak = 0;
        }

        const payoff =
            myLast === C && oppLast === C ? 2 :
            myLast === D && oppLast === C ? 3 :
            myLast === C && oppLast === D ? 0 : 1;
        memory.score += payoff;

        if (myLast === D) memory.everWeDefected = true;

        if (n >= 2) {
            const prev = history[n - 2];
            const prevYou = prev.you === D ? D : C;
            const prevOpp = prev.opponent === D ? D : C;

            const predAllC = C;
            const predAllD = D;
            const predTFT = prevYou;
            const predWSLS = prevYou === prevOpp ? prevYou : (prevYou === C ? D : C);
            const predGrim = memory.everWeDefected ? D : C;
            const predGTFT = prevYou === D ? D : C;

            const preds = [predAllC, predAllD, predTFT, predWSLS, predGrim, predGTFT];
            const eps = 0.06;
            for (let i = 0; i < preds.length; i++) {
                memory.logp[i] += Math.log(preds[i] === oppLast ? 1 - eps : eps);
            }

            const flip = (history[n - 1].opponent === D) !== (history[n - 2].opponent === D);
            if (flip) memory.noise = Math.min(memory.noise + 1, 50);
            else memory.noise = Math.max(memory.noise - 1, 0);
        }

        const total = memory.oppC + memory.oppD;
        const oppDefRate = total ? memory.oppD / total : 0;
        const avg = memory.score / n;

        const m = memory.logp;
        const mx = Math.max(m[0], m[1], m[2], m[3], m[4], m[5]);
        const e0 = Math.exp(m[0] - mx),
            e1 = Math.exp(m[1] - mx),
            e2 = Math.exp(m[2] - mx);
        const e3 = Math.exp(m[3] - mx),
            e4 = Math.exp(m[4] - mx),
            e5 = Math.exp(m[5] - mx);
        const z = e0 + e1 + e2 + e3 + e4 + e5;
        const pAllC = e0 / z,
            pAllD = e1 / z,
            pTFT = e2 / z,
            pWSLS = e3 / z,
            pGrim = e4 / z,
            pGTFT = e5 / z;
        const pRecip = pTFT + pWSLS + pGTFT;
        const pHard = pAllD + pGrim;
        const pMax = Math.max(pAllC, pAllD, pTFT, pWSLS, pGrim, pGTFT);

        const noisy = n >= 18 && memory.noise >= 10 && oppDefRate > 0.22 && oppDefRate < 0.78;

        if (
            memory.oppDefStreak >= 3 ||
            oppDefRate > 0.72 ||
            pHard > 0.78 ||
            (n >= 24 && avg < 0.92) ||
            (noisy && oppDefRate > 0.45)
        ) {
            memory.defectLock = true;
        }

        if (memory.defectLock) {
            if (memory.oppCoopStreak >= 4 && oppDefRate < 0.55) memory.defectLock = false;
            else return [D, memory];
        }

        if (memory.probeCooldown > 0) memory.probeCooldown--;
        if (memory.forgive > 0) memory.forgive--;

        let dd = 0;
        for (let i = n - 1; i >= 0 && i >= n - 8; i--) {
            const h = history[i];
            if (h.you === D && h.opponent === D) dd++;
            else break;
        }
        if (dd >= 4 && memory.forgive === 0 && pHard < 0.65) {
            memory.forgive = 6;
            return [C, memory];
        }

        if (!memory.exploitConfirmed) {
            if (n >= 10 && pAllC > 0.84 && memory.oppDefStreak === 0 && memory.everWeDefected) {
                memory.exploitConfirmed = true;
            }
        }

        if (memory.exploitConfirmed) {
            if (oppLast === D || pRecip > 0.45 || pGrim > 0.2) {
                memory.exploitConfirmed = false;
            } else {
                memory.exploitCycle = (memory.exploitCycle + 1) % 4;
                if (memory.exploitCycle !== 0) return [D, memory];
                return [C, memory];
            }
        }

        const shouldProbe =
            oppLast === C &&
            memory.probeCooldown === 0 &&
            n - memory.lastProbeRound > 14 &&
            pMax < 0.62 &&
            pHard < 0.6 &&
            pGrim < 0.25 &&
            oppDefRate < 0.4;

        if (shouldProbe) {
            memory.lastProbeRound = n;
            memory.probeCooldown = 14;
            return [D, memory];
        }

        if (oppLast === D) {
            if (pHard > 0.65 || oppDefRate > 0.55 || noisy) return [D, memory];
            if (memory.forgive > 0) return [C, memory];
            memory.forgive = pRecip > 0.45 ? 1 : 0;
            return [D, memory];
        }

        if (n >= 96 && pAllC > 0.9 && pRecip < 0.25) return [D, memory];

        return [C, memory];
    } catch {
        const safe = init();
        if (history && history.length) {
            const opp = history[history.length - 1].opponent === "D" ? "D" : "C";
            return [opp, safe];
        }
        return ["C", safe];
    }
}