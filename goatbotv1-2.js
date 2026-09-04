// goatbot v1.2 - 1.347 average score
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
        retaliateLeft: 0
    };

    const n = history.length;

    if (n > 0) {
        const last = history[n - 1];
        if (last.opponent === "C") memory.oppC++;
        else memory.oppD++;

        memory.recentOpp.push(last.opponent);
        memory.recentYou.push(last.you);
        if (memory.recentOpp.length > 24) memory.recentOpp.shift();
        if (memory.recentYou.length > 24) memory.recentYou.shift();

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

    const probe = ["C", "C", "D", "C", "C", "D"];
    if (n < probe.length) return [probe[n], memory];

    if (memory.mode === "probe") {
        if (coopRate <= 0.22) memory.mode = "defend";
        else if (coopRate >= 0.94 && punishRate <= 0.18) memory.mode = "exploit";
        else if (coopRate >= 0.35 && coopRate <= 0.62) memory.mode = "noisy";
        else memory.mode = "coop";
    }

    if (total >= 16) {
        if (coopRate <= 0.20) memory.mode = "defend";
        else if (coopRate >= 0.96 && punishRate <= 0.16) memory.mode = "exploit";
        else if (coopRate >= 0.33 && coopRate <= 0.64) memory.mode = "noisy";
        else memory.mode = "coop";
    }

    if (memory.forgiveCd > 0) memory.forgiveCd--;

    let ddStreak = 0;
    for (let i = n - 1; i >= 0 && i >= n - 10; i--) {
        if (history[i].you === "D" && history[i].opponent === "D") ddStreak++;
        else break;
    }
    if (ddStreak >= 5 && memory.forgiveCd === 0) {
        memory.forgiveCd = 9;
        return ["C", memory];
    }

    if (memory.mode === "defend") {
        if (n % 18 === 0 && coopRate > 0.08) return ["C", memory];
        return ["D", memory];
    }

    if (memory.mode === "exploit") {
        if (d2 === 2 || punishRate > 0.35) {
            memory.mode = "coop";
            memory.exploitTick = 0;
            return ["C", memory];
        }

        memory.exploitTick = (memory.exploitTick + 1) % 8;
        if (memory.exploitTick === 0) return ["D", memory];

        if (n >= 97 && coopRate >= 0.97 && punishRate < 0.12 && n % 5 === 0) return ["D", memory];

        return ["C", memory];
    }

    if (memory.mode === "noisy") {
        if (d4 >= 3) return ["D", memory];
        if (lastOpp === "D" && d3 >= 2) return ["D", memory];
        if (lastOpp === "C" && d3 === 0) return ["C", memory];
        return [n % 6 === 0 ? "D" : "C", memory];
    }

    if (memory.retaliateLeft > 0) {
        memory.retaliateLeft--;
        return ["D", memory];
    }

    if (lastOpp === "D") {
        if (d3 >= 2) {
            memory.retaliateLeft = 1;
            return ["D", memory];
        }
        if (d4 === 1 && coopRate > 0.80) return ["C", memory];
        return ["D", memory];
    }

    if (n >= 98 && coopRate > 0.92 && punishRate < 0.18 && n % 7 === 0) return ["D", memory];

    return ["C", memory];
}