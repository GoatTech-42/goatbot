// goatbot v1.3 - 1.566 average score
// deployed 9/3/26

export default function bot({
    history,
    memory
}) {
    const C = "C",
        D = "D";

    const init = () => ({
        t: 0,
        oppC: 0,
        oppD: 0,
        myC: 0,
        myD: 0,
        score: 0,
        mode: 0,
        punishLeft: 0,
        forgiveCd: 0,
        exploitStep: 0,
        probeGap: 0,
        probeUsed: 0,
        trust: 0,
        volatility: 0,
        s: {
            ac: 0,
            ad: 0,
            tft: 0,
            gtft: 0,
            wsls: 0,
            grim: 0
        },
        lastOpp: C,
        lastMy: C
    });

    const validMem = m =>
        m && typeof m === "object" && m.s && typeof m.s === "object";

    try {
        memory = validMem(memory) ? memory : init();
        const n = history.length;

        if (n === 0) return [C, memory];

        const last = history[n - 1];
        const myLast = last.you === D ? D : C;
        const oppLast = last.opponent === D ? D : C;

        memory.t = n;
        memory.lastOpp = oppLast;
        memory.lastMy = myLast;
        if (oppLast === C) memory.oppC++;
        else memory.oppD++;
        if (myLast === C) memory.myC++;
        else memory.myD++;

        memory.score +=
            myLast === C && oppLast === C ? 2 :
            myLast === D && oppLast === C ? 3 :
            myLast === C && oppLast === D ? 0 : 1;

        const total = memory.oppC + memory.oppD;
        const oppCR = total ? memory.oppC / total : 1;
        const oppDR = 1 - oppCR;

        if (n >= 2) {
            const p = history[n - 2];
            const pMy = p.you === D ? D : C;
            const pOpp = p.opponent === D ? D : C;

            const pred = {
                ac: C,
                ad: D,
                tft: pMy,
                gtft: pMy === D ? (Math.random() < 0.1 ? C : D) : C,
                wsls: pMy === pOpp ? pMy : (pMy === C ? D : C),
                grim: memory.myD > 0 ? D : C
            };

            const hit = (x, y) => (x === y ? 1 : 0);
            memory.s.ac += hit(pred.ac, oppLast) ? 2 : -2;
            memory.s.ad += hit(pred.ad, oppLast) ? 2 : -2;
            memory.s.tft += hit(pred.tft, oppLast) ? 2 : -2;
            memory.s.gtft += hit(pred.gtft, oppLast) ? 1.5 : -1.5;
            memory.s.wsls += hit(pred.wsls, oppLast) ? 2 : -2;
            memory.s.grim += hit(pred.grim, oppLast) ? 2 : -2;
        }

        if (n >= 2) {
            const a = history[n - 1].opponent === D ? 1 : 0;
            const b = history[n - 2].opponent === D ? 1 : 0;
            if (a !== b) memory.volatility = Math.min(memory.volatility + 1, 50);
            else memory.volatility = Math.max(memory.volatility - 1, 0);
        }

        memory.trust += oppLast === C ? 2 : -3;
        if (myLast === D && oppLast === D) memory.trust -= 1;
        if (myLast === C && oppLast === C) memory.trust += 1;
        if (memory.trust > 40) memory.trust = 40;
        if (memory.trust < -40) memory.trust = -40;

        const avg = memory.score / n;
        const noisy = n >= 18 && memory.volatility >= 10 && oppDR > 0.2 && oppDR < 0.8;

        const arch = memory.s;
        const bestArchScore = Math.max(arch.ac, arch.ad, arch.tft, arch.gtft, arch.wsls, arch.grim);
        const likelyAllC = arch.ac === bestArchScore && arch.ac > 6;
        const likelyAllD = arch.ad === bestArchScore && arch.ad > 6;
        const likelyRecip = (arch.tft >= bestArchScore - 2 || arch.wsls >= bestArchScore - 2) && bestArchScore > 4;
        const likelyGrim = arch.grim >= bestArchScore - 1 && arch.grim > 5;

        if (
            likelyAllD ||
            oppDR > 0.72 ||
            (n >= 20 && avg < 0.95) ||
            (noisy && oppDR > 0.45)
        ) memory.mode = 3;
        else if (
            likelyAllC &&
            oppDR < 0.06 &&
            n >= 10
        ) memory.mode = 2;
        else if (
            likelyRecip ||
            likelyGrim ||
            (oppCR > 0.55 && oppDR < 0.45)
        ) memory.mode = 1;
        else memory.mode = 0;

        if (memory.forgiveCd > 0) memory.forgiveCd--;
        if (memory.probeGap > 0) memory.probeGap--;
        if (memory.punishLeft > 0) memory.punishLeft--;

        let dd = 0;
        for (let i = n - 1; i >= 0 && i >= n - 8; i--) {
            const h = history[i];
            if (h.you === D && h.opponent === D) dd++;
            else break;
        }
        if (dd >= 4 && memory.forgiveCd === 0 && memory.mode !== 3) {
            memory.forgiveCd = 7;
            return [C, memory];
        }

        if (
            memory.mode !== 3 &&
            memory.probeGap === 0 &&
            memory.probeUsed < 6 &&
            n >= 12 &&
            oppLast === C &&
            memory.trust >= 2 &&
            !likelyGrim &&
            !likelyRecip &&
            oppDR < 0.2
        ) {
            memory.probeUsed++;
            memory.probeGap = 14;
            memory.punishLeft = 0;
            return [D, memory];
        }

        if (memory.mode === 3) {
            if (oppCR > 0.25 && n % 17 === 0) return [C, memory];
            return [D, memory];
        }

        if (memory.mode === 2) {
            memory.exploitStep = (memory.exploitStep + 1) % 5;
            if (memory.exploitStep === 0) return [D, memory];
            if (n >= 96 && oppCR > 0.97 && n % 3 === 0) return [D, memory];
            return [C, memory];
        }

        if (memory.mode === 1) {
            if (oppLast === D) {
                if (memory.forgiveCd === 0 && memory.trust > 6 && oppDR < 0.25) {
                    memory.forgiveCd = 5;
                    return [C, memory];
                }
                return [D, memory];
            }
            if (n >= 98 && oppCR > 0.9 && !likelyGrim && n % 7 === 0) return [D, memory];
            return [C, memory];
        }

        if (oppLast === D) {
            if (oppDR > 0.55 || noisy) return [D, memory];
            if (memory.trust > 8 && dither(n, total)) return [C, memory];
            return [D, memory];
        }

        if (n >= 90 && oppCR > 0.92 && !likelyRecip && n % 6 === 0) return [D, memory];
        return [C, memory];
    } catch {
        const safe = init();
        if (history && history.length) {
            const o = history[history.length - 1].opponent === "D" ? "D" : "C";
            return [o, safe];
        }
        return ["C", safe];
    }

    function dither(n, total) {
        return ((n * 31 + total * 17) % 9) < 2;
    }
}