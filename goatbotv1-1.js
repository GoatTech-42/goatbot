// goatbot v1.1 - 0.916 average score
// deployed 9/3/26

export default function bot({
    history,
    memory
}) {
    memory = memory ?? {
        mode: "probe",
        oppC: 0,
        oppD: 0,
        recentOpp: [],
        recentYou: [],
        punish: 0,
        punishOpps: 0,
        exploitTick: 0,
        forgiveCd: 0,
        defectBursts: 0
    };

    const n = history.length;

    if (n > 0) {
        const last = history[n - 1];
        if (last.opponent === "C") memory.oppC++;
        else memory.oppD++;
        memory.recentOpp.push(last.opponent);
        memory.recentYou.push(last.you);
        if (memory.recentOpp.length > 20) memory.recentOpp.shift();
        if (memory.recentYou.length > 20) memory.recentYou.shift();

        if (n >= 2) {
            const prev = history[n - 2];
            if (prev.you === "D") {
                memory.punishOpps++;
                if (last.opponent === "D") memory.punish++;
            }
        }
    }

    const total = memory.oppC + memory.oppD;
    const coopRate = total ? memory.oppC / total : 1;
    const punishRate = memory.punishOpps ? memory.punish / memory.punishOpps : 0;
    const lastOpp = memory.recentOpp[memory.recentOpp.length - 1];
    const last2 = memory.recentOpp.slice(-2);
    const last3 = memory.recentOpp.slice(-3);
    const last4 = memory.recentOpp.slice(-4);
    const d2 = last2.filter(x => x === "D").length;
    const d3 = last3.filter(x => x === "D").length;
    const d4 = last4.filter(x => x === "D").length;

    const probe = ["C", "D", "C", "C", "D", "C", "C", "D"];
    if (n < probe.length) return [probe[n], memory];

    if (memory.mode === "probe") {
        if (coopRate <= 0.30) memory.mode = "defend";
        else if (coopRate >= 0.90 && punishRate <= 0.22) memory.mode = "exploit";
        else if (coopRate >= 0.38 && coopRate <= 0.66) memory.mode = "noisy";
        else memory.mode = "coop";
    }

    if (total >= 14) {
        if (coopRate <= 0.26) memory.mode = "defend";
        else if (coopRate >= 0.93 && punishRate <= 0.20) memory.mode = "exploit";
        else if (coopRate >= 0.36 && coopRate <= 0.68) memory.mode = "noisy";
        else memory.mode = "coop";
    }

    if (memory.forgiveCd > 0) memory.forgiveCd--;

    let dd = 0;
    for (let i = n - 1; i >= 0 && i >= n - 10; i--) {
        if (history[i].you === "D" && history[i].opponent === "D") dd++;
        else break;
    }

    if (dd >= 4 && memory.forgiveCd === 0) {
        memory.forgiveCd = 8;
        return ["C", memory];
    }

    if (memory.mode === "defend") {
        if (n % 15 === 0 && coopRate > 0.10) return ["C", memory];
        if (lastOpp === "C" && d4 <= 1 && n % 9 === 0) return ["C", memory];
        return ["D", memory];
    }

    if (memory.mode === "exploit") {
        if (d2 === 2 || punishRate > 0.45) {
            memory.mode = "coop";
            memory.exploitTick = 0;
            return ["C", memory];
        }

        memory.exploitTick = (memory.exploitTick + 1) % 7;
        if (memory.exploitTick === 0) return ["D", memory];

        if (n >= 96 && coopRate >= 0.95 && punishRate < 0.18 && n % 4 === 0) return ["D", memory];

        return ["C", memory];
    }

    if (memory.mode === "noisy") {
        if (d4 >= 3) return ["D", memory];
        if (d3 === 0 && lastOpp === "C") return ["C", memory];
        if (lastOpp === "D" && d3 >= 2) return ["D", memory];
        return n % 5 === 0 ? "D" : "C";
    }

    if (lastOpp === "D") {
        if (d3 >= 2) {
            memory.defectBursts = Math.min(memory.defectBursts + 1, 3);
            return ["D", memory];
        }
        if (d4 === 1 && coopRate > 0.72) return ["C", memory];
        return ["D", memory];
    }

    if (memory.defectBursts > 0) {
        memory.defectBursts--;
        return ["D", memory];
    }

    if (n >= 98 && coopRate > 0.88 && punishRate < 0.25 && n % 6 === 0) return ["D", memory];

    return ["C", memory];
}